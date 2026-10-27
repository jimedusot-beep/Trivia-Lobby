import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

for (const mode of ["race", "tap", "trails"]) test(`${mode}: a valid control arriving after reveal is harmless`, async t => {
  let now = 1000;
  const instance = createPartyServer({ partyOptions: { clock: () => now, countdownMs: 1 } });
  const peers = [];
  t.after(async () => { for (const peer of peers) peer.ws.terminate(); await instance.close(); });
  await new Promise(resolve => instance.server.listen(0, "127.0.0.1", resolve));
  const port = instance.server.address().port;
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://127.0.0.1:${port}` });
    const frames = [];
    ws.on("message", raw => frames.push(JSON.parse(raw.toString())));
    await once(ws, "open");
    const peer = { ws, frames, send: frame => ws.send(JSON.stringify(frame)), async take(type) {
      const until = Date.now() + 2000;
      while (Date.now() < until) {
        const index = frames.findIndex(frame => frame.type === type);
        if (index >= 0) return frames.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      throw new Error(`Missing ${type}`);
    } };
    peers.push(peer); return peer;
  }
  const host = await connect(); host.send({ type: "create" });
  const room = await host.take("credential");
  const players = [];
  for (let i = 0; i < 2; i++) {
    const peer = await connect(); peer.send({ type: "join", code: room.code, name: `Racer ${i}` });
    await peer.take("credential"); players.push(peer);
  }
  const party = instance.rooms.get(room.code).party;
  host.send({ v: 1, type: "start", requestId: "late-control-start", matchId: null, revision: party.revision, value: mode });
  await host.take("ack"); now += 2; party.tick();
  assert.equal(party.phase, "playing");
  const input = mode === "race"
    ? { type: "race_input", steer: 0, drift: false, item: false, assist: true }
    : mode === "tap" ? { type: "tap_input" } : { type: "trails_input", turn: -1 };
  // Simulate a control already in flight when the server closes the heat.
  const packet = { v: 1, matchId: party.matchId, heat: party.index, seq: 0, ...input };
  now = party.deadline + 1; party.tick();
  assert.equal(party.phase, "reveal");
  const before = JSON.stringify(party.view("host"));
  players[0].send(packet); players[0].send({ type: "ping" });
  await players[0].take("pong");
  assert.deepEqual(players[0].frames.filter(frame => frame.type === "error"), []);
  assert.equal(JSON.stringify(party.view("host")), before, "late input cannot change scores or results");
  players[0].send({ ...packet, seq: -1 }); players[0].send({ type: "ping" });
  await players[0].take("pong");
  assert.equal(players[0].frames.filter(frame => frame.type === "error").length, 1, "malformed inputs still reject");
  host.send(packet); host.send({ type: "ping" });
  await host.take("pong");
  assert.equal(host.frames.filter(frame => frame.type === "error").length, 1, "hosts cannot drive a player's kart");
});
