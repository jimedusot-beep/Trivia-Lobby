import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import confetti from "canvas-confetti";
import { useSaveReview } from "@/hooks/use-save-review";
import { useDeck } from "@/hooks/use-decks";
import { AnimatedCard } from "@/components/AnimatedCard";
import { downloadDeck } from "@/lib/deck-io";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RotateCcw, ThumbsUp, ThumbsDown, Trophy, Download } from "lucide-react";

export default function Study() {
  const { id } = useParams();
  const { data: deck, isLoading } = useDeck(Number(id));
  
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (deck?.cards) {
      setQueue([...deck.cards]);
      setCurrentIndex(0);
      setCompleted(false);
      setIsFlipped(false);
    }
  }, [deck]);

  const review=useSaveReview();
  const currentCard = queue[currentIndex];
  const progress = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

  const handleNext = async (correct: boolean) => {
    if (!currentCard || completed || review.busy || !isFlipped) return;
    if(!await review.save(currentCard.id,correct?3:1))return;
    // Missed cards are added to the back so they return before the session ends.
    const nextQueue = correct ? queue : [...queue, currentCard];
    const nextIndex = currentIndex + 1;
    setQueue(nextQueue);
    setIsFlipped(false);
    if (nextIndex >= nextQueue.length) {
      setCompleted(true);
      if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleRestart = () => {
    if (deck?.cards) {
      setQueue([...deck.cards]);
      setCurrentIndex(0);
      setCompleted(false);
      setIsFlipped(false);
    }
  };

  if (isLoading) return <div className="p-8"><Skeleton className="w-full h-96 rounded-3xl" /></div>;
  if (!deck) return <div>Deck not found</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8 flex flex-col">
      <div className="max-w-2xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="hover:bg-transparent hover:text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit
            </Button>
          </Link>
          <div className="text-center">
            <h2 className="font-bold text-lg">{deck.title}</h2>
            <p className="text-xs text-muted-foreground">{currentIndex + 1} / {queue.length} cards</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadDeck(deck, "csv")}><Download className="mr-1 h-4 w-4" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => downloadDeck(deck, "json")}><Download className="mr-1 h-4 w-4" /> Backup</Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Reviews are saved across devices. <Link href={`/learning/review/${id}?mode=due`} className="underline">Resume due reviews</Link></p>
        {review.error&&<p role="alert" className="text-destructive">{review.error}</p>}
        <Progress value={completed ? 100 : progress} className="h-3 rounded-full" aria-label="Study progress" />

        <div className="flex-1 flex flex-col justify-center">
          {completed ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-xl space-y-6 animate-in zoom-in-50 duration-500">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-yellow-100 text-yellow-600 mb-4">
                <Trophy className="h-12 w-12" />
              </div>
              <h1 className="text-4xl font-display font-bold">Session Complete!</h1>
              <p className="text-muted-foreground text-lg">You've reviewed all cards in this deck. Your reviews and next due dates are saved to your account.</p>
              <Button onClick={handleRestart} size="lg" className="rounded-xl text-lg px-8">
                <RotateCcw className="mr-2 h-5 w-5" /> Start Over
              </Button>
            </div>
          ) : currentCard ? (
            <div className="space-y-8">
              <AnimatedCard 
                front={<h3 className="text-2xl md:text-3xl font-bold">{currentCard.front}</h3>}
                back={<h3 className="text-2xl md:text-3xl font-medium text-primary">{currentCard.back}</h3>}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped(!isFlipped)}
                className="mx-auto"
              />

              <div className="grid grid-cols-2 gap-4 pt-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-16 text-lg border-2 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 rounded-2xl transition-all"
                  disabled={review.busy||!isFlipped}
                  onClick={() => void handleNext(false)}
                >
                  <ThumbsDown className="mr-2 h-6 w-6" /> Needs Review
                </Button>
                <Button 
                  size="lg" 
                  className="h-16 text-lg bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-green-200 shadow-lg transition-all"
                  disabled={review.busy||!isFlipped}
                  onClick={() => void handleNext(true)}
                >
                  <ThumbsUp className="mr-2 h-6 w-6" /> Got It!
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Click card to flip
              </p>
            </div>
          ) : (
            <div className="text-center">No cards available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
