import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { acceptForbidden, FORBIDDEN_DURATION_MS, FORBIDDEN_CARDS_PER_TURN, FORBIDDEN_UNIQUE_CARD_COUNT } from "../open-pack/forbidden.js";

function start(size=3) {
  let now=1000, request=0;
  const p=new Party("ABCDEF",{clock:()=>now,countdownMs:1});
  const ids=Array.from({length:size},(_,i)=>p.join(`Family ${i+1}`));
  function action(actor,type,value) {
    return p.handle(actor,{v:1,type,requestId:`forbidden-${++request}`,matchId:p.matchId,revision:p.revision,
      ...(value===undefined?{}:{value})});
  }
  action("host","start","no-say");
  now+=2; p.tick();
  assert.equal(p.phase,"playing");
  return {p,ids,action,advance(ms){now+=ms;p.tick();}};
}

test("Forbidden Word Frenzy keeps original secret card private in a 20-player QR room",()=>{
  const {p,ids}=start(20);
  assert.equal(p.roster.length,20);
  assert.equal(p.mode,"no-say");
  assert.equal(p.pack.kind,"forbidden");
  assert.equal(FORBIDDEN_CARDS_PER_TURN,5);
  assert(FORBIDDEN_UNIQUE_CARD_COUNT>=20*FORBIDDEN_CARDS_PER_TURN,"Every 20-player turn can have fresh unique prompts");
  assert.equal(FORBIDDEN_DURATION_MS,45000);
  assert(p.view(ids[0]).pack.card?.word);
  assert(p.view(ids[1]).pack.card?.forbidden?.length===4);
  for (const id of ["host",...ids.slice(2)]) {
    const pack=p.view(id).pack;
    assert.equal(Object.hasOwn(pack,"card"),false,"Only giver/referee see private words");
    assert(!JSON.stringify(pack).includes("Friendly Robot"),"No hidden prompt in public projection");
  }
});

test("only connected referee marks correct, forbidden or passed cards; client cannot award itself",()=>{
  const {p,ids,advance}=start();
  const [giver,referee,guesser]=ids;
  assert.throws(()=>acceptForbidden(p,giver,{action:"correct"}),/Only this turn/);
  assert.throws(()=>acceptForbidden(p,guesser,{action:"correct"}),/Only this turn/);
  assert.throws(()=>acceptForbidden(p,"host",{action:"correct"}),/Only this turn/);
  assert.throws(()=>acceptForbidden(p,referee,{action:"correct",points:5000}),/Unexpected|field|Invalid|allowed|unknown/i);
  assert.throws(()=>acceptForbidden(p,referee,{action:"winner"}),/Unknown forbidden/);
  acceptForbidden(p,referee,{action:"correct"});
  assert.equal(p.players.get(giver).score,20);
  assert.equal(p.pack.cursor,1);
  assert.throws(()=>acceptForbidden(p,referee,{action:"correct"}),/Wait between/);
  advance(350);
  acceptForbidden(p,referee,{action:"forbidden"});
  assert.equal(p.players.get(giver).score,10);
  advance(350);
  acceptForbidden(p,referee,{action:"pass"});
  assert.equal(p.players.get(giver).score,10);
  p.connected(referee,false);
  advance(350);
  assert.throws(()=>acceptForbidden(p,referee,{action:"correct"}),/Only this turn/);
  p.connected(referee,true);
  acceptForbidden(p,referee,{action:"correct"});
  assert.equal(p.players.get(giver).score,30);
  advance(350);
  acceptForbidden(p,referee,{action:"correct"});
  assert.equal(p.phase,"reveal");
  assert.equal(p.pack.history.length,5);
  assert.equal(p.players.get(giver).score,50);
  assert.equal(p.view(guesser).pack.history.length,5);
  assert.throws(()=>acceptForbidden(p,referee,{action:"correct"}),/not active/);
});

test("turn ends on 45 second deadline, rotates roles, and finishes after every participant",()=>{
  const {p,ids,action,advance}=start(3);
  const first=p.pack.giver;
  advance(45001);
  assert.equal(p.phase,"reveal");
  assert.equal(p.view("host").pack.history.length,0);
  action("host","next");
  assert.equal(p.phase,"countdown");
  advance(2);
  assert.equal(p.phase,"playing");
  assert.notEqual(p.pack.giver,first);
  assert.equal(p.pack.giver,ids[1]);
  advance(45001);action("host","next");advance(2);
  advance(45001);action("host","next");
  assert.equal(p.phase,"finished");
  assert.equal(p.index,3);
  assert.equal(p.players.size,3);
  assert.equal(p.view("host").championship.gamesPlayed,1,"Completed native game contributes to Game Night Championship");
});
