import test from "node:test";
import assert from "node:assert/strict";
import { calculateReview, restoreCard, normalizedPrompt } from "./study-scheduler";

const start = new Date("2026-10-01T15:00:00.000Z");
test("FSRS is deterministic and keeps due dates across JSON serialization", () => {
  const first = calculateReview(null, 3, start);
  const replay = calculateReview(null, 3, start);
  assert.deepEqual(first.after, replay.after);
  assert.ok(first.after.due.getTime() > start.getTime());
  const afterReload = restoreCard(JSON.parse(JSON.stringify(first.after)), start);
  assert.deepEqual(afterReload, first.after);
  const secondDate = new Date(first.after.due);
  const second = calculateReview(JSON.parse(JSON.stringify(first.after)), 1, secondDate);
  assert.equal(second.after.reps, first.after.reps + 1);
  assert.ok(second.after.due.getTime() > secondDate.getTime());
});

test("different ratings produce different scheduling outcomes", () => {
  const again = calculateReview(null, 1, start);
  const easy = calculateReview(null, 4, start);
  assert.notEqual(again.after.due.toISOString(), easy.after.due.toISOString());
  assert.ok(again.after.due.getTime() < easy.after.due.getTime());
});

test("invalid timestamps, snapshots and ratings are rejected", () => {
  assert.throws(() => calculateReview(null, 0 as never, start), /Invalid review/);
  assert.throws(() => restoreCard({ due: "not-a-date" }, start), /Corrupt review/);
  const first = calculateReview(null, 3, start);
  assert.throws(() => calculateReview(first.after, 3, new Date("2020-01-01")), /backwards/);
});

test("duplicate prompts collapse normalized whitespace and unicode", () => {
  assert.equal(normalizedPrompt("  What  is   DNA? "), normalizedPrompt("What is DNA?"));
  assert.equal(normalizedPrompt("ＦＳＲＳ"), normalizedPrompt("FSRS"));
});
