import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Leader = {playerId:string;name:string;score:number};
type Summary = {
  id:string;deckTitle:string;mode:string;createdAt:string;finishedAt:string|null;leaderboard:Leader[];
};
type Answer = {playerId:string;name:string;response:unknown;correct:boolean;awarded:number;responseMs:number|null};
type Round = {
  questionIndex:number;prompt:string;kind:string;options:string[];correctAnswers:string[];
  durationMs:number;playerAnswers:Answer[];revealedAt:string;
};
type Detail = Summary & {rounds:Round[]};

async function json<T>(url:string):Promise<T>{
  const res=await fetch(url,{credentials:"same-origin"});
  if(!res.ok)throw new Error(res.status===404?"Report not found":`Could not load reports (HTTP ${res.status})`);
  return res.json();
}
const percentage=(n:number,d:number)=>d?Math.round(n/d*100)+"%":"—";

export default function Reports(){
  const {id}=useParams();
  const [history,setHistory]=useState<Summary[]>([]);
  const [report,setReport]=useState<Detail|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let live=true;setLoading(true);setError("");setReport(null);
    const url=id?`/api/reports/${encodeURIComponent(id)}`:"/api/reports";
    json<Detail|Summary[]>(url).then(value=>{
      if(!live)return;
      if(id)setReport(value as Detail);else setHistory(value as Summary[]);
    }).catch(err=>{if(live)setError(err instanceof Error?err.message:"Reports unavailable");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[id]);

  return <main className="min-h-screen bg-muted/30 p-4 md:p-8">
    <section className="max-w-5xl mx-auto space-y-5">
      <Button variant="outline" asChild><Link href={id?"/reports":"/"}>{id?"Back to reports":"Back to home"}</Link></Button>
      <h1 className="text-3xl font-bold">Game reports</h1>
      <p className="text-sm text-muted-foreground">Private history for quizzes you hosted. Guest nicknames and answers are visible only to the owning account.</p>
      {loading&&<p role="status">Loading game reports…</p>}
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {!id&&!loading&&history.length===0&&<Card><CardContent className="p-6">No hosted game reports yet. Host a quiz and finish it to see results here.</CardContent></Card>}
      {!id&&history.map(session=><Card key={session.id}>
        <CardHeader><CardTitle className="text-xl">{session.deckTitle}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 justify-between items-center">
          <div className="text-sm space-y-1">
            <p>{session.mode} · {session.finishedAt?"Finished":"In progress / interrupted"}</p>
            <p>{new Date(session.createdAt).toLocaleString()}</p>
            <p>{session.leaderboard.length} ranked players</p>
          </div>
          <Button asChild><Link href={`/reports/${session.id}`}>Review report</Link></Button>
        </CardContent>
      </Card>)}
      {id&&report&&<>
        <Card>
          <CardHeader><CardTitle>{report.deckTitle}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{report.mode} · {report.finishedAt?"Completed":"In progress / interrupted"} · {report.rounds.length} revealed rounds</p>
            <p className="text-sm text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</p>
            <Button variant="outline" asChild><a href={`/api/reports/${report.id}.csv`}>Export answers to CSV</a></Button>
            <h2 className="text-xl font-bold pt-3">Final standings</h2>
            {report.leaderboard.length===0?<p className="text-sm">No finished-game standings yet.</p>:
              <ol className="space-y-2">{report.leaderboard.map((player,index)=>
                <li key={player.playerId} className="flex justify-between border rounded p-3">
                  <span>{index+1}. {player.name}</span><strong>{player.score} points</strong>
                </li>)}</ol>}
          </CardContent>
        </Card>
        <h2 className="text-2xl font-bold">Question breakdown</h2>
        {report.rounds.map(round=>{
          const answered=round.playerAnswers.filter(a=>a.response!==null);
          const correct=round.playerAnswers.filter(a=>a.correct).length;
          return <Card key={round.questionIndex}>
            <CardHeader><CardTitle className="text-lg">{round.questionIndex+1}. {round.prompt}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{round.kind.replaceAll("_"," ")} · {percentage(correct,round.playerAnswers.length)} correct · {answered.length} answered / {round.playerAnswers.length} players</p>
              <p className="text-sm">Correct: <strong>{round.correctAnswers.join(round.kind==="ordering"?" → ":", ")||"Not recorded"}</strong></p>
              <div className="overflow-x-auto"><table className="min-w-full text-sm">
                <thead><tr className="border-b text-left"><th scope="col" className="p-2">Player</th><th scope="col" className="p-2">Result</th><th scope="col" className="p-2">Points</th><th scope="col" className="p-2">Response time</th></tr></thead>
                <tbody>{round.playerAnswers.map(a=><tr key={a.playerId} className="border-b">
                  <td className="p-2">{a.name}</td><td className="p-2">{a.response===null?"No answer":a.correct?"Correct":"Incorrect"}</td>
                  <td className="p-2">{a.awarded}</td><td className="p-2">{a.responseMs===null?"—":(a.responseMs/1000).toFixed(2)+"s"}</td>
                </tr>)}</tbody>
              </table></div>
            </CardContent>
          </Card>;
        })}
      </>}
    </section>
  </main>;
}
