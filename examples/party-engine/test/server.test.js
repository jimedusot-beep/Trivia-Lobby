import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, {
    origin: `http://127.0.0.1:${port}`,
  });
  const messages = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    messages.push(m);
    for (const w of [...waiters])
      if (w.p(m)) {
        clearTimeout(w.t);
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(m);
      }
  });
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (p) => {
      const m = messages.find(p);
      if (m) return Promise.resolve(m);
      return new Promise((resolve, reject) => {
        const w = { p, resolve };
        w.t = setTimeout(() => {
          waiters.splice(waiters.indexOf(w), 1);
          reject(new Error("Message timeout"));
        }, 3000);
        waiters.push(w);
      });
    },
    open: () => new Promise((resolve) => ws.once("open", resolve)),
  };
}
test(
  "HTTP, three-client quiz, credential resume and forged reconnect isolation",
  { timeout: 10000 },
  async (t) => {
    const app = createPartyServer({
      partyOptions: { countdownMs: 1, quizMs: 10000 },
    });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    t.after(() => app.close());
    const port = app.server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /One code/);
    const host = client(port);
    await host.open();
    host.send({ type: "create" });
    const hc = await host.wait((m) => m.type === "credential");
    let state = (await host.wait((m) => m.type === "state")).state;
    const players = [];
    for (let i = 0; i < 3; i++) {
      const c = client(port);
      await c.open();
      c.send({ type: "join", code: hc.code, name: "Player " + i });
      c.credential = await c.wait((m) => m.type === "credential");
      players.push(c);
    }
    host.send({
      v: 1,
      type: "start",
      requestId: "host-start-1",
      matchId: null,
      revision: state.revision,
      value: "quiz",
    });
    state = (
      await players[0].wait(
        (m) => m.type === "state" && m.state.phase === "question",
      )
    ).state;
    assert.ok(!("correct" in state.question));
    for (const [i, c] of players.entries())
      c.send({
        v: 1,
        type: "answer",
        requestId: "answer-" + i,
        matchId: state.matchId,
        revision: state.revision,
        value: 1,
      });
    const reveal = (
      await host.wait((m) => m.type === "state" && m.state.phase === "reveal")
    ).state;
    assert.ok(reveal.players.every((p) => p.score === 100));
    const attacker = client(port);
    await attacker.open();
    attacker.send({
      type: "resume",
      code: hc.code,
      actor: "host",
      token: "forged",
    });
    assert.match(
      (await attacker.wait((m) => m.type === "error")).message,
      /Invalid/,
    );
    attacker.send({
      v: 1,
      type: "next",
      requestId: "attack-next",
      matchId: state.matchId,
      revision: reveal.revision,
    });
    assert.equal(app.rooms.get(hc.code).party.phase, "reveal");
    players[0].ws.close();
    const resumed = client(port);
    await resumed.open();
    const credential = players[0].credential;
    resumed.send({
      type: "resume",
      code: hc.code,
      actor: credential.actor,
      token: credential.token,
    });
    await resumed.wait((m) => m.type === "ready");
    assert.equal(
      (await resumed.wait((m) => m.type === "state")).state.players.find(
        (p) => p.id === credential.actor,
      ).score,
      100,
    );
  },
);

