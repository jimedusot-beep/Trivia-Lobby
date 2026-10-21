import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPracticeQuestions } from "./practice";

const card = (id: number, back: string, overrides: Record<string, unknown> = {}) => ({
  id, front: `Question ${id}`, back, type: "flashcard", options: [], correctOption: null, ...overrides,
});

describe("Practice question builder", () => {
  it("uses saved MC options and correct answer letter", () => {
    const questions = buildPracticeQuestions([
      card(1, "Mars", { type: "multiple_choice", options: ["Earth", "Mars", "Venus"], correctOption: "B" }),
    ], () => 0.5);
    assert.equal(questions[0].choices[questions[0].answerIndex!], "Mars");
  });

  it("creates distractors from distinct cards rather than fake content", () => {
    const questions = buildPracticeQuestions([
      card(1, "Paris"), card(2, "London"), card(3, "Berlin"), card(4, "Rome"),
    ], () => 0.25);
    assert.equal(questions.length, 4);
    for (const q of questions) {
      assert.ok(q.answerIndex !== null);
      assert.equal(q.choices[q.answerIndex!], q.back);
      assert.equal(new Set(q.choices).size, q.choices.length);
    }
  });

  it("falls back to reveal cards when a deck is too small", () => {
    const questions = buildPracticeQuestions([card(5, "One")], () => 0.5);
    assert.equal(questions[0].answerIndex, null);
    assert.deepEqual(questions[0].choices, []);
  });
});
