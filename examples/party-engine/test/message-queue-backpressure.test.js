import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

function delayedCheckpoints() {
  let release = null, signal = null, waiting = null, held = false, version = 0;
  return {
    store: {
      async load() { return undefined; },
      async save() {
        if (held) {
          signal?.();
          await waiting;
        }
        return ++version;
      },
      async delete() {},
      async prune() {},
    },
    hold() {
      if (held) throw new Error("Checkpoint is already paused");
      held = true;
      const entered = new Promise(resolve => { signal = resolve; });
      waiting = new Promise(resolve => { release = resolve; });
      return { entered, release: () => { held = false; release?.(); release = null; } };
    },
  };
}

async function fixture(t) {
  const checkpoints = delayedCheckpoints();
  const app = createPartyServer({ checkpointStore: checkpoints.store });
  const peers = [];
  let pause;
  t.after(async () => {
    pause?.release();
    for (const peer of peers) peer.ws.terminate();
    await app.close();
  });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const port = app.server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin });
    const received = [], listeners = new Set();
    ws.on("message", raw => {
      const message = JSON.parse(raw.toString());
      received.push(message);
      for (const listener of [...listeners]) listener();
    });
    const peer = {
      ws, received,
      send: data => ws.send(JSON.stringify(data)),
      wait(predicate, timeout = 10000) {
        const existing = received.find(predicate);
        if (existing) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { listeners.delete(check); reject(new Error("Timed out waiting for guest message")); }, timeout);
          function check() {
            const message = received.find(predicate);
            if (!message) return;
            clearTimeout(timer); listeners.delete(check); resolve(message);
          }
          listeners.add(check);
        });
      },
    };
    peers.push(peer);
    await once(ws, "open");
    return peer;
  }
  async function createRoom() {
    const host = await connect();
    host.send({ type: "create" });
    const credential = await host.wait(message => message.type === "credential");
    return { host, code: credential.code };
  }
  return {
    app, checkpoints, connect, createRoom,
    hold() { pause = checkpoints.hold(); return pause; },
  };
}

test("stalled checkpoint bounds a connection's queued messages and permits retryable reconnect", { timeout: 15000 }, async t => {
  const f = await fixture(t);
  const { host, code } = await f.createRoom();
  const pause = f.hold();
  const guest = await f.connect();
  guest.send({ type: "join", code, name: "Overloaded phone" });
  await pause.entered;

  const closed = once(guest.ws, "close");
  for (let i = 0; i < 25; i++) guest.send({ type: "ping" });
  const error = await guest.wait(m => m.type === "error" && /too many queued messages/i.test(m.message));
  assert.match(error.message, /temporarily unavailable/i, "Browser retains pending action for retry");
  assert.equal((await closed)[0], 1013, "Overloaded phone receives a retryable close code");

  pause.release();
  const healthy = await f.connect();
  healthy.send({ type: "join", code, name: "Recovered phone" });
  assert.equal((await healthy.wait(m => m.type === "credential")).code, code);
  host.send({ type: "ping" });
  assert.ok(await host.wait(m => m.type === "pong"));
  assert.equal(host.ws.readyState, WebSocket.OPEN, "Other devices stay connected");
});

test("stalled checkpoint bounds queued message bytes, not just message count", { timeout: 15000 }, async t => {
  const f = await fixture(t);
  const { code } = await f.createRoom();
  const pause = f.hold();
  const guest = await f.connect();
  guest.send({ type: "join", code, name: "Large backlog" });
  await pause.entered;
  const closed = once(guest.ws, "close");
  const frame = JSON.stringify({ type: "ping", padding: "x".repeat(32000) });
  assert.ok(Buffer.byteLength(frame) < 32768, "Each inbound frame stays under WebSocket maxPayload");
  for (let i = 0; i < 3; i++) guest.ws.send(frame);
  assert.match((await guest.wait(m => m.type === "error")).message, /too many queued messages/i);
  assert.equal((await closed)[0], 1013);
  pause.release();
});

test("20 phones keep bounded legitimate actions during one slow database checkpoint", { timeout: 20000 }, async t => {
  const f = await fixture(t);
  const { host, code } = await f.createRoom();
  const pause = f.hold();
  const phones = [];
  const first = await f.connect();
  phones.push(first);
  first.send({ type: "join", code, name: "Phone 1" });
  await pause.entered;
  for (let i = 1; i < 20; i++) {
    const peer = await f.connect();
    phones.push(peer);
    peer.send({ type: "join", code, name: `Phone ${i + 1}` });
  }
  // Each phone has only nine ordinary queued frames (join + eight heartbeat
  // probes) while the checkpoint is suspended. No client should be evicted.
  for (const peer of phones) for (let i = 0; i < 8; i++) peer.send({ type: "ping" });
  pause.release();
  await Promise.all(phones.map(peer => peer.wait(m => m.type === "credential", 15000)));
  await Promise.all(phones.map(peer => peer.wait(m => m.type === "pong", 15000)));
  assert.equal(f.app.rooms.get(code).party.players.size, 20);
  assert.ok(phones.every(peer => peer.ws.readyState === WebSocket.OPEN), "Legitimate 20-phone party survives");
  assert.equal(host.ws.readyState, WebSocket.OPEN);
});
