import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createTcpServer, connect as connectTcp } from "node:net";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

// Real TCP bytes, loopback only. No production endpoints or external proxy binary.
async function createFaultProxy(upstreamPort) {
  let downstreamDelayMs = 0, upstreamBytes = 0, downstreamBytes = 0;
  const pairs = new Set();
  const server = createTcpServer(client => {
    const upstream = connectTcp({ host: "127.0.0.1", port: upstreamPort });
    const timers = new Set();
    const pair = { client, upstream, shutdown() {
      if (!pairs.delete(pair)) return;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      client.destroy();
      upstream.destroy();
    } };
    pairs.add(pair);
    const relay = (source, destination, data, delay) => {
      if (delay) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!source.destroyed && !destination.destroyed && !destination.write(data)) {
            source.pause();
            destination.once("drain", () => { if (!source.destroyed) source.resume(); });
          }
        }, delay);
        timers.add(timer);
      } else if (!destination.destroyed && !destination.write(data)) {
        source.pause();
        destination.once("drain", () => { if (!source.destroyed) source.resume(); });
      }
    };
    client.on("data", data => { upstreamBytes += data.length; relay(client, upstream, data, 0); });
    upstream.on("data", data => { downstreamBytes += data.length; relay(upstream, client, data, downstreamDelayMs); });
    for (const socket of [client, upstream]) {
      socket.on("error", () => pair.shutdown());
      socket.on("close", () => pair.shutdown());
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  return {
    port: server.address().port,
    setDownstreamDelay(ms) {
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > 500) throw new Error("Unsafe fault delay");
      downstreamDelayMs = ms;
    },
    cutConnections() { for (const pair of [...pairs]) pair.shutdown(); },
    get traffic() { return { upstreamBytes, downstreamBytes }; },
    async close() {
      for (const pair of [...pairs]) pair.shutdown();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

function peer(url, origin) {
  const ws = new WebSocket(url, { origin });
  ws.on("error", () => {});
  const received = [], listeners = new Set();
  ws.on("message", data => {
    const message = JSON.parse(data.toString());
    received.push(message);
    for (const listener of [...listeners]) listener();
  });
  return {
    ws, received, send: message => ws.send(JSON.stringify(message)),
    async opened() { await once(ws, "open"); return this; },
    until(predicate, timeoutMs = 8000) {
      const found = received.find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { listeners.delete(check); reject(new Error("Timed out waiting for proxied WebSocket message")); }, timeoutMs);
        const check = () => {
          const next = received.find(predicate);
          if (!next) return;
          clearTimeout(timer); listeners.delete(check); resolve(next);
        };
        listeners.add(check);
      });
    },
  };
}

test("real TCP delay and forced reset preserve authenticated Grand Prix race reconnect", { timeout: 20000 }, async t => {
  const app = createPartyServer({ expectedOrigin: "", partyOptions: { countdownMs: 10, raceMs: 12000, raceLaps: 99 } });
  await new Promise(resolve => app.server.listen(0, "127.0.0.1", resolve));
  const appPort = app.server.address().port;
  const proxy = await createFaultProxy(appPort);
  const peers = [];
  t.after(async () => {
    for (const p of peers) p.ws.terminate();
    await proxy.close();
    await app.close();
  });
  proxy.setDownstreamDelay(90);
  const directUrl = `ws://127.0.0.1:${appPort}/socket`;
  const directOrigin = `http://127.0.0.1:${appPort}`;
  const proxyUrl = `ws://127.0.0.1:${proxy.port}/socket`;
  const proxyOrigin = `http://127.0.0.1:${proxy.port}`;
  const openPeer = async (throughProxy = false) => {
    const p = peer(throughProxy ? proxyUrl : directUrl, throughProxy ? proxyOrigin : directOrigin);
    peers.push(p);
    return p.opened();
  };

  const host = await openPeer();
  host.send({ type: "create" });
  const room = await host.until(m => m.type === "credential");
  const delayedPhone = await openPeer(true);
  delayedPhone.send({ type: "join", code: room.code, name: "Delayed phone" });
  const credential = await delayedPhone.until(m => m.type === "credential");
  const secondPhone = await openPeer();
  secondPhone.send({ type: "join", code: room.code, name: "Second phone" });
  await secondPhone.until(m => m.type === "credential");
  const party = app.rooms.get(room.code).party;
  assert.equal(party.players.size, 2);
  host.send({ v: 1, type: "start", requestId: "tcp-fault-start", matchId: party.matchId, revision: party.revision, value: "race" });
  await host.until(m => m.type === "state" && m.state.phase === "playing");
  const before = await delayedPhone.until(m => m.type === "state" && m.state.phase === "playing");
  assert.equal(before.state.mode, "race");
  assert.ok(before.state.pack.roster.some(k => k.id === credential.actor));
  const firstFrame = await delayedPhone.until(m => m.type === "race_frame" && m.own?.number === 1);
  assert.ok(firstFrame.own && !firstFrame.karts, "controller receives only its own racing frame");
  assert.ok(proxy.traffic.upstreamBytes > 0 && proxy.traffic.downstreamBytes > 0);

  const closed = once(delayedPhone.ws, "close");
  proxy.cutConnections();
  await closed;
  const restored = await openPeer(true);
  restored.send({ type: "resume", code: room.code, actor: credential.actor, token: credential.token });
  const ready = await restored.until(m => m.type === "ready");
  assert.equal(ready.actor, credential.actor);
  const resumedState = (await restored.until(m => m.type === "state" && m.state.phase === "playing")).state;
  assert.equal(resumedState.players.length, 2);
  assert.ok(resumedState.pack.roster.some(k => k.id === credential.actor));
  assert.ok(!JSON.stringify(resumedState).includes(credential.token), "secret never leaks in state projection");
  // An authenticated reconnect must regain control, not only receive snapshots.
  restored.send({ v: 1, type: "race_input", matchId: party.matchId, heat: party.index,
    seq: 0, steer: 0.35, drift: false, item: false, assist: false });
  const resumedFrame = await restored.until(m => m.type === "race_frame" && m.own?.number === 1 && m.own.seq === 0);
  assert.ok(resumedFrame.own && !resumedFrame.karts, "reconnected controller can still steer privately");
  assert.equal(app.rooms.get(room.code).party.players.size, 2);
  assert.equal(host.ws.readyState, WebSocket.OPEN, "host connection survives one phone network loss");
  t.diagnostic(`local TCP proxy traffic: ${proxy.traffic.upstreamBytes} upstream bytes, ${proxy.traffic.downstreamBytes} downstream bytes; forced reset + credential resume verified`);
});
