import type { RequestHandler } from "express";

const windows = new Map<string, { count: number; expires: number }>();
/** Bounded single-process limiter. A full table rejects new identities until expiry. */
export function consumeRate(key: string, max: number, period: number, now = Date.now()): boolean {
  if (windows.size >= 10000) for (const [id, value] of windows) if (value.expires <= now) windows.delete(id);
  const old = windows.get(key);
  if (!old && windows.size >= 10000) return false;
  const value = !old || old.expires <= now ? { count: 0, expires: now + period } : old;
  value.count++;
  windows.set(key, value);
  return value.count <= max;
}

export const apiAbuseLimit: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const category = /auth/.test(req.path) ? "auth" : /generate/.test(req.path) ? "generate" : /import|library|restore/.test(req.path) ? "import" : "write";
  const max = { auth: 20, generate: 5, import: 20, write: 120 }[category];
  if (!consumeRate(`api:${req.ip ?? req.socket.remoteAddress}:${category}`, max, 60_000)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ message: "Too many requests. Try again in a minute." });
    return;
  }
  next();
};
