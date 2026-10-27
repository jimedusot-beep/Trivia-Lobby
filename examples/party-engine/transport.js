import { WebSocketServer, WebSocket } from "ws";
import { Party, roomCode } from "./engine.js";
import { ParticipantSessions } from "./sessions.js";
import { DeadlineScheduler } from "./scheduler.js";
import { validateHello } from "./protocol.js";
import { validateGuestQuiz } from "./custom-quiz.js";
import { validateShow } from "./open-pack/feud.js";
import { acceptRaceInput, raceFrame } from "./open-pack/race.js";
import { acceptTapInput, tapFrame } from "./open-pack/tap.js";
import { acceptTrailInput, trailsFrame } from "./open-pack/trails.js";

/** Attach the guest transport to an existing HTTP server without claiming other upgrades. */
export function attachPartySocket(server, {
  socketPath = "/socket",
  expectedOrigin = process.env.PUBLIC_ORIGIN,
  partyOptions = {},
  schedulerOptions = {},
} = {}) {
  const scheduler = new DeadlineScheduler({ clock: partyOptions.clock, ...schedulerOptions });
  const rooms = new Map(), limits = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32768, perMessageDeflate: false });
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
  const upgrade = (req, socket, head) => {
    // Other transports (private quizzes, Vite HMR) own their own paths.
    if (req.url !== socketPath) return;
    if (
      wss.clients.size >= 1000 ||
      !req.headers.origin
    ) {
      socket.destroy();
      return;
    }
    // PUBLIC_ORIGIN is required for a public reverse proxy. Never trust forwarded headers.
    let allowed = false;
    try {
      const origin = new URL(req.headers.origin);
      allowed = expectedOrigin
        ? origin.origin === expectedOrigin && req.headers.origin === expectedOrigin
        : ["http:", "https:"].includes(origin.protocol) &&
          origin.host === req.headers.host && req.headers.origin === origin.origin;
    } catch {}
    if (!allowed) {
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
    // A school or family Wi-Fi shares one public IP. Forty browser scenarios or
    // several 20-person rooms can legitimately exceed 60 upgrades/minute.
    // Retain a hard per-IP cap plus global socket/room caps to bound abuse.
    if (++limit.count > 240) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  };
  server.on("upgrade", upgrade);
  wss.on("connection", (ws) => {
    let record,
      actor,
      windowStart = Date.now(),
      count = 0;
    let raceWindowStart = 0, raceCount = 0;
    let tapWindowStart = 0, tapCount = 0;
    let trailWindowStart = 0, trailCount = 0;
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => {});
    ws.on("message", (raw) => {
      let fastInput = false;
      try {
        if (Date.now() - windowStart > 10000) {
          windowStart = Date.now();
          count = 0;
        }
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object" || Array.isArray(m))
          throw new Error("Invalid message.");
        const raceInput = !!record && record.party.mode === "race" && record.party.phase === "playing" && m.type === "race_input";
        const tapInput = !!record && record.party.mode === "tap" && record.party.phase === "playing" && m.type === "tap_input";
        const trailInput = !!record && record.party.mode === "trails" && record.party.phase === "playing" && m.type === "trails_input";
        fastInput = raceInput || tapInput || trailInput;
        if (raceInput) {
          if (Date.now() - raceWindowStart >= 1000) { raceWindowStart = Date.now(); raceCount = 0; }
          if (++raceCount > 40) { ws.close(1008, "Racing input limit"); return; }
          if (raw.length > 512) throw new Error("Racing controls are too large.");
        } else if (tapInput) {
          if (Date.now() - tapWindowStart >= 1000) { tapWindowStart = Date.now(); tapCount = 0; }
          if (++tapCount > 18) { ws.close(1008, "Tap input limit"); return; }
          if (raw.length > 256) throw new Error("Tap controls are too large.");
        } else if (trailInput) {
          if (Date.now() - trailWindowStart >= 1000) {trailWindowStart=Date.now();trailCount=0;}
          if (++trailCount > 15) {ws.close(1008,"Trail input limit");return;}
          if (raw.length>256) throw new Error("Trail controls too large.");
        } else if (++count > 60) throw new Error("Too many messages; wait a moment.");
        if (!record) {
          validateHello(m);
          let candidate, id;
          if (m.type === "create") {
            if (rooms.size >= 200) throw new Error("Server is full.");
            const code = roomCode(rooms);
            candidate = {
              party: new Party(code, {
                ...partyOptions,
                ...(Object.hasOwn(m, "quiz") ? { customQuiz: validateGuestQuiz(m.quiz) } : {}),
                ...(Object.hasOwn(m, "show") ? { customShow: validateShow(m.show) } : {}),
              }),
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
          if (fastInput) {
            if (tapInput) {
              const previousRevision = record.party.revision;
              record.party.tick();
              if (record.party.revision !== previousRevision) publish(record);
              acceptTapInput(record.party, actor, m);
            } else if (trailInput) acceptTrailInput(record.party,actor,m);
            else acceptRaceInput(record.party, actor, m);
            return;
          }
          if (m.type === "start" && m.value === "race" && [...rooms.values()].filter(r => r !== record && r.party.mode === "race" && !["lobby", "finished"].includes(r.party.phase)).length >= 4)
            throw new Error("Four races are already running. Try again after a race finishes.");
          const result = record.party.handle(actor, m);
          send(ws, { type: "ack", ...result });
          publish(record);
        }
      } catch (e) {
        send(ws, {
          type: "error",
          message: e instanceof SyntaxError ? "Invalid JSON." : e.message,
        });
        if (!fastInput && record && record.sessions.owns(actor, ws)) publish(record);
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
  // One bounded update loop for admitted live-action rooms. The TV receives
  // public rankings; each phone receives only its own status, never identity tokens.
  const raceTimer = setInterval(() => {
    const now = Date.now();
    for (const record of rooms.values()) {
      const p = record.party;
      if (!["race", "tap", "trails"].includes(p.mode) || p.phase !== "playing") continue;
      const revision = p.revision;
      p.tick();
      if (p.revision !== revision) { publish(record); continue; }
      if (now - (record.raceFrameAt || 0) < (p.mode === "trails" ? 150 : 100)) continue;
      record.raceFrameAt = now;
      for (const [id, ws] of record.sessions.connections())
        if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 16384)
          send(ws, p.mode === "trails" ? trailsFrame(p,id) : p.mode === "tap" ? tapFrame(p, id) : raceFrame(p, id));
    }
  }, 50);
  function cleanup() {
    scheduler.close();
    clearInterval(timer);
    clearInterval(heartbeat);
    clearInterval(raceTimer);
    server.off("upgrade", upgrade);
    server.off("close", cleanup);
    for (const ws of wss.clients) ws.terminate();
  }
  server.once("close", cleanup);
  wss.once("close", cleanup);
  return {
    rooms,
    wss,
    scheduler,
    async close() {
      cleanup();
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}
