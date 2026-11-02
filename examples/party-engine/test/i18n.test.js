import assert from "node:assert/strict";
import test from "node:test";
import { getLocale, setLocale, t, localizeState, localizeGame, spanishContentModes } from "../public/i18n.js";

test("English is the default and unknown languages cannot change it", () => {
  assert.equal(getLocale(), "en");
  assert.equal(setLocale("fr"), false);
  assert.equal(t("Start match"), "Start match");
});

test("Spanish quiz keeps canonical answer indexes and source input unchanged", () => {
  setLocale("es");
  const source = { mode:"quiz", quizTitle:"Sample Quiz", role:"guest", phase:"question",
    question: {prompt:"Which shape has exactly three sides?",
      choices:["Circle","Triangle","Square","Pentagon"],seconds:30,points:100,correct:1} };
  const view = localizeState(source);
  assert.equal(view.question.prompt, "¿Qué figura tiene exactamente tres lados?");
  assert.equal(view.question.choices[1], "Triángulo");
  assert.equal(view.question.correct, 1);
  assert.equal(view.question.seconds, 30);
  assert.notEqual(view.question, source.question);
  assert.deepEqual(source.question.choices, ["Circle","Triangle","Square","Pentagon"]);
});

test("Imported quizzes and mismatched answer lists never get translated", () => {
  const imported = { mode:"quiz", quizTitle:"Our quiz",
    question:{prompt:"Which shape has exactly three sides?",choices:["A","B","C","D"]} };
  assert.equal(localizeState(imported).question, imported.question);
  const modified = {mode:"quiz",quizTitle:"Sample Quiz",question:imported.question};
  assert.equal(localizeState(modified).question, imported.question);
});

test("Charades keeps clue IDs and never reveals clues to observers", () => {
  const actor = {mode:"charades",charades:{canMark:true,
    clue:{id:"hidden-id",text:"Brushing your teeth"},history:[{text:"Penguin",result:"correct"}]}};
  const display=localizeState(actor);
  assert.equal(display.charades.clue.id, "hidden-id");
  assert.equal(display.charades.clue.text, "Cepillarse los dientes");
  assert.equal(display.charades.history[0].text, "Pingüino");
  assert.equal(actor.charades.clue.text, "Brushing your teeth");
  const observer={mode:"charades",charades:{canMark:false}};
  assert.equal(localizeState(observer).charades.clue, undefined);
});

test("Majority, Likely and Closest keep their score-significant values", () => {
  const majority={mode:"majority",social:{kind:"majority",prompt:"Should pineapple go on pizza?",
    choices:["Yes","No"],winners:[0]}};
  const vm=localizeState(majority);
  assert.deepEqual(vm.social.choices, ["Sí","No"]);
  assert.deepEqual(vm.social.winners, [0]);
  const likely={mode:"likely",social:{kind:"likely",
    prompt:"Who is most likely to win a game show?",candidates:[{id:"actor-1",name:"María"}]}};
  assert.equal(localizeState(likely).social.candidates[0].id, "actor-1");
  const closest={mode:"closest",social:{kind:"closest",
    prompt:"How many keys are on a standard modern piano?",target:88,unit:"keys",
    guesses:[{name:"Sam",value:87}]}};
  const vc=localizeState(closest);
  assert.equal(vc.social.unit, "teclas");
  assert.equal(vc.social.target, 88);
  assert.deepEqual(vc.social.guesses, closest.social.guesses);
});

test("No translation of unsupported modes or user-authored values", () => {
  const state={mode:"survey",social:{kind:"survey",prompt:"User prompt",topAnswers:[{text:"Sí"}]}};
  assert.equal(localizeState(state).social, state.social);
  const game={id:"quiz",name:"Trivia Quiz"};
  assert.equal(localizeGame(game).name, "Trivia");
  assert.equal(game.name, "Trivia Quiz");
  assert.deepEqual(spanishContentModes, ["quiz","charades","majority","likely","closest","survey","category"]);
  setLocale("en");
  assert.equal(localizeState(state), state);
  assert.equal(t("Start match"), "Start match");
});

test("Survey and Category translations keep server scoring and player submissions untouched", () => {
  setLocale("es");
  const survey = {mode:"survey",social:{kind:"survey",
    prompt:"Name something people might forget when going on vacation.",
    topAnswers:[{text:"Passport",points:100,count:2}],
    locked:true,received:3,expected:3}};
  const ds=localizeState(survey);
  assert.match(ds.social.prompt,/vacaciones/);
  assert.equal(ds.social.topAnswers[0].text,"Pasaporte");
  assert.equal(ds.social.topAnswers[0].points,100);
  assert.equal(ds.social.topAnswers[0].count,2);
  assert.equal(survey.social.topAnswers[0].text,"Passport");

  const category={mode:"category",bonus:{kind:"category",
    prompt:"Name a fruit starting with P.",
    allowed:["peach","pineapple"],
    results:[{name:"María",answer:"piña",points:50}]}};
  const dc=localizeState(category);
  assert.match(dc.bonus.prompt,/inglés o español/);
  assert.deepEqual(dc.bonus.allowed,["peach","pineapple / piña"]);
  assert.equal(dc.bonus.results[0].answer,"piña");
  assert.equal(dc.bonus.results[0].points,50);
  assert.equal(category.bonus.allowed[1],"pineapple");
  const unknown={mode:"survey",social:{kind:"survey",prompt:"My original prompt"}};
  assert.equal(localizeState(unknown).social,unknown.social);
  setLocale("en");
  assert.equal(localizeState(survey),survey);
});
