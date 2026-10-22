import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { decks, universalQuestions } from "@shared/schema";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";

export type SavedUniversalQuestion = {
  id: number; deckId: number; position: number; question: UniversalQuestion;
};
const decode = (row: typeof universalQuestions.$inferSelect): SavedUniversalQuestion => ({
  id: row.id, deckId: row.deckId, position: row.position,
  question: universalQuestionSchema.parse(row.definition),
});
function fingerprint(question: UniversalQuestion) {
  // Duplicate prompts of the same kind are intentionally disallowed per deck.
  return createHash("sha256").update(JSON.stringify([
    question.answer.kind, question.prompt.trim().normalize("NFKC").toLocaleLowerCase(),
  ])).digest("hex");
}
export async function deckExists(deckId: number) {
  const [record] = await db.select({ id: decks.id }).from(decks).where(eq(decks.id, deckId));
  return !!record;
}
export async function listUniversalQuestions(deckId: number) {
  const rows = await db.select().from(universalQuestions)
    .where(eq(universalQuestions.deckId, deckId))
    .orderBy(asc(universalQuestions.position), asc(universalQuestions.id));
  return rows.map(decode);
}
export async function getUniversalQuestion(deckId: number, questionId: number) {
  const [row] = await db.select().from(universalQuestions)
    .where(and(eq(universalQuestions.deckId, deckId), eq(universalQuestions.id, questionId)));
  return row ? decode(row) : undefined;
}
export async function addUniversalQuestion(deckId: number, question: UniversalQuestion) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8091, ${deckId})`);
    const current = await tx.select({ position: universalQuestions.position })
      .from(universalQuestions).where(eq(universalQuestions.deckId, deckId));
    if (current.length >= 500) throw new Error("Deck question limit is 500");
    const position = current.length ? Math.max(...current.map(q => q.position)) + 1 : 0;
    const [row] = await tx.insert(universalQuestions).values({
      deckId, position, fingerprint: fingerprint(question), definition: question,
    }).returning();
    return decode(row);
  });
}
export async function editUniversalQuestion(deckId: number, questionId: number, question: UniversalQuestion) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8091, ${deckId})`);
    const [old] = await tx.select().from(universalQuestions)
      .where(and(eq(universalQuestions.deckId, deckId), eq(universalQuestions.id, questionId)))
      .for("update");
    if (!old) return undefined;
    const materiallyChanged = JSON.stringify(universalQuestionSchema.parse(old.definition)) !== JSON.stringify(question);
    const [row] = await tx.update(universalQuestions)
      .set({ definition: question, fingerprint: fingerprint(question) })
      .where(and(eq(universalQuestions.deckId, deckId), eq(universalQuestions.id, questionId)))
      .returning();
    // Historical attempt rows stay immutable. Only the current FSRS mastery
    // is invalidated, and unchanged saves preserve the existing due date.
    if (materiallyChanged) {
      await tx.execute(sql`DELETE FROM question_schedule WHERE question_id=${questionId}`);
    }
    return decode(row);
  });
}
export async function removeUniversalQuestion(deckId: number, questionId: number) {
  const rows = await db.delete(universalQuestions)
    .where(and(eq(universalQuestions.deckId, deckId), eq(universalQuestions.id, questionId)))
    .returning({ id: universalQuestions.id });
  return rows.length > 0;
}
export async function reorderUniversalQuestions(deckId: number, orderedIds: number[]) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(8091, ${deckId})`);
    const rows = await tx.select({ id: universalQuestions.id })
      .from(universalQuestions).where(eq(universalQuestions.deckId, deckId));
    const existing = rows.map(r => r.id).sort((a,b) => a-b);
    const proposed = [...orderedIds].sort((a,b) => a-b);
    if (existing.length !== proposed.length || existing.some((id,i) => id !== proposed[i])) {
      throw new Error("Reorder must contain exactly the deck question IDs");
    }
    for (let position = 0; position < orderedIds.length; position++) {
      const id = orderedIds[position];
      await tx.update(universalQuestions).set({ position })
        .where(and(eq(universalQuestions.deckId, deckId), eq(universalQuestions.id, id)));
    }
  });
}
