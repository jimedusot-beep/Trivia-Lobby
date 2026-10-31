import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { quiz, prompts } from "../content.js";
import { extraSocial, extraBonus } from "../content-extra.js";
import { contentAt, matchContent } from "../content-rotation.js";
import { originalFeudShows } from "../open-pack/feud-content.js";
import { CHARADES_PACKS } from "../charades.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
import { defaultShow } from "../public/show-format.js";

function room(mode, settings = {}) {
  let now = 1000, requests = 0;
  const p = new Party("ABC234", { clock: () => now, ...settings });
  const ids = ["Guest 0","Guest 1","Guest 2"].map(n => p.join(n));
  const send = (actor, type, value, extra={}) => {
    const packet={v:1,type,requestId:"content-"+(++requests),matchId:p.matchId,revision:p.revision,
      ...(value===undefined?{}:{value}),...extra};
    p.handle(actor,packet);
  };
  const start = (game=mode) => { send("host","start",game); now+=3000; p.tick(); };
  start();
  return {p,ids,send,start,advance(ms){now+=ms;p.tick();},get now(){return now;}};
}

test("original quiz bank contains diverse verified answer options, without a round-length increase",()=>{
  assert.ok(quiz.length >= 110, "expected at least 110 original and generated quiz questions");
  assert.equal(new Set(quiz.map(q=>q.prompt)).size,quiz.length);
  for (const q of quiz) {
    assert.equal(q.choices.length,4);
    assert.equal(new Set(q.choices).size,4,"duplicate answer option in "+q.prompt);
    assert.ok(Number.isInteger(q.correct) && q.correct>=0 && q.correct<4);
    assert.ok(q.explanation.length>10);
    const arithmetic=q.prompt.match(/^What is (\d+) multiplied by (\d+)\?$/);
    if (arithmetic) assert.equal(Number(q.choices[q.correct]),Number(arithmetic[1])*Number(arithmetic[2]));
  }
  assert.ok(prompts.length>=55);
  assert.equal(new Set(prompts).size,prompts.length);
  const r=room("quiz");
  assert.equal(r.p.quiz.length,5);
  assert.equal(r.p.quiz[0].prompt,quiz[0].prompt,"first round stays backward compatible");
});

test("fixed five-round games select a fresh, repeat-free group on same-party rematch",()=>{
  const x=room("quiz"), first=x.p.quiz.map(q=>q.prompt);
  for(let n=0;n<5;n++){
    for(const id of x.ids)x.send(id,"answer",0);
    assert.equal(x.p.phase,"reveal");
    x.send("host","next");
  }
  assert.equal(x.p.phase,"finished");
  assert.equal(x.p.championship.games.length,1);
  x.send("host","lobby");
  x.start("quiz");
  const second=x.p.quiz.map(q=>q.prompt);
  assert.equal(second.length,5);
  assert.equal(new Set(second).size,5);
  assert.equal(second.some(text=>first.includes(text)),false);
  assert.equal(second[0],quiz[5].prompt);
});

test("social and writing-mode rematches rotate without changing server-owned scoring",()=>{
  const a=room("majority");
  const first=a.p.view("host").social.prompt;
  for(let n=0;n<5;n++){
    for(const id of a.ids)a.send(id,"respond",0);
    assert.equal(a.p.phase,"reveal");
    a.send("host","next");
  }
  assert.equal(a.p.phase,"finished");
  a.send("host","lobby");
  a.start("majority");
  assert.notEqual(a.p.view("host").social.prompt,first);
  const b=room("duel");
  assert.equal(b.p.pairs.length,3);
  assert.equal(b.p.pairs[0].prompt,prompts[0]);
  assert.ok(extraSocial.majority.length>=25);
  assert.ok(extraSocial.likely.length>=25);
  assert.ok(extraSocial.closest.length>=20);
  assert.ok(extraSocial.survey.length>=20);
  assert.ok(extraSocial.impostor.length>=25);
});

test("category and percentage packs preserve baseline round rules with more original content",()=>{
  assert.ok(extraBonus.polls.length>=20);
  assert.ok(extraBonus.categories.length>=10);
  assert.ok(extraBonus.timelines.length>=10);
  assert.ok(extraBonus.captions.length>=20);
  const x=room("category");
  const initial=x.p.view("host").bonus.prompt;
  assert.match(initial,/fruit starting with P/);
  for(let n=0;n<5;n++){
    for(const id of x.ids)x.send(id,"respond","unmatched");
    assert.equal(x.p.phase,"reveal");
    x.send("host","next");
  }
  assert.equal(x.p.phase,"finished");
  x.send("host","lobby");
  x.start("category");
  assert.notEqual(x.p.view("host").bonus.prompt,initial);
});

