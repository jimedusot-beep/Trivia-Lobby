import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

function peer(port){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{origin:`http://127.0.0.1:${port}`});
 const messages=[],waiting=[];
 ws.on("message",raw=>{
  const msg=JSON.parse(raw.toString());messages.push(msg);
  for(const w of [...waiting])if(w.matches(msg)){clearTimeout(w.timer);waiting.splice(waiting.indexOf(w),1);w.resolve(msg);}
 });
 return {
  ws,
  open:()=>new Promise(resolve=>ws.once("open",resolve)),
  send:m=>ws.send(JSON.stringify(m)),
  wait:(matches,label="response")=>{
   const found=messages.find(matches);if(found)return Promise.resolve(found);
   return new Promise((resolve,reject)=>{
    const entry={matches,resolve,timer:null};
    entry.timer=setTimeout(()=>{waiting.splice(waiting.indexOf(entry),1);reject(new Error("Timed out waiting for socket message: "+label));},4000);
    waiting.push(entry);
   });
  }
 };
}
test("20 distinct QR guests play Majority Rules over real WebSockets with credential recovery",{timeout:20000},async t=>{
 const app=createPartyServer({partyOptions:{countdownMs:1}});
 await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));t.after(()=>app.close());
 const port=app.server.address().port;
 const host=peer(port);await host.open();host.send({type:"create"});
 const token=(await host.wait(m=>m.type==="credential","host credential"));
 const players=[];
 for(let i=0;i<20;i++){
  const p=peer(port);await p.open();p.send({type:"join",code:token.code,name:"Guest "+i});
  p.credential=await p.wait(m=>m.type==="credential","player join credential "+i);players.push(p);
 }
 const party=app.rooms.get(token.code).party;
 assert.equal(party.players.size,20);
 assert.equal((await host.wait(m=>m.type==="state"&&m.state.players.length===20,"20 player roster")).state.players.length,20);
 const extra=peer(port);await extra.open();extra.send({type:"join",code:token.code,name:"Extra"});
 assert.match((await extra.wait(m=>m.type==="error","room full")).message,/Room full/);
 host.send({v:1,type:"start",requestId:"start-social",matchId:null,revision:party.revision,value:"majority"});
 const question=(await players[0].wait(m=>m.type==="state"&&m.state.phase==="question","question phase")).state;
 assert.equal(question.mode,"majority");
 const action=(id,n,req)=>({v:1,type:"respond",requestId:"vote-"+req,matchId:question.matchId,revision:question.revision,value:n});
 players[0].send(action(players[0].credential.actor,0,0));
 await players[0].wait(m=>m.type==="ack"&&m.requestId==="vote-0","first vote ack");
 const resumed=peer(port);await resumed.open();
 resumed.send({type:"resume",code:token.code,actor:players[0].credential.actor,token:players[0].credential.token});
 await resumed.wait(m=>m.type==="ready","resume ready");
 const privateState=(await resumed.wait(m=>m.type==="state"&&m.state.phase==="question","resumed question state")).state;
 assert.equal(privateState.social.locked,true);
 resumed.send(action(players[0].credential.actor,1,"again"));
 assert.match((await resumed.wait(m=>m.type==="error","locked duplicate")).message,/locked/);
 for(let i=1;i<20;i++){
  players[i].send(action(players[i].credential.actor,i<12?0:1,i));
  await players[i].wait(m=>m.type==="ack"&&m.requestId==="vote-"+i,"vote ack "+i);
 }
 const reveal=(await host.wait(m=>m.type==="state"&&m.state.phase==="reveal","final reveal")).state;
 assert.deepEqual(reveal.social.counts,[12,8]);
 assert.equal(reveal.players.filter(p=>p.score===100).length,12);
 assert.equal(reveal.players.filter(p=>p.score===0).length,8);
 for(const p of [...players,resumed,extra,host])p.ws.terminate();
});
