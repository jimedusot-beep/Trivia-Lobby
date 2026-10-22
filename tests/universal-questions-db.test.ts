import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

test("PostgreSQL question persistence, ordering, duplicates and rollback (requires DATABASE_URL + migration)", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { db, pool } = await import("../server/db");
  const { decks, universalQuestions } = await import("../shared/schema");
  const { eq } = await import("drizzle-orm");
  const { addUniversalQuestion, editUniversalQuestion, getUniversalQuestion, listUniversalQuestions,
    reorderUniversalQuestions, removeUniversalQuestion } = await import("../server/universal-question-store");
  const { universalQuestionSchema } = await import("../shared/universal-questions");
  const [deck] = await db.insert(decks).values({title:"Phase2 integration " + randomUUID(),category:"Test"}).returning();
  const make = (prompt:string) => universalQuestionSchema.parse({schemaVersion:1,id:randomUUID(),prompt,answer:{
    kind:"multiple_choice", options:[{id:"A",label:"No"},{id:"B",label:"Yes"}],correctOptionIds:["B"],
  }});
  try {
    const a = await addUniversalQuestion(deck.id,make("First?"));
    const b = await addUniversalQuestion(deck.id,make("Second?"));
    assert.equal((await listUniversalQuestions(deck.id)).length,2);
    await assert.rejects(()=>addUniversalQuestion(deck.id,make("First?")));
    await reorderUniversalQuestions(deck.id,[b.id,a.id]);
    assert.deepEqual((await listUniversalQuestions(deck.id)).map(q=>q.id),[b.id,a.id]);
    const edited=await editUniversalQuestion(deck.id,a.id,make("Updated?"));
    assert.equal(edited?.question.prompt,"Updated?");
    assert.equal((await getUniversalQuestion(deck.id,a.id))?.question.prompt,"Updated?");
    await assert.rejects(()=>reorderUniversalQuestions(deck.id,[a.id,a.id]));
    await assert.rejects(()=>db.transaction(async tx=>{
      await tx.insert(universalQuestions).values({
        deckId:deck.id,position:99,fingerprint:randomUUID(),definition:make("Rollback?"),
      });
      throw new Error("Force rollback");
    }));
    assert.equal((await listUniversalQuestions(deck.id)).length,2);
    assert.equal(await removeUniversalQuestion(deck.id,a.id),true);
    assert.equal((await listUniversalQuestions(deck.id)).length,1);
  } finally {
    await db.delete(decks).where(eq(decks.id,deck.id));
    // pool is shared; don't end it when other tests may use it
    void pool;
  }
});
