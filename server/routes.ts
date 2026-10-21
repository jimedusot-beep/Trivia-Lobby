import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";
import { allowRate, generateRoomCode, newPlayerCredentials, hashToken, isValidToken, incomingMessageSchema, MAX_PLAYERS, MAX_ROOMS, QUESTION_TIME_MS, safeLeaderboard, scoreAnswer } from "./game-protocol";

type Player = {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastPoints: number;
  tokenHash: Buffer;
  ws: WebSocket;
  connected: boolean;
};

type Question = {
  id: number; front: string; back: string;
  options: string[]; correctOption: string;
};

type Room = {
  code: string;
  hostWs: WebSocket;
  players: Map<string, Player>;
  state: "lobby" | "question" | "reveal" | "finished";
  currentQuestionIndex: number;
  questions: Question[];
  questionStartTime: number;
  timer?: ReturnType<typeof setTimeout>;
  answersReceived: Set<string>;
};

const rooms = new Map<string, Room>();
const letters = ["A", "B", "C", "D"];

function send(ws: WebSocket, type: string, payload: Record<string, unknown> = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload }));
}
function fail(ws: WebSocket, message: string) {
  send(ws, WS_EVENTS.ERROR, { message });
}
function allClients(room: Room, type: string, payload: Record<string, unknown>) {
  send(room.hostWs, type, payload);
  for (const player of room.players.values()) if (player.connected) send(player.ws, type, payload);
}
function broadcastLobby(room: Room) {
  const players = safeLeaderboard(room.players.values());
  allClients(room, WS_EVENTS.LOBBY_UPDATE, { players });
}
function getLeaderboard(room: Room) {
  return safeLeaderboard(room.players.values());
}
function currentQuestion(room: Room): Question | undefined {
  return room.questions[room.currentQuestionIndex];
}
function publicQuestion(room: Room) {
  const question = currentQuestion(room);
  if (!question) return;
  return {
    questionId: room.currentQuestionIndex,
    prompt: question.front,
    choices: question.options,
    timeLimitMs: QUESTION_TIME_MS,
    serverStartTs: room.questionStartTime
  };
}
function revealRound(room: Room) {
  if (room.state !== "question") return;
  clearTimeout(room.timer);
  room.timer = undefined;
  room.state = "reveal";
  const question = currentQuestion(room);
  if (!question) return;
  const shared = {
    questionId: room.currentQuestionIndex,
    correctLetter: question.correctOption,
    explanation: question.back,
    leaderboard: getLeaderboard(room)
  };
  send(room.hostWs, WS_EVENTS.ANSWER_RESULT, shared);
  for (const player of room.players.values()) {
    if (!player.connected) continue;
    send(player.ws, WS_EVENTS.ANSWER_RESULT, {
      ...shared,
      correct: room.answersReceived.has(player.id) ? player.lastPoints > 0 : false,
      points: player.lastPoints
    });
  }
}
function beginQuestion(room: Room) {
  clearTimeout(room.timer);
  room.answersReceived.clear();
  room.state = "question";
  room.questionStartTime = Date.now();
  for (const player of room.players.values()) player.lastPoints = 0;
  const payload = publicQuestion(room);
  if (!payload) return;
  allClients(room, WS_EVENTS.QUESTION_START, payload);
  room.timer = setTimeout(() => revealRound(room), QUESTION_TIME_MS);
}
function finishGame(room: Room) {
  clearTimeout(room.timer);
  room.timer = undefined;
  room.state = "finished";
  allClients(room, WS_EVENTS.GAME_OVER, { leaderboard: getLeaderboard(room) });
}
function syncPlayer(room: Room, player: Player) {
  send(player.ws, WS_EVENTS.SYNC_SNAPSHOT, {
    roomCode: room.code, playerId: player.id, score: player.score,
    players: getLeaderboard(room),
    gameStatus: room.state === "lobby" ? "lobby" : room.state === "finished" ? "ended" : "playing",
    leaderboard: room.state === "finished" || room.state === "reveal" ? getLeaderboard(room) : []
  });
  if (room.state === "question" || room.state === "reveal") {
    const payload = publicQuestion(room);
    if (payload) send(player.ws, WS_EVENTS.QUESTION_START, payload);
    if (room.state === "reveal") {
      const question = currentQuestion(room);
      if (question) send(player.ws, WS_EVENTS.ANSWER_RESULT, {
        questionId: room.currentQuestionIndex, correctLetter: question.correctOption,
        explanation: question.back, leaderboard: getLeaderboard(room),
        correct: room.answersReceived.has(player.id) ? player.lastPoints > 0 : false,
        points: player.lastPoints
      });
    }
  }
}

