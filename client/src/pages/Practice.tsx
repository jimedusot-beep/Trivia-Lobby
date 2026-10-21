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
  const question = questions[index];
  const answer = (value: boolean) => {
    if (marked !== null) return;
    setMarked(value);
    if (value) setCorrect(n => n + 1);
  };
  const next = () => {
    if (index === questions.length - 1) setDone(true);
    else setIndex(i => i + 1);
    setMarked(null);
    setRevealed(false);
  };
  const restart = () => {
    setIndex(0); setMarked(null); setRevealed(false); setCorrect(0); setDone(false);
  };

  if (isLoading) return <main className="p-8">Loading study deck...</main>;
  if (!deck) return <main className="p-8">Deck not found.</main>;
  return (
    <main className="min-h-screen bg-muted/30 p-4 md:p-8">
      <section className="max-w-3xl mx-auto space-y-6">
        <Link href="/"><Button variant="ghost">Back to library</Button></Link>
        <h1 className="text-3xl font-bold">{deck.title} — Practice</h1>
        <p className="text-muted-foreground">Session-only results. Account-based study history is not implemented.</p>
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
              <CardTitle className="text-2xl">{question.front}</CardTitle>
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
                <Button onClick={next}>{index + 1 === questions.length ? "Show results" : "Next question"}</Button>
              </div>}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
