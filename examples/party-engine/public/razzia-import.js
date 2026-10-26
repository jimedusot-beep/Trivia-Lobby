// SPDX-License-Identifier: AGPL-3.0-or-later
// Original interoperability adapter for the documented Razzia single-answer JSON schema.
export function importRazziaQuiz(value) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.subject !== "string" ||
    !Array.isArray(value.questions)
  )
    fail("Choose a Razzia quiz with a subject and questions.");
  if (value.gameMode !== undefined && value.gameMode !== "quiz")
    fail("Razzia surveys cannot be imported as scored quizzes.");
  const questions = value.questions.map((q, i) => {
    const label = `Razzia question ${i + 1}`;
    if (!q || typeof q !== "object" || Array.isArray(q))
      fail(`${label} is invalid.`);
    if (q.type !== undefined && q.type !== "single")
      fail(
        `${label}: only single-answer questions are supported. Multi-answer and estimation need a different game format.`,
      );
    if (q.media)
      fail(`${label}: media is not supported by the guest quiz editor.`);
    if (
      !Array.isArray(q.solutions) ||
      q.solutions.length !== 1 ||
      !Number.isInteger(q.solutions[0])
    )
      fail(`${label}: choose exactly one correct answer.`);
    if (q.options && Object.keys(q.options).length)
      fail(`${label}: custom scoring options are not supported.`);
    const result = {
      prompt: q.question,
      choices: q.answers,
      correct: q.solutions[0],
      explanation: q.note ?? "",
      seconds: q.time ?? 30,
      points: q.maxPoints ?? 1000,
      penalty: q.penalty ?? 0,
    };
    if (
      !Number.isInteger(result.seconds) ||
      result.seconds < 5 ||
      result.seconds > 120
    )
      fail(`${label}: answer time must be 5–120 whole seconds.`);
    if (
      !Number.isInteger(result.points) ||
      result.points < 0 ||
      result.points > 100000 ||
      !Number.isInteger(result.penalty) ||
      result.penalty < 0 ||
      result.penalty > 100000
    )
      fail(
        `${label}: points and penalty must be whole numbers from 0 to 100,000.`,
      );
    return result;
  });
  return { title: value.subject, questions };
}
