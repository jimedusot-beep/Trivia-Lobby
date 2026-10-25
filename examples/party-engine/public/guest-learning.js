import { validateLocalDeck } from "./guest-decks.js";

export const LESSON_SIZE = 5;
const MAX_RESULTS = 600, MAX_DAYS = 3660;
const deckIdPattern = /^[\w-]{8,80}$/;
const courseKeyPattern = /^[\w-]{8,80}:[a-f0-9]{64}$/;
const fail = message => { throw new Error(message); };
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const validTime = value => typeof value === "string" && value.length <= 30 &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validDay = day => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
const dayBefore = day => new Date(Date.parse(`${day}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

export function validateTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.length > 80) fail("Invalid learning timezone.");
  try { new Intl.DateTimeFormat("en", { timeZone }).format(); }
  catch { fail("Invalid learning timezone."); }
  return timeZone;
}
export function localDay(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validateTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now));
  const part = type => parts.find(p => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function emptyProgress(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return { version: 1, timeZone: validateTimeZone(timeZone), completions: [], activityDays: [], courseMilestones: [] };
}
export function validateProgress(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.completions) ||
      value.completions.length > MAX_RESULTS || !Array.isArray(value.activityDays) ||
      value.activityDays.length > MAX_DAYS || !Array.isArray(value.courseMilestones) ||
      value.courseMilestones.length > MAX_RESULTS) fail("Invalid or oversized learning progress. Existing progress was kept.");
  const seen = new Set();
  const completions = value.completions.map(c => {
    if (!c || !courseKeyPattern.test(c.courseKey) || !integer(c.lessonIndex, 0, 3) ||
        c.lessonId !== `${c.courseKey}:${c.lessonIndex}` || seen.has(c.lessonId) ||
        !integer(c.total, 1, LESSON_SIZE) || !integer(c.firstCorrect, 0, c.total) ||
        !integer(c.bestCorrect, c.firstCorrect, c.total) || c.xp !== 5 + 10 * c.firstCorrect ||
        !validTime(c.completedAt)) fail("Invalid lesson result. Existing progress was kept.");
    seen.add(c.lessonId);
    return { lessonId: c.lessonId, courseKey: c.courseKey, lessonIndex: c.lessonIndex,
      total: c.total, firstCorrect: c.firstCorrect, bestCorrect: c.bestCorrect, xp: c.xp, completedAt: c.completedAt };
  });
  if (value.activityDays.some(day => !validDay(day)) || new Set(value.activityDays).size !== value.activityDays.length ||
      value.courseMilestones.some(key => !courseKeyPattern.test(key)) ||
      new Set(value.courseMilestones).size !== value.courseMilestones.length)
    fail("Invalid activity history. Existing progress was kept.");
  return { version: 1, timeZone: validateTimeZone(value.timeZone), completions,
    activityDays: [...value.activityDays].sort(), courseMilestones: [...value.courseMilestones] };
}
export async function courseFromDeck(record) {
  if (!deckIdPattern.test(record?.id)) fail("Invalid saved quiz ID.");
  const deck = validateLocalDeck(record);
  if (!globalThis.crypto?.subtle) fail("Learning courses need HTTPS or localhost. Open the secure Trivia Lobby website.");
  // Only question content versions a path; renaming a quiz preserves its progress.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(deck.questions)));
  const version = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const key = `${record.id}:${version}`;
  const lessons = [];
  for (let start = 0; start < deck.questions.length; start += LESSON_SIZE) {
    const index = lessons.length;
    lessons.push({ id: `${key}:${index}`, index, title: `Lesson ${index + 1}`,
      questions: deck.questions.slice(start, start + LESSON_SIZE) });
  }
  return { id: record.id, title: deck.title, key, lessons };
}
export function lessonResult(progress, lesson) {
  return progress.completions.find(c => c.lessonId === lesson.id);
}
export function isUnlocked(progress, course, index) {
  return integer(index, 0, course.lessons.length - 1) &&
    course.lessons.slice(0, index).every(lesson => lessonResult(progress, lesson));
}
export function dailyLessonIndex(progress, course, now = Date.now()) {
  const next = course.lessons.findIndex(lesson => !lessonResult(progress, lesson));
  if (next !== -1) return next;
  return Math.floor(Date.parse(localDay(now, progress.timeZone)) / 86400000) % course.lessons.length;
}
export function progressStats(progress, now = Date.now()) {
  const days = progress.activityDays, daySet = new Set(days), today = localDay(now, progress.timeZone);
  let current = 0, best = 0, run = 0, previous;
  for (const day of [...days].sort()) {
    run = previous === dayBefore(day) ? run + 1 : 1;
    best = Math.max(best, run); previous = day;
  }
  let cursor = daySet.has(today) ? today : dayBefore(today);
  while (daySet.has(cursor)) { current++; cursor = dayBefore(cursor); }
  const xp = progress.completions.reduce((sum, c) => sum + c.xp, 0);
  return { xp, level: Math.floor(xp / 100) + 1, levelXP: xp % 100, current, best,
    todayDone: daySet.has(today), lessons: progress.completions.length,
    achievements: [
      { id: "first", title: "First lesson", detail: "Finish one lesson", earned: progress.completions.length > 0 },
      { id: "five", title: "Five lessons", detail: "Finish five different lessons", earned: progress.completions.length >= 5 },
      { id: "course", title: "Course finisher", detail: "Finish every lesson in a course", earned: progress.courseMilestones.length > 0 },
      { id: "streak", title: "Three-day rhythm", detail: "Complete lessons on three consecutive days", earned: best >= 3 },
    ] };
}
export function newSession(course, lessonIndex, now = Date.now()) {
  if (!course.lessons[lessonIndex]) fail("Lesson not found.");
  return { version: 1, id: crypto.randomUUID(), courseKey: course.key, lessonIndex,
    answers: [], retries: [], cursor: 0, startedAt: new Date(now).toISOString(), finishedAt: null };
}
export function sessionStep(course, session) {
  const questions = course.lessons[session.lessonIndex].questions;
  const misses = session.answers.flatMap((choice, i) => choice === questions[i].correct ? [] : [i]);
  const retry = session.cursor >= questions.length;
  const questionIndex = retry ? misses[session.cursor - questions.length] : session.cursor;
  const done = session.cursor === questions.length + misses.length && session.answers.length === questions.length;
  return { done, retry, misses, question: done ? null : questions[questionIndex],
    selected: retry ? session.retries[session.cursor - questions.length] : session.answers[session.cursor],
    firstCorrect: session.answers.filter((choice, i) => choice === questions[i].correct).length,
    retryCorrect: session.retries.filter((choice, i) => choice === questions[misses[i]].correct).length,
    total: questions.length, questionIndex };
}
export function validateSession(value, course) {
  if (!value || value.version !== 1 || !deckIdPattern.test(value.id) || value.courseKey !== course.key ||
      !integer(value.lessonIndex, 0, course.lessons.length - 1) || !Array.isArray(value.answers) ||
      !Array.isArray(value.retries) || !validTime(value.startedAt)) fail("Saved lesson is incompatible with this quiz.");
  const questions = course.lessons[value.lessonIndex].questions;
  if (value.answers.length > questions.length || value.answers.some((c, i) => !integer(c, 0, questions[i].choices.length - 1)))
    fail("Invalid saved answers.");
  const misses = value.answers.flatMap((c, i) => c === questions[i].correct ? [] : [i]);
  if (value.retries.length > misses.length || (value.retries.length && value.answers.length !== questions.length) ||
      value.retries.some((c, i) => !integer(c, 0, questions[misses[i]].choices.length - 1))) fail("Invalid saved retries.");
  const answered = value.answers.length + value.retries.length;
  if (!integer(value.cursor, Math.max(0, answered - 1), answered)) fail("Invalid saved lesson position.");
  const done = value.cursor === questions.length + misses.length && value.answers.length === questions.length;
  if (done ? !validTime(value.finishedAt) : value.finishedAt !== null) fail("Invalid lesson completion time.");
  return { version: 1, id: value.id, courseKey: course.key, lessonIndex: value.lessonIndex,
    answers: [...value.answers], retries: [...value.retries], cursor: value.cursor,
    startedAt: value.startedAt, finishedAt: value.finishedAt };
}
export function answerSession(course, value, choice) {
  const session = validateSession(value, course), step = sessionStep(course, session);
  if (step.done || step.selected !== undefined) return session;
  if (!integer(choice, 0, step.question.choices.length - 1)) fail("Choose an available answer.");
  (step.retry ? session.retries : session.answers).push(choice);
  return session;
}
export function advanceSession(course, value, now = Date.now()) {
  const session = validateSession(value, course), step = sessionStep(course, session);
  if (step.done || step.selected === undefined) return session;
  session.cursor++;
  if (sessionStep(course, session).done) session.finishedAt = new Date(now).toISOString();
  return session;
}
export function completeLesson(value, course, session) {
  const progress = validateProgress(value), safeSession = validateSession(session, course);
  const step = sessionStep(course, safeSession), lesson = course.lessons[safeSession.lessonIndex];
  if (!step.done || !isUnlocked(progress, course, safeSession.lessonIndex)) fail("Finish the available lesson before recording it.");
  const previous = lessonResult(progress, lesson);
  const earnedXP = previous ? 0 : 5 + step.firstCorrect * 10;
  if (previous) previous.bestCorrect = Math.max(previous.bestCorrect, step.firstCorrect);
  else progress.completions.push({ lessonId: lesson.id, courseKey: course.key, lessonIndex: lesson.index,
    total: step.total, firstCorrect: step.firstCorrect, bestCorrect: step.firstCorrect,
    xp: earnedXP, completedAt: safeSession.finishedAt });
  const day = localDay(safeSession.finishedAt, progress.timeZone);
  if (!progress.activityDays.includes(day)) progress.activityDays.push(day);
  if (course.lessons.every(item => lessonResult(progress, item)) && !progress.courseMilestones.includes(course.key))
    progress.courseMilestones.push(course.key);
  return { progress: validateProgress(progress), earnedXP };
}
export function mergeProgress(current, incoming) {
  const merged = validateProgress(current), other = validateProgress(incoming);
  for (const result of other.completions) {
    const existing = merged.completions.find(c => c.lessonId === result.lessonId);
    if (existing) existing.bestCorrect = Math.max(existing.bestCorrect, result.bestCorrect);
    else merged.completions.push(result);
  }
  merged.activityDays = [...new Set([...merged.activityDays, ...other.activityDays])];
  merged.courseMilestones = [...new Set([...merged.courseMilestones, ...other.courseMilestones])];
  // A fresh device adopts the backup timezone; established history keeps its calendar.
  if (!current.completions.length && !current.activityDays.length) merged.timeZone = other.timeZone;
  return validateProgress(merged);
}
export function learningBackup(decks, progress) {
  const safe = validateBackup({ format: "trivia-lobby-guest-learning", version: 1, decks, progress });
  return JSON.stringify(safe, null, 2);
}
export function validateBackup(value) {
  if (!value || value.format !== "trivia-lobby-guest-learning" || value.version !== 1 ||
      !Array.isArray(value.decks) || value.decks.length > 30) fail("Choose a Trivia Lobby learning backup.");
  const ids = new Set();
  const decks = value.decks.map(deck => {
    if (!deckIdPattern.test(deck?.id) || ids.has(deck.id)) fail("Invalid or duplicate quiz ID in backup.");
    ids.add(deck.id);
    return { id: deck.id, ...validateLocalDeck(deck) };
  });
  return { format: value.format, version: 1, decks, progress: validateProgress(value.progress) };
}
export function parseLearningBackup(input) {
  if (typeof input !== "string" || new TextEncoder().encode(input).byteLength > 2 * 1024 * 1024)
    fail("Learning backup must be 2 MB or smaller.");
  let data;
  try { data = JSON.parse(input); } catch { fail("This is not valid JSON."); }
  return validateBackup(data);
}
