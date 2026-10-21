import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { setupAuthentication } from "../server/auth";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";
import { db, pool } from "../server/db";
import { cards } from "../shared/schema";

class GameClient {
  socket: WebSocket;
  queue: Array<{ type: string; payload: any }> = [];
  waiters: Array<{ type: string; resolve: (message: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];
  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on("message", raw => {
      const message = JSON.parse(raw.toString());
      const index = this.waiters.findIndex(entry => entry.type === message.type);
      if (index !== -1) {
        const [waiter] = this.waiters.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message.payload);
      } else this.queue.push(message);
    });
  }
  send(type: string, payload: Record<string, unknown>) {
    this.socket.send(JSON.stringify({ type, payload }));
  }
  async next(type: string): Promise<any> {
    const index = this.queue.findIndex(message => message.type === type);
    if (index >= 0) return this.queue.splice(index, 1)[0].payload;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.timer !== timer);
        reject(new Error(`Timed out waiting for ${type}; saw ${this.queue.map(m => m.type)}`));
      }, 5000);
      this.waiters.push({ type, resolve, reject, timer });
    });
  }
  close() { if (this.socket.readyState === WebSocket.OPEN) this.socket.close(); }
}
async function connect(address: string): Promise<GameClient> {
  const socket = new WebSocket(address);
  const client = new GameClient(socket);
  await once(socket, "open");
  return client;
}

