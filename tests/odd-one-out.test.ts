import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { scoreRound } from "../server/game-modes";
import { attachGameSocket } from "../server/live-game";
import { WS_EVENTS } from "../shared/schema";
import { oddOneOutStarterCards } from "../server/odd-one-out-pack";
import type { IStorage } from "../server/storage";

type Message = {v:number;type:string;payload:any};
function inbox(ws:WebSocket) {
 const messages:Message[]=[];
 const waiters:Array<{type:string;resolve:(m:Message)=>void;reject:(e:Error)=>void}>=[];
 ws.on("message",buffer=>{
  const msg=JSON.parse(buffer.toString()) as Message;
  const i=waiters.findIndex(w=>w.type===msg.type);
  if(i===-1)messages.push(msg);else waiters.splice(i,1)[0].resolve(msg);
 });
 return {
  send(type:string,payload:Record<string,unknown>={}) {ws.send(JSON.stringify({v:1,type,payload}));},
  async take(type:string,timeout=2500):Promise<Message> {
   const i=messages.findIndex(m=>m.type===type);if(i!==-1)return messages.splice(i,1)[0];
   return await new Promise((resolve,reject)=>{
    const pending={type,resolve:(m:Message)=>{clearTimeout(timer);resolve(m);},reject};
    const timer=setTimeout(()=>{const index=waiters.indexOf(pending);if(index!==-1)waiters.splice(index,1);reject(new Error("Timed out on "+type+"; queued "+messages.map(m=>m.type).join(",")));},timeout);
    waiters.push(pending);
   });
  },
 };
}
test("starter pack has exactly twenty verified four-choice questions",()=>{
 assert.equal(oddOneOutStarterCards.length,20);
 assert.equal(oddOneOutStarterCards.map(c=>c.correctOption).join(","),"B,A,B,D,D,A,A,C,D,A,C,B,C,C,D,B,A,D,B,B");
 for(const q of oddOneOutStarterCards){assert.equal(q.options?.length,4);assert.ok(q.back?.trim());assert.match(q.correctOption??"",/^[A-D]$/);}
});
test("Odd One Out points are deterministic and ignore streak multipliers",()=>{
 const common={mode:"odd_one_out" as const,score:100,streak:9,wager:0,focus:1,guard:1,round:2};
 assert.equal(scoreRound({...common,correct:true}).awarded,1);
 assert.equal(scoreRound({...common,correct:false}).awarded,0);
 assert.equal(scoreRound({...common,correct:true}).coins,0);
});
test("host-only explanation bonus grants exactly one point and finalizes report before next",async t=>{
 const fakeStorage={async getDeck(){return {id:1,title:"Odd test",cards:[
  {id:1,deckId:1,type:"multiple_choice",front:"Which one does not belong?",back:"Three are corundum, one is spinel.",options:["Ruby","Spinel","Sapphire","Padparadscha"],correctOption:"B"}
 ]};}} as unknown as IStorage;
 const server=createServer(),wss=attachGameSocket(server,fakeStorage,{authorizeHost:async()=>"owner",questionMs:1800});
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const address=server.address();assert(address && typeof address!=="string");
 const wsUrl=`ws://127.0.0.1:${address.port}/ws`,sockets:WebSocket[]=[];
 async function open() {const ws=new WebSocket(wsUrl);sockets.push(ws);const client=inbox(ws);await once(ws,"open");return client;}
 t.after(async()=>{for(const ws of sockets)ws.terminate();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
 const host=await open(),player=await open();
 host.send(WS_EVENTS.CREATE_ROOM,{deckId:1});const {roomCode}=(await host.take(WS_EVENTS.ROOM_CREATED)).payload;
 player.send(WS_EVENTS.JOIN_ROOM,{roomCode,playerName:"Guest"});await player.take(WS_EVENTS.ROOM_JOINED);
 host.send(WS_EVENTS.CONFIGURE_GAME,{roomCode,mode:"odd_one_out"});assert.equal((await host.take(WS_EVENTS.GAME_CONFIGURED)).payload.mode,"odd_one_out");
 host.send(WS_EVENTS.START_GAME,{roomCode});await player.take(WS_EVENTS.QUESTION_START);
 player.send(WS_EVENTS.SUBMIT_ANSWER,{roomCode,questionIndex:0,answer:"B",explanation:"Spinel is different from corundum."});
 await player.take(WS_EVENTS.ANSWER_ACCEPTED);
 assert.equal((await player.take(WS_EVENTS.ANSWER_RESULT)).payload.awarded,1);
 const review=(await host.take(WS_EVENTS.ODD_REVIEW_STATE)).payload;
 assert.equal(review.finalized,false);
 assert.equal(review.entries.length,1);
 assert.equal(review.entries[0].explanation,"Spinel is different from corundum.");
 player.send(WS_EVENTS.AWARD_ODD_BONUS,{roomCode,questionIndex:0,playerId:review.entries[0].playerId});
 assert.match((await player.take(WS_EVENTS.ERROR)).payload.message,/Bonus review is unavailable/);
 host.send(WS_EVENTS.AWARD_ODD_BONUS,{roomCode,questionIndex:0,playerId:review.entries[0].playerId});
 assert.equal((await host.take(WS_EVENTS.ODD_REVIEW_STATE)).payload.entries[0].bonusAwarded,true);
 host.send(WS_EVENTS.AWARD_ODD_BONUS,{roomCode,questionIndex:0,playerId:review.entries[0].playerId});
 assert.match((await host.take(WS_EVENTS.ERROR)).payload.message,/not eligible/);
 host.send(WS_EVENTS.FINALIZE_ODD_REVIEW,{roomCode,questionIndex:0});
 assert.equal((await host.take(WS_EVENTS.ODD_REVIEW_STATE)).payload.finalized,true);
 const final=(await player.take(WS_EVENTS.ANSWER_RESULT)).payload;
 assert.equal(final.awarded,2);assert.equal(final.bonusAwarded,1);
 host.send(WS_EVENTS.FINALIZE_ODD_REVIEW,{roomCode,questionIndex:0});
 assert.match((await host.take(WS_EVENTS.ERROR)).payload.message,/Cannot finalize/);
 host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});
 const leaderboard=(await player.take(WS_EVENTS.LEADERBOARD)).payload;
 assert.equal(leaderboard.leaderboard[0].score,2);
 host.send(WS_EVENTS.NEXT_QUESTION,{roomCode});
 assert.equal((await player.take(WS_EVENTS.GAME_OVER)).payload.leaderboard[0].score,2);
});
