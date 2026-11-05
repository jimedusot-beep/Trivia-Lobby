import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as wait } from "node:timers/promises";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

async function server(t, options = {}, checkpointStore, observe = () => {}) {
  const app = createPartyServer({ checkpointStore, partyOptions: { countdownMs: 10, raceMs: 8000, raceLaps: 99, ...options } });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`, peers = [];
  t.after(async () => { for (const peer of peers) peer.ws.terminate(); await app.close(); });
  async function connect(hello) {
    const ws = new WebSocket(origin.replace("http", "ws") + "/socket", { origin });
    const messages = [], listeners = new Set();
    ws.on("message", raw => { const message = JSON.parse(raw); observe(message); messages.push(message); for (const notify of listeners) notify(); });
    const peer = { ws, messages, send: m => ws.send(JSON.stringify(m)), seq: 0,
      until(predicate, cursor = 0) {
        const found = messages.slice(cursor).find(predicate);
        if (found) return Promise.resolve(found);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { listeners.delete(check); reject(new Error("Socket event timed out")); }, 5000);
          const check = () => { const found = messages.slice(cursor).find(predicate); if (found) { clearTimeout(timer); listeners.delete(check); resolve(found); } };
          listeners.add(check);
        });
      } };
    peers.push(peer); await once(ws, "open");
    if (hello) {
      peer.send(hello);
      if (hello.type === "resume") await peer.until(m => m.type === "ready");
      else peer.credential = await peer.until(m => m.type === "credential");
    }
    return peer;
  }
  async function room(size) {
    const host = await connect({ type: "create" }), code = host.credential.code;
    const players = [];
    for (let i = 0; i < size; i++) players.push(await connect({ type: "join", code, name: `Driver ${i + 1}` }));
    const party = app.rooms.get(code).party;
    return { host, players, party, code };
  }
  let request = 0;
  async function action(peer, party, type, value) {
    const requestId = `race-wire-${++request}`, cursor = peer.messages.length;
    peer.send({ v: 1, type, requestId, matchId: party.matchId, revision: party.revision, ...(value === undefined ? {} : { value }) });
    return peer.until(m => m.type === "ack" && m.requestId === requestId || m.type === "error", cursor);
  }
  return { app, connect, room, action };
}
for (const [size, storageDelay] of [[10, 0], [20, 0], [20, 150]]) test(`${size} controllers with ${storageDelay} ms checkpoint delay sustain bounded traffic and reconnect`, { timeout: 30000 }, async t => {
  const saved = new Map();
  const checkpointTimes = [], hostFrames = new Map();
  let delay = 0, activeWrites = 0, maxWrites = 0, commits = 0;
  const checkpointStore = storageDelay ? {
    async load(_kind, code) { return saved.get(code); },
    async save(_kind, code, state, _expiresAt, version) {
      const started = performance.now();
      activeWrites++; maxWrites = Math.max(maxWrites, activeWrites);
      try {
        if (delay) await wait(delay);
        const next = (version ?? 0) + 1;
        saved.set(code, { state: structuredClone(state), version: next, savedAt: Date.now() });
        commits++;
        return next;
      } finally {
        if (delay) checkpointTimes.push([started, performance.now()]);
        activeWrites--;
      }
    },
    async delete(_kind, code) { saved.delete(code); },
    async prune() {},
  } : undefined;
  const f = await server(t, {}, checkpointStore, message => {
    if (message.type === "race_frame" && message.karts && !hostFrames.has(message.frame))
      hostFrames.set(message.frame, performance.now());
  }), r = await f.room(size);
  await f.action(r.host, r.party, "start", "race");
  await r.host.until(m => m.type === "state" && m.state.phase === "playing");
  delay = storageDelay;
  let host = r.host;
  const credentials = r.players.map(p => p.credential);
  const start = performance.now();
  for (let i = 0; i < 60; i++) {
    for (const peer of r.players) peer.send({ v: 1, type: "race_input", matchId: r.party.matchId, heat: 0, seq: peer.seq++,
      steer: Math.sin(i * 0.1) * 0.15, drift: i > 15 && i < 45, item: i === 50, assist: true });
    if (i === 20) {
      r.players[0].ws.terminate();
      r.players[0] = await f.connect({ type: "resume", code: r.code, actor: credentials[0].actor, token: credentials[0].token });
      host = await f.connect({ type: "resume", code: r.code, actor: "host", token: r.host.credential.token });
      const recovered = await host.until(m => m.type === "state" && m.state.phase === "playing");
      assert.equal(recovered.state.pack.karts.length, size);
      assert.equal(recovered.state.players.length, size);
    }
    await wait(50);
  }
  for (const [i, peer] of r.players.entries()) {
    assert.equal(peer.messages.filter(m => m.type === "error").length, 0);
    const frames = peer.messages.filter(m => m.type === "race_frame");
    assert.ok(frames.length >= 10);
    assert.ok(frames.every(m => m.own?.number === i + 1 && !m.karts && JSON.stringify(m).length < 512));
    assert.ok(r.party.pack.karts.find(k => k.id === credentials[i].actor).progress > 0.04);
  }
  const frames = host.messages.filter(m => m.type === "race_frame");
  assert.ok(frames.length >= 10);
  assert.ok(frames.every(m => m.karts.length === size && !m.own && JSON.stringify(m).length < 6000));
  assert.ok(r.party.pack.frame >= 50);
  const outsider = await f.connect();
  outsider.send({ type: "resume", code: r.code, actor: credentials[0].actor, token: "A".repeat(43) });
  await outsider.until(m => m.type === "error");
  const cursor = r.players[0].messages.length;
  r.players[0].send({ v: 1, type: "race_input", matchId: r.party.matchId, heat: 0, seq: 9999, steer: 0, drift: false, item: false, assist: true, actor: credentials[1].actor });
  await r.players[0].until(m => m.type === "error" && /Invalid/.test(m.message), cursor);
  await f.action(host, r.party, "play", { action: "end-match" });
  await f.action(host, r.party, "lobby");
  assert.equal(r.party.players.size, size);
  assert.equal(r.party.phase, "lobby");
  if (storageDelay) {
    assert.equal(maxWrites, 1, "slow storage must not overlap writes within a room");
    assert.ok(commits > size, "live simulation must have committed checkpoints");
  }
  const frameArrivals = [...hostFrames.values()];
  const relative = time => Math.round(time - start);
  const gaps = frameArrivals.slice(1).map((time, i) => time - frameArrivals[i]).sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({
    ...(storageDelay ? {frameTimesMs: frameArrivals.map(relative), checkpointIntervalsMs: checkpointTimes.map(pair => pair.map(relative))} : {}),
    controllers: size, inputFrames: size * 60, checkpointDelayMs: storageDelay,
    elapsedMs: Math.round(performance.now() - start), maxConcurrentWrites: maxWrites,
    observedHostFrames: frameArrivals.length,
    frameGapP95Ms: gaps.length ? Math.round(gaps[Math.ceil(gaps.length * 0.95) - 1]) : null,
    note: "Loopback sockets and injected memory-store latency; not production database or Wi-Fi measurements."
  }));
});

test("race-room admission is bounded and releases its slot when the host ends a match", async t => {
  const f = await server(t), rooms = [];
  for (let i = 0; i < 5; i++) rooms.push(await f.room(2));
  for (let i = 0; i < 4; i++) assert.equal((await f.action(rooms[i].host, rooms[i].party, "start", "race")).type, "ack");
  const last = rooms[4];
  const error = await f.action(last.host, last.party, "start", "race");
  assert.match(error.message, /Four races/);
  const first = rooms[0];
  await first.host.until(m => m.type === "state" && m.state.phase === "playing");
  await f.action(first.host, first.party, "play", { action: "end-match" });
  assert.equal((await f.action(last.host, last.party, "start", "race")).type, "ack");
});

test("continuous input cannot bypass ordinary game action limits; racing spam closes its socket", async t => {
  const f = await server(t), r = await f.room(2), peer = r.players[0];
  // Pace invalid lobby controls so this exercises the steady 60/10s protocol
  // limit rather than the separate slow-database inbound queue overflow path.
  for (let i = 0; i < 62; i++) {
    const cursor = peer.messages.length;
    peer.send({ type: "race_input" });
    await peer.until(m => m.type === "error", cursor);
  }
  assert.ok(peer.messages.some(m => m.type === "error" && /Too many/.test(m.message)));
  await f.action(r.host, r.party, "start", "race");
  await r.host.until(m => m.type === "state" && m.state.phase === "playing");
  const closed = once(peer.ws, "close");
  for (let i = 0; i < 50; i++) peer.send({ v: 1, type: "race_input", matchId: r.party.matchId, heat: 0, seq: i,
    steer: 0, drift: false, item: false, assist: true });
  assert.equal((await closed)[0], 1008);
});
