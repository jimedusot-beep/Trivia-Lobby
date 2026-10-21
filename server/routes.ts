import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";
import { canSubmitAnswer, publicLeaderboard, publicPlayerView } from "./room-projections";

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
  
  // === HTTP API ROUTES ===

  app.get(api.decks.list.path, async (req, res) => {
    const decks = await storage.getDecks();
    res.json(decks);
  });

  app.get(api.decks.get.path, async (req, res) => {
    const deck = await storage.getDeck(Number(req.params.id));
    if (!deck) return res.status(404).json({ message: "Deck not found" });
    res.json(deck);
  });

  app.post(api.decks.create.path, async (req, res) => {
    try {
      const input = api.decks.create.input.parse(req.body);
      const deck = await storage.createDeck(input);
      res.status(201).json(deck);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.decks.import.path, async (req, res) => {
    try {
      const input = api.decks.import.input.parse(req.body);
      const deck = await storage.importDeck(input.deck, input.cards);
      res.status(201).json(deck);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Deck import failed:", err);
      res.status(500).json({ message: "Import failed; no partial deck was saved." });
    }
  });

  app.post(api.cards.create.path, async (req, res) => {
    try {
      const deckId = Number(req.params.id);
      const input = api.cards.create.input.parse(req.body);
      const cards = await storage.createCards(deckId, input);
      res.status(201).json(cards);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.decks.delete.path, async (req, res) => {
    await storage.deleteDeck(Number(req.params.id));
    res.status(204).send();
  });


  // === WEBSOCKET SERVER ===
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let userRoomCode: string | null = null;
    let userId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case WS_EVENTS.CREATE_ROOM: {
            let roomCode: string;
            do {
              roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            } while (rooms.has(roomCode));
            const deck = await storage.getDeck(message.payload.deckId);
            
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
            const player = room.players.get(userId);
            const question = room.questions[room.currentQuestionIndex];
            if (!player || !canSubmitAnswer({
              gameState: room.state,
              connected: player.connected,
              socketMatchesPlayer: player.ws === ws,
              alreadyAnswered: room.answersReceived.has(answerKey),
              questionExists: !!question,
            })) return;
            room.answersReceived.add(answerKey);
            
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
          if (player && player.ws === ws) {
            player.connected = false;
            // Optionally remove after timeout
          }
        }
      }
    });
  });

  // Helpers
  function broadcastLobbyUpdate(room: Room) {
    const playersList = Array.from(room.players.values()).map(publicPlayerView);
    
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
    const leaderboard = publicLeaderboard(room.players.values());

    const msg = JSON.stringify({
      type: WS_EVENTS.GAME_OVER,
      payload: { leaderboard }
    });

    room.hostWs.send(msg);
    room.players.forEach(p => {
      if (p.connected) p.ws.send(msg);
    });
  }

  // Seed if empty
  await seedDatabase();

  return httpServer;
}

// Seed function
export async function seedDatabase() {
  const existing = await storage.getDecks();
  if (existing.length === 0) {
    const deck = await storage.createDeck({
      title: "General Knowledge",
      description: "A sample trivia deck",
      category: "Trivia"
    });
    
    await storage.createCards(deck.id, [
      {
        front: "What is the capital of France?",
        back: "Paris",
        type: "multiple_choice",
        options: ["London", "Berlin", "Madrid", "Paris"],
        correctOption: "D"
      },
      {
        front: "Which planet is known as the Red Planet?",
        back: "Mars",
        type: "multiple_choice",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctOption: "B"
      }
    ]);
  }
}
