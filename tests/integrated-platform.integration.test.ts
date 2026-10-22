import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import express from "express";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("integrated private questions, deduplication, full backup recovery, drafts and approved AI publishing",{skip:!process.env.TEST_DATABASE_URL||process.env.TEST_DATABASE_URL!==process.env.DATABASE_URL},async()=>{
  const {registerRoutes}=await import("../server/routes"),{pool,db}=await import("../server/db");
  const {studySources,studyDrafts}=await import("../shared/schema");
  const dir=await mkdtemp(join(tmpdir(),"trivia-integrated-"));process.env.PRIVATE_STORAGE_DIR=dir;
  const app=express();app.use(express.json({limit:"3mb"}));const server=createServer(app);await registerRoutes(server,app);
  server.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  async function request(path:string,method="GET",body?:unknown,cookie?:string){
    const r=await fetch(base+path,{method,headers:{...(body===undefined?{}:{"Content-Type":"application/json"}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,data:await r.json().catch(()=>null),cookie:r.headers.get("set-cookie")?.split(";")[0]};
  }
  const suffix=randomUUID(),users:string[]=[];
  try{
    const a=await request("/api/auth/register","POST",{email:`a-${suffix}@example.test`,password:"Integration-passphrase-2026"});
    const b=await request("/api/auth/register","POST",{email:`b-${suffix}@example.test`,password:"Integration-passphrase-2026"});
    assert.equal(a.status,201);assert.equal(b.status,201);users.push(a.data.id,b.data.id);
    const imported={deck:{title:"Import "+suffix},cards:[{front:"Card",back:"Answer",type:"flashcard"}]};
    const [i1,i2]=await Promise.all([request("/api/decks/import","POST",imported,a.cookie),request("/api/decks/import","POST",imported,a.cookie)]);
    assert.equal(i1.status,201);assert.equal(i2.status,201);assert.equal(i1.data.id,i2.data.id);const deckId=i1.data.id;
    const definition={schemaVersion:1,prompt:"Private visual question",explanation:"Explanation",source:{attribution:"Private text",quote:"Secret source passage"},answer:{kind:"multiple_choice",options:[{id:"A",label:"Incorrect"},{id:"B",label:"Correct"}],correctOptionIds:["B"]}};
    const saved=await request(`/api/decks/${deckId}/questions`,"POST",definition,a.cookie);assert.equal(saved.status,201);const qid=saved.data.id;
    for(const [path,method,body] of [
      ["","GET",undefined],["/practice","GET",undefined],["","POST",definition],["/reorder","PATCH",{ids:[qid]}],
      [`/${qid}`,"PATCH",definition],[`/${qid}`,"DELETE",undefined],[`/${qid}/check`,"POST",{response:{selectedIds:["B"]}}],
    ] as const){assert.equal((await request(`/api/decks/${deckId}/questions${path}`,method,body,b.cookie)).status,404);assert.equal((await request(`/api/decks/${deckId}/questions${path}`,method,body)).status,401);}
    const projection=await request(`/api/decks/${deckId}/questions/practice`,"GET",undefined,a.cookie);
    assert(!JSON.stringify(projection.data).includes("Secret source passage"));assert(!JSON.stringify(projection.data).includes("correctOptionIds"));
    const rid=randomUUID();for(let n=0;n<2;n++)assert.equal((await request(`/api/decks/${deckId}/questions/${qid}/check`,"POST",{response:{selectedIds:["B"]},requestId:rid},a.cookie)).status,200);
    assert.equal((await request("/api/study/question-history","GET",undefined,a.cookie)).data.length,1);
    assert.equal((await request("/api/study/question-history","GET",undefined,b.cookie)).data.length,0);
    const cards=(await request(`/api/decks/${deckId}`,"GET",undefined,a.cookie)).data.cards;
    assert.equal((await request("/api/study/review","POST",{cardId:cards[0].id,rating:3,requestId:randomUUID()},b.cookie)).status,404);
    assert.equal((await request("/api/study/dashboard","GET",undefined,b.cookie)).data.decks.length,0);
    const draft=await request(`/api/decks/${deckId}/draft`,"PUT",{revision:0,payload:{prompt:"Recover me"}},a.cookie);assert.equal(draft.status,200);
    assert.equal((await request(`/api/decks/${deckId}/draft`,"PUT",{revision:0,payload:{prompt:"Stale overwrite"}},a.cookie)).status,409);
    assert.equal((await request(`/api/decks/${deckId}/draft`,"GET",undefined,b.cookie)).data,null);
    const login=await request("/api/auth/login","POST",{email:`a-${suffix}@example.test`,password:"Integration-passphrase-2026"});
    assert.equal((await request(`/api/decks/${deckId}/draft`,"GET",undefined,login.cookie)).data.payload.prompt,"Recover me");
    const [source]=await db.insert(studySources).values({id:randomUUID(),userId:a.data.id,title:"Teacher source",body:"The capital of France is Paris. ".repeat(4)}).returning();
    const [ai]=await db.insert(studyDrafts).values({id:randomUUID(),userId:a.data.id,sourceId:source.id,front:"Capital of France?",back:"Paris",evidence:"The capital of France is Paris.",approved:false}).returning();
    assert.equal((await request(`/api/study/drafts/${ai.id}/publish`,"POST",{deckId},a.cookie)).status,404);
    assert.equal((await request(`/api/study/drafts/${ai.id}`,"PATCH",{front:ai.front,back:ai.back,approved:true},a.cookie)).status,200);
    assert.equal((await request(`/api/study/drafts/${ai.id}/publish`,"POST",{deckId},b.cookie)).status,404);
    const published=await request(`/api/study/drafts/${ai.id}/publish`,"POST",{deckId},a.cookie);assert.equal(published.status,201);
    assert.equal((await request(`/api/study/drafts/${ai.id}/publish`,"POST",{deckId},a.cookie)).data.id,published.data.id);
    const backup=await request(`/api/decks/${deckId}/backup`,"GET",undefined,a.cookie);assert.equal(backup.data.questions.length,2);
    // A forced referential failure must roll back cascaded child deletions as one database operation.
    await pool.query("CREATE TABLE IF NOT EXISTS integrated_restrict_deck(id integer REFERENCES decks(id) ON DELETE RESTRICT)");
    await pool.query("INSERT INTO integrated_restrict_deck(id) VALUES($1)",[deckId]);
    assert.equal((await request(`/api/decks/${deckId}`,"DELETE",undefined,a.cookie)).status,500);
    assert.equal((await request(`/api/decks/${deckId}`,"GET",undefined,a.cookie)).data.cards.length,1);
    await pool.query("DROP TABLE integrated_restrict_deck");
    assert.equal((await request(`/api/decks/${deckId}`,"DELETE",undefined,a.cookie)).status,204);
    const restored=await request("/api/backups/restore","POST",backup.data,a.cookie);assert.equal(restored.status,201);
    const after=await request(`/api/decks/${restored.data.id}/backup`,"GET",undefined,a.cookie);
    assert.deepEqual(after.data.cards,backup.data.cards);assert.deepEqual(after.data.questions,backup.data.questions);
    assert.equal((await request("/api/backups/restore","POST",backup.data,a.cookie)).data.id,restored.data.id);
    assert.equal((await request(`/api/decks/${restored.data.id}/backup`,"GET",undefined,b.cookie)).status,404);
  }finally{
    await pool.query("DROP TABLE IF EXISTS integrated_restrict_deck");
    for(const owner of users){await pool.query("DELETE FROM decks WHERE owner_id=$1",[owner]);await pool.query("DELETE FROM users WHERE id=$1",[owner]);}
    await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();await rm(dir,{recursive:true,force:true});
  }
});
