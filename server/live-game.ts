import { randomBytes, randomInt, randomUUID, createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { WS_EVENTS, type Card } from "@shared/schema";
import {
  clientMessageSchema, serverMessageSchema, type PublicPlayer, type PublicQuestion,
  type AnswerResult, type RoomState,
} from "@shared/game-protocol";
import type { IStorage } from "./storage";
import { scoreRound, UPGRADE_COST, type GameMode } from "./game-modes";
import { consumeRate } from "./rate-limit";
import { canSubmitAnswer, publicPlayerView } from "./room-projections";
import { gradeUniversalAnswer } from "@shared/universal-questions";
import type { LiveCard, LiveKind } from "./live-question-adapter";
import type { GameReportSink } from "./game-report-types";
import type { RoomCheckpointStore } from "./room-checkpoints";
import { deliver, withDeferredDelivery } from "../examples/party-engine/durable-delivery.js";

const MAX_PLAYERS = 100;
const QUESTION_MS = 30_000;
const ROOM_TTL_MS = 10 * 60_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type ResumeReceipt = { requestId: string; tokenHash: Buffer };
type Player = {
  id: string; name: string; score: number; streak: number;
  tokenHash: Buffer; ws: WebSocket | null; connected: boolean; teamId:number; coins:number; focus:number; guard:number;
  resumeReceipt?: ResumeReceipt;
};
type Room = {
  mode:GameMode; buzzedPlayerId:string|null; buzzTimer?:ReturnType<typeof setTimeout>;
  code: string; reportId: string; reportSink?: GameReportSink; reportChain: Promise<void>; reportFailed: boolean;
  hostWs: WebSocket | null; hostTokenHash: Buffer; hostConnected: boolean;
  players: Map<string, Player>; questions: LiveCard[]; state: RoomState;
  questionIndex: number; question?: PublicQuestion; deadlineTs: number;
  answers: Map<string, { answer: unknown; explanation:string; bonusAwarded:boolean; correct: boolean; responseMs: number; awarded: number; streak:number; coins:number; focus:number; guard:number }>;
  oddReviewFinalized:boolean;
  oddRoundCount:number;oddTimeLimitMs:number;oddShuffleQuestions:boolean;oddShuffleAnswers:boolean;
  oddCorrectDisplayLetter?:"A"|"B"|"C"|"D";
  timer?: ReturnType<typeof setTimeout>; touchedAt: number;
  matchId: string; revision: number; version: number | null; saved?: string; failed?: boolean;
  requests: Map<string, string>; queue: Promise<void>; run: (operation: () => void | Promise<void>) => Promise<void>;
  buzzDeadlineTs?: number;
  hostResumeReceipt?: ResumeReceipt;
  pendingReports: Array<Parameters<GameReportSink["round"]>[0]>;
};
const socketRooms = new WeakMap<WebSocket, Room>();
const metadataSockets = new WeakSet<WebSocket>();

export function makeRoomCode(occupied: ReadonlyMap<string, unknown>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!occupied.has(code)) return code;
  }
  throw new Error("Cannot allocate room code");
}
const mintToken = () => randomBytes(32).toString("base64url");
const tokenHash = (token: string) => createHash("sha256").update(token).digest();
function tokenMatches(candidate: string, expected: Buffer): boolean {
  const received = tokenHash(candidate);
  return timingSafeEqual(received, expected);
}
const receiptJson = (receipt?: ResumeReceipt) => receipt && ({ requestId: receipt.requestId, tokenHash: receipt.tokenHash.toString("hex") });
function readReceipt(value: any): ResumeReceipt | undefined {
  if (!value) return undefined;
  if (!/^[\w-]{8,80}$/.test(value.requestId) || !/^[a-f0-9]{64}$/.test(value.tokenHash)) throw new Error("Unsupported room credentials");
  return { requestId: value.requestId, tokenHash: Buffer.from(value.tokenHash, "hex") };
}
function rotateCredential(token: string, requestId: string | undefined, current: Buffer, receipt: ResumeReceipt | undefined, domain: string) {
  const replay = !!requestId && receipt?.requestId === requestId && tokenMatches(token, receipt.tokenHash);
  if (!tokenMatches(token, current) && !replay) return null;
  const nextToken = requestId ? createHmac("sha256", token).update(`trivia-resume-v1:${domain}:${requestId}`).digest("base64url") : mintToken();
  if (replay && !tokenMatches(nextToken, current)) return null;
  return { token: nextToken, receipt: replay ? receipt : requestId ? { requestId, tokenHash: current } : undefined };
}
const isOpen = (ws: WebSocket | null | undefined): ws is WebSocket => ws?.readyState === WebSocket.OPEN;
function send(ws: WebSocket | null, type: string, payload: unknown) {
  if (!isOpen(ws)) return;
  // All outbound payloads conform to one shared schema. Never stringify internal players.
  const room = socketRooms.get(ws);
  const message = serverMessageSchema.parse({ v: 1, type, payload,
    ...(room && metadataSockets.has(ws) ? { matchId: room.matchId, revision: room.revision } : {}),
  });
  const frame = JSON.stringify(message);
  deliver(() => { if (isOpen(ws)) {
    if (ws.bufferedAmount > 65536) ws.close(1013, "Slow connection");
    else ws.send(frame);
  } });
}
function publicPlayers(room: Room): PublicPlayer[] {
  return [...room.players.values()].map(p => ({
    ...publicPlayerView(p), ...(room.mode==="teams"?{teamId:p.teamId}:{}),
  })).sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
}
function broadcast(room: Room, type: string, payload: unknown) {
  send(room.hostWs, type, payload);
  for (const p of room.players.values()) if (p.connected) send(p.ws, type, payload);
}
function lobbyUpdate(room: Room) {
  broadcast(room, WS_EVENTS.LOBBY_UPDATE, { players: publicPlayers(room) });
}
/** Aggregate-only signal restricted to the authenticated host's current socket. */
function sendSubmissionProgress(room: Room) {
  if (room.state !== "playing") return;
  send(room.hostWs, WS_EVENTS.SUBMISSION_PROGRESS, {
    questionIndex: room.questionIndex,
    received: room.answers.size,
    total: room.players.size,
    connected: [...room.players.values()].filter(p => p.connected).length,
  });
}
function resultFor(room: Room, playerId?: string): AnswerResult {
  const record = playerId ? room.answers.get(playerId) : undefined;
  const card = room.questions[room.questionIndex];
  const answer = card.universal?.answer;
  let correctAnswers: string[] | undefined;
  if (answer?.kind === "multiple_select") {
    correctAnswers = answer.correctOptionIds.map(id => answer.options.find(option => option.id === id)!.label);
  } else if (answer?.kind === "ordering") {
    correctAnswers = answer.correctOrderIds.map(id => answer.items.find(item => item.id === id)!.label);
  } else if (answer?.kind === "true_false") correctAnswers = [answer.correct ? "True" : "False"];
  return {
    questionIndex: room.questionIndex,
    ...(card.correctOption ? { correctLetter: (room.mode==="odd_one_out"?room.oddCorrectDisplayLetter:card.correctOption) as "A" | "B" | "C" | "D" } : {}),
    ...(correctAnswers ? { correctAnswers } : {}),
    isCorrect: record ? record.correct : playerId ? false : null,
    awarded: record?.awarded ?? 0, explanation:card.back,
    ...(room.mode==="odd_one_out"?{bonusAwarded:record?.bonusAwarded?1:0}:{}),
  };
}
function oddReview(room:Room) {
 return {questionIndex:room.questionIndex,finalized:room.oddReviewFinalized,entries:[...room.answers.entries()].map(([id,record])=>({playerId:id,name:room.players.get(id)!.name,correct:record.correct,explanation:record.explanation,bonusAwarded:record.bonusAwarded}))};
}
function snapshot(room: Room, ws: WebSocket, player?: Player) {
  send(ws, WS_EVENTS.SYNC_SNAPSHOT, {
    roomCode: room.code, state: room.state, players: publicPlayers(room), mode:room.mode, buzzedPlayerId:room.buzzedPlayerId,
    ...(player ? { playerId: player.id, score: player.score, answered:room.answers.has(player.id),status:{coins:player.coins,focus:player.focus,guard:player.guard} } : {}),
    ...(room.question && room.state !== "lobby" ? { question: room.question } : {}),
    ...(room.state === "reveal" || room.state === "leaderboard" || room.state === "finished"
      ? { answerResult: resultFor(room, player?.id), leaderboard: publicPlayers(room) } : {}),
    ...(!player && room.mode==="odd_one_out" && ["reveal","leaderboard","finished"].includes(room.state)?{oddReview:oddReview(room)}:{}),
  });
  if (!player && room.state === "playing") sendSubmissionProgress(room);
}
function saveRoundReport(room:Room) {
  if (room.reportSink && room.question) {
    const details = resultFor(room);
    const round = {
      id: room.reportId, questionIndex: room.questionIndex,
      prompt: room.question.prompt, kind: room.mode==="odd_one_out" ? "odd_one_out" : (room.question.kind ?? "multiple_choice"),
      options: room.question.choices, durationMs: room.question.timeLimitMs,
      correctAnswers: details.correctAnswers ??
        (details.correctLetter ? [room.question.choices[["A","B","C","D"].indexOf(details.correctLetter)]] : []),
      playerAnswers: [...room.players.values()].map(player => {
        const record = room.answers.get(player.id);
        return { playerId:player.id,name:player.name,response:record ? (room.mode==="odd_one_out"?{choice:record.answer,explanation:record.explanation,explanationBonus:record.bonusAwarded?1:0}:record.answer) : null,
          correct:record?.correct ?? false,awarded:record?.awarded ?? 0,responseMs:record?.responseMs ?? null };
      }),
    };
    room.pendingReports.push(round);
    deliver(() => flushReports(room));
  }
}
function flushReports(room: Room) {
  if (!room.reportSink || !room.pendingReports.length) return;
  room.reportChain = room.reportChain.then(async () => {
    for (const round of [...room.pendingReports]) {
      await room.reportSink!.round(round);
      room.pendingReports = room.pendingReports.filter(pending => pending.questionIndex !== round.questionIndex);
    }
    room.reportFailed = false;
  }).catch(() => {
      room.reportFailed = true;
      send(room.hostWs, WS_EVENTS.ERROR, { message: "This round could not be saved to the game report." });
  });
}
async function finishReport(room: Room) {
  await room.reportChain;
  if (room.reportSink && !room.reportFailed) {
    try { await room.reportSink.finished({ id: room.reportId, mode: room.mode, leaderboard: publicPlayers(room) }); }
    catch {
      room.reportFailed = true;
      send(room.hostWs, WS_EVENTS.ERROR, { message: "Game finished, but its report could not be finalized." });
    }
  }
}
function reveal(room: Room) {
  if (room.state !== "playing") return;
  if (room.timer) clearTimeout(room.timer);
  room.state = "reveal";
  room.revision++;
  clearTimeout(room.buzzTimer);room.buzzedPlayerId=null;
  for(const [id,record] of room.answers){
    const player=room.players.get(id)!;player.score=Math.max(0,player.score+record.awarded);player.streak=record.streak;player.coins+=record.coins;player.focus=record.focus;player.guard=record.guard;
  }
  for (const player of room.players.values()) if (!room.answers.has(player.id)) {
    const missed = scoreRound({mode:room.mode,correct:false,streak:player.streak,score:player.score,wager:0,focus:player.focus,guard:player.guard,round:room.questionIndex});
    player.streak=missed.streak;player.focus=missed.focus;player.guard=missed.guard;
  }
  if(room.mode!=="odd_one_out")saveRoundReport(room);
  lobbyUpdate(room);
  send(room.hostWs, WS_EVENTS.ANSWER_RESULT, resultFor(room));
  if(room.mode==="odd_one_out")send(room.hostWs,WS_EVENTS.ODD_REVIEW_STATE,oddReview(room));
  for (const p of room.players.values()) if (p.connected) {
    send(p.ws, WS_EVENTS.ANSWER_RESULT, resultFor(room, p.id));
    send(p.ws,WS_EVENTS.PLAYER_STATUS,{coins:p.coins,focus:p.focus,guard:p.guard});
  }
}
function startQuestion(room: Room, durationMs = QUESTION_MS) {
  room.state = "playing";
  room.revision++;
  room.answers.clear();room.oddReviewFinalized=false;room.buzzedPlayerId=null;clearTimeout(room.buzzTimer);
  broadcast(room,WS_EVENTS.BUZZ_STATE,{playerId:null});
  const card = room.questions[room.questionIndex];
  const answer = card.universal?.answer;
  const kind: LiveKind = answer && ["multiple_choice","true_false","multiple_select","ordering"].includes(answer.kind)
    ? answer.kind as LiveKind : "multiple_choice";
  const questionDuration = card.timeLimitMs ?? (room.mode==="odd_one_out"?room.oddTimeLimitMs:durationMs);
  const now = Date.now();
  room.deadlineTs = now + questionDuration;
  let choices = card.options as string[];
  room.oddCorrectDisplayLetter=undefined;
  if(room.mode==="odd_one_out") {
    const entries=choices.map((label,index)=>({label,index}));
    if(room.oddShuffleAnswers)for(let i=entries.length-1;i>0;i--){const j=randomInt(i+1);[entries[i],entries[j]]=[entries[j],entries[i]];}
    choices=entries.map(e=>e.label);
    const originalIndex=["A","B","C","D"].indexOf(card.correctOption??"");
    room.oddCorrectDisplayLetter=["A","B","C","D"][entries.findIndex(e=>e.index===originalIndex)] as "A"|"B"|"C"|"D";
  }
  let optionIds: string[] | undefined;
  if (answer?.kind === "multiple_select") optionIds = answer.options.map(option => option.id);
  if (answer?.kind === "ordering") {
    const shuffled = [...answer.items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    choices = shuffled.map(item => item.label);
    optionIds = shuffled.map(item => item.id);
  }
  room.question = {
    questionIndex: room.questionIndex, prompt: card.front, kind,
    choices, ...(optionIds ? { optionIds } : {}),
    timeLimitMs: questionDuration, totalQuestions: room.questions.length, serverStartTs: now, deadlineTs: room.deadlineTs,
  };
  broadcast(room, WS_EVENTS.QUESTION_START, room.question);
  sendSubmissionProgress(room);
  room.timer = setTimeout(() => { void room.run(() => reveal(room)); }, questionDuration);
  room.timer.unref?.();
}
async function next(room: Room, durationMs: number) {
  if (room.state === "reveal") {
    if(room.mode==="odd_one_out"&&!room.oddReviewFinalized)return;
    room.state = "leaderboard";
    room.revision++;
    broadcast(room, WS_EVENTS.LEADERBOARD, { leaderboard: publicPlayers(room) });
  } else if (room.state === "leaderboard") {
    if (room.questionIndex === room.questions.length - 1) {
      room.state = "finished";
      room.revision++;
      deliver(() => { void finishReport(room).then(() => {
        broadcast(room, WS_EVENTS.GAME_OVER, { leaderboard: publicPlayers(room) });
      }).catch(() => {}); });
    } else {
      room.questionIndex++;
      startQuestion(room, durationMs);
    }
  }
}
function allActiveAnswered(room: Room) {
  // A temporary connection loss does not remove a participant from this question.
  // Otherwise the first phone back after a restart could reveal everyone else's answers.
  return room.players.size > 0 && [...room.players.keys()].every(id => room.answers.has(id));
}
function eligibleOddCard(card:LiveCard) {
 const answer=card.universal?.answer;
 if(answer && (answer.kind!=="multiple_choice" || answer.options.length!==4))return false;
 return card.type==="multiple_choice" && Array.isArray(card.options) && card.options.length===4 && card.options.every(x=>typeof x==="string") && ["A","B","C","D"].includes(card.correctOption??"") && typeof card.back==="string" && card.back.trim().length>0;
}
function eligible(card: LiveCard) {
  if (card.universal && ["true_false","multiple_select","ordering"].includes(card.universal.answer.kind)) {
    return Array.isArray(card.options) && card.options.length >= 2 && card.options.length <= 8;
  }
  return card.type === "multiple_choice" && Array.isArray(card.options)
    && card.options.length >= 2 && card.options.length <= 4 && card.options.every(x => typeof x === "string")
    && ["A", "B", "C", "D"].slice(0,card.options.length).includes(card.correctOption ?? "");
}

/** In-memory match authority: per-room state, deadline, single answer, credentials. */
export function attachGameSocket(server: Server, storage: IStorage, options: { questionMs?: number; authorizeHost?: (request: IncomingMessage) => Promise<string | null>; extraQuestions?:(deckId:number)=>Promise<LiveCard[]>; reportSink?:GameReportSink; checkpointStore?: RoomCheckpointStore; heartbeatMs?: number } = {}) {
  const durationMs = options.questionMs ?? QUESTION_MS;
  const rooms = new Map<string, Room>();
  const loading = new Map<string, Promise<Room | undefined>>();
  let closing = false;
  const fields = ["mode", "buzzedPlayerId", "buzzDeadlineTs", "code", "reportId", "reportFailed", "questions", "state",
    "questionIndex", "question", "deadlineTs", "oddReviewFinalized", "oddRoundCount", "oddTimeLimitMs",
    "oddShuffleQuestions", "oddShuffleAnswers", "oddCorrectDisplayLetter", "touchedAt", "matchId", "revision", "pendingReports"] as const;
  function checkpoint(room: Room) {
    return { v: 1, room: Object.fromEntries(fields.map(key => [key, room[key]])),
      hostTokenHash: room.hostTokenHash.toString("hex"),
      hostResumeReceipt: receiptJson(room.hostResumeReceipt),
      players: [...room.players.values()].map(({ ws, tokenHash, resumeReceipt, ...player }) => ({ ...player, tokenHash: tokenHash.toString("hex"), resumeReceipt: receiptJson(resumeReceipt) })),
      answers: [...room.answers], requests: [...room.requests],
    };
  }
  function failRecovery(room: Room, ws?: WebSocket) {
    room.failed = true;
    if (rooms.get(room.code) === room) rooms.delete(room.code);
    clearTimeout(room.timer); clearTimeout(room.buzzTimer);
    const peers = [room.hostWs, ...[...room.players.values()].map(player => player.ws), ws];
    for (const socket of new Set(peers.filter(isOpen))) {
      send(socket, WS_EVENTS.ERROR, { message: "Room recovery could not be saved. Please reconnect." });
      socket.close(1013, "Recovery storage unavailable");
    }
  }
  function transact(room: Room, operation: () => void | Promise<void>, ws?: WebSocket) {
    const next = room.queue.then(async () => {
      if (closing || room.failed || rooms.get(room.code) !== room) return;
      await withDeferredDelivery(operation, async () => {
        if (!options.checkpointStore) return;
        const data = checkpoint(room), serialized = JSON.stringify(data);
        if (serialized === room.saved) return;
        room.version = await options.checkpointStore.save("quiz", room.code, data, room.touchedAt + ROOM_TTL_MS, room.version);
        room.saved = serialized;
      });
    });
    room.queue = next.catch(() => failRecovery(room, ws));
    return room.queue;
  }
  function bindRoom(data: Omit<Room, "queue" | "run" | "pendingReports"> & { pendingReports?: Room["pendingReports"] }): Room {
    const room: Room = { ...data, pendingReports: data.pendingReports ?? [], queue: Promise.resolve(), run: operation => transact(room, operation) };
    return room;
  }
  async function recover(code: string): Promise<Room | undefined> {
    if (rooms.has(code)) return rooms.get(code);
    if (!options.checkpointStore) return undefined;
    if (!loading.has(code)) {
      const pending = (async () => {
        const saved = await options.checkpointStore!.load("quiz", code);
        if (!saved) return undefined;
        const data = saved.state;
        if (data?.v !== 1 || data.room?.code !== code || !Array.isArray(data.players) || data.players.length > MAX_PLAYERS
          || !Array.isArray(data.room.questions) || !data.room.questions.length || data.room.questions.length > 500
          || !/^[a-f0-9]{64}$/.test(data.hostTokenHash) || !Array.isArray(data.answers) || !Array.isArray(data.requests)
          || data.requests.length > 4096 || !["lobby", "playing", "reveal", "leaderboard", "finished"].includes(data.room.state))
          throw new Error("Unsupported room recovery state");
        const restoredFields = Object.fromEntries(fields.map(key => [key, data.room[key]]));
        const players = new Map<string, Player>();
        for (const player of data.players) {
          if (!/^[a-f0-9]{64}$/.test(player.tokenHash)) throw new Error("Unsupported room credentials");
          players.set(player.id, { ...player, tokenHash: Buffer.from(player.tokenHash, "hex"), resumeReceipt: readReceipt(player.resumeReceipt), ws: null, connected: false });
        }
        const room = bindRoom({ ...restoredFields, players, hostWs: null, hostConnected: false,
          hostTokenHash: Buffer.from(data.hostTokenHash, "hex"), hostResumeReceipt: readReceipt(data.hostResumeReceipt), answers: new Map(data.answers), requests: new Map(data.requests),
          reportSink: options.reportSink, reportChain: Promise.resolve(), version: saved.version,
        } as Omit<Room, "queue" | "run">);
        if (closing) return undefined;
        if (rooms.size >= 500) throw new Error("Room capacity reached");
        rooms.set(code, room);
        flushReports(room);
        if (room.state === "finished") void finishReport(room).catch(() => {});
        if (room.state === "playing") {
          room.timer = setTimeout(() => { void room.run(() => reveal(room)); }, Math.max(0, room.deadlineTs - Date.now()));
          room.timer.unref?.();
          if (room.buzzedPlayerId) {
            room.buzzTimer = setTimeout(() => { void room.run(() => {
              room.buzzedPlayerId = null; broadcast(room, WS_EVENTS.BUZZ_STATE, { playerId: null });
            }); }, Math.max(0, (room.buzzDeadlineTs ?? 0) - Date.now()));
            room.buzzTimer.unref?.();
          }
        }
        return room;
      })();
      loading.set(code, pending);
      pending.finally(() => loading.delete(code)).catch(() => {});
    }
    return loading.get(code);
  }
  const createLimits = new Map<string, { count: number; resetAt: number }>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  // Claim only the private-deck quiz path. Other sockets share this HTTP listener.
  const upgrade = (req: IncomingMessage, socket: import("node:stream").Duplex, head: Buffer) => {
    if (req.url?.split("?")[0] !== "/ws") return;
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  };
  server.on("upgrade", upgrade);
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.touchedAt > ROOM_TTL_MS) {
        if (room.timer) clearTimeout(room.timer);
        clearTimeout(room.buzzTimer);rooms.delete(code);
        void options.checkpointStore?.delete("quiz", code, room.version ?? undefined).catch(() => {});
        if (isOpen(room.hostWs)) room.hostWs.close(1001, "Room expired");
        for (const p of room.players.values()) if (isOpen(p.ws)) p.ws.close(1001, "Room expired");
      }
    }
    for (const [ip, limit] of createLimits) if (limit.resetAt < now) createLimits.delete(ip);
    void options.checkpointStore?.prune().catch(() => {});
  }, 60_000);
  cleanup.unref?.();
  const alive = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) { ws.terminate(); continue; }
      alive.delete(ws); ws.ping();
    }
  }, options.heartbeatMs ?? 15000);
  heartbeat.unref?.();

  wss.on("connection", (ws, req) => {
    // Protocol/frame errors close this connection without crashing the match server.
    ws.on("error", () => {});
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) {
          ws.close(1008, "Invalid origin");
          return;
        }
      } catch {
        ws.close(1008, "Invalid origin");
        return;
      }
    }
    const ip = req.socket.remoteAddress ?? "unknown";
    if(wss.clients.size>2000||!consumeRate(`connect:${ip}`,200,60_000)){ws.close(1008,"Connection capacity reached");return;}
    let room: Room | undefined;
    let role: "host" | "player" | undefined;
    let playerId: string | undefined;
    let recentCount = 0;
    let windowStart = Date.now();

    let rejected = false;
    const error = (message: string) => { rejected = true; send(ws, WS_EVENTS.ERROR, { message }); };
    let connectionQueue = Promise.resolve();
    ws.on("message", (raw) => { connectionQueue = connectionQueue.then(async () => {
      rejected = false;
      const now = Date.now();
      if (now - windowStart >= 10_000) { windowStart = now; recentCount = 0; }
      if (++recentCount > 40) { ws.close(1008, "Rate limit"); return; }
      const decoded = (() => {
        try { return JSON.parse(raw.toString()); } catch { return null; }
      })();
      if (decoded?.type === "ping" && Object.keys(decoded).length === 1) {
        ws.send(JSON.stringify({ type: "pong", serverNow: Date.now() })); return;
      }
      const parsed = clientMessageSchema.safeParse(decoded);
      if (!parsed.success) { error("Invalid protocol message"); return; }
      const msg = parsed.data;
      if (msg.requestId) metadataSockets.add(ws);
      const handle = async () => {
      try {
        if (msg.type === WS_EVENTS.CREATE_ROOM) {
          if (role) { error("Already in a room"); return; }
          if (rooms.size >= 500) { error("Room capacity reached"); return; }
          const limit = createLimits.get(ip) ?? { count: 0, resetAt: now + 60_000 };
          if (now > limit.resetAt) { limit.count = 0; limit.resetAt = now + 60_000; }
          if (++limit.count > 5) { error("Room creation rate limit"); return; }
          createLimits.set(ip, limit);
          const ownerId = await options.authorizeHost?.(req);
          if (!ownerId) { error("Sign in required to host a private deck"); return; }
          const deck = await storage.getDeck(msg.payload.deckId, ownerId);
          const extra=deck?await options.extraQuestions?.(msg.payload.deckId)??[]:[];
          const questions = [...(deck?.cards??[]),...extra].filter(eligible);
          if (!questions.length) { error("Deck requires at least one supported live question (choice, true/false, multi-select or ordering)"); return; }
          // Check again after asynchronous database access, before taking socket ownership.
          if (role || !isOpen(ws)) return;
          if (rooms.size >= 500) { error("Room capacity reached"); return; }
          if(!consumeRate(`host:${ownerId}`,5,60_000)){error("Room creation rate limit");return;}
          const code = makeRoomCode(rooms);
          if (options.checkpointStore && await options.checkpointStore.load("quiz", code)) { error("Room code is occupied; try again"); return; }
          const reportId = randomUUID();
          if (options.reportSink) await options.reportSink.created({
            id:reportId, ownerId, deckId:msg.payload.deckId, deckTitle:deck?.title ?? "Untitled quiz",
          });
          const hostToken = mintToken();
          room = bindRoom({
            matchId: randomUUID(), revision: 0, version: null, requests: new Map(),
            oddReviewFinalized:false,oddRoundCount:20,oddTimeLimitMs:options.questionMs??45_000,oddShuffleQuestions:false,oddShuffleAnswers:false,mode:"classic",buzzedPlayerId:null,code,reportId,reportSink:options.reportSink,
            reportChain:Promise.resolve(),reportFailed:false,hostWs: ws, hostTokenHash: tokenHash(hostToken), hostConnected: true,
            players: new Map(), questions, state: "lobby", questionIndex: -1,
            deadlineTs: 0, answers: new Map(), touchedAt: now,
          });
          rooms.set(code, room); role = "host"; socketRooms.set(ws, room);
          await transact(room, () => { send(ws, WS_EVENTS.ROOM_CREATED, { roomCode: code, hostToken }); snapshot(room!, ws); }, ws);
          return;
        }
        if (msg.type === WS_EVENTS.JOIN_ROOM) {
          if (role) { error("Already in a room"); return; }
          if (!consumeRate(`join:${ip}`, 30, 60_000)) { error("Joining too often; try again shortly"); return; }
          const target = rooms.get(msg.payload.roomCode);
          if (!target || target.state === "finished") { error("Room unavailable"); return; }
          if (target.state !== "lobby") { error("Game started; reconnect with your credential"); return; }
          if (target.players.size >= MAX_PLAYERS) { error("Room full"); return; }
          const token = mintToken();
          const id = randomUUID();
          const player: Player = {
            id, name: msg.payload.playerName, score: 0, streak: 0,
            tokenHash: tokenHash(token), ws, connected: true, teamId:target.players.size%2+1,coins:60,focus:0,guard:0,
          };
          target.players.set(id, player);
          room = target; role = "player"; playerId = id; target.touchedAt = now; socketRooms.set(ws, target);
          send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: target.code, playerId: id, token });
          snapshot(target, ws, player); lobbyUpdate(target);
          return;
        }
        if (msg.type === WS_EVENTS.REJOIN_ROOM) {
          if (role) { error("Already in a room"); return; }
          // Twenty phones share one household IP and may each reconnect more than once.
          if (!consumeRate(`rejoin:${ip}`, 120, 60_000)) { error("Reconnect rate limit"); return; }
          const target = rooms.get(msg.payload.roomCode);
          const player = target?.players.get(msg.payload.playerId);
          const rotated = target && player && rotateCredential(msg.payload.token, msg.requestId, player.tokenHash, player.resumeReceipt, `${target.matchId}:${player.id}`);
          if (!target || !player || !rotated) {
            error("Invalid reconnect credentials"); return;
          }
          const newToken = rotated.token;
          const prior = player.ws;
          player.ws = ws; player.connected = true; player.tokenHash = tokenHash(newToken);
          player.resumeReceipt = rotated.receipt;
          room = target; role = "player"; playerId = player.id; target.touchedAt = now; socketRooms.set(ws, target);
          send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: target.code, playerId: player.id, token: newToken });
          snapshot(target, ws, player); lobbyUpdate(target); sendSubmissionProgress(target);
          if (prior !== ws) deliver(() => prior?.close(1000, "Session replaced"));
          return;
        }
        if (msg.type === WS_EVENTS.RESUME_HOST) {
          if (role) { error("Already in a room"); return; }
          const target = rooms.get(msg.payload.roomCode);
          const rotated = target && rotateCredential(msg.payload.hostToken, msg.requestId, target.hostTokenHash, target.hostResumeReceipt, `${target.matchId}:host`);
          if (!target || !rotated) {
            error("Invalid host credentials"); return;
          }
          const newToken = rotated.token;
          const prior = target.hostWs;
          target.hostWs = ws; target.hostConnected = true; target.hostTokenHash = tokenHash(newToken);
          target.hostResumeReceipt = rotated.receipt;
          target.touchedAt = now; room = target; role = "host"; socketRooms.set(ws, target);
          send(ws, WS_EVENTS.HOST_RESUMED, { roomCode: target.code, hostToken: newToken });
          snapshot(target, ws);
          if (prior !== ws) deliver(() => prior?.close(1000, "Host session replaced"));
          return;
        }
        if (!room || !role || !isOpen(ws)) { error("Join a room first"); return; }
        room.touchedAt = now;
        if (msg.payload.roomCode && msg.payload.roomCode !== room.code) {
          error("Room mismatch"); return;
        }
        if (msg.type === WS_EVENTS.CONFIRM_SESSION) {
          if (role === "host" && room.hostWs === ws) room.hostResumeReceipt = undefined;
          else if (role === "player" && playerId && room.players.get(playerId)?.ws === ws) room.players.get(playerId)!.resumeReceipt = undefined;
          else error("Connection replaced or not authorized");
          return;
        }
        if(msg.type===WS_EVENTS.CONFIGURE_GAME){
          if(role!=="host"||room.hostWs!==ws||room.state!=="lobby"){error("Host can select the mode only in the lobby");return;}
          if(msg.payload.mode==="odd_one_out"&&!room.questions.every(eligibleOddCard)){error("Odd One Out requires four choices and an explanation for every question in this deck");return;}
          if(msg.payload.mode!=="odd_one_out" && (msg.payload.roundCount!==undefined||msg.payload.timeLimitMs!==undefined||msg.payload.shuffleQuestions!==undefined||msg.payload.shuffleAnswers!==undefined)){error("Odd One Out options require Odd One Out mode");return;}
          if(msg.payload.mode==="odd_one_out") {
            room.oddRoundCount=msg.payload.roundCount??room.oddRoundCount;
            room.oddTimeLimitMs=msg.payload.timeLimitMs??room.oddTimeLimitMs;
            room.oddShuffleQuestions=msg.payload.shuffleQuestions??room.oddShuffleQuestions;
            room.oddShuffleAnswers=msg.payload.shuffleAnswers??room.oddShuffleAnswers;
          }
          room.revision++; room.mode=msg.payload.mode;broadcast(room,WS_EVENTS.GAME_CONFIGURED,{mode:room.mode});lobbyUpdate(room);return;
        }
        if(msg.type===WS_EVENTS.AWARD_ODD_BONUS){
          if(role!=="host"||room.hostWs!==ws||room.mode!=="odd_one_out"||room.state!=="reveal"||room.oddReviewFinalized||room.questionIndex!==msg.payload.questionIndex){error("Bonus review is unavailable");return;}
          const answer=room.answers.get(msg.payload.playerId);
          if(!answer||!answer.correct||!answer.explanation.trim()||answer.bonusAwarded){error("Explanation bonus is not eligible");return;}
          answer.bonusAwarded=true;
          send(ws,WS_EVENTS.ODD_REVIEW_STATE,oddReview(room));return;
        }
        if(msg.type===WS_EVENTS.FINALIZE_ODD_REVIEW){
          if(role!=="host"||room.hostWs!==ws||room.mode!=="odd_one_out"||room.state!=="reveal"||room.oddReviewFinalized||room.questionIndex!==msg.payload.questionIndex){error("Cannot finalize bonus review");return;}
          room.oddReviewFinalized=true;
          for(const [id,answer] of room.answers){if(answer.bonusAwarded){const player=room.players.get(id)!;answer.awarded+=1;player.score+=1;}}
          saveRoundReport(room);
          lobbyUpdate(room);
          for(const player of room.players.values())if(player.connected)send(player.ws,WS_EVENTS.ANSWER_RESULT,resultFor(room,player.id));
          send(ws,WS_EVENTS.ODD_REVIEW_STATE,oddReview(room));return;
        }
        if(msg.type===WS_EVENTS.BUY_UPGRADE){
          const player=playerId?room.players.get(playerId):undefined;
          if(role!=="player"||player?.ws!==ws||room.mode!=="workshop"||!["reveal","leaderboard"].includes(room.state)){error("Workshop purchases are available to players between rounds");return;}
          const upgrade=msg.payload.upgrade,cost=UPGRADE_COST[upgrade];
          if(player[upgrade]>0||player.coins<cost){error("Upgrade unavailable or not enough coins");return;}
          player.coins-=cost;player[upgrade]++;send(ws,WS_EVENTS.PLAYER_STATUS,{coins:player.coins,focus:player.focus,guard:player.guard});return;
        }
        if(msg.type===WS_EVENTS.BUZZ){
          if(role!=="player"||!playerId||room.players.get(playerId)?.ws!==ws||room.mode!=="buzzer"||room.state!=="playing"||now>=room.deadlineTs||msg.payload.questionIndex!==room.questionIndex||room.answers.has(playerId)){error("Cannot buzz now");return;}
          if(room.buzzedPlayerId){error("Another player has the buzzer");return;}
          room.buzzedPlayerId=playerId;broadcast(room,WS_EVENTS.BUZZ_STATE,{playerId});
          const questionIndex=room.questionIndex,activeRoom=room;
          room.buzzDeadlineTs = now + 5000;
          room.buzzTimer=setTimeout(()=>{void activeRoom.run(() => {if(activeRoom.state==="playing"&&activeRoom.questionIndex===questionIndex){activeRoom.buzzedPlayerId=null;broadcast(activeRoom,WS_EVENTS.BUZZ_STATE,{playerId:null});}});},5000);
          room.buzzTimer.unref?.();return;
        }
        if (msg.type === WS_EVENTS.START_GAME) {
          if (role !== "host" || room.hostWs !== ws || room.state !== "lobby") {
            error("Host must start from lobby"); return;
          }
          if (!room.players.size) { error("At least one player is required"); return; }
          if(room.mode==="odd_one_out") {
            const selected=[...room.questions];
            if(room.oddShuffleQuestions)for(let i=selected.length-1;i>0;i--){const j=randomInt(i+1);[selected[i],selected[j]]=[selected[j],selected[i]];}
            room.questions=selected.slice(0,Math.min(room.oddRoundCount,selected.length));
          }
          room.questionIndex = 0;
          broadcast(room, WS_EVENTS.GAME_STARTED, {});
          startQuestion(room, durationMs);
        } else if (msg.type === WS_EVENTS.NEXT_QUESTION) {
          if (role !== "host" || room.hostWs !== ws || !["reveal", "leaderboard"].includes(room.state)) {
            error("Host can advance only after reveal"); return;
          }
          await next(room, durationMs);
        } else if (msg.type === WS_EVENTS.SUBMIT_ANSWER) {
          if (role !== "player" || !playerId || room.players.get(playerId)?.ws !== ws) {
            error("Players only"); return;
          }
          if (room.state !== "playing" || now >= room.deadlineTs) {
            if (room.state === "playing") reveal(room);
            error("Answer deadline passed"); return;
          }
          if (msg.payload.questionIndex !== room.questionIndex) {
            error("Wrong question index"); return;
          }
          if (room.answers.has(playerId)) { error("Answer already submitted"); return; }
          const player = room.players.get(playerId)!;
          const current=room.questions[room.questionIndex];
          if (!canSubmitAnswer({
            gameState: room.state,
            connected: player.connected,
            socketMatchesPlayer: player.ws === ws,
            alreadyAnswered: room.answers.has(playerId),
            questionExists: !!current,
          })) { error("Cannot answer in the current state"); return; }
          if(room.mode==="buzzer"&&room.buzzedPlayerId!==playerId){error("Buzz in before answering");return;}
          const received = msg.payload.answer;
          if(room.mode==="odd_one_out" && (!eligibleOddCard(current)||typeof received!=="string")){error("Invalid Odd One Out choice");return;}
          if(room.mode!=="odd_one_out" && msg.payload.explanation){error("Explanations are available only in Odd One Out");return;}
          const universal = current.universal;
          let correct: boolean;
          if (universal?.answer.kind === "true_false") {
            if (typeof received !== "object" || !("value" in received)) { error("Invalid true/false answer"); return; }
            correct = gradeUniversalAnswer(universal, received);
          } else if (universal?.answer.kind === "multiple_select" || universal?.answer.kind === "ordering") {
            const ids = room.question?.optionIds;
            const field = universal.answer.kind === "multiple_select" ? "selectedIds" : "orderIds";
            if (typeof received !== "object" || !(field in received) || !ids) { error("Invalid answer format"); return; }
            const submitted = field === "selectedIds" ? ("selectedIds" in received ? received.selectedIds : []) :
              ("orderIds" in received ? received.orderIds : []);
            if (!Array.isArray(submitted) || new Set(submitted).size !== submitted.length ||
                submitted.some(id => !ids.includes(id)) ||
                (field === "orderIds" && submitted.length !== ids.length)) { error("Invalid answer option"); return; }
            correct = gradeUniversalAnswer(universal, received);
          } else {
            if (typeof received !== "string" || !["A","B","C","D"].slice(0,(current.options as string[]).length).includes(received)) {
              error("Invalid answer choice"); return;
            }
            correct = received === (room.mode==="odd_one_out"?room.oddCorrectDisplayLetter:current.correctOption);
          }
          const responseMs = Math.max(0, now - (room.question?.serverStartTs ?? now));
          const scored=scoreRound({mode:room.mode,correct,streak:player.streak,score:player.score,wager:msg.payload.wager,focus:player.focus,guard:player.guard,round:room.questionIndex,pointsFactor:current.pointsFactor,responseMs,timeLimitMs:room.question?.timeLimitMs});
          room.answers.set(playerId, { answer:msg.payload.answer,explanation:room.mode==="odd_one_out"?(msg.payload.explanation??""):"",bonusAwarded:false,correct,responseMs,...scored });
          send(ws,WS_EVENTS.ANSWER_ACCEPTED,{questionIndex:room.questionIndex});
          sendSubmissionProgress(room);
          if(room.mode==="buzzer"){
            clearTimeout(room.buzzTimer);room.buzzedPlayerId=null;
            broadcast(room,WS_EVENTS.BUZZ_STATE,{playerId:null});
            if(correct){reveal(room);return;}
          }
          if (allActiveAnswered(room)) reveal(room);
        }
      } catch (err) {
        console.error("Game socket handler failed", err instanceof Error ? err.name : "UnknownError");
        error(err instanceof Error && err.message.startsWith("Wager") ? err.message : "Game request failed");
      }
      };
      const handshake = [WS_EVENTS.CREATE_ROOM, WS_EVENTS.JOIN_ROOM, WS_EVENTS.REJOIN_ROOM, WS_EVENTS.RESUME_HOST].includes(msg.type as any);
      if (msg.type === WS_EVENTS.CREATE_ROOM) { await handle(); return; }
      const target = room ?? ("roomCode" in msg.payload && msg.payload.roomCode ? await recover(msg.payload.roomCode) : undefined);
      if (!target) { await handle(); return; }
      await transact(target, async () => {
        if (target.state === "playing" && Date.now() >= target.deadlineTs) reveal(target);
        if (!handshake) {
          const owns = role === "host" ? target.hostWs === ws : !!playerId && target.players.get(playerId)?.ws === ws;
          if (!owns) { error("Connection replaced or not authorized"); return; }
          const key = `${role === "host" ? "host" : playerId}:${msg.requestId}`;
          const fingerprint = JSON.stringify(msg), previous = msg.requestId ? target.requests.get(key) : undefined;
          if (previous) {
            if (previous !== fingerprint) { error("Request ID conflict"); return; }
            send(ws, WS_EVENTS.ACTION_ACK, { requestId: msg.requestId!, accepted: true });
            snapshot(target, ws, role === "player" ? target.players.get(playerId!) : undefined);
            return;
          }
          if ((msg.matchId !== undefined && msg.matchId !== target.matchId) || (msg.revision !== undefined && msg.revision !== target.revision)) {
            error("Your screen is out of date. Synchronizing the current round.");
            snapshot(target, ws, role === "player" ? target.players.get(playerId!) : undefined); return;
          }
          await handle();
          if (msg.requestId && !rejected) {
            target.requests.set(key, fingerprint);
            const own = [...target.requests.keys()].filter(id => id.startsWith(`${role === "host" ? "host" : playerId}:`));
            if (own.length > 256) target.requests.delete(own[0]);
            if (target.requests.size > 4096) target.requests.delete(target.requests.keys().next().value!);
            send(ws, WS_EVENTS.ACTION_ACK, { requestId: msg.requestId, accepted: true });
          }
        } else await handle();
      }, ws);
    }).catch(() => {
      if (room) failRecovery(room, ws);
      else { send(ws, WS_EVENTS.ERROR, { message: "Room recovery is temporarily unavailable. Please reconnect." }); ws.close(1013, "Recovery storage unavailable"); }
    }); });
    ws.on("close", () => {
      if (!room || closing) return;
      const disconnectedRoom = room;
      void disconnectedRoom.run(() => {
      if (role === "host" && disconnectedRoom.hostWs === ws) disconnectedRoom.hostConnected = false;
      if (role === "player" && playerId) {
        const player = disconnectedRoom.players.get(playerId);
        if (player?.ws === ws) { player.connected = false; lobbyUpdate(disconnectedRoom); sendSubmissionProgress(disconnectedRoom); }
      }
      });
    });
  });
  wss.on("close",()=>{closing=true;server.off("upgrade",upgrade);clearInterval(cleanup);clearInterval(heartbeat);for(const room of rooms.values()){clearTimeout(room.timer);clearTimeout(room.buzzTimer);}rooms.clear();});
  return wss;
}
