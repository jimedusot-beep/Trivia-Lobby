import { randomBytes } from "node:crypto";
import { hashSessionToken, hashPassword, verifyPassword, getCookie } from "./auth-crypto";
import type { Request, Response, NextFunction, Express } from "express";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { users, userSessions } from "@shared/schema";
import { rateLimit } from "./rate-limit";

const COOKIE = "tl_session";
const DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(256),
}).strict();

function setCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURATION_MS });
}
function clearCookie(res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function resolveUser(cookieHeader: string | undefined): Promise<{ id: string; email: string } | null> {
  const token = getCookie(cookieHeader);
  if (!token) return null;
  const [row] = await db.select({ id: users.id, email: users.email }).from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(and(eq(userSessions.tokenHash, hashSessionToken(token)), gt(userSessions.expiresAt, new Date()))).limit(1);
  return row || null;
}

declare global {
  namespace Express {
    interface Request { studyUser?: { id: string; email: string } }
  }
}
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveUser(req.headers.cookie);
    if (!user) { res.status(401).json({ message: "Sign in required" }); return; }
    req.studyUser = user;
    next();
  } catch (err) { next(err); }
}

// Defense-in-depth for browser cookie requests; same-site cookies are not a replacement for Origin checks.
export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("sec-fetch-site") === "cross-site") { res.status(403).json({ message: "Cross-site request rejected" }); return; }
  const origin = req.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get("host") || !["http:", "https:"].includes(parsed.protocol)) {
        res.status(403).json({ message: "Origin rejected" }); return;
      }
    } catch { res.status(403).json({ message: "Origin rejected" }); return; }
  }
  next();
}
export const loginRateLimit = rateLimit(20, 15 * 60_000);
const dummyHash = hashPassword("Unused-account-timing-sentinel");
async function issueSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(userSessions).values({ tokenHash: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + DURATION_MS) });
  setCookie(res, token);
}
export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", loginRateLimit, async (req, res, next) => {
    try {
      const parsed = credentials.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ message: "Valid email and password of at least 12 characters required" }); return; }
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
      if (existing.length) { res.status(409).json({ message: "Account already exists" }); return; }
      const hash = await hashPassword(parsed.data.password);
      const [user] = await db.insert(users).values({ email: parsed.data.email, passwordHash: hash }).returning({ id: users.id, email: users.email });
      await issueSession(res, user.id);
      res.status(201).json(user);
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") { res.status(409).json({ message: "Account already exists" }); return; }
      next(err);
    }
  });
  app.post("/api/auth/login", loginRateLimit, async (req, res, next) => {
    try {
      const parsed = credentials.safeParse(req.body);
      if (!parsed.success) { res.status(401).json({ message: "Invalid email or password" }); return; }
      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
      const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? await dummyHash);
      if (!user || !valid) {
        res.status(401).json({ message: "Invalid email or password" }); return;
      }
      await issueSession(res, user.id);
      res.json({ id: user.id, email: user.email });
    } catch (err) { next(err); }
  });
  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      const token = getCookie(req.headers.cookie);
      if (token) await db.delete(userSessions).where(eq(userSessions.tokenHash, hashSessionToken(token)));
      clearCookie(res);
      res.status(204).send();
    } catch (err) { next(err); }
  });
  app.get("/api/auth/me", requireUser, (req, res) => { res.json(req.studyUser); });
}
