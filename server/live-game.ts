import { randomBytes, randomInt, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { WS_EVENTS, type Card } from "@shared/schema";
import {
  clientMessageSchema, serverMessageSchema, type PublicPlayer, type PublicQuestion,
  type AnswerResult, type RoomState,
} from "@shared/game-protocol";
import type { IStorage } from "./storage";
import { scoreAnswer, type GameMode, type Upgrade } from "./game-modes";
import { windowLimiter } from "./rate-limit";

const MAX_PLAYERS = 100;
const QUESTION_MS = 30_000;
const ROOM_TTL_MS = 10 * 60_000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type Player = {
  id: string; name: string; score: number; streak: number; coins:number; upgrade?:Upgrade; team?:"Orchid"|"Lagoon";
  tokenHash: Buffer; ws: WebSocket; connected: boolean;
};
type Room = {
  code: string; ownerId: string; hostWs: WebSocket; hostTokenHash: Buffer; hostConnected: boolean;
  players: Map<string, Player>; questions: Card[]; state: RoomState;
  mode:GameMode; buzzerPlayerId?:string;
  questionIndex: number; question?: PublicQuestion; deadlineTs: number;
  answers: Map<string, { answer: string; correct: boolean; awarded: number; scoreAfter:number; streakAfter:number; coinsAwarded:number }>;
  timer?: ReturnType<typeof setTimeout>; touchedAt: number;
};

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
const isOpen = (ws: WebSocket) => ws.readyState === WebSocket.OPEN;
function send(ws: WebSocket, type: string, payload: unknown) {
  if (!isOpen(ws)) return;
  // All outbound payloads conform to one shared schema. Never stringify internal players.
  const message = serverMessageSchema.parse({ v: 1, type, payload });
  ws.send(JSON.stringify(message));
}
function publicPlayers(room: Room): PublicPlayer[] {
  return [...room.players.values()].map(p => ({
    playerId: p.id, name: p.name, score: p.score, connected: p.connected,
    ...(p.team?{team:p.team}:{}), coins:p.coins, ...(p.upgrade?{upgrade:p.upgrade}:{}),
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
function broadcast(room: Room, type: string, payload: unknown) {
  send(room.hostWs, type, payload);
  for (const p of room.players.values()) if (p.connected) send(p.ws, type, payload);
}
function lobbyUpdate(room: Room) {
  broadcast(room, WS_EVENTS.LOBBY_UPDATE, { players: publicPlayers(room) });
}
function resultFor(room: Room, playerId?: string): AnswerResult {
  const record = playerId ? room.answers.get(playerId) : undefined;
  return {
    questionIndex: room.questionIndex,
    correctLetter: room.questions[room.questionIndex].correctOption as "A" | "B" | "C" | "D",
    isCorrect: record ? record.correct : playerId ? false : null,
    awarded: record?.awarded ?? 0,
  };
}
function snapshot(room: Room, ws: WebSocket, player?: Player) {
  send(ws, WS_EVENTS.SYNC_SNAPSHOT, {
    roomCode: room.code, state: room.state, mode:room.mode, answered:player?room.answers.has(player.id):false, buzzerPlayerId:room.buzzerPlayerId??null, players: publicPlayers(room),
    ...(player ? { playerId: player.id, score: player.score } : {}),
    ...(room.question && room.state !== "lobby" ? { question: room.question } : {}),
    ...(room.state === "reveal" || room.state === "leaderboard" || room.state === "finished"
      ? { answerResult: resultFor(room, player?.id), leaderboard: publicPlayers(room) } : {}),
  });
}
function reveal(room: Room) {
  if (room.state !== "playing") return;
  if (room.timer) clearTimeout(room.timer);
  room.state = "reveal";
  for(const player of room.players.values()) {
    const record=room.answers.get(player.id);
    if(record) {player.score=record.scoreAfter;player.streak=record.streakAfter;player.coins+=record.coinsAwarded;}
    else {player.streak=player.upgrade === "streak_guard" ? player.streak : 0; player.upgrade=undefined;}
  }
  send(room.hostWs, WS_EVENTS.ANSWER_RESULT, resultFor(room));
  for (const p of room.players.values()) if (p.connected) {
    send(p.ws, WS_EVENTS.ANSWER_RESULT, resultFor(room, p.id));
  }
  lobbyUpdate(room);
}
function startQuestion(room: Room, durationMs = QUESTION_MS) {
  room.state = "playing";
  room.answers.clear();
  room.buzzerPlayerId=undefined;
  broadcast(room, WS_EVENTS.BUZZER_UPDATE, {playerId:null});
  const card = room.questions[room.questionIndex];
  const now = Date.now();
  if (room.mode === "party" && durationMs === QUESTION_MS) durationMs = 15_000;
  room.deadlineTs = now + durationMs;
  room.question = {
    questionIndex: room.questionIndex, prompt: card.front,
    choices: card.options as string[], timeLimitMs: durationMs,
    serverStartTs: now, deadlineTs: room.deadlineTs,
  };
  broadcast(room, WS_EVENTS.QUESTION_START, room.question);
  room.timer = setTimeout(() => reveal(room), durationMs);
  room.timer.unref?.();
}
function next(room: Room, durationMs: number) {
  if (room.state === "reveal") {
    room.state = "leaderboard";
    broadcast(room, WS_EVENTS.LEADERBOARD, { leaderboard: publicPlayers(room) });
  } else if (room.state === "leaderboard") {
    if (room.questionIndex === room.questions.length - 1) {
      room.state = "finished";
      broadcast(room, WS_EVENTS.GAME_OVER, { leaderboard: publicPlayers(room) });
    } else {
      room.questionIndex++;
      startQuestion(room, durationMs);
    }
  }
}
function allActiveAnswered(room: Room) {
  const online = [...room.players.values()].filter(p => p.connected);
  return online.length > 0 && online.every(p => room.answers.has(p.id));
}
function eligible(card: Card) {
  return card.type === "multiple_choice" && Array.isArray(card.options)
    && card.options.length === 4 && card.options.every(x => typeof x === "string")
    && ["A", "B", "C", "D"].includes(card.correctOption ?? "");
}

/** In-memory match authority: per-room state, deadline, single answer, credentials. */
export function attachGameSocket(server: Server, storage: IStorage, options: { questionMs?: number; resolveUser: (cookie: string | undefined) => Promise<{ id: string } | null> }) {
  const durationMs = options.questionMs ?? QUESTION_MS;
  const rooms = new Map<string, Room>();
  const createLimits = new Map<string, { count: number; resetAt: number }>();
  const allowJoin = windowLimiter(60, 60_000);
  const allowConnect = windowLimiter(120, 60_000);
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096, perMessageDeflate: false });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.touchedAt > ROOM_TTL_MS) {
        if (room.timer) clearTimeout(room.timer);
        rooms.delete(code);
        if (isOpen(room.hostWs)) room.hostWs.close(1001, "Room expired");
        for (const p of room.players.values()) if (isOpen(p.ws)) p.ws.close(1001, "Room expired");
      }
    }
    for (const [ip, limit] of createLimits) if (limit.resetAt < now) createLimits.delete(ip);
  }, 60_000);
  cleanup.unref?.();

  wss.on("connection", (ws, req) => {
    ws.on("error", () => {}); // Oversized frames close safely without an unhandled emitter error.
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
    if (!allowConnect(ip) || wss.clients.size > 2000) { ws.close(1008, "Connection limit"); return; }
    let room: Room | undefined;
    let role: "host" | "player" | undefined;
    let playerId: string | undefined;
    let recentCount = 0;
    let windowStart = Date.now();

    const error = (message: string) => send(ws, WS_EVENTS.ERROR, { message });
    ws.on("message", async (raw) => {
      const now = Date.now();
      if (now - windowStart >= 10_000) { windowStart = now; recentCount = 0; }
      if (++recentCount > 40) { ws.close(1008, "Rate limit"); return; }
      const parsed = clientMessageSchema.safeParse((() => {
        try { return JSON.parse(raw.toString()); } catch { return null; }
      })());
      if (!parsed.success) { error("Invalid protocol message"); return; }
      const msg = parsed.data;
      try {
        if (msg.type === WS_EVENTS.CREATE_ROOM) {
          if (role) { error("Already in a room"); return; }
          if (rooms.size >= 500) { error("Room capacity reached"); return; }
          const limit = createLimits.get(ip) ?? { count: 0, resetAt: now + 60_000 };
          if (now > limit.resetAt) { limit.count = 0; limit.resetAt = now + 60_000; }
          if (++limit.count > 5) { error("Room creation rate limit"); return; }
          createLimits.set(ip, limit);
          const host = await options.resolveUser(req.headers.cookie);
          if (!host) { error("Sign in to host a game"); return; }
          const deck = await storage.getDeck(msg.payload.deckId, host.id);
          const questions = deck?.cards.filter(eligible) ?? [];
          if (!questions.length) { error("Deck requires a four-choice multiple-choice question"); return; }
          // Check again after asynchronous database access, before taking socket ownership.
          if (role || !isOpen(ws)) return;
          const code = makeRoomCode(rooms);
          const hostToken = mintToken();
          room = {
            code, ownerId: host.id, hostWs: ws, hostTokenHash: tokenHash(hostToken), hostConnected: true,
            mode:msg.payload.mode, players: new Map(), questions, state: "lobby", questionIndex: -1,
            deadlineTs: 0, answers: new Map(), touchedAt: now,
          };
          rooms.set(code, room); role = "host";
          send(ws, WS_EVENTS.ROOM_CREATED, { roomCode: code, hostToken, mode:room.mode });
          return;
        }
        if (msg.type === WS_EVENTS.JOIN_ROOM) {
          if (!allowJoin(ip)) { error("Join rate limit"); return; }
          if (role) { error("Already in a room"); return; }
          const target = rooms.get(msg.payload.roomCode);
          if (!target || target.state === "finished") { error("Room unavailable"); return; }
          if (target.state !== "lobby") { error("Game started; reconnect with your credential"); return; }
          if (target.players.size >= MAX_PLAYERS) { error("Room full"); return; }
          const token = mintToken();
          const id = randomUUID();
          const player: Player = {
            id, name: msg.payload.playerName, score: 0, streak: 0, coins:0,
            ...(target.mode === "teams" ? {team:([...target.players.values()].filter(p=>p.team==="Orchid").length <= [...target.players.values()].filter(p=>p.team==="Lagoon").length ? "Orchid" : "Lagoon") as "Orchid"|"Lagoon"} : {}),
            tokenHash: tokenHash(token), ws, connected: true,
          };
          target.players.set(id, player);
          room = target; role = "player"; playerId = id; target.touchedAt = now;
          send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: target.code, playerId: id, token });
          snapshot(target, ws, player); lobbyUpdate(target);
          return;
        }
        if (msg.type === WS_EVENTS.REJOIN_ROOM) {
          if (!allowJoin(ip)) { error("Reconnect rate limit"); return; }
          if (role) { error("Already in a room"); return; }
          const target = rooms.get(msg.payload.roomCode);
          const player = target?.players.get(msg.payload.playerId);
          if (!target || !player || !tokenMatches(msg.payload.token, player.tokenHash)) {
            error("Invalid reconnect credentials"); return;
          }
          const newToken = mintToken();
          const prior = player.ws;
          player.ws = ws; player.connected = true; player.tokenHash = tokenHash(newToken);
          room = target; role = "player"; playerId = player.id; target.touchedAt = now;
          send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: target.code, playerId: player.id, token: newToken });
          snapshot(target, ws, player); lobbyUpdate(target);
          if (prior !== ws) prior.close(1000, "Session replaced");
          return;
        }
        if (msg.type === WS_EVENTS.RESUME_HOST) {
          if (role) { error("Already in a room"); return; }
          const target = rooms.get(msg.payload.roomCode);
          const host = await options.resolveUser(req.headers.cookie);
          if (role || !isOpen(ws)) return;
          if (!target || !host || host.id !== target.ownerId || !tokenMatches(msg.payload.hostToken, target.hostTokenHash)) {
            error("Invalid host credentials"); return;
          }
          const newToken = mintToken();
          const prior = target.hostWs;
          target.hostWs = ws; target.hostConnected = true; target.hostTokenHash = tokenHash(newToken);
          target.touchedAt = now; room = target; role = "host";
          send(ws, WS_EVENTS.HOST_RESUMED, { roomCode: target.code, hostToken: newToken });
          snapshot(target, ws);
          if (prior !== ws) prior.close(1000, "Host session replaced");
          return;
        }
        if (!room || !role || !isOpen(ws)) { error("Join a room first"); return; }
        room.touchedAt = now;
        if (msg.payload.roomCode && msg.payload.roomCode !== room.code) {
          error("Room mismatch"); return;
        }
        if (role === "host" && [WS_EVENTS.START_GAME, WS_EVENTS.NEXT_QUESTION].includes(msg.type as never)) {
          const host = await options.resolveUser(req.headers.cookie);
          if (!host || host.id !== room.ownerId) { error("Sign in to host a game"); return; }
          if (room.hostWs !== ws || !isOpen(ws)) return;
        }
        if (msg.type === WS_EVENTS.START_GAME) {
          if (role !== "host" || room.hostWs !== ws || room.state !== "lobby") {
            error("Host must start from lobby"); return;
          }
          if (!room.players.size) { error("At least one player is required"); return; }
          room.questionIndex = 0;
          broadcast(room, WS_EVENTS.GAME_STARTED, {mode:room.mode});
          startQuestion(room, durationMs);
        } else if (msg.type === WS_EVENTS.NEXT_QUESTION) {
          if (role !== "host" || room.hostWs !== ws || !["reveal", "leaderboard"].includes(room.state)) {
            error("Host can advance only after reveal"); return;
          }
          next(room, durationMs);
        } else if (msg.type === WS_EVENTS.BUY_UPGRADE) {
          const player = playerId ? room.players.get(playerId) : undefined;
          if(role !== "player" || player?.ws !== ws || room.mode !== "shop" || room.state !== "leaderboard" || player.coins < 3 || player.upgrade) {error("Upgrades cost 3 coins and are available between rounds");return;}
          player.coins-=3;player.upgrade=msg.payload.upgrade;lobbyUpdate(room);
        } else if (msg.type === WS_EVENTS.BUZZ) {
          if(role !== "player" || !playerId || room.players.get(playerId)?.ws !== ws || room.mode !== "buzzer" || room.state !== "playing" || now>=room.deadlineTs || room.answers.has(playerId) || room.buzzerPlayerId) {error("Buzzer unavailable");return;}
          room.buzzerPlayerId=playerId;broadcast(room,WS_EVENTS.BUZZER_UPDATE,{playerId});
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
          const correct = msg.payload.answer === room.questions[room.questionIndex].correctOption;
          if(room.mode === "buzzer" && room.buzzerPlayerId !== playerId) {error("Buzz before answering");return;}
          let computed;
          try {computed=scoreAnswer({mode:room.mode,correct,score:player.score,streak:player.streak,wager:msg.payload.wager??0,upgrade:player.upgrade,questionIndex:room.questionIndex});}
          catch {error("Invalid wager");return;}
          const {awarded}=computed;
          player.upgrade=undefined;
          room.answers.set(playerId, { answer: msg.payload.answer, correct, awarded, scoreAfter:computed.score, streakAfter:computed.streak, coinsAwarded:computed.coins });
          send(ws,WS_EVENTS.ANSWER_ACCEPTED,{questionIndex:room.questionIndex});
          if(room.mode === "buzzer") {room.buzzerPlayerId=undefined;broadcast(room,WS_EVENTS.BUZZER_UPDATE,{playerId:null});}
          if ((room.mode === "buzzer" && correct) || allActiveAnswered(room)) reveal(room);
        }
      } catch (err) {
        console.error("Game socket handler failed", err);
        error("Game request failed");
      }
    });
    ws.on("close", () => {
      if (!room) return;
      if (role === "host" && room.hostWs === ws) room.hostConnected = false;
      if (role === "player" && playerId) {
        const player = room.players.get(playerId);
        if (player?.ws === ws) { player.connected = false;
          if(room.buzzerPlayerId === playerId) {room.buzzerPlayerId=undefined;broadcast(room,WS_EVENTS.BUZZER_UPDATE,{playerId:null});}
          lobbyUpdate(room); }
      }
    });
  });
  return wss;
}
