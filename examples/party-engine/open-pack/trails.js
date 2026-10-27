// Original Light Trails Royale: deterministic, server-owned grid-survival game.
// Inspired by arcade light-cycle games and Open Party Lab's Light Trails concept.
// This file does not copy upstream game code, media or word lists.
export const TRAIL_WIDTH = 48;
export const TRAIL_HEIGHT = 32;
export const TRAIL_STEP_MS = 160;
export const TRAIL_HEATS = 3;
export const TRAIL_DURATION_MS = 45000;
const DIRECTION = [[1,0],[0,1],[-1,0],[0,-1]];
const fail = message => { throw new Error(message); };
const key = (x,y) => y*TRAIL_WIDTH+x;
const scores = trail => [...trail.riders].sort((a,b) =>
  Number(b.alive)-Number(a.alive) || (b.eliminatedAt ?? Infinity)-(a.eliminatedAt ?? Infinity) || a.slot-b.slot);

export function openTrails(p) {
  if (!p.roster || p.roster.length<2 || p.roster.length>20) fail("Trails needs 2–20 active players.");
  const now=p.clock(), length=p.roster.length;
  const riders=p.roster.map((id,slot)=>{
    const radians=2*Math.PI*slot/length;
    const x=Math.round(24+17*Math.cos(radians)),y=Math.round(16+10*Math.sin(radians));
    return {id,slot,x,y,dir:(Math.round(radians/(Math.PI/2))+1)%4,alive:true,
      eliminatedAt:null,trail:[[x,y]],pending:0,seq:-1,turnAt:-Infinity};
  });
  const occupied=new Set(riders.map(r=>key(r.x,r.y)));
  if(occupied.size!==length) fail("Could not find distinct starting cells.");
  p.pack={kind:"trails",startedAt:now,stepAt:now,frame:0,scored:false,results:null,
    riders,occupied,remainingMs:TRAIL_DURATION_MS};
  p.enter("playing",TRAIL_DURATION_MS);
}

