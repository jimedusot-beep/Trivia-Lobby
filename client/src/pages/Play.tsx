import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { WS_EVENTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import confetti from "canvas-confetti";

const letters = ["A", "B", "C", "D"] as const;
const symbols = ["▲", "◆", "●", "■"];
const colors = [
  "bg-red-500 hover:bg-red-600 border-red-700",
  "bg-blue-500 hover:bg-blue-600 border-blue-700",
  "bg-yellow-500 hover:bg-yellow-600 border-yellow-700",
  "bg-green-500 hover:bg-green-600 border-green-700",
];

export default function Play() {
  const [, setLocation] = useLocation();
  const { connected, gameState, emit } = useGameSocket("player");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const question = gameState.currentQuestion;
  const result = gameState.lastAnswerResult;

  useEffect(() => {
    if (!localStorage.getItem("trivia_player")) setLocation("/join");
  }, [setLocation]);
  useEffect(() => { setSelectedAnswer(null); }, [question?.questionIndex, question?.serverStartTs]);
  useEffect(() => {
    if (result?.isCorrect) confetti({ particleCount: 100, spread: 60, origin: { y: 0.7 } });
  }, [result]);
  useEffect(() => {
    if (gameState.phase !== "playing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [gameState.phase]);

  const seconds = question ? Math.max(0, Math.ceil((question.deadlineTs - now) / 1000)) : 0;
  const score = gameState.players.find(p => p.playerId === gameState.playerId)?.score ?? gameState.score ?? 0;
  const canAnswer = connected && gameState.phase === "playing" && !selectedAnswer && seconds > 0;

  const submitAnswer = (answer: typeof letters[number]) => {
    if (!canAnswer || !question) return;
    setSelectedAnswer(answer);
    emit(WS_EVENTS.SUBMIT_ANSWER, {
      roomCode: gameState.roomCode, questionIndex: question.questionIndex, answer,
    });
  };

  if (!connected) return (
    <div className="h-screen bg-primary flex items-center justify-center text-white font-bold">
      Reconnecting to game…
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="font-bold text-slate-500">{gameState.roomCode}</div>
        <div className="font-bold text-xl text-primary">{score} pts</div>
      </div>
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-6">
        {gameState.gameStatus === "lobby" && (
          <div className="text-center space-y-6">
            <div className="text-6xl">👋</div>
            <h2 className="text-2xl font-bold">Joined lobby</h2>
            <p className="text-muted-foreground">Waiting for the host to start…</p>
          </div>
        )}
        {gameState.gameStatus === "playing" && gameState.phase === "playing" && question && (
          <>
            <div className="text-center font-bold text-lg" aria-live="off">
              Question {question.questionIndex + 1} · {seconds}s remaining
            </div>
            <div className="text-center text-lg font-semibold">{question.prompt}</div>
            <div className="grid grid-cols-2 gap-4 h-80">
              {letters.map((letter, i) => (
                <button
                  key={letter}
                  type="button"
                  disabled={!canAnswer}
                  aria-label={letter + ": " + question.choices[i]}
                  onClick={() => submitAnswer(letter)}
                  className={`rounded-2xl shadow-lg border-b-8 transition-all flex flex-col items-center justify-center gap-3 ${selectedAnswer === letter ? "bg-slate-800 text-white ring-4 ring-white/50" : colors[i]} ${!canAnswer && selectedAnswer !== letter ? "opacity-50" : ""}`}
                >
                  <span className="text-4xl text-white">{symbols[i]}</span>
                  <span className="text-sm text-white font-medium px-2 text-center">{question.choices[i]}</span>
                </button>
              ))}
            </div>
            {selectedAnswer && <p role="status" className="text-center">Answer received. Waiting for reveal…</p>}
          </>
        )}
        {gameState.gameStatus === "playing" && ["reveal", "leaderboard"].includes(gameState.phase) && result && (
          <div className="text-center space-y-6" aria-live="polite">
            {result.isCorrect === true ? (
              <>
                <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto" aria-hidden="true" />
                <h2 className="text-3xl font-black text-green-600">Correct!</h2>
                <p className="text-lg font-bold">+{result.awarded} pts</p>
              </>
            ) : (
              <>
                <XCircle className="w-24 h-24 text-red-500 mx-auto" aria-hidden="true" />
                <h2 className="text-3xl font-black text-red-600">{result.isCorrect === false ? "Incorrect or missed" : "Answer revealed"}</h2>
              </>
            )}
            <p>Correct answer: <strong>{question?.choices[letters.indexOf(result.correctLetter)]}</strong></p>
            {gameState.phase === "leaderboard" && (
              <ol className="text-left bg-white rounded-xl p-4 space-y-2">
                {(gameState.leaderboard ?? []).slice(0, 5).map(p => (
                  <li key={p.playerId} className="flex justify-between"><span>{p.name}</span><span>{p.score} pts</span></li>
                ))}
              </ol>
            )}
            <p className="text-sm text-slate-500">Waiting for host…</p>
          </div>
        )}
        {gameState.gameStatus === "ended" && (
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold">Game Over!</h2>
            <ol className="text-left bg-white rounded-xl p-4 space-y-2">
              {(gameState.leaderboard ?? []).slice(0, 5).map(p => (
                <li key={p.playerId} className="flex justify-between"><span>{p.name}</span><span>{p.score} pts</span></li>
              ))}
            </ol>
            <Button onClick={() => setLocation("/")}>Back to Home</Button>
          </div>
        )}
      </div>
    </div>
  );
}
