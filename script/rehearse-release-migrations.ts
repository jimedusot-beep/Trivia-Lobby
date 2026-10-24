/**
 * Rehearse migration 0006 against an isolated copy of the already-merged
 * 0007/0008 schema. NEVER point this at a real user database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { applyMigrations } from "./migrations";

const original=process.env.PRODUCTION_TEST_DATABASE_URL;
if(process.env.CI!=="true" || !original)throw new Error("This rehearsal runs only in GitHub CI with a disposable PostgreSQL instance");
const originalUrl=new URL(original);
if(!["127.0.0.1","localhost"].includes(originalUrl.hostname) ||
   !originalUrl.pathname.includes("_ci"))throw new Error("Refusing to alter any non-CI PostgreSQL host/database");
const targetName="trivia_upgrade_ci";
const upgradeUrl=new URL(original);
upgradeUrl.pathname="/"+targetName;
const admin=new Pool({connectionString:original});
let databaseCreated=false;
try{
  await admin.query("CREATE DATABASE "+targetName);
  databaseCreated=true;
  const database=new Pool({connectionString:upgradeUrl.toString()});
  try{
    const priorMigrations=[
      "0000_legacy_base.sql","0001_private_library.sql",
      "0001_universal_questions.sql","0004_phase4_study.sql",
      "0005_integrated_platform.sql","0007_live_game_reports.sql",
      "0008_self_paced_assignments.sql",
    ];
    const directory=new URL("../migrations/",import.meta.url);
    // Model a real database that started before the history-retention migration
    // was integrated but already contains reports and assignments.
    for(const name of priorMigrations)await database.query(await readFile(new URL(name,directory),"utf8"));
    const uid=randomUUID(),cardRequest=randomUUID(),questionRequest=randomUUID();
    const seId=randomUUID(),qaId=randomUUID(),reportId=randomUUID(),assignmentId=randomUUID();
    await database.query("INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)",
      [uid,"migration-"+uid+"@example.test","test-only-not-a-usable-password-hash"]);
    const deck=(await database.query("INSERT INTO decks(owner_id,title,category) VALUES($1,$2,$3) RETURNING id",
      [uid,"Previously hosted quiz","Space"])).rows[0].id as number;
    const card=(await database.query("INSERT INTO cards(deck_id,front,back,type) VALUES($1,$2,$3,$4) RETURNING id",
      [deck,"Original review prompt","Answer","flashcard"])).rows[0].id as number;
    const question=(await database.query(
      "INSERT INTO universal_questions(deck_id,position,fingerprint,definition) VALUES($1,0,$2,$3::jsonb) RETURNING id",
      [deck,"migration-fixture-"+uid,JSON.stringify({schemaVersion:1,id:"question-1",prompt:"Original visual prompt",
        answer:{kind:"true_false",correct:true}})])).rows[0].id as number;
    await database.query(
      `INSERT INTO study_events(id,user_id,card_id,request_id,rating,correct,due_after,state_before,state_after)
       VALUES($1,$2,$3,$4,3,true,now(),'{}'::jsonb,'{}'::jsonb)`,
      [seId,uid,card,cardRequest]);
    await database.query(
      "INSERT INTO question_attempts(id,owner_id,question_id,request_id,correct,response_hash) VALUES($1,$2,$3,$4,true,$5)",
      [qaId,uid,question,questionRequest,"test-hash"]);
    await database.query(
      "INSERT INTO live_game_sessions(id,owner_id,deck_id,deck_title) VALUES($1,$2,$3,$4)",
      [reportId,uid,deck,"Previously hosted quiz"]);
    await database.query(
      "INSERT INTO quiz_assignments(id,owner_id,deck_id,title,questions) VALUES($1,$2,$3,$4,$5::jsonb)",
      [assignmentId,uid,deck,"Existing homework",JSON.stringify([{id:"question-1",prompt:"Retained quiz item"}])]);
    const before=await database.query("SELECT count(*)::int AS n FROM quiz_assignments");
    assert.equal(before.rows[0].n,1);

    // This now applies 0006 after the existing 0007/0008 tables have been created.
    await applyMigrations(upgradeUrl.toString(),directory);
    await applyMigrations(upgradeUrl.toString(),directory);
    const backfill=await database.query(
      "SELECT original_card_id,original_deck_id,front_snapshot,deck_title_snapshot,subject_snapshot FROM study_events WHERE id=$1",
      [seId]);
    assert.equal(backfill.rows[0].original_card_id,card);
    assert.equal(backfill.rows[0].original_deck_id,deck);
    assert.equal(backfill.rows[0].front_snapshot,"Original review prompt");
    assert.equal(backfill.rows[0].deck_title_snapshot,"Previously hosted quiz");
    assert.equal(backfill.rows[0].subject_snapshot,"Space");
    const visual=await database.query(
      "SELECT original_question_id,original_deck_id,prompt_snapshot FROM question_attempts WHERE id=$1",[qaId]);
    assert.equal(visual.rows[0].original_question_id,question);
    assert.equal(visual.rows[0].original_deck_id,deck);
    assert.equal(visual.rows[0].prompt_snapshot,"Original visual prompt");

    // Deleting active content should retain personal review and report records
    // and preserve existing published assignment snapshots.
    await database.query("DELETE FROM decks WHERE id=$1",[deck]);
    const retained=await database.query("SELECT card_id,original_card_id,front_snapshot FROM study_events WHERE id=$1",[seId]);
    assert.equal(retained.rows[0].card_id,null);
    assert.equal(retained.rows[0].original_card_id,card);
    const retainedVisual=await database.query("SELECT question_id,original_question_id FROM question_attempts WHERE id=$1",[qaId]);
    assert.equal(retainedVisual.rows[0].question_id,null);
    assert.equal(retainedVisual.rows[0].original_question_id,question);
    const report=await database.query("SELECT deck_id,deck_title FROM live_game_sessions WHERE id=$1",[reportId]);
    assert.equal(report.rows[0].deck_id,null);
    assert.equal(report.rows[0].deck_title,"Previously hosted quiz");
    const assignment=await database.query("SELECT deck_id,title,questions FROM quiz_assignments WHERE id=$1",[assignmentId]);
    assert.equal(assignment.rows[0].deck_id,null);
    assert.equal(assignment.rows[0].title,"Existing homework");
    assert.equal(assignment.rows[0].questions[0].prompt,"Retained quiz item");
    console.log("PASSED: 0006 upgrades existing 0007/0008 database, remains repeatable and retains history, report and assignment snapshots");
  }finally{await database.end();}
}finally{
  if(databaseCreated){
    await admin.query("DROP DATABASE "+targetName+" WITH (FORCE)").catch(err=>{
      console.error("Could not clean disposable upgrade database:",err);
      process.exitCode=1;
    });
  }
  await admin.end();
}
