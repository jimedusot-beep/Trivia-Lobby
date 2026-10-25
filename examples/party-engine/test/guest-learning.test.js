import { test } from "node:test";
import assert from "node:assert/strict";
import { courseFromDeck, emptyProgress, lessonResult, isUnlocked, dailyLessonIndex,
  progressStats, localDay, validateProgress, newSession, sessionStep, validateSession,
  answerSession, advanceSession, completeLesson, mergeProgress, learningBackup, parseLearningBackup } from "../public/guest-learning.js";

const deck = (n = 6) => ({ id: "quiz-course-test", title: "My science", questions: Array.from({ length: n }, (_, i) => ({
  prompt: `Question ${i + 1}?`, choices: ["Correct", "Another answer"], correct: 0, explanation: "Because it is correct.",
})) });
function finish(course, index = 0, wrong = [], now = "2026-10-25T16:00:00.000Z") {
  let session = newSession(course, index, now);
  while (!sessionStep(course, session).done) {
    const step = sessionStep(course, session);
    session = answerSession(course, session, !step.retry && wrong.includes(step.questionIndex) ? 1 : 0);
    session = advanceSession(course, session, now);
  }
  return session;
}

test("a personal quiz becomes ordered short lessons; content changes version it, title changes do not", async () => {
  const original = deck(11), course = await courseFromDeck(original);
  assert.deepEqual(course.lessons.map(l => l.questions.length), [5, 5, 1]);
  assert.equal((await courseFromDeck({ ...original, title: "Renamed" })).key, course.key);
  const changed = structuredClone(original); changed.questions[0].correct = 1;
  assert.notEqual((await courseFromDeck(changed)).key, course.key);
  await assert.rejects(courseFromDeck({ ...original, id: "x" }), /ID/);
});

test("misses return once after the first pass, first-pass accuracy remains separate, and duplicate clicks do nothing", async () => {
  const course = await courseFromDeck(deck(5));
  let session = newSession(course, 0);
  assert.equal(advanceSession(course, session).cursor, 0);
  session = answerSession(course, session, 1);
  assert.deepEqual(answerSession(course, session, 0), session);
  session = advanceSession(course, session);
  assert.equal(sessionStep(course, session).questionIndex, 1);
  const completed = finish(course, 0, [0, 3]);
  const step = sessionStep(course, completed);
  assert.deepEqual(step.misses, [0, 3]);
  assert.equal(step.firstCorrect, 3); assert.equal(step.retryCorrect, 2);
  assert.deepEqual(advanceSession(course, completed), completed);
});

test("XP is awarded once per lesson, retries award none, replays improve best score and levels derive from earned XP", async () => {
  const course = await courseFromDeck(deck(20));
  let result = completeLesson(emptyProgress("UTC"), course, finish(course, 0, [0, 3]));
  assert.equal(result.earnedXP, 35);
  const first = structuredClone(result.progress);
  result = completeLesson(result.progress, course, finish(course, 0));
  assert.equal(result.earnedXP, 0);
  assert.equal(lessonResult(result.progress, course.lessons[0]).bestCorrect, 5);
  assert.equal(lessonResult(result.progress, course.lessons[0]).firstCorrect, 3);
  result = completeLesson(result.progress, course, finish(course, 1));
  result = completeLesson(result.progress, course, finish(course, 2));
  const stats = progressStats(result.progress, "2026-10-25T17:00:00Z");
  assert.equal(stats.xp, 145); assert.equal(stats.level, 2); assert.equal(stats.levelXP, 45);
  assert.equal(first.completions.length, 1); // Input was never mutated.
});

test("unfinished and locked lessons cannot award XP; the next lesson and course milestone unlock on completion", async () => {
  const course = await courseFromDeck(deck());
  const blank = emptyProgress("UTC");
  assert.equal(isUnlocked(blank, course, 1), false);
  assert.throws(() => completeLesson(blank, course, newSession(course, 0)), /Finish/);
  assert.throws(() => completeLesson(blank, course, finish(course, 1)), /Finish/);
  let state = completeLesson(blank, course, finish(course)).progress;
  assert.equal(isUnlocked(state, course, 1), true);
  assert.equal(state.courseMilestones.length, 0);
  state = completeLesson(state, course, finish(course, 1)).progress;
  assert.deepEqual(state.courseMilestones, [course.key]);
  assert.equal(progressStats(state).achievements.find(a => a.id === "course").earned, true);
});

test("saved feedback and retry positions resume, while malformed and incompatible sessions are rejected", async () => {
  const course = await courseFromDeck(deck(1));
  let session = answerSession(course, newSession(course, 0), 1);
  session = validateSession(JSON.parse(JSON.stringify(session)), course);
  assert.equal(sessionStep(course, session).selected, 1);
  session = advanceSession(course, session);
  assert.equal(sessionStep(course, session).retry, true);
  assert.equal(sessionStep(course, session).selected, undefined);
  assert.throws(() => validateSession({ ...session, cursor: 3 }, course), /position/);
  assert.throws(() => validateSession({ ...session, answers: [9] }, course), /answers/);
  const other = await courseFromDeck({ ...deck(1), questions: [{ ...deck(1).questions[0], correct: 1 }] });
  assert.throws(() => validateSession(session, other), /incompatible/);
});

