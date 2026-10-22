import type { Express } from "express";
import { and,eq,sql } from "drizzle-orm";
import { z } from "zod";
import { api } from "@shared/routes";
import { cards,decks } from "@shared/schema";
import { db } from "./db";
import { requireUser } from "./auth";
import { CardConflict,deduplicateCards } from "./card-dedup";
const number=z.coerce.number().int().positive();
export function registerCardEditorRoutes(app:Express){
 app.use("/api/decks/:deckId/cards",requireUser,async(req,res,next)=>{
  try{const id=number.parse(req.params.deckId);const [deck]=await db.select({id:decks.id}).from(decks).where(and(eq(decks.id,id),eq(decks.ownerId,req.studyUser!.id)));
   if(!deck){res.status(404).json({message:"Deck not found"});return;}res.locals.deckId=id;next();
  }catch(e){next(e);}
 });
 app.patch("/api/decks/:deckId/cards/reorder",async(req,res,next)=>{
  try{
   const {ids}=z.object({ids:z.array(z.number().int().positive()).max(5000)}).strict().parse(req.body),deckId=res.locals.deckId;
   await db.transaction(async tx=>{
    await tx.select({id:decks.id}).from(decks).where(eq(decks.id,deckId)).for("update");
    const current=await tx.select({id:cards.id}).from(cards).where(eq(cards.deckId,deckId));
    const sorted=[...ids].sort((a,b)=>a-b),original=current.map(c=>c.id).sort((a,b)=>a-b);
    if(sorted.length!==original.length||sorted.some((id,i)=>id!==original[i]))throw new CardConflict("Reorder must contain exactly the saved card IDs");
    if(ids.length)await tx.execute(sql`UPDATE cards SET position=v.position FROM (VALUES ${sql.join(ids.map((id,position)=>sql`(${id}::integer,${position}::integer)`),sql`,`)}) v(id,position) WHERE cards.deck_id=${deckId} AND cards.id=v.id`);
   });res.json({saved:true});
  }catch(e){if(e instanceof z.ZodError)res.status(400).json({message:"Invalid order"});else next(e);}
 });
 app.patch("/api/decks/:deckId/cards/:cardId",async(req,res,next)=>{
  try{
   const cardId=number.parse(req.params.cardId),deckId=res.locals.deckId,input=api.cards.create.input.parse([req.body])[0];
   const saved=await db.transaction(async tx=>{
    await tx.select({id:decks.id}).from(decks).where(eq(decks.id,deckId)).for("update");
    const current=await tx.select().from(cards).where(eq(cards.deckId,deckId));
    if(!current.some(c=>c.id===cardId))return null;
    const other=current.filter(c=>c.id!==cardId).map(c=>({...c,type:c.type as typeof input.type,options:Array.isArray(c.options)?c.options as string[]:[]}));
    if(!deduplicateCards([input],other).length)throw new CardConflict("This question is already saved");
    const [updated]=await tx.update(cards).set(input).where(and(eq(cards.id,cardId),eq(cards.deckId,deckId))).returning();return updated;
   });
   if(!saved){res.status(404).json({message:"Card not found"});return;}res.json(saved);
  }catch(e){if(e instanceof z.ZodError)res.status(400).json({message:"Invalid card"});else next(e);}
 });
 app.delete("/api/decks/:deckId/cards/:cardId",async(req,res,next)=>{
  try{const deleted=await db.delete(cards).where(and(eq(cards.id,number.parse(req.params.cardId)),eq(cards.deckId,res.locals.deckId))).returning({id:cards.id});if(!deleted.length){res.status(404).json({message:"Card not found"});return;}res.status(204).end();}catch(e){next(e);}
 });
}
