import test from "node:test";
import assert from "node:assert/strict";
import { creatorText, creatorError } from "../public/creator-copy.js";
import { validateLocalDeck, importGuestDeck, parseDelimited } from "../public/guest-decks.js";
import { importRazziaQuiz } from "../public/razzia-import.js";

function translatedFailure(run) {
  let error; try { run(); } catch (caught) { error = caught; }
  assert.ok(error instanceof Error, "the real validator must reject the fixture");
  const display = creatorError(error.message, error.name, "es");
  assert.notEqual(display, error.message);
  assert.notEqual(display, creatorText("Something went wrong. Check browser storage.", {}, "es"));
  assert.ok(!display.includes("{"), display);
  assert.equal(creatorError(error.message, error.name, "en"), error.message);
}
const q = { prompt: "Raw question", choices: ["A", "B"], correct: 0, explanation: "" };

test("creator interpolation preserves authored text and uses Spanish singular counts", () => {
  const title = 'Home {count} <script> — Raíces';
  assert.equal(creatorText('Loaded {title}. Saved on this device.', { title }, "es"), `Se ha cargado ${title}. Está guardado en este dispositivo.`);
  assert.equal(creatorText(" · {count} questions · Edit", { count:1 }, "es"), " · 1 pregunta · Editar");
  assert.equal(creatorText(" · {count} questions · Edit", { count:2 }, "es"), " · 2 preguntas · Editar");
});

test("creator maps actual quiz validation failures without changing canonical messages", () => {
  const cases = [null, {title:"",questions:[q]}, {title:"Test",questions:[]}, {title:"Test",questions:[null]},
    ...[{choices:["A"]},{correct:3},{explanation:"x".repeat(241)},{prompt:""},{choices:["A",""]},{seconds:1},{points:-1},{penalty:-1}].map(change=>({title:"Test",questions:[{...q,...change}]}))];
  for (const value of cases) translatedFailure(()=>validateLocalDeck(value));
});

test("creator maps actual delimited and JSON import failures with row numbers intact", () => {
  for (const [name,text] of [["bad.json","{"],["bad.json","{}"],["bad.exe","x"],["bad.csv","Question"],["bad.csv","wrong,header\nx,y"],["bad.csv","Question,OptionA,OptionB,OptionC,Correct\nWhat,A,,C,A"]]) translatedFailure(()=>importGuestDeck(name,text));
  translatedFailure(()=>parseDelimited('"unclosed', ","));
  translatedFailure(()=>parseDelimited(Array.from({length:22},()=>"a,b").join("\n"), ","));
  translatedFailure(()=>importGuestDeck("big.json","x".repeat(128*1024+1)));
});

test("creator maps actual Razzia compatibility failures without changing imports", () => {
  translatedFailure(()=>importRazziaQuiz(null));
  translatedFailure(()=>importRazziaQuiz({subject:"Raw",questions:[],gameMode:"survey"}));
  for (const question of [null, {type:"multi"}, {media:"x"}, {solutions:[]}, {options:{bonus:1}}, {time:1}, {maxPoints:-1}, {penalty:-1}]) {
    const value = question===null ? null : {question:"Raw",answers:["A","B"],solutions:[0],...question};
    translatedFailure(()=>importRazziaQuiz({subject:"Raw",questions:[value]}));
  }
});

test("creator storage failures and unknown native diagnostics use controlled Spanish fallback", () => {
  for (const text of ["Device storage is unavailable.","Cannot open local quiz storage.","Local storage is blocked by another tab.","Local quiz storage failed.","Local quiz storage cancelled.","You can save up to 30 local quizzes. Export and remove one first."])
    assert.notEqual(creatorError(text, "Error", "es"), creatorText("Something went wrong. Check browser storage.", {}, "es"));
  assert.match(creatorError("native diagnostic", "QuotaExceededError", "es"), /está lleno/);
  assert.equal(creatorError("Home", "UnknownError", "en"), "Home");
  assert.equal(creatorError("Home", "UnknownError", "es"), creatorText("Something went wrong. Check browser storage.", {}, "es"));
});

test("creator numeric rules cannot translate arbitrary authored strings embedded in diagnostics", () => {
  assert.equal(creatorError("Question Home: choose the correct answer.", "Error", "es"), creatorText("Something went wrong. Check browser storage.", {}, "es"));
  assert.equal(creatorError("Question 12: choose the correct answer.", "Error", "es"), "Pregunta 12: elige la respuesta correcta.");
});
