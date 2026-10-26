import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createPartyServer } from "../server.js";

function link(port){
  const ws=new WebSocket("ws://127.0.0.1:"+port+"/socket",{origin:"http://127.0.0.1:"+port});
  const inbox=[],watchers=new Set();
  ws.on("message",raw=>{
    inbox.push(JSON.parse(raw.toString()));
    for(const watcher of watchers)watcher();
  });
  return {ws,send:data=>ws.send(JSON.stringify(data)),
    wait(predicate,label="message"){
      const existing=inbox.find(predicate);
      if(existing)return Promise.resolve(existing);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{watchers.delete(check);reject(new Error("Timed out: "+label));},4500);
        const check=()=>{
          const msg=inbox.find(predicate);
          if(!msg)return;
          clearTimeout(timer);watchers.delete(check);resolve(msg);
        };
        watchers.add(check);
      });
    },
  };
}
for(const mode of ["turbo","wave"]){
  test(mode+": 20 live WebSocket guests share an authoritative room, reconnect and finish",{timeout:20000},async t=>{
    const app=createPartyServer({partyOptions:{countdownMs:1}});
    await new Promise(resolve=>app.server.listen(0,"127.0.0.1",resolve));
    const port=app.server.address().port,opened=[];
    t.after(async()=>{
      for(const peer of opened)peer.ws.terminate();
      await app.close();
    });
    async function connect(){
      const peer=link(port);opened.push(peer);await once(peer.ws,"open");return peer;
    }
    const host=await connect();host.send({type:"create"});
    const room=await host.wait(m=>m.type==="credential","host room");
    const guests=[];
    for(let i=0;i<20;i++){
      const sock=await connect();
      sock.send({type:"join",code:room.code,name:"Racer "+i});
      const credential=await sock.wait(m=>m.type==="credential","guest "+i);
      guests.push({sock,credential});
    }
    const party=app.rooms.get(room.code).party;
    assert.equal(party.players.size,20);
    const msg=(type,value,requestId)=>({
      v:1,type,requestId,matchId:party.matchId,revision:party.revision,
      ...(value===undefined?{}:{value}),
    });
    host.send(msg("start",mode,"start-racing-"+mode));
    const beginning=await host.wait(m=>m.type==="state"&&m.state.phase==="racing","race started");
    assert.equal(beginning.state.race.positions.length,20);
    for(let i=0;i<20;i++){
      const g=guests[i];
      const id="racing-drive-"+mode+"-"+i;
      g.sock.send(msg("play",{action:"drive",lane:i%3,gas:true,boost:false},id));
      await g.sock.wait(m=>m.type==="ack"&&m.requestId===id,"drive ack "+i);
    }
    const moved=await host.wait(m=>m.type==="state"&&m.state.phase==="racing"&&m.state.race.positions.some(v=>v.distance>0),"broadcast positions");
    assert.ok(moved.state.race.positions.some(v=>v.distance>0));
    assert.equal(moved.state.race.positions.length,20);
    const original=guests[0],replacement=await connect();
    replacement.send({type:"resume",code:room.code,actor:original.credential.actor,token:original.credential.token});
    await replacement.wait(m=>m.type==="ready","reconnected player");
    const recovered=await replacement.wait(m=>m.type==="state"&&m.state.phase==="racing","recovered race");
    assert.equal(recovered.state.race.positions.length,20);
    assert.equal(recovered.state.race.me.distance>=0,true);
    assert.ok(!JSON.stringify(recovered.state).includes(original.credential.token));
    const attempt=msg("play",{action:"drive",lane:0,gas:true,boost:false,distance:900},"forged-teleport");
    replacement.send(attempt);
    assert.match((await replacement.wait(m=>m.type==="error","reject fake position")).message,/Invalid race control/);
    host.send(msg("play",{action:"end-match"},"race-stop-host"));
    await host.wait(m=>m.type==="ack"&&m.requestId==="race-stop-host","host stop");
    const final=await host.wait(m=>m.type==="state"&&m.state.phase==="reveal","official results");
    assert.equal(final.state.race.results.length,20);
    assert.ok(final.state.race.results.every(x=>Number.isSafeInteger(x.rank)));
  });
}
