import { listGuestDecks, restoreGuestDecks } from "./guest-decks.js";
import { celebrate } from "./party-ui.js";
import { courseFromDeck, emptyProgress, lessonResult, isUnlocked, dailyLessonIndex, progressStats,
  newSession, sessionStep, answerSession, advanceSession, completeLesson, learningBackup,
  parseLearningBackup, mergeProgress } from "./guest-learning.js";
import { loadLearningProgress, loadLearningSession, saveLearningSession, finishLearningSession,
  restoreLearningProgress } from "./guest-learning-store.js";

import { loadLocale, getLocale, subscribeLocale, t, formatText } from "./i18n.js";
import { learningSpanish } from "./learning-copy.js";
import { creatorError } from "./creator-copy.js";
loadLocale();
const $ = id => document.getElementById(id);
const word = (count, noun) => getLocale() === "es" ? ({day:["día","días"],lesson:["lección","lecciones"],question:["pregunta","preguntas"]}[noun][count === 1 ? 0 : 1]) : noun + (count === 1 ? "" : "s");
const lessonTitle = lesson => formatText("Lesson {number}", { number:lesson.index + 1 });
function errorText(error) {
  const message = error?.message || "Could not complete that action.";
  return getLocale() === "es" && Object.hasOwn(learningSpanish, message) ? learningSpanish[message] : creatorError(message, error?.name, getLocale());
}
function authored(text, parent) { const node = element("span", text, parent); node.lang = ""; return node; }
function withAuthored(node, key, values) {
  // Substitute authored slots as unknown-language text nodes, never as HTML or translated keys.
  node.replaceChildren();
  for (const part of t(key).split(/(\{\w+\})/)) {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name && Object.hasOwn(values, name)) {
      if (name === "course" || name === "answer") authored(values[name], node);
      else node.append(document.createTextNode(String(values[name])));
    } else node.append(document.createTextNode(part));
  }
}
const element = (tag, content, parent, className) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  parent.append(node); return node;
};
let status = { key:"Loading your quizzes…", values:{} }, storageError, summaryAchievements = [];
function renderStatus() {
  const key = getLocale() === "es" && status.values.count === 1 && status.key === "Restored {count} quizzes and merged learning progress. Existing achievements were kept." ? "Restored one quiz and merged learning progress. Existing achievements were kept." : status.key;
  $("status").textContent = key ? formatText(key, { ...status.values, ...(status.error ? {error:errorText(status.error)} : {}) }) : errorText(status.error);
}
function say(key, values = {}, error) { status = { key, values, error }; renderStatus(); }
function focusLearning(id) {
  // A saved answer may finish after the user moves to the language selector.
  if (document.activeElement?.id !== "display-language") $(id).focus();
}
let progress = emptyProgress(), courses = [], course, session, savedSession;
let persistent = true, busy = false, sessionXP = null, sessionChanged = false;
function storageFailed(error) {
  persistent = false;
  $("storage-note").classList.add("warning");
  storageError = error; renderStorage();
}
function renderStorage() {
  $("storage-note").textContent = persistent
    ? formatText("Saved on this browser only · Learning calendar: {timeZone}. Export a backup before clearing site data or moving to another device.", {timeZone:progress.timeZone})
    : formatText("Progress is available for this page session only: {error} Existing saved progress was kept. Download a learning backup before leaving.", {error:errorText(storageError)});
}
function run(work) {
  if (busy) return;
  busy = true;
  Promise.resolve().then(work).catch(error => say(null, {}, error))
    .finally(() => { busy = false; });
}
function button(label, parent, onClick, className) {
  const node = element("button", label, parent, className);
  node.type = "button";
  node.addEventListener("click", () => run(onClick));
  return node;
}
function renderStats() {
  const stats = progressStats(progress);
  $("level").textContent = formatText("Level {level}", {level:stats.level});
  $("xp").textContent = formatText("{xp} practice XP", {xp:stats.xp});
  $("level-progress").value = stats.levelXP;
  $("next-level").textContent = formatText("{remaining} XP to level {level}", {remaining:100-stats.levelXP,level:stats.level+1});
  $("streak").textContent = formatText("{days}-day streak", {days:stats.current,dayWord:word(stats.current,"day")});
  $("best-streak").textContent = formatText("Best: {count} {dayWord}", {count:stats.best,dayWord:word(stats.best,"day")});
  $("lesson-count").textContent = String(stats.lessons);
  $("daily-goal").textContent = t(stats.todayDone ? "Today’s goal complete ✓" : "Today’s goal: one lesson");
  $("daily").textContent = t(stats.todayDone ? "Practice another lesson" : "Start today’s lesson");
  $("daily-title").textContent = t(stats.todayDone ? "You showed up today." : "Your daily lesson");
  renderStorage();
  $("achievements").replaceChildren();
  for (const achievement of stats.achievements) {
    const li = element("li", undefined, $("achievements"), achievement.earned ? "earned" : "");
    element("span", t(achievement.earned ? "✓ Earned" : "To discover"), li);
    element("strong", t(achievement.title), li); element("small", t(achievement.detail), li);
  }
}
function renderCourses() {
  $("course-list").replaceChildren();
  $("empty").hidden = courses.length > 0;
  for (const item of courses) {
    const done = item.lessons.filter(lesson => lessonResult(progress, lesson)).length;
    const card = button(undefined, $("course-list"), () => chooseCourse(item), "course-card");
    authored(item.title, card);
    card.setAttribute("aria-pressed", String(course?.key === item.key));
    element("small", formatText("{done} of {count} {lessonWord} complete",{done,count:item.lessons.length,lessonWord:word(item.lessons.length,"lesson"),completeWord:item.lessons.length === 1 ? "completada" : "completadas"}), card);
  }
}
function renderPath() {
  $("course-panel").hidden = !course;
  if (!course) return;
  $("course-title").textContent = course.title; $("course-title").lang = "";
  const done = course.lessons.filter(lesson => lessonResult(progress, lesson)).length;
  $("course-progress").textContent = formatText("{done} / {count} {lessonWord} complete",{done,count:course.lessons.length,lessonWord:word(course.lessons.length,"lesson"),completeWord:course.lessons.length === 1 ? "completada" : "completadas"});
  const changed = sessionChanged || progress.completions.some(c => c.courseKey.startsWith(`${course.id}:`) && c.courseKey !== course.key);
  $("version-note").hidden = !changed;
  $("version-note").textContent = t("Your quiz questions changed. This version starts a fresh path; your earlier XP and achievements are kept.");
  const daily = course.lessons[dailyLessonIndex(progress, course)];
  withAuthored($("daily-detail"), "{course} · {lesson} · {count} {questionWord}. One completed lesson meets your daily goal.",{course:course.title,lesson:lessonTitle(daily),count:daily.questions.length,questionWord:word(daily.questions.length,"question")});
  $("path").replaceChildren();
  for (const lesson of course.lessons) {
    const result = lessonResult(progress, lesson), unlocked = isUnlocked(progress, course, lesson.index);
    const li = element("li", undefined, $("path"));
    const action = button(undefined, li, () => openLesson(lesson.index));
    action.disabled = !unlocked;
    action.dataset.step = result ? "complete" : unlocked ? "current" : "locked";
    element("span", result ? "✓" : String(lesson.index + 1), action, result ? "step-number completed" : "step-number");
    const info = element("span", lessonTitle(lesson), action);
    element("small", result ? formatText("Completed · Best first try: {correct}/{total} · Replay",{correct:result.bestCorrect,total:result.total})
      : unlocked ? formatText("{count} {questionWord} · Start",{count:lesson.questions.length,questionWord:word(lesson.questions.length,"question")}) : t("Finish the earlier lesson to unlock"), info);
  }
  $("resume").hidden = !savedSession || sessionStep(course, savedSession).done;
  if (savedSession) $("resume").textContent = formatText("Resume {lesson}",{lesson:lessonTitle(course.lessons[savedSession.lessonIndex])});
}
function showPath(focus = false) {
  $("lesson-panel").hidden = true; $("summary").hidden = true;
  renderStats(); renderCourses(); renderPath();
  if (focus && course) { $("course-title").tabIndex = -1; focusLearning("course-title"); }
}
async function refreshProgress() {
  if (!persistent) return;
  try { progress = await loadLearningProgress(); } catch (error) { storageFailed(error); }
}
async function chooseCourse(item) {
  await refreshProgress();
  course = item; session = null; savedSession = null; sessionChanged = false;
  if (persistent) {
    try {
      const restored = await loadLearningSession(course);
      savedSession = restored.session; sessionChanged = restored.changed;
    } catch (error) { storageFailed(error); }
  }
  const url = new URL(location.href); url.searchParams.set("deck", course.id);
  history.replaceState(null, "", url);
  showPath();
  say(savedSession && !sessionStep(course, savedSession).done ? "Your unfinished lesson is saved. Choose Resume to continue." : "Choose a lesson, or start your daily practice.");
}
async function checkpoint() {
  savedSession = session;
  if (!persistent) return;
  try { await saveLearningSession(course, session); } catch (error) { storageFailed(error); }
}
async function openLesson(index) {
  await refreshProgress();
  if (!isUnlocked(progress, course, index)) throw new Error("Finish the earlier lesson first.");
  if (savedSession?.lessonIndex === index && !sessionStep(course, savedSession).done) {
    session = structuredClone(savedSession); sessionXP = null; renderRunner();
    say("Resumed your saved lesson."); return;
  }
  session = newSession(course, index); sessionXP = null;
  await checkpoint(); renderRunner();
  say(persistent ? "Lesson started. Progress saves on this device." : "Lesson started. Progress is available for this page session only.");
}
function renderRunner() {
  const step = sessionStep(course, session);
  $("lesson-panel").hidden = false; $("summary").hidden = true;
  $("lesson-heading").textContent = step.question.prompt; $("lesson-heading").lang = "";
  $("choices").replaceChildren();
  step.question.choices.forEach((choice, index) => {
    const answer = button(`${String.fromCharCode(65 + index)}. ${choice}`, $("choices"), async () => {
      session = answerSession(course, session, index); await checkpoint(); renderRunner();
    }, step.selected !== undefined && index === step.question.correct ? "correct" : "");
    answer.disabled = step.selected !== undefined; answer.lang = "";
  });
  $("feedback").hidden = step.selected === undefined;
  renderRunnerLabels();
  if (step.selected !== undefined) {
    focusLearning("continue");
  } else focusLearning("lesson-heading");
}
function renderRunnerLabels() {
  const step = sessionStep(course, session);
  if (step.done) return; // Keep the last question stable while the final save settles.
  withAuthored($("lesson-position"), "{course} · {lesson}",{course:course.title,lesson:lessonTitle(course.lessons[session.lessonIndex])});
  $("lesson-progress").value = step.retry ? 100 : Math.round(100 * session.cursor / step.total);
  $("question-position").textContent = step.retry ? formatText("Retry {current} of {total} · One more try",{current:session.cursor-step.total+1,total:step.misses.length})
    : formatText("Question {current} of {total} · First try",{current:session.cursor+1,total:step.total});
  if (step.selected !== undefined) {
    $("answer-result").textContent = t(step.selected === step.question.correct ? "Correct!" : "Good try. Here’s the answer.");
    withAuthored($("answer-explanation"), "Correct answer: {answer}.",{answer:step.question.choices[step.question.correct]});
    if (step.question.explanation) { $("answer-explanation").append(document.createTextNode(" ")); authored(step.question.explanation,$("answer-explanation")); }
    $("continue").textContent = t(session.cursor + 1 === step.total + step.misses.length ? "Finish lesson" : "Continue");
  }
}
function renderSummary(newAchievements = []) {
  summaryAchievements = newAchievements;
  $("lesson-panel").hidden = true; $("summary").hidden = false;
  renderSummaryLabels();
  renderStats(); renderCourses(); renderPath(); focusLearning("summary-heading");
}
function renderSummaryLabels() {
  const step = sessionStep(course, session);
  if (!step.done) return;
  $("score").textContent = formatText("First try: {correct} of {total} correct.",{correct:step.firstCorrect,total:step.total});
  $("retry-score").textContent = step.misses.length ? formatText("On retry: {correct} of {total} corrected. Keep practicing whenever you like.",{correct:step.retryCorrect,total:step.misses.length}) : t("All correct on your first try!");
  $("earned-xp").textContent = sessionXP === null ? t("Your completed lesson is saved. Replaying does not add more XP.")
    : sessionXP ? formatText("+{xp} practice XP. {storage}",{xp:sessionXP,storage:t(persistent ? "Saved on this device." : "For this page session only.")})
      : t("Replay complete. Your best first-try score is updated; replays do not add more XP.");
  const earned = progressStats(progress).achievements.filter(a=>summaryAchievements.includes(a.id)).map(a=>t(a.title));
  $("milestones").textContent = earned.length ? formatText("Achievement earned: {achievements}.",{achievements:earned.join(", ")}) : t("Today’s lesson is complete. Come back when you’re ready.");
  $("next-lesson").hidden = session.lessonIndex + 1 >= course.lessons.length;
}
subscribeLocale(() => {
  renderStatus(); renderStats(); renderCourses(); renderPath();
  if (session && !$("lesson-panel").hidden) renderRunnerLabels();
  if (session && !$("summary").hidden) renderSummaryLabels();
});
$("continue").addEventListener("click", () => run(async () => {
  const before = progressStats(progress).achievements.filter(a => a.earned).map(a => a.id);
  const next = advanceSession(course, session);
  if (next.cursor === session.cursor) return;
  session = next;
  if (!sessionStep(course, session).done) { await checkpoint(); renderRunner(); return; }
  let result;
  if (persistent) {
    try { result = await finishLearningSession(course, session); } catch (error) { storageFailed(error); }
  }
  result ??= completeLesson(progress, course, session);
  progress = result.progress; sessionXP = result.earnedXP; savedSession = session;
  const earned = progressStats(progress).achievements.filter(a => a.earned && !before.includes(a.id)).map(a => a.id);
  renderSummary(earned); celebrate(); say(persistent ? "Lesson complete. Your progress is saved." : "Lesson complete. Progress is available for this page session only; download a backup.");
}));
$("daily").addEventListener("click", () => run(async () => {
  await refreshProgress(); await openLesson(dailyLessonIndex(progress, course));
}));
$("resume").addEventListener("click", () => run(() => {
  session = structuredClone(savedSession); sessionXP = null; renderRunner(); say("Resumed your saved lesson.");
}));
for (const id of ["back-path", "summary-path"]) $(id).addEventListener("click", () => run(() => showPath(true)));
$("replay").addEventListener("click", () => run(() => openLesson(session.lessonIndex)));
$("next-lesson").addEventListener("click", () => run(() => openLesson(session.lessonIndex + 1)));
$("export").addEventListener("click", () => run(async () => {
  await refreshProgress();
  const content = learningBackup(await listGuestDecks(), progress);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "trivia-lobby-learning-backup.json";
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  say("Learning backup downloaded. It includes your quizzes, answers and completed progress.");
}));
$("restore").addEventListener("change", () => run(async () => {
  let quizzesRestored = false;
  try {
    const file = $("restore").files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) throw new Error("Learning backup must be 2 MB or smaller.");
    const backup = parseLearningBackup(await file.text());
    await refreshProgress();
    if (!persistent) throw new Error("Restore needs working device storage. Existing data was kept.");
    mergeProgress(progress, backup.progress); // Validate the combined bounds before any writes.
    await restoreGuestDecks(backup.decks); quizzesRestored = true;
    progress = await restoreLearningProgress(backup.progress);
    courses = await Promise.all((await listGuestDecks()).map(courseFromDeck));
    if (courses.length) await chooseCourse(courses.find(c => c.id === course?.id) ?? courses[0]);
    else showPath();
    say("Restored {count} quizzes and merged learning progress. Existing achievements were kept.", {count:backup.decks.length});
  } catch (error) {
    say(quizzesRestored ? "Quizzes were restored, but learning progress could not be saved: {error} Keep your backup and try again." : null, {}, error);
  } finally { $("restore").value = ""; }
}));
renderStatus();
run(async () => {
  await refreshProgress(); renderStats();
  let records;
  try { records = await listGuestDecks(); }
  catch (error) { showPath(); say("Cannot read quizzes on this device: {error} Open My quizzes to check storage or import a backup.", {}, error); return; }
  courses = await Promise.all(records.map(courseFromDeck));
  const requested = new URLSearchParams(location.search).get("deck");
  const selected = courses.find(c => c.id === requested) ?? courses[0];
  if (selected) {
    await chooseCourse(selected);
    if (requested && requested !== selected.id) say("That quiz was not found on this device. Choose one of your saved courses or import a backup.");
  } else { showPath(); say("Make or import a quiz to begin your learning path."); }
});
