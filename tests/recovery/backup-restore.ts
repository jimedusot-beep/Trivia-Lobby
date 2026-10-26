import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp,rm,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID,createHash } from "node:crypto";
import pg from "pg";
import { putPrivateObject,getPrivateObject } from "../../server/object-storage";
const run=promisify(execFile);
test("encrypted snapshot restores PostgreSQL contents and exact retained-original bytes into isolated targets",async()=>{
  assert(process.env.DATABASE_URL && process.env.DATABASE_URL===process.env.TEST_DATABASE_URL,"Disposable test database required");
  const sourceRoot=await mkdtemp(join(tmpdir(),"trivia-backup-source-")),restoreRoot=await mkdtemp(join(tmpdir(),"trivia-backup-restored-"));
  const temp=await mkdtemp(join(tmpdir(),"trivia-backup-drill-")),backup=join(temp,"test.enc"),owner=randomUUID(),fid=randomUUID(),key=owner+"/"+fid+".blob";
  const bytes=Buffer.from("Question :: Exact Ω original bytes\n"),hash=createHash("sha256").update(bytes).digest("hex");
  const source=new pg.Client({connectionString:process.env.DATABASE_URL});await source.connect();
  const name="trivia_restore_"+randomUUID().replaceAll("-","");const target=new URL(process.env.DATABASE_URL);target.pathname="/"+name;
  let restored:pg.Client|undefined;
  try{
    await source.query(`CREATE DATABASE "${name}"`);
    process.env.PRIVATE_STORAGE_DIR=sourceRoot;await putPrivateObject(key,bytes,hash);
    await source.query("INSERT INTO users(id,email,password_hash) VALUES($1,$2,'unused-test-account')",[owner,owner+"@example.test"]);
    const deckId=(await source.query("INSERT INTO decks(owner_id,title) VALUES($1,'Recovery fixture') RETURNING id",[owner])).rows[0].id;
    await source.query("INSERT INTO cards(deck_id,type,front,back,position) VALUES($1,'flashcard','Recovered Ω prompt','Exact original answer',0)",[deckId]);
    await source.query("INSERT INTO library_files(id,owner_id,original_name,mime_type,size_bytes,sha256,object_key,extracted_text) VALUES($1,$2,'original.txt','text/plain',$3,$4,$5,'Exact original bytes')",[fid,owner,bytes.length,hash,key]);
    const count=(await source.query("SELECT count(*)::int n FROM decks")).rows[0].n;
    const env={...process.env,BACKUP_PASSPHRASE:"CI-only-recovery-passphrase-long-enough-for-GCM",S3_BUCKET:"",BACKUP_S3_BUCKET:""};
    await run(process.execPath,["--import","tsx","script/backup.ts","create",backup],{env});
    const restoreEnv={...env,RESTORE_PRIVATE_STORAGE_DIR:restoreRoot,RESTORE_DATABASE_URL:target.toString(),RESTORE_DISPOSABLE:"1",
      S3_BUCKET:"uploads",AWS_ENDPOINT_URL_S3:"https://source.storage.aws.neon.tech",AWS_ACCESS_KEY_ID:"source-test-key",AWS_SECRET_ACCESS_KEY:"source-test-secret"};
    // Inherited production-like Neon settings must never redirect a restore.
    // Existing destination data must survive a refused restore unchanged.
    const sentinel=join(restoreRoot,"existing-original.blob");await writeFile(sentinel,"do not overwrite");
    await assert.rejects(run(process.execPath,["--import","tsx","script/backup.ts","restore",backup],{env:restoreEnv}),/must be empty/);
    assert.equal(await readFile(sentinel,"utf8"),"do not overwrite");await rm(sentinel);
    await run(process.execPath,["--import","tsx","script/backup.ts","restore",backup],{env:restoreEnv});
    restored=new pg.Client({connectionString:target.toString()});await restored.connect();
    assert.equal((await restored.query("SELECT count(*)::int n FROM decks")).rows[0].n,count);
    assert.deepEqual((await restored.query("SELECT front,back FROM cards WHERE deck_id=$1",[deckId])).rows,[{front:"Recovered Ω prompt",back:"Exact original answer"}]);
    const original=(await restored.query("SELECT * FROM library_files WHERE id=$1",[fid])).rows[0];assert.equal(original.sha256,hash);
    process.env.PRIVATE_STORAGE_DIR=restoreRoot;assert.deepEqual(await getPrivateObject(key),bytes);
    assert.equal((await restored.query("SELECT extracted_text FROM library_files WHERE id=$1",[fid])).rows[0].extracted_text,"Exact original bytes");
  }finally{
    await restored?.end();await source.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await source.query("DELETE FROM decks WHERE owner_id=$1",[owner]);await source.query("DELETE FROM users WHERE id=$1",[owner]);await source.end();
    await rm(sourceRoot,{recursive:true,force:true});await rm(restoreRoot,{recursive:true,force:true});await rm(temp,{recursive:true,force:true});
  }
});
