import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { RACE_DISTANCE, raceModes } from "../racing.js";
import { validateAction } from "../protocol.js";

function fixture(mode,count=20){
  let now=1000,seq=0;
  const p=new Party("RACE23",{clock:()=>now,countdownMs:1});
  const ids=Array.from({length:count},(_,i)=>p.join("Racer "+i));
  const act=(id,type,value)=>p.handle(id,{v:1,type,requestId:"race-input-"+(++seq),matchId:p.matchId,revision:p.revision,...(value===undefined?{}:{value})});
  act("host","start",mode);
  now+=1;p.tick();
  return{p,ids,act,advance(ms){now+=ms;p.tick()},clock:()=>now};
}
for(const mode of raceModes){
 test(mode+": 20 authenticated racers have strictly server-owned positions, deadlines and points",()=>{
  const f=fixture(mode);
  assert.equal(f.p.phase,"racing");
  assert.equal(f.p.view("host").race.positions.length,20);
  assert.equal(f.p.view("host").race.me,undefined);
  assert.equal(f.p.view(f.ids[0]).race.me.lane,0);
  assert.equal(f.p.view(f.ids[0]).race.me.distance,0);
  assert.equal(f.p.view(f.ids[0]).race.me.boostReady,true);
  assert.throws(()=>f.act("host","play",{action:"drive",lane:0,gas:true,boost:false}),/host/);
  assert.throws(()=>f.act(f.ids[0],"play",{action:"drive",lane:0,gas:true,boost:false,distance:900}),/Invalid race control/);
  assert.throws(()=>f.act(f.ids[0],"play",{action:"drive",lane:3,gas:true,boost:false}),/Invalid race control/);
  for(let i=0;i<20;i++)f.act(f.ids[i],"play",{action:"drive",lane:i%3,gas:true,boost:false});
  assert.throws(()=>f.act(f.ids[0],"play",{action:"drive",lane:2,gas:true,boost:false}),/five inputs per second/);
  f.advance(1000);
  const first=f.p.view(f.ids[1]).race;
  assert.ok(first.positions.every(x=>x.distance>0&&x.distance<100));
  assert.ok(f.p.players.get(f.ids[0]).score===0);
  f.advance(250);
  f.act(f.ids[0],"play",{action:"drive",lane:2,gas:true,boost:true});
  assert.equal(f.p.view(f.ids[0]).race.me.lane,2);
  assert.equal(f.p.view(f.ids[0]).race.me.boostReady,false);
  assert.throws(()=>f.act(f.ids[1],"play",{action:"teleport",lane:1,gas:true,boost:false}),/Invalid race control/);
  const d=f.p.view(f.ids[0]).race.me.distance;
  f.p.connected(f.ids[0],false);
  f.advance(1200);
  assert.ok(f.p.view(f.ids[0]).race.me.distance>=d);
  f.p.connected(f.ids[0],true);
  assert.ok(f.p.view(f.ids[0]).race.me.distance>=d);
  f.advance(90000);
  assert.equal(f.p.phase,"reveal");
  const results=f.p.view("host").race.results;
  assert.equal(results.length,20);
  assert.equal(new Set(results.map(x=>x.id)).size,20);
  assert.ok(results.every(x=>x.distance<=RACE_DISTANCE && x.rank>=1 && Number.isSafeInteger(f.p.players.get(x.id).score)));
  assert.equal(results[0].rank,1);
  assert.ok(f.p.players.get(results[0].id).score>=f.p.players.get(results.at(-1).id).score);
  const stable=f.p.players.get(results[0].id).score;
  f.advance(1000);
  assert.equal(f.p.players.get(results[0].id).score,stable);
  assert.throws(()=>f.act(f.ids[0],"play",{action:"drive",lane:2,gas:true,boost:false}),/Race is not accepting/);
  f.act("host","next");
  assert.equal(f.p.phase,"finished");
  assert.equal(f.p.view("host").race.results.length,20);
 });
 test(mode+": quiet racers cannot earn completion points or extend the 90-second timer",()=>{
  const f=fixture(mode,10);
  f.advance(90000);
  assert.equal(f.p.phase,"reveal");
  assert.ok(f.p.view("host").race.results.every(x=>!x.finished));
  assert.ok(f.ids.every(id=>f.p.players.get(id).score===0));
 });
 test(mode+": only credentialed host can end match early",()=>{
  const f=fixture(mode,10);
  assert.throws(()=>f.act(f.ids[1],"play",{action:"end-match"}),/Invalid race control/);
  for(const id of f.ids)f.act(id,"play",{action:"drive",lane:1,gas:true,boost:false});
  f.advance(3000);
  f.act("host","play",{action:"end-match"});
  assert.equal(f.p.phase,"reveal");
  assert.equal(f.p.endedByHost,true);
  assert.equal(f.p.view("host").race.results.length,10);
 });
}
test("race action schema rejects forged actor/score and unrecognized mode",()=>{
 const base={v:1,type:"play",requestId:"race-request-999",matchId:null,revision:0,value:{action:"drive",lane:0,gas:true,boost:false}};
 assert.deepEqual(validateAction(base),base);
 assert.throws(()=>validateAction({...base,actor:"host"}),/Unknown message field/);
 assert.throws(()=>validateAction({...base,score:9999}),/Unknown message field/);
 assert.throws(()=>validateAction({...base,type:"start",value:"mario-kart-64"}),/Unknown game mode/);
});