test("PostgreSQL ownership, session cookies, transactional data and real WebSocket match", { timeout: 40_000 }, async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for integration tests");
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  setupAuthentication(app);
  const server: Server = createServer(app);
  await registerRoutes(server, app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected ephemeral port");
  const httpUrl = `http://127.0.0.1:${address.port}`;
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
  const connections: GameClient[] = [];

  async function request(path: string, method = "GET", cookie?: string, body?: unknown) {
    return fetch(httpUrl + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  }
  async function account(label: string) {
    const response = await request("/api/auth/register", "POST", undefined, {
      email: `integration-${label}-${Date.now()}@example.test`,
      password: "a-very-long-test-password-12345"
    });
    const payload = await response.json();
    assert.equal(response.status, 201, JSON.stringify(payload));
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "Session cookie must be issued");
    return { cookie, user: payload };
  }

  try {
    const alice = await account("alice");
    const bob = await account("bob");
    assert.equal((await request("/api/decks")).status, 401);
    assert.equal((await request("/api/auth/login", "POST", undefined, {
      email: alice.user.email, password: "incorrect-password"
    })).status, 401);
    const loginResponse = await request("/api/auth/login", "POST", undefined, {
      email: alice.user.email, password: "a-very-long-test-password-12345"
    });
    assert.equal(loginResponse.status, 200);
    assert.ok(loginResponse.headers.get("set-cookie")?.includes("trivia.sid="));
    const crossSiteResponse = await fetch(httpUrl + "/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ title: "CSRF deck" })
    });
    assert.equal(crossSiteResponse.status, 403);
    const create = await request("/api/decks", "POST", alice.cookie, {
      title: "Private E2E deck", description: "Owned only by Alice", category: "Private"
    });
    assert.equal(create.status, 201);
    const deck = await create.json() as { id: number };
    const add = await request(`/api/decks/${deck.id}/cards`, "POST", alice.cookie, [{
      type: "multiple_choice", front: "What is two plus two?", back: "Four",
      options: ["Three", "Four"], correctOption: "B"
    }]);
    assert.equal(add.status, 201);

    assert.equal((await request(`/api/decks/${deck.id}`, "GET", bob.cookie)).status, 404);
    assert.deepEqual(await (await request("/api/decks", "GET", bob.cookie)).json(), []);
    assert.equal((await request(`/api/decks/${deck.id}/cards`, "POST", bob.cookie, [{
      type: "flashcard", front: "Unauthorized", back: "Never"
    }])).status, 404);
    assert.equal((await request(`/api/decks/${deck.id}`, "DELETE", bob.cookie)).status, 404);
    assert.equal((await request("/api/game/host-ticket", "POST", bob.cookie, { deckId: deck.id })).status, 404);

    const beforeImport = (await storage.getDecks(alice.user.id)).length;
    await assert.rejects(() => storage.importDeck({
      title: "Should roll back", category: "Private"
    }, [{ front: "Broken card", back: null as any, type: "flashcard" }], alice.user.id));
    assert.equal((await storage.getDecks(alice.user.id)).length, beforeImport);
    await assert.rejects(() => db.insert(cards).values({
      deckId: 2_147_483_647, type: "flashcard", front: "Orphan", back: "No"
    }));

    const ticketResponse = await request("/api/game/host-ticket", "POST", alice.cookie, { deckId: deck.id });
    assert.equal(ticketResponse.status, 200);
    const { hostToken } = await ticketResponse.json() as { hostToken: string };
    const host = await connect(wsUrl); connections.push(host);
    host.send("create_room", { deckId: deck.id, hostToken });
    const room = await host.next("room_created");
    assert.match(room.roomCode, /^[A-HJ-NP-Z2-9]{8}$/);
    host.send("start_game", { roomCode: room.roomCode });
    assert.match((await host.next("error")).message, /No players/);

    const intruder = await connect(wsUrl); connections.push(intruder);
    intruder.send("create_room", { deckId: deck.id, hostToken });
    assert.match((await intruder.next("error")).message, /ticket invalid/i);
    intruder.send("start_game", { roomCode: room.roomCode });
    assert.match((await intruder.next("error")).message, /Host permission/i);

    const player = await connect(wsUrl); connections.push(player);
    player.send("join_room", { roomCode: room.roomCode, playerName: "AlicePlayer" });
    const joined = await player.next("room_joined");
    assert.ok(joined.playerId);
    assert.equal(joined.reconnectToken.length, 43);
    assert.equal((await player.next("sync_snapshot")).gameStatus, "lobby");
    player.close();

    const resumed = await connect(wsUrl); connections.push(resumed);
    resumed.send("rejoin_room", { roomCode: room.roomCode, playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    const rotated = await resumed.next("room_joined");
    assert.notEqual(rotated.reconnectToken, joined.reconnectToken);
    assert.equal((await resumed.next("sync_snapshot")).playerId, joined.playerId);

    const stolen = await connect(wsUrl); connections.push(stolen);
    stolen.send("rejoin_room", { roomCode: room.roomCode, playerId: joined.playerId, reconnectToken: joined.reconnectToken });
    assert.match((await stolen.next("error")).message, /Session invalid/i);

    host.send("start_game", { roomCode: room.roomCode });
    await host.next("game_started");
    const started = await host.next("question_start");
    assert.equal(started.prompt, "What is two plus two?");
    assert.deepEqual(started.choices, ["Three", "Four"]);
    assert.equal("correctOption" in started, false);
    const playerQuestion = await resumed.next("question_start");
    assert.equal("correctLetter" in playerQuestion, false);

    resumed.send("submit_answer", { roomCode: room.roomCode, questionId: 999, answer: "B" });
    assert.match((await resumed.next("error")).message, /no longer accepting/i);
    resumed.send("submit_answer", { roomCode: room.roomCode, questionId: started.questionId, answer: "B" });
    await resumed.next("answer_accepted");
    const result = await resumed.next("answer_result");
    assert.equal(result.correct, true);
    assert.equal(result.points, 100);
    assert.equal(result.correctLetter, "B");
    assert.equal(result.leaderboard[0].score, 100);
    assert.equal("ws" in result.leaderboard[0], false);
    assert.equal("tokenHash" in result.leaderboard[0], false);
    await host.next("answer_result");
    resumed.send("submit_answer", { roomCode: room.roomCode, questionId: started.questionId, answer: "B" });
    assert.match((await resumed.next("error")).message, /no longer accepting/i);
    host.send("next_question", { roomCode: room.roomCode });
    assert.equal((await host.next("game_over")).leaderboard[0].score, 100);
    assert.equal((await resumed.next("game_over")).leaderboard[0].playerId, joined.playerId);

    const del = await request(`/api/decks/${deck.id}`, "DELETE", alice.cookie);
    assert.equal(del.status, 204);
    assert.equal((await request(`/api/decks/${deck.id}`, "GET", alice.cookie)).status, 404);
    const remainingCards = await db.select().from(cards).where(eq(cards.deckId, deck.id));
    assert.equal(remainingCards.length, 0);
    assert.equal((await request("/api/auth/logout", "POST", alice.cookie)).status, 204);
    assert.equal((await request("/api/decks", "GET", alice.cookie)).status, 401);
  } finally {
    for (const client of connections) client.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});
