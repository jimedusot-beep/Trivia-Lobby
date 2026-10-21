import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

/** Algorithm version pinned in package-lock. Fuzzing disabled for reproducible cross-device state. */
export const STUDY_SCHEDULER = "ts-fsrs/5.4.2";
const scheduler = fsrs({ enable_fuzz: false, request_retention: 0.9 });

export type StudyRating = 1 | 2 | 3 | 4;
export const isStudyRating = (v: number): v is StudyRating => Number.isInteger(v) && v >= 1 && v <= 4;

export function restoreCard(snapshot: unknown, now: Date): Card {
  if (!snapshot) return createEmptyCard(now);
  if (typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("Corrupt review snapshot");
  const item = snapshot as Record<string, unknown>;
  const due = new Date(String(item.due));
  const last_review = item.last_review ? new Date(String(item.last_review)) : undefined;
  if (!Number.isFinite(due.getTime()) || (last_review && !Number.isFinite(last_review.getTime()))) {
    throw new Error("Corrupt review dates");
  }
  const initial = createEmptyCard(now);
  const num = (key: keyof Card): number => {
    const value = item[key];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Corrupt review number");
    return value;
  };
  const state = num("state");
  if (!Number.isInteger(state) || state < 0 || state > 3) throw new Error("Corrupt review stage");
  return {
    ...initial,
    due,
    last_review,
    stability: num("stability"),
    difficulty: num("difficulty"),
    elapsed_days: num("elapsed_days"),
    scheduled_days: num("scheduled_days"),
    learning_steps: num("learning_steps"),
    reps: num("reps"),
    lapses: num("lapses"),
    state,
  };
}

export function calculateReview(snapshot: unknown, rating: StudyRating, now: Date) {
  if (!isStudyRating(rating) || !Number.isFinite(now.getTime())) throw new Error("Invalid review input");
  const before = restoreCard(snapshot, now);
  if (before.last_review && now.getTime() < before.last_review.getTime()) throw new Error("Review time went backwards");
  const result = scheduler.next(before, now, rating as Grade);
  return { before, after: result.card, log: result.log };
}

export function normalizedPrompt(front: string) {
  return front.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
