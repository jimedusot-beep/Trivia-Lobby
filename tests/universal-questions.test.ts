import assert from "node:assert/strict";
import test from "node:test";
import { legacyCardToQuestion, universalQuestionSchema } from "../shared/universal-questions";

test("legacy flashcard converts to text question", () => {
  const result = legacyCardToQuestion({ id: 1, front: "Capital?", back: "Paris", type: "flashcard", options: null, correctOption: null });
  assert.equal(result.answer.kind, "text");
  if (result.answer.kind === "text") assert.deepEqual(result.answer.acceptedAnswers, ["Paris"]);
});
test("legacy multiple-choice converts option IDs", () => {
  const result = legacyCardToQuestion({ id: 2, front: "Pick B", back: "Explanation", type: "multiple_choice", options: ["A choice", "B choice"], correctOption: "B" });
  assert.equal(result.answer.kind, "multiple_choice");
  if (result.answer.kind === "multiple_choice") assert.deepEqual(result.answer.correctOptionIds, ["B"]);
});
test("invalid legacy answer index is rejected", () => {
  assert.throws(() => legacyCardToQuestion({ id: 3, front: "Q", back: "A", type: "multiple_choice", options: ["only", "two"], correctOption: "D" }));
});
test("hotspot coordinates and correct target IDs are validated", () => {
  const base = { schemaVersion: 1, id: "hotspot-1", prompt: "Point to the jaw", answer: {
    kind: "image_hotspot", imageAssetId: "img1", targets: [{ id: "jaw", x: 0.5, y: 0.7, radius: 0.1, label: "Jaw" }], correctTargetIds: ["jaw"],
  }};
  assert.equal(universalQuestionSchema.safeParse(base).success, true);
  assert.equal(universalQuestionSchema.safeParse({ ...base, answer: { ...base.answer, correctTargetIds: ["missing"] } }).success, false);
  assert.equal(universalQuestionSchema.safeParse({ ...base, answer: { ...base.answer, targets: [{ id: "jaw", x: 1.2, y: 0.7, radius: 0.1, label: "Jaw" }] } }).success, false);
});
test("matching rejects repeated pair IDs", () => {
  assert.equal(universalQuestionSchema.safeParse({ schemaVersion: 1, id: "match-1", prompt: "Match", answer: { kind: "matching", pairs: [
    { id: "dup", prompt: "one", match: "uno" }, { id: "dup", prompt: "two", match: "dos" },
  ] } }).success, false);
});
