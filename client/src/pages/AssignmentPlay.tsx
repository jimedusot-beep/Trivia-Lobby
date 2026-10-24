import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicQuestion={id:string;prompt:string;answer:{
  kind:string;options?:Array<{id:string;label:string}>;items?:Array<{id:string;label:string}>;
}};
type Assignment={id:string;title:string;opensAt:string|null;closesAt:string|null;
  available:boolean;availabilityMessage:string|null;questions:PublicQuestion[]};
type Answer={questionId:string;response:unknown};
type Session={attemptId:string;secret:string;name:string};
type Attempt=Session&{answers:Answer[];submittedAt:string|null;score?:number;correctCount?:number};
type Result={submittedAt:string;score:number;correctCount:number;total:number};
async function request<T>(url:string,method="GET",body?:unknown):Promise<T>{
  const response=await fetch(url,{method,headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||`Request failed (${response.status})`);}
  return response.json();
}
const isOrder=(answer:unknown):answer is {orderIds:string[]}=>!!answer&&typeof answer==="object"&&"orderIds" in answer;
const isMulti=(answer:unknown):answer is {selectedIds:string[]}=>!!answer&&typeof answer==="object"&&"selectedIds" in answer;
const hasBoolean=(answer:unknown):answer is {value:boolean}=>!!answer&&typeof answer==="object"&&"value" in answer;

