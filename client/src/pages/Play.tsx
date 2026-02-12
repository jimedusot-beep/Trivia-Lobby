import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { WS_EVENTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import confetti from "canvas-confetti";

export default function Play() {
  const [, setLocation] = useLocation();
  const { connected, gameState, emit } = useGameSocket();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const { toast } = useToast();

  // Initial Join Logic
  useEffect(() => {
    if (connected && !hasJoined) {
      const stored = localStorage.getItem('trivia_player');
      if (!stored) {
        setLocation("/join");
        return;
      }
      
      const { roomCode, name, playerId } = JSON.parse(stored);
      
      // Emit Join
      emit(WS_EVENTS.JOIN_ROOM, { roomCode, name, playerId });
      setHasJoined(true);
    }
  }, [connected, hasJoined, emit, setLocation]);

  // Handle Game Over Confetti
  useEffect(() => {
      if (gameState.lastAnswerResult) {
          const stored = localStorage.getItem('trivia_player');
          const { playerId } = stored ? JSON.parse(stored) : { playerId: '' };
          
          const myScoreEntry = gameState.leaderboard?.find(p => p.playerId === playerId);
          // Simple logic: if I got points this round, celebrate
          // Realistically, server should tell me if I was correct in a private message or we check against correctLetter
          
          const isCorrect = gameState.currentQuestion?.choices
              .find((c: string) => c.startsWith(gameState.lastAnswerResult.correctLetter))
              ?.startsWith(gameState.lastAnswerResult.correctLetter);
              
          // Since we don't track "my previous score" easily here without more state, 
          // let's just rely on the correctLetter matching my selectedAnswer
          if (selectedAnswer === gameState.lastAnswerResult.correctLetter) {
               confetti({ particleCount: 100, spread: 60, origin: { y: 0.7 } });
          }
      }
  }, [gameState.lastAnswerResult, selectedAnswer]);

  // Reset selection on new question
  useEffect(() => {
    if (gameState.currentQuestion) {
        // Only reset if it's a NEW question ID, simplified here by watching object
        // Ideally compare IDs
        // Resetting blindly might flicker if re-renders occur, but acceptable for MVP
    }
  }, [gameState.currentQuestion]);
  
  // Watch for question changes to clear selection specifically when server timestamp changes
  useEffect(() => {
      setSelectedAnswer(null);
  }, [gameState.serverStartTs]);

  const submitAnswer = (letter: string) => {
    if (selectedAnswer) return; // Prevent multi-submit
    setSelectedAnswer(letter);
    
    const stored = localStorage.getItem('trivia_player');
    const { roomCode } = stored ? JSON.parse(stored) : { roomCode: '' };
    
    emit(WS_EVENTS.SUBMIT_ANSWER, { roomCode, answer: letter });
  };

  if (!connected) return <div className="h-screen bg-primary flex items-center justify-center text-white font-bold">Connecting...</div>;

  const getButtonColor = (letter: string, index: number) => {
    const baseColors = [
      "bg-red-500 hover:bg-red-600 border-red-700",
      "bg-blue-500 hover:bg-blue-600 border-blue-700",
      "bg-yellow-500 hover:bg-yellow-600 border-yellow-700",
      "bg-green-500 hover:bg-green-600 border-green-700"
    ];
    
    // If answer revealed
    if (gameState.lastAnswerResult) {
       if (letter === gameState.lastAnswerResult.correctLetter) return "bg-green-500 opacity-100 scale-105 border-green-700 shadow-[0_0_20px_rgba(34,197,94,0.6)]";
       if (selectedAnswer === letter) return "bg-red-500 opacity-50 border-red-700";
       return "bg-slate-300 opacity-20 grayscale";
    }

    // If I selected this
    if (selectedAnswer === letter) return "bg-slate-800 text-white border-slate-900 scale-95 ring-4 ring-white/50";
    
    // Default
    return selectedAnswer ? "opacity-50 grayscale cursor-not-allowed" : baseColors[index];
  };

  const symbols = ["▲", "◆", "●", "■"];
  const letters = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-6">
         <div className="font-bold text-slate-500">{gameState.roomCode}</div>
         <div className="font-bold text-xl text-primary">
            {gameState.players.find(p => p.playerId === JSON.parse(localStorage.getItem('trivia_player') || '{}').playerId)?.score || 0} pts
         </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-6">
        {gameState.gameStatus === 'lobby' && (
           <div className="text-center space-y-6">
             <div className="text-6xl animate-bounce">👋</div>
             <h2 className="text-2xl font-bold">You're in!</h2>
             <p className="text-muted-foreground">See your name on the host screen?</p>
             <div className="animate-pulse text-sm font-bold text-primary uppercase tracking-widest">Waiting for host...</div>
           </div>
        )}

        {gameState.gameStatus === 'playing' && (
           <>
             {gameState.currentQuestion && !gameState.lastAnswerResult && (
               <div className="grid grid-cols-2 gap-4 h-96">
                 {letters.map((letter, i) => (
                   <button
                     key={letter}
                     disabled={!!selectedAnswer}
                     onClick={() => submitAnswer(letter)}
                     className={`rounded-2xl shadow-lg border-b-8 transition-all active:border-b-0 active:translate-y-2 flex flex-col items-center justify-center gap-2 ${getButtonColor(letter, i)}`}
                   >
                     <span className="text-4xl text-white">{symbols[i]}</span>
                   </button>
                 ))}
               </div>
             )}

             {gameState.lastAnswerResult && (
               <div className="text-center space-y-6 animate-in zoom-in duration-300">
                 {selectedAnswer === gameState.lastAnswerResult.correctLetter ? (
                   <>
                     <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto" />
                     <h2 className="text-3xl font-black text-green-600">CORRECT!</h2>
                     <p className="text-lg font-bold">+ {gameState.lastAnswerResult.leaderboard.find((p:any) => p.playerId === JSON.parse(localStorage.getItem('trivia_player') || '{}').playerId)?.lastPoints || 0} pts</p>
                   </>
                 ) : (
                   <>
                     <XCircle className="w-24 h-24 text-red-500 mx-auto" />
                     <h2 className="text-3xl font-black text-red-600">WRONG</h2>
                     <p className="text-muted-foreground">Keep trying!</p>
                   </>
                 )}
               </div>
             )}

             {/* Simple message if waiting for next q */}
             {gameState.lastAnswerResult && (
                <div className="text-center text-sm text-slate-400 animate-pulse mt-8">Waiting for host...</div>
             )}
           </>
        )}
        
        {gameState.gameStatus === 'ended' && (
            <div className="text-center space-y-6">
                <h2 className="text-3xl font-bold">Game Over!</h2>
                <Button onClick={() => setLocation("/")}>Back to Home</Button>
            </div>
        )}
      </div>
    </div>
  );
}
