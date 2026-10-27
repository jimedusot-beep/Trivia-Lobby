import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { acceptRaceInput, raceFrame, RACE_STEP_MS } from "../open-pack/race.js";
let request = 0;
function fixture(count = 20, options = {}) {
  let now = 1000;
  const p = new Party("ABCD23", { clock: () => now, countdownMs: 1, ...options });
  const ids = Array.from({ length: count }, (_, i) => p.join(`Driver ${i + 1}`));
  const action = (type, value) => p.handle("host", { v: 1, type, requestId: `race-test-${++request}`,
    matchId: p.matchId, revision: p.revision, ...(value === undefined ? {} : { value }) });
  action("start", "race"); now++; p.tick();
  const advance = ms => { for (let left = ms; left > 0; left -= RACE_STEP_MS) { now += Math.min(RACE_STEP_MS, left); p.tick(); } };
  const input = (id, seq, extra = {}) => acceptRaceInput(p, id, { v: 1, type: "race_input", matchId: p.matchId, heat: p.index,
    seq, steer: 0, drift: false, item: false, assist: true, ...extra });
  return { p, ids, action, advance, input, jump: ms => { now += ms; p.tick(); } };
}

test("20 real roster seats finish three authoritative heats with bounded, once-only championship scores", () => {
  const g = fixture();
  for (let heat = 0; heat < 3; heat++) {
    assert.equal(g.p.pack.karts.length, 20);
    g.advance(60000);
    assert.equal(g.p.phase, "reveal");
    const results = g.p.view("host").pack.results;
    assert.equal(results.length, 20);
    assert.ok(results.every(r => r.points >= 5 && r.points <= 100));
    assert.ok(results.filter(r => r.finished).length >= 16, "computer takeover should complete laps for most of a full grid");
    const scores = [...g.p.players.values()].map(p => p.score);
    g.advance(1000);
    assert.deepEqual([...g.p.players.values()].map(p => p.score), scores);
    g.action("next");
    if (heat < 2) g.advance(1);
  }
  assert.equal(g.p.phase, "finished");
  assert.ok([...g.p.players.values()].every(p => p.score >= 15 && p.score <= 300));
  g.action("lobby");
  assert.equal(g.p.phase, "lobby");
  assert.equal(g.p.players.size, 20);
  g.action("start", "bingo");
  assert.equal(g.p.mode, "bingo");
});

test("only bounded current-heat controls are accepted; inputs cannot supply a position, identity or score", () => {
  const g = fixture(2), id = g.ids[0], revision = g.p.revision;
  assert.equal(g.input(id, 0), true);
  assert.equal(g.input(id, 0, { item: true }), false);
  assert.equal(g.p.revision, revision);
  for (const patch of [{ x: 100 }, { actor: g.ids[1] }, { score: 10000 }, { steer: NaN }, { steer: Infinity },
    { steer: 2 }, { drift: "yes" }, { assist: 1 }, { seq: -1 }, { seq: 2 ** 40 }, { heat: 1 }, { matchId: null }])
    assert.throws(() => g.input(id, 1, patch));
  assert.throws(() => g.input("host", 1), /racer/);
  assert.throws(() => g.input("not-a-player", 1), /racer/);
  assert.equal(g.p.players.get(id).score, 0);
  g.advance(60000);
  assert.throws(() => g.input(id, 2), /old race/);
});

test("phone frames contain only that controller's driving state; TV frames contain public positions", () => {
  const g = fixture(), v = g.p.view(g.ids[7]);
  assert.equal(v.pack.own.number, 8);
  assert.equal(v.pack.karts, undefined);
  assert.equal(v.pack.own.item, null);
  const f = raceFrame(g.p, g.ids[7]);
  assert.equal(f.own.number, 8);
  assert.equal(f.karts, undefined);
  assert.equal(f.roster, undefined);
  const host = raceFrame(g.p, "host");
  assert.equal(host.karts.length, 20);
  assert.equal(host.own, undefined);
  assert.doesNotMatch(JSON.stringify([v, f, host]), /token|password|inputAt|checkpoint|"input"/i);
  assert.ok(JSON.stringify(f).length < 512);
  assert.ok(JSON.stringify(host).length < 6000);
});

test("holding and releasing drift earns a boost; item press is consumed once", () => {
  const g = fixture(2), id = g.ids[0];
  let seq = 0;
  for (let i = 0; i < 100; i++) { g.input(id, seq++, { drift: true }); g.advance(50); }
  const k = g.p.pack.karts.find(k => k.id === id);
  assert.ok(k.stage >= 1, "a held cornering drift should charge");
  g.input(id, seq++, { drift: false }); g.advance(50);
  assert.ok(k.boost > 0);
  k.item = "shield";
  g.input(id, seq++, { item: true }); g.advance(50);
  assert.equal(k.item, null);
  assert.ok(k.shield > 4.9);
  k.item = "dash";
  g.input(id, seq++, { item: true }); g.advance(50);
  assert.equal(k.item, "dash", "holding cannot repeatedly activate a newly collected item");
  g.input(id, seq++, { item: false }); g.advance(50);
  g.input(id, seq++, { item: true }); g.advance(50);
  assert.equal(k.item, null);
  k.item = "shield";
  g.input(id, seq++, { item: false });
  g.input(id, seq++, { item: true });
  g.input(id, seq++, { item: false });
  g.advance(50);
  assert.ok(k.shield > 4.99, "a short tap between simulation ticks activates its shield even if a nearby box then refills the item slot");
});

test("disconnect takeover keeps progress; credential resume reclaims the same kart with fresh input sequence", () => {
  const g = fixture(2), id = g.ids[0], k = g.p.pack.karts[0];
  g.input(id, 400, { assist: false }); g.advance(500);
  const before = k.progress;
  g.p.connected(id, false); g.advance(3000);
  assert.ok(k.progress > before);
  assert.equal(k.assisting, true);
  assert.throws(() => g.input(id, 401), /connected/);
  const progress = k.progress;
  g.p.connected(id, true);
  g.input(id, 0, { assist: false, steer: -0.5 }); g.advance(50);
  assert.equal(k.seq, 0);
  assert.equal(k.assisting, false);
  assert.ok(Math.abs(k.progress - progress) < 0.03);
  assert.equal(g.p.pack.karts.filter(k => k.id === id).length, 1);
});

test("process stalls do not simulate an unbounded catch-up or award an extra heat", () => {
  const g = fixture(2), before = g.p.pack.karts[0].progress;
  g.jump(20000);
  assert.ok(g.p.pack.karts[0].progress - before < 0.03);
  assert.equal(g.p.pack.frame, 5);
  g.jump(60000);
  assert.equal(g.p.phase, "reveal");
  assert.equal(g.p.pack.results.length, 2);
});

