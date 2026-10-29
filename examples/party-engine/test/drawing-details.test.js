import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { DRAW_LIMITS } from "../open-pack/drawing.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
let request = 0;
function game() {
  let now = 1000;
  const p = new Party("ABC234", { clock: () => now, countdownMs: 1 });
  const ids = [p.join("Artist"), p.join("One"), p.join("Two")];
  const act = (actor, value) =>
    p.handle(actor, {
      v: 1,
      type: "play",
      requestId: `doodle-test-${++request}`,
      matchId: p.matchId,
      revision: p.revision,
      value,
    });
  p.handle("host", {
    v: 1,
    type: "start",
    requestId: `doodle-start-${++request}`,
    matchId: null,
    revision: 0,
    value: "draw",
  });
  now++;
  p.tick();
  act(ids[0], { action: "choose", index: 0 });
  return { p, ids, act, now: () => now };
}
const stroke = (part, points) => ({
  action: "stroke",
  points,
  color: "#2477db",
  width: 16,
  strokeId: "a".repeat(32),
  part,
});
test("live drawing segments preserve order and a whole gesture can be undone and redone", () => {
  const { p, ids, act } = game();
  act(
    ids[0],
    stroke(0, [
      [0, 0],
      [10, 10],
    ]),
  );
  act(
    ids[0],
    stroke(1, [
      [10, 10],
      [20, 20],
    ]),
  );
  assert.equal(p.view(ids[1]).pack.strokes.length, 2);
  assert.equal(p.pack.pointCount, 4);
  assert.throws(
    () =>
      act(
        ids[0],
        stroke(1, [
          [20, 20],
          [30, 30],
        ]),
      ),
    /order/,
  );
  assert.throws(
    () =>
      act(
        ids[0],
        stroke(2, [
          [40, 40],
          [50, 50],
        ]),
      ),
    /order/,
  );
  assert.throws(
    () =>
      act(ids[0], {
        ...stroke(2, [
          [20, 20],
          [30, 30],
        ]),
        color: "#ffffff",
      }),
    /order/,
  );
  act(ids[0], { action: "undo" });
  assert.equal(p.pack.strokes.length, 0);
  assert.equal(p.pack.pointCount, 0);
  assert.equal(p.view(ids[0]).pack.canRedo, true);
  act(ids[0], { action: "redo" });
  assert.equal(p.pack.strokes.length, 2);
  assert.equal(p.pack.pointCount, 4);
  assert.throws(() => act(ids[1], { action: "undo" }), /artist/);
  act(ids[0], { action: "clear" });
  assert.equal(p.pack.pointCount, 0);
  assert.equal(p.view(ids[0]).pack.canRedo, false);
});
test("new ink clears redo; private words stay hidden after a correct guess until reveal", () => {
  const { p, ids, act } = game();
  act(
    ids[0],
    stroke(0, [
      [0, 0],
      [10, 10],
    ]),
  );
  act(ids[0], { action: "undo" });
  act(ids[0], {
    action: "stroke",
    points: [
      [1, 1],
      [2, 2],
    ],
    color: "#ffffff",
    width: 24,
  });
  assert.equal(p.view(ids[0]).pack.canRedo, false);
  act(ids[1], { action: "guess", text: p.pack.word });
  const v = p.view(ids[1]).pack;
  assert.equal(v.hasGuessed, true);
  assert.equal(v.canGuess, false);
  assert.equal(v.word, undefined);
  assert(!JSON.stringify(p.view("host").pack).includes(p.pack.word));
  const points = p.players.get(ids[1]).score;
  assert.throws(
    () => act(ids[1], { action: "guess", text: p.pack.word }),
    /cannot guess/,
  );
  assert.equal(p.players.get(ids[1]).score, points);
});
test("drawing history stays bounded and malformed or stale grouped segments cannot corrupt it", () => {
  const { p, ids, act } = game();
  for (const bad of ["x", "a".repeat(33), 4])
    assert.throws(
      () =>
        act(ids[0], {
          ...stroke(0, [
            [0, 0],
            [1, 1],
          ]),
          strokeId: bad,
        }),
      /sequence/,
    );
  assert.throws(
    () =>
      act(
        ids[0],
        stroke(1, [
          [0, 0],
          [1, 1],
        ]),
      ),
    /order/,
  );
  const points = Array.from({ length: 64 }, (_, i) => [i, i]);
  for (let i = 0; i < 37; i++)
    act(ids[0], { action: "stroke", points, color: "#20264b", width: 8 });
  assert.equal(p.pack.pointCount, 2368);
  assert.throws(
    () => act(ids[0], { action: "stroke", points, color: "#20264b", width: 8 }),
    /Canvas is full/,
  );
  assert.equal(p.view(ids[0]).pack.remainingPoints, DRAW_LIMITS.points - 2368);
  assert(Buffer.byteLength(JSON.stringify(p.view("host"))) < 65536);
});
test("drawing undo/redo, gesture groups and solved status survive JSON checkpoint recovery", () => {
  const { p, ids, act, now } = game();
  act(
    ids[0],
    stroke(0, [
      [0, 0],
      [10, 10],
    ]),
  );
  act(
    ids[0],
    stroke(1, [
      [10, 10],
      [20, 20],
    ]),
  );
  act(ids[1], { action: "guess", text: p.pack.word });
  act(ids[0], { action: "undo" });
  const r = restoreParty(
    p.code,
    JSON.parse(JSON.stringify(snapshotParty(p))),
    { clock: now },
    now(),
  );
  assert.equal(r.view(ids[1]).pack.hasGuessed, true);
  assert.equal(r.view(ids[0]).pack.canRedo, true);
  r.connected("host", true);
  r.connected(ids[0], true);
  r.handle(ids[0], {
    v: 1,
    type: "play",
    requestId: "recovered-redo-1",
    matchId: r.matchId,
    revision: r.revision,
    value: { action: "redo" },
  });
  assert.equal(r.pack.strokes.length, 2);
  assert.equal(r.pack.pointCount, 4);
  assert.equal(r.view("host").pack.word, undefined);
});
test("artists get different chosen words across the match and everyone receives a turn", () => {
  const { p, ids, act } = game();
  const used = new Set();
  for (let turn = 0; turn < ids.length; turn++) {
    if (turn) {
      assert(p.pack.choices.every((word) => !used.has(word)));
      act(ids[turn], { action: "choose", index: 0 });
    }
    assert(!used.has(p.pack.word));
    used.add(p.pack.word);
    for (const id of ids.filter((id) => id !== ids[turn]))
      act(id, { action: "guess", text: p.pack.word });
    assert.equal(p.phase, "reveal");
    p.handle("host", {
      v: 1,
      type: "next",
      requestId: `doodle-next-${++request}`,
      matchId: p.matchId,
      revision: p.revision,
    });
  }
  assert.equal(p.phase, "finished");
  assert.equal(used.size, ids.length);
});
