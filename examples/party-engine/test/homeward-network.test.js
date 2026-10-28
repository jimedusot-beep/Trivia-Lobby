import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
function fakeClock() {
  let now = Date.now();
  const jobs = [];
  return {
    clock: () => now,
    setTimer(fn, delay) {
      const job = { fn, due: now + delay };
      jobs.push(job);
      return job;
    },
    clearTimer(job) {
      job.cancelled = true;
    },
    advance(ms) {
      now += ms;
      for (let n = 0; n < 100; n++) {
        const job = jobs.find((job) => !job.cancelled && job.due <= now);
        if (!job) break;
        job.cancelled = true;
        job.fn();
      }
    },
  };
}
async function socket(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
      origin: `http://127.0.0.1:${port}`,
    }),
    messages = [],
    waiters = new Set();
  let largest = 0;
  ws.on("message", (raw) => {
    largest = Math.max(largest, raw.length);
    messages.push(JSON.parse(raw));
    for (const listener of waiters) listener();
  });
  await once(ws, "open");
  return {
    ws,
    send: (value) => ws.send(JSON.stringify(value)),
    largest: () => largest,
    wait(predicate) {
      const prior = messages.find(predicate);
      if (prior) return Promise.resolve(prior);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(Error("Homeward socket event timed out"));
        }, 5000);
        function check() {
          const found = messages.find(predicate);
          if (found) {
            clearTimeout(timer);
            waiters.delete(check);
            resolve(found);
          }
        }
        waiters.add(check);
      });
    },
  };
}
async function server(time, checkpointStore) {
  const app = createPartyServer({
    expectedOrigin: "",
    partyOptions: { clock: time.clock, countdownMs: 1 },
    schedulerOptions: time,
    checkpointStore,
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  return app;
}
async function setup(app, time, count, all) {
  const port = app.server.address().port,
    host = await socket(port);
  all.push(host);
  host.send({ type: "create" });
  const credential = await host.wait((m) => m.type === "credential"),
    players = [];
  for (let i = 0; i < count; i++) {
    const peer = await socket(port);
    all.push(peer);
    peer.send({ type: "join", code: credential.code, name: `Socket ${i + 1}` });
    players.push({
      peer,
      credential: await peer.wait((m) => m.type === "credential"),
    });
  }
  const party = app.rooms.get(credential.code).party;
  const request = {
    v: 1,
    type: "start",
    value: "homeward",
    requestId: "homeward-network-start",
    matchId: null,
    revision: party.revision,
  };
  host.send(request);
  await host.wait((m) => m.type === "ack" && m.requestId === request.requestId);
  time.advance(1);
  await host.wait((m) => m.type === "state" && m.state.phase === "playing");
  return { host, credential, players, party };
}
test(
  "twenty real guests draw and move concurrently on five isolated boards within bounded frames",
  { timeout: 30000 },
  async (t) => {
    const time = fakeClock(),
      app = await server(time),
      all = [];
    t.after(async () => {
      for (const peer of all) peer.ws.terminate();
      await app.close();
    });
    const { players, party } = await setup(app, time, 20, all),
      delays = [];
    let request = 0;
    for (let round = 0; round < 3; round++) {
      const base = party.revision;
      const actors = party.pack.tables.map((board, index) => ({
        board,
        index,
        peer: players.find(
          (player) => player.credential.actor === board.seats[board.turn].id,
        ).peer,
      }));
      await Promise.all(
        actors.map(async ({ board, index, peer }) => {
          const id = `homeward-concurrent-${++request}`,
            start = performance.now();
          peer.send({
            v: 1,
            type: "play",
            requestId: id,
            matchId: party.matchId,
            revision: base,
            value: {
              action: "draw",
              table: index,
              tableVersion: board.version,
            },
          });
          await peer.wait((m) => m.type === "ack" && m.requestId === id);
          delays.push(performance.now() - start);
        }),
      );
      const sameRevision = party.revision;
      await Promise.all(
        actors.map(async ({ board, index, peer }) => {
          const actor = board.seats[board.turn].id,
            view = party.view(actor).pack.tables[0],
            id = `homeward-concurrent-${++request}`,
            start = performance.now();
          const value = view.moves.length
            ? {
                action: "move",
                table: index,
                tableVersion: board.version,
                moveId: view.moves[0].id,
              }
            : { action: "pass", table: index, tableVersion: board.version };
          peer.send({
            v: 1,
            type: "play",
            requestId: id,
            matchId: party.matchId,
            revision: sameRevision,
            value,
          });
          await peer.wait((m) => m.type === "ack" && m.requestId === id);
          delays.push(performance.now() - start);
        }),
      );
    }
    for (const board of party.pack.tables)
      assert.equal(board.history.length, 3);
    for (const player of players) {
      const view = party.view(player.credential.actor);
      assert.equal(view.pack.tables.length, 1);
      assert.doesNotMatch(JSON.stringify(view), /"deck":|"discards":/);
    }
    assert(all.every((peer) => peer.largest() < 32768));
    delays.sort((a, b) => a - b);
    const p95 = delays[Math.ceil(delays.length * 0.95) - 1];
    t.diagnostic(
      JSON.stringify({
        clients: 20,
        boards: 5,
        acknowledgedActions: delays.length,
        largestFrameBytes: Math.max(...all.map((peer) => peer.largest())),
        localAckP95Ms: Number(p95.toFixed(2)),
      }),
    );
  },
);
test(
  "a server restart restores the same secret deck and active card before authenticated play resumes",
  { timeout: 30000 },
  async (t) => {
    const time = fakeClock(),
      records = new Map(),
      all = [],
      apps = [];
    const store = {
      async load(kind, code) {
        const row = records.get(kind + code);
        return row ? structuredClone(row) : null;
      },
      async save(kind, code, state, _expires, expected) {
        const prior = records.get(kind + code);
        if ((prior?.version ?? null) !== expected)
          throw Error("Checkpoint conflict");
        const version = (prior?.version ?? 0) + 1;
        records.set(kind + code, {
          version,
          state: structuredClone(state),
          savedAt: time.clock(),
        });
        return version;
      },
    };
    t.after(async () => {
      for (const peer of all) peer.ws.terminate();
      for (const app of apps) await app.close();
    });
    const first = await server(time, store);
    apps.push(first);
    const f = await setup(first, time, 4, all),
      board = f.party.pack.tables[0],
      player = f.players.find(
        (player) => player.credential.actor === board.seats[board.turn].id,
      ),
      requestId = "homeward-before-restart";
    player.peer.send({
      v: 1,
      type: "play",
      requestId,
      matchId: f.party.matchId,
      revision: f.party.revision,
      value: { action: "draw", table: 0, tableVersion: board.version },
    });
    await player.peer.wait(
      (m) => m.type === "ack" && m.requestId === requestId,
    );
    const deck = [...board.deck],
      card = board.card,
      version = board.version,
      match = f.party.matchId;
    await first.close();
    apps.splice(apps.indexOf(first), 1);
    const next = await server(time, store);
    apps.push(next);
    const peer = await socket(next.server.address().port);
    all.push(peer);
    peer.send({
      type: "resume",
      code: f.credential.code,
      actor: player.credential.actor,
      token: player.credential.token,
    });
    await peer.wait((m) => m.type === "ready");
    const state = (
        await peer.wait(
          (m) => m.type === "state" && m.state.pack?.kind === "homeward",
        )
      ).state,
      recovered = next.rooms.get(f.credential.code).party;
    assert.equal(state.matchId, match);
    assert.equal(state.pack.tables[0].card, card);
    assert.equal(state.pack.tables[0].version, version);
    assert.deepEqual(recovered.pack.tables[0].deck, deck);
    assert.doesNotMatch(JSON.stringify(state), /"deck":/);
    const move = state.pack.tables[0].moves[0];
    assert(move);
    peer.send({
      v: 1,
      type: "play",
      requestId: "homeward-after-restart",
      matchId: state.matchId,
      revision: state.revision,
      value: {
        action: "move",
        table: 0,
        tableVersion: version,
        moveId: move.id,
      },
    });
    await peer.wait(
      (m) => m.type === "ack" && m.requestId === "homeward-after-restart",
    );
    assert.equal(recovered.pack.tables[0].history.length, 1);
  },
);
