import { getGuestDeck, validateLocalDeck } from "./guest-decks.js";
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("deck");
let quiz, index = 0, correct = 0, answered = false;
function render() {
  $("lesson").hidden = false;
  $("completed").hidden = true;
  $("feedback").hidden = true;
  answered = false;
  const question = quiz.questions[index];
  $("progress").textContent = `Question ${index + 1} of ${quiz.questions.length}`;
  $("prompt").textContent = question.prompt;
  $("choices").replaceChildren();
  question.choices.forEach((choice, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${String.fromCharCode(65 + i)}. ${choice}`;
    button.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      const right = i === question.correct;
      if (right) correct++;
      $("result").textContent = right ? "Correct!" : "Good try!";
      $("explanation").textContent = `${question.choices[question.correct]} is correct.${question.explanation ? " " + question.explanation : ""}`;
      $("feedback").hidden = false;
      $("choices").querySelectorAll("button").forEach(b => b.disabled = true);
      $("next").textContent = index + 1 === quiz.questions.length ? "Show results" : "Next question";
      $("next").focus();
    });
    $("choices").append(button);
  });
  $("prompt").focus();
}
$("next").addEventListener("click", () => {
  if (!answered) return;
  index++;
  if (index < quiz.questions.length) { render(); return; }
  $("lesson").hidden = true;
  $("completed").hidden = false;
  $("score").textContent = `You got ${correct} of ${quiz.questions.length} right. Your answers are not uploaded or added to private learning history.`;
  $("status").textContent = "Quiz complete.";
});
$("again").addEventListener("click", () => {
  index = 0; correct = 0; render();
  $("status").textContent = "Practicing again.";
});
(async () => {
  try {
    const record = id ? await getGuestDeck(id) : null;
    if (!record) throw new Error("Quiz not found on this device. Open My quizzes to find or import it.");
    quiz = validateLocalDeck(record);
    $("title").textContent = quiz.title;
    const url = new URL("./create.html", location.href);
    url.searchParams.set("edit", id);
    $("edit").href = url.href;
    const learning = new URL("./learn.html", location.href);
    learning.searchParams.set("deck", id);
    $("learn").href = learning.href;
    $("status").textContent = "Ready to practice. Choose an answer.";
    render();
  } catch (err) {
    $("status").textContent = err instanceof Error ? err.message : "Device storage unavailable.";
  }
})();
