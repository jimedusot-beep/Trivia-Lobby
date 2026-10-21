import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { WS_EVENTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimerBar } from "@/components/TimerBar";
import { ArrowLeft, Users, Play, Copy, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Host() {
  const { deckId } = useParams();
  const { connected, gameState, emit } = useGameSocket();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Auto-create room on mount
  useEffect(() => {
    if (connected && deckId && !gameState.roomCode) {
      emit(WS_EVENTS.CREATE_ROOM, { deckId: parseInt(deckId) });
    }
  }, [connected, deckId, gameState.roomCode, emit]);

  const copyCode = () => {
    if (gameState.roomCode) {
      navigator.clipboard.writeText(gameState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Room code copied to clipboard" });
    }
  };

  const startGame = () => {
    if (gameState.players.length === 0) {
      toast({ title: "Need players", description: "Wait for someone to join!", variant: "destructive" });
      return;
    }
    emit(WS_EVENTS.START_GAME, { roomCode: gameState.roomCode });
  };

  const nextQuestion = () => {
    emit(WS_EVENTS.NEXT_QUESTION, { roomCode: gameState.roomCode });
  };

  if (!connected) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-2xl font-bold text-primary">Connecting to server...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-8">
         <Link href="/">
           <Button variant="ghost" className="text-white hover:bg-white/10">
             <ArrowLeft className="mr-2 h-4 w-4" /> Quit Game
           </Button>
         </Link>
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
             <Users className="h-4 w-4" />
             <span className="font-bold">{gameState.players.length} Players</span>
           </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
        
        {/* LOBBY STATE */}
        {gameState.gameStatus === 'lobby' && (
          <div className="w-full text-center space-y-12 animate-in fade-in duration-700">
            <div className="space-y-4">
              <h2 className="text-2xl text-slate-400 font-medium">Join at <span className="text-white font-bold underline">{window.location.host}/join</span> with code:</h2>
              <div 
                onClick={copyCode}
                className="text-8xl md:text-9xl font-black font-mono tracking-wider cursor-pointer hover:scale-105 transition-transform text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500"
              >
                {gameState.roomCode || "..."}
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode} className="text-slate-400 hover:text-white">
                {copied ? "Copied!" : <><Copy className="w-4 h-4 mr-2" /> Click to Copy</>}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {gameState.players.map((p) => (
                <motion.div 
                  key={p.playerId}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/10 backdrop-blur-sm p-4 rounded-xl text-xl font-bold border border-white/20 shadow-lg"
                >
                  {p.name}
                </motion.div>
              ))}
              {gameState.players.length === 0 && (
                <div className="col-span-full text-slate-500 italic">Waiting for players to join...</div>
              )}
            </div>

            <Button 
              size="lg" 
              className="h-20 px-12 text-2xl font-bold rounded-2xl bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 btn-bouncy"
              onClick={startGame}
              disabled={gameState.players.length === 0}
            >
              Start Game <Play className="ml-3 h-8 w-8 fill-current" />
            </Button>
          </div>
        )}

        {/* PLAYING STATE */}
        {gameState.gameStatus === 'playing' && (
          <div className="w-full space-y-8">
             {/* Question Screen */}
             {gameState.currentQuestion && !gameState.lastAnswerResult && (
               <div className="space-y-8 animate-in zoom-in-90 duration-300">
                 <div className="w-full bg-white/5 rounded-full p-1">
                    <TimerBar 
                      durationMs={gameState.timeRemainingMs || 10000} 
                      serverStartTs={gameState.serverStartTs || Date.now()} 
                    />
                 </div>

                 <Card className="bg-white text-slate-900 p-12 rounded-3xl shadow-2xl text-center min-h-[300px] flex items-center justify-center">
                   <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                     {gameState.currentQuestion.prompt}
                   </h2>
                 </Card>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {gameState.currentQuestion.choices.map((choice: string, i: number) => {
                     const colors = [
                       "bg-red-500 border-red-700", 
                       "bg-blue-500 border-blue-700", 
                       "bg-yellow-500 border-yellow-700", 
                       "bg-green-500 border-green-700"
                     ];
                     const symbols = ["▲", "◆", "●", "■"];
                     
                     return (
                       <div key={i} className={`${colors[i]} border-b-4 rounded-xl p-6 flex items-center shadow-lg text-white`}>
                         <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center font-bold text-lg mr-4">
                           {symbols[i]}
                         </div>
                         <span className="text-2xl font-bold">{choice}</span>
                       </div>
                     );
                   })}
                 </div>
               </div>
             )}

             {/* Result/Leaderboard Screen */}
             {gameState.lastAnswerResult && (
               <div className="text-center space-y-8 animate-in slide-in-from-right duration-500">
                 <div className="space-y-2">
                   <h2 className="text-2xl text-slate-400">Correct Answer:</h2>
                   <div className="text-4xl font-bold text-green-400">
                     {gameState.currentQuestion.choices[["A", "B", "C", "D"].indexOf(gameState.lastAnswerResult.correctLetter)] ?? "Unavailable"}
                   </div>
                 </div>

                 <div className="bg-white/10 rounded-3xl p-8 max-w-2xl mx-auto backdrop-blur-md">
                   <h3 className="text-2xl font-bold mb-6 flex items-center justify-center">
                     <Trophy className="mr-2 text-yellow-400" /> Leaderboard
                   </h3>
                   <div className="space-y-3">
                     {gameState.leaderboard?.slice(0, 5).map((player: any, i: number) => (
                       <motion.div 
                         key={player.playerId}
                         initial={{ x: -20, opacity: 0 }}
                         animate={{ x: 0, opacity: 1 }}
                         transition={{ delay: i * 0.1 }}
                         className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10"
                       >
                         <div className="flex items-center gap-4">
                           <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-700'}`}>
                             {i + 1}
                           </span>
                           <span className="font-bold text-xl">{player.name}</span>
                         </div>
                         <span className="font-mono text-xl">{player.score} pts</span>
                       </motion.div>
                     ))}
                   </div>
                 </div>

                 <Button 
                   size="lg" 
                   className="h-16 px-12 text-xl font-bold bg-primary hover:bg-primary/90 btn-bouncy"
                   onClick={nextQuestion}
                 >
                   Next Question <Play className="ml-2 w-5 h-5" />
                 </Button>
               </div>
             )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState.gameStatus === 'ended' && (
           <div className="text-center space-y-8 animate-in zoom-in duration-700">
             <Trophy className="w-32 h-32 text-yellow-400 mx-auto drop-shadow-glow animate-bounce" />
             <h1 className="text-6xl font-black">GAME OVER</h1>
             
             <div className="flex items-end justify-center gap-4 h-64 pb-4">
                {/* 2nd Place */}
                {gameState.leaderboard?.[1] && (
                  <div className="w-32 bg-slate-700 rounded-t-lg h-32 flex flex-col justify-end p-4 items-center">
                    <div className="font-bold text-xl mb-2">{gameState.leaderboard[1].name}</div>
                    <div className="w-8 h-8 rounded-full bg-slate-400 text-slate-900 flex items-center justify-center font-bold">2</div>
                  </div>
                )}
                
                {/* 1st Place */}
                {gameState.leaderboard?.[0] && (
                  <div className="w-32 bg-yellow-500 rounded-t-lg h-48 flex flex-col justify-end p-4 items-center shadow-lg shadow-yellow-500/20 z-10">
                    <div className="font-bold text-2xl mb-2 text-yellow-900">{gameState.leaderboard[0].name}</div>
                    <div className="w-10 h-10 rounded-full bg-yellow-200 text-yellow-900 flex items-center justify-center font-bold text-xl">1</div>
                  </div>
                )}

                {/* 3rd Place */}
                {gameState.leaderboard?.[2] && (
                  <div className="w-32 bg-slate-800 rounded-t-lg h-24 flex flex-col justify-end p-4 items-center">
                    <div className="font-bold text-lg mb-2">{gameState.leaderboard[2].name}</div>
                    <div className="w-8 h-8 rounded-full bg-orange-700 text-orange-100 flex items-center justify-center font-bold">3</div>
                  </div>
                )}
             </div>

             <Link href="/">
               <Button size="lg" variant="outline" className="mt-8 text-black border-white hover:bg-white hover:text-black">
                 Back to Home
               </Button>
             </Link>
           </div>
        )}
      </div>
    </div>
  );
}
