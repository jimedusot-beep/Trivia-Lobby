import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useDeck } from "@/hooks/use-decks";
import { buildPracticeQuestions } from "@/lib/practice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function Practice() {
  const { id } = useParams();
  const { data: deck, isLoading } = useDeck(Number(id));
  const questions = useMemo(() => buildPracticeQuestions(deck?.cards ?? []), [deck]);
  const [index, setIndex] = useState(0);
  const [marked, setMarked] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [memory,setMemory]=useState<"idle"|"saving"|"saved"|"failed">("idle");
  const [saveError,setSaveError]=useState("");
  const question = questions[index];
  const saveAnswer=async(value:boolean)=>{
    setMemory("saving");setSaveError("");
    try{const response=await fetch("/api/study/review",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({cardId:question.id,rating:value?3:1,requestId})});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??"Could not save review");setMemory("saved");}
    catch(e){setMemory("failed");setSaveError((e as Error).message);}
  };
  const answer = (value: boolean) => {
    if (marked !== null) return;
    setMarked(value);
    if (value) setCorrect(n => n + 1);
    void saveAnswer(value);
  };
  const next = () => {
    if(memory!=="saved")return;
    if (index === questions.length - 1) setDone(true);
    else setIndex(i => i + 1);
    setMarked(null);
    setRevealed(false);
    setRequestId(crypto.randomUUID());setMemory("idle");setSaveError("");
  };
  const restart = () => {
    setIndex(0); setMarked(null); setRevealed(false); setCorrect(0); setDone(false);setRequestId(crypto.randomUUID());setMemory("idle");setSaveError("");
  };

  if (isLoading) return <main className="p-8">Loading study deck...</main>;
  if (!deck) return <main className="p-8">Deck not found.</main>;
  return (
    <main className="min-h-screen bg-muted/30 p-4 md:p-8">
      <section className="max-w-3xl mx-auto space-y-6">
        <Button asChild variant="ghost"><Link href="/decks">Back to library</Link></Button>
        <h1 className="text-3xl font-bold">{deck.title} — Practice</h1>
        <p className="text-muted-foreground">Results save to your study history and update the next review.</p>
        <Progress value={done ? 100 : questions.length ? 100 * index / questions.length : 0} />
        {!questions.length ? <p>No cards in this deck yet.</p> : done ? (
          <Card><CardContent className="p-8 space-y-4 text-center">
            <h2 className="text-2xl font-bold">Practice complete!</h2>
            <p>{correct} of {questions.length} correct.</p>
            <Button onClick={restart}>Try again</Button>
          </CardContent></Card>
        ) : question ? (
          <Card>
            <CardHeader>
              <p className="text-muted-foreground">Question {index + 1} of {questions.length}</p>
              <CardTitle><h2 className="text-2xl">{question.front}</h2></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.answerIndex !== null ? (
                <div className="grid gap-3">
                  {question.choices.map((choice, i) =>
                    <Button key={i} variant="outline" className="h-auto min-h-14 whitespace-normal justify-start text-left p-4"
                      disabled={marked !== null} onClick={() => answer(i === question.answerIndex)}>
                      {String.fromCharCode(65 + i)}. {choice}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {!revealed ? <Button onClick={() => setRevealed(true)}>Reveal answer</Button> :
                    <div className="space-y-3">
                      <p className="p-4 rounded bg-muted">{question.back}</p>
                      {marked === null && <div className="flex gap-2">
                        <Button variant="outline" onClick={() => answer(false)}>Need practice</Button>
                        <Button onClick={() => answer(true)}>I knew it</Button>
                      </div>}
                    </div>}
                </div>
              )}
              {marked !== null && <div role="status" className="space-y-3 p-4 border rounded">
                <p className="font-semibold">{marked ? "Correct!" : "Not quite."}</p>
                <p><strong>Answer:</strong> {question.back}</p>
                <p>{memory==="saved"?"Review saved":memory==="saving"?"Saving review…":"Review needs saving"}</p>
                {saveError&&<p role="alert">{saveError}</p>}
                {memory==="failed"&&<Button variant="outline" onClick={()=>void saveAnswer(marked)}>Retry saving review</Button>}
                <Button disabled={memory!=="saved"} onClick={next}>{index + 1 === questions.length ? "Show results" : "Next question"}</Button>
              </div>}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
