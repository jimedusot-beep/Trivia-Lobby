import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { acceptRaceInput } from "../open-pack/race.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";

let number = 0;
function action(p, actor, type, value) {
  return p.handle(actor, { v: 1, type, requestId: "durable-race-" + ++number,
    matchId: p.matchId, revision: p.revision, ...(value === undefined ? {} : { value }) });
}
function game(mode, guests = 4) {
  let now = 1000;
  const options = { clock: () => now, countdownMs: 1, raceMs: 5000, raceLaps: 99 };
  const p = new Party("ABCD23", options);
  const players = Array.from({ length: guests }, (_, i) => p.join("Player " + (i + 1)));
  action(p, "host", "start", mode);
  now++; p.tick();
  return { p, players, options, jump: ms => { now += ms; },
    restore: target => restoreParty(p.code, snapshotParty(target || p), options, now) };
}

test("Grand Prix checkpoint retains twenty karts, heat identity and reconnectable input", () => {
  const g = game("race", 20);
  assert.equal(g.p.phase, "playing");
  const id = g.players[0];
  acceptRaceInput(g.p, id, { v: 1, type: "race_input", matchId: g.p.matchId,
    heat: g.p.index, seq: 90, steer: 0.4, drift: true, item: false, assist: true });
  g.jump(450); g.p.tick();
  const before = g.p.pack.karts.find(k => k.id === id), frames = g.p.pack.frame;
  const r = g.restore();
  assert.equal(r.phase, "playing");
  assert.equal(r.pack.karts.length, 20);
  assert.equal(r.pack.frame, frames);
  assert.equal(r.pack.karts.find(k => k.id === id).checkpoint, before.checkpoint);
  assert.equal(r.pack.karts.find(k => k.id === id).seq, 90);
  assert.equal(r.players.get(id).connected, false);
  assert.equal(r.hostConnected, false);
  r.connected(id, true);
  assert.equal(r.pack.karts.find(k => k.id === id).seq, -1);
  assert.equal(acceptRaceInput(r, id, { v: 1, type: "race_input", matchId: r.matchId,
    heat: r.index, seq: 0, steer: 0, drift: false, item: false, assist: true }), true);
  assert.throws(() => acceptRaceInput(r, id, { v: 1, type: "race_input", matchId: r.matchId,
    heat: r.index + 1, seq: 1, steer: 0, drift: false, item: false, assist: true }), /old race/);
  g.jump(6000); r.tick();
  assert.equal(r.phase, "reveal");
  const scores = [...r.players.values()].map(p => p.score);
  r.tick();
  assert.deepEqual([...r.players.values()].map(p => p.score), scores);
  assert.equal(r.pack.results.length, 20);
  action(r, "host", "next"); g.jump(1); r.tick();
  assert.equal(r.index, 1);
  assert.equal(r.phase, "playing");
  assert.equal(g.restore(r).players.size, 20);
});

test("restart rehydrates live open-pack games and preserves private host projections", () => {
  for (const mode of ["feud", "draw", "colors", "chess", "four", "table"]) {
    const g = game(mode);
    assert.equal(g.p.phase, "playing", mode);
    assert.ok(g.p.pack, mode);
    const r = g.restore();
    assert.equal(r.mode, mode);
    assert.equal(r.phase, g.p.phase);
    assert.deepEqual(snapshotParty(r).pack, snapshotParty(g.p).pack, mode);
    assert.equal(r.players.size, g.players.length);
    assert.ok(r.view("host").pack, "host projection: " + mode);
  }
});

test("missing active pack checkpoint is rejected rather than resetting a match", () => {
  const g = game("race", 2), state = snapshotParty(g.p);
  delete state.pack;
  assert.throws(() => restoreParty(g.p.code, state, g.options, 1000), /Unsupported room recovery state/);
});

test("Chess restart replays legal moves and preserves the live engine and board geometry", () => {
  const g = game("chess", 2);
  const table = g.p.pack.tables[0];
  const first = table.players[0];
  const initialFen = table.game.chess.fen();
  action(g.p, first, "play", { action: "move", table: 0, from: 52, to: 36 });
  const original = table.game.chess.fen();
  assert.notEqual(original, initialFen);
  const r = g.restore();
  const recovered = r.pack.tables[0].game.chess;
  assert.equal(typeof recovered.board, "function");
  assert.equal(recovered.fen(), original);
  assert.deepEqual(recovered.history(), table.game.chess.history());
  assert.ok(r.view("host").pack.tables[0].legal.length);
});
