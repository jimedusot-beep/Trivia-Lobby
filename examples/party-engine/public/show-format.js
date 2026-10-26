// SPDX-License-Identifier: AGPL-3.0-or-later
// Original sample questions and interoperability validation. Curated points, not poll results.
import {
  fail,
  readable,
  requireFields,
  integer,
  normalized,
} from "./pack-validation.js";
const round = (question, answers, multiplier = 1) => ({
  question,
  answers: answers.map(([text, points]) => ({ text, points })),
  multiplier,
});
export const defaultShow = {
  title: "Family Showdown",
  rounds: [
    round("Name something you pack for a picnic.", [
      ["Sandwiches", 35],
      ["Blanket", 25],
      ["Water", 20],
      ["Fruit", 12],
      ["Napkins", 8],
    ]),
    round(
      "Name something you might see in a garden.",
      [
        ["Flowers", 35],
        ["Trees", 25],
        ["Birds", 20],
        ["Vegetables", 12],
        ["Butterflies", 8],
      ],
      2,
    ),
    round(
      "Name something that makes a rainy afternoon fun.",
      [
        ["Board games", 35],
        ["Movies", 25],
        ["Reading", 20],
        ["Baking", 12],
        ["Puzzles", 8],
      ],
      3,
    ),
  ],
  final: [
    round("Name a yellow fruit.", [
      ["Banana", 40],
      ["Lemon", 30],
      ["Pineapple", 20],
      ["Mango", 10],
    ]),
    round("Name something that flies.", [
      ["Bird", 40],
      ["Airplane", 30],
      ["Butterfly", 20],
      ["Kite", 10],
    ]),
    round("Name a breakfast drink.", [
      ["Orange juice", 40],
      ["Milk", 30],
      ["Coffee", 20],
      ["Tea", 10],
    ]),
    round("Name something at a playground.", [
      ["Swing", 40],
      ["Slide", 30],
      ["Seesaw", 20],
      ["Climbing frame", 10],
    ]),
    round("Name an animal with stripes.", [
      ["Zebra", 40],
      ["Tiger", 30],
      ["Skunk", 20],
      ["Bumblebee", 10],
    ]),
  ],
};
export function validateShow(raw) {
  requireFields(raw, ["title", "rounds", "final"]);
  const title = readable(raw.title, 80);
  function questions(list, min, max, final = false) {
    if (!Array.isArray(list) || list.length < min || list.length > max)
      fail(`Use ${min}–${max} questions.`);
    return list.map((q) => {
      requireFields(q, ["question", "answers"], ["multiplier"]);
      if (
        !Array.isArray(q.answers) ||
        q.answers.length < 2 ||
        q.answers.length > 8
      )
        fail("Each board needs 2–8 answers.");
      const answers = q.answers.map((a) => {
        requireFields(a, ["text", "points"]);
        if (!integer(a.points, 1, 100)) fail("Answer points must be 1–100.");
        return { text: readable(a.text, 60), points: a.points };
      });
      if (answers.reduce((n, a) => n + a.points, 0) !== 100)
        fail("Each board's answer points must add up to 100.");
      if (
        new Set(answers.map((a) => normalized(a.text))).size !== answers.length
      )
        fail("Board answers must be different.");
      const multiplier = final ? 1 : (q.multiplier ?? 1);
      if (!integer(multiplier, 1, 3)) fail("Round multiplier must be 1–3.");
      return { question: readable(q.question, 200), answers, multiplier };
    });
  }
  return {
    title,
    rounds: questions(raw.rounds, 1, 8),
    final: questions(raw.final, 5, 5, true),
  };
}

export function importShow(value) {
  if (
    value &&
    Array.isArray(value.rounds) &&
    value.rounds[0]?.answers?.[0]?.ans !== undefined
  ) {
    const convert = (q) => ({
      question: q.question,
      answers: q.answers.map((a) => ({ text: a.ans, points: a.pnt })),
      multiplier: q.multiply ?? 1,
    });
    if (!Array.isArray(value.final_round) || value.final_round.length !== 5)
      throw new Error("Friendly Feud imports need five final_round questions.");
    return validateShow({
      title: value.title_text || "Imported Showdown",
      rounds: value.rounds.map(convert),
      final: value.final_round.map((q) => ({
        question: q.question,
        answers: q.answers.map((a) => ({ text: a[0], points: a[1] })),
      })),
    });
  }
  return validateShow(
    value?.format === "trivia-lobby-show" ? value.show : value,
  );
}
