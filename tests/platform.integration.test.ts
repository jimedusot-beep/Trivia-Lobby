import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../server/routes";
import { pool } from "../server/db";

test("combined platform: ownership, universal restore, draft revisions, evidence approval and saved question memory",{
  skip:!process.env.TEST_DATABASE_URL||process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL,
},async()=>{
 const app=express();app.use(express.json({limit:"4mb"}));const server=createServer(app);await registerRoutes(server,app);
 app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status??500).json({message:"Test request failed"}));
 await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));const base="http://127.0.0.1:"+(server.address() as any).port;
 const request=async(path:string,method="GET",body?:unknown,cookie?:string)=>{
  const r=await fetch(base+path,{method,headers:{Origin:base,...(body?{"Content-Type":"application/json"}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json().catch(()=>null),cookie:r.headers.get("set-cookie")?.split(";")[0]};
 };
 try{
  const suffix=randomUUID(),password="Correct-test-passphrase-2026";
  const a=await request("/api/auth/register","POST",{email:`a-${suffix}@example.test`,password});
  const b=await request("/api/auth/register","POST",{email:`b-${suffix}@example.test`,password});
  assert.equal(a.status,201);assert.equal(b.status,201);
  const deck=await request("/api/decks","POST",{title:"Combined integration "+suffix},a.cookie);assert.equal(deck.status,201);
  const path=`/api/decks/${deck.data.id}`;
  const cardInput=[{front:"Original imported card",back:"Before",type:"flashcard"},{front:"Second imported card",back:"Other",type:"flashcard"}];
  assert.equal((await request(path+"/cards","POST",cardInput,a.cookie)).status,201);
  let cardRows=(await request(path,"GET",undefined,a.cookie)).data.cards;
  const originalCard=cardRows[0];
  assert.equal((await request(path+`/cards/${originalCard.id}`,"PATCH",{front:"Corrected imported card",back:"After",type:"flashcard"},b.cookie)).status,404);
  assert.equal((await request(path+`/cards/${originalCard.id}`,"PATCH",{front:"Corrected imported card",back:"After",type:"flashcard"},a.cookie)).status,200);
  const cardOrder=cardRows.map((c:any)=>c.id).reverse();
  assert.equal((await request(path+"/cards/reorder","PATCH",{ids:cardOrder},a.cookie)).status,200);
  cardRows=(await request(path,"GET",undefined,a.cookie)).data.cards;assert.deepEqual(cardRows.map((c:any)=>c.id),cardOrder);assert.equal(cardRows[1].back,"After");
  assert.equal((await request(path+"/cards","POST",[{front:"Corrected imported card",back:"After",type:"flashcard"}],a.cookie)).data.length,0);
  const definitions=[
   {prompt:"Select Alpha",answer:{kind:"multiple_choice",options:[{id:"A",label:"Alpha"},{id:"B",label:"Beta"}],correctOptionIds:["A"]}},
   {prompt:"Match capitals",explanation:"Cities and countries",source:{attribution:"Own worksheet",page:2,passage:"France: Paris"},answer:{kind:"matching",pairs:[{id:"FR",prompt:"France",match:"Paris"},{id:"DE",prompt:"Germany",match:"Berlin"}]}},
   {prompt:"Find center",answer:{kind:"image_hotspot",imageUrl:"https://example.test/own.png",imageAlt:"A labeled rectangle",targets:[{id:"mid",label:"Center",x:0.5,y:0.5,radius:0.1}],correctTargetIds:["mid"]}},
  ];
  const saved=[];
  for(const q of definitions){const r=await request(path+"/questions","POST",{schemaVersion:1,tags:[],...q},a.cookie);assert.equal(r.status,201,JSON.stringify(r.data));saved.push(r.data);}
  for(const [route,method,body] of [
   ["/questions","GET"],["/questions/practice","GET"],["/questions","POST",{schemaVersion:1,...definitions[0]}],
   [`/questions/${saved[0].id}`,"PATCH",{schemaVersion:1,...definitions[0]}],
   [`/questions/${saved[0].id}`,"DELETE"],[`/questions/${saved[0].id}/check`,"POST",{response:{selectedIds:["A"]}}],
   ["/questions/reorder","PATCH",{ids:saved.map(q=>q.id)}],["/backup","GET"],["/draft","GET"],["/draft","PUT",{revision:0,body:{prompt:"Stolen"}}],
  ] as [string,string,unknown?][]){assert.equal((await request(path+route,method,body,b.cookie)).status,404,method+route);}
  const projection=await request(path+"/questions/practice");assert.equal(projection.status,401);
  const safe=await request(path+"/questions/practice","GET",undefined,a.cookie);assert(!JSON.stringify(safe.data).includes("France: Paris"));
  const backup=await request(path+"/backup","GET",undefined,a.cookie);assert.equal(backup.data.questions.length,3);
  const restored=await request("/api/decks/restore","POST",backup.data,a.cookie);assert.equal(restored.status,201);
  const replay=await request("/api/decks/restore","POST",backup.data,a.cookie);assert.equal(replay.status,200);assert.equal(replay.data.id,restored.data.id);
  const again=await request(`/api/decks/${restored.data.id}/backup`,"GET",undefined,a.cookie);
  assert.deepEqual(again.data.questions.map(({id,...q}:any)=>q),backup.data.questions.map(({id,...q}:any)=>q));
  assert.deepEqual(again.data.cards,backup.data.cards);
  assert.equal((await request(path+"/draft","PUT",{revision:0,body:{prompt:"Recover me"}},a.cookie)).status,200);
  assert.equal((await request(path+"/draft","PUT",{revision:0,body:{prompt:"Overwrite"}},a.cookie)).status,409);
  assert.equal((await request(path+"/draft","GET",undefined,a.cookie)).data.body.prompt,"Recover me");
  const requestId=randomUUID();const check=()=>request(path+`/questions/${saved[0].id}/check`,"POST",{requestId,response:{selectedIds:["A"]}},a.cookie);
  assert.equal((await check()).data.correct,true);assert.equal((await check()).data.correct,true);
  const count=await pool.query("SELECT count(*)::int n FROM question_attempts WHERE owner_id=$1 AND request_id=$2",[a.data.id,requestId]);assert.equal(count.rows[0].n,1);
  assert.equal((await request(path+`/questions/${saved[0].id}/check`,"POST",{requestId,response:{selectedIds:["B"]}},a.cookie)).status,409);
  assert.equal((await request(path+`/questions/${saved[0].id}/check`,"POST",{requestId:randomUUID(),skipped:true},a.cookie)).data.correct,false);
  const evidence="A retained, reviewable source passage about learning and study practice. It contains facts for a teacher to check.";
  const source=await request("/api/study/sources","POST",{title:"Own source",body:evidence},a.cookie);assert.equal(source.status,201);
  const draftId=randomUUID();await pool.query("INSERT INTO study_drafts(id,user_id,source_id,front,back,evidence) VALUES($1,$2,$3,$4,$5,$6)",[draftId,a.data.id,source.data.id,"What does this source cover?","Learning and study practice",evidence]);
  const publish=()=>request(`/api/study/drafts/${draftId}/publish`,"POST",{deckId:deck.data.id},a.cookie);
  assert.equal((await publish()).status,409);
  assert.equal((await request(`/api/study/drafts/${draftId}`,"PATCH",{front:"What does this source cover?",back:"Learning and study practice",approved:true},a.cookie)).status,200);
  const published=await publish();assert.equal(published.status,201);assert.equal((await publish()).status,200);
  assert.equal((await request(`/api/study/drafts/${draftId}/publish`,"POST",{deckId:deck.data.id},b.cookie)).status,404);
  const keys=await request(path+"/questions","GET",undefined,a.cookie);assert.equal(keys.data.find((q:any)=>q.id===published.data.id).question.source.passage,evidence);
  const secondLogin=await request("/api/auth/login","POST",{email:`a-${suffix}@example.test`,password});assert.equal(secondLogin.status,200);
  assert.equal((await request(path+"/draft","GET",undefined,secondLogin.cookie)).data.body.prompt,"Recover me");
  assert.equal((await request("/api/study/queue?deckId="+deck.data.id,"GET",undefined,b.cookie)).data.cards.length,0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
});