export default function AssignmentPlay(){
  const {id}=useParams();
  const [assignment,setAssignment]=useState<Assignment|null>(null);
  const [session,setSession]=useState<Session|null>(null);
  const [answers,setAnswers]=useState<Answer[]>([]);
  const [name,setName]=useState("");
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const key="trivia_assignment_"+id;
  const endpoint="/api/assignments/public/"+encodeURIComponent(id??"");
  useEffect(()=>{
    let live=true;
    setAssignment(null);setSession(null);setError("");setResult(null);
    request<Assignment>(endpoint).then(async info=>{
      if(!live)return;
      setAssignment(info);
      try{
        const saved=localStorage.getItem(key);
        if(!saved)return;
        const parsed=JSON.parse(saved) as Session;
        if(!parsed.attemptId||!parsed.secret)return;
        const resumed=await request<Attempt>(endpoint+"/resume","POST",{attemptId:parsed.attemptId,secret:parsed.secret});
        if(!live)return;
        setSession(parsed);setName(resumed.name);setAnswers(resumed.answers);
        if(resumed.submittedAt)setResult({submittedAt:resumed.submittedAt,score:resumed.score??0,correctCount:resumed.correctCount??0,total:info.questions.length});
      }catch{if(live)localStorage.removeItem(key);}
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:"Assignment unavailable");});
    return()=>{live=false;};
  },[id]);

  const begin=async()=>{
    if(!name.trim())return;
    setBusy(true);setError("");
    try{
      const attempt=await request<Attempt>(endpoint+"/start","POST",{name:name.trim()});
      const token={attemptId:attempt.attemptId,secret:attempt.secret,name:attempt.name};
      localStorage.setItem(key,JSON.stringify(token));
      setSession(token);setAnswers([]);setStatus("Attempt started. Your answers can be saved and resumed on this device.");
    }catch(e){setError(e instanceof Error?e.message:"Could not start");}finally{setBusy(false);}
  };
  const update=(questionId:string,response:unknown)=>setAnswers(old=>[...old.filter(a=>a.questionId!==questionId),{questionId,response}]);
  const get=(questionId:string)=>answers.find(a=>a.questionId===questionId)?.response;
  const save=async()=>{
    if(!session)return false;
    const existing=answers;
    await request<{saved:boolean}>(endpoint+"/attempt","PUT",{attemptId:session.attemptId,secret:session.secret,answers:existing});
    setStatus("Progress saved. You can return using this device and browser.");
    return true;
  };
  const persist=async(submit:boolean)=>{
    if(!session)return;
    setBusy(true);setError("");setStatus("");
    try{
      await save();
      if(submit){
        const final=await request<Result>(endpoint+"/submit","POST",{attemptId:session.attemptId,secret:session.secret});
        setResult(final);setStatus("Submission complete. Your answers are locked.");
      }
    }catch(e){setError(e instanceof Error?e.message:"Could not save your assignment");}finally{setBusy(false);}
  };
  const move=(qid:string,ids:string[],index:number,delta:number)=>{
    const next=[...ids];const other=index+delta;if(other<0||other>=next.length)return;
    [next[index],next[other]]=[next[other],next[index]];
    update(qid,{orderIds:next});
  };
  return <main className="min-h-screen bg-slate-50 p-4 md:p-8">
    <section className="max-w-2xl mx-auto space-y-5">
      <Link href="/join" className="text-sm underline text-slate-700">Go to live-game joining</Link>
      <h1 className="text-3xl font-black">Self-paced Trivia</h1>
      {!assignment&&!error&&<p role="status">Loading assignment…</p>}
      {error&&<p role="alert" className="border bg-red-50 p-3 text-red-900 rounded">{error}</p>}
      {status&&<p role="status" className="border bg-white p-3 rounded">{status}</p>}
      {assignment&&<>
        <h2 className="text-2xl font-bold">{assignment.title}</h2>
        {assignment.closesAt&&<p className="text-sm">Closes: {new Date(assignment.closesAt).toLocaleString()}</p>}
        {!assignment.available&&!result&&<p role="alert">{assignment.availabilityMessage}</p>}
        {!session&&assignment.available&&<Card><CardHeader><CardTitle>Start your assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Your nickname isn't a verified identity. Keep using this browser to resume your attempt.</p>
            <div><Label htmlFor="guest-name">Nickname</Label><Input id="guest-name" maxLength={24} required value={name} onChange={e=>setName(e.target.value)}/></div>
            <Button onClick={()=>void begin()} disabled={busy||!name.trim()}>Start assignment</Button>
          </CardContent></Card>}
        {result&&<Card><CardHeader><CardTitle>Assignment complete!</CardTitle></CardHeader>
          <CardContent className="space-y-2"><p>{result.correctCount} of {result.total} correct</p><p className="text-2xl font-bold">{result.score} points</p><p className="text-sm">Submitted: {new Date(result.submittedAt).toLocaleString()}</p></CardContent>
        </Card>}
        {session&&!result&&assignment.available&&<>
          <p className="text-sm font-medium">Playing as {session.name} · {answers.length}/{assignment.questions.length} saved locally in this view</p>
          {assignment.questions.map((question,i)=>{
            const saved=get(question.id);
            const a=question.answer;
            const options=a.options??[];
            const shownOrder=Array.isArray(a.items)?a.items:[];
            const ids=shownOrder.map(item=>item.id);
            const ordered=isOrder(saved)?saved.orderIds:ids;
            return <Card key={question.id}>
              <CardHeader><CardTitle className="text-xl">{i+1}. {question.prompt}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {a.kind==="multiple_choice"&&<fieldset><legend className="sr-only">Choose one answer</legend>
                  {options.map(item=><label key={item.id} className="flex gap-3 border rounded p-3 mb-2">
                    <input type="radio" name={"q-"+question.id} checked={isMulti(saved)&&saved.selectedIds.includes(item.id)}
                      onChange={()=>update(question.id,{selectedIds:[item.id]})}/><span>{item.label}</span>
                  </label>)}</fieldset>}
                {a.kind==="true_false"&&<fieldset><legend className="sr-only">True or false</legend>
                  {[true,false].map(value=><label key={String(value)} className="flex gap-3 border rounded p-3 mb-2">
                    <input type="radio" name={"q-"+question.id} checked={hasBoolean(saved)&&saved.value===value}
                      onChange={()=>update(question.id,{value})}/><span>{value?"True":"False"}</span>
                  </label>)}</fieldset>}
                {a.kind==="multiple_select"&&<fieldset><legend className="text-sm font-medium mb-2">Select all correct answers</legend>
                  {options.map(item=><label key={item.id} className="flex gap-3 border rounded p-3 mb-2">
                    <input type="checkbox" checked={isMulti(saved)&&saved.selectedIds.includes(item.id)}
                      onChange={e=>{
                        const old=isMulti(saved)?saved.selectedIds:[];
                        update(question.id,{selectedIds:e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id)});
                      }}/><span>{item.label}</span>
                  </label>)}</fieldset>}
                {a.kind==="ordering"&&<section aria-label="Arrange answers in order" className="space-y-2">
                  <p className="text-sm">Arrange these items from first to last</p>
                  <ol className="space-y-2">{ordered.map((optionId,index)=><li key={optionId} className="flex gap-2 items-center border rounded p-3">
                    <span className="font-bold">{index+1}.</span><span className="flex-1">{shownOrder.find(item=>item.id===optionId)?.label}</span>
                    <Button variant="outline" size="sm" aria-label={`Move item ${index+1} up`} disabled={index===0||busy}
                      onClick={()=>move(question.id,ordered,index,-1)}>↑</Button>
                    <Button variant="outline" size="sm" aria-label={`Move item ${index+1} down`} disabled={index===ordered.length-1||busy}
                      onClick={()=>move(question.id,ordered,index,1)}>↓</Button>
                  </li>)}</ol>
                </section>}
              </CardContent>
            </Card>;
          })}
          <div className="flex flex-wrap gap-3 py-4">
            <Button variant="outline" onClick={()=>void persist(false)} disabled={busy}>Save progress</Button>
            <Button onClick={()=>void persist(true)} disabled={busy}>Submit assignment</Button>
          </div>
          <p className="text-sm text-muted-foreground">Submitting is final. Saved progress can be resumed with the same browser; your answers aren't sent to other players.</p>
        </>}
      </>}
    </section>
  </main>;
}