function controlledClock() {
  let now = 1000;
  const jobs = [];
  return {
    clock: () => now,
    jobs,
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
      for (const job of [...jobs])
        if (!job.cancelled && job.due <= now) {
          job.cancelled = true;
          job.fn();
        }
    },
  };
}
async function partyFixture(t, mode, clock = controlledClock()) {
  const app = createPartyServer({
    partyOptions: { clock: clock.clock, countdownMs: 1 },
    schedulerOptions: clock,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => app.close());
  const port = app.server.address().port,
    host = client(port);
  await host.open();
  host.send({ type: "create" });
  const hc = await host.wait((m) => m.type === "credential");
  const party = app.rooms.get(hc.code).party;
  const players = [];
  for (let i = 0; i < 3; i++) {
    const p = client(port);
    await p.open();
    p.send({ type: "join", code: hc.code, name: `Guest ${i}` });
    p.credential = await p.wait((m) => m.type === "credential");
    players.push(p);
  }
  host.send({
    v: 1,
    type: "start",
    requestId: "start-match",
    matchId: null,
    revision: 0,
    value: mode,
  });
  await host.wait((m) => m.type === "state" && m.state.phase === "countdown");
  clock.advance(1);
  await host.wait(
    (m) =>
      m.type === "state" &&
      m.state.phase === (mode === "quiz" ? "question" : "writing"),
  );
  async function resume(p) {
    const c = client(port);
    await c.open();
    const credential = p.credential;
    c.send({
      type: "resume",
      code: hc.code,
      actor: credential.actor,
      token: credential.token,
    });
    await c.wait((m) => m.type === "ready");
    const snapshot = (await c.wait((m) => m.type === "state")).state;
    c.credential = credential;
    return { client: c, snapshot };
  }
  return { app, party, port, host, hc, players, clock, resume };
}
function action(p, type, requestId, extra = {}) {
  return {
    v: 1,
    type,
    requestId,
    matchId: p.matchId,
    revision: p.revision,
    ...extra,
  };
}

test(
  "phase-aware duel reconnect, stale voting, host expiry and timer cleanup over real sockets",
  { timeout: 10000 },
  async (t) => {
    const f = await partyFixture(t, "duel");
    const { party, host, players, clock, app } = f;
    const writing = await f.resume(players[0]);
    players[0] = writing.client;
    assert.equal(writing.snapshot.phase, "writing");
    assert.equal(writing.snapshot.assignments.length, 2);
    let request = 0;
    for (const player of players) {
      for (const a of party.view(player.credential.actor).assignments) {
        const id = `writing-${++request}`;
        player.send(
          action(party, "write", id, {
            value: "Original response",
            promptIndex: a.promptIndex,
          }),
        );
        await player.wait((m) => m.type === "ack" && m.requestId === id);
      }
    }
    await host.wait(
      (m) =>
        m.type === "state" && m.state.phase === "voting" && m.state.index === 0,
    );
    const voterIndex = players.findIndex(
      (p) => party.view(p.credential.actor).canVote,
    );
    const voting = await f.resume(players[voterIndex]);
    players[voterIndex] = voting.client;
    assert.equal(voting.snapshot.phase, "voting");
    assert.ok(
      voting.snapshot.options.every((o) => !("author" in o) && !("votes" in o)),
    );
    const vote = action(party, "vote", "vote-first", {
      value: voting.snapshot.options[0].id,
    });
    voting.client.send(vote);
    await host.wait(
      (m) =>
        m.type === "state" && m.state.phase === "reveal" && m.state.index === 0,
    );
    const revealed = await f.resume(players[voterIndex]);
    players[voterIndex] = revealed.client;
    assert.ok(
      revealed.snapshot.options.every((o) => typeof o.author === "string"),
    );
    assert.equal(
      revealed.snapshot.players.reduce((n, p) => n + p.score, 0),
      100,
    );
    host.send(action(party, "next", "next-matchup"));
    const current = (
      await host.wait(
        (m) =>
          m.type === "state" &&
          m.state.phase === "voting" &&
          m.state.index === 1,
      )
    ).state;
    revealed.client.send({ ...vote, requestId: "stale-vote" });
    await revealed.client.wait(
      (m) => m.type === "error" && /out of date/.test(m.message),
    );
    assert.equal(party.votes.size, 0);
    assert.equal(party.revision, current.revision);
    await new Promise((resolve) => {
      host.ws.once("close", resolve);
      host.ws.close();
    });
    // Wait for the close notification observed by another client before advancing fake time.
    await revealed.client.wait(
      (m) => m.type === "state" && !m.state.hostConnected,
    );
    clock.advance(20000);
    await revealed.client.wait(
      (m) =>
        m.type === "state" && m.state.phase === "reveal" && m.state.index === 1,
    );
    clock.advance(60000);
    const end = (
      await revealed.client.wait(
        (m) => m.type === "state" && m.state.phase === "finished",
      )
    ).state;
    assert.equal(end.interrupted, true);
    assert.equal(app.scheduler.size, 0);
    const resumedHost = await f.resume({ credential: f.hc });
    assert.equal(resumedHost.snapshot.phase, "finished");
    assert.equal(resumedHost.snapshot.interrupted, true);
    const revision = party.revision;
    for (const job of clock.jobs) job.fn();
    assert.equal(party.revision, revision);
    assert.equal(app.scheduler.size, 0);
  },
);

test(
  "late question closes before the scheduler runs and resynchronizes all clients",
  { timeout: 10000 },
  async (t) => {
    const f = await partyFixture(t, "quiz");
    const { party, host, players, clock } = f;
    const old = action(party, "answer", "late-answer", { value: 1 });
    // Deliberately advance the authoritative clock without dispatching timer callbacks.
    const originalClock = party.clock;
    party.clock = () => originalClock() + 30000;
    players[0].send(old);
    await players[0].wait(
      (m) => m.type === "error" && /out of date/.test(m.message),
    );
    for (const p of players)
      await p.wait((m) => m.type === "state" && m.state.phase === "reveal");
    assert.ok([...party.players.values()].every((p) => p.score === 0));
    host.send(action(party, "next", "next-question"));
    await host.wait(
      (m) =>
        m.type === "state" &&
        m.state.phase === "question" &&
        m.state.index === 1,
    );
    players[0].send({ ...old, requestId: "old-question" });
    await players[0].wait(
      (m) => m.type === "error" && /out of date/.test(m.message),
    );
    assert.equal(party.answers.size, 0);
  },
);
