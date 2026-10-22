import type { Express } from "express";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { cards, decks, insertCardSchema, insertDeckSchema, universalQuestions } from "@shared/schema";
import { universalQuestionSchema, legacyCardToQuestion } from "@shared/universal-questions";
import { requireUser } from "./auth";
import { db } from "./db";
import { listUniversalQuestions } from "./universal-question-store";
import { exportAnkiTsv, exportQti } from "./portable-formats";

export const deckBackupSchema = z.object({
  format:z.literal("trivia-lobby-deck"), version:z.literal(2),
  deck:insertDeckSchema,
  cards:z.array(insertCardSchema.omit({ deckId:true })).max(5000),
  questions:z.array(universalQuestionSchema).max(500),
}).strict().refine(v=>v.cards.length+v.questions.length>0,"Backup must contain cards or questions");

export function registerBackupRoutes(app: Express) {
  app.get("/api/decks/:id/backup", requireUser, async (req,res,next)=>{
    try {
      const id=z.coerce.number().int().positive().parse(req.params.id);
      const [deck]=await db.select().from(decks).where(and(eq(decks.id,id),eq(decks.ownerId,req.studyUser!.id)));
      if(!deck){res.status(404).json({message:"Deck not found"});return;}
      const rows=await db.select().from(cards).where(eq(cards.deckId,id)).orderBy(cards.id);
      const questions=await listUniversalQuestions(id);
      const format=req.query.format??"json";
      if(format==="anki") {
        res.type("text/plain").attachment("trivia-lobby-anki.txt");
        const converted=questions.map(({question:q})=>{
          const a=q.answer;
          if(a.kind==="flashcard")return {front:q.prompt,back:a.back};
          if(a.kind==="text"||a.kind==="short_answer")return {front:q.prompt,back:a.acceptedAnswers.join("; ")};
          if(a.kind==="multiple_choice")return {front:q.prompt,back:a.options.find(o=>o.id===a.correctOptionIds[0])!.label};
          throw new Error("Use JSON export to preserve visual or complex question types");
        });
        res.send(exportAnkiTsv([...rows,...converted]));return;
      }
      if(format==="qti") {
        const index=z.coerce.number().int().min(0).default(0).parse(req.query.index);
        const question=[...questions.map(q=>q.question),...rows.map(legacyCardToQuestion)][index];
        if(!question){res.status(404).json({message:"Question not found"});return;}
        res.type("application/xml").attachment("question.qti").send(exportQti(question));return;
      }
      if(format!=="json"){res.status(400).json({message:"Unknown export format"});return;}
      res.attachment("trivia-lobby-deck-v2.json").json({format:"trivia-lobby-deck",version:2,
        deck:{title:deck.title,description:deck.description,category:deck.category},
        cards:rows.map(({id:_id,deckId:_deck,createdAt:_date,...card})=>card),questions:questions.map(q=>q.question),
      });
    }catch(err){ if(err instanceof z.ZodError || err instanceof Error && /export|accepted answer/.test(err.message))res.status(422).json({message:err.message});else next(err); }
  });
  app.post("/api/decks/restore",requireUser,async(req,res,next)=>{
    try {
      const input=deckBackupSchema.parse(req.body),ownerId=req.studyUser!.id;
      const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const deck=await db.transaction(async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}),hashtext(${hash}))`);
        const existing=await tx.execute(sql`SELECT d.* FROM import_receipts r JOIN decks d ON d.id=r.deck_id WHERE r.owner_id=${ownerId} AND r.fingerprint=${hash}`);
        if(existing.rows.length)return {id:existing.rows[0].id,replayed:true};
        const [created]=await tx.insert(decks).values({...input.deck,ownerId}).returning();
        if(input.cards.length)await tx.insert(cards).values(input.cards.map(c=>({...c,deckId:created.id})));
        if(input.questions.length)await tx.insert(universalQuestions).values(input.questions.map((q,position)=>{
          const question={...q,id:randomUUID()};
          const fingerprint=createHash("sha256").update(JSON.stringify([q.answer.kind,q.prompt.trim().normalize("NFKC").toLowerCase()])).digest("hex");
          return {deckId:created.id,position,fingerprint,definition:question};
        }));
        await tx.execute(sql`INSERT INTO import_receipts(owner_id,fingerprint,deck_id) VALUES(${ownerId},${hash},${created.id})`);
        return {id:created.id,replayed:false};
      });
      res.status(deck.replayed?200:201).json(deck);
    }catch(err){if(err instanceof z.ZodError)res.status(400).json({message:"Invalid backup",issues:err.issues});else next(err);}
  });
}
