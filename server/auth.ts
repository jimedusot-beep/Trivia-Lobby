import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { db, pool } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { allowRate } from "./game-protocol";

declare module "express-session" {
  interface SessionData { userId?: string }
}

const cookieName = "trivia.sid";
const isProduction = process.env.NODE_ENV === "production";
const secret = process.env.SESSION_SECRET || (isProduction ? "" : randomBytes(32).toString("hex"));
if (secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
const PgSessionStore = connectPgSimple(session);

const registerInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
}).strict();
const loginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128)
}).strict();

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt);
  return `scrypt$${salt}$${key.toString("base64url")}`;
}
export async function checkPassword(password: string, encoded: string): Promise<boolean> {
  const [kind, salt, saved] = encoded.split("$");
  if (kind !== "scrypt" || !salt || !saved) return false;
  const expected = Buffer.from(saved, "base64url");
  if (expected.length !== 64) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
function limit(req: Request, key: string, max: number) {
  return allowRate(`auth:${req.ip || req.socket.remoteAddress || "unknown"}:${key}`, max, 60_000);
}
function validationError(err: unknown): string {
  return err instanceof z.ZodError ? err.issues[0]?.message || "Invalid request" : "Unable to process request";
}
async function startSession(req: Request, userId: string): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate(error => error ? reject(error) : resolve())
  );
  req.session.userId = userId;
  await new Promise<void>((resolve, reject) =>
    req.session.save(error => error ? reject(error) : resolve())
  );
}
export function setupAuthentication(app: express.Express) {
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

  app.use(session({
    name: cookieName,
    store: new PgSessionStore({ pool, createTableIfMissing: true }),
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true, sameSite: "lax", secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));

  // Reject cross-site state-changing requests (in addition to SameSite cookies).
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const allowedOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
    if ((req.get("origin") && req.get("origin") !== allowedOrigin) ||
        req.get("sec-fetch-site") === "cross-site") {
      return res.status(403).json({ message: "Cross-origin request blocked" });
    }
    next();
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Sign in required" });
    const [user] = await db.select({ id: users.id, email: users.email }).from(users)
      .where(eq(users.id, req.session.userId));
    if (!user) return res.status(401).json({ message: "Sign in required" });
    res.json(user);
  });

  app.post("/api/auth/register", async (req, res) => {
    if (!limit(req, "register", 5)) return res.status(429).json({ message: "Too many registrations" });
    try {
      const input = registerInput.parse(req.body);
      const hash = await hashPassword(input.password);
      const [user] = await db.insert(users).values({
        email: input.email, passwordHash: hash
      }).returning({ id: users.id, email: users.email });
      await startSession(req, user.id);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: validationError(error) });
      if ((error as { code?: string }).code === "23505") return res.status(409).json({ message: "Account already exists" });
      console.error("Registration failed:", error);
      res.status(500).json({ message: "Registration unavailable" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!limit(req, "login", 10)) return res.status(429).json({ message: "Too many sign-in attempts" });
    try {
      const input = loginInput.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      const valid = user && await checkPassword(input.password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });
      await startSession(req, user.id);
      res.json({ id: user.id, email: user.email });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: validationError(error) });
      console.error("Sign in failed:", error);
      res.status(500).json({ message: "Sign in unavailable" });
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie(cookieName, { path: "/" });
      res.status(204).send();
    });
  });

  app.use("/api/decks", (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) return res.status(401).json({ message: "Sign in required" });
    next();
  });
}
