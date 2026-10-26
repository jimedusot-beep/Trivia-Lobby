import { WebSocketServer, WebSocket } from "ws";
import { Party, roomCode } from "./engine.js";
import { ParticipantSessions } from "./sessions.js";
import { DeadlineScheduler } from "./scheduler.js";
import { validateHello } from "./protocol.js";
import { validateGuestQuiz } from "./custom-quiz.js";
import { snapshotParty, restoreParty } from "./party-checkpoint.js";
import { deliver, withDeferredDelivery } from "./durable-delivery.js";
class RecoveryStorageError extends Error {}

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
    ws.alive = true;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => {});
    let connectionQueue = Promise.resolve();
    ws.on("message", (raw) => { connectionQueue = connectionQueue.then(async () => {
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
            if (rooms.size >= 200) throw new Error("Server is full.");
            const code = roomCode(rooms);
            if (checkpointStore && await checkpointStore.load("party", code).catch(() => { throw new RecoveryStorageError(); })) throw new Error("Room code is occupied. Please try again.");
            candidate = recordFor(new Party(code, {
                ...partyOptions,
                ...(Object.hasOwn(m, "quiz") ? { customQuiz: validateGuestQuiz(m.quiz) } : {}),
              }), new ParticipantSessions());
            rooms.set(code, candidate);
            id = "host";
          } else {
            candidate = await recover(m.code.toUpperCase());
            if (!candidate) throw new Error("Room expired or not found.");
            if (m.type === "join") {
              await transact(candidate, () => {
                candidate.party.tick();
                id = candidate.party.join(m.name);
                record = candidate; actor = id;
                const token = record.sessions.issue(actor, ws);
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
          await transact(record, () => { const token = record.sessions.issue(actor, ws);
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
          const result = record.party.handle(actor, m);
          send(ws, { type: "ack", ...result });
          publish(record); }, ws);
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
  function cleanup() {
    if (closing) return;
    closing = true;
    scheduler.close();
    clearInterval(timer);
    clearInterval(heartbeat);
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
