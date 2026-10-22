import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Link, useParams } from "wouter";
import { useAuthorDraft } from "@/hooks/use-author-draft";
import { useDeck } from "@/hooks/use-decks";
import { normalizedHotspotPoint } from "@/lib/hotspots";
import { universalQuestionSchema, type UniversalQuestion } from "@shared/universal-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Kind = "multiple_choice" | "matching" | "image_hotspot" | "short_answer" | "flashcard" | "true_false";
type Option = { id: string; label: string };
type Pair = { id: string; prompt: string; match: string };
type Target = { id: string; label: string; x: number; y: number; radius: number };
type Saved = { id: number; position: number; question: UniversalQuestion };
const newOptions = (): Option[] => [{id:"A",label:""},{id:"B",label:""}];
const newPairs = (): Pair[] => [{id:"pair-1",prompt:"",match:""},{id:"pair-2",prompt:"",match:""}];
function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Question save failed";
}
async function request(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, {
    method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message || `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined : response.json();
}
export default function ExamBuilder() {
  const { id } = useParams();
  const deckId = Number(id);
  const { data: deck } = useDeck(deckId);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("multiple_choice");
  const [answerText,setAnswerText]=useState("");
  const [caseSensitive,setCaseSensitive]=useState(false);
  const [correctTruth,setCorrectTruth]=useState(true);
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<Option[]>(newOptions);
  const [pairs, setPairs] = useState<Pair[]>(newPairs);
  const [correctId, setCorrectId] = useState("A");
  const [files,setFiles]=useState<{id:string;originalName:string;mimeType:string}[]>([]);
  const [imageAssetId,setImageAssetId]=useState("");
  const [sourceFileId,setSourceFileId]=useState("");
  const [sourceAttribution,setSourceAttribution]=useState("");
  const [sourcePage,setSourcePage]=useState("");
  const [sourcePassage,setSourcePassage]=useState("");
  useEffect(()=>{request("/api/library/files").then(setFiles).catch(()=>{});},[]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const draftStatus = useAuthorDraft(deckId, { selectedId,kind,prompt,explanation,options,pairs,correctId,imageUrl,imageAlt,targets,imageAssetId,sourceFileId,sourceAttribution,sourcePage,sourcePassage,answerText,caseSensitive,correctTruth }, value => {
    if(typeof value.prompt!=="string" || !["multiple_choice","matching","image_hotspot","short_answer","flashcard","true_false"].includes(String(value.kind)))return;
    setAnswerText(String(value.answerText??""));setCaseSensitive(value.caseSensitive===true);setCorrectTruth(value.correctTruth!==false);
    setSelectedId(typeof value.selectedId==="number"?value.selectedId:null);setKind(value.kind as Kind);setPrompt(value.prompt);
    setExplanation(String(value.explanation??""));setOptions(Array.isArray(value.options)?value.options as Option[]:newOptions());
    setPairs(Array.isArray(value.pairs)?value.pairs as Pair[]:newPairs());setCorrectId(String(value.correctId??"A"));
    setImageAssetId(String(value.imageAssetId??""));setSourceFileId(String(value.sourceFileId??""));setSourceAttribution(String(value.sourceAttribution??""));setSourcePage(String(value.sourcePage??""));setSourcePassage(String(value.sourcePassage??""));
    setImageUrl(String(value.imageUrl??""));setImageAlt(String(value.imageAlt??""));setTargets(Array.isArray(value.targets)?value.targets as Target[]:[]);
  });
  const endpoint = `/api/decks/${deckId}/questions`;
  const reload = useCallback(async () => {
    if (!Number.isSafeInteger(deckId) || deckId < 1) return;
    try { setSaved(await request(endpoint)); }
    catch (err) { setNotice(messageFrom(err)); }
  }, [deckId, endpoint]);
  useEffect(() => { void reload(); }, [reload]);
  function reset() {
    setAnswerText("");setCaseSensitive(false);setCorrectTruth(true);
    setSelectedId(null); setKind("multiple_choice"); setPrompt(""); setExplanation("");
    setOptions(newOptions()); setPairs(newPairs()); setCorrectId("A");
    setImageAssetId("");setSourceFileId("");setSourceAttribution("");setSourcePage("");setSourcePassage("");
    setImageUrl(""); setImageAlt(""); setTargets([]); setNotice("");
  }
  function edit(item: Saved) {
    const q = item.question;
    if (!["multiple_choice","matching","image_hotspot","text","short_answer","flashcard","true_false"].includes(q.answer.kind)) {
      setNotice(`This question format (${q.answer.kind}) is supported by the model but not by this visual editor yet.`);
      return;
    }
    setSelectedId(item.id); setKind(q.answer.kind==="text"?"short_answer":q.answer.kind as Kind); setPrompt(q.prompt);
    setSourceFileId(q.source?.documentId??"");setSourceAttribution(q.source?.attribution??"");setSourcePage(q.source?.page?String(q.source.page):"");setSourcePassage(q.source?.passage??"");
    setExplanation(q.explanation ?? "");
    if(q.answer.kind==="short_answer"||q.answer.kind==="text"){setAnswerText(q.answer.acceptedAnswers.join("\n"));setCaseSensitive(q.answer.caseSensitive);}
    if(q.answer.kind==="flashcard")setAnswerText(q.answer.back);
    if(q.answer.kind==="true_false")setCorrectTruth(q.answer.correct);
    setNotice("");
    if (q.answer.kind === "multiple_choice") {
      setOptions(q.answer.options); setCorrectId(q.answer.correctOptionIds[0]);
    }
    if (q.answer.kind === "matching") setPairs(q.answer.pairs);
    if (q.answer.kind === "image_hotspot") {
      setImageAssetId(q.answer.imageAssetId??"");
      setImageUrl(q.answer.imageUrl ?? ""); setImageAlt(q.answer.imageAlt ?? "");
      setTargets(q.answer.targets); setCorrectId(q.answer.correctTargetIds[0]);
    }
  }
  function addHotspot(event: MouseEvent<HTMLButtonElement>) {
    if (targets.length >= 40) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const {x,y} = event.detail === 0 ? {x:0.5,y:0.5} : normalizedHotspotPoint(event.clientX,event.clientY,rect);
    const id = crypto.randomUUID();
    setTargets(existing => [...existing, { id, label: "New region", x, y, radius: 0.07 }]);
    setCorrectId(id);
  }
  async function save() {
    setBusy(true); setNotice("");
    try {
      let answer: unknown;
      if (kind === "multiple_choice") {
        answer = {kind, options, correctOptionIds:[correctId]};
      } else if (kind === "matching") {
        answer = {kind, pairs};
      } else if(kind==="short_answer"){answer={kind,acceptedAnswers:answerText.split("\n").map(s=>s.trim()).filter(Boolean),caseSensitive};
      } else if(kind==="flashcard"){answer={kind,back:answerText};
      } else if(kind==="true_false"){answer={kind,correct:correctTruth};
      } else {
        answer = {kind, ...(imageAssetId?{imageAssetId}:{imageUrl}), imageAlt, targets, correctTargetIds:[correctId]};
      }
      const question = universalQuestionSchema.omit({ id: true }).parse({
        schemaVersion:1, prompt, explanation, tags:[], answer,
        ...(sourceFileId||sourceAttribution||sourcePassage?{source:{documentId:sourceFileId||undefined,attribution:sourceAttribution||files.find(f=>f.id===sourceFileId)?.originalName,page:sourcePage?Number(sourcePage):undefined,passage:sourcePassage||undefined}}:{}),
      });
      await request(selectedId === null ? endpoint : `${endpoint}/${selectedId}`,
        selectedId === null ? "POST" : "PATCH", question);
      setNotice("Question saved to the database.");
      setSelectedId(null);
      setPrompt(""); setExplanation(""); setAnswerText(""); setCaseSensitive(false); setCorrectTruth(true);
      setOptions(newOptions()); setPairs(newPairs()); setTargets([]); setCorrectId("A");
      await reload();
    } catch (err) { setNotice(messageFrom(err)); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!window.confirm("Delete this saved question?")) return;
    setBusy(true);
    try {
      await request(`${endpoint}/${id}`, "DELETE");
      reset(); await reload(); setNotice("Question deleted.");
    } catch (err) { setNotice(messageFrom(err)); }
    finally { setBusy(false); }
  }
  async function move(index: number, delta: number) {
    const ids = saved.map(q=>q.id);
    const dest = index + delta;
    if (dest < 0 || dest >= ids.length) return;
    [ids[index], ids[dest]] = [ids[dest], ids[index]];
    setBusy(true);
    try { setSaved(await request(`${endpoint}/reorder`, "PATCH", {ids})); }
    catch(err) {setNotice(messageFrom(err));} finally {setBusy(false);}
  }

  return <main className="min-h-screen bg-muted/30 p-4 md:p-8">
    <section className="max-w-5xl mx-auto space-y-6">
      <p role="status" className="text-sm text-muted-foreground">{draftStatus}</p>
      <Button asChild variant="ghost"><Link href="/">Back to decks</Link></Button>
      <h1 className="text-3xl font-bold">{deck?.title ?? "Deck"} — Exam Builder</h1>
      <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded" role="note">
        Questions are private to your account. Add explanations and source passages for review, and choose saved diagrams from your private source library.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={reset}>New question</Button>
        <Button asChild><Link href={`/visual-practice/${deckId}`}>Practice visual questions</Link></Button>
        <Button asChild variant="outline"><Link href={`/visual-practice/${deckId}?mode=timed`}>Timed test</Link></Button>
      </div>
      {notice && <p role="status" className="rounded border p-3">{notice}</p>}
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
        <Card>
          <CardHeader><CardTitle>Saved questions ({saved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {saved.length === 0 && <p>No visual questions saved yet.</p>}
            {saved.map((item, index) => <div className="border p-3 rounded space-y-2" key={item.id}>
              <p className="text-sm font-semibold break-words">{index+1}. {item.question.prompt}</p>
              <p className="text-xs text-muted-foreground">{item.question.answer.kind}</p>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={()=>edit(item)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={()=>void move(index,-1)} disabled={index===0||busy} aria-label={`Move question ${index+1} up`}>↑</Button>
                <Button size="sm" variant="outline" onClick={()=>void move(index,1)} disabled={index===saved.length-1||busy} aria-label={`Move question ${index+1} down`}>↓</Button>
                <Button size="sm" variant="destructive" onClick={()=>void remove(item.id)} disabled={busy}>Delete</Button>
              </div>
            </div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{selectedId === null ? "Create" : "Edit"} a question</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="format">Question type</Label>
              <select id="format" className="w-full border rounded p-3 bg-background" value={kind}
                onChange={e=>setKind(e.target.value as Kind)}>
                <option value="multiple_choice">Multiple choice</option>
                <option value="short_answer">Short answer</option><option value="flashcard">Flashcard</option><option value="true_false">True / false</option>
                <option value="matching">Matching</option>
                <option value="image_hotspot">Image hotspot</option>
              </select>
            </div>
            <div><Label htmlFor="prompt">Question prompt</Label>
              <Textarea id="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={2000}/></div>
            {kind==="multiple_choice" && <fieldset className="space-y-3">
              <legend className="font-semibold">Answer choices (select the correct answer)</legend>
              {options.map((o,i)=><div className="flex items-center gap-2" key={o.id}>
                <input type="radio" name="correct-choice" checked={correctId===o.id}
                  aria-label={`Choice ${i+1} is correct`} onChange={()=>setCorrectId(o.id)}/>
                <Input aria-label={`Choice ${i+1} text`} value={o.label}
                  onChange={e=>setOptions(old=>old.map((v,j)=>j===i?{...v,label:e.target.value}:v))}/>
                <Button size="sm" variant="outline" disabled={options.length<=2}
                  onClick={()=>{setOptions(old=>old.filter(v=>v.id!==o.id));if(correctId===o.id)setCorrectId(options.find(v=>v.id!==o.id)?.id??"");}}>Remove</Button>
              </div>)}
              <Button variant="outline" disabled={options.length>=12} onClick={()=>setOptions(old=>[...old,{id:crypto.randomUUID(),label:""}])}>Add choice</Button>
            </fieldset>}
            {(kind==="short_answer"||kind==="flashcard")&&<div className="space-y-2"><Label htmlFor="text-answer">{kind==="short_answer"?"Accepted answers (one per line)":"Card answer"}</Label><Textarea id="text-answer" value={answerText} onChange={e=>setAnswerText(e.target.value)} maxLength={10000}/>{kind==="short_answer"&&<label className="flex gap-2"><input type="checkbox" checked={caseSensitive} onChange={e=>setCaseSensitive(e.target.checked)}/>Match case</label>}</div>}
            {kind==="true_false"&&<fieldset><legend>Correct answer</legend>{[true,false].map(value=><label className="inline-flex p-3 gap-2" key={String(value)}><input type="radio" name="correct-truth" checked={correctTruth===value} onChange={()=>setCorrectTruth(value)}/>{String(value)}</label>)}</fieldset>}
            {kind==="matching" && <fieldset className="space-y-3">
              <legend className="font-semibold">Matching pairs</legend>
              {pairs.map((p,i)=><div className="border rounded p-2 space-y-2" key={p.id}>
                <Input aria-label={`Pair ${i+1} prompt`} placeholder="Term"
                  value={p.prompt} onChange={e=>setPairs(old=>old.map((v,j)=>j===i?{...v,prompt:e.target.value}:v))}/>
                <Input aria-label={`Pair ${i+1} match`} placeholder="Match"
                  value={p.match} onChange={e=>setPairs(old=>old.map((v,j)=>j===i?{...v,match:e.target.value}:v))}/>
                <Button size="sm" variant="outline" disabled={pairs.length<=2}
                  onClick={()=>setPairs(old=>old.filter(v=>v.id!==p.id))}>Remove pair</Button>
              </div>)}
              <Button variant="outline" disabled={pairs.length>=20}
                onClick={()=>setPairs(old=>[...old,{id:crypto.randomUUID(),prompt:"",match:""}])}>Add pair</Button>
            </fieldset>}
            {kind==="image_hotspot" && <div className="space-y-4">
              <div><Label htmlFor="image-url">Public HTTPS image URL</Label>
                <Input id="image-url" type="url" placeholder="https://..." value={imageUrl} onChange={e=>setImageUrl(e.target.value)}/></div>
              <div><Label htmlFor="image-alt">Diagram description (for accessibility)</Label>
                <Input id="image-alt" value={imageAlt} onChange={e=>setImageAlt(e.target.value)}/></div>
              {(imageAssetId||imageUrl.startsWith("https://")) && <div className="relative w-full border rounded overflow-hidden">
                <img src={imageAssetId?`/api/library/files/${imageAssetId}/media`:imageUrl} alt={imageAlt || "Editable diagram"} className="w-full h-auto block"/>
                <button type="button" aria-label="Add a target at the clicked diagram position, or at center using keyboard"
                  className="absolute inset-0 cursor-crosshair" onClick={addHotspot}/>
                {targets.map(t=><span key={t.id} aria-hidden="true" className="absolute rounded-full bg-red-600 border-2 border-white pointer-events-none"
                  style={{left:`${t.x*100}%`,top:`${t.y*100}%`,width:14,height:14,transform:"translate(-50%,-50%)"}} />)}
              </div>}
              <div><Label htmlFor="saved-image">Or choose a private saved diagram</Label><select id="saved-image" className="w-full border rounded p-3" value={imageAssetId} onChange={e=>setImageAssetId(e.target.value)}><option value="">Use HTTPS image URL</option>{files.filter(f=>f.mimeType.startsWith("image/")).map(f=><option key={f.id} value={f.id}>{f.originalName}</option>)}</select></div>
              <Button variant="outline" disabled={targets.length>=40}
                onClick={()=>{const id=crypto.randomUUID();setTargets(old=>[...old,{id,label:"New region",x:0.5,y:0.5,radius:0.07}]);setCorrectId(id);}}>Add target at center</Button>
              <fieldset className="space-y-3">
                <legend className="font-semibold">Target regions (normalized 0–1 coordinates)</legend>
                {targets.map((t,i)=><div className="border rounded p-3 space-y-2" key={t.id}>
                  <div className="flex gap-2 items-center">
                    <input type="radio" name="correct-target" checked={correctId===t.id}
                      aria-label={`Target ${i+1} is correct`} onChange={()=>setCorrectId(t.id)}/>
                    <Input aria-label={`Target ${i+1} label`} value={t.label}
                      onChange={e=>setTargets(old=>old.map(v=>v.id===t.id?{...v,label:e.target.value}:v))}/>
                    <Button size="sm" variant="outline" onClick={()=>{setTargets(old=>old.filter(v=>v.id!==t.id));if(correctId===t.id)setCorrectId(targets.find(v=>v.id!==t.id)?.id??"");}}>Remove</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["x","y","radius"] as const).map(field=><div key={field}>
                      <Label htmlFor={`${field}-${t.id}`}>{field}</Label>
                      <Input id={`${field}-${t.id}`} type="number" min={field==="radius" ? 0.001 : 0}
                        max={field==="radius" ? 0.35 : 1} step="0.01" value={t[field]}
                        onChange={e=>setTargets(old=>old.map(v=>v.id===t.id?{...v,[field]:Number(e.target.value)}:v))}/>
                    </div>)}
                  </div>
                </div>)}
              </fieldset>
            </div>}
            <fieldset className="space-y-3 border rounded p-3"><legend>Source citation (optional)</legend>
              <Label htmlFor="source-file">Saved source document</Label><select id="source-file" className="w-full border rounded p-3" value={sourceFileId} onChange={e=>setSourceFileId(e.target.value)}><option value="">No linked file</option>{files.map(f=><option key={f.id} value={f.id}>{f.originalName}</option>)}</select>
              <Label htmlFor="source-attribution">Source title or attribution</Label><Input id="source-attribution" maxLength={500} value={sourceAttribution} onChange={e=>setSourceAttribution(e.target.value)}/>
              <Label htmlFor="source-page">Page</Label><Input id="source-page" type="number" min={1} value={sourcePage} onChange={e=>setSourcePage(e.target.value)}/>
              <Label htmlFor="source-passage">Supporting passage (shown after answering)</Label><Textarea id="source-passage" maxLength={2000} value={sourcePassage} onChange={e=>setSourcePassage(e.target.value)}/>
            </fieldset>
            <div><Label htmlFor="explanation">Explanation (shown after answering)</Label>
              <Textarea id="explanation" value={explanation} onChange={e=>setExplanation(e.target.value)} maxLength={4000}/></div>
            <Button disabled={busy} onClick={()=>void save()}>{busy?"Saving…":selectedId===null?"Save question":"Save changes"}</Button>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>;
}
