import { and,eq,sql } from "drizzle-orm";
import { db } from "./db";
import { questionAttempts,questionSchedule } from "@shared/schema";
import { calculateReview } from "./study-scheduler";

export async function recordQuestionAttempt(userId:string,questionId:number,correct:boolean,requestId:string) {
  return db.transaction(async tx=>{
    // Request lock protects retries that reuse an identifier for a different question.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}),hashtext(${'question-request:'+requestId}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}),${questionId})`);
    const [existing]=await tx.select().from(questionAttempts).where(and(eq(questionAttempts.userId,userId),eq(questionAttempts.requestId,requestId)));
    if(existing){if(existing.questionId!==questionId)throw Object.assign(new Error("Request identifier belongs to another question"),{status:409});return existing;}
    const [previous]=await tx.select().from(questionSchedule).where(and(eq(questionSchedule.userId,userId),eq(questionSchedule.questionId,questionId)));
    const computed=calculateReview(previous?.fsrsState??null,correct?3:1,new Date());
    const state={userId,questionId,fsrsState:computed.after,dueAt:computed.after.due,lastCorrect:correct};
    await tx.insert(questionSchedule).values(state).onConflictDoUpdate({target:[questionSchedule.userId,questionSchedule.questionId],set:state});
    const [event]=await tx.insert(questionAttempts).values({userId,questionId,requestId,correct}).returning();
    return event;
  });
}
