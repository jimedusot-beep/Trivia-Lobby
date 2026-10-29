import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
let sequence = 0;
function game(count = 4) {
  let now = 1000;
  const options = { clock: () => now, countdownMs: 1 },
    p = new Party("FAMILY", options);
  const ids = Array.from({ length: count }, (_, i) => p.join(`Guest ${i + 1}`));
  const message = (type, value) => ({
    v: 1,
    type,
    requestId: `feud-guidance-${++sequence}`,
    matchId: p.matchId,
    revision: p.revision,
    ...(value === undefined ? {} : { value }),
  });
  const act = (actor, value) => p.handle(actor, message("play", value));
  p.handle("host", message("start", "feud"));
  now++;
  p.tick();
  return {
    p,
    ids,
    options,
    act,
    message,
    next: () => p.handle("host", message("next")),
    advance: (ms) => {
      now += ms;
      p.tick();
    },
    restore: () =>
      restoreParty(
        p.code,
        JSON.parse(JSON.stringify(snapshotParty(p))),
        options,
        now,
      ),
  };
}
function boards(g) {
  for (let round = 0; round < 3; round++) {
    g.act(g.ids[0], { action: "buzz" });
    for (let index = 0; index < 5; index++)
      g.act("host", { action: "judge", index });
    g.next();
  }
}
function final(
  g,
  first = ["Banana", "Flying animal", "Breakfast juice", "Swing", "Zebra"],
  second = ["Lemon", "Airplane", "Milk", "Slide", "Tiger"],
) {
  boards(g);
  g.act("host", { action: "final-start" });
  for (const text of first) g.act(g.ids[0], { action: "final-answer", text });
  g.act("host", { action: "final-start" });
  for (const text of second)
    g.act(g.ids[2] ?? g.ids[0], { action: "final-answer", text });
}
test("phone answers enforce buzzer/team ownership and auto-reveal normalized exact matches", () => {
  const g = game(),
    { p, ids, act } = g;
  assert.equal(p.view(ids[0]).pack.myTeam, 0);
  assert.equal(p.view(ids[1]).pack.myTeam, 1);
  assert.throws(
    () => act(ids[0], { action: "answer", text: "Sandwiches" }),
    /turn/,
  );
  act(ids[0], { action: "buzz" });
  assert.equal(p.view(ids[2]).pack.canSubmit, false);
  assert.throws(
    () => act(ids[2], { action: "answer", text: "Sandwiches" }),
    /turn/,
  );
  act(ids[0], { action: "answer", text: "  SANDWICHES!  " });
  assert.equal(p.pack.team, 0);
  assert.equal(p.pack.pot, 35);
  assert.equal(p.view(ids[2]).pack.canSubmit, true);
  assert.equal(p.view(ids[1]).pack.canSubmit, false);
  assert.throws(
    () => act(ids[1], { action: "answer", text: "Blanket" }),
    /turn/,
  );
  assert.throws(
    () => act(ids[2], { action: "answer", text: "Blanket", points: 1000 }),
    /fields/,
  );
  act(ids[2], { action: "answer", text: "Blanket" });
  assert.equal(p.pack.pot, 60);
});
test("unlisted wording stays private to its sender/host and locks one pending response", () => {
  const g = game(6),
    { p, ids, act } = g;
  act(ids[0], { action: "buzz" });
  act(ids[0], { action: "answer", text: "packed lunches" });
  assert.equal(p.view("host").pack.submittedAnswer.text, "packed lunches");
  assert.equal(p.view(ids[0]).pack.submittedAnswer.text, "packed lunches");
  for (const id of ids.slice(1)) {
    const view = p.view(id).pack;
    assert.equal(view.submittedAnswer, undefined);
    assert.equal(view.waitingForHost, true);
    assert.equal(view.canSubmit, false);
    assert(!JSON.stringify(view).includes("packed lunches"));
  }
  assert.throws(
    () => act(ids[0], { action: "answer", text: "Water" }),
    /decision/,
  );
  assert.throws(() => act(ids[0], { action: "judge", index: 0 }), /host/);
  const r = g.restore();
  assert.equal(r.view("host").pack.submittedAnswer.text, "packed lunches");
  assert.equal(r.view(ids[1]).pack.submittedAnswer, undefined);
  act("host", { action: "judge", index: 0 });
  assert.equal(p.pack.pot, 35);
  assert.equal(p.pack.pendingAnswer, null);
});
test("rejected judging/pass actions preserve a pending answer and host can accept alternate wording", () => {
  const { p, ids, act } = game();
  act(ids[0], { action: "buzz" });
  act(ids[0], { action: "answer", text: "Sandwiches" });
  act(ids[2], { action: "answer", text: "picnic rug" });
  const before = structuredClone(p.pack),
    revision = p.revision;
  assert.throws(
    () => act("host", { action: "judge", index: 0 }),
    /already revealed/,
  );
  assert.throws(() => act("host", { action: "pass" }), /immediately/);
  assert.deepEqual(p.pack, before);
  assert.equal(p.revision, revision);
  act("host", { action: "judge", index: 1 });
  assert.equal(p.pack.pot, 60);
  assert.equal(p.pack.pendingAnswer, null);
});
test("pass, three strikes and typed steal route the right team and award the pot once", () => {
  const g = game(),
    { p, ids, act } = g;
  act(ids[0], { action: "buzz" });
  act(ids[0], { action: "answer", text: "Sandwiches" });
  act("host", { action: "pass" });
  assert.equal(p.pack.team, 1);
  assert.equal(p.view(ids[0]).pack.canSubmit, false);
  for (let n = 0; n < 3; n++) act("host", { action: "judge", index: -1 });
  assert.equal(p.pack.stage, "steal");
  assert.equal(p.view(ids[0]).pack.canSubmit, true);
  assert.equal(p.view(ids[1]).pack.canSubmit, false);
  const msg = g.message("play", { action: "answer", text: "Water" });
  p.handle(ids[0], msg);
  p.handle(ids[0], msg);
  assert.equal(p.phase, "reveal");
  assert.equal(p.view(ids[0]).pack.paidTo, 0);
  assert.equal(p.pack.teamScores[0], 55);
  assert.equal(p.players.get(ids[2]).score, 55);
  assert.throws(
    () => act(ids[0], { action: "answer", text: "Fruit" }),
    /not accepting/,
  );
  assert.equal(p.pack.teamScores[0], 55);
});
test("pending-answer timeouts clear faceoff/control/steal waits without hanging a round", () => {
  const g = game(),
    { p, ids, act, advance } = g;
  act(ids[0], { action: "buzz" });
  act(ids[0], { action: "answer", text: "unlisted" });
  advance(20000);
  assert.equal(p.pack.team, 1);
  assert.equal(p.pack.pendingAnswer, null);
  act(ids[1], { action: "answer", text: "unlisted" });
  advance(20000);
  assert.equal(p.pack.strikes, 1);
  act(ids[1], { action: "answer", text: "Water" });
  for (let n = 0; n < 2; n++) act("host", { action: "judge", index: -1 });
  act(ids[0], { action: "answer", text: "unlisted" });
  advance(20000);
  assert.equal(p.phase, "reveal");
  assert.equal(p.pack.teamScores[1], 20);
  assert.equal(p.pack.pendingAnswer, null);
  g.next();
  assert.equal(p.pack.stage, "buzz");
  assert.equal(p.pack.lastDecision, null);
  assert.equal(p.pack.strikes, 0);
});
test("a silent buzzer round reveals the board with no fabricated winner or payout", () => {
  const g = game();
  g.advance(45000);
  assert.equal(g.p.phase, "reveal");
  assert.equal(g.p.view(g.ids[0]).pack.paidTo, null);
  assert.deepEqual(g.p.pack.teamScores, [0, 0]);
});
test("lightning review fixes alternate wording, prevents duplicate credits and publishes privately once", () => {
  const g = game(),
    { p, ids, act } = g;
  final(g);
  assert.equal(p.pack.stage, "final-review");
  assert.equal(p.deadline, null);
  for (const id of ids) {
    const view = p.view(id).pack;
    assert.equal(view.finalReview, undefined);
    assert.equal(view.finalAnswers, undefined);
    assert(!JSON.stringify(view).includes("Breakfast juice"));
  }
  assert.equal(
    p.view("host").pack.finalReview[2].responses[0].text,
    "Breakfast juice",
  );
  const hostView = p.view("host");
  hostView.pack.finalReview[0].choices[0].points = 999;
  assert.equal(p.show.final[0].answers[0].points, 40);
  assert.throws(
    () =>
      act(ids[0], { action: "final-judge", question: 1, player: 0, index: 0 }),
    /host/,
  );
  assert.throws(() => act(ids[0], { action: "final-publish" }), /host/);
  assert.throws(
    () =>
      act("host", { action: "final-judge", question: 0, player: 1, index: 0 }),
    /already credited/,
  );
  assert.throws(
    () =>
      act("host", { action: "final-judge", question: 99, player: 0, index: 0 }),
    /Choose/,
  );
  act("host", { action: "final-judge", question: 1, player: 0, index: 0 });
  act("host", { action: "final-judge", question: 2, player: 0, index: 0 });
  const recovered = g.restore();
  assert.equal(recovered.pack.stage, "final-review");
  assert.equal(
    recovered.view("host").pack.finalReview[2].responses[0].points,
    40,
  );
  assert.equal(recovered.view(ids[1]).pack.finalReview, undefined);
  act("host", { action: "final-publish" });
  assert.equal(p.phase, "reveal");
  assert.equal(p.pack.finalTotal, 350);
  assert.equal(p.players.get(ids[0]).score, 600);
  g.next();
  assert.equal(p.phase, "finished");
  assert.equal(p.players.get(ids[0]).score, 950);
  assert.throws(() => g.next(), /after reveal/);
  assert.equal(p.players.get(ids[0]).score, 950);
});
test("final timers cover each whole run; passed/time-filled questions cannot be awarded", () => {
  const g = game(),
    { p, ids, act, advance } = g;
  boards(g);
  act("host", { action: "final-start" });
  const deadline = p.deadline;
  act(ids[0], { action: "final-pass" });
  assert.equal(p.deadline, deadline);
  advance(20000);
  assert.equal(p.pack.stage, "final-ready");
  act("host", { action: "final-start" });
  advance(25000);
  assert.equal(p.pack.stage, "final-review");
  assert.throws(
    () =>
      act("host", { action: "final-judge", question: 0, player: 0, index: 0 }),
    /cannot earn/,
  );
  act("host", { action: "final-publish" });
  assert.equal(p.pack.finalTotal, 0);
  g.next();
  assert.equal(p.phase, "finished");
});
test("two guests get a documented solo-team final and previous-run answers cannot score twice", () => {
  const g = game(2),
    { p, ids, act } = g;
  boards(g);
  assert.equal(p.view(ids[0]).pack.soloFinalist, true);
  act("host", { action: "final-start" });
  for (const text of ["Banana", "Bird", "Orange juice", "Swing", "Zebra"])
    act(ids[0], { action: "final-answer", text });
  act("host", { action: "final-start" });
  assert.throws(
    () => act(ids[0], { action: "final-answer", text: "Banana!" }),
    /used/,
  );
  for (const text of ["Lemon", "Airplane", "Milk", "Slide", "Tiger"])
    act(ids[0], { action: "final-answer", text });
  act("host", { action: "final-publish" });
  assert.equal(p.pack.finalTotal, 350);
});
test("old spoken-answer checkpoints retain their original final sequence", () => {
  const g = game(),
    { p, ids, act } = g;
  delete p.pack.guided;
  delete p.pack.pendingAnswer;
  delete p.pack.lastDecision;
  const restored = g.restore();
  assert.equal(restored.view(ids[0]).pack.guided, false);
  assert.throws(
    () => act(ids[0], { action: "answer", text: "Sandwiches" }),
    /turn/,
  );
  final(g, ["Banana", "Bird", "Orange juice", "Swing", "Zebra"]);
  assert.equal(p.pack.stage, "final-reveal");
  assert.equal(p.phase, "reveal");
  assert.equal(p.pack.finalTotal, 350);
});