test("Bingo cards are winnable from 20 calls drawn from the expanded word bank",()=>{
  const x=room("bingo");
  const calls=x.p.bonusBingo.calls;
  assert.equal(calls.length,20);
  assert.equal(new Set(calls).size,20);
  assert.ok(extraBonus.bingo.length>=40);
  for(const {cells} of x.p.bonusBingo.cards.values()) {
    assert.equal(cells.length,16);
    assert.equal(new Set(cells).size,16);
    assert.ok(cells.every(word=>calls.includes(word)));
  }
  for(let i=0;i<20;i++){
    const word=calls[i];
    for(const id of x.ids) {
      const card=x.p.bonusBingo.cards.get(id);
      const j=card.cells.indexOf(word);
      if(j>=0)x.send(id,"respond",j);
    }
    if(x.p.phase==="question")x.advance(12000);
    assert.equal(x.p.phase,"reveal");
    x.send("host","next");
  }
  assert.equal(x.p.phase,"finished");
  assert.ok(x.ids.every(id=>x.p.players.get(id).score===100));
});

test("rotating content stays stable across checkpoints and custom question packs remain untouched",()=>{
  const x=room("quiz");
  const before=x.p.quiz.map(q=>q.prompt);
  const state=snapshotParty(x.p);
  const restored=restoreParty("ABC234",state,{clock:()=>x.now},x.now);
  assert.deepEqual(restored.quiz.map(q=>q.prompt),before);
  assert.equal(restored.usesDemoQuiz,true);
  const custom={title:"Our Family",questions:[{
    prompt:"Which answer is our favorite?",choices:["A","B"],correct:1,explanation:"A private family quiz."
  }]};
  const c=room("quiz",{customQuiz:custom});
  assert.equal(c.p.usesDemoQuiz,false);
  assert.equal(c.p.quiz.length,1);
  assert.equal(c.p.quiz[0].prompt,custom.questions[0].prompt);
  const ownShow={...defaultShow,title:"Family Special"};
  const f=room("feud",{customShow:ownShow});
  assert.equal(f.p.usesDefaultShow,false);
  assert.equal(f.p.show.title,"Family Special");
});

test("original show banks and other content pools are bounded and coherent",()=>{
  assert.equal(originalFeudShows.length,5);
  for(const show of originalFeudShows) {
    assert.equal(show.rounds.length,3);
    assert.equal(show.final.length,5);
    for(const board of [...show.rounds,...show.final]) {
      assert.equal(board.answers.reduce((sum,a)=>sum+a.points,0),100);
      assert.equal(new Set(board.answers.map(a=>a.text.toLowerCase())).size,board.answers.length);
    }
  }
  const f=room("feud");
  assert.equal(f.p.show.rounds[0].question,defaultShow.rounds[0].question);
  assert.ok(CHARADES_PACKS.actions.length>=32);
  assert.ok(CHARADES_PACKS.animals.length>=32);
  assert.equal(new Set(CHARADES_PACKS.actions).size,CHARADES_PACKS.actions.length);
  assert.equal(new Set(CHARADES_PACKS.animals).size,CHARADES_PACKS.animals.length);
  assert.ok(extraBonus.contenders.length>=32);
  assert.equal(new Set(extraBonus.contenders).size,extraBonus.contenders.length);
  const p=room("bracket");
  assert.equal(p.p.bonusBracket.stage.length,16,"bracket still uses 16 contestants");
});

test("legacy snapshots keep their custom quizzes and show packs when selection flags are absent",()=>{
  const custom={title:"Special family quiz",questions:[{
    prompt:"Our question?",choices:["No","Yes"],correct:1,explanation:"Family answer."
  }]};
  const a=room("quiz",{customQuiz:custom});
  const oldQuiz=snapshotParty(a.p);
  delete oldQuiz.usesDemoQuiz;
  const recoveredQuiz=restoreParty("ABC234",oldQuiz,{clock:()=>a.now},a.now);
  assert.equal(recoveredQuiz.usesDemoQuiz,false);
  assert.deepEqual(recoveredQuiz.quiz,custom.questions);

  const customShow={...defaultShow,title:"Custom family night"};
  const b=room("feud",{customShow});
  const oldShow=snapshotParty(b.p);
  delete oldShow.usesDefaultShow;
  const recoveredShow=restoreParty("ABC234",oldShow,{clock:()=>b.now},b.now);
  assert.equal(recoveredShow.usesDefaultShow,false);
  assert.equal(recoveredShow.show.title,"Custom family night");
});

test("selection helper is bounded, deterministic, and doesn't repeat within a five-round match",()=>{
  const bank=Array.from({length:27},(_,i)=>"Prompt "+i);
  const a=matchContent(bank,0,5);
  const b=matchContent(bank,1,5);
  assert.equal(a.length,5);
  assert.equal(b.length,5);
  assert.equal(a.some(x=>b.includes(x)),false);
  assert.equal(new Set(matchContent(bank,7,5)).size,5);
  assert.equal(contentAt(bank,1,0,5),"Prompt 5");
  assert.throws(()=>contentAt(bank,0,5,5),/Invalid/);
  assert.throws(()=>matchContent(bank,0,28),/Invalid/);
});
