/**
 * Opt-in, local-only WebSocket load evidence for Trivia Lobby.
 *
 * Usage: node --import tsx script/load-live.ts 10 25 50 100
 * No database, public deployment, credentials or external service needed.
 * Loopback source addresses simulate independent school/household clients
 * without turning off server per-IP rate limits.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { once } from "node:events";
import WebSocket from "ws";
import { attachGameSocket } from "../server/live-game";
import { WS_EVENTS, type Card } from "../shared/schema";
import type { IStorage } from "../server/storage";
import { serverMessageSchema } from "../shared/game-protocol";

type Wire = { v:1;type:string;payload:any };
type Pending = {type:string;resolve:(event:Wire)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
function percentile(values:number[],portion:number){
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return Number(sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*portion)-1))].toFixed(2));
}
class Inbox {
  readonly ws:WebSocket;
  private queue:Wire[]=[];
  private pending:Pending[]=[];
  constructor(ws:WebSocket){
    this.ws=ws;
    ws.on("message",raw=>{
      const parsed=serverMessageSchema.safeParse(JSON.parse(raw.toString()));
      if(!parsed.success) throw new Error("Received invalid server protocol response");
      const message=parsed.data as Wire;
      const index=this.pending.findIndex(x=>x.type===message.type);
      if(index>=0){
        const pending=this.pending.splice(index,1)[0];
        clearTimeout(pending.timer);pending.resolve(message);
      }else this.queue.push(message);
    });
    ws.on("close",()=>{
      for(const p of this.pending.splice(0)){
        clearTimeout(p.timer);p.reject(new Error("Socket closed while waiting for "+p.type));
      }
    });
  }
  send(type:string,payload:Record<string,unknown>={}){
    this.ws.send(JSON.stringify({v:1,type,payload}));
  }
  async take(type:string,ms=15000):Promise<Wire>{
    const old=this.queue.findIndex(x=>x.type===type);
    if(old>=0)return this.queue.splice(old,1)[0];
    return new Promise((resolve,reject)=>{
      const entry:Pending={type,resolve,reject,timer:setTimeout(()=>{
        this.pending=this.pending.filter(p=>p!==entry);
        reject(new Error("Timed out waiting for "+type));
      },ms)};
      this.pending.push(entry);
    });
  }
}
const sample=()=>{
  const start=process.memoryUsage();
  return {rss:start.rss,heapUsed:start.heapUsed};
};
async function scenario(count:number,index:number){
  assert(Number.isInteger(count) && count>=1 && count<=100);
  const card:Card={id:1,position:0,deckId:1,type:"multiple_choice",front:"Select A",
    back:"A is correct",options:["A","B"],correctOption:"A",createdAt:null};
  const storage={getDeck:async()=>({id:1,title:"Load evidence quiz",cards:[card]})} as unknown as IStorage;
  const server=createServer();
  const wss=attachGameSocket(server,storage,{questionMs:5000,authorizeHost:async()=>"fixture-owner"});
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const addr=server.address();assert(addr&&typeof addr!=="string");
  const url="ws://127.0.0.1:"+addr.port+"/ws";
  const sockets:WebSocket[]=[];
  let peakRss=sample().rss;
  const monitor=setInterval(()=>{peakRss=Math.max(peakRss,sample().rss);},25);
  const openedAt=performance.now();
  const open=async(localAddress:string)=>{
    const ws=new WebSocket(url,{localAddress,perMessageDeflate:false});
    sockets.push(ws);
    // Each fixture socket is allowed to fail without an unhandled-error crash.
    ws.on("error",()=>{});
    const inbox=new Inbox(ws);
    await Promise.race([
      once(ws,"open"),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("Connection timed out")),10000)),
    ]);
    return inbox;
  };
  try{
    const host=await open("127.0.0.1");
    host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});
    const created=await host.take(WS_EVENTS.ROOM_CREATED);
    const roomCode=created.payload.roomCode as string;
    const playerIps=Array.from({length:count},(_,i)=>
      "127.0.0."+(10+index*20+Math.floor(i/20)));
    const players=await Promise.all(playerIps.map(ip=>open(ip)));
    await Promise.all(players.map(async(player,i)=>{
      player.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"Player "+(i+1)});
      const joined=await player.take(WS_EVENTS.ROOM_JOINED);
      assert(joined.payload.playerId && joined.payload.token);
      const snapshot=await player.take(WS_EVENTS.SYNC_SNAPSHOT);
      assert.equal(snapshot.payload.state,"lobby");
    }));
    const joinMs=Number((performance.now()-openedAt).toFixed(2));
    host.send(WS_EVENTS.START_GAME,{roomCode});
    const questions=await Promise.all(players.map(async player=>{
      const message=await player.take(WS_EVENTS.QUESTION_START);
      const receivedTs=Date.now();
      assert.equal(message.payload.prompt,"Select A");
      assert(!JSON.stringify(message.payload).includes("correctOption"));
      return {question:message.payload,receivedTs};
    }));
    const delivery=questions.map(row=>Math.max(0,row.receivedTs-row.question.serverStartTs));
    const sentAt=Date.now();
    players.forEach(player=>player.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"A"}));
    const reveals=await Promise.all(players.map(async player=>{
      const result=await player.take(WS_EVENTS.ANSWER_RESULT);
      return {payload:result.payload,receivedAt:Date.now()};
    }));
    const revealMs=reveals.map(row=>Math.max(0,row.receivedAt-sentAt));
    assert(reveals.every(row=>row.payload.isCorrect===true && row.payload.awarded===100));
    await host.take(WS_EVENTS.ANSWER_RESULT);
    host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});await host.take(WS_EVENTS.LEADERBOARD);
    host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});
    const end=await host.take(WS_EVENTS.GAME_OVER);
    assert.equal(end.payload.leaderboard.length,count);
    assert(end.payload.leaderboard.every((row:any)=>row.score===100));
    return {
      participants:count,completed:true,joinMs,
      questionDeliveryMs:{p50:percentile(delivery,0.50),p95:percentile(delivery,0.95),p99:percentile(delivery,0.99),max:percentile(delivery,1)},
      answerRevealMs:{p50:percentile(revealMs,0.50),p95:percentile(revealMs,0.95),p99:percentile(revealMs,0.99),max:percentile(revealMs,1)},
      rssPeakBytes:peakRss,heapUsedAfterBytes:sample().heapUsed,
      durationMs:Number((performance.now()-openedAt).toFixed(2)),
      roomState:"finished",allScoresConsistent:true,failedConnections:0,
    };
  }finally{
    clearInterval(monitor);
    sockets.forEach(ws=>ws.terminate());
    await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));
  }
}
const counts=process.argv.slice(2).length ? process.argv.slice(2).map(Number):[10,25];
if(counts.length>6 || counts.some(count=>!Number.isInteger(count)||count<1||count>100))
  throw new Error("Provide up to six participant counts from 1 to 100");
const results=[];
for(let i=0;i<counts.length;i++){
  const result=await scenario(counts[i],i);
  results.push(result);
  process.stdout.write(JSON.stringify(result)+"\n");
}
process.stdout.write(JSON.stringify({scenarioCount:results.length,validated:true,environment:"single Node.js process, localhost WebSockets",note:"Not a production throughput guarantee"})+"\n");
