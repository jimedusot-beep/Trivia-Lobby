import { listGuestDecks, restoreGuestDecks } from "./guest-decks.js";
import { courseFromDeck, emptyProgress, lessonResult, isUnlocked, dailyLessonIndex, progressStats,
  newSession, sessionStep, answerSession, advanceSession, completeLesson, learningBackup,
  parseLearningBackup, mergeProgress } from "./guest-learning.js";
import { loadLearningProgress, loadLearningSession, saveLearningSession, finishLearningSession,
  restoreLearningProgress } from "./guest-learning-store.js";

const $ = id => document.getElementById(id);
const element = (tag, content, parent, className) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  parent.append(node); return node;
};
const say = message => { $("status").textContent = message; };
let progress = emptyProgress(), courses = [], course, session, savedSession;
let persistent = true, busy = false, sessionXP = null, sessionChanged = false;
function storageFailed(error) {
  persistent = false;
  $("storage-note").classList.add("warning");
  $("storage-note").textContent = `Progress is available for this page session only: ${error.message || "device storage failed"} Existing saved progress was kept. Download a learning backup before leaving.`;
}
function run(work) {
  if (busy) return;
  busy = true;
  Promise.resolve().then(work).catch(error => say(error.message || "Could not complete that action."))
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
  $("level").textContent = `Level ${stats.level}`;
  $("xp").textContent = `${stats.xp} practice XP`;
  $("level-progress").value = stats.levelXP;
  $("next-level").textContent = `${100 - stats.levelXP} XP to level ${stats.level + 1}`;
  $("streak").textContent = `${stats.current}-day streak`;
  $("best-streak").textContent = `Best: ${stats.best} days`;
  $("lesson-count").textContent = String(stats.lessons);
  $("daily-goal").textContent = stats.todayDone ? "Today’s goal complete ✓" : "Today’s goal: one lesson";
  $("daily").textContent = stats.todayDone ? "Practice another lesson" : "Start today’s lesson";
  $("daily-title").textContent = stats.todayDone ? "You showed up today." : "Your daily lesson";
  if (persistent) $("storage-note").textContent = `Saved on this browser only · Learning calendar: ${progress.timeZone}. Export a backup before clearing site data or moving to another device.`;
  $("achievements").replaceChildren();
  for (const achievement of stats.achievements) {
    const li = element("li", undefined, $("achievements"), achievement.earned ? "earned" : "");
    element("span", achievement.earned ? "✓ Earned" : "To discover", li);
    element("strong", achievement.title, li); element("small", achievement.detail, li);
  }
}
function renderCourses() {
  $("course-list").replaceChildren();
  $("empty").hidden = courses.length > 0;
  for (const item of courses) {
    const done = item.lessons.filter(lesson => lessonResult(progress, lesson)).length;
    const card = button(item.title, $("course-list"), () => chooseCourse(item), "course-card");
    card.setAttribute("aria-pressed", String(course?.key === item.key));
    element("small", `${done} of ${item.lessons.length} lessons complete`, card);
  }
}
function renderPath() {
  $("course-panel").hidden = !course;
  if (!course) return;
  $("course-title").textContent = course.title;
  const done = course.lessons.filter(lesson => lessonResult(progress, lesson)).length;
  $("course-progress").textContent = `${done} / ${course.lessons.length} lessons complete`;
  const changed = sessionChanged || progress.completions.some(c => c.courseKey.startsWith(`${course.id}:`) && c.courseKey !== course.key);
  $("version-note").hidden = !changed;
  $("version-note").textContent = "Your quiz questions changed. This version starts a fresh path; your earlier XP and achievements are kept.";
  const daily = course.lessons[dailyLessonIndex(progress, course)];
  $("daily-detail").textContent = `${course.title} · ${daily.title} · ${daily.questions.length} questions. One completed lesson meets your daily goal.`;
  $("path").replaceChildren();
  for (const lesson of course.lessons) {
    const result = lessonResult(progress, lesson), unlocked = isUnlocked(progress, course, lesson.index);
    const li = element("li", undefined, $("path"));
    const action = button(undefined, li, () => openLesson(lesson.index));
    action.disabled = !unlocked;
    element("span", result ? "✓" : String(lesson.index + 1), action, result ? "step-number completed" : "step-number");
    const info = element("span", lesson.title, action);
    element("small", result ? `Completed · Best first try: ${result.bestCorrect}/${result.total} · Replay`
      : unlocked ? `${lesson.questions.length} questions · Start` : "Finish the earlier lesson to unlock", info);
  }
  $("resume").hidden = !savedSession || sessionStep(course, savedSession).done;
  if (savedSession) $("resume").textContent = `Resume ${course.lessons[savedSession.lessonIndex].title}`;
}
function showPath(focus = false) {
  $("lesson-panel").hidden = true; $("summary").hidden = true;
  renderStats(); renderCourses(); renderPath();
  if (focus && course) { $("course-title").tabIndex = -1; $("course-title").focus(); }
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
  $("lesson-position").textContent = `${course.title} · ${course.lessons[session.lessonIndex].title}`;
  $("lesson-progress").value = step.retry ? 100 : Math.round(100 * session.cursor / step.total);
  $("question-position").textContent = step.retry ? `Retry ${session.cursor - step.total + 1} of ${step.misses.length} · One more try`
    : `Question ${session.cursor + 1} of ${step.total} · First try`;
  $("lesson-heading").textContent = step.question.prompt;
  $("choices").replaceChildren();
  step.question.choices.forEach((choice, index) => {
    const answer = button(`${String.fromCharCode(65 + index)}. ${choice}`, $("choices"), async () => {
      session = answerSession(course, session, index); await checkpoint(); renderRunner();
    }, step.selected !== undefined && index === step.question.correct ? "correct" : "");
    answer.disabled = step.selected !== undefined;
  });
  $("feedback").hidden = step.selected === undefined;
  if (step.selected !== undefined) {
    $("answer-result").textContent = step.selected === step.question.correct ? "Correct!" : "Good try. Here’s the answer.";
    $("answer-explanation").textContent = `Correct answer: ${step.question.choices[step.question.correct]}.${step.question.explanation ? " " + step.question.explanation : ""}`;
    $("continue").textContent = session.cursor + 1 === step.total + step.misses.length ? "Finish lesson" : "Continue";
    $("continue").focus();
  } else $("lesson-heading").focus();
}
function renderSummary(newAchievements = []) {
  const step = sessionStep(course, session);
  $("lesson-panel").hidden = true; $("summary").hidden = false;
  $("score").textContent = `First try: ${step.firstCorrect} of ${step.total} correct.`;
  $("retry-score").textContent = step.misses.length ? `On retry: ${step.retryCorrect} of ${step.misses.length} corrected. Keep practicing whenever you like.` : "All correct on your first try!";
  $("earned-xp").textContent = sessionXP === null ? "Your completed lesson is saved. Replaying does not add more XP."
    : sessionXP ? `+${sessionXP} practice XP. ${persistent ? "Saved on this device." : "For this page session only."}`
      : "Replay complete. Your best first-try score is updated; replays do not add more XP.";
  $("milestones").textContent = newAchievements.length ? `Achievement earned: ${newAchievements.join(", ")}.` : "Today’s lesson is complete. Come back when you’re ready.";
  $("next-lesson").hidden = session.lessonIndex + 1 >= course.lessons.length;
  renderStats(); renderCourses(); renderPath(); $("summary-heading").focus();
}
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
  const earned = progressStats(progress).achievements.filter(a => a.earned && !before.includes(a.id)).map(a => a.title);
  renderSummary(earned); say(persistent ? "Lesson complete. Your progress is saved." : "Lesson complete. Progress is available for this page session only; download a backup.");
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
    say(`Restored ${backup.decks.length} quizzes and merged learning progress. Existing achievements were kept.`);
  } catch (error) {
    say(quizzesRestored ? `Quizzes were restored, but learning progress could not be saved: ${error.message} Keep your backup and try again.` : error.message);
  } finally { $("restore").value = ""; }
}));
run(async () => {
  await refreshProgress(); renderStats();
  let records;
  try { records = await listGuestDecks(); }
  catch (error) { showPath(); throw new Error(`Cannot read quizzes on this device: ${error.message} Open My quizzes to check storage or import a backup.`); }
  courses = await Promise.all(records.map(courseFromDeck));
  const requested = new URLSearchParams(location.search).get("deck");
  const selected = courses.find(c => c.id === requested) ?? courses[0];
  if (selected) {
    await chooseCourse(selected);
    if (requested && requested !== selected.id) say("That quiz was not found on this device. Choose one of your saved courses or import a backup.");
  } else { showPath(); say("Make or import a quiz to begin your learning path."); }
});
