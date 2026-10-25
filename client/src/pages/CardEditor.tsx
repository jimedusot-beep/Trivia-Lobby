import { useState } from "react";
import { Link,useParams } from "wouter";
import { useDeck } from "@/hooks/use-decks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Card } from "@shared/schema";
export default function CardEditor(){
 const {id}=useParams(),deckId=Number(id),{data:deck,refetch}=useDeck(deckId);
 const [selected,setSelected]=useState<Card|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const request=async(path:string,method:string,body?:unknown)=>{
  const r=await fetch(`/api/decks/${deckId}/cards`+path,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message??"Could not save cards");
 };
 const perform=async(action:()=>Promise<void>)=>{setBusy(true);setNotice("");try{await action();await refetch();setNotice("Saved");}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}};
 const move=(index:number,change:number)=>void perform(async()=>{const ids=deck!.cards.map(c=>c.id),other=index+change;if(other<0||other>=ids.length)return;[ids[index],ids[other]]=[ids[other],ids[index]];await request("/reorder","PATCH",{ids});});
 return <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5"><Button asChild variant="outline"><Link href="/decks">Back to decks</Link></Button>
  <h1 className="text-3xl font-bold">Edit saved cards — {deck?.title}</h1><p>Correct imported cards and change their order. Existing review histories stay linked to edited cards.</p>
  {notice&&<p role="status">{notice}</p>}
  <ol className="space-y-3">{deck?.cards.map((card,index)=><li className="border rounded p-3 flex flex-wrap gap-2 items-center" key={card.id}>
   <button className="text-left flex-1 min-w-0 break-words p-2" onClick={()=>setSelected({...card})}>{index+1}. {card.front}</button>
   <Button variant="outline" disabled={busy||index===0} aria-label={`Move card ${index+1} up`} onClick={()=>move(index,-1)}>Up</Button>
   <Button variant="outline" disabled={busy||index===deck.cards.length-1} aria-label={`Move card ${index+1} down`} onClick={()=>move(index,1)}>Down</Button>
  </li>)}</ol>
  {selected&&<form className="border rounded p-4 space-y-3" onSubmit={e=>{e.preventDefault();void perform(async()=>{await request(`/${selected.id}`,"PATCH",{front:selected.front,back:selected.back,type:selected.type,options:selected.options,correctOption:selected.correctOption});setSelected(null);});}}>
   <h2 className="text-xl font-bold">Edit card</h2>
   <label className="block" htmlFor="card-front">Question</label><Textarea id="card-front" value={selected.front} maxLength={10000} required onChange={e=>setSelected({...selected,front:e.target.value})}/>
   <label className="block" htmlFor="card-back">Answer or explanation</label><Textarea id="card-back" value={selected.back} maxLength={10000} required onChange={e=>setSelected({...selected,back:e.target.value})}/>
   {selected.type==="multiple_choice"&&<fieldset className="space-y-3"><legend>Answer choices</legend>{(selected.options as string[]).map((option,i)=><label key={i} className="flex gap-3 items-center">
    <input aria-label={`Choice ${i+1} is correct`} type="radio" name="correct" checked={selected.correctOption===String.fromCharCode(65+i)} onChange={()=>setSelected({...selected,correctOption:String.fromCharCode(65+i)})}/>
    <Input aria-label={`Choice ${i+1} text`} value={option} maxLength={1000} required onChange={e=>setSelected({...selected,options:(selected.options as string[]).map((v,j)=>i===j?e.target.value:v)})}/>
   </label>)}</fieldset>}
   <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>Save changes</Button><Button variant="outline" type="button" onClick={()=>setSelected(null)}>Cancel</Button>
    <Button variant="destructive" type="button" disabled={busy} onClick={()=>{if(window.confirm("Delete this card and its review history?"))void perform(async()=>{await request(`/${selected.id}`,"DELETE");setSelected(null);});}}>Delete card</Button>
   </div>
  </form>}
 </main>;
}
