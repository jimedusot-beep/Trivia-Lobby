import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { acceptTapInput, tapFrame, TAP_DURATION_MS, TAP_HEATS } from "../open-pack/tap.js";

function makeTapParty(size = 2) {
  let now = 1000;
  const party = new Party("ABCDEF", { clock: () => now, countdownMs: 1 });
  const actors = Array.from({ length: size }, (_, i) => party.join(`Player ${i + 1}`));
  party.handle("host", { v: 1, type: "start", requestId: "start-tap-game", matchId: null, revision: 0, value: "tap" });
  now += 2;
  party.tick();
  assert.equal(party.phase, "playing");
  const step = ms => { now += ms; };
  const tap = (actor, seq, overrides = {}) => acceptTapInput(party, actor, {
    v: 1, type: "tap_input", matchId: party.matchId, heat: party.index, seq, ...overrides,
  });
  return { party, actors, tap, step };
}

test("20 registered phone players share the original QR room and own score projections", () => {
  const { party, actors, tap, step } = makeTapParty(20);
  assert.equal(party.players.size, 20);
  assert.equal(party.roster.length, 20);
  assert.equal(party.mode, "tap");
  assert.equal(party.pack.kind, "tap");
  assert.equal(TAP_HEATS, 3);
  assert.equal(TAP_DURATION_MS, 12000);
  for (const actor of actors) tap(actor, 0);
  assert.equal(tapFrame(party, "host").racers.length, 20);
  const own = party.view(actors[0]).pack;
  assert.equal(own.own.taps, 1);
  assert.equal(Object.hasOwn(own, "racers"), false, "phone must not receive other controller details");
  assert.equal(Object.hasOwn(party.view("host").pack, "own"), false);
  step(12001); party.tick();
  assert.equal(party.phase, "reveal");
  assert.equal(party.pack.results.length, 20);
  assert(party.pack.results.every(item => item.taps === 1 && item.points === 100 && item.place === 1));
  assert(party.view("host").players.every(p => p.score === 100));
  party.tick(); // End-of-heat scoring must be idempotent.
  assert(party.view("host").players.every(p => p.score === 100));
});

test("tap input rejects forgery, old heats, unrealistic volume, host actions and replay", () => {
  const { party, actors, tap, step } = makeTapParty();
  assert.equal(tap(actors[0], 0), true);
  assert.equal(tap(actors[0], 0), false, "Duplicate seq cannot score again");
  assert.equal(tap(actors[0], 1), false, "Rapid repeat is not a valid tap");
  step(76);
  assert.equal(tap(actors[0], 2), true);
  assert.equal(party.pack.racers[0].taps, 2);
  assert.throws(() => tap("host", 0), /connected player/);
  assert.throws(() => tap("not-a-room-member", 0), /connected player/);
  assert.throws(() => tap(actors[0], 3, { heat: 99 }), /expired/);
  assert.throws(() => tap(actors[0], 3, { seq: -1 }), /Invalid tap/);
  assert.throws(() => tap(actors[0], 3, { forgedPlayerId: actors[1] }), /Invalid tap/);
  assert.throws(() => tap(actors[0], 3, { matchId: "other-game" }), /expired/);
  party.connected(actors[0], false);
  assert.throws(() => tap(actors[0], 3), /connected player/);
  party.connected(actors[0], true);
  step(TAP_DURATION_MS);
  party.tick();
  assert.equal(party.phase, "reveal");
  const results = JSON.stringify(party.view("host"));
  assert.equal(tap(actors[0], 4), false, "valid in-flight taps are harmless during reveal");
  assert.equal(JSON.stringify(party.view("host")), results);
});

test("zero taps receive zero points; tied positive counts share place and championship awards", () => {
  const { party, actors, step, tap } = makeTapParty(3);
  tap(actors[0], 0);
  tap(actors[1], 0);
  step(TAP_DURATION_MS + 1);
  party.tick();
  assert.deepEqual(party.pack.results.map(item => item.points), [100, 100, 0]);
  assert.deepEqual(party.pack.results.map(item => item.place), [1, 1, 3]);
  assert.equal(party.players.get(actors[2]).score, 0);
  party.handle("host", { v: 1, type: "next", requestId: "heat-next-1", matchId: party.matchId, revision: party.revision });
  assert.equal(party.phase, "countdown");
  step(2); party.tick();
  assert.equal(party.phase, "playing");
  assert.equal(party.index, 1);
  assert.equal(party.pack.racers.every(racer => racer.taps === 0), true);
  assert.equal(party.players.get(actors[0]).score, 100, "Previous heat points persist");
});
