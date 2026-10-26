import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { bonusModes,bonusRoundCount } from "../bonus-games.js";
import { validateAction } from "../protocol.js";

function fixture(mode,count=10){
 let now=1000,seq=0;
 const p=new Party("ABC234",{clock:()=>now,countdownMs:1});
 const ids=Array.from({length:count},(_,i)=>p.join("Family "+i));
 function act(actor,type,value,extra={}){
  const msg={v:1,type,requestId:"bonus-request-"+(++seq),matchId:p.matchId,revision:p.revision,...extra};
  if(value!==undefined)msg.value=value;
  return p.handle(actor,msg);
 }
 act("host","start",mode);
 now+=1;p.tick();
 return {p,ids,act,advance(ms){now+=ms;p.tick();}};
}
test("new mode registry is six distinct modes with bounded round counts",()=>{
 assert.equal(new Set(bonusModes).size,6);
 for(const mode of bonusModes)assert.ok(bonusRoundCount[mode]>=4&&bonusRoundCount[mode]<=20);
});
test("Bracket Battle: 16 original contenders, 15 server-scored matchups and tie behavior",()=>{
 const {p,ids,act}=fixture("bracket",20);
 assert.equal(p.phase,"question");
 assert.equal(p.view("host").bonus.contenders.length,2);
 assert.throws(()=>act(ids[0],"respond",2),/contender/);
 for(let round=0;round<15;round++){
  assert.equal(p.phase,"question");
  assert.equal(p.view("host").bonus.round,round+1);
  assert.ok(!Object.hasOwn(p.view(ids[0]).bonus,"winner"));
  for(const id of ids)act(id,"respond",0);
  assert.equal(p.phase,"reveal");
  assert.deepEqual(p.view("host").bonus.counts,[20,0]);
  assert.equal(p.view("host").bonus.winner,0);
  assert.equal(p.players.get(ids[0]).score,100*(round+1));
  act("host","next");
 }
 assert.equal(p.phase,"finished");
 assert.equal(p.players.get(ids[19]).score,1500);
});
test("Bracket tie deterministically advances first contender with only its voters scoring",()=>{
 const {p,ids,act}=fixture("bracket",10);
 ids.forEach((id,i)=>act(id,"respond",i%2));
 assert.deepEqual(p.view("host").bonus.counts,[5,5]);
 assert.equal(p.view("host").bonus.winner,0);
 assert.equal(p.players.get(ids[0]).score,100);
 assert.equal(p.players.get(ids[1]).score,0);
});
test("Timeline Tangle: shuffled order is validated, history hidden before reveal, and up to 100 points",()=>{
 const {p,ids,act}=fixture("timeline",10);
 assert.equal(p.view("host").bonus.events.length,4);
 assert.ok(!JSON.stringify(p.view(ids[0]).bonus).includes("correctOrder"));
 const order=[...p.bonus.events].map((e,i)=>({i,year:e.year})).sort((a,b)=>a.year-b.year).map(o=>o.i);
 const text=order.join(",");
 assert.throws(()=>act(ids[0],"respond","0,0,1,2"),/each event/);
 assert.throws(()=>act(ids[0],"respond","injected"),/each event/);
 act(ids[0],"respond",text);
 assert.ok(p.view(ids[0]).bonus.locked);
 for(const id of ids.slice(1))act(id,"respond",text);
 assert.equal(p.phase,"reveal");
 assert.deepEqual(p.view("host").bonus.correctOrder,order);
 assert.equal(p.players.get(ids[0]).score,100);
 const last=p.revision;
 assert.throws(()=>act(ids[0],"respond",text),/closed/);
 assert.equal(p.revision,last);
});
test("Category Clash: original curated dictionary, unique versus repeated scoring, privacy",()=>{
 const {p,ids,act}=fixture("category",10);
 assert.match(p.view("host").bonus.prompt,/fruit starting with P/);
 assert.ok(!Object.hasOwn(p.view("host").bonus,"allowed"));
 const inputs=["peach","PEACH","plum","pineapple","wrong","banana","pear","pear","PAPAYA","none"];
 ids.forEach((id,i)=>act(id,"respond",inputs[i]));
 assert.equal(p.phase,"reveal");
 assert.equal(p.players.get(ids[0]).score,50);
 assert.equal(p.players.get(ids[1]).score,50);
 assert.equal(p.players.get(ids[2]).score,100);
 assert.equal(p.players.get(ids[3]).score,100);
 assert.equal(p.players.get(ids[4]).score,0);
 assert.equal(p.view("host").bonus.allowed.includes("peach"),true);
});
test("Caption Chaos: anonymous writing, server-owned option IDs, no author voting, per-vote points",()=>{
 const {p,ids,act}=fixture("caption",10);
 assert.equal(p.phase,"writing");
 assert.throws(()=>act(ids[0],"respond",""),/caption/);
 ids.forEach((id,i)=>act(id,"respond","My original caption "+i));
 assert.equal(p.phase,"voting");
 let view=p.view("host").bonus;
 assert.equal(view.options.length,10);
 assert.equal(view.options.some(o=>Object.hasOwn(o,"name")),false);
 assert.ok(!view.options.some(o=>Object.hasOwn(o,"author")));
 const first=ids[0], own=p.bonus.options.find(o=>o.author===first);
 assert.throws(()=>act(first,"respond",own.id),/somebody else/);
 const votes=new Map();
 for(const id of ids){
  const option=p.bonus.options.find(o=>o.author!==id);
  act(id,"respond",option.id);
  votes.set(option.author,(votes.get(option.author)||0)+1);
 }
 assert.equal(p.phase,"reveal");
 const total=[...p.players.values()].reduce((n,person)=>n+person.score,0);
 assert.equal(total,1000);
 for(const [id,count] of votes)assert.equal(p.players.get(id).score,count*100);
 assert.ok(p.view("host").bonus.options.every(o=>o.name));
});
test("Caption timeout with fewer than two responses finishes without double points",()=>{
 const {p,ids,act,advance}=fixture("caption",10);
 act(ids[0],"respond","My funny caption");
 advance(55000);
 assert.equal(p.phase,"reveal");
 assert.equal(p.players.get(ids[0]).score,0);
 advance(60000);
 assert.equal(p.phase,"reveal");
});
test("Guess the Percentage: two private stages and server-computed group percentage",()=>{
 const {p,ids,act}=fixture("percentage",10);
 assert.equal(p.phase,"writing");
 for(let i=0;i<10;i++)act(ids[i],"respond",i<6?1:0);
 assert.equal(p.phase,"voting");
 assert.ok(!Object.hasOwn(p.view("host").bonus,"actual"));
 assert.ok(!JSON.stringify(p.view(ids[0]).bonus).includes('"yes":'));
 assert.throws(()=>act(ids[0],"respond",101),/0–100/);
 for(let i=0;i<10;i++)act(ids[i],"respond",i<5?60:50);
 assert.equal(p.phase,"reveal");
 assert.equal(p.view("host").bonus.actual,60);
 assert.equal(p.view("host").bonus.yes,6);
 assert.equal(p.players.get(ids[0]).score,100);
 assert.equal(p.players.get(ids[9]).score,80);
});
test("No group answers in percentage poll cannot generate free scores",()=>{
 const {p,ids,advance}=fixture("percentage",10);
 advance(25000);
 assert.equal(p.phase,"reveal");
 assert.equal(p.view("host").bonus.actual,null);
 assert.ok(ids.every(id=>p.players.get(id).score===0));
});
test("Family Bingo: each private card, only called squares, no repeated bingo awards",()=>{
 const {p,ids,act,advance}=fixture("bingo",20);
 assert.equal(p.phase,"question");
 assert.equal(p.view(ids[0]).bonus.card.length,16);
 assert.equal(Object.hasOwn(p.view("host").bonus,"card"),false);
 assert.equal(Object.hasOwn(p.view(ids[1]).bonus,"marks"),true);
 const originalCards=new Map(ids.map(id=>[id,p.view(id).bonus.card]));
 for(let n=0;n<20;n++){
  const called=p.bonusBingo.calls[n];
  assert.equal(p.view("host").bonus.prompt,"Called word: "+called);
  for(const id of ids){
   const card=originalCards.get(id),idx=card.indexOf(called);
   if(idx>=0){
    act(id,"respond",idx);
    assert.ok(p.view(id).bonus.marks.includes(idx));
    assert.throws(()=>act(id,"respond",idx),/currently called/);
   }else assert.throws(()=>act(id,"respond",0),/currently called/);
  }
  advance(12000);
  assert.equal(p.phase,"reveal");
  if(n<19){act("host","next");assert.equal(p.phase,"question");}
  else act("host","next");
 }
 assert.equal(p.phase,"finished");
 assert.ok(ids.every(id=>p.players.get(id).score===0||p.players.get(id).score===100));
 for(const id of ids)assert.equal(p.bonusBingo.cards.get(id).cells.length,16);
});
test("new social action envelope rejects invented player identity and invalid payload types",()=>{
 const msg={v:1,type:"respond",requestId:"bonus-protocol-check",matchId:null,revision:0,value:"0,1,2,3"};
 assert.deepEqual(validateAction(msg),msg);
 assert.throws(()=>validateAction({...msg,actor:"host"}),/Unknown message field/);
 assert.throws(()=>validateAction({...msg,value:[0,1,2,3]}),/Invalid social response/);
 assert.throws(()=>validateAction({...msg,type:"start",value:"super-game"}),/Unknown game mode/);
});
