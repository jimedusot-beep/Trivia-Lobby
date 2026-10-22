import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { and, eq, gt, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { cards, decks, studySchedule, studyEvents } from "@shared/schema";
import { calculateReview, isStudyRating, normalizedPrompt } from "./study-scheduler";
import { resolveUser } from "./auth";
import { registerStudyDraftRoutes } from "./study-drafts";

const reviewBody = z.object({ cardId: z.number().int().positive(), rating: z.number().int().min(1).max(4), requestId: z.string().uuid() }).strict();
export async function findStudyUser(req: Request) { return req.studyUser ?? await resolveUser(req.headers.cookie); }

function failure(res: Response, err: unknown) {
  if (err instanceof z.ZodError) { res.status(400).json({ message: "Invalid request", issues: err.issues }); return; }
  // Database exceptions can embed private source text in SQL parameters. Log only the class.
  console.error("Study API error:", err instanceof Error ? err.name : "UnknownError");
  res.status(500).json({ message: "Study request failed" });
}

type Handler = (req: Request, res: Response) => Promise<void>;
const safe = (handler: Handler) => async (req: Request, res: Response) => {
  try { await handler(req, res); } catch (err) { if (!res.headersSent) failure(res, err); }
};

export function registerStudyRoutes(app: Express) {
  app.get("/api/study/queue", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const input = z.object({ deckId: z.coerce.number().int().positive(), mode: z.enum(["due", "all", "missed"]).default("due") }).parse(req.query);
    const rows = await db.select({
      id: cards.id, deckId: cards.deckId, front: cards.front, back: cards.back,
      type: cards.type, options: cards.options, correctOption: cards.correctOption,
      dueAt: studySchedule.dueAt, needsWork: studySchedule.needsWork, lastRating: studySchedule.lastRating,
    }).from(cards).leftJoin(studySchedule, and(eq(studySchedule.cardId, cards.id), eq(studySchedule.userId, user.id)))
      .innerJoin(decks, eq(cards.deckId, decks.id)).where(and(eq(cards.deckId, input.deckId), eq(decks.ownerId, user.id))).orderBy(cards.id).limit(5000);
    const now = Date.now();
    const selected = rows.filter(row => input.mode === "all" || (input.mode === "missed" ? row.needsWork : !row.dueAt || row.dueAt.getTime() <= now));
    selected.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0) || a.id - b.id);
    res.json({ cards: selected.slice(0, 100), totalMatching: selected.length, algorithm: "ts-fsrs/5.4.2", capped: rows.length === 5000 });
  }));

  app.post("/api/study/review", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const input = reviewBody.parse(req.body);
    if (!isStudyRating(input.rating)) { res.status(400).json({ message: "Invalid rating" }); return; }
    const answer = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}),hashtext(${input.requestId}))`);
      // Lock per user/card, including before the first schedule row exists.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}), ${input.cardId})`);
      const [existing] = await tx.select().from(studyEvents)
        .where(and(eq(studyEvents.userId, user.id), eq(studyEvents.requestId, input.requestId))).limit(1);
      if (existing) {
        if (existing.cardId !== input.cardId || existing.rating !== input.rating) return { conflict: true as const };
        return { event: existing, replay: true };
      }
      const [card] = await tx.select({ id: cards.id }).from(cards).innerJoin(decks, eq(cards.deckId, decks.id)).where(and(eq(cards.id, input.cardId), eq(decks.ownerId, user.id))).limit(1);
      if (!card) return null;
      const [previous] = await tx.select().from(studySchedule)
        .where(and(eq(studySchedule.userId, user.id), eq(studySchedule.cardId, input.cardId))).limit(1);
      const now = new Date();
      const computed = calculateReview(previous?.fsrsState ?? null, input.rating as 1 | 2 | 3 | 4, now);
      const updated = {
        fsrsState: computed.after,
        dueAt: computed.after.due,
        reviewedAt: now,
        updatedAt: now,
        lastRating: input.rating,
        needsWork: input.rating <= 2,
      };
      await tx.insert(studySchedule).values({ userId: user.id, cardId: input.cardId, ...updated })
        .onConflictDoUpdate({ target: [studySchedule.userId, studySchedule.cardId], set: updated });
      const [event] = await tx.insert(studyEvents).values({
        id: randomUUID(), userId: user.id, cardId: input.cardId, requestId: input.requestId,
        rating: input.rating, correct: input.rating >= 3, reviewedAt: now,
        dueBefore: previous?.dueAt ?? null, dueAfter: computed.after.due,
        stateBefore: computed.before, stateAfter: computed.after,
      }).returning();
      return { event, replay: false };
    });
    if (!answer) { res.status(404).json({ message: "Card not found" }); return; }
    if ("conflict" in answer) { res.status(409).json({ message: "Review request ID already used for a different card or rating" }); return; }
    res.status(answer.replay ? 200 : 201).json(answer);
  }));

  app.get("/api/study/history", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const events = await db.select({
      id: studyEvents.id, cardId: studyEvents.cardId, rating: studyEvents.rating,
      correct: studyEvents.correct, reviewedAt: studyEvents.reviewedAt, dueAfter: studyEvents.dueAfter,
      front: cards.front, deckId: cards.deckId, subject: decks.category,
    }).from(studyEvents).innerJoin(cards, eq(studyEvents.cardId, cards.id))
      .innerJoin(decks, eq(cards.deckId, decks.id))
      .where(eq(studyEvents.userId, user.id)).orderBy(desc(studyEvents.reviewedAt)).limit(2000);
    // Derive the notebook from current per-user state, not a limited history slice.
    // A forgotten card can remain weak even if its last miss is older than 2,000 events.
    const wrongAnswers = await db.select({
      cardId: studySchedule.cardId,
      deckId: cards.deckId,
      front: cards.front,
      subject: decks.category,
      reviewedAt: studySchedule.reviewedAt,
      rating: studySchedule.lastRating,
    }).from(studySchedule)
      .innerJoin(cards, eq(studySchedule.cardId, cards.id))
      .innerJoin(decks, eq(cards.deckId, decks.id))
      .where(and(eq(studySchedule.userId, user.id), eq(studySchedule.needsWork, true), eq(decks.ownerId, user.id)))
      .orderBy(desc(studySchedule.reviewedAt)).limit(5000);
    // Universal/visual questions maintain their own FSRS state. Include their
    // unresolved mistakes without disclosing the question keys or another owner's questions.
    const weakVisual = await db.execute(sql`
      SELECT qs.question_id AS "questionId", uq.deck_id AS "deckId",
        uq.definition->>'prompt' AS "front", d.category AS "subject",
        (SELECT max(qa.created_at) FROM question_attempts qa
         WHERE qa.owner_id=${user.id} AND qa.question_id=qs.question_id) AS "reviewedAt"
      FROM question_schedule qs
      JOIN universal_questions uq ON uq.id=qs.question_id
      JOIN decks d ON d.id=uq.deck_id
      WHERE qs.owner_id=${user.id} AND d.owner_id=${user.id} AND qs.needs_work=true
      ORDER BY "reviewedAt" DESC NULLS LAST, qs.question_id
      LIMIT 5000`);
    const visualWrongAnswers = weakVisual.rows.map(row => ({
      questionId: Number(row.questionId), deckId: Number(row.deckId),
      front: String(row.front ?? ""), subject: String(row.subject ?? "General"),
      reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt.toISOString()
        : row.reviewedAt ? new Date(String(row.reviewedAt)).toISOString() : null,
    }));
    res.json({ events, wrongAnswers, visualWrongAnswers, historyLimited: events.length === 2000,
      notebookLimited: wrongAnswers.length === 5000 || visualWrongAnswers.length === 5000 });
  }));

  app.get("/api/study/dashboard", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const subjects = await db.select({ id: cards.id, deckId: cards.deckId, category: decks.category, title: decks.title })
      .from(cards).innerJoin(decks, eq(cards.deckId, decks.id)).where(eq(decks.ownerId, user.id)).limit(20000);
    const states = await db.select().from(studySchedule).where(eq(studySchedule.userId, user.id));
    const events = await db.select({ cardId: studyEvents.cardId, correct: studyEvents.correct, reviewedAt: studyEvents.reviewedAt })
      .from(studyEvents).where(eq(studyEvents.userId, user.id)).orderBy(desc(studyEvents.reviewedAt)).limit(10000);
    const stateMap = new Map(states.map(x => [x.cardId, x]));
    const byId = new Map(subjects.map(x => [x.id, x]));
    const stats = new Map<number, { deckId: number; title: string; subject: string; total: number; learned: number; due: number; mastered: number; attempts: number; correct: number }>();
    for (const item of subjects) {
      let stat = stats.get(item.deckId);
      if (!stat) { stat = { deckId: item.deckId, title: item.title, subject: item.category ?? "General", total: 0, learned: 0, due: 0, mastered: 0, attempts: 0, correct: 0 }; stats.set(item.deckId, stat); }
      stat.total++;
      const state = stateMap.get(item.id);
      if (state) {
        stat.learned++;
        if (state.dueAt.getTime() <= Date.now()) stat.due++;
        const snapshot = state.fsrsState as { scheduled_days?: number; state?: number };
        if (snapshot.state === 2 && (snapshot.scheduled_days ?? 0) >= 21) stat.mastered++;
      } else stat.due++;
    }
    for (const event of events) {
      const deck = byId.get(event.cardId);
      const stat = deck ? stats.get(deck.deckId) : null;
      if (stat) { stat.attempts++; if (event.correct) stat.correct++; }
    }
    const activeDays = new Set(events.map(x => x.reviewedAt.toISOString().slice(0, 10)));
    const daily = Array.from(activeDays).sort().reverse();
    // Streaks reward studying without deleting earned achievements after an absence.
    let streak = 0;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    if (!activeDays.has(start.toISOString().slice(0, 10))) start.setUTCDate(start.getUTCDate() - 1);
    while (activeDays.has(start.toISOString().slice(0, 10))) { streak++; start.setUTCDate(start.getUTCDate() - 1); }
    // A study session is a cluster of review events separated by less than 30 minutes.
    const chronological = events.map(e => e.reviewedAt.getTime()).sort((a, b) => a - b);
    const sessionCount = chronological.reduce((count, time, i) =>
      count + (i === 0 || time - chronological[i - 1] > 30 * 60_000 ? 1 : 0), 0);
    const subjectReviews = new Map<string, boolean[]>();
    for (const e of events) {
      const item = byId.get(e.cardId);
      if (!item) continue;
      const name = item.category ?? "General";
      const record = subjectReviews.get(name) ?? [];
      record.push(e.correct);
      subjectReviews.set(name, record);
    }
    const weaknessCount = new Map<string, number>();
    for (const item of subjects) if (stateMap.get(item.id)?.needsWork) {
      const name = item.category ?? "General";
      weaknessCount.set(name, (weaknessCount.get(name) ?? 0) + 1);
    }
    const ratio = (items: boolean[]) => items.length ? items.filter(Boolean).length / items.length * 100 : null;
    const subjectProgress = Array.from(subjectReviews, ([subject, flags]) => {
      const latest = ratio(flags.slice(0, 10));
      const previous = ratio(flags.slice(10, 20));
      return {
        subject, attempts: flags.length, accuracy: Math.round(ratio(flags) ?? 0),
        weakCards: weaknessCount.get(subject) ?? 0,
        improvementPoints: latest !== null && previous !== null ? Math.round(latest - previous) : null,
      };
    }).sort((a, b) => a.accuracy - b.accuracy);
    const correct = events.filter(e => e.correct).length;
    const totalDue = Array.from(stats.values()).reduce((n, x) => n + x.due, 0);
    const visualStats=await db.execute(sql`SELECT count(*)::int attempts,count(*) FILTER(WHERE correct)::int correct FROM question_attempts WHERE owner_id=${user.id}`);
    const visualDue=await db.execute(sql`SELECT count(*)::int due FROM question_schedule WHERE owner_id=${user.id} AND due_at<=now()`);
    res.json({ visual:{...visualStats.rows[0],due:visualDue.rows[0]?.due??0},
      attempts: events.length, correct, accuracy: events.length ? Math.round(100 * correct / events.length) : 0,
      sessions: sessionCount, studyDays: activeDays.size, subjectProgress, dueReviews: totalDue, studyStreak: streak, xp: events.length + correct * 4,
      achievements: [
        ...(events.length >= 1 ? ["First review"] : []),
        ...(events.length >= 25 ? ["25 reviews"] : []),
        ...(correct >= 50 ? ["50 recalled"] : []),
      ],
      decks: Array.from(stats.values()).map(x => ({ ...x, accuracy: x.attempts ? Math.round(100 * x.correct / x.attempts) : null })),
      historyLimited: events.length === 10000, calendar: daily.slice(0, 365),
    });
  }));

  app.get("/api/study/export", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const [states, events] = await Promise.all([
      db.select().from(studySchedule).where(eq(studySchedule.userId, user.id)),
      db.select().from(studyEvents).where(eq(studyEvents.userId, user.id)).orderBy(studyEvents.reviewedAt),
    ]);
    const questionStates=await db.execute(sql`SELECT * FROM question_schedule WHERE owner_id=${user.id}`);
    const questionAttempts=await db.execute(sql`SELECT * FROM question_attempts WHERE owner_id=${user.id} ORDER BY created_at`);
    res.setHeader("Content-Disposition", "attachment; filename=trivia-lobby-study-progress.json");
    res.json({ format: "trivia-lobby-study-v1", exportedAt: new Date().toISOString(), account: user.email, states, events, questionStates:questionStates.rows, questionAttempts:questionAttempts.rows });
  }));

  registerStudyDraftRoutes(app, safe, findStudyUser);
}
