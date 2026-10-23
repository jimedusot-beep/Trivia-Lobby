import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { registerRoutes } from "../server/routes";
import { pool } from "../server/db";

test("self-paced assignment persists guest progress, grades privately and guards owner access",{
  skip: !process.env.TEST_DATABASE_URL||process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL
},async()=>{
  const app=express();app.use(express.json());const server=createServer(app);await registerRoutes(server,app);
  app.use((err:any,_req:any,res:any,_next:any)=>res.status(500).json({message:"Internal test error"}));
  await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+(server.address() as any).port;
  const request=async(path:string,method="GET",body?:unknown,cookie?:string)=>{
    const response=await fetch(base+path,{method,headers:{Origin:base,...(body!==undefined?{"Content-Type":"application/json"}:{}),
      ...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json().catch(()=>null),cookie:response.headers.get("set-cookie")?.split(";")[0]};
  };
  const suffix=randomUUID(),email="assignment-"+suffix+"@example.test",password="Assignment-test-passphrase-2026";
  let ownerId="";
  try {
    const owner=await request("/api/auth/register","POST",{email,password});assert.equal(owner.status,201);
    const other=await request("/api/auth/register","POST",{email:"other-"+suffix+"@example.test",password});assert.equal(other.status,201);
    const me=await request("/api/auth/me","GET",undefined,owner.cookie);ownerId=me.data.id;
    const created=await request("/api/decks","POST",{title:"Assignment sample"},owner.cookie);assert.equal(created.status,201);
    const deckId=created.data.id;
    const question={schemaVersion:1,prompt:"One of two?",answer:{kind:"multiple_choice",options:[{id:"a",label:"A"},{id:"b",label:"B"}],correctOptionIds:["a"]}};
    const saved=await request(`/api/decks/${deckId}/questions`,"POST",question,owner.cookie);
    assert.equal(saved.status,201);
    const published=await request("/api/assignments","POST",{deckId,title:"Quiz challenge",maxAttempts:1},owner.cookie);
    assert.equal(published.status,201);
    const id=published.data.id;
    assert.equal((await request("/api/assignments/"+id,"GET",undefined,other.cookie)).status,404);
    assert.equal((await request("/api/assignments","GET")).status,401);
    const guest=await request("/api/assignments/public/"+id);
    assert.equal(guest.status,200);
    assert.equal(guest.data.questions.length,1);
    assert(!JSON.stringify(guest.data).includes("correctOptionIds"));
    const start=await request("/api/assignments/public/"+id+"/start","POST",{name:"Student"});
    assert.equal(start.status,201);assert(start.data.secret.length>=32);
    const token={attemptId:start.data.attemptId,secret:start.data.secret};
    assert.equal((await request("/api/assignments/public/"+id+"/start","POST",{name:"Student"})).status,409);
    assert.equal((await request("/api/assignments/public/"+id+"/attempt","PUT",{
      ...token,answers:[{questionId:saved.data.question.id,response:{selectedIds:["a"]}}]
    })).status,200);
    const resumed=await request("/api/assignments/public/"+id+"/resume","POST",token);
    assert.equal(resumed.status,200);assert.equal(resumed.data.answers.length,1);
    assert.equal((await request("/api/assignments/public/"+id+"/resume","POST",{...token,secret:"a".repeat(43)})).status,404);
    const submitted=await request("/api/assignments/public/"+id+"/submit","POST",token);
    assert.equal(submitted.status,200);assert.equal(submitted.data.correctCount,1);assert.equal(submitted.data.score,100);
    const retry=await request("/api/assignments/public/"+id+"/submit","POST",token);
    assert.equal(retry.status,200);assert.equal(retry.data.score,100);
    assert.equal((await request("/api/assignments/public/"+id+"/attempt","PUT",{...token,answers:[]})).status,409);
    const results=await request("/api/assignments/"+id,"GET",undefined,owner.cookie);
    assert.equal(results.status,200);assert.equal(results.data.attempts[0].correctCount,1);
    assert.equal((await request("/api/assignments/"+id,"DELETE",undefined,other.cookie)).status,404);
    assert.equal((await request("/api/assignments/"+id,"DELETE",undefined,owner.cookie)).status,204);
    assert.equal((await request("/api/assignments/public/"+id)).status,404);
    await request("/api/decks/"+deckId,"DELETE",undefined,owner.cookie);
  }finally{
    await new Promise<void>(r=>server.close(()=>r()));
    if(ownerId)await pool.query("DELETE FROM users WHERE id=$1",[ownerId]);
  }
});
