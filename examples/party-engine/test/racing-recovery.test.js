import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
import { raceModes } from "../racing.js";

let seq=0;
function command(p,actor,type,value) {
  return p.handle(actor,{
    v:1,type,requestId:"arcade-restart-"+(++seq),matchId:p.matchId,revision:p.revision,
    ...(value===undefined?{}:{value})
  });
}
for(const mode of raceModes) {
  test(mode+" persists 20 racer positions, controls and championship scoring through restart",()=>{
    let now=1000;
    const options={clock:()=>now,countdownMs:1};
    const p=new Party("ABC234",options);
    const ids=Array.from({length:20},(_,i)=>p.join("Driver "+i));
    command(p,"host","start",mode);
    now+=1;p.tick();
    assert.equal(p.phase,"racing");
    command(p,ids[0],"play",{action:"drive",lane:1,gas:true,boost:false});
    now+=1200;p.tick();
    const before=p.race.racers.get(ids[0]).distance;
    assert.ok(before>0);
    const saved=JSON.parse(JSON.stringify(snapshotParty(p)));
    const r=restoreParty(p.code,saved,options,now);
    assert.equal(r.phase,"racing");
    assert.equal(r.race.racers.size,20);
    assert.equal(r.race.racers.get(ids[0]).distance,before);
    assert.equal(r.race.racers.get(ids[0]).gas,true);
    assert.equal(r.race.racers.get(ids[0]).lane,1);
    assert.equal(r.view("host").race.positions.length,20);
    assert.equal(r.view(ids[0]).race.me.lane,1);
    assert.equal(r.hostConnected,false);
    assert.equal(r.players.get(ids[0]).connected,false);
    r.connected("host",true);
    r.connected(ids[0],true);
    now+=1000;r.tick();
    assert.ok(r.race.racers.get(ids[0]).distance>=before);
    command(r,ids[0],"play",{action:"drive",lane:2,gas:true,boost:true});
    assert.equal(r.race.racers.get(ids[0]).lane,2);
    now+=90000;r.tick();
    assert.equal(r.phase,"reveal");
    const result=r.view("host").race.results;
    assert.equal(result.length,20);
    assert.ok(result.every(item=>Number.isInteger(item.rank)));
    const beforeScores=[...r.players.values()].map(v=>v.score);
    r.tick();
    assert.deepEqual([...r.players.values()].map(v=>v.score),beforeScores);
    command(r,"host","next");
    assert.equal(r.phase,"finished");
    assert.equal(r.championship.completed.has(r.matchId),true);
    assert.equal(r.championship.games.length,1);
    const final=restoreParty(r.code,JSON.parse(JSON.stringify(snapshotParty(r))),options,now);
    assert.equal(final.championship.games.length,1);
    assert.equal(final.championship.completed.has(r.matchId),true);
    assert.deepEqual(final.view("host").race.results,result);
  });
}
test("arcade racing rejects an incomplete active-room checkpoint",()=>{
  const p=new Party("ABC234",{countdownMs:0});
  for(let i=0;i<3;i++)p.join("Racer "+i);
  command(p,"host","start","turbo");p.tick();
  assert.equal(p.phase,"racing");
  const snap=snapshotParty(p);
  delete snap.race;
  assert.throws(()=>restoreParty(p.code,snap,{},p.clock()),/Unsupported arcade racing recovery state/);
});
