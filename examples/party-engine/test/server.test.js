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
