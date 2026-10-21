import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const PROD = process.env.NODE_ENV === "production";
const PASSWORD = process.env.TRIVIA_LIBRARY_PASSWORD || "";
const SECRET = process.env.TRIVIA_SESSION_SECRET || "";
const COOKIE_NAME = "trivia_library_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const BAD_LOGIN_WINDOW = 15 * 60 * 1000;
const badLogins = new Map<string, { count: number; expires: number }>();

// Explicitly permit no-password local development, but fail closed in production.
export function assertLibrarySecurityConfigured() {
  if (PROD && (PASSWORD.length < 16 || SECRET.length < 32)) {
    throw new Error("Production requires TRIVIA_LIBRARY_PASSWORD (16+ chars) and TRIVIA_SESSION_SECRET (32+ chars). Refusing to expose a public study library.");
  }
}
export function libraryAuthEnabled() {
  return Boolean(PASSWORD && SECRET);
}
function sign(data: string) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}
function safeEquals(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function readCookie(cookieHeader?: string) {
  const cookie = cookieHeader?.split(";").map(p => p.trim()).find(p => p.startsWith(COOKIE_NAME + "="));
  return cookie?.slice(COOKIE_NAME.length + 1);
}
export function isLibraryAuthorized(cookieHeader?: string) {
  if (!libraryAuthEnabled()) return !PROD;
  const cookie = readCookie(cookieHeader);
  if (!cookie) return false;
  const i = cookie.lastIndexOf(".");
  if (i < 0) return false;
  const data = cookie.slice(0, i);
  const signature = cookie.slice(i + 1);
  if (!safeEquals(signature, sign(data))) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now() && payload.exp < Date.now() + SESSION_SECONDS * 1000 + 60000;
  } catch {
    return false;
  }
}
function cookieOptions() {
  return `HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${PROD ? "; Secure" : ""}`;
}
export function requireLibraryAccess(req: Request, res: Response, next: NextFunction) {
  if (!isLibraryAuthorized(req.headers.cookie)) {
    return res.status(401).set("Cache-Control", "no-store").json({ message: "Sign in to access the study library." });
  }
  next();
}
function sameOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}
export function requireSameOriginMutation(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!sameOrigin(req)) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  next();
}
export function registerLibraryAuth(app: import("express").Express) {
  assertLibrarySecurityConfigured();
  app.get("/api/auth/session", (req, res) => {
    res.set("Cache-Control", "no-store").json({ authenticated: isLibraryAuthorized(req.headers.cookie), mode: libraryAuthEnabled() ? "family" : "local-development" });
  });
  app.post("/api/auth/login", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!sameOrigin(req)) return res.status(403).json({ message: "Invalid request origin." });
    if (!libraryAuthEnabled()) return res.status(503).json({ message: "Library authentication has not been configured." });
    const ip = req.ip || "unknown";
    const now = Date.now();
    const attempt = badLogins.get(ip);
    if (attempt && attempt.expires > now && attempt.count >= 5) {
      return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
    }
    const supplied = req.body?.password;
    if (typeof supplied !== "string" || !safeEquals(supplied, PASSWORD)) {
      const count = attempt && attempt.expires > now ? attempt.count + 1 : 1;
      badLogins.set(ip, { count, expires: now + BAD_LOGIN_WINDOW });
      return res.status(401).json({ message: "Incorrect family library password." });
    }
    badLogins.delete(ip);
    const data = Buffer.from(JSON.stringify({ exp: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${data}.${sign(data)}; ${cookieOptions()}`);
    return res.json({ authenticated: true });
  });
  app.post("/api/auth/logout", requireSameOriginMutation, (_req, res) => {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${PROD ? "; Secure" : ""}`);
    res.set("Cache-Control", "no-store").status(204).send();
  });
  // This gate applies to *all* library resources. Guest WebSocket joining does not grant deck API access.
  app.use("/api/decks", requireSameOriginMutation, requireLibraryAccess);
}
