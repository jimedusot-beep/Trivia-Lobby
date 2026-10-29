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

test("a healthy guest host can recover after idling longer than the host absence grace", () => {
  let now = 1000;
  const party = new Party("ABC234", { clock: () => now });
  const saved = JSON.parse(JSON.stringify(snapshotParty(party)));
  now += 90000;
  const restored = restoreParty("ABC234", saved, { clock: () => now }, 1000);
  restored.tick(); restored.connected("host", true);
  assert.equal(restored.phase, "lobby");
  assert.equal(restored.interrupted, false);
  assert.equal(restored.hostWaitAt, null);
});

test("the newly established guest recovery grace survives another restart without extending", () => {
  let now = 1000;
  const party = new Party("ABC234", { clock: () => now });
  now = 91000;
  const first = restoreParty("ABC234", snapshotParty(party), { clock: () => now }, 1000);
  assert.equal(first.hostWaitAt, now);
  const checkpoint = JSON.parse(JSON.stringify(snapshotParty(first)));
  now += 30000;
  const second = restoreParty("ABC234", checkpoint, { clock: () => now }, 91000);
  assert.equal(second.hostWaitAt, 91000);
  second.tick(); assert.equal(second.phase, "lobby");
  now += 30000;
  second.tick(); assert.equal(second.phase, "finished");
  assert.equal(second.interrupted, true);
});

test("an elapsed-round guest replacement failure disconnects the displaced phone for recovery", async t => {
  let now = 1000;
  const store = new MemoryRoomCheckpointStore();
  const server = await launch(store, { clock: () => now, countdownMs: 0 }); t.after(() => server.close());
  const host = await server.open(); host.send({ type: "create" }); const hc = await host.take("credential");
  const players = await Promise.all(Array.from({ length: 3 }, () => server.open()));
  const credentials = await Promise.all(players.map(async (player, i) => {
    player.send({ type: "join", code: hc.code, name: `Replacement ${i}` }); return player.take("credential");
  }));
  const lobby = (await host.take("state", m => m.state.players.length === 3)).state;
  host.send({ v: 1, type: "start", requestId: randomUUID(), matchId: lobby.matchId, revision: lobby.revision, value: "quiz" });
  const question = (await players[0].take("state", m => m.state.phase === "question")).state;
  const original = players[0], replacement = await server.open();
  const closed = once(original.ws, "close", { signal: AbortSignal.timeout(1500) });
  const save = store.save.bind(store);
  store.save = async () => { throw new Error("injected replacement failure"); };
  now = question.deadline + 1;
  replacement.send({ ...credentials[0], type: "resume" });
  assert.match((await replacement.take("error")).message, /recovery/i);
  assert.equal((await closed)[0], 1013);
  assert.match((await original.take("error")).message, /recovery/i);
  assert(!replacement.frames.some(frame => frame.type === "ready"));
  store.save = save;
  const recovered = await server.open(); recovered.send({ ...credentials[0], type: "resume" });
  await recovered.take("ready");
  const state = (await recovered.take("state")).state;
  assert.equal(state.phase, "reveal");
  assert(state.players.every((player: any) => player.score === 0));
});

test("pending guest create/join intents recover once after restart without plaintext secrets", async t => {
  const { randomBytes } = await import("node:crypto");
  const store = new MemoryRoomCheckpointStore();
  let server = await launch(store); t.after(() => server.close());
  const entryToken = randomBytes(32).toString("base64url");
  const host = await server.open(); host.send({ type: "create", entryToken });
  const hc = await host.take("credential");
  const playerToken = randomBytes(32).toString("base64url");
  const join = { type: "join", code: hc.code, name: "Pending guest", entryToken: playerToken };
  const player = await server.open(); player.send(join); const pc = await player.take("credential");
  await server.close(); server = await launch(store);
  const retryHost = await server.open(); retryHost.send({ type: "create", entryToken });
  assert.deepEqual(await retryHost.take("credential"), hc);
  const retryPlayer = await server.open(); retryPlayer.send(join);
  assert.deepEqual(await retryPlayer.take("credential"), pc);
  const state = (await retryPlayer.take("state")).state;
  assert.equal(state.players.length, 1); assert.equal(state.players[0].id, pc.actor);
  const stored = await store.load("party", hc.code); assert(stored);
  assert(!JSON.stringify(stored.state).includes(entryToken));
  assert(!JSON.stringify(stored.state).includes(playerToken));
  assert(!JSON.stringify(state).includes(playerToken));
});

