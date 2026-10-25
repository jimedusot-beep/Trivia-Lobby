/** Strict public-quiz input validation. Never resolves the authenticated private library. */
export const MAX_GUEST_QUESTIONS = 20;
const fail = message => { throw new Error(message); };
const text = (input, limit, label) => {
  if (typeof input !== "string" || !input.trim() || input.trim().length > limit ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(input))
    fail(`${label} must contain 1–${limit} printable characters.`);
  return input.trim();
};
export function validateGuestQuiz(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !["title", "questions"].includes(key)))
    fail("Invalid custom quiz.");
  const title = text(value.title, 80, "Quiz title");
  if (!Array.isArray(value.questions) || value.questions.length < 1 ||
      value.questions.length > MAX_GUEST_QUESTIONS)
    fail(`Use 1–${MAX_GUEST_QUESTIONS} quiz questions.`);
  const questions = value.questions.map((q, i) => {
    if (!q || typeof q !== "object" || Array.isArray(q) ||
        Object.keys(q).some(key => !["prompt", "choices", "correct", "explanation"].includes(key)))
      fail(`Invalid question ${i + 1}.`);
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4)
      fail(`Question ${i + 1} needs 2–4 choices.`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.choices.length)
      fail(`Question ${i + 1} has an invalid correct choice.`);
    if (typeof q.explanation !== "string" || q.explanation.length > 240)
      fail(`Question ${i + 1} has an invalid explanation.`);
    return {
      prompt: text(q.prompt, 200, `Question ${i + 1}`),
      choices: q.choices.map((choice, j) => text(choice, 120, `Question ${i + 1}, choice ${j + 1}`)),
      correct: q.correct,
      explanation: q.explanation.trim(),
    };
  });
  return { title, questions };
}
