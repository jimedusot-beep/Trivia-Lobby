// SPDX-License-Identifier: AGPL-3.0-or-later
// Original low-bandwidth 20-player race simulation. No console ROMs, graphics or sounds.
// Phones only send bounded *intent*. Positions, collisions, finish times and points are server-owned.
export const raceModes=Object.freeze(["turbo","wave"]);
export const RACE_DISTANCE=900;
export const RACE_DURATION_MS=90000;
export const RACE_FRAME_MS=750;

const fail=(message)=>{throw new Error(message);};
const tracks=Object.freeze({
  turbo:{label:"Turbo Circuit",vehicle:"kart",obstacles:Array.from({length:12},(_,i)=>({at:80+i*67,lane:(i*7+1)%3,kind:"cones"}))},
  wave:{label:"Wave Sprint",vehicle:"jetski",obstacles:Array.from({length:12},(_,i)=>({at:80+i*67,lane:(i*5+2)%3,kind:"choppy water"}))},
});
const finite=(n)=>Number.isFinite(n)?n:0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function openRace(p){
  const now=p.clock();
  const racers=new Map(p.roster.map((id,i)=>[id,{
    id, lane:i%3, distance:0, speed:0, gas:false, boostUntil:0, boostReady:now,
    finishedAt:null, obstacleIndex:0, hits:0, lastInput:-Infinity,
  }]));
  p.race={mode:p.mode, racers, startAt:now, updatedAt:now, nextTick:now+RACE_FRAME_MS,
    obstacles:tracks[p.mode].obstacles, finished:false, standings:[]};
  p.enter("racing",RACE_DURATION_MS);
}
function simulate(p,deltaMs){
  const r=p.race,cfg=tracks[p.mode],now=r.updatedAt;
  for(const v of r.racers.values()){
    if(v.finishedAt!==null)continue;
    const previous=v.distance;
    const seconds=deltaMs/1000;
    const active=p.players.get(v.id)?.connected;
    const wanted=active&&v.gas?1:0;
    const acceleration=wanted?(p.mode==="wave"?12:11):-15;
    v.speed=clamp(v.speed+acceleration*seconds,0,p.mode==="wave"?21:19);
    const boosted=now<v.boostUntil;
    const water=p.mode==="wave"?0.94+0.06*Math.cos((now-r.startAt)/1100+v.lane):1;
    const motion=v.speed*seconds*(boosted?1.5:1)*water;
    v.distance=Math.min(RACE_DISTANCE,previous+motion);
    while(v.obstacleIndex<r.obstacles.length && v.distance>=r.obstacles[v.obstacleIndex].at){
      const obstacle=r.obstacles[v.obstacleIndex++];
      if(previous<=obstacle.at && obstacle.lane===v.lane){
        v.hits++;
        v.speed*=0.55;
      }
    }
    if(v.distance>=RACE_DISTANCE){
      const f=motion>0?clamp((RACE_DISTANCE-previous)/motion,0,1):1;
      v.finishedAt=now+deltaMs*f;
      v.gas=false;
    }
  }
}
export function tickRace(p){
  if(p.phase!=="racing" || !raceModes.includes(p.mode))return;
  const r=p.race;
  // Never simulate beyond the deadline. Long asleep-server intervals cannot mint bonus distance.
  const target=Math.min(p.clock(),p.deadline??Infinity);
  let remaining=Math.max(0,target-r.updatedAt);
  while(remaining>0){
    const ms=Math.min(250,remaining);
    simulate(p,ms);
    r.updatedAt+=ms;
    remaining-=ms;
  }
  r.nextTick=p.clock()+RACE_FRAME_MS;
  if([...r.racers.values()].every(v=>v.finishedAt!==null) || p.clock()>=(p.deadline??Infinity))
    finishRace(p);
}
export function acceptRace(p,actor,value){
  if(!raceModes.includes(p.mode) || p.phase!=="racing")fail("Race is not accepting controls.");
  if(!value || typeof value!=="object" || Array.isArray(value))fail("Invalid race control.");
  tickRace(p);
  if(p.phase!=="racing")fail("Race has ended.");
  if(actor==="host"){
    if(Object.keys(value).length!==1 || value.action!=="end-match")fail("Only race ending is available to the host.");
    p.endedByHost=true;
    finishRace(p);
    return;
  }
  if(!p.roster.includes(actor))fail("Not a racing participant.");
  if(Object.keys(value).length!==4 || !["action","lane","gas","boost"].every(k=>Object.hasOwn(value,k)) ||
    value.action!=="drive" || ![0,1,2].includes(value.lane) || typeof value.gas!=="boolean" || typeof value.boost!=="boolean")
    fail("Invalid race control.");
  const racer=p.race.racers.get(actor),now=p.clock();
  if(racer.finishedAt!==null)fail("You have already finished.");
  if(now-racer.lastInput<180)fail("Controls are limited to five inputs per second.");
  racer.lastInput=now;
  racer.lane=value.lane;
  racer.gas=value.gas;
  if(value.boost && now>=racer.boostReady){
    racer.boostUntil=now+2500;
    racer.boostReady=now+12500;
  }
}
export function finishRace(p){
  const r=p.race;
  if(!r || r.finished)return;
  r.finished=true;
  r.standings=[...r.racers.values()].sort((a,b)=>{
    if(a.finishedAt!==null&&b.finishedAt!==null)return a.finishedAt-b.finishedAt||a.id.localeCompare(b.id);
    if(a.finishedAt!==null)return -1;
    if(b.finishedAt!==null)return 1;
    return b.distance-a.distance||a.id.localeCompare(b.id);
  }).map((v,i)=>({
    id:v.id, name:p.players.get(v.id).name,
    rank:i+1, finished:v.finishedAt!==null,
    timeMs:v.finishedAt===null?null:Math.round(v.finishedAt-r.startAt),
    distance:Math.round(v.distance),hits:v.hits,
  }));
  for(const entry of r.standings){
    const player=p.players.get(entry.id);
    player.score=entry.finished?Math.max(100,600-(entry.rank-1)*25):Math.round(entry.distance/RACE_DISTANCE*100);
    player.correct=entry.finished?1:0;
  }
  p.enter("reveal");
}
export function projectRace(p,actor){
  if(!raceModes.includes(p.mode)||!p.race||["lobby","countdown"].includes(p.phase))return null;
  const r=p.race,now=p.clock();
  const positions=p.roster.map((id,index)=>{
    const v=r.racers.get(id);
    return {id,name:p.players.get(id).name,index,lane:v.lane,distance:Math.round(v.distance*10)/10,
      speed:Math.round(v.speed),finished:v.finishedAt!==null,connected:p.players.get(id).connected};
  });
  const view={kind:p.mode,label:tracks[p.mode].label,vehicle:tracks[p.mode].vehicle,
    distance:RACE_DISTANCE,positions,obstacles:r.obstacles,
    remainingMs:Math.max(0,(p.deadline??now)-now),raceOver:r.finished};
  if(actor!=="host"){
    const own=r.racers.get(actor);
    if(own)view.me={lane:own.lane,gas:own.gas,speed:Math.round(own.speed),
      boostReady:now>=own.boostReady,boostWaitMs:Math.max(0,Math.ceil(own.boostReady-now)),
      distance:Math.round(own.distance),finished:own.finishedAt!==null};
  }
  if(p.phase==="reveal")view.results=r.standings;
  return view;
}
