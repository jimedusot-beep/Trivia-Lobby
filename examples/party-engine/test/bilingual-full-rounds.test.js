import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { normalizeAnswer, surveyAnswerIndex, categoryAnswerKey } from "../bilingual-answers.js";

// Exercise the real Party reducer and server projections, not client-side scoring.
function match(mode) {
  let now = 1000, serial = 0;
  const party = new Party("BCDFGH", {clock: () => now, countdownMs: 1});
  const ids = ["Spanish", "English", "Other"].map(name => party.join(name));
  function act(actor, type, value) {
    return party.handle(actor, {
      v: 1, type, value, requestId: "es-round-" + ++serial,
      matchId: party.matchId, revision: party.revision,
    });
  }
  act("host", "start", mode);
  now += 1;
  party.tick();
  return {party, ids, act};
}

const surveyRounds = [
  {english:"Passport", spanish:"pasaporte", wrong:"pasaporte falso"},
  {english:"Popcorn", spanish:"palomitas de maíz", wrong:"palomitas falsas"},
  {english:"Syrup", spanish:"miel de maple", wrong:"miel inventada"},
  {english:"Towel", spanish:"toalla", wrong:"toalla falsa"},
  {english:"Milk", spanish:"leche", wrong:"leche falsa"},
];

test("all five Survey Showdown rounds: bilingual rank, private input, counts, and invalid zero", () => {
  const {party, ids, act} = match("survey");
  for (const [round, sample] of surveyRounds.entries()) {
    assert.equal(party.index, round);
    assert.equal(party.phase, "question");
    const before = ids.map(id => party.players.get(id).score);
    act(ids[0], "respond", sample.spanish);
    const privateView = party.view("host");
    assert.equal(privateView.social.topAnswers, undefined);
    assert.equal(JSON.stringify(privateView).includes(sample.spanish), false);
    assert.equal(party.players.get(ids[0]).score, before[0]);
    act(ids[1], "respond", sample.english.toUpperCase());
    act(ids[2], "respond", sample.wrong);
    assert.equal(party.phase, "reveal");
    for (const id of ids.slice(0,2))
      assert.equal(party.players.get(id).score, before[ids.indexOf(id)] + 100);
    assert.equal(party.players.get(ids[2]).score, before[2]);
    assert.equal(party.view("host").social.topAnswers[0].count, 2);
    assert.equal(party.view("host").social.topAnswers[0].text, sample.english);
    act("host", "next");
  }
  assert.equal(party.phase, "finished");
  assert.deepEqual(ids.map(id => party.players.get(id).score), [500,500,0]);
});

const categoryRounds = [
  {english:"pineapple", spanish:"piña", other:"plátano"},
  {english:"camel", spanish:"camello", other:"capibara"},
  {english:"berlin", spanish:"berlín", other:"bogotá"},
  {english:"soup", spanish:"sopa", other:"salchicha"},
  {english:"mexico", spanish:"méxico", other:"malasia"},
];

test("all five Category Clash rounds: English/Spanish duplicates share 50, unique gets 100", () => {
  const {party,ids,act} = match("category");
  for (const [round,sample] of categoryRounds.entries()) {
    assert.equal(party.index,round);
    const before=ids.map(id=>party.players.get(id).score);
    act(ids[0],"respond",sample.spanish);
    assert.equal(party.phase,"question");
    assert.equal(party.view("host").bonus.allowed,undefined);
    assert.equal(party.view("host").bonus.results,undefined);
    assert.equal(JSON.stringify(party.view("host")).includes(sample.spanish),false);
    act(ids[1],"respond",sample.english.toUpperCase());
    act(ids[2],"respond",sample.other);
    assert.equal(party.phase,"reveal");
    const results=party.view("host").bonus.results;
    assert.deepEqual(results.map(x=>x.points),[50,50,100]);
    assert.equal(results[0].answer,sample.spanish);
    assert.equal(results[1].answer,sample.english.toUpperCase());
    assert.deepEqual(ids.map(id=>party.players.get(id).score-before[ids.indexOf(id)]),[50,50,100]);
    act("host","next");
  }
  assert.equal(party.phase,"finished");
  assert.deepEqual(ids.map(id=>party.players.get(id).score),[250,250,500]);
});

test("regional survey synonyms and accent variants stay exact, not fuzzy", () => {
  assert.equal(normalizeAnswer("  PALÓMITAS de MAÍZ!! "),"palomitas de maiz");
  assert.equal(normalizeAnswer(null),"");
  assert.equal(surveyAnswerIndex(1,"POCHOCLO",["Popcorn","Seats","Screen","Tickets","Soda"]),0);
  assert.equal(surveyAnswerIndex(1,"crispetas",["Popcorn","Seats","Screen","Tickets","Soda"]),0);
  assert.equal(surveyAnswerIndex(0,"boletos de avión",["Passport","Toothbrush","Phone charger","Tickets","Sunscreen"]),3);
  assert.equal(surveyAnswerIndex(2,"jarabe de maple",["Syrup","Butter","Fruit","Chocolate","Whipped cream"]),0);
  assert.equal(surveyAnswerIndex(1,"pochoclo falso",["Popcorn"]),-1);
  assert.equal(surveyAnswerIndex(1,"pasaporte",["Popcorn"]),-1);
  assert.equal(surveyAnswerIndex(0,"",["Passport"]),-1);
  assert.equal(surveyAnswerIndex(99,"pasaporte",["Passport"]),-1);
  assert.equal(surveyAnswerIndex(0,{},["Passport"]),-1);
});

test("invalid, wrong-letter, and unknown category responses score zero without affecting duplicates", () => {
  const {party,ids,act}=match("category");
  act(ids[0],"respond","piña");
  act(ids[1],"respond","PIÑA COLADA");
  act(ids[2],"respond","durazno");
  assert.equal(party.phase,"reveal");
  assert.deepEqual(ids.map(id=>party.players.get(id).score),[100,0,0]);
  assert.deepEqual(party.view("host").bonus.results.map(x=>x.points),[100,0,0]);
  assert.equal(categoryAnswerKey(0,"durazno",["peach"],"P"),null);
  assert.equal(categoryAnswerKey(0,"piña",["pineapple"],"C"),null);
  assert.equal(categoryAnswerKey(4,"mÉxIcO",["mexico"],"M"),"mexico");
  assert.equal(categoryAnswerKey(4,"mexico lindo",["mexico"],"M"),null);
  assert.equal(categoryAnswerKey(4,"Marruecos",["morocco"],"M"),"morocco");
  assert.equal(categoryAnswerKey(4,"Marruecos",["mexico"],"M"),null);
  assert.equal(categoryAnswerKey(1,"camello",["camel"],"C"),"camel");
  assert.equal(categoryAnswerKey(1,"camello",["camel"],"P"),null);
  assert.equal(categoryAnswerKey(-1,"camello",["camel"],"C"),null);
});

test("duplicate player submissions cannot earn points twice in either game", () => {
  for (const [mode,answer] of [["survey","pasaporte"],["category","piña"]]) {
    const {party,ids,act}=match(mode);
    act(ids[0],"respond",answer);
    assert.throws(()=>act(ids[0],"respond",answer),/already locked|Submission closed/i);
    act(ids[1],"respond",answer);
    act(ids[2],"respond","wrong answer");
    const expected=mode==="survey"?[100,100,0]:[50,50,0];
    assert.deepEqual(ids.map(id=>party.players.get(id).score),expected);
  }
});
