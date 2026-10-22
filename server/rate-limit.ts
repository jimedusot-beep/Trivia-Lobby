import type { RequestHandler } from "express";

/** Bounded, single-process fixed windows. Edge/shared limits are needed for replicas. */
export function windowLimiter(max: number, windowMs: number, capacity = 10_000) {
  const windows = new Map<string, { count: number; until: number }>();
  return (key: string, now = Date.now()): boolean => {
    if (windows.size >= capacity) {
      for (const [id, value] of windows) if (value.until <= now) windows.delete(id);
      if (windows.size >= capacity && !windows.has(key)) return false;
    }
    let value = windows.get(key);
    if (!value || value.until <= now) {
      value = { count: 0, until: now + windowMs }; windows.set(key, value);
    }
    return ++value.count <= max;
  };
}
export function rateLimit(max: number, windowMs = 60_000): RequestHandler {
  const allowed = windowLimiter(max, windowMs);
  return (req, res, next) => {
    if (!allowed(req.ip ?? req.socket.remoteAddress ?? "unknown")) {
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ message: "Too many requests; retry shortly" }); return;
    }
    next();
  };
}
