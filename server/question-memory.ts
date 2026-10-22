import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { calculateReview } from "./study-scheduler";

/** Atomic, idempotent question attempts and FSRS schedules, including visual questions. */
export async function rememberQuestion(owner:string, questionId:number, requestId:string, response:unknown, correct:boolean){
  const hash=createHash("sha256").update(JSON.stringify(response)??"null").digest("hex");
  return db.transaction(async tx=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${owner}),${questionId})`);
    const previous=await tx.execute(sql`SELECT question_id,response_hash,correct FROM question_attempts WHERE owner_id=${owner} AND request_id=${requestId}`);
    if(previous.rows[0])return previous.rows[0].question_id===questionId&&previous.rows[0].response_hash===hash ? "replayed" : "conflict";
    const state=await tx.execute(sql`SELECT fsrs_state FROM question_schedule WHERE owner_id=${owner} AND question_id=${questionId}`);
    const review=calculateReview(state.rows[0]?.fsrs_state??null,correct?3:1,new Date());
    await tx.execute(sql`INSERT INTO question_schedule(owner_id,question_id,fsrs_state,due_at,needs_work) VALUES(${owner},${questionId},${JSON.stringify(review.after)}::jsonb,${review.after.due},${!correct}) ON CONFLICT(owner_id,question_id) DO UPDATE SET fsrs_state=EXCLUDED.fsrs_state,due_at=EXCLUDED.due_at,needs_work=EXCLUDED.needs_work`);
    await tx.execute(sql`INSERT INTO question_attempts(id,owner_id,question_id,request_id,response_hash,correct) VALUES(${randomUUID()},${owner},${questionId},${requestId},${hash},${correct})`);
    return "created";
  });
}
