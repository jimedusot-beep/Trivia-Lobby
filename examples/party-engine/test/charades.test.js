import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { CHARADES_PACKS } from "../charades.js";
function setup(category = "actions") {
  let now = 1000,
    seq = 0;
  const party = new Party("ABC234", { clock: () => now });
  const ids = ["One", "Two", "Three"].map((name) => party.join(name));
  const send = (actor, type, extra = {}) => {
    const m = {
      v: 1,
      type,
      requestId: `request-${++seq}`,
      matchId: party.matchId,
      revision: party.revision,
      ...extra,
    };
    party.handle(actor, m);
    return m;
  };
  send("host", "start", { value: "charades", category });
  now += 3000;
  party.tick();
  return {
    party,
    ids,
    send,
    advance(ms) {
      now += ms;
      party.tick();
    },
  };
}
test("only performer sees current clue; no future clues or private queue reach host/guessers", () => {
  const { party, ids } = setup();
  const own = party.view(ids[0]);
  assert.equal(own.charades.canMark, true);
  assert.ok(own.charades.clue.text);
  for (const actor of ["host", ids[1], ids[2]]) {
    const v = party.view(actor);
    assert.equal(v.charades.canMark, false);
    assert.ok(!v.charades.clue);
    assert.ok(!JSON.stringify(v).includes(own.charades.clue.id));
    assert.ok(!v.charades.history);
  }
  assert.ok(!JSON.stringify(own).includes(party.turn.queue[1].id));
});
test("correct/pass advance once, preserve deadline and do not change factual accuracy", () => {
  const { party, ids, send } = setup();
  const deadline = party.deadline;
  const clueId = party.view(ids[0]).charades.clue.id;
  const msg = send(ids[0], "mark", { value: "correct", clueId });
  party.handle(ids[0], msg);
  assert.equal(party.players.get(ids[0]).score, 1);
  assert.equal(party.players.get(ids[0]).correct, 0);
  assert.equal(party.deadline, deadline);
  assert.throws(
    () => send(ids[0], "mark", { value: "correct", clueId }),
    /no longer active/,
  );
  const nextId = party.view(ids[0]).charades.clue.id;
  assert.throws(
    () => send(ids[1], "mark", { value: "correct", clueId: nextId }),
    /performer/,
  );
  assert.throws(
    () => send("host", "mark", { value: "pass", clueId: nextId }),
    /performer/,
  );
  send(ids[0], "mark", { value: "pass", clueId: nextId });
  assert.equal(party.players.get(ids[0]).score, 1);
  assert.equal(party.turn.marks.length, 2);
});
test("deadline locks late gestures and reveals a detached complete turn history", () => {
  const { party, ids, send, advance } = setup();
  const clueId = party.view(ids[0]).charades.clue.id;
  advance(60000);
  assert.equal(party.phase, "reveal");
  assert.throws(() => send(ids[0], "mark", { value: "correct", clueId }));
  const v = party.view(ids[1]);
  assert.equal(v.charades.history[0].result, "unanswered");
  v.charades.history[0].text = "Mutated";
  assert.notEqual(party.turn.marks[0].text, "Mutated");
  assert.equal(party.players.get(ids[0]).score, 0);
});
test("every player receives one turn; exhaustion ends without looping and lobby code survives", () => {
  const { party, ids, send, advance } = setup("animals");
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(party.turn.performerId, ids[turn]);
    const seen = new Set();
    while (party.phase === "acting") {
      const clue = party.view(ids[turn]).charades.clue;
      assert.ok(!seen.has(clue.text));
      seen.add(clue.text);
      send(ids[turn], "mark", { value: "correct", clueId: clue.id });
    }
    assert.equal(seen.size, 16, "a Charades turn must end at the original 16-clue limit");
    assert.ok([...seen].every(clue => CHARADES_PACKS.animals.includes(clue)),
      "every scored clue must come from the selected private pack");
    assert.equal(party.phase, "reveal");
    assert.equal(party.players.get(ids[turn]).score, seen.size);
    send("host", "next");
    if (turn < 2) {
      assert.equal(party.phase, "countdown");
      advance(3000);
    }
  }
  assert.equal(party.phase, "finished");
  send("host", "lobby");
  assert.equal(party.code, "ABC234");
  assert.equal(party.players.size, 3);
});
test("reconnect preserves current clue; old-turn gestures and old match actions reject", () => {
  const { party, ids, send, advance } = setup();
  const clue = party.view(ids[0]).charades.clue;
  party.connected(ids[0], false);
  advance(1000);
  party.connected(ids[0], true);
  assert.deepEqual(party.view(ids[0]).charades.clue, clue);
  const old = {
    v: 1,
    type: "mark",
    requestId: "old-mark",
    matchId: party.matchId,
    revision: party.revision,
    value: "correct",
    clueId: clue.id,
  };
  advance(59000);
  send("host", "next");
  advance(3000);
  assert.throws(() => party.handle(ids[0], old), /out of date/);
  assert.equal(party.players.get(ids[0]).score, 0);
});
test("unknown packs and invented actor/score fields fail before starting or scoring", () => {
  const p = new Party("ABC234");
  ["One", "Two", "Three"].forEach((name) => p.join(name));
  const start = {
    v: 1,
    type: "start",
    requestId: "start-unknown",
    matchId: null,
    revision: 0,
    value: "charades",
    category: "__proto__",
  };
  assert.throws(() => p.handle("host", start), /pack/);
  assert.equal(p.phase, "lobby");
  const { party, ids, send } = setup();
  assert.throws(() =>
    send(ids[0], "mark", {
      value: "correct",
      clueId: party.view(ids[0]).charades.clue.id,
      score: 999,
    }),
  );
  assert.equal(party.players.get(ids[0]).score, 0);
});
