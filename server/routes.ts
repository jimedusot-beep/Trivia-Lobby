import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";
import { requireUser, requireSameOrigin, registerAuthRoutes, resolveUser } from "./auth";
import { registerLibraryRoutes } from "./library";

// === GAME STATE TYPES ===
type Player = {
  id: string;
  name: string;
  score: number;
  streak: number;
  ws: WebSocket;
  lastSeen: number;
  connected: boolean;
};

type Room = {
  code: string;
  hostWs: WebSocket;
  deckId: number;
  players: Map<string, Player>;
  state: 'lobby' | 'playing' | 'leaderboard' | 'finished';
  currentQuestionIndex: number;
  questions: any[]; // Cached questions from DB
  questionStartTime?: number;
  answersReceived: Set<string>; // playerId-questionIndex
};

// Global in-memory state for active rooms
const rooms = new Map<string, Room>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Require authenticated ownership for every deck/card request.
  app.use("/api", requireSameOrigin);
  registerAuthRoutes(app);
  app.get(api.decks.list.path, requireUser, async (req, res, next) => {
    try { res.json(await storage.getDecks(req.studyUser!.id)); } catch (e) { next(e); }
  });
  app.get(api.decks.get.path, requireUser, async (req, res, next) => {
    try {
      const deck = await storage.getDeck(Number(req.params.id), req.studyUser!.id);
      if (!deck) { res.status(404).json({ message: "Deck not found" }); return; }
      res.json(deck);
    } catch (e) { next(e); }
  });
  app.post(api.decks.create.path, requireUser, async (req, res, next) => {
    try { res.status(201).json(await storage.createDeck(api.decks.create.input.parse(req.body), req.studyUser!.id)); }
    catch (e) { if (e instanceof z.ZodError) res.status(400).json({ message: e.message }); else next(e); }
  });
  app.post(api.decks.import.path, requireUser, async (req, res, next) => {
    try {
      const input = api.decks.import.input.parse(req.body);
      res.status(201).json(await storage.importDeck(input.deck, input.cards, req.studyUser!.id));
    } catch (e) { if (e instanceof z.ZodError) res.status(400).json({ message: e.message }); else next(e); }
  });
  app.post(api.cards.create.path, requireUser, async (req, res, next) => {
    try {
      const input = api.cards.create.input.parse(req.body);
      res.status(201).json(await storage.createCards(Number(req.params.id), input, req.studyUser!.id));
    } catch (e) {
      if (e instanceof z.ZodError) res.status(400).json({ message: e.message });
      else if (e instanceof Error && e.message === "Deck not found") res.status(404).json({ message: e.message });
      else next(e);
    }
  });
  app.delete(api.decks.delete.path, requireUser, async (req, res, next) => {
    try {
      if (!await storage.deleteDeck(Number(req.params.id), req.studyUser!.id)) { res.status(404).json({ message: "Deck not found" }); return; }
      res.status(204).send();
    } catch (e) { next(e); }
  });
  registerLibraryRoutes(app);

  // === WEBSOCKET SERVER ===
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, request) => {
    let userRoomCode: string | null = null;
    let userId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case WS_EVENTS.CREATE_ROOM: {
            const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            const hostUser = await resolveUser(request.headers.cookie);
            const deck = await storage.getDeck(message.payload.deckId, hostUser?.id || '');
            
            if (!deck) {
              ws.send(JSON.stringify({ type: WS_EVENTS.ERROR, payload: { message: "Deck not found" } }));
              return;
            }

            rooms.set(roomCode, {
              code: roomCode,
              hostWs: ws,
              deckId: message.payload.deckId,
              players: new Map(),
              state: 'lobby',
              currentQuestionIndex: -1,
              questions: deck.cards, // In a real app, shuffle/format these
              answersReceived: new Set()
            });
            
            userRoomCode = roomCode; // Host is associated with room
            ws.send(JSON.stringify({ type: WS_EVENTS.ROOM_CREATED, payload: { roomCode } }));
            break;
          }

          case WS_EVENTS.JOIN_ROOM: {
            const { roomCode, playerName, playerId: existingId } = message.payload;
            const room = rooms.get(roomCode);
            
            if (!room) {
              ws.send(JSON.stringify({ type: WS_EVENTS.ERROR, payload: { message: "Room not found" } }));
              return;
            }

            // Reuse ID if reconnecting, else gen new
            const pid = existingId || Math.random().toString(36).substring(7);
            userId = pid;
            userRoomCode = roomCode;

            const existingPlayer = room.players.get(pid);
            if (existingPlayer) {
              existingPlayer.connected = true;
              existingPlayer.ws = ws;
            } else {
              room.players.set(pid, {
                id: pid,
                name: playerName,
                score: 0,
                streak: 0,
                ws,
                lastSeen: Date.now(),
                connected: true
              });
            }

            // Send sync snapshot to joining player
            ws.send(JSON.stringify({
              type: WS_EVENTS.SYNC_SNAPSHOT,
              payload: {
                state: room.state,
                playerId: pid,
                score: room.players.get(pid)?.score || 0
              }
            }));

            // Broadcast lobby update to host
            broadcastLobbyUpdate(room);
            break;
          }

          case WS_EVENTS.START_GAME: {
            if (!userRoomCode) return;
            const room = rooms.get(userRoomCode);
            // Only host can start (hostWs check could be stricter but simplified here)
            if (room && room.hostWs === ws) {
              room.state = 'playing';
              room.currentQuestionIndex = 0;
              broadcastGameStart(room);
              sendQuestion(room);
            }
            break;
          }

          case WS_EVENTS.SUBMIT_ANSWER: {
            if (!userRoomCode || !userId) return;
            const room = rooms.get(userRoomCode);
            if (!room || room.state !== 'playing') return;

            const answerKey = `${userId}-${room.currentQuestionIndex}`;
            if (room.answersReceived.has(answerKey)) return; // Idempotent

            room.answersReceived.add(answerKey);
            const player = room.players.get(userId);
            const question = room.questions[room.currentQuestionIndex];
            
            if (player && question) {
              // Basic scoring logic
              const isCorrect = message.payload.answer === question.correctOption;
              if (isCorrect) {
                // Server authoritative timing bonus could go here
                player.score += 100 + (player.streak * 10);
                player.streak++;
              } else {
                player.streak = 0;
              }
              
              // Tell player result immediately? Or wait for round end?
              // For simplicity, let's wait for next question trigger or timer
            }
            break;
          }

          case WS_EVENTS.NEXT_QUESTION: {
            if (!userRoomCode) return;
            const room = rooms.get(userRoomCode);
            if (room && room.hostWs === ws) {
              // Show leaderboard first? Or just next question?
              // Let's cycle: Question -> Leaderboard -> Question
              
              if (room.currentQuestionIndex >= room.questions.length - 1) {
                room.state = 'finished';
                broadcastGameOver(room);
              } else {
                 // Send leaderboard for previous question first if we want
                 // For MVP: Host clicks "Next" to show leaderboard, then "Next" again for question?
                 // Let's keep it simple: Host clicks next -> shows Answer/Leaderboard -> clicks Next -> New Question
                 
                 // Simplified flow: Host clicks "Next" -> New Question
                 room.currentQuestionIndex++;
                 sendQuestion(room);
              }
            }
            break;
          }
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on('close', () => {
      if (userRoomCode && userId) {
        const room = rooms.get(userRoomCode);
        if (room) {
          const player = room.players.get(userId);
          if (player) {
            player.connected = false;
            // Optionally remove after timeout
          }
        }
      }
    });
  });

  // Helpers
  function broadcastLobbyUpdate(room: Room) {
    const playersList = Array.from(room.players.values()).map(p => ({
      name: p.name,
      score: p.score,
      connected: p.connected
    }));
    
    room.hostWs.send(JSON.stringify({
      type: WS_EVENTS.LOBBY_UPDATE,
      payload: { players: playersList }
    }));
  }

  function broadcastGameStart(room: Room) {
    const msg = JSON.stringify({ type: WS_EVENTS.GAME_STARTED });
    room.hostWs.send(msg);
    room.players.forEach(p => {
      if (p.connected) p.ws.send(msg);
    });
  }

  function sendQuestion(room: Room) {
    const question = room.questions[room.currentQuestionIndex];
    if (!question) return;

    // Mask correct answer for players
    const playerPayload = {
      question: question.front,
      choices: question.options,
      timeLimit: 30000,
      startTime: Date.now()
    };

    const hostPayload = {
      ...playerPayload,
      correctOption: question.correctOption,
      answer: question.back // explanation/back of card
    };

    room.hostWs.send(JSON.stringify({
      type: WS_EVENTS.QUESTION_START,
      payload: hostPayload
    }));

    room.players.forEach(p => {
      if (p.connected) {
        p.ws.send(JSON.stringify({
          type: WS_EVENTS.QUESTION_START,
          payload: playerPayload
        }));
      }
    });
  }

  function broadcastGameOver(room: Room) {
    const leaderboard = Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const msg = JSON.stringify({
      type: WS_EVENTS.GAME_OVER,
      payload: { leaderboard }
    });

    room.hostWs.send(msg);
    room.players.forEach(p => {
      if (p.connected) p.ws.send(msg);
    });
  }

  // No ownerless demo seed: every private deck must have an owner.
  return httpServer;
}
