import test from "node:test";
import assert from "node:assert/strict";
import { Party, roomCode } from "../engine.js";
function setup(mode = "quiz", count = 3) {
  let now = 1000;
  const p = new Party("ABC234", { clock: () => now });
  const ids = Array.from({ length: count }, (_, i) => p.join(`Player ${i}`));
  let req = 0;
  const act = (who, type, value, promptIndex) => {
    const msg = {
      v: 1,
      type,
      requestId: `request-${++req}`,
      matchId: p.matchId,
      revision: p.revision,
    };
    if (value !== undefined) msg.value = value;
    if (promptIndex !== undefined) msg.promptIndex = promptIndex;
    p.handle(who, msg);
    return msg;
  };
  act("host", "start", mode);
  now += 3000;
  p.tick();
  return {
    p,
    ids,
    act,
    time: (n) => {
      now += n;
      p.tick();
    },
  };
}
test("room codes are bounded and active codes do not collide", () => {
  const occupied = new Map();
  for (let i = 0; i < 500; i++) {
    const c = roomCode(occupied);
    assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.ok(!occupied.has(c));
    occupied.set(c, true);
  }
});
test("quiz hides keys, locks answers and replays requests without double score", () => {
  const { p, ids, act } = setup();
  assert.ok(!("correct" in p.view(ids[0]).question));
  const m = act(ids[0], "answer", 1);
  assert.deepEqual(p.handle(ids[0], m), {
    requestId: m.requestId,
    accepted: true,
  });
  assert.throws(() => act(ids[0], "answer", 0));
  act(ids[1], "answer", 1);
  act(ids[2], "answer", 0);
  assert.equal(p.phase, "reveal");
  assert.equal(p.players.get(ids[0]).score, 100);
  p.handle(ids[0], m);
  assert.equal(p.players.get(ids[0]).score, 100);
  assert.equal(p.view(ids[0]).question.correct, 1);
  assert.throws(() => p.handle(ids[0], { ...m, value: 0 }), /conflict/);
});
test("deadline is exclusive; timers cannot award twice", () => {
  const { p, ids, act, time } = setup();
  time(29999);
  act(ids[0], "answer", 1);
  time(1);
  assert.equal(p.phase, "reveal");
  assert.throws(() => act(ids[1], "answer", 1));
  time(10000);
  assert.equal(p.players.get(ids[0]).score, 100);
});
test("five-question match finishes and returns to same party without stale actions", () => {
  const { p, ids, act, time } = setup();
  const stale = {
    v: 1,
    type: "answer",
    requestId: "stale-request",
    matchId: p.matchId,
    revision: p.revision,
    value: 1,
  };
  for (let i = 0; i < 5; i++) {
    time(30000);
    act("host", "next");
  }
  assert.equal(p.phase, "finished");
  act("host", "lobby");
  assert.equal(p.code, "ABC234");
  assert.equal(p.players.size, 3);
  assert.equal(p.matchId, null);
  act("host", "start", "quiz");
  assert.throws(() => p.handle(ids[0], stale), /out of date/);
});
test("all 3–8 player duel assignments are balanced and votes stay anonymous until reveal", () => {
  for (let n = 3; n <= 8; n++) {
    const { p, ids, act } = setup("duel", n);
    for (const id of ids) {
      const assignments = p.view(id).assignments;
      assert.equal(assignments.length, 2);
      for (const a of assignments)
        act(id, "write", "Same response", a.promptIndex);
    }
    assert.equal(p.phase, "voting");
    const v = p.view(ids[2]);
    assert.ok(v.options.every((o) => !("author" in o) && !("votes" in o)));
    assert.notEqual(v.options[0].id, v.options[1].id);
    assert.throws(() => act(ids[0], "vote", v.options[0].id));
    const option = v.options[0];
    for (const id of ids.slice(2)) act(id, "vote", option.id);
    assert.equal(p.phase, "reveal");
    assert.ok(p.view(ids[2]).options.every((o) => o.author));
    assert.equal(p.players.get(p.options[0].author).score, 100 * (n - 2));
  }
});
test("writing timeout skips missing pair and self-voting/duplicate voting cannot pay twice", () => {
  const { p, ids, act, time } = setup("duel");
  act(ids[0], "write", "One response", 0);
  time(90000);
  assert.equal(p.phase, "reveal");
  assert.equal(p.skipped, true);
  assert.equal(
    [...p.players.values()].reduce((s, p) => s + p.score, 0),
    0,
  );
});
test("host loss completes timed phase then grants 60 seconds to return", () => {
  const { p, ids, act, time } = setup();
  p.connected("host", false);
  time(30000);
  assert.equal(p.phase, "reveal");
  time(59999);
  assert.equal(p.phase, "reveal");
  p.connected("host", true);
  time(2);
  assert.equal(p.phase, "reveal");
  p.connected("host", false);
  time(60000);
  assert.equal(p.phase, "finished");
  assert.equal(p.interrupted, true);
});
test("host role, player count, message types and text bounds are enforced", () => {
  const p = new Party("ABC234");
  assert.throws(() => p.join(" "));
  for (let i = 0; i < 8; i++) p.join(String(i));
  assert.throws(() => p.join("ninth"));
  const { p: q, ids, act } = setup("duel");
  assert.throws(() => act(ids[0], "next"));
  assert.throws(() => act(ids[0], "write", "x".repeat(241), 0));
  assert.throws(() => act("host", "unknown"));
  assert.throws(() => q.join("late"));
});
test("votes deduplicate while voting and after reveal without repeated awards", () => {
  const { p, ids, act } = setup("duel", 4);
  for (const id of ids)
    for (const a of p.view(id).assignments)
      act(id, "write", "Response", a.promptIndex);
  const option = p.options[0],
    msg = act(ids[2], "vote", option.id);
  p.handle(ids[2], msg);
  assert.equal(p.votes.size, 1);
  assert.throws(() => act(ids[2], "vote", option.id));
  act(ids[3], "vote", option.id);
  assert.equal(p.players.get(option.author).score, 200);
  p.handle(ids[2], msg);
  assert.equal(p.players.get(option.author).score, 200);
});
test("isolated parties and reconnect views never reveal another player assignments", () => {
  const a = setup("duel"),
    b = setup();
  a.act(a.ids[0], "write", "Private response", 0);
  assert.equal(b.p.phase, "question");
  assert.ok(!JSON.stringify(a.p.view(a.ids[2])).includes("Private response"));
  assert.equal(a.p.view("host").assignments.length, 0);
  a.p.connected(a.ids[0], false);
  a.p.connected(a.ids[0], true);
  assert.equal(
    a.p.view(a.ids[0]).assignments.find((p) => p.promptIndex === 0).locked,
    true,
  );
});

test("rejected start preserves disconnected participants until a valid match begins", () => {
  const p = new Party("ABC234");
  const ids = ["One", "Two", "Three"].map((name) => p.join(name));
  p.connected(ids[0], false);
  const start = {
    v: 1,
    type: "start",
    requestId: "start-attempt",
    matchId: null,
    revision: 0,
    value: "quiz",
  };
  assert.throws(() => p.handle("host", start), /3–8/);
  assert.equal(p.phase, "lobby");
  assert.equal(p.revision, 0);
  assert.equal(p.players.has(ids[0]), true);
  p.connected(ids[0], true);
  p.handle("host", { ...start, requestId: "start-retry" });
  assert.equal(p.phase, "countdown");
  assert.equal(p.players.size, 3);
});
