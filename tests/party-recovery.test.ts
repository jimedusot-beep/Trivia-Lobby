import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { attachPartySocket } from "../examples/party-engine/transport.js";
import { MemoryRoomCheckpointStore } from "../server/room-checkpoints";
import { Party } from "../examples/party-engine/engine.js";
import { snapshotParty, restoreParty } from "../examples/party-engine/party-checkpoint.js";
import { setTimeout as delay } from "node:timers/promises";

function inbox(ws: WebSocket) {
  const frames: any[] = [], listeners: Array<(frame: any) => void> = [];
  ws.on("message", raw => { const frame = JSON.parse(raw.toString()); frames.push(frame); for (const fn of [...listeners]) fn(frame); });
  return {
    ws, frames,
    send(message: unknown) { ws.send(JSON.stringify(message)); },
    async take(type: string, check = (_: any) => true): Promise<any> {
      const found = frames.find(frame => frame.type === type && check(frame));
      if (found) { frames.splice(frames.indexOf(found), 1); return found; }
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.splice(listeners.indexOf(onFrame), 1); reject(new Error(`Missing ${type}`)); }, 2500);
        const onFrame = (frame: any) => { if (frame.type === type && check(frame)) { clearTimeout(timer); listeners.splice(listeners.indexOf(onFrame), 1); frames.splice(frames.indexOf(frame), 1); resolve(frame); } };
        listeners.push(onFrame);
      });
    },
  };
}
async function launch(store: MemoryRoomCheckpointStore, partyOptions: object = {}) {
  const server = createServer();
  const transport = attachPartySocket(server, { checkpointStore: store, partyOptions: { countdownMs: 10, quizMs: 60000, ...partyOptions } } as any);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  const sockets: WebSocket[] = [];
  return {
    async open() { const ws = new WebSocket(`ws://127.0.0.1:${address.port}/socket`, { origin: `http://127.0.0.1:${address.port}` }); sockets.push(ws); const messages = inbox(ws); await once(ws, "open"); return messages; },
    async close() { for (const ws of sockets) ws.terminate(); await transport.close(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}

test("a restarted guest server restores its roster and credentials from the authoritative checkpoint", async t => {
  const store = new MemoryRoomCheckpointStore();
  let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send({ type: "create" });
  const hostCredential = await host.take("credential");
  const players = await Promise.all(Array.from({ length: 3 }, () => server.open()));
  const credentials = await Promise.all(players.map(async (player, i) => {
    player.send({ type: "join", code: hostCredential.code, name: `Player ${i}` });
    return await player.take("credential");
  }));
  const startState = (await host.take("state", frame => frame.state.players.length === 3)).state;
  host.send({ v: 1, type: "start", requestId: randomUUID(), matchId: startState.matchId, revision: startState.revision, value: "quiz" });
  const question = (await players[0].take("state", frame => frame.state.phase === "question")).state;
  const request = { v: 1, type: "answer", requestId: randomUUID(), matchId: question.matchId, revision: question.revision, value: 0 };
  players[0].send(request); await players[0].take("ack");
  await server.close(); server = await launch(store);
  const resumed = await server.open(); resumed.send({ type: "resume", code: credentials[0].code, actor: credentials[0].actor, token: credentials[0].token });
  await resumed.take("ready");
  const state = (await resumed.take("state")).state;
  assert.equal(state.players.length, 3);
  assert.equal(state.matchId, question.matchId);
  assert.equal(state.locked, true);
  assert.equal(state.phase, "question");
  assert.equal(state.question.correct, undefined);
  assert.equal(state.players.filter((p: any) => p.connected).length, 1);
  resumed.send(request); assert.equal((await resumed.take("ack")).requestId, request.requestId);
  const stored = await store.load("party", hostCredential.code);
  assert(stored);
  assert(!JSON.stringify(stored.state).includes(credentials[0].token));
  assert(!JSON.stringify(stored.state).includes(hostCredential.token));
});

test("guest recovery never sends database-provider error details to a phone", async t => {
  const store = new MemoryRoomCheckpointStore();
  store.load = async () => { throw new Error("PRIVATE_PROVIDER_DETAIL"); };
  const server = await launch(store); t.after(() => server.close());
  const guest = await server.open(); guest.send({ type: "join", code: "ABC234", name: "Safe errors" });
  const failure = await guest.take("error");
  assert.doesNotMatch(failure.message, /PRIVATE_PROVIDER_DETAIL/);
  assert.match(failure.message, /recovery|temporarily/i);
});

test("a failed guest checkpoint does not issue a credential or retain an uncommitted room", async t => {
  const store = new MemoryRoomCheckpointStore();
  store.save = async () => { throw new Error("database unavailable"); };
  const server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send({ type: "create" });
  const failure = await host.take("error");
  assert.match(failure.message, /recover|storage|save/i);
  assert.equal(host.frames.some(frame => frame.type === "credential"), false);
});

test("Bingo recovery preserves private cards, marked Sets and request replay history", () => {
  let now = 1000;
  const party = new Party("ABC234", { clock: () => now, countdownMs: 1 });
  const ids = [party.join("One"), party.join("Two"), party.join("Three")];
  party.handle("host", { v: 1, type: "start", requestId: "start-bingo", matchId: null, revision: 0, value: "bingo" });
  now += 2; party.tick();
  party.bonusBingo.cards.get(ids[0]).marked.add(2);
  const original = party.view(ids[0]).bonus;
  const restored = restoreParty("ABC234", JSON.parse(JSON.stringify(snapshotParty(party))), { clock: () => now }, now);
  assert.deepEqual(restored.view(ids[0]).bonus.card, original.card);
  assert.deepEqual(restored.view(ids[0]).bonus.marks, [2]);
  assert.equal(restored.view("host").bonus.card, undefined);
  assert.equal(restored.hostConnected, false);
  assert(restored.requests.has("host:start-bingo"));
});

test("twenty guests sharing one source IP retain scores through concurrent reconnect and restart", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store); t.after(() => server.close());
  const host = await server.open(); host.send({ type: "create" }); const hc = await host.take("credential");
  const players = await Promise.all(Array.from({ length: 20 }, () => server.open()));
  const credentials = await Promise.all(players.map(async (player, index) => {
    player.send({ type: "join", code: hc.code, name: `Shared WiFi ${index}` }); return player.take("credential");
  }));
  const lobby = (await host.take("state", m => m.state.players.length === 20)).state;
  host.send({ v: 1, type: "start", requestId: randomUUID(), matchId: lobby.matchId, revision: lobby.revision, value: "quiz" });
  const states = await Promise.all(players.map(player => player.take("state", m => m.state.phase === "question")));
  const sentAt = performance.now();
  const requests = states.map(({ state }) => ({ v: 1, type: "answer", requestId: randomUUID(), matchId: state.matchId, revision: state.revision, value: 1 }));
  const latency = await Promise.all(players.map(async (player, index) => { player.send(requests[index]); await player.take("ack"); return performance.now() - sentAt; }));
  const reveal = (await host.take("state", m => m.state.phase === "reveal")).state;
  assert(reveal.players.every((p: any) => p.score === 100));
  const replacements = await Promise.all(players.map(() => server.open()));
  await Promise.all(replacements.map(async (player, index) => {
    player.send({ type: "resume", code: hc.code, actor: credentials[index].actor, token: credentials[index].token });
    await player.take("ready"); await player.take("state");
  }));
  await server.close(); server = await launch(store);
  const resumedHost = await server.open(); resumedHost.send({ type: "resume", code: hc.code, actor: "host", token: hc.token }); await resumedHost.take("ready");
  const recovered = await Promise.all(players.map(() => server.open()));
  await Promise.all(recovered.map(async (player, index) => {
    player.send({ type: "resume", code: hc.code, actor: credentials[index].actor, token: credentials[index].token });
    await player.take("ready"); const state = (await player.take("state")).state;
    assert.equal(state.players.length, 20); assert(state.players.every((p: any) => p.score === 100));
    player.send(requests[index]); await player.take("ack");
  }));
  const final = (await resumedHost.take("state", m => m.state.players.filter((p: any) => p.connected).length === 20)).state;
  assert(final.players.every((p: any) => p.score === 100));
  latency.sort((a, b) => a - b);
  console.log(JSON.stringify({ scenario: "20-player-shared-IP", ackP95Ms: Math.round(latency[18]), roster: final.players.length, duplicateScores: 0 }));
});

test("a guest deadline elapsed during shutdown reveals once and does not reopen the round", async t => {
  const store = new MemoryRoomCheckpointStore(); let server = await launch(store, { quizMs: 80 }); t.after(() => server.close());
  const host = await server.open(); host.send({ type: "create" }); const hc = await host.take("credential");
  const players = await Promise.all(Array.from({ length: 3 }, () => server.open()));
  const credentials = await Promise.all(players.map(async (player, i) => { player.send({ type: "join", code: hc.code, name: `Deadline ${i}` }); return player.take("credential"); }));
  const lobby = (await host.take("state", m => m.state.players.length === 3)).state;
  host.send({ v: 1, type: "start", requestId: randomUUID(), matchId: lobby.matchId, revision: lobby.revision, value: "quiz" });
  await host.take("state", m => m.state.phase === "question");
  await server.close(); await delay(120); server = await launch(store);
  const resumed = await server.open(); resumed.send({ type: "resume", code: hc.code, actor: credentials[0].actor, token: credentials[0].token });
  await resumed.take("ready"); const state = (await resumed.take("state")).state;
  assert.equal(state.phase, "reveal"); assert(state.players.every((player: any) => player.score === 0));
});
