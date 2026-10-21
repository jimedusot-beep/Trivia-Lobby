import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Server, IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { WS_EVENTS } from "@shared/schema";
import type { DeckWithCards } from "@shared/schema";
import { isLibraryAuthorized } from "./library-auth";
import { applyAnswer, MAX_GAME_PLAYERS, playableQuestions, publicLeaderboard, QUESTION_TIME_MS, type GameQuestion, type ScorePlayer } from "./game-engine";

type Player = ScorePlayer & {
  ws: WebSocket | null;
  resumeToken: string;
  connected: boolean;
  answeredRound: number;
};
type GameRoom = {
  code: string;
  host: WebSocket | null;
  deckId: number;
  questions: GameQuestion[];
  players: Map<string, Player>;
  gameStatus: "lobby" | "playing" | "ended";
  phase: "lobby" | "question" | "results" | "finished";
  round: number;
  startedAt: number;
  touchedAt: number;
  timer?: ReturnType<typeof setTimeout>;
  result?: { correctLetter: string; leaderboard: ReturnType<typeof publicLeaderboard> };
};
const rooms = new Map<string, GameRoom>();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const send = (ws: WebSocket | null, type: string, payload: unknown = {}) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload }));
};
const error = (ws: WebSocket, message: string) => send(ws, WS_EVENTS.ERROR, { message });
const safeSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
function createCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a unique game code");
}
function sendRoom(room: GameRoom, type: string, payload: unknown) {
  send(room.host, type, payload);
  for (const player of room.players.values()) if (player.connected) send(player.ws, type, payload);
}
function lobbyUpdate(room: GameRoom) {
  const players = Array.from(room.players.values(), p => ({ playerId: p.id, name: p.name, score: p.score, connected: p.connected }));
  sendRoom(room, WS_EVENTS.LOBBY_UPDATE, { players });
}
function clearRoom(room: GameRoom) {
  if (room.timer) clearTimeout(room.timer);
  rooms.delete(room.code);
}
function snapshot(room: GameRoom, ws: WebSocket, player?: Player) {
  const question = room.questions[room.round];
  send(ws, WS_EVENTS.SYNC_SNAPSHOT, {
    roomCode: room.code,
    playerId: player?.id,
    gameStatus: room.gameStatus,
    players: Array.from(room.players.values(), p => ({ playerId: p.id, name: p.name, score: p.score, connected: p.connected })),
    currentQuestion: room.gameStatus === "playing" && question ? {
      prompt: question.prompt,
      choices: question.choices,
      roundId: room.round,
      timeLimitMs: QUESTION_TIME_MS,
      serverStartTs: room.startedAt,
    } : undefined,
    lastAnswerResult: room.phase === "results" ? room.result : undefined,
    leaderboard: room.phase === "results" || room.phase === "finished" ? publicLeaderboard(room.players.values()) : undefined,
  });
}
function reveal(room: GameRoom) {
  if (room.phase !== "question") return;
  if (room.timer) clearTimeout(room.timer);
  room.phase = "results";
  const q = room.questions[room.round];
  room.result = { correctLetter: q.correctLetter, leaderboard: publicLeaderboard(room.players.values()) };
  sendRoom(room, WS_EVENTS.ANSWER_RESULT, room.result);
}
function nextQuestion(room: GameRoom) {
  if (room.phase !== "lobby" && room.phase !== "results") return;
  room.round += 1;
  if (room.round >= room.questions.length) {
    room.phase = "finished";
    room.gameStatus = "ended";
    sendRoom(room, WS_EVENTS.GAME_OVER, { leaderboard: publicLeaderboard(room.players.values()) });
    return;
  }
  room.phase = "question";
  room.gameStatus = "playing";
  room.result = undefined;
  room.startedAt = Date.now();
  for (const player of room.players.values()) player.lastPoints = 0;
  const q = room.questions[room.round];
  sendRoom(room, WS_EVENTS.QUESTION_START, {
    prompt: q.prompt,
    choices: q.choices,
    roundId: room.round,
    timeLimitMs: QUESTION_TIME_MS,
    serverStartTs: room.startedAt,
  });
  room.timer = setTimeout(() => reveal(room), QUESTION_TIME_MS);
  room.timer.unref?.();
}
const roomSchema = z.object({ roomCode: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/) });
const joinSchema = roomSchema.extend({ name: z.string().trim().min(1).max(20) });
const rejoinSchema = roomSchema.extend({
  role: z.enum(["player", "host"]),
  playerId: z.string().optional(),
  resumeToken: z.string().optional(),
});
const answerSchema = z.object({ answer: z.enum(["A", "B", "C", "D"]) });
function sameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const host = req.headers.host;
    return Boolean(host) && new URL(origin).host === host;
  } catch { return false; }
}

