import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import { registerGameSockets } from "./game-ws";
import { WS_EVENTS, type DeckWithCards } from "@shared/schema";

type Event = { type: string; payload: any };
function watcher(socket: WebSocket) {
  const inbox: Event[] = [];
  const waiters = new Set<() => void>();
  socket.on("message", raw => {
    inbox.push(JSON.parse(raw.toString()));
    for (const notify of waiters) notify();
  });
  return async (type: string, timeout = 2200): Promise<Event> => {
    const take = () => {
      const idx = inbox.findIndex(event => event.type === type);
      return idx < 0 ? null : inbox.splice(idx, 1)[0];
    };
    const current = take();
    if (current) return current;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiters.delete(tryTake); reject(new Error("Timed out waiting for " + type)); }, timeout);
      function tryTake() {
        const found = take();
        if (!found) return;
        clearTimeout(timer);
        waiters.delete(tryTake);
        resolve(found);
      }
      waiters.add(tryTake);
    });
  };
}
const sampleDeck: DeckWithCards = {
  id: 1, title: "Family Science", description: "", category: "Trivia", createdAt: new Date(),
  cards: [{
    id: 1, deckId: 1, front: "What is the red planet?", back: "Mars",
    type: "multiple_choice", options: ["Venus", "Mars", "Jupiter"], correctOption: "B", createdAt: new Date(),
  }],
};

describe("WebSocket host and player protocol", () => {
  it("creates a room, joins, grades only once, publishes results, and finishes safely", async () => {
    const server = createServer();
    const wss = registerGameSockets(server, async id => id === 1 ? sampleDeck : undefined);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const origin = `http://127.0.0.1:${port}`;
    const connect = async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
      await once(ws, "open");
      return ws;
    };
    const sockets: WebSocket[] = [];
    const open = async () => { const ws = await connect(); sockets.push(ws); return ws; };
    try {
      const host = await open();
      const hostNext = watcher(host);
      host.send(JSON.stringify({ type: WS_EVENTS.CREATE_ROOM, payload: { deckId: 1 } }));
      const roomCode = (await hostNext(WS_EVENTS.ROOM_CREATED)).payload.roomCode as string;
      assert.match(roomCode, /^[A-HJ-NP-Z2-9]{6}$/);
      const player = await open();
      const playerNext = watcher(player);
      player.send(JSON.stringify({ type: WS_EVENTS.JOIN_ROOM, payload: { roomCode, name: "Scholar" } }));
      const joined = (await playerNext(WS_EVENTS.ROOM_JOINED)).payload;
      assert.ok(joined.resumeToken);
      assert.ok(joined.playerId);
      await playerNext(WS_EVENTS.SYNC_SNAPSHOT);
      await hostNext(WS_EVENTS.LOBBY_UPDATE);

      host.send(JSON.stringify({ type: WS_EVENTS.START_GAME, payload: {} }));
      await hostNext(WS_EVENTS.GAME_STARTED);
      const q = (await playerNext(WS_EVENTS.QUESTION_START)).payload;
      assert.equal(q.prompt, "What is the red planet?");
      assert.deepEqual(q.choices, ["Venus", "Mars", "Jupiter"]);
      assert.equal(q.correctLetter, undefined);
      assert.ok(q.serverStartTs > 0);

      player.send(JSON.stringify({ type: WS_EVENTS.SUBMIT_ANSWER, payload: { answer: "B" } }));
      const result = (await hostNext(WS_EVENTS.ANSWER_RESULT)).payload;
      assert.equal(result.correctLetter, "B");
      assert.equal(result.leaderboard[0].score, 100);
      assert.deepEqual(Object.keys(result.leaderboard[0]).sort(), ["lastPoints", "name", "playerId", "score"]);
      player.send(JSON.stringify({ type: WS_EVENTS.SUBMIT_ANSWER, payload: { answer: "B" } }));
      host.send(JSON.stringify({ type: WS_EVENTS.NEXT_QUESTION, payload: {} }));
      const final = (await hostNext(WS_EVENTS.GAME_OVER)).payload;
      assert.equal(final.leaderboard[0].score, 100);
      assert.doesNotMatch(JSON.stringify(final), /resumeToken|hostWs|secret|socket|connected/);
    } finally {
      sockets.forEach(socket => socket.terminate());
      await new Promise<void>(resolve => wss.close(() => server.close(() => resolve())));
    }
  });

  it("does not allow another client to impersonate a player with an invalid reconnect token", async () => {
    const server = createServer();
    const wss = registerGameSockets(server, async () => sampleDeck);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const origin = `http://127.0.0.1:${port}`;
    const sockets: WebSocket[] = [];
    async function open() {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin });
      await once(ws, "open");
      sockets.push(ws);
      return ws;
    }
    try {
      const host = await open(); const hostNext = watcher(host);
      host.send(JSON.stringify({ type: WS_EVENTS.CREATE_ROOM, payload: { deckId: 1 } }));
      const code = (await hostNext(WS_EVENTS.ROOM_CREATED)).payload.roomCode;
      const player = await open(); const playerNext = watcher(player);
      player.send(JSON.stringify({ type: WS_EVENTS.JOIN_ROOM, payload: { roomCode: code, name: "A" } }));
      const joined = (await playerNext(WS_EVENTS.ROOM_JOINED)).payload;
      const impostor = await open(); const next = watcher(impostor);
      impostor.send(JSON.stringify({ type: WS_EVENTS.REJOIN_ROOM, payload: {
        role: "player", roomCode: code, playerId: joined.playerId, resumeToken: "wrong",
      } }));
      const response = await next(WS_EVENTS.ERROR);
      assert.match(response.payload.message, /Invalid player session/);
      const legitimate = await open(); const legitimateNext = watcher(legitimate);
      legitimate.send(JSON.stringify({ type: WS_EVENTS.REJOIN_ROOM, payload: {
        role: "player", roomCode: code, playerId: joined.playerId, resumeToken: joined.resumeToken,
      } }));
      const authorized = await legitimateNext(WS_EVENTS.ROOM_JOINED);
      assert.equal(authorized.payload.playerId, joined.playerId);
      await legitimateNext(WS_EVENTS.SYNC_SNAPSHOT);
    } finally {
      sockets.forEach(socket => socket.terminate());
      await new Promise<void>(resolve => wss.close(() => server.close(() => resolve())));
    }
  });
});
