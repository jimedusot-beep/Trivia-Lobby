import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { calculateReview } from "./study-scheduler";

/** Atomic, idempotent question attempts and FSRS schedules, including visual questions. */
export async function rememberQuestion(owner:string, questionId:number, requestId:string, response:unknown, correct:boolean,definition:UniversalQuestion){
  const hash=createHash("sha256").update(JSON.stringify([response,definition.answer])).digest("hex");
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${owner}),hashtext(${requestId}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${owner}),${questionId})`);
    const previous=await tx.execute(sql`SELECT question_id,original_question_id,response_hash,correct FROM question_attempts WHERE owner_id=${owner} AND request_id=${requestId}`);
    if(previous.rows[0])return Number(previous.rows[0].question_id ?? previous.rows[0].original_question_id)===questionId&&previous.rows[0].response_hash===hash ? "replayed" : "conflict";
    // A question may have been edited after the browser received its prompt.
    // Serialize with authoring and reject a stale grade instead of attaching
    // the prior answer key to the new learning schedule.
    const version=await tx.execute(sql`
      SELECT uq.definition, uq.deck_id, d.title AS deck_title, d.category
      FROM universal_questions uq JOIN decks d ON d.id=uq.deck_id
      WHERE uq.id=${questionId} AND d.owner_id=${owner} FOR UPDATE OF uq`);
    if (!version.rows.length || JSON.stringify(universalQuestionSchema.parse(version.rows[0].definition)) !== JSON.stringify(definition))
      return "stale";
    const state=await tx.execute(sql`SELECT fsrs_state FROM question_schedule WHERE owner_id=${owner} AND question_id=${questionId}`);
    const review=calculateReview(state.rows[0]?.fsrs_state??null,correct?3:1,new Date());
    await tx.execute(sql`INSERT INTO question_schedule(owner_id,question_id,fsrs_state,due_at,needs_work) VALUES(${owner},${questionId},${JSON.stringify(review.after)}::jsonb,${review.after.due},${!correct}) ON CONFLICT(owner_id,question_id) DO UPDATE SET fsrs_state=EXCLUDED.fsrs_state,due_at=EXCLUDED.due_at,needs_work=EXCLUDED.needs_work`);
    await tx.execute(sql`INSERT INTO question_attempts(
      id,owner_id,question_id,request_id,response_hash,correct,
      original_question_id,original_deck_id,prompt_snapshot,deck_title_snapshot,subject_snapshot
    ) VALUES (
      ${randomUUID()},${owner},${questionId},${requestId},${hash},${correct},
      ${questionId},${Number(version.rows[0].deck_id)},${definition.prompt},
      ${String(version.rows[0].deck_title)},${String(version.rows[0].category ?? "General")}
    )`);
    return "created";
  });
}
