import { WebSocketServer, WebSocket } from "ws";
import { createHash } from "node:crypto";
import { Party, roomCode } from "./engine.js";
import { ParticipantSessions } from "./sessions.js";
import { DeadlineScheduler } from "./scheduler.js";
import { validateHello } from "./protocol.js";
import { validateGuestQuiz } from "./custom-quiz.js";
import { validateShow } from "./open-pack/feud.js";
import { acceptRaceInput, raceFrame } from "./open-pack/race.js";
import { acceptTapInput, tapFrame } from "./open-pack/tap.js";
import { acceptTrailInput, trailsFrame } from "./open-pack/trails.js";
import { snapshotParty, restoreParty } from "./party-checkpoint.js";
import { deliver, withDeferredDelivery } from "./durable-delivery.js";
class RecoveryStorageError extends Error {}
// Stable routing for one secret create intent, including after a server restart.
// A PIN is only a route: session authentication still requires the full token.
const entryRoomCode = token => [...createHash("sha256").update(token).digest().subarray(0, 6)]
  .map(byte => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[byte & 31]).join("");

/** Attach the guest transport to an existing HTTP server without claiming other upgrades. */
export function attachPartySocket(server, {
  socketPath = "/socket",
  expectedOrigin = process.env.PUBLIC_ORIGIN,
  partyOptions = {},
  schedulerOptions = {},
  checkpointStore,
} = {}) {
  const scheduler = new DeadlineScheduler({ clock: partyOptions.clock, ...schedulerOptions });
  const rooms = new Map(), limits = new Map(), loading = new Map();
  let closing = false;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32768, perMessageDeflate: false });
  const send = (ws, data) => {
    const frame = JSON.stringify(data);
    deliver(() => { if (ws.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 65536) ws.close(1013, "Slow connection");
      else ws.send(frame);
    } });
  };
  function recordFor(party, sessions, version = null) {
    return { party, sessions, version, queue: Promise.resolve(), saved: null, sockets: new Set() };
  }
  async function recover(code) {
    if (rooms.has(code)) return rooms.get(code);
    if (!checkpointStore) return undefined;
    if (!loading.has(code)) {
      const pending = (async () => {
        const saved = await checkpointStore.load("party", code).catch(() => { throw new RecoveryStorageError(); });
        if (!saved) return undefined;
        if (saved.state?.v !== 1) throw new Error("Unsupported room recovery state.");
        const record = recordFor(restoreParty(code, saved.state.party, partyOptions, saved.savedAt), ParticipantSessions.restore(saved.state.sessions), saved.version);
        if (closing) return undefined;
        if (rooms.size >= 200) throw new Error("Server is full.");
        rooms.set(code, record);
        return record;
      })();
      loading.set(code, pending);
      pending.finally(() => loading.delete(code)).catch(() => {});
    }
    return loading.get(code);
  }
  function failRecovery(record, ws) {
    if (record && rooms.get(record.party.code) === record) {
      rooms.delete(record.party.code);
      scheduler.cancel(record.party.code);
      // Membership includes displaced owners until their deferred close commits.
      const peers = [...record.sockets];
      for (const socket of new Set([...peers, ws].filter(Boolean))) {
        send(socket, { type: "error", message: "Room recovery could not be saved. Please reconnect." });
        socket.close(1013, "Recovery storage unavailable");
      }
    } else if (ws) {
      send(ws, { type: "error", message: "Room recovery is temporarily unavailable. Please reconnect." });
      ws.close(1013, "Recovery storage unavailable");
    }
  }
  function transact(record, operation, ws) {
    const result = record.queue.then(async () => {
      if (closing || rooms.get(record.party.code) !== record) return;
      await withDeferredDelivery(async () => {
        try { await operation(); }
        catch (error) {
          if (!ws) throw error;
          send(ws, { type: "error", message: error instanceof SyntaxError ? "Invalid JSON." : error.message });
          if (record.sessions.owns("host", ws) || [...record.sessions.connections()].some(([, socket]) => socket === ws)) publish(record);
        }
      }, async () => {
        if (!checkpointStore) return;
        const state = { v: 1, party: snapshotParty(record.party), sessions: record.sessions.snapshot() };
        const serialized = JSON.stringify(state);
        if (serialized === record.saved) return;
        const remaining = 600000 - (record.party.clock() - record.party.touched);
        record.version = await checkpointStore.save("party", record.party.code, state, Date.now() + remaining, record.version);
        record.saved = serialized;
      });
    });
    record.queue = result.catch(() => { failRecovery(record, ws); });
    return record.queue;
  }
  function publish(record, { broadcast = true } = {}) {
    if (rooms.get(record.party.code) !== record) return;
    record.sessions.prune(record.party.players);
    if (broadcast) for (const [id, ws] of record.sessions.connections()) {
      send(ws, { type: "state", state: record.party.view(id) });
    }
    const party = record.party;
    const normalDeadline = party.deadline ?? (party.hostWaitAt === null ? null : party.hostWaitAt + 60000);
    const deadline = party.phase === "racing" && party.race
      ? Math.min(normalDeadline ?? Infinity, party.race.nextTick)
      : normalDeadline;
    scheduler.schedule(
      party.code,
      `${party.matchId}:${party.revision}:${party.hostWaitAt}:${party.phase === "racing" ? party.race.nextTick : ""}`,
      deadline,
      () => {
        if (rooms.get(party.code) !== record) return;
        void transact(record, () => { party.tick(); publish(record); });
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
    let connectionQueue = Promise.resolve();
    ws.on("message", (raw) => {
      // Fast controls are transient input. Authoritative positions, accepted
      // actions and championship points are committed on a bounded room tick.
      if (record && ["playing", "reveal"].includes(record.party.phase) && ["race", "tap", "trails"].includes(record.party.mode)) {
        let frame;
        try { frame = JSON.parse(raw.toString()); } catch { frame = null; }
        const isRace = record.party.mode === "race" && frame?.type === "race_input";
        const isTap = record.party.mode === "tap" && frame?.type === "tap_input";
        const isTrail = record.party.mode === "trails" && frame?.type === "trails_input";
        if (isRace || isTap || isTrail) {
          try {
            if (rooms.get(record.party.code) !== record || !record.sessions.owns(actor, ws))
              throw new Error("Connection replaced or room expired.");
            const now = Date.now();
            if (isRace) {
              if (now - raceWindowStart >= 1000) { raceWindowStart = now; raceCount = 0; }
              if (++raceCount > 40) { ws.close(1008, "Racing input limit"); return; }
              if (raw.length > 512) throw new Error("Racing controls are too large.");
              acceptRaceInput(record.party, actor, frame);
            } else if (isTap) {
              if (now - tapWindowStart >= 1000) { tapWindowStart = now; tapCount = 0; }
              if (++tapCount > 18) { ws.close(1008, "Tap input limit"); return; }
              if (raw.length > 256) throw new Error("Tap controls are too large.");
              acceptTapInput(record.party, actor, frame);
            } else {
              if (now-trailWindowStart>=1000){trailWindowStart=now;trailCount=0;}
              if(++trailCount>15){ws.close(1008,"Trail input limit");return;}
              if(raw.length>256)throw new Error("Trail controls too large.");
              acceptTrailInput(record.party,actor,frame);
            }
          } catch (error) { send(ws, { type: "error", message: error.message }); }
          return;
        }
      }
      connectionQueue = connectionQueue.then(async () => {
      try {
        if (Date.now() - windowStart > 10000) {
          windowStart = Date.now();
          count = 0;
        }
        if (++count > 60) throw new Error("Too many messages; wait a moment.");
        const m = JSON.parse(raw.toString());
        if (m?.type === "ping" && Object.keys(m).length === 1) {
          send(ws, { type: "pong", serverNow: Date.now() }); return;
        }
        if (!m || typeof m !== "object" || Array.isArray(m))
          throw new Error("Invalid message.");
        if (!record) {
          validateHello(m);
          let candidate, id;
          if (m.type === "create") {
            const code = m.entryToken ? entryRoomCode(m.entryToken) : roomCode(rooms);
            const recovered = await recover(code);
            candidate = recovered ?? rooms.get(code);
            if (candidate) {
              if (!m.entryToken) throw new Error("Room code is occupied. Please try again.");
              await transact(candidate, () => {
                if (candidate.sessions.actorForToken(m.entryToken) !== "host")
                  throw new Error("Room code is occupied. Please try again.");
                record = candidate; actor = "host";
                record.sessions.resume(actor, m.entryToken, ws);
                record.sockets.add(ws);
                record.party.tick(); record.party.connected(actor, true);
                send(ws, { type: "credential", code, actor, token: m.entryToken });
                publish(record);
              }, ws);
              return;
            }
            if (rooms.size >= 200) throw new Error("Server is full.");
            candidate = recordFor(new Party(code, {
                ...partyOptions,
                ...(Object.hasOwn(m, "quiz") ? { customQuiz: validateGuestQuiz(m.quiz) } : {}),
                ...(Object.hasOwn(m, "show") ? { customShow: validateShow(m.show) } : {}),
              }), new ParticipantSessions());
            rooms.set(code, candidate);
            id = "host";
          } else {
            candidate = await recover(m.code.toUpperCase());
            if (!candidate) throw new Error("Room expired or not found.");
            if (m.type === "join") {
              await transact(candidate, () => {
                candidate.party.tick();
                id = m.entryToken ? candidate.sessions.actorForToken(m.entryToken) : undefined;
                if (id === "host") throw new Error("Invalid player entry credential.");
                let token;
                if (id) {
                  if (!candidate.party.players.has(id)) throw new Error("Participant no longer in this room.");
                  candidate.sessions.resume(id, m.entryToken, ws);
                  candidate.party.connected(id, true);
                  token = m.entryToken;
                } else {
                  id = candidate.party.join(m.name);
                  token = candidate.sessions.issue(id, ws, m.entryToken);
                }
                record = candidate; actor = id;
                record.sockets.add(ws);
                send(ws, { type: "credential", code: record.party.code, actor, token });
                publish(record);
              }, ws);
              return;
            } else {
              await transact(candidate, () => {
                candidate.sessions.resume(m.actor, m.token, ws);
                record = candidate;
                actor = m.actor;
                record.sockets.add(ws);
              // Apply any deadline that elapsed before reconnect. A resumed phone
              // cannot rewind a round or suppress an expired host grace period.
              record.party.tick();
              record.party.connected(actor, true);
              send(ws, { type: "ready", actor });
              publish(record);
              }, ws);
              return;
            }
          }
          record = candidate;
          actor = id;
          await transact(record, () => { const token = record.sessions.issue(actor, ws, m.entryToken);
          record.sockets.add(ws);
          send(ws, {
            type: "credential",
            code: record.party.code,
            actor,
            token,
          });
          publish(record); }, ws);
        } else {
          await transact(record, () => {
          if (
            rooms.get(record.party.code) !== record ||
            !record.sessions.owns(actor, ws)
          )
            throw new Error("Connection replaced or room expired.");
          if (m.type === "start" && m.value === "race" && [...rooms.values()].filter(r => r !== record && r.party.mode === "race" && !["lobby", "finished"].includes(r.party.phase)).length >= 4)
            throw new Error("Four races are already running. Try again after a race finishes.");
          const result = record.party.handle(actor, m);
          send(ws, { type: "ack", ...result });
          publish(record, { broadcast: record.party.phase !== "racing" }); }, ws);
        }
      } catch (e) {
        if (e instanceof RecoveryStorageError) { failRecovery(record, ws); return; }
        send(ws, {
          type: "error",
          message: e instanceof SyntaxError ? "Invalid JSON." : e.message,
        });
      }
    }).catch(() => failRecovery(record, ws)); });
    ws.on("close", () => {
      record?.sockets.delete(ws);
      if (!closing && record) void transact(record, () => {
        if (record.sessions.disconnect(actor, ws)) {
          record.party.connected(actor, false);
          publish(record);
        }
      });
    });
  });
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      if (r.party.clock() - r.party.touched > 600000) {
        scheduler.cancel(code);
        rooms.delete(code);
        r.sessions.closeAll();
        void checkpointStore?.delete("party", code, r.version).catch(() => {});
      }
    }
    for (const [ip, l] of limits) if (now >= l.reset) limits.delete(ip);
    void checkpointStore?.prune().catch(() => {});
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
  // One persisted simulation transaction per active room per 100 ms, rather
  // than per 20 Hz controller. Frames are delivered only after durable commit.
  // A slow database delays frames rather than creating an unbounded write queue.
  const raceTimer = setInterval(() => {
    for (const record of rooms.values()) {
      if (record.raceBusy || !["race", "tap", "trails"].includes(record.party.mode) || record.party.phase !== "playing") continue;
      record.raceBusy = true;
      void transact(record, () => {
        const party = record.party;
        if (!["race", "tap", "trails"].includes(party.mode) || party.phase !== "playing") return;
        const revision = party.revision;
        party.tick();
        if (party.revision !== revision) { publish(record); return; }
        for (const [id, ws] of record.sessions.connections())
          if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 16384)
            send(ws, party.mode === "trails" ? trailsFrame(party,id) : party.mode === "tap" ? tapFrame(party, id) : raceFrame(party, id));
      }).finally(() => { record.raceBusy = false; });
    }
  }, 100);
  function cleanup() {
    if (closing) return;
    closing = true;
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
      await Promise.all([...rooms.values()].map(record => record.queue));
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}
