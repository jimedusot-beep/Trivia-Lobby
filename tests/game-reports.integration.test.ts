import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../server/routes";
import { gameReportSink } from "../server/game-reports";
import { pool } from "../server/db";

test("game reports persist idempotently, remain owner-private and export safe CSV", {
  skip: !process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL,
}, async () => {
  const app=express();app.use(express.json());
  const server=createServer(app);await registerRoutes(server,app);
  app.use((err:any,_req:any,res:any,_next:any)=>res.status(500).json({message:"Server error"}));
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base="http://127.0.0.1:"+(server.address() as any).port;
  const request=async(path:string,method="GET",body?:unknown,cookie?:string)=>{
    const response=await fetch(base+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),
      ...(body!==undefined?{"Content-Type":"application/json"}:{})},
      body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.text(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
  };
  let ownerId="";
  try {
    const suffix=randomUUID();
    const alice=await request("/api/auth/register","POST",{email:"host-"+suffix+"@example.test",password:"Report-test-passphrase-2026"});
    const bob=await request("/api/auth/register","POST",{email:"other-"+suffix+"@example.test",password:"Report-test-passphrase-2026"});
    assert.equal(alice.status,201);assert.equal(bob.status,201);
    const owner=await request("/api/auth/me","GET",undefined,alice.cookie);
    ownerId=JSON.parse(owner.body).id;
    const deck=await request("/api/decks","POST",{title:"Private report test"},alice.cookie);
    assert.equal(deck.status,201);const deckId=JSON.parse(deck.body).id;
    const id=randomUUID(),playerId=randomUUID();
    await gameReportSink.created({id,ownerId,deckId,deckTitle:"Private report test"});
    const round={id,questionIndex:0,prompt:"Best answer?",kind:"multiple_choice",options:["A","B"],
      correctAnswers:["B"],durationMs:10000,playerAnswers:[{playerId,name:"=1+1",response:"B",correct:true,awarded:100,responseMs:1210}]};
    await gameReportSink.round(round);
    await gameReportSink.round({...round,prompt:"Overwritten attempt"});
    await gameReportSink.finished({id,mode:"classic",leaderboard:[{playerId,name:"=1+1",score:100}]});
    const own=await request("/api/reports/"+id,"GET",undefined,alice.cookie);
    assert.equal(own.status,200);
    assert.equal(JSON.parse(own.body).rounds[0].prompt,"Best answer?");
    assert.equal(JSON.parse(own.body).leaderboard[0].score,100);
    assert.equal((await request("/api/reports/"+id,"GET",undefined,bob.cookie)).status,404);
    assert.equal((await request("/api/reports/"+id+".csv","GET",undefined,bob.cookie)).status,404);
    assert.equal((await request("/api/reports","GET")).status,401);
    const exported=await request("/api/reports/"+id+".csv","GET",undefined,alice.cookie);
    assert.equal(exported.status,200);assert(exported.body.includes("'=1+1"));
    assert.equal((await request("/api/reports/"+id,"DELETE",undefined,bob.cookie)).status,404);
    await request("/api/decks/"+deckId,"DELETE",undefined,alice.cookie);
    assert.equal((await request("/api/reports/"+id,"GET",undefined,alice.cookie)).status,200);
    assert.equal((await request("/api/reports/"+id,"DELETE",undefined,alice.cookie)).status,204);
    assert.equal((await request("/api/reports/"+id,"GET",undefined,alice.cookie)).status,404);
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(ownerId) await pool.query("DELETE FROM users WHERE id=$1",[ownerId]);
    // Other test accounts are stored in an isolated disposable integration database.
  }
});