test("daily goals count one calendar date, including replays, without awarding replay XP", async () => {
  const course = await courseFromDeck(deck(1));
  let state = emptyProgress("America/New_York");
  for (const time of ["2026-10-25T03:59:00.000Z", "2026-10-25T04:01:00.000Z", "2026-10-25T18:00:00.000Z"]) {
    state = completeLesson(state, course, finish(course, 0, [], time)).progress;
  }
  assert.deepEqual(state.activityDays, ["2026-10-24", "2026-10-25"]);
  assert.equal(progressStats(state, "2026-10-25T18:00:00Z").current, 2);
  assert.equal(progressStats(state).xp, 15);
  assert.equal(progressStats(state, "2026-10-27T18:00:00Z").current, 0);
  assert.equal(progressStats(state, "2026-10-27T18:00:00Z").best, 2);
});

test("streaks survive DST, leap days and a break without losing earned achievements", () => {
  for (const days of [["2026-03-07", "2026-03-08", "2026-03-09"], ["2026-10-31", "2026-11-01", "2026-11-02"], ["2028-02-28", "2028-02-29", "2028-03-01"]]) {
    const progress = { ...emptyProgress("America/New_York"), activityDays: days };
    assert.equal(progressStats(progress, days[2] + "T18:00:00Z").current, 3);
    const later = progressStats(progress, "2028-03-05T18:00:00Z");
    assert.equal(later.best, 3);
    assert.equal(later.achievements.find(a => a.id === "streak").earned, true);
  }
  assert.equal(localDay("2026-03-08T06:59:00Z", "America/New_York"), "2026-03-08");
  assert.equal(localDay("2026-03-08T07:01:00Z", "America/New_York"), "2026-03-08");
  assert.equal(localDay("2026-10-25T03:00:00Z", "Asia/Tokyo"), "2026-10-25");
  assert.throws(() => validateProgress({ ...emptyProgress("UTC"), activityDays: ["2026-02-30"] }), /history/);
  assert.throws(() => emptyProgress("not-a-timezone"), /timezone/);
});

test("daily action chooses the next unfinished lesson, then a deterministic daily replay", async () => {
  const course = await courseFromDeck(deck());
  let state = emptyProgress("UTC");
  assert.equal(dailyLessonIndex(state, course), 0);
  state = completeLesson(state, course, finish(course, 0)).progress;
  assert.equal(dailyLessonIndex(state, course), 1);
  state = completeLesson(state, course, finish(course, 1)).progress;
  assert.equal(dailyLessonIndex(state, course, "2026-10-25T01:00:00Z"), dailyLessonIndex(state, course, "2026-10-25T23:00:00Z"));
});

test("learning backup round-trips quizzes and progress; merging never replaces first rewards or loses achievements", async () => {
  const record = deck(), course = await courseFromDeck(record);
  const first = completeLesson(emptyProgress("America/New_York"), course, finish(course, 0, [0])).progress;
  const replay = completeLesson(first, course, finish(course, 0)).progress;
  const incoming = completeLesson(replay, course, finish(course, 1)).progress;
  const backup = parseLearningBackup(learningBackup([record], incoming));
  assert.deepEqual(backup.decks[0], record);
  const merged = mergeProgress(first, backup.progress);
  assert.equal(merged.completions.length, 2);
  assert.equal(merged.completions[0].xp, 45);
  assert.equal(merged.completions[0].bestCorrect, 5);
  assert.equal(merged.courseMilestones.length, 1);
  assert.deepEqual(mergeProgress(merged, incoming), merged);
  assert.equal(mergeProgress(emptyProgress("UTC"), incoming).timeZone, "America/New_York");
});

test("unrecognized, oversized, duplicate and malformed backups fail before mutation", async () => {
  const record = deck(1), course = await courseFromDeck(record);
  const state = completeLesson(emptyProgress("UTC"), course, finish(course)).progress;
  const original = structuredClone(state);
  assert.throws(() => parseLearningBackup("{"), /JSON/);
  assert.throws(() => parseLearningBackup("x".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
  assert.throws(() => parseLearningBackup(JSON.stringify({ format: "private-library", version: 1 })), /learning backup/);
  assert.throws(() => learningBackup([record, record], state), /duplicate/);
  assert.throws(() => validateProgress({ ...state, completions: [...state.completions, ...state.completions] }), /result/);
  assert.throws(() => validateProgress({ ...state, completions: [{ ...state.completions[0], xp: 9999 }] }), /result/);
  assert.deepEqual(state, original);
});
