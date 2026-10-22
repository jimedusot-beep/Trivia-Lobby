import type { Card } from "@shared/schema";
import { listUniversalQuestions } from "./universal-question-store";

/** Live rooms accept single-choice questions with two to four choices from either schema. */
export async function universalGameCards(deckId:number):Promise<Card[]>{
 const rows=await listUniversalQuestions(deckId);
 return rows.flatMap(({id,question:q})=>{
  const a=q.answer;if(a.kind!=="multiple_choice"||a.options.length>4)return [];
  return [{id:-id,position:0,deckId,type:"multiple_choice",front:q.prompt,back:q.explanation??"",options:a.options.map(o=>o.label),correctOption:String.fromCharCode(65+a.options.findIndex(o=>o.id===a.correctOptionIds[0])),createdAt:null}];
 });
}
