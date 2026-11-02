import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { normalizeAnswer, surveyAnswerIndex, categoryAnswerKey } from "../bilingual-answers.js";

function room(mode, count = 3) {
  let now = 1000, sequence = 0;
  const party = new Party("BCDFGH", { clock: () => now, countdownMs: 1 });
  const ids = Array.from({length:count}, (_,index)=>party.join("Guest "+index));
  const action = (actor, type, value) => party.handle(actor, {
    v: 1, type, value, requestId:"bilingual-"+(++sequence),
    matchId:party.matchId, revision:party.revision,
  });
  action("host","start",mode);
  now += 1; party.tick();
  return {party,ids,action};
}

test("Survey Spanish and English equivalents score at the same rank", () => {
  const {party,ids,action} = room("survey");
  action(ids[0],"respond","pasaporte");
  assert.equal(party.view("host").social.topAnswers,undefined);
  assert.equal(JSON.stringify(party.view("host")).includes("pasaporte"),false);
  action(ids[1],"respond","PASSPORT");
  action(ids[2],"respond","pasaporte falso");
  assert.equal(party.phase,"reveal");
  assert.equal(party.players.get(ids[0]).score,100);
  assert.equal(party.players.get(ids[1]).score,100);
  assert.equal(party.players.get(ids[2]).score,0);
  assert.equal(party.view("host").social.topAnswers[0].count,2);
  assert.equal(party.view("host").social.topAnswers[0].text,"Passport");
});

test("Survey supports reviewed Spanish equivalents across all five starter rounds", () => {
  const rounds = [
    ["Passport","pasaporte"],
    ["Popcorn","palomitas de maíz"],
    ["Syrup","miel de maple"],
    ["Towel","toalla"],
    ["Milk","leche"],
  ];
  for(const [round, pair] of rounds.entries()) {
    const canonical=["Passport","Popcorn","Syrup","Towel","Milk"][round];
    assert.equal(surveyAnswerIndex(round, canonical, [canonical]),0);
    assert.equal(surveyAnswerIndex(round, pair[1], [canonical]),0);
  }
  assert.equal(surveyAnswerIndex(0,"pasaporte robado",["Passport"]),-1);
  assert.equal(surveyAnswerIndex(1,"pasaporte",["Popcorn"]),-1);
  assert.equal(surveyAnswerIndex(0,"pasaporte",["Phone charger"]),-1);
  assert.equal(surveyAnswerIndex(0,"unknown",["Passport"]),-1);
  assert.equal(surveyAnswerIndex(0,"",["Passport"]),-1);
});

test("Category Spanish/English equivalents share one uniqueness bucket", () => {
  const {party,ids,action}=room("category");
  action(ids[0],"respond","pineapple");
  action(ids[1],"respond","piña");
  action(ids[2],"respond","plátano");
  assert.equal(party.phase,"reveal");
  assert.equal(party.players.get(ids[0]).score,50);
  assert.equal(party.players.get(ids[1]).score,50);
  assert.equal(party.players.get(ids[2]).score,100);
  assert.equal(party.view("host").bonus.results[1].answer,"piña");
});

test("Category bank retains the letter rule and rejects unknown synonyms", () => {
  const samples = [
    [0,"P",["pineapple","plantain","peach"],"piña","pineapple"],
    [1,"C",["camel","crocodile","cat"],"camello","camel"],
    [2,"B",["berlin","brussels","beijing"],"berlín","berlin"],
    [3,"S",["soup","salmon","steak"],"sopa","soup"],
    [4,"M",["mexico","morocco","mali"],"méxico","mexico"],
  ];
  for(const [round,letter,words,spanish,canonical] of samples) {
    assert.equal(categoryAnswerKey(round, spanish,words,letter),canonical);
    assert.equal(categoryAnswerKey(round,canonical.toUpperCase(),words,letter),canonical);
  }
  assert.equal(categoryAnswerKey(0,"durazno",["peach"],"P"),null);
  assert.equal(categoryAnswerKey(0,"piña colada",["pineapple"],"P"),null);
  assert.equal(categoryAnswerKey(4,"México lindo",["mexico"],"M"),null);
  assert.equal(categoryAnswerKey(0,"piña",["pineapple"],"C"),null);
  assert.equal(categoryAnswerKey(0,"pineapple",["pineapple"],"P"),"pineapple");
  assert.equal(normalizeAnswer("  MÉXICO!! "),"mexico");
});
