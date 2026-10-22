import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { authorDrafts, decks, questionAttempts } from "@shared/schema";
import { universalQuestionSchema, legacyCardToQuestion } from "@shared/universal-questions";
import { api } from "@shared/routes";
import { requireUser } from "./auth";
import { storage } from "./storage";
import { listUniversalQuestions } from "./universal-question-store";
import { exportQti, exportAnkiText } from "./interchange";

export function registerContentRoutes(app: Express) {
  const id = z.coerce.number().int().positive().safe();
  app.get("/api/decks/:id/backup", requireUser, async (req,res,next)=>{
    try {
      const deck=await storage.getDeck(id.parse(req.params.id),req.studyUser!.id);
      if(!deck){res.status(404).json({message:"Deck not found"});return;}
      const questions=await listUniversalQuestions(deck.id);
      res.setHeader("Content-Disposition", "attachment; filename=trivia-lobby-deck-v2.json");
      res.json({format:"trivia-lobby-deck",version:2,exportedAt:new Date().toISOString(),
        deck:{title:deck.title,description:deck.description,category:deck.category},
        cards:deck.cards.map(({id:_id,deckId:_deck,createdAt:_time,...card})=>card),
        questions:questions.map(q=>q.question)});
    }catch(e){next(e);}
  });
  app.post("/api/backups/restore",requireUser,async(req,res,next)=>{
    try {
      const input=z.object({format:z.literal("trivia-lobby-deck"),version:z.literal(2),exportedAt:z.string().optional(),
        deck:api.decks.create.input,cards:z.array(z.unknown()),questions:z.array(universalQuestionSchema)}).strict().parse(req.body);
      const content=api.decks.import.input.parse(input);
      res.status(201).json(await storage.importDeck(content.deck,content.cards,req.studyUser!.id,undefined,content.questions));
    }catch(e){if(e instanceof z.ZodError)res.status(400).json({message:"Invalid backup",issues:e.issues});else next(e);}
  });
  app.get("/api/decks/:id/export/:format",requireUser,async(req,res,next)=>{
    try {
      const deck=await storage.getDeck(id.parse(req.params.id),req.studyUser!.id);
      if(!deck){res.status(404).json({message:"Deck not found"});return;}
      const questions=await listUniversalQuestions(deck.id);
      if(req.params.format==="qti") {
        const data=exportQti([...deck.cards.map(legacyCardToQuestion),...questions.map(q=>q.question)]);
        res.setHeader("Content-Disposition","attachment; filename=trivia-lobby.qti");
        res.type("application/zip").send(data);
      } else if(req.params.format==="anki") {
        const basic=questions.map(({question:q})=>{
          if(q.answer.kind === "flashcard")return {front:q.prompt,back:q.answer.back};
          if(q.answer.kind === "text" || q.answer.kind === "short_answer")return {front:q.prompt,back:q.answer.acceptedAnswers.join("; ")};
          throw new Error("Unsupported Anki Basic export question kind: "+q.answer.kind);
        });
        res.setHeader("Content-Disposition","attachment; filename=trivia-lobby-anki.txt");
        res.type("text/plain").send(exportAnkiText([...deck.cards,...basic]));
      } else res.status(404).json({message:"Unknown export format"});
    }catch(e){if(e instanceof Error && e.message.startsWith("Unsupported"))res.status(422).json({message:e.message});else next(e);}
  });
  app.get("/api/decks/:id/draft",requireUser,async(req,res,next)=>{
    try {
      const [draft]=await db.select().from(authorDrafts).where(and(eq(authorDrafts.deckId,id.parse(req.params.id)),eq(authorDrafts.ownerId,req.studyUser!.id)));
      res.json(draft??null);
    }catch(e){next(e);}
  });
  app.put("/api/decks/:id/draft",requireUser,async(req,res,next)=>{
    try {
      const deckId=id.parse(req.params.id),ownerId=req.studyUser!.id;
      const input=z.object({payload:z.record(z.unknown()),revision:z.number().int().nonnegative()}).strict().parse(req.body);
      if(JSON.stringify(input.payload).length>100000){res.status(413).json({message:"Draft is too large"});return;}
      const outcome=await db.transaction(async tx=>{
        const [deck]=await tx.select({id:decks.id}).from(decks).where(and(eq(decks.id,deckId),eq(decks.ownerId,ownerId))).for("update");
        if(!deck)return {status:404};
        const [old]=await tx.select().from(authorDrafts).where(and(eq(authorDrafts.ownerId,ownerId),eq(authorDrafts.deckId,deckId)));
        if((old?.revision??0)!==input.revision)return {status:409,draft:old};
        const value={ownerId,deckId,payload:input.payload,revision:input.revision+1,updatedAt:new Date()};
        const [draft]=await tx.insert(authorDrafts).values(value).onConflictDoUpdate({target:[authorDrafts.ownerId,authorDrafts.deckId],set:value}).returning();
        return {status:200,draft};
      });
      res.status(outcome.status).json(outcome.draft??{message:"Deck not found"});
    }catch(e){if(e instanceof z.ZodError)res.status(400).json({message:"Invalid draft"});else next(e);}
  });
  app.get("/api/study/question-history",requireUser,async(req,res,next)=>{
    try{res.json(await db.select().from(questionAttempts).where(eq(questionAttempts.userId,req.studyUser!.id)).orderBy(desc(questionAttempts.createdAt)).limit(2000));}
    catch(e){next(e);}
  });
}
