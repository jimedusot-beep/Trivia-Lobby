import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { Party, roomCode } from "./engine.js";
import { ParticipantSessions } from "./sessions.js";
import { DeadlineScheduler } from "./scheduler.js";
import { validateHello } from "./protocol.js";
export function createPartyServer({
  partyOptions = {},
  schedulerOptions = {},
} = {}) {
  const scheduler = new DeadlineScheduler({
    clock: partyOptions.clock,
    ...schedulerOptions,
  });
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
    if (rooms.get(record.party.code) !== record) return;
    record.sessions.prune(record.party.players);
    for (const [id, ws] of record.sessions.connections()) {
      send(ws, { type: "state", state: record.party.view(id) });
    }
    const party = record.party;
    const deadline =
      party.deadline ??
      (party.hostWaitAt === null ? null : party.hostWaitAt + 60000);
    scheduler.schedule(
      party.code,
      `${party.matchId}:${party.revision}:${party.hostWaitAt}`,
      deadline,
      () => {
        if (rooms.get(party.code) !== record) return;
        party.tick();
        publish(record);
      },
    );
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
          validateHello(m);
          let candidate, id;
          if (m.type === "create") {
            if (rooms.size >= 200) throw new Error("Server is full.");
            const code = roomCode(rooms);
            candidate = {
              party: new Party(code, partyOptions),
              sessions: new ParticipantSessions(),
            };
            rooms.set(code, candidate);
            id = "host";
          } else {
            candidate = rooms.get(m.code.toUpperCase());
            if (!candidate) throw new Error("Room expired or not found.");
            if (m.type === "join") {
              candidate.party.tick();
              publish(candidate);
              id = candidate.party.join(m.name);
            } else {
              candidate.sessions.resume(m.actor, m.token, ws);
              record = candidate;
              actor = m.actor;
              // Apply any deadline that elapsed before reconnect. A resumed phone
              // cannot rewind a round or suppress an expired host grace period.
              record.party.tick();
              record.party.connected(actor, true);
              send(ws, { type: "ready", actor });
              publish(record);
              return;
            }
          }
          record = candidate;
          actor = id;
          const token = record.sessions.issue(actor, ws);
          send(ws, {
            type: "credential",
            code: record.party.code,
            actor,
            token,
          });
          publish(record);
        } else {
          if (
            rooms.get(record.party.code) !== record ||
            !record.sessions.owns(actor, ws)
          )
            throw new Error("Connection replaced or room expired.");
          const result = record.party.handle(actor, m);
          send(ws, { type: "ack", ...result });
          publish(record);
        }
      } catch (e) {
        send(ws, {
          type: "error",
          message: e instanceof SyntaxError ? "Invalid JSON." : e.message,
        });
        if (record && record.sessions.owns(actor, ws)) publish(record);
      }
    });
    ws.on("close", () => {
      if (record && record.sessions.disconnect(actor, ws)) {
        record.party.connected(actor, false);
        publish(record);
      }
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      if (r.party.clock() - r.party.touched > 600000) {
        scheduler.cancel(code);
        rooms.delete(code);
        r.sessions.closeAll();
      }
    }
    for (const [ip, l] of limits) if (now >= l.reset) limits.delete(ip);
  }, 5000);
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
    scheduler.close();
    clearInterval(timer);
    clearInterval(heartbeat);
  });
  return {
    server,
    rooms,
    wss,
    scheduler,
    async close() {
      scheduler.close();
      clearInterval(timer);
      clearInterval(heartbeat);
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