export function registerGameSockets(httpServer: Server, loadDeck: (deckId: number) => Promise<DeckWithCards | undefined>) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 8192, perMessageDeflate: false });
  wss.on("connection", (ws, req) => {
    if (!sameOrigin(req)) {
      ws.close(1008, "Origin not allowed");
      return;
    }
    let role: "host" | "player" | null = null;
    let roomCode: string | null = null;
    let playerId: string | null = null;
    let messages = 0;
    let windowStart = Date.now();

    ws.on("message", async raw => {
      const now = Date.now();
      if (now - windowStart > 10_000) { windowStart = now; messages = 0; }
      if (++messages > 45) { ws.close(1008, "Rate limit exceeded"); return; }
      let incoming: { type: string; payload: unknown };
      try {
        const obj = JSON.parse(raw.toString());
        if (!obj || typeof obj.type !== "string" || typeof obj.payload !== "object" || !obj.payload) throw new Error("Invalid event");
        incoming = obj;
      } catch { error(ws, "Invalid game message"); return; }
      try {
        switch (incoming.type) {
          case WS_EVENTS.CREATE_ROOM: {
            if (!isLibraryAuthorized(req.headers.cookie)) { error(ws, "Sign in to host a game"); return; }
            if (role) { error(ws, "You are already in a room"); return; }
            const { deckId } = z.object({ deckId: z.number().int().positive() }).parse(incoming.payload);
            const deck = await storage.getDeck(deckId);
            if (!deck) { error(ws, "Deck not found"); return; }
            const questions = playableQuestions(deck.cards);
            if (!questions.length) { error(ws, "Choose a deck with valid multiple-choice questions"); return; }
            const code = createCode();
            const room: GameRoom = {
              code, deckId, questions, host: ws, players: new Map(),
              gameStatus: "lobby", phase: "lobby", round: -1, startedAt: 0, touchedAt: Date.now(),
            };
            rooms.set(code, room);
            role = "host";
            roomCode = code;
            send(ws, WS_EVENTS.ROOM_CREATED, { roomCode: code });
            lobbyUpdate(room);
            break;
          }
          case WS_EVENTS.JOIN_ROOM: {
            if (role) { error(ws, "You are already in a room"); return; }
            const { roomCode: code, name } = joinSchema.parse(incoming.payload);
            const room = rooms.get(code);
            if (!room) { error(ws, "Room not found"); return; }
            if (room.phase !== "lobby") { error(ws, "Game already started"); return; }
            if (room.players.size >= MAX_GAME_PLAYERS) { error(ws, "Game is full"); return; }
            const id = randomUUID();
            const resumeToken = randomBytes(32).toString("base64url");
            const player: Player = { id, name, ws, resumeToken, connected: true, score: 0, streak: 0, lastPoints: 0, answeredRound: -1 };
            room.players.set(id, player);
            role = "player"; roomCode = code; playerId = id; room.touchedAt = Date.now();
            send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: code, playerId: id, resumeToken, name });
            snapshot(room, ws, player);
            lobbyUpdate(room);
            break;
          }
          case WS_EVENTS.REJOIN_ROOM: {
            if (role) return;
            const { roomCode: code, role: requestedRole, playerId: id, resumeToken } = rejoinSchema.parse(incoming.payload);
            const room = rooms.get(code);
            if (!room || room.phase === "finished") { error(ws, "Room has expired"); return; }
            if (requestedRole === "host") {
              if (!isLibraryAuthorized(req.headers.cookie)) { error(ws, "Host sign-in required"); return; }
              if (room.host?.readyState === WebSocket.OPEN) { error(ws, "Host is already connected"); return; }
              room.host = ws;
              role = "host"; roomCode = code;
              snapshot(room, ws);
            } else {
              const player = id && room.players.get(id);
              if (!player || !resumeToken || !safeSecret(resumeToken, player.resumeToken)) {
                error(ws, "Invalid player session"); return;
              }
              if (player.ws && player.ws !== ws && player.ws.readyState === WebSocket.OPEN) player.ws.close(1000, "Replaced by reconnection");
              player.ws = ws; player.connected = true;
              role = "player"; roomCode = code; playerId = id ?? null;
              send(ws, WS_EVENTS.ROOM_JOINED, { roomCode: code, playerId: player.id, resumeToken, name: player.name });
              snapshot(room, ws, player);
              lobbyUpdate(room);
            }
            room.touchedAt = Date.now();
            break;
          }
          case WS_EVENTS.START_GAME: {
            const room = roomCode ? rooms.get(roomCode) : undefined;
            if (!room || role !== "host" || room.host !== ws || room.phase !== "lobby") return;
            if (!room.players.size) { error(ws, "Wait for at least one player"); return; }
            sendRoom(room, WS_EVENTS.GAME_STARTED, {});
            nextQuestion(room);
            room.touchedAt = Date.now();
            break;
          }
          case WS_EVENTS.SUBMIT_ANSWER: {
            const room = roomCode ? rooms.get(roomCode) : undefined;
            if (!room || role !== "player" || room.phase !== "question" || !playerId) return;
            const player = room.players.get(playerId);
            if (!player || player.ws !== ws || player.answeredRound === room.round || Date.now() > room.startedAt + QUESTION_TIME_MS) return;
            const { answer } = answerSchema.parse(incoming.payload);
            player.answeredRound = room.round;
            applyAnswer(player, room.questions[room.round].correctLetter, answer);
            room.touchedAt = Date.now();
            if (Array.from(room.players.values()).filter(p => p.connected).every(p => p.answeredRound === room.round)) reveal(room);
            break;
          }
          case WS_EVENTS.NEXT_QUESTION: {
            const room = roomCode ? rooms.get(roomCode) : undefined;
            if (!room || role !== "host" || room.host !== ws) return;
            if (room.phase === "question") reveal(room);
            else if (room.phase === "results") nextQuestion(room);
            room.touchedAt = Date.now();
            break;
          }
          default: error(ws, "Unknown game action");
        }
      } catch (err) {
        if (err instanceof z.ZodError) error(ws, "Invalid game action parameters");
        else { console.error("Game event failed:", err instanceof Error ? err.message : err); error(ws, "Unable to process game action"); }
      }
    });
    ws.on("close", () => {
      const room = roomCode ? rooms.get(roomCode) : undefined;
      if (!room) return;
      if (role === "host" && room.host === ws) room.host = null;
      if (role === "player" && playerId) {
        const player = room.players.get(playerId);
        if (player?.ws === ws) { player.connected = false; player.ws = null; }
      }
      lobbyUpdate(room);
    });
  });
  // Expire abandoned rooms and completed games; game state remains in memory until expiration.
  const sweep = setInterval(() => {
    for (const room of rooms.values()) {
      const hostAbsent = room.host?.readyState !== WebSocket.OPEN;
      const stale = Date.now() - room.touchedAt > 4 * 60 * 60 * 1000;
      const abandoned = hostAbsent && Date.now() - room.touchedAt > 3 * 60 * 1000;
      if (stale || abandoned || (room.phase === "finished" && Date.now() - room.touchedAt > 10 * 60 * 1000)) clearRoom(room);
    }
  }, 60_000);
  sweep.unref?.();
  return wss;
}
