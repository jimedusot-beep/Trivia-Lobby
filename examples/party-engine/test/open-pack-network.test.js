import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
import { packIds } from "../public/pack-config.js";
function clock() {
  let now = 1000;
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
        const job = jobs.find((j) => !j.cancelled && j.due <= now);
        if (!job) break;
        job.cancelled = true;
        job.fn();
      }
    },
  };
}
function peer(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
      origin: `http://127.0.0.1:${port}`,
    }),
    inbox = [],
    waiters = new Set();
  ws.on("message", (raw) => {
    inbox.push(JSON.parse(raw));
    for (const fn of waiters) fn();
  });
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    wait(predicate) {
      const found = inbox.find(predicate);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(new Error("Timed out waiting for socket event"));
        }, 5000);
        function check() {
          const found = inbox.find(predicate);
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
for (const mode of packIds)
  for (const size of [10, 20])
    test(
      `${mode}: ${size} invited guests, private moves, player/host reconnect and same-room return`,
      { timeout: 30000 },
      async (t) => {
        const time = clock(),
          app = createPartyServer({
            partyOptions: { clock: time.clock, countdownMs: 1 },
            schedulerOptions: time,
          }),
          sockets = [];
        t.after(async () => {
          for (const s of sockets) s.ws.terminate();
          await app.close();
        });
        await new Promise((resolve) =>
          app.server.listen(0, "127.0.0.1", resolve),
        );
        const port = app.server.address().port;
        async function connect() {
          const s = peer(port);
          sockets.push(s);
          await once(s.ws, "open");
          return s;
        }
        let host = await connect();
        host.send({ type: "create" });
        const hostCredential = await host.wait((m) => m.type === "credential");
        const party = app.rooms.get(hostCredential.code).party;
        const players = [];
        for (let n = 0; n < size; n++) {
          const s = await connect();
          s.send({
            type: "join",
            code: hostCredential.code,
            name: `Guest ${n}`,
          });
          const credential = await s.wait((m) => m.type === "credential");
          players.push({ s, credential });
        }
        let request = 0;
        async function send(s, actor, type, value) {
          const requestId = `network-pack-${mode}-${size}-${++request}`;
          s.send({
            v: 1,
            type,
            requestId,
            matchId: party.matchId,
            revision: party.revision,
            ...(value === undefined ? {} : { value }),
          });
          await s.wait((m) => m.type === "ack" && m.requestId === requestId);
        }
        await send(host, "host", "start", mode);
        time.advance(1);
        await host.wait(
          (m) => m.type === "state" && m.state.phase === "playing",
        );
        const first = players[0];
        const forged = await connect();
        forged.send({
          type: "resume",
          code: hostCredential.code,
          actor: first.credential.actor,
          token: "A".repeat(43),
        });
        await forged.wait((m) => m.type === "error");
        const recovered = await connect();
        recovered.send({
          type: "resume",
          code: hostCredential.code,
          actor: first.credential.actor,
          token: first.credential.token,
        });
        await recovered.wait((m) => m.type === "ready");
        players[0].s = recovered;
        const snapshot = (
          await recovered.wait(
            (m) => m.type === "state" && m.state.phase === "playing",
          )
        ).state;
        assert.equal(snapshot.players.length, size);
        assert.doesNotMatch(
          JSON.stringify(snapshot),
          /resumeToken|secretToken|credential/,
        );
        const active = players[0].s,
          id = players[0].credential.actor;
        if (mode === "tap") {
          assert.equal(snapshot.pack.racers, undefined, "Phone may only view its own tap count");
          assert.equal(party.view("host").pack.racers.length, size);
          active.send({ v: 1, type: "tap_input", matchId: party.matchId, heat: party.index, seq: 0 });
          await active.wait(m => m.type === "tap_frame" && m.own?.taps === 1);
        } else if (mode === "trails") {
          assert.equal(snapshot.pack.riders, undefined, "Phone view excludes other riders and trails");
          assert.equal(party.view("host").pack.riders.length, size);
          active.send({v:1,type:"trails_input",matchId:party.matchId,heat:party.index,seq:0,turn:-1});
          await active.wait(m=>m.type==="trails_frame" && m.own?.seq===0);
        } else if (mode === "race") {
          assert.equal(snapshot.pack.karts, undefined);
          assert.equal(party.view("host").pack.karts.length, size);
          active.send({ v: 1, type: "race_input", matchId: party.matchId, heat: party.index, seq: 0,
            steer: 0.5, drift: true, item: false, assist: true });
          await active.wait(m => m.type === "race_frame" && m.own?.seq === 0);
        } else if (mode === "feud") {
          assert.ok(snapshot.pack.board.every((a) => a.hidden));
          assert.equal(snapshot.pack.judge, undefined);
          await send(active, id, "play", { action: "buzz" });
          await send(host, "host", "play", { action: "judge", index: 0 });
          assert.equal(party.pack.pot, 35);
        } else if (mode === "draw") {
          assert.equal(party.view("host").pack.word, undefined);
          await send(active, id, "play", { action: "choose", index: 0 });
          await send(active, id, "play", {
            action: "stroke",
            points: [
              [50, 100],
              [500, 700],
            ],
            color: "#20264b",
            width: 8,
          });
          await send(players[1].s, players[1].credential.actor, "play", {
            action: "guess",
            text: party.pack.word,
          });
          assert.equal(party.pack.solved.size, 1);
          assert.equal(
            party.view(players[2].credential.actor).pack.word,
            undefined,
          );
        } else if (mode === "no-say") {
          const refereeId = players[1].credential.actor;
          assert.equal(snapshot.pack.role, "giver");
          assert(snapshot.pack.card?.word, "Clue-giver phone receives the secret");
          assert(party.view(refereeId).pack.card?.word, "Referee phone receives the same secret");
          assert.equal(party.view("host").pack.card, undefined);
          assert.equal(party.view(players[2].credential.actor).pack.card, undefined);
          await send(players[1].s, refereeId, "play", { action: "correct" });
          assert.equal(party.players.get(id).score, 20);
        } else if (mode === "colors") {
          assert.equal(snapshot.pack.hand.length, 7);
          assert.equal(party.view("host").pack.hand.length, 0);
          assert.equal(Object.hasOwn(snapshot.pack, "deck"), false);
          assert.equal(party.pack.seats.length, 10);
          await send(active, id, "play", { action: "draw" });
        } else if (mode === "table") {
          const card = snapshot.pack.hand[0];
          assert.equal(
            party.view(players[1].credential.actor).pack.seats[0].cards,
            undefined,
          );
          await send(active, id, "play", { action: "play", card: card.id });
          await send(active, id, "play", { action: "bet", amount: 10 });
          await send(host, "host", "play", { action: "settle", seat: 1 });
          assert.equal(party.pack.pot, 0);
        } else if (mode === "backgammon") {
          await send(active, id, "play", { action: "roll" });
          await send(active, id, "play", { action: "move", from: 0, to: 1 });
          await send(active, id, "play", { action: "end-turn" });
          assert.equal(party.pack.points[1], 1);
        } else {
          const table = snapshot.pack.tables[0],
            move = table.legal[0];
          await send(active, id, "play", { action: "move", table: 0, ...move });
          assert.equal(party.pack.tables.length, size / 2);
          assert.equal(party.pack.tables[1].game.moves, 0);
        }
        const before = party.view(id);
        const second = await connect();
        second.send({
          type: "resume",
          code: hostCredential.code,
          actor: id,
          token: first.credential.token,
        });
        await second.wait((m) => m.type === "ready");
        const after = (
          await second.wait(
            (m) => m.type === "state" && m.state.revision === party.revision,
          )
        ).state;
        assert.equal(after.phase, before.phase);
        assert.equal(
          after.players.find((p) => p.id === id).score,
          before.players.find((p) => p.id === id).score,
        );
        if (mode === "draw") assert.equal(after.pack.strokes.length, 1);
        if (mode === "colors" || mode === "table")
          assert.deepEqual(after.pack.hand, before.pack.hand);
        host = await connect();
        host.send({
          type: "resume",
          code: hostCredential.code,
          actor: "host",
          token: hostCredential.token,
        });
        await host.wait((m) => m.type === "ready");
        const restored = (
          await host.wait((m) => m.type === "state" && m.state.role === "host")
        ).state;
        assert.equal(restored.players.length, size);
        await send(host, "host", "play", { action: "end-match" });
        assert.equal(party.phase, "finished");
        await send(host, "host", "lobby");
        assert.equal(party.phase, "lobby");
        assert.equal(party.players.size, size);
      },
    );
