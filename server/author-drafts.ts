import type { Express } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { decks } from "@shared/schema";
import { requireUser } from "./auth";

const input=z.object({revision:z.number().int().nonnegative(),body:z.record(z.unknown())}).strict();
export function registerAuthorDraftRoutes(app: Express){
  app.use("/api/decks/:id/draft",requireUser,async(req,res,next)=>{
    try{
      const id=z.coerce.number().int().positive().parse(req.params.id);
      const [deck]=await db.select({id:decks.id}).from(decks).where(and(eq(decks.id,id),eq(decks.ownerId,req.studyUser!.id)));
      if(!deck){res.status(404).json({message:"Deck not found"});return;}
      res.locals.deckId=id;next();
    }catch(e){next(e);}
  });
  app.get("/api/decks/:id/draft",async(req,res,next)=>{
    try{const result=await db.execute(sql`SELECT body,revision,updated_at FROM author_drafts WHERE owner_id=${req.studyUser!.id} AND deck_id=${res.locals.deckId}`);res.json(result.rows[0]??{body:null,revision:0});}catch(e){next(e);}
  });
  app.put("/api/decks/:id/draft",async(req,res,next)=>{
    try{
      const data=input.parse(req.body),owner=req.studyUser!.id,id=res.locals.deckId;
      if(Buffer.byteLength(JSON.stringify(data.body))>64000){res.status(413).json({message:"Draft is too large"});return;}
      const row=await db.transaction(async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${owner}),${id})`);
        const current=await tx.execute(sql`SELECT revision FROM author_drafts WHERE owner_id=${owner} AND deck_id=${id}`);
        if((current.rows[0]?.revision??0)!==data.revision)return null;
        return tx.execute(sql`INSERT INTO author_drafts(owner_id,deck_id,body,revision) VALUES(${owner},${id},${JSON.stringify(data.body)}::jsonb,1) ON CONFLICT(owner_id,deck_id) DO UPDATE SET body=EXCLUDED.body,revision=author_drafts.revision+1,updated_at=now() RETURNING revision`);
      });
      if(!row){res.status(409).json({message:"Draft changed in another tab or device. Reload to recover the latest draft."});return;}
      res.json(row.rows[0]);
    }catch(e){if(e instanceof z.ZodError)res.status(400).json({message:"Invalid draft"});else next(e);}
  });
}
