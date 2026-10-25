import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

const quiz = { title: "Our Custom Party", questions: [
  { prompt: "What is seven minus two?", choices: ["Three", "Five", "Seven"], correct: 1, explanation: "Seven minus two is five." },
  { prompt: "Which is a mammal?", choices: ["Trout", "Whale", "Frog"], correct: 1, explanation: "Whales are mammals." },
]};
function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: `http://127.0.0.1:${port}` });
  const inbox = [], waiters = [];
  ws.on("message", raw => {
    const message = JSON.parse(raw.toString());
    inbox.push(message);
    for (const fn of [...waiters]) fn();
  });
  async function take(predicate) {
    const found = inbox.find(predicate);
    if (found) return found;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiters.splice(waiters.indexOf(check), 1); reject(new Error("Message timeout")); }, 3500);
      function check() {
        const match = inbox.find(predicate);
        if (!match) return;
        clearTimeout(timer);
        waiters.splice(waiters.indexOf(check), 1);
        resolve(match);
      }
      waiters.push(check);
    });
  }
  return { ws, send: data => ws.send(JSON.stringify(data)), take };
}
test("custom quiz crosses WebSocket only after validation and never reveals keys until round close", { timeout: 10000 }, async t => {
  const party = createPartyServer({ partyOptions: { countdownMs: 1, quizMs: 10000 } });
  const clients = [];
  t.after(async () => { clients.forEach(c => c.ws.terminate()); await party.close(); });
  await new Promise(resolve => party.server.listen(0, "127.0.0.1", resolve));
  const port = party.server.address().port;
  async function open() { const c = client(port); clients.push(c); await once(c.ws, "open"); return c; }
  const rejector = await open();
  rejector.send({ type: "create", quiz: { ...quiz, ownerId: "private" } });
  assert.match((await rejector.take(x => x.type === "error")).message, /Invalid custom quiz/);
  assert.equal(party.rooms.size, 0);
  const host = await open();
  host.send({ type: "create", quiz });
  const credential = await host.take(x => x.type === "credential");
  const lobby = (await host.take(x => x.type === "state" && x.state.phase === "lobby")).state;
  assert.equal(lobby.quizTitle, quiz.title);
  assert.equal(lobby.quizLength, 2);
  assert.equal(JSON.stringify(lobby).includes(quiz.questions[0].explanation), false);
  const players = [];
  for (let i = 0; i < 3; i++) {
    const c = await open();
    c.send({ type: "join", code: credential.code, name: "Player " + (i + 1) });
    await c.take(x => x.type === "credential");
    players.push(c);
  }
  host.send({ v: 1, type: "start", requestId: "start-custom", matchId: null, revision: 0, value: "quiz" });
  const question = (await players[0].take(x => x.type === "state" && x.state.phase === "question")).state;
  assert.equal(question.question.prompt, quiz.questions[0].prompt);
  assert.equal(question.question.correct, undefined);
  assert.equal(question.question.explanation, undefined);
  for (let i = 0; i < 3; i++)
    players[i].send({ v: 1, type: "answer", requestId: "answer-custom-" + i,
      matchId: question.matchId, revision: question.revision, value: i === 0 ? 1 : 0 });
  const revealed = (await host.take(x => x.type === "state" && x.state.phase === "reveal")).state;
  assert.equal(revealed.question.correct, 1);
  assert.equal(revealed.players.reduce((s,p) => s + p.score, 0), 100);
  host.send({ v: 1, type: "next", requestId: "next-custom", matchId: revealed.matchId, revision: revealed.revision });
  const second = (await players[0].take(x => x.type === "state" && x.state.phase === "question" && x.state.index === 1)).state;
  assert.equal(second.question.prompt, quiz.questions[1].prompt);
  assert.notEqual(second.question.prompt, "Which shape has exactly three sides?");
  assert.equal(party.rooms.get(credential.code).party.quiz.length, 2);
});
