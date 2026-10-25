import express from "express";
import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { Party, roomCode } from "./engine.js";
const hash = (s) => createHash("sha256").update(s).digest();
export function createPartyServer({ partyOptions = {} } = {}) {
  const app = express(),
    server = createServer(app),
    rooms = new Map(),
    limits = new Map();
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'",
    );
    next();
  });
  app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 65536) ws.close(1013, "Slow connection");
      else ws.send(JSON.stringify(data));
    }
  };
  function publish(record) {
    for (const [id, p] of record.sessions) {
      if (id !== "host" && !record.party.players.has(id)) {
        p.ws?.close();
        record.sessions.delete(id);
        continue;
      }
      if (p.ws) send(p.ws, { type: "state", state: record.party.view(id) });
    }
  }
  server.on("upgrade", (req, socket, head) => {
    if (
      wss.clients.size >= 1000 ||
      req.url !== "/socket" ||
      !req.headers.origin
    ) {
      socket.destroy();
      return;
    }
    // PUBLIC_ORIGIN is required for a public reverse proxy. Never trust forwarded headers.
    const expected = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
    if (req.headers.origin !== expected) {
      socket.destroy();
      return;
    }
    const ip = req.socket.remoteAddress,
      now = Date.now();
    let limit = limits.get(ip);
    if (!limit || now >= limit.reset) {
      if (!limit && limits.size >= 10000) {
        socket.destroy();
        return;
      }
      limits.set(ip, (limit = { count: 0, reset: now + 60000 }));
    }
    if (++limit.count > 60) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws) => {
    let record,
      actor,
      windowStart = Date.now(),
      count = 0;
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => {});
    ws.on("message", (raw) => {
      try {
        if (Date.now() - windowStart > 10000) {
          windowStart = Date.now();
          count = 0;
        }
        if (++count > 60) throw new Error("Too many messages; wait a moment.");
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object" || Array.isArray(m))
          throw new Error("Invalid message.");
        if (!record) {
          if (
            Object.keys(m).some(
              (k) => !["type", "code", "name", "actor", "token"].includes(k),
            )
          )
            throw new Error("Invalid connection fields.");
          if (m.type === "create") {
            if (rooms.size >= 200) throw new Error("Server is full.");
            const code = roomCode(rooms);
            record = {
              party: new Party(code, partyOptions),
              sessions: new Map(),
            };
            rooms.set(code, record);
            actor = "host";
          } else {
            if (
              typeof m.code !== "string" ||
              !/^[A-HJ-NP-Z2-9]{6}$/i.test(m.code)
            )
              throw new Error("Enter a valid six-character code.");
            record = rooms.get(m.code.toUpperCase());
            if (!record) throw new Error("Room expired or not found.");
            if (m.type === "join") actor = record.party.join(m.name);
            else if (m.type === "resume") {
              const s = record.sessions.get(m.actor);
              if (
                typeof m.token !== "string" ||
                m.token.length > 128 ||
                !s ||
                !timingSafeEqual(hash(m.token), s.tokenHash)
              )
                throw new Error("Invalid reconnect credential.");
              actor = m.actor;
              const old = s.ws;
              s.ws = ws;
              old?.close(1000, "Reconnected elsewhere");
              record.party.connected(actor, true);
              send(ws, { type: "ready", actor });
              publish(record);
              return;
            } else throw new Error("Create or join a room first.");
          }
          const token = randomBytes(32).toString("base64url");
          record.sessions.set(actor, { tokenHash: hash(token), ws });
          send(ws, {
            type: "credential",
            code: record.party.code,
            actor,
            token,
          });
          publish(record);
        } else {
          if (record.sessions.get(actor)?.ws !== ws)
            throw new Error("Connection replaced.");
          const result = record.party.handle(actor, m);
          send(ws, { type: "ack", ...result });
          publish(record);
        }
      } catch (e) {
        // Failed join/resume must not bind this socket to someone else's room.
        if (record && !record.sessions.has(actor)) {
          record = undefined;
          actor = undefined;
        }
        send(ws, {
          type: "error",
          message: e instanceof SyntaxError ? "Invalid JSON." : e.message,
        });
        if (record && record.sessions.get(actor)?.ws === ws) publish(record);
      }
    });
    ws.on("close", () => {
      if (record && record.sessions.get(actor)?.ws === ws) {
        record.sessions.get(actor).ws = null;
        record.party.connected(actor, false);
        publish(record);
      }
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      const revision = r.party.revision;
      r.party.tick();
      if (revision !== r.party.revision) publish(r);
      if (now - r.party.touched > 600000) {
        for (const s of r.sessions.values()) s.ws?.close(1000, "Room expired");
        rooms.delete(code);
      }
    }
    for (const [ip, l] of limits) if (now >= l.reset) limits.delete(ip);
  }, 100);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15000);
  server.on("close", () => {
    clearInterval(timer);
    clearInterval(heartbeat);
  });
  return {
    server,
    rooms,
    wss,
    async close() {
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createPartyServer();
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Party engine: http://localhost:${port}`),
  );
}
