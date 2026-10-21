import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useDeck } from "@/hooks/use-decks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type Named = { id: string; label: string };
type Region = { id: string; x: number; y: number; radius: number };
type AnswerView = {
  kind: string; options?: Named[]; prompts?: {id:string;prompt:string}[];
  matches?: Named[]; targets?: Region[]; labels?: Named[];
  items?: Named[]; imageUrl?: string; imageAlt?: string;
};
type PracticeItem = { id: number; position: number; question: {prompt: string;answer: AnswerView} };
type Graded = { correct: boolean; answer?: unknown; explanation: string };
function answerDescription(answer: unknown): string {
  if (!answer || typeof answer !== "object" || !("kind" in answer)) return "";
  const a = answer as { kind:string; correctOptionIds?:string[]; correctTargetIds?:string[]; pairs?: {prompt:string;match:string}[];
    targets?: {label:string}[]; correct?:boolean; acceptedAnswers?:string[]; back?:string;correctOrderIds?:string[] };
  switch (a.kind) {
    case "multiple_choice": case "multiple_select": return `Correct option ID(s): ${(a.correctOptionIds??[]).join(", ")}`;
    case "matching": return (a.pairs??[]).map(p=>`${p.prompt} → ${p.match}`).join("; ");
    case "image_hotspot": case "diagram_identification": return `Correct region ID(s): ${(a.correctTargetIds??[]).join(", ")}`;
    case "drag_drop_labels": return (a.targets??[]).map(t=>t.label).join(", ");
    case "true_false": return String(a.correct);
    case "ordering": return `Order: ${(a.correctOrderIds??[]).join(" → ")}`;
    case "flashcard": return a.back ?? "";
    default: return (a.acceptedAnswers??[]).join("; ");
  }
}
export default function VisualPractice() {
  const { id } = useParams();
  const deckId = Number(id);
  const { data: deck } = useDeck(deckId);
  const timed = useMemo(()=>new URLSearchParams(window.location.search).get("mode")==="timed",[]);
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [matchIds, setMatchIds] = useState<Record<string,string>>({});
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [truth, setTruth] = useState<boolean | null>(null);
  const [result, setResult] = useState<Graded | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const current = items[index];
  const answer = current?.question.answer;
  useEffect(() => {
    if (!Number.isSafeInteger(deckId) || deckId<=0) return;
    let active = true;
    setLoading(true);
    fetch(`/api/decks/${deckId}/questions/practice`)
      .then(async response => {if (!response.ok) throw new Error("Failed to load exam");return response.json();})
      .then(data => {if(active)setItems(data);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:"Failed to load exam");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[deckId]);
  useEffect(() => {
    if (!timed || !current || result) return;
    const timer = window.setInterval(()=>setSeconds(n=>Math.max(0,n-1)),1000);
    return ()=>window.clearInterval(timer);
  },[timed,current,result]);
  useEffect(() => {
    if (timed && current && seconds===0 && !result && !busy) {
      setResult({correct:false,explanation:"The local 30-second timer expired. This is not an authoritative multiplayer deadline."});
    }
  }, [timed,current,seconds,result,busy]);
  function resetResponse() {
    setSelectedIds([]);setTargetId("");setMatchIds({});setOrderIds([]);setTyped("");setTruth(null);
    setResult(null);setSeconds(30);setError("");
  }
  function next() {setIndex(i=>i+1);resetResponse();}
  function restart() {setIndex(0);setCorrect(0);resetResponse();}
  async function submit() {
    if (!current || !answer || result || busy) return;
    let response: unknown;
    switch(answer.kind) {
      case "multiple_choice": case "multiple_select": response={selectedIds};break;
      case "image_hotspot": case "diagram_identification": response={targetId};break;
      case "matching": case "drag_drop_labels": response={matchIds};break;
      case "ordering": response={orderIds:orderIds.length?orderIds:(answer.items??[]).map(i=>i.id)};break;
      case "true_false": if (truth===null){setError("Choose true or false.");return;} response={value:truth};break;
      default: response={text:typed};
    }
    setBusy(true);setError("");
    try {
      const reply = await fetch(`/api/decks/${deckId}/questions/${current.id}/check`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({response}),
      });
      if(!reply.ok) throw new Error((await reply.json().catch(()=>({}))).message??"Answer validation failed");
      const graded:Graded = await reply.json();
      setResult(graded);
      if(graded.correct)setCorrect(n=>n+1);
    } catch(err) {setError(err instanceof Error?err.message:"Could not submit answer");}
    finally {setBusy(false);}
  }
  function swap(position:number, change:number) {
    const ids=[...(orderIds.length?orderIds:(answer?.items??[]).map(i=>i.id))];
    const other=position+change;
    if(other<0||other>=ids.length)return;
    [ids[position],ids[other]]=[ids[other],ids[position]];
    setOrderIds(ids);
  }
  if(loading)return <main className="p-8">Loading questions…</main>;
  if(error&&!items.length)return <main className="p-8" role="alert">{error} <Link href="/">Back</Link></main>;
  return <main className="min-h-screen p-4 md:p-8 bg-muted/30">
    <section className="max-w-3xl mx-auto space-y-5">
      <Link href="/"><Button variant="ghost">Back to library</Button></Link>
      <h1 className="text-3xl font-bold">{deck?.title ?? "Deck"} — {timed?"Timed Test":"Visual Practice"}</h1>
      <p className="text-sm text-muted-foreground">Solo session only. Answers are graded by the server; results are not saved to an account.</p>
      <Progress value={items.length ? Math.min(100,index/items.length*100):0} aria-label="Question progress"/>
      {!items.length?<Card><CardContent className="p-6">This deck has no visual questions yet. <Link href={`/exam-builder/${deckId}`}><Button>Add questions</Button></Link></CardContent></Card>
      :index>=items.length?<Card><CardContent className="p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Session complete</h2>
        <p>{correct} of {items.length} graded correct.</p>
        <Button onClick={restart}>Try again</Button>
      </CardContent></Card>
      :<Card>
        <CardHeader>
          <p>Question {index+1} of {items.length}{timed?` · ${seconds}s remaining (local timer)`:""}</p>
          <CardTitle>{current.question.prompt}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(answer?.kind==="multiple_choice"||answer?.kind==="multiple_select")&&<fieldset className="space-y-3">
            <legend>{answer.kind==="multiple_choice"?"Choose one answer":"Choose all correct answers"}</legend>
            {answer.options?.map(o=><label className="flex gap-3 border rounded p-3" key={o.id}>
              <input type={answer.kind==="multiple_choice"?"radio":"checkbox"} name="exam-option"
                disabled={!!result} checked={selectedIds.includes(o.id)}
                onChange={e=>setSelectedIds(answer.kind==="multiple_choice"?[o.id]:e.target.checked?[...selectedIds,o.id]:selectedIds.filter(id=>id!==o.id))}/>
              <span>{o.label}</span>
            </label>)}
          </fieldset>}
          {(answer?.kind==="matching"||answer?.kind==="drag_drop_labels")&&<div className="space-y-3">
            <p>Choose the matching label for each prompt or region.</p>
            {(answer.prompts??answer.targets?.map((t,i)=>({id:t.id,prompt:`Region ${i+1}`}))??[]).map(p=><label className="flex flex-col gap-1" key={p.id}>
              <span>{p.prompt}</span>
              <select className="border rounded p-3 bg-background" disabled={!!result}
                value={matchIds[p.id]??""} onChange={e=>setMatchIds(old=>({...old,[p.id]:e.target.value}))}>
                <option value="">Choose a label</option>
                {(answer.matches??answer.labels??[]).map(m=><option value={m.id} key={m.id}>{m.label}</option>)}
              </select>
            </label>)}
          </div>}
          {(answer?.kind==="image_hotspot"||answer?.kind==="diagram_identification"||answer?.kind==="drag_drop_labels")&&
            <div className="space-y-3">
              {answer.imageUrl?<div className="relative">
                <img src={answer.imageUrl} alt={answer.imageAlt??"Question diagram"} className="block w-full h-auto border rounded"/>
                {answer.targets?.map((t,i)=><button key={t.id} type="button" disabled={!!result||answer.kind==="drag_drop_labels"}
                  aria-label={`Select region ${i+1}`} aria-pressed={targetId===t.id}
                  onClick={()=>setTargetId(t.id)}
                  className={`absolute rounded-full border-2 border-white focus-visible:outline outline-4 outline-primary ${targetId===t.id?"bg-blue-700":"bg-red-600"}`}
                  style={{left:`${t.x*100}%`,top:`${t.y*100}%`,width:Math.max(20,t.radius*100)+"%",height:Math.max(20,t.radius*100)+"%",transform:"translate(-50%,-50%)"}}/>)}
              </div>:<p role="note">The source image is unavailable; ask the author to add an HTTPS image URL.</p>}
              {answer.kind!=="drag_drop_labels"&&<fieldset className="flex flex-wrap gap-2">
                <legend className="mb-2">Keyboard-accessible region choices</legend>
                {answer.targets?.map((t,i)=><Button key={t.id} variant={targetId===t.id?"default":"outline"} disabled={!!result}
                  onClick={()=>setTargetId(t.id)}>Region {i+1}</Button>)}
              </fieldset>}
            </div>}
          {answer?.kind==="ordering"&&<div className="space-y-2">
            {(orderIds.length?orderIds:(answer.items??[]).map(i=>i.id)).map((itemId,i)=>{
              const option=answer.items?.find(o=>o.id===itemId);
              return <div key={itemId} className="p-2 border flex items-center gap-2">
                <span className="flex-1">{i+1}. {option?.label}</span>
                <Button size="sm" variant="outline" disabled={!!result||i===0} onClick={()=>swap(i,-1)} aria-label={`Move ${option?.label} up`}>↑</Button>
                <Button size="sm" variant="outline" disabled={!!result||i===(answer.items?.length??0)-1} onClick={()=>swap(i,1)} aria-label={`Move ${option?.label} down`}>↓</Button>
              </div>;
            })}
          </div>}
          {answer?.kind==="true_false"&&<fieldset className="flex gap-4">
            <legend>True or false?</legend>
            {[true,false].map(value=><label key={String(value)} className="flex gap-2">
              <input type="radio" name="truth" checked={truth===value} disabled={!!result} onChange={()=>setTruth(value)}/>{String(value)}
            </label>)}
          </fieldset>}
          {["short_answer","text","flashcard"].includes(answer?.kind??"")&&
            <label className="block space-y-2"><span>Your answer</span>
              <Input value={typed} disabled={!!result} maxLength={500} onChange={e=>setTyped(e.target.value)}/>
            </label>}
          {error&&<p role="alert" className="text-destructive">{error}</p>}
          {!result?<Button disabled={busy||timed&&seconds===0} onClick={()=>void submit()}>{busy?"Checking…":"Check answer"}</Button>:
            <div role="status" className="border p-4 rounded space-y-2">
              <p className="font-semibold">{result.correct?"Correct!":"Not quite."}</p>
              {result.answer&&<p><strong>Answer:</strong> {answerDescription(result.answer)}</p>}
              {result.explanation&&<p>{result.explanation}</p>}
              <Button onClick={next}>{index+1===items.length?"Show results":"Next question"}</Button>
            </div>}
        </CardContent>
      </Card>}
    </section>
  </main>;
}
