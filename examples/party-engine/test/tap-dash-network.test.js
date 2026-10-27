import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
import { TAP_DURATION_MS } from "../open-pack/tap.js";

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
    origin: `http://127.0.0.1:${port}`,
  });
  const inbox = [];
  const pending = new Set();
  ws.on("message", raw => {
    const message = JSON.parse(raw.toString());
    inbox.push(message);
    for (const fn of pending) fn();
  });
  return {
    ws, send(message) { ws.send(JSON.stringify(message)); },
    wait(predicate, name = "message") {
      const match = inbox.find(predicate);
      if (match) return Promise.resolve(match);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(check); reject(new Error(`Timeout: ${name}`)); }, 6000);
        const check = () => {
          const found = inbox.find(predicate);
          if (!found) return;
          clearTimeout(timer);
          pending.delete(check);
          resolve(found);
        };
        pending.add(check);
      });
    },
  };
}

test("20 phones tap in one existing authenticated QR party and share a server-scored championship", { timeout: 25000 }, async t => {
  let now = 1000;
  const instance = createPartyServer({ partyOptions: { clock: () => now, countdownMs: 1 } });
  const peers = [];
  t.after(async () => {
    for (const peer of peers) peer.ws.terminate();
    await instance.close();
  });
  await new Promise(resolve => instance.server.listen(0, "127.0.0.1", resolve));
  const port = instance.server.address().port;
  async function connect() {
    const peer = client(port);
    peers.push(peer);
    await once(peer.ws, "open");
    return peer;
  }

  const host = await connect();
  host.send({ type: "create" });
  const room = await host.wait(m => m.type === "credential", "room and QR code");
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const joinUrl = new URL(`http://127.0.0.1:${port}/?code=${room.code}`);
  const players = [];
  for (let i = 0; i < 20; i++) {
    const peer = await connect();
    peer.send({ type: "join", code: joinUrl.searchParams.get("code"), name: `Phone ${i + 1}` });
    const credential = await peer.wait(m => m.type === "credential", "joined phone");
    players.push({ peer, credential });
  }
  const party = instance.rooms.get(room.code).party;
  assert.equal(party.players.size, 20);
  assert.equal(party.phase, "lobby");

  // A stolen/guessed actor id without its token must not take another phone's place.
  const impostor = await connect();
  impostor.send({ type: "resume", code: room.code, actor: players[0].credential.actor, token: "invalid" });
  await impostor.wait(m => m.type === "error", "reject missing credentials");

  host.send({ v: 1, type: "start", requestId: "tap-network-start", matchId: null, revision: party.revision, value: "tap" });
  await host.wait(m => m.type === "state" && m.state.phase === "countdown", "start accepted");
  now += 2;
  party.tick();
  for (const { peer } of players) {
    // First real tap also causes the server to publish the playing state.
    peer.send({ type: "tap_input", v: 1, matchId: party.matchId, heat: 0, seq: 0 });
  }
  const frame = await host.wait(m => m.type === "tap_frame" && m.racers?.length === 20 &&
    m.racers.every(player => player.taps === 1), "live 20-player host frame");
  assert.equal(frame.racers.length, 20);
  const phoneFrame = await players[1].peer.wait(m => m.type === "tap_frame" && m.own?.taps === 1, "private phone frame");
  assert.equal(Object.hasOwn(phoneFrame, "racers"), false, "Other players' input data is not sent to phones");
  assert.equal(Object.hasOwn(frame, "own"), false, "Host has no private player controller");

  // The server must resolve the clock and publish the existing shared scoreboard.
  now += TAP_DURATION_MS + 1;
  const revealed = await host.wait(m => m.type === "state" && m.state.phase === "reveal", "scored results");
  assert.equal(revealed.state.pack.results.length, 20);
  assert(revealed.state.players.every(player => player.score === 100));
  assert(revealed.state.pack.results.every(player => player.points === 100));
  assert(!JSON.stringify(revealed).includes("token"));
  assert.equal(party.phase, "reveal");
  const oldScore = party.players.get(players[0].credential.actor).score;
  party.tick();
  assert.equal(party.players.get(players[0].credential.actor).score, oldScore);
});