test("countdown recovery retains the selected pack rules instead of defaulting", () => {
  for (const [mode, settings] of [["colors", { bots: 2, stacking: true, turnSeconds: 60 }], ["table", { preset: "whist" }]] as const) {
    let now = Date.now();
    const party = new Party("ABC234", { clock: () => now, countdownMs: 3000 });
    for (let i = 0; i < 4; i++) party.join(`Settings ${i}`);
    party.handle("host", { v: 1, type: "start", requestId: `settings-${mode}`, matchId: null, revision: 0, value: mode, settings });
    assert.equal(party.phase, "countdown");
    const restored = restoreParty("ABC234", JSON.parse(JSON.stringify(snapshotParty(party))), { clock: () => now }, now);
    assert.deepEqual(restored.packSettings, settings);
    now += 3001; restored.tick();
    if (mode === "colors") {
      assert.equal(restored.pack.stacking, true);
      assert.equal(restored.pack.turnMs, 60000);
      assert.equal(restored.pack.seats.length, 6);
    } else assert.equal(restored.pack.preset, "whist");
  }
});

test("legacy countdown checkpoints without pack settings retain safe defaults", () => {
  let now = 1000;
  const party = new Party("ABC234", { clock: () => now, countdownMs: 3000 });
  for (let i = 0; i < 4; i++) party.join(`Legacy ${i}`);
  party.handle("host", { v: 1, type: "start", requestId: "legacy-settings", matchId: null, revision: 0, value: "colors", settings: {} });
  const checkpoint = JSON.parse(JSON.stringify(snapshotParty(party)));
  delete checkpoint.packSettings;
  const restored = restoreParty("ABC234", checkpoint, { clock: () => now }, now);
  now += 3001; restored.tick();
  assert.equal(restored.phase, "playing");
  assert.equal(restored.pack.stacking, false);
  assert.equal(restored.pack.turnMs, 30000);
  assert.equal(restored.pack.seats.length, 4);
});

for (const [mode, settings] of [["colors", { bots: 2, stacking: true, turnSeconds: 60 }], ["table", { preset: "whist" }]] as const) {
  test(`${mode}: committed countdown rules survive a real socket server restart`, async t => {
    let now = 1000;
    const store = new MemoryRoomCheckpointStore();
    let server = await launch(store, { clock: () => now, countdownMs: 3000 });
    t.after(() => server.close());
    const host = await server.open(); host.send({ type: "create" });
    const credential = await host.take("credential");
    const players = await Promise.all(Array.from({ length: 4 }, () => server.open()));
    await Promise.all(players.map(async (player, i) => {
      player.send({ type: "join", code: credential.code, name: `Restart ${i}` });
      await player.take("credential");
    }));
    const lobby = (await host.take("state", m => m.state.players.length === 4)).state;
    const requestId = `restart-settings-${mode}`;
    host.send({ v: 1, type: "start", requestId, matchId: lobby.matchId, revision: lobby.revision, value: mode, settings });
    await host.take("ack", m => m.requestId === requestId);
    const saved = await store.load("party", credential.code); assert(saved);
    assert.deepEqual(saved.state.party.packSettings, settings);
    await server.close(); now += 3001;
    server = await launch(store, { clock: () => now, countdownMs: 3000 });
    const resumed = await server.open(); resumed.send({ ...credential, type: "resume" });
    await resumed.take("ready");
    const state = (await resumed.take("state", m => m.state.phase === "playing")).state;
    assert.equal(state.matchId, saved.state.party.matchId);
    const opened = await store.load("party", credential.code); assert(opened);
    assert.deepEqual(opened.state.party.packSettings, settings);
    if (mode === "colors") {
      assert.equal(opened.state.party.pack.stacking, true);
      assert.equal(opened.state.party.pack.turnMs, 60000);
      assert.equal(opened.state.party.pack.seats.length, 6);
    } else assert.equal(opened.state.party.pack.preset, "whist");
  });
}
