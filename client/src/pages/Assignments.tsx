import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RoomInvitation } from "@/components/RoomInvitation";

type Deck={id:number;title:string};
type Summary={id:string;title:string;opensAt:string|null;closesAt:string|null;maxAttempts:number;questionCount:number;attempts:number;completed:number};
type Attempt={id:string;name:string;score:number;correctCount:number;answers:unknown;submittedAt:string|null;createdAt:string};
type Detail=Omit<Summary,"attempts">&{attempts:Attempt[]};

async function api<T>(path:string,method="GET",body?:unknown):Promise<T>{
  const result=await fetch(path,{method,credentials:"same-origin",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  if(!result.ok){const error=await result.json().catch(()=>({}));throw new Error(error.message||`HTTP ${result.status}`);}
  return result.status===204?undefined as T:result.json();
}
export default function Assignments(){
  const {id}=useParams();
  const [decks,setDecks]=useState<Deck[]>([]);
  const [items,setItems]=useState<Summary[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [title,setTitle]=useState("");
  const [deckId,setDeckId]=useState("");
  const [closesAt,setClosesAt]=useState("");
  const [maxAttempts,setMaxAttempts]=useState(1);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState("");
  const load=async()=>{
    if(id)setDetail(await api<Detail>("/api/assignments/"+encodeURIComponent(id)));
    else {
      const [loaded,all]=await Promise.all([api<Deck[]>("/api/decks"),api<Summary[]>("/api/assignments")]);
      setDecks(loaded);setItems(all);setDeckId(old=>old||String(loaded[0]?.id??""));
    }
  };
  useEffect(()=>{let mounted=true;setError("");(async()=>{
    try{await load();}catch(e){if(mounted)setError(e instanceof Error?e.message:"Could not load assignments");}
  })();return()=>{mounted=false;};},[id]);
  const create=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError("");
    try{
      const newItem=await api<{id:string}>("/api/assignments","POST",{
        deckId:Number(deckId),title:title.trim(),maxAttempts,
        closesAt:closesAt?new Date(closesAt).toISOString():null,
      });
      setTitle("");setClosesAt("");
      await load();
      await copyLink(newItem.id);
    }catch(e){setError(e instanceof Error?e.message:"Could not create assignment");}
    finally{setBusy(false);}
  };
  const copyLink=async(assignId:string)=>{
    const link=window.location.origin+"/assignment/"+encodeURIComponent(assignId);
    try{await navigator.clipboard.writeText(link);setCopied("Invitation copied");}
    catch{setCopied(link);}
  };
  return <main className="min-h-screen bg-muted/30 p-4 md:p-8">
    <section className="max-w-5xl mx-auto space-y-6">
      <Button asChild variant="outline"><Link href={id?"/assignments":"/"}>{id?"Back to assignments":"Back to home"}</Link></Button>
      <h1 className="text-3xl font-bold">Self-paced assignments</h1>
      <p className="text-sm text-muted-foreground">Publish a private quiz snapshot and share its invitation. Guests can complete it without a live host. Guest nicknames are not verified identities.</p>
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {copied&&<p role="status" className="break-all text-sm">{copied}</p>}
      {!id&&<>
        <Card>
          <CardHeader><CardTitle>Create an assignment</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={e=>void create(e)} className="space-y-4">
              <div><Label htmlFor="assignment-deck">Quiz deck</Label>
                <select id="assignment-deck" className="border rounded p-3 bg-background w-full" required value={deckId} onChange={e=>setDeckId(e.target.value)}>
                  <option value="">Choose a deck</option>{decks.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}
                </select></div>
              <div><Label htmlFor="assignment-title">Assignment title</Label><Input id="assignment-title" maxLength={200} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Friday trivia challenge"/></div>
              <div><Label htmlFor="assignment-deadline">Deadline (optional; your local time)</Label><Input id="assignment-deadline" type="datetime-local" value={closesAt} onChange={e=>setClosesAt(e.target.value)}/></div>
              <div><Label htmlFor="assignment-attempts">Attempts per nickname (not identity-verified)</Label>
                <select id="assignment-attempts" value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value))} className="border rounded p-3 bg-background w-full">
                  {[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
                </select></div>
              <Button type="submit" disabled={busy||!deckId||!title.trim()}>{busy?"Publishing…":"Create assignment"}</Button>
            </form>
          </CardContent>
        </Card>
        <h2 className="text-2xl font-bold">Published assignments</h2>
        {items.length===0&&<p>No assignments published yet.</p>}
        {items.map(a=><Card key={a.id}><CardContent className="p-5 flex flex-wrap justify-between gap-3 items-center">
          <div><h3 className="font-bold text-xl">{a.title}</h3><p className="text-sm text-muted-foreground">{a.questionCount} questions · {a.completed} completed / {a.attempts} attempts</p>
            {a.closesAt&&<p className="text-xs">Closes: {new Date(a.closesAt).toLocaleString()}</p>}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={()=>void copyLink(a.id)}>Copy invitation</Button>
            <Button asChild variant="outline"><Link href={`/assignments/${a.id}#invitation`}>QR &amp; share</Link></Button>
            <Button asChild><Link href={`/assignments/${a.id}`}>Review results</Link></Button>
          </div>
        </CardContent></Card>)}
      </>}
      {id&&detail&&<Card>
        <CardHeader><CardTitle>{detail.title}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div id="invitation"><RoomInvitation assignment url={window.location.origin+"/assignment/"+encodeURIComponent(detail.id)}/></div>
          <p>{detail.attempts.length} started attempts</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">Guest nickname</th><th className="p-2">Status</th><th className="p-2">Score</th><th className="p-2">Submitted</th></tr></thead>
            <tbody>{detail.attempts.map(a=><tr key={a.id} className="border-b">
              <td className="p-2">{a.name}</td><td className="p-2">{a.submittedAt?"Complete":"In progress"}</td>
              <td className="p-2">{a.submittedAt?`${a.correctCount} correct · ${a.score} points`:"—"}</td>
              <td className="p-2">{a.submittedAt?new Date(a.submittedAt).toLocaleString():"—"}</td>
            </tr>)}</tbody></table></div>
        </CardContent>
      </Card>}
    </section>
  </main>;
}
