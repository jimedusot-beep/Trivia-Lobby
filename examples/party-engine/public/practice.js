import { getGuestDeck, validateLocalDeck } from "./guest-decks.js";
import { celebrate } from "./party-ui.js";
import { loadLocale, getLocale, subscribeLocale, t, formatText } from "./i18n.js";
import { creatorError } from "./creator-copy.js";
loadLocale();
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("deck");
let quiz, index = 0, correct = 0, answered = false, selected = null, finished = false;
let status = { key:"Loading quiz from this device…" };
function renderStatus() {
  $("status").textContent = status.error ? creatorError(status.error.message, status.error.name, getLocale()) : t(status.key);
}
function say(key) { status = { key }; renderStatus(); }
function authored(text) {
  const span = document.createElement("span"); span.lang = ""; span.textContent = text; return span;
}
function renderLabels() {
  $("title").textContent = quiz ? quiz.title : t("Practice my quiz");
  $("title").lang = quiz ? "" : getLocale();
  if (!quiz) return;
  if (finished) {
    $("score").textContent = formatText("You got {correct} of {total} right. Your answers are not uploaded or added to private learning history.", {
      correct, total:quiz.questions.length, questionWord:t(quiz.questions.length === 1 ? "question" : "questions"),
    });
    return;
  }
  const question = quiz.questions[index];
  $("progress").textContent = formatText("Question {current} of {total}", { current:index + 1, total:quiz.questions.length });
  if (answered) {
    $("result").textContent = t(selected === question.correct ? "Correct!" : "Good try!");
    const [before, after] = t("{answer} is correct.").split("{answer}");
    $("explanation").replaceChildren(document.createTextNode(before), authored(question.choices[question.correct]), document.createTextNode(after));
    if (question.explanation) $("explanation").append(document.createTextNode(" "), authored(question.explanation));
  }
  $("next").textContent = t(index + 1 === quiz.questions.length ? "Show results" : "Next question");
}
function render() {
  $("lesson").hidden = false;
  $("completed").hidden = true;
  $("feedback").hidden = true;
  answered = false; selected = null; finished = false;
  const question = quiz.questions[index];
  $("prompt").textContent = question.prompt; $("prompt").lang = "";
  $("choices").replaceChildren();
  question.choices.forEach((choice, i) => {
    const button = document.createElement("button");
    button.type = "button"; button.lang = "";
    button.textContent = `${String.fromCharCode(65 + i)}. ${choice}`;
    button.addEventListener("click", () => {
      if (answered) return;
      answered = true; selected = i;
      if (i === question.correct) correct++;
      renderLabels();
      say("Answer recorded. Continue when you are ready.");
      $("feedback").hidden = false;
      $("choices").querySelectorAll("button").forEach(b => b.disabled = true);
      $("next").focus();
    });
    $("choices").append(button);
  });
  renderLabels();
  $("prompt").focus();
}
$("next").addEventListener("click", () => {
  if (!answered) return;
  index++;
  if (index < quiz.questions.length) { render(); return; }
  finished = true;
  $("lesson").hidden = true;
  $("completed").hidden = false;
  renderLabels(); say("Quiz complete.");
  celebrate();
});
$("again").addEventListener("click", () => {
  index = 0; correct = 0; render(); say("Practicing again.");
});
subscribeLocale(() => { renderStatus(); renderLabels(); });
renderStatus(); renderLabels();
(async () => {
  try {
    const record = id ? await getGuestDeck(id) : null;
    if (!record) { say("Quiz not found on this device. Open My quizzes to find or import it."); return; }
    quiz = validateLocalDeck(record);
    const url = new URL("./create.html", location.href);
    url.searchParams.set("edit", id);
    $("edit").href = url.href;
    const learning = new URL("./learn.html", location.href);
    learning.searchParams.set("deck", id);
    $("learn").href = learning.href;
    say("Ready to practice. Choose an answer."); render();
  } catch (err) {
    status = typeof err?.message === "string" ? { error: { message:err.message, name:err?.name } } : { key:"Device storage unavailable." };
    renderStatus();
  }
})();