// Compact one-tap input; every actual move is computed on the server.
// No client position, clock, score, player ID, or winning state is accepted.
export function acceptTrailInput(p,actor,m) {
  const fields=["v","type","matchId","heat","seq","turn"];
  if(!m||typeof m!=="object"||Array.isArray(m)||
    Object.keys(m).length!==fields.length||fields.some(f=>!Object.hasOwn(m,f))||
    m.v!==1||m.type!=="trails_input"||
    !Number.isSafeInteger(m.seq)||m.seq<0||m.seq>2147483647||
    !Number.isSafeInteger(m.heat)||![-1,1].includes(m.turn)) fail("Invalid trail controls.");
  if(p.mode!=="trails"||!["playing","reveal"].includes(p.phase)||m.matchId!==p.matchId||
    m.heat!==p.index||(p.phase==="playing"&&p.clock()>=p.deadline)) fail("These controls belong to an expired trail.");
  const rider=p.pack?.riders.find(r=>r.id===actor);
  if(actor==="host"||!rider||!p.players.get(actor)?.connected) fail("Only a connected rider can turn.");
  if(p.phase==="reveal") return false;
  if(m.seq<=rider.seq) return false;
  rider.seq=m.seq;
  if(!rider.alive) return false;
  if(p.clock()-rider.turnAt<80) return false;
  rider.turnAt=p.clock();
  // Bounded one-rotation queue: prevent message spamming from spinning more
  // than one 90-degree turn per physics step.
  if(rider.pending!==0) return false;
  rider.pending=m.turn;
  p.touched=p.clock();
  return true;
}
export function trailsReconnected(p,actor) {
  if(p.mode!=="trails"||p.pack?.kind!=="trails") return;
  const rider=p.pack.riders.find(r=>r.id===actor);
  if(rider){rider.pending=0;rider.seq=-1;rider.turnAt=-Infinity;}
}
function step(p,at) {
  const s=p.pack;
  const moves=s.riders.filter(r=>r.alive).map(r=>{
    const dir=(r.dir+4+r.pending)%4;
    const x=r.x+DIRECTION[dir][0],y=r.y+DIRECTION[dir][1];
    r.pending=0;
    return {r,dir,x,y,cell:key(x,y)};
  });
  const frequencies=new Map();
  for(const m of moves)frequencies.set(m.cell,(frequencies.get(m.cell)||0)+1);
  const eliminated=[];
  for(const m of moves){
    const crashed=m.x<0||m.x>=TRAIL_WIDTH||m.y<0||m.y>=TRAIL_HEIGHT||
      s.occupied.has(m.cell)||frequencies.get(m.cell)>1;
    if(crashed){m.r.alive=false;m.r.eliminatedAt=s.frame+1;eliminated.push(m.r.id);}
    else {m.r.dir=m.dir;m.r.x=m.x;m.r.y=m.y;m.r.trail.push([m.x,m.y]);}
  }
  // Reserve all successful destination cells together, so simultaneous
  // head-on collisions are not order-dependent.
  for(const m of moves)if(m.r.alive)s.occupied.add(m.cell);
  s.frame++;
  s.remainingMs=Math.max(0,p.deadline-at);
  if(s.riders.filter(r=>r.alive).length<=1) finishTrails(p);
  return eliminated.length>0;
}
export function advanceTrails(p) {
  if(p.mode!=="trails"||p.phase!=="playing"||p.pack?.kind!=="trails")return false;
  const s=p.pack,now=p.clock();
  if(now-s.stepAt>480)s.stepAt=now-320; // Skip excessive sleep debt.
  let moved=false;
  while(p.phase==="playing"&&now-s.stepAt>=TRAIL_STEP_MS){
    s.stepAt+=TRAIL_STEP_MS;
    step(p,s.stepAt);
    moved=true;
  }
  return moved;
}
export function finishTrails(p) {
  const s=p.pack;
  if(p.mode!=="trails"||p.phase!=="playing"||!s||s.scored)return;
  s.scored=true;
  const ordered=scores(s), results=[];
  let rank=0;
  for(let i=0;i<ordered.length;i++){
    const r=ordered[i];
    if(!i||r.alive!==ordered[i-1].alive||r.eliminatedAt!==ordered[i-1].eliminatedAt)rank=i+1;
    const points=Math.max(5,100-(rank-1)*5);
    p.players.get(r.id).score+=points;
    results.push({id:r.id,name:p.players.get(r.id).name,place:rank,points,alive:r.alive,steps:r.trail.length-1});
  }
  s.results=results;
  p.enter("reveal");
}
export function nextTrails(p) {
  if(++p.index>=TRAIL_HEATS)p.enter("finished");
  else {p.pack=null;p.enter("countdown",p.countdownMs);}
}
export function trailsFrame(p,actor) {
  const s=p.pack;
  const remainingMs=Math.max(0,p.deadline-p.clock());
  const basic={type:"trails_frame",matchId:p.matchId,heat:p.index,remainingMs,frame:s.frame,
    alive:s.riders.filter(r=>r.alive).length};
  if(actor==="host")return {...basic,riders:s.riders.map(r=>({
    id:r.id,slot:r.slot,name:p.players.get(r.id).name,
    alive:r.alive,dir:r.dir,trail:r.trail,
  }))};
  const own=s.riders.find(r=>r.id===actor);
  return {...basic,own:own?{alive:own.alive,steps:own.trail.length-1,seq:own.seq}:null};
}
export function projectTrails(p,actor) {
  // Do not expose occupied sets/internal timebase and pending inputs to clients.
  return {kind:"trails",totalHeats:TRAIL_HEATS,width:TRAIL_WIDTH,height:TRAIL_HEIGHT,
    durationMs:TRAIL_DURATION_MS,results:p.pack.results,...trailsFrame(p,actor)};
}
