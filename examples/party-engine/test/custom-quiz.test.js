import test from "node:test";
import assert from "node:assert/strict";
import { validateGuestQuiz } from "../custom-quiz.js";
import { validateHello } from "../protocol.js";
import { Party } from "../engine.js";
import { validateLocalDeck, backupGuestDeck, csvGuestDeck, importGuestDeck } from "../public/guest-decks.js";

const custom = {
  title: "Our Family Trivia",
  questions: [
    { prompt: "Which fruit is yellow?", choices: ["Apple", "Banana", "Pear"], correct: 1, explanation: "Bananas are often yellow." },
    { prompt: "How many sides?", choices: ["Three", "Four"], correct: 0, explanation: "This shape has three sides." },
  ],
};
test("CSV/JSON backup roundtrip and proper quoted fields", () => {
  const source = { ...custom, questions: [
    { prompt: 'Say "hello", please', choices: ["A, with comma", "B"], correct: 0, explanation: "Quotation marks matter." },
  ] };
  const json = importGuestDeck("quiz.json", backupGuestDeck(source));
  assert.deepEqual(json, validateLocalDeck(source));
  const csv = importGuestDeck("quiz.csv", csvGuestDeck(source));
  assert.deepEqual(csv.questions, json.questions);
  assert.equal(csv.questions[0].prompt, 'Say "hello", please');
  const tsv = "Question\tOptionA\tOptionB\tCorrect\tExplanation\nWhat planet?\tEarth\tMars\tB\tThe red planet";
  assert.equal(importGuestDeck("planet.tsv", tsv).questions[0].correct, 1);
  const txt = "Question|OptionA|OptionB|Correct\nSky?|Blue|Green|A";
  assert.equal(importGuestDeck("note.txt", txt).questions[0].prompt, "Sky?");
});

test("rejects ambiguous, oversized, or maliciously structured guest imports", () => {
  assert.throws(() => importGuestDeck("quiz.json", JSON.stringify(custom)), /Trivia Lobby local quiz JSON/);
  assert.throws(() => importGuestDeck("bad.csv", "Question,OptionA,OptionB,OptionC,Correct\nWhich?,A,,C,C"), /no gaps/);
  assert.throws(() => importGuestDeck("bad.csv", "Question,OptionA,OptionB,Correct\nQ,A,B,D"), /choose the correct answer/);
  assert.throws(() => importGuestDeck("quiz.csv", "Question,OptionA,OptionB,Correct\n" + "Q,A,B,A\n".repeat(25)), /Import at most/);
  assert.throws(() => validateGuestQuiz({ title: "X", questions: custom.questions, ownerId: "private" }), /Invalid custom quiz/);
  assert.throws(() => validateGuestQuiz({ ...custom, questions: Array.from({length: 21}, () => custom.questions[0]) }), /Use 1–20/);
  assert.throws(() => validateHello({type: "create", quiz: { title: "X", questions: [{prompt: "Bad",choices:["Only one"],correct:0,explanation:""}]}}), /2–4/);
  assert.throws(() => validateHello({type: "create", quiz: custom, role: "admin"}), /Unknown message field/);
});

test("custom quiz is room-local, graded on server, and never leaks its key before reveal", () => {
  const q = validateGuestQuiz(custom);
  let now = 1000;
  const party = new Party("ABC234", { customQuiz: q, clock: () => now, countdownMs: 1 });
  const ids = ["Sam", "Pat", "Lee"].map(name => party.join(name));
  const act = (actor, type, extra = {}) => party.handle(actor, {
    v: 1, type, requestId: `request-${Math.random().toString(36).slice(2, 12)}`,
    matchId: party.matchId, revision: party.revision, ...extra,
  });
  act("host", "start", {value:"quiz"});
  now += 1; party.tick();
  assert.equal(party.view(ids[0]).question.prompt, custom.questions[0].prompt);
  assert.equal(party.view("host").quizTitle, custom.title);
  assert.equal(party.view("host").quizLength, 2);
  assert.equal(JSON.stringify(party.view(ids[0])).includes("Bananas are often yellow."), false);
  assert.equal("correct" in party.view(ids[0]).question, false);
  act(ids[0], "answer", {value:1});
  act(ids[1], "answer", {value:0});
  act(ids[2], "answer", {value:0});
  assert.equal(party.view(ids[0]).question.correct, 1);
  assert.equal(party.players.get(ids[0]).score, 100);
  act("host", "next");
  assert.equal(party.view(ids[0]).question.prompt, custom.questions[1].prompt);
  now += 30000; party.tick();
  act("host", "next");
  assert.equal(party.phase, "finished");
  const defaultRoom = new Party("XYZ234");
  assert.equal(defaultRoom.quiz.length, 5);
  assert.notEqual(defaultRoom.quizTitle, custom.title);
});