function httpRate(req: { ip?: string; socket: { remoteAddress?: string } }, category: string, max: number) {
  return allowRate(`http:${req.ip || req.socket.remoteAddress || "unknown"}:${category}`, max, 60_000);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get(api.decks.list.path, async (_req, res) => {
    res.json(await storage.getDecks());
  });
  app.get(api.decks.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid deck ID" });
    const deck = await storage.getDeck(id);
    if (!deck) return res.status(404).json({ message: "Deck not found" });
    res.json(deck);
  });
  app.post(api.decks.create.path, async (req, res) => {
    if (!httpRate(req, "create", 20)) return res.status(429).json({ message: "Too many deck requests" });
    try {
      const input = api.decks.create.input.parse(req.body);
      res.status(201).json(await storage.createDeck(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      console.error("Create deck failed:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  app.post(api.decks.import.path, async (req, res) => {
    if (!httpRate(req, "import", 5)) return res.status(429).json({ message: "Too many imports" });
    try {
      const input = api.decks.import.input.parse(req.body);
      res.status(201).json(await storage.importDeck(input.deck, input.cards));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      console.error("Deck import failed:", err);
      res.status(500).json({ message: "Import failed; no partial deck was saved." });
    }
  });
  app.post(api.cards.create.path, async (req, res) => {
    if (!httpRate(req, "cards", 20)) return res.status(429).json({ message: "Too many card requests" });
    const deckId = Number(req.params.id);
    if (!Number.isSafeInteger(deckId) || deckId <= 0) return res.status(400).json({ message: "Invalid deck ID" });
    try {
      const input = api.cards.create.input.parse(req.body);
      if (!await storage.getDeck(deckId)) return res.status(404).json({ message: "Deck not found" });
      res.status(201).json(await storage.createCards(deckId, input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      console.error("Create cards failed:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  app.delete(api.decks.delete.path, async (req, res) => {
    if (!httpRate(req, "delete", 20)) return res.status(429).json({ message: "Too many delete requests" });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid deck ID" });
    const deleted = await storage.deleteDeck(id);
    if (!deleted) return res.status(404).json({ message: "Deck not found" });
    res.status(204).send();
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 4096 });
  wss.on("connection", (ws, request) => {
    let userRoomCode: string | null = null;
    let userId: string | null = null;
    const ip = request.socket.remoteAddress || "unknown";

    ws.on("message", async (data) => {
      try {
        if (!allowRate(`ws:${ip}:all`, 120, 60_000)) return fail(ws, "Too many messages");
        const parsed = incomingMessageSchema.safeParse(JSON.parse(data.toString()));
        if (!parsed.success) return fail(ws, "Invalid message payload");
        const message = parsed.data;
        const limits: Record<string, number> = {
          create_room: 6, join_room: 20, rejoin_room: 20, submit_answer: 90
        };
        if (limits[message.type] && !allowRate(`ws:${ip}:${message.type}`, limits[message.type], 60_000)) {
          return fail(ws, "Rate limit exceeded");
        }

        switch (message.type) {
          case WS_EVENTS.CREATE_ROOM: {
            if (userRoomCode) return fail(ws, "Already in a room");
            if (rooms.size >= MAX_ROOMS) return fail(ws, "Game capacity reached");
            const deck = await storage.getDeck(message.payload.deckId);
            if (!deck) return fail(ws, "Deck not found");
            const playable = deck.cards.filter(card =>
              card.type === "multiple_choice" &&
              Array.isArray(card.options) &&
              card.options.length >= 2 &&
              card.options.length <= 4 &&
              card.options.every(option => typeof option === "string" && option.length > 0) &&
              letters.slice(0, card.options.length).includes(card.correctOption || "")
            ).map(card => ({
              id: card.id, front: card.front, back: card.back,
              options: card.options as string[], correctOption: card.correctOption as string
            }));
            if (!playable.length) return fail(ws, "Deck has no valid multiple-choice questions");
            const roomCode = generateRoomCode(new Set(rooms.keys()));
            const room: Room = {
              code: roomCode, hostWs: ws, players: new Map(), state: "lobby",
              currentQuestionIndex: -1, questions: playable,
              questionStartTime: 0, answersReceived: new Set()
            };
            rooms.set(roomCode, room);
            userRoomCode = roomCode;
            send(ws, WS_EVENTS.ROOM_CREATED, { roomCode });
            break;
          }
          case WS_EVENTS.JOIN_ROOM: {
            if (userRoomCode) return fail(ws, "Already in a room");
            const { roomCode, playerName } = message.payload;
            const room = rooms.get(roomCode);
            if (!room) return fail(ws, "Room not found");
            if (room.state !== "lobby") return fail(ws, "Game already started");
            if (room.players.size >= MAX_PLAYERS) return fail(ws, "Room is full");
            const { playerId, reconnectToken } = newPlayerCredentials();
            const player: Player = {
              id: playerId, name: playerName, score: 0, streak: 0, lastPoints: 0,
              tokenHash: hashToken(reconnectToken), ws, connected: true
            };
            room.players.set(playerId, player);
            userId = playerId;
            userRoomCode = roomCode;
            send(ws, WS_EVENTS.ROOM_JOINED, { roomCode, playerId, reconnectToken });
            syncPlayer(room, player);
            broadcastLobby(room);
            break;
          }
          case WS_EVENTS.REJOIN_ROOM: {
            if (userRoomCode) return fail(ws, "Already in a room");
            const { roomCode, playerId, reconnectToken } = message.payload;
            const room = rooms.get(roomCode);
            const player = room?.players.get(playerId);
            if (!room || !player || !isValidToken(reconnectToken, player.tokenHash)) {
              return fail(ws, "Session invalid or expired. Join a new game.");
            }
            const previousWs = player.ws;
            const refreshed = newPlayerCredentials().reconnectToken;
            player.tokenHash = hashToken(refreshed);
            player.ws = ws;
            player.connected = true;
            userId = playerId;
            userRoomCode = roomCode;
            if (previousWs !== ws) previousWs.close(4001, "Reconnected elsewhere");
            send(ws, WS_EVENTS.ROOM_JOINED, { roomCode, playerId, reconnectToken: refreshed });
            syncPlayer(room, player);
            broadcastLobby(room);
            break;
          }
          case WS_EVENTS.START_GAME: {
            const room = rooms.get(message.payload.roomCode);
            if (!room || room.hostWs !== ws || room.code !== userRoomCode) return fail(ws, "Host permission required");
            if (room.state !== "lobby") return fail(ws, "Game is already running");
            if (!room.players.size) return fail(ws, "No players have joined");
            room.currentQuestionIndex = 0;
            allClients(room, WS_EVENTS.GAME_STARTED, {});
            beginQuestion(room);
            break;
          }
          case WS_EVENTS.SUBMIT_ANSWER: {
            const { roomCode, questionId, answer } = message.payload;
            const room = rooms.get(roomCode);
            if (!room || room.code !== userRoomCode || room.state !== "question" ||
                questionId !== room.currentQuestionIndex || !userId) {
              return fail(ws, "Question is no longer accepting answers");
            }
            const player = room.players.get(userId);
            if (!player || player.ws !== ws) return fail(ws, "Player session invalid");
            if (Date.now() >= room.questionStartTime + QUESTION_TIME_MS) {
              revealRound(room);
              return fail(ws, "Answer deadline passed");
            }
            if (room.answersReceived.has(userId)) return fail(ws, "Answer already submitted");
            const question = currentQuestion(room);
            if (!question || letters.indexOf(answer) >= question.options.length) return fail(ws, "Invalid answer");
            const scored = scoreAnswer(answer, question.correctOption, player.streak);
            player.score += scored.points;
            player.streak = scored.streak;
            player.lastPoints = scored.points;
            room.answersReceived.add(userId);
            send(ws, WS_EVENTS.ANSWER_ACCEPTED, { questionId });
            const activePlayers = Array.from(room.players.values()).filter(p => p.connected);
            if (activePlayers.length && activePlayers.every(p => room.answersReceived.has(p.id))) revealRound(room);
            break;
          }
          case WS_EVENTS.NEXT_QUESTION: {
            const room = rooms.get(message.payload.roomCode);
            if (!room || room.hostWs !== ws || room.code !== userRoomCode) return fail(ws, "Host permission required");
            if (room.state !== "reveal") return fail(ws, "Wait for the round result");
            if (room.currentQuestionIndex >= room.questions.length - 1) finishGame(room);
            else {
              room.currentQuestionIndex += 1;
              beginQuestion(room);
            }
            break;
          }
        }
      } catch (error) {
        console.error("Game message failed:", error);
        fail(ws, "Unable to process game message");
      }
    });

    ws.on("close", () => {
      if (!userRoomCode) return;
      const room = rooms.get(userRoomCode);
      if (!room) return;
      if (room.hostWs === ws) {
        clearTimeout(room.timer);
        rooms.delete(room.code);
        for (const player of room.players.values()) fail(player.ws, "Host disconnected; this room is closed");
      } else if (userId) {
        const player = room.players.get(userId);
        if (player && player.ws === ws) {
          player.connected = false;
          broadcastLobby(room);
        }
      }
    });
    ws.on("error", error => console.error("Game socket error:", error.message));
  });

  await seedDatabase();
  return httpServer;
}

export async function seedDatabase() {
  const existing = await storage.getDecks();
  if (existing.length > 0) return;
  const deck = await storage.createDeck({
    title: "General Knowledge",
    description: "A sample trivia deck",
    category: "Trivia"
  });
  await storage.createCards(deck.id, [
    { front: "What is the capital of France?", back: "Paris", type: "multiple_choice",
      options: ["London", "Berlin", "Madrid", "Paris"], correctOption: "D" },
    { front: "Which planet is known as the Red Planet?", back: "Mars", type: "multiple_choice",
      options: ["Venus", "Mars", "Jupiter", "Saturn"], correctOption: "B" }
  ]);
}
