import test from "node:test";
import assert from "node:assert/strict";
import { validateAction, validateHello } from "../protocol.js";
import { ParticipantSessions } from "../sessions.js";
import { DeadlineScheduler } from "../scheduler.js";
import { Party } from "../engine.js";
const matchId = "00000000-0000-4000-8000-000000000001";
const base = {
  v: 1,
  type: "answer",
  requestId: "request-123",
  matchId,
  revision: 2,
  value: 1,
};
function fakeTimers() {
  let now = 1000;
  const jobs = [];
  return {
    jobs,
    clock: () => now,
    setTimer(fn, delay) {
      const j = { fn, due: now + delay };
      jobs.push(j);
      return j;
    },
    clearTimer(j) {
      j.cancelled = true;
    },
    advance(ms) {
      now += ms;
      for (const j of [...jobs])
        if (!j.cancelled && j.due <= now) {
          j.cancelled = true;
          j.fn();
        }
    },
  };
}
test("replacing and cancelling a deadline leaves no orphan callback", () => {
  const f = fakeTimers(),
    scheduler = new DeadlineScheduler(f);
  let fired = 0;
  scheduler.schedule("A", "old", 1100, () => fired++);
  const old = f.jobs[0];
  scheduler.schedule("A", "new", 1200, () => fired++);
  assert.equal(scheduler.size, 1);
  assert.ok(old.cancelled);
  old.fn();
  assert.equal(fired, 0);
  assert.equal(scheduler.size, 1);
  const replacement = f.jobs[1];
  scheduler.cancel("A");
  replacement.fn();
  f.advance(500);
  assert.equal(fired, 0);
  assert.equal(scheduler.size, 0);
});
test("callback can replace itself; other parties and shutdown stay isolated", () => {
  const f = fakeTimers(),
    scheduler = new DeadlineScheduler(f),
    events = [];
  scheduler.schedule("A", "first", 1100, () => {
    events.push("first");
    scheduler.schedule("A", "second", 1200, () => events.push("second"));
  });
  scheduler.schedule("B", "other", 1300, () => events.push("B"));
  f.advance(100);
  assert.deepEqual(events, ["first"]);
  assert.equal(scheduler.size, 2);
  f.advance(100);
  assert.deepEqual(events, ["first", "second"]);
  assert.equal(scheduler.size, 1);
  scheduler.close();
  f.jobs.at(-1).fn();
  scheduler.schedule("C", "no", 1400, () => events.push("C"));
  f.advance(500);
  assert.deepEqual(events, ["first", "second"]);
  assert.equal(scheduler.size, 0);
});
test("unchanged deadline does not allocate duplicate wakeups", () => {
  const f = fakeTimers(),
    s = new DeadlineScheduler(f);
  const cb = () => {};
  s.schedule("A", "same", 1100, cb);
  s.schedule("A", "same", 1100, cb);
  assert.equal(f.jobs.length, 1);
  s.close();
});
test("strict contracts reject invented identities, timestamps and cross-action fields", () => {
  assert.equal(validateAction(base), base);
  for (const extra of [
    { actor: "host" },
    { timestamp: 0 },
    { promptIndex: 0 },
    { token: "secret" },
  ])
    assert.throws(() => validateAction({ ...base, ...extra }));
  for (const revision of [-1, NaN, Infinity, 1.2, "2"])
    assert.throws(() => validateAction({ ...base, revision }));
  for (const type of ["constructor", "toString", "__proto__", "unknown"])
    assert.throws(() => validateAction({ ...base, type }));
  assert.throws(() => validateHello({ type: "create", actor: "host" }));
  assert.throws(() =>
    validateHello({
      type: "resume",
      code: "ABC234",
      actor: "host",
      token: "forged",
    }),
  );
  assert.throws(() =>
    validateAction({ ...base, type: "write", value: "a", promptIndex: "0" }),
  );
});
test("only the current credentialed socket can act or mark a participant disconnected", () => {
  const sessions = new ParticipantSessions();
  const old = {
      close() {
        this.closed = true;
      },
    },
    newSocket = { close() {} };
  const token = sessions.issue("player", old);
  assert.throws(() => sessions.resume("player", "wrong", newSocket));
  assert.equal(sessions.owns("player", old), true);
  sessions.resume("player", token, newSocket);
  assert.equal(old.closed, true);
  assert.equal(sessions.owns("player", old), false);
  assert.equal(sessions.disconnect("player", old), false);
  assert.equal(sessions.owns("player", newSocket), true);
  assert.equal(
    JSON.stringify([...sessions.connections()]).includes(token),
    false,
  );
  assert.equal(sessions.disconnect("player", newSocket), true);
});
test("projections whitelist participant fields and detach mutable content", () => {
  let now = 1000;
  const p = new Party("ABC234", { clock: () => now });
  const id = p.join("Player");
  p.players.get(id).tokenHash = "NEVER_PUBLIC";
  p.players.get(id).futureSecret = "NEVER_PUBLIC";
  assert.ok(!JSON.stringify(p.view("host")).includes("NEVER_PUBLIC"));
  p.join("Two");
  p.join("Three");
  p.handle("host", {
    ...base,
    type: "start",
    value: "quiz",
    matchId: null,
    revision: 0,
  });
  now += 3000;
  p.tick();
  const v = p.view(id);
  v.question.choices[0] = "Changed by client";
  v.players[0].score = 9000;
  assert.notEqual(p.view(id).question.choices[0], "Changed by client");
  assert.equal(p.players.get(id).score, 0);
});
