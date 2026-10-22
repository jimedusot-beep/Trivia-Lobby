import type { InsertCard } from "@shared/schema";
type IncomingCard=Omit<InsertCard,"deckId">;
export class CardConflict extends Error {status=409;}
const promptKey=(c:IncomingCard)=>JSON.stringify([c.type,c.front.normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase()]);
const contents=(c:IncomingCard)=>JSON.stringify([c.back.trim().normalize("NFKC"),c.options??[],c.correctOption??null]);
/** Collapse exact repeats; conflicting answers require explicit editing, never silent replacement. */
export function deduplicateCards(input:IncomingCard[],existing:IncomingCard[]=[]):IncomingCard[]{
 const seen=new Map(existing.map(c=>[promptKey(c),contents(c)])),result:IncomingCard[]=[];
 for(const card of input){const key=promptKey(card),value=contents(card),old=seen.get(key);
  if(old!==undefined){if(old!==value)throw new CardConflict("A repeated question has different answers. Edit the saved question before importing it again.");continue;}
  seen.set(key,value);result.push(card);
 }
 return result;
}
