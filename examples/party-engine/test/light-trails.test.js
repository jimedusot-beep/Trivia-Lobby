import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { acceptTrailInput, finishTrails, TRAIL_HEATS, TRAIL_STEP_MS, TRAIL_WIDTH, TRAIL_HEIGHT } from "../open-pack/trails.js";

function setup(count=2){
  let now=1000,request=0;
  const p=new Party("ABCDEF",{clock:()=>now,countdownMs:1});
  const ids=Array.from({length:count},(_,i)=>p.join(`Rider ${i+1}`));
  const action=(actor,type,value)=>p.handle(actor,{v:1,type,requestId:`trail-test-${++request}`,
    matchId:p.matchId,revision:p.revision,...(value===undefined?{}:{value})});
  action("host","start","trails");now+=2;p.tick();
  assert.equal(p.phase,"playing");
  const turn=(actor,seq,dir,changes={})=>acceptTrailInput(p,actor,{
    v:1,type:"trails_input",matchId:p.matchId,heat:p.index,seq,turn:dir,...changes,
  });
  return {p,ids,action,turn,advance(ms){now+=ms;p.tick()}};
}
test("20 QR players have unique spawn cells and private lightweight trail frames",()=>{
  const {p,ids}=setup(20);
  assert.equal(p.pack.riders.length,20);
  assert.equal(new Set(p.pack.riders.map(r=>`${r.x}:${r.y}`)).size,20);
  assert.equal(p.view("host").pack.riders.length,20);
  for(const actor of ids){
    const snap=p.view(actor).pack;
    assert.equal(Object.hasOwn(snap,"riders"),false);
    assert.equal(snap.own.alive,true);
    assert.equal(Object.hasOwn(snap,"occupied"),false);
    assert.equal(Object.hasOwn(snap,"input"),false);
  }
  assert.equal(TRAIL_HEATS,3);
  assert.equal(TRAIL_WIDTH,48);assert.equal(TRAIL_HEIGHT,32);
});
test("fast trail controls only allow authenticated current rider turns and one queued direction",()=>{
  const {p,ids,turn,advance}=setup();
  assert.equal(turn(ids[0],0,-1),true);
  assert.equal(turn(ids[0],0,-1),false);
  assert.equal(turn(ids[0],1,1),false,"Only one pending turn per physics step");
  assert.equal(p.pack.riders[0].pending,-1);
  assert.throws(()=>turn("host",0,1),/connected rider/);
  assert.throws(()=>turn("invented-player",0,1),/connected rider/);
  assert.throws(()=>turn(ids[1],0,2),/Invalid trail/);
  assert.throws(()=>turn(ids[1],0,1,{x:1000}),/Invalid trail/);
  assert.throws(()=>turn(ids[1],0,1,{heat:99}),/expired/);
  p.connected(ids[0],false);
  assert.equal(p.pack.riders[0].pending,0);
  assert.throws(()=>turn(ids[0],2,1),/connected rider/);
  p.connected(ids[0],true);
  assert.equal(p.pack.riders[0].seq,-1);
  advance(TRAIL_STEP_MS);
  assert.equal(p.pack.frame,1);
});
test("head-on same-cell collision eliminates both simultaneously, never order-dependent",()=>{
  const {p,advance}=setup();
  const [left,right]=p.pack.riders;
  Object.assign(left,{x:20,y:15,dir:0,pending:0,trail:[[20,15]]});
  Object.assign(right,{x:22,y:15,dir:2,pending:0,trail:[[22,15]]});
  p.pack.occupied=new Set([15*TRAIL_WIDTH+20,15*TRAIL_WIDTH+22]);
  advance(TRAIL_STEP_MS);
  assert.equal(left.alive,false);assert.equal(right.alive,false);
  assert.equal(left.trail.length,1);assert.equal(right.trail.length,1);
  assert.equal(p.phase,"reveal");
  assert.deepEqual(p.pack.results.map(r=>r.place),[1,1]);
  assert.deepEqual(p.pack.results.map(r=>r.points),[100,100]);
  finishTrails(p);
  assert.deepEqual(p.pack.results.map(r=>r.points),[100,100]);
});
test("wall hit awards last survivor and full 3-heat room championship only on finished",()=>{
  const {p,ids,action,advance}=setup();
  const loser=p.pack.riders[0],winner=p.pack.riders[1];
  Object.assign(loser,{x:0,y:0,dir:2,trail:[[0,0]]});
  Object.assign(winner,{x:30,y:20,dir:0,trail:[[30,20]]});
  p.pack.occupied=new Set([0,20*TRAIL_WIDTH+30]);
  advance(TRAIL_STEP_MS);
  assert.equal(p.phase,"reveal");
  assert.equal(p.pack.results[0].id,ids[1]);
  assert.equal(p.view("host").championship.gamesPlayed,0);
  action("host","next");advance(2);
  assert.equal(p.phase,"playing");
  finishTrails(p);action("host","next");advance(2);
  finishTrails(p);action("host","next");
  assert.equal(p.phase,"finished");
  assert.equal(p.view("host").championship.gamesPlayed,1);
  assert.equal(p.players.get(ids[1]).score>0,true);
});
