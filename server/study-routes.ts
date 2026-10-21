import { randomBytes, randomUUID, createHash, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import { and, eq, gt, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { cards, decks, studyAccounts, studyAuthTokens, studySchedule, studyEvents } from "@shared/schema";
import { calculateReview, isStudyRating, normalizedPrompt } from "./study-scheduler";
import { registerStudyDraftRoutes } from "./study-drafts";

const scrypt = promisify(callbackScrypt);
const TOKEN_NAME = "tl_study";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const passwordPolicy = z.string().min(12).max(128);
const credentials = z.object({ email: z.string().email().max(254).transform(x => x.trim().toLowerCase()), password: passwordPolicy }).strict();
const reviewBody = z.object({ cardId: z.number().int().positive(), rating: z.number().int().min(1).max(4), requestId: z.string().uuid() }).strict();
const authWindow = new Map<string, { count: number; expires: number }>();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function comparePassword(password: string, value: string) {
  const parts = value.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const key = await scrypt(password, parts[1], 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(parts[2], "hex"));
}

export async function findStudyUser(req: Request) {
  const cookie = req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(TOKEN_NAME + "="));
  const token = cookie?.slice(TOKEN_NAME.length + 1);
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
  const [user] = await db.select({ id: studyAccounts.id, email: studyAccounts.email })
    .from(studyAuthTokens).innerJoin(studyAccounts, eq(studyAuthTokens.userId, studyAccounts.id))
    .where(and(eq(studyAuthTokens.tokenHash, hashToken(token)), gt(studyAuthTokens.expiresAt, new Date()))).limit(1);
  return user ?? null;
}

async function issueToken(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(studyAuthTokens).values({ id: randomUUID(), userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + WEEK_MS) });
  res.setHeader("Set-Cookie", `${TOKEN_NAME}=${token}; Path=/api/study; HttpOnly; SameSite=Strict; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

function checkRate(req: Request, res: Response) {
  // Conservative single-process protection; use a shared limiter at larger scale.
  const key = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const window = authWindow.get(key);
  const next = !window || window.expires < now ? { count: 1, expires: now + 15 * 60_000 } : { count: window.count + 1, expires: window.expires };
  authWindow.set(key, next);
  if (next.count > 10) { res.status(429).json({ message: "Too many authentication requests" }); return false; }
  return true;
}

function failure(res: Response, err: unknown) {
  if (err instanceof z.ZodError) { res.status(400).json({ message: "Invalid request", issues: err.issues }); return; }
  console.error("Study API error:", err);
  res.status(500).json({ message: "Study request failed" });
}

type Handler = (req: Request, res: Response) => Promise<void>;
const safe = (handler: Handler) => async (req: Request, res: Response) => {
  try { await handler(req, res); } catch (err) { if (!res.headersSent) failure(res, err); }
};

export function registerStudyRoutes(app: Express) {
  app.use("/api/study", (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.get("Origin");
      if (req.get("Sec-Fetch-Site") === "cross-site" || (origin && (!req.get("Host") || new URL(origin).host !== req.get("Host")))) {
        res.status(403).json({ message: "Cross-site request rejected" }); return;
      }
    }
    next();
  });

  app.post("/api/study/auth/register", safe(async (req, res) => {
    if (!checkRate(req, res)) return;
    const input = credentials.parse(req.body);
    const [existing] = await db.select({ id: studyAccounts.id }).from(studyAccounts).where(eq(studyAccounts.email, input.email));
    if (existing) { res.status(409).json({ message: "Account already exists" }); return; }
    const id = randomUUID();
    try {
      await db.insert(studyAccounts).values({ id, email: input.email, passwordHash: await hashPassword(input.password) });
    } catch (err) {
      if ((err as { code?: string }).code === "23505") { res.status(409).json({ message: "Account already exists" }); return; }
      throw err;
    }
    await issueToken(res, id);
    res.status(201).json({ id, email: input.email });
  }));

  app.post("/api/study/auth/login", safe(async (req, res) => {
    if (!checkRate(req, res)) return;
    const input = credentials.parse(req.body);
    const [account] = await db.select().from(studyAccounts).where(eq(studyAccounts.email, input.email)).limit(1);
    if (!account || !await comparePassword(input.password, account.passwordHash)) {
      res.status(401).json({ message: "Incorrect email or password" }); return;
    }
    await issueToken(res, account.id);
    res.json({ id: account.id, email: account.email });
  }));

  app.get("/api/study/auth/me", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Sign in to save study progress" }); return; }
    res.json(user);
  }));

  app.post("/api/study/auth/logout", safe(async (req, res) => {
    const cookie = req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(TOKEN_NAME + "="));
    const token = cookie?.slice(TOKEN_NAME.length + 1);
    if (token) await db.delete(studyAuthTokens).where(eq(studyAuthTokens.tokenHash, hashToken(token)));
    res.setHeader("Set-Cookie", `${TOKEN_NAME}=; Path=/api/study; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    res.status(204).end();
  }));

  app.get("/api/study/queue", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const input = z.object({ deckId: z.coerce.number().int().positive(), mode: z.enum(["due", "all", "missed"]).default("due") }).parse(req.query);
    const rows = await db.select({
      id: cards.id, deckId: cards.deckId, front: cards.front, back: cards.back,
      type: cards.type, options: cards.options, correctOption: cards.correctOption,
      dueAt: studySchedule.dueAt, needsWork: studySchedule.needsWork, lastRating: studySchedule.lastRating,
    }).from(cards).leftJoin(studySchedule, and(eq(studySchedule.cardId, cards.id), eq(studySchedule.userId, user.id)))
      .where(eq(cards.deckId, input.deckId)).orderBy(cards.id).limit(5000);
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
      // Lock per user/card, including before the first schedule row exists.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}), ${input.cardId})`);
      const [existing] = await tx.select().from(studyEvents)
        .where(and(eq(studyEvents.userId, user.id), eq(studyEvents.requestId, input.requestId))).limit(1);
      if (existing) return { event: existing, replay: true };
      const [card] = await tx.select({ id: cards.id }).from(cards).where(eq(cards.id, input.cardId)).limit(1);
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
    const schedule = await db.select({ cardId: studySchedule.cardId, needsWork: studySchedule.needsWork })
      .from(studySchedule).where(eq(studySchedule.userId, user.id));
    const weak = new Set(schedule.filter(x => x.needsWork).map(x => x.cardId));
    res.json({ events, wrongAnswers: events.filter(x => weak.has(x.cardId) && x.rating <= 2), historyLimited: events.length === 2000 });
  }));

  app.get("/api/study/dashboard", safe(async (req, res) => {
    const user = await findStudyUser(req);
    if (!user) { res.status(401).json({ message: "Authentication required" }); return; }
    const subjects = await db.select({ id: cards.id, deckId: cards.deckId, category: decks.category, title: decks.title })
      .from(cards).innerJoin(decks, eq(cards.deckId, decks.id)).limit(20000);
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
    res.json({
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
    res.setHeader("Content-Disposition", "attachment; filename=trivia-lobby-study-progress.json");
    res.json({ format: "trivia-lobby-study-v1", exportedAt: new Date().toISOString(), account: user.email, states, events });
  }));

  registerStudyDraftRoutes(app, safe, findStudyUser);
}
