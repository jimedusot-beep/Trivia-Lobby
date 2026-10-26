import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { WS_EVENTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimerBar } from "@/components/TimerBar";
import { ArrowLeft, Users, Play, Copy, Trophy, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { enableGameAudio, playGameCue } from "@/lib/game-audio";
import { RoomInvitation } from "@/components/RoomInvitation";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function Host() {
  const { deckId } = useParams();
  const { connected, restoring, gameState, emit, lastError } = useGameSocket("host");
  const createRequested = useRef(false);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [oddSettings,setOddSettings]=useState({roundCount:20,timeLimitMs:45_000,shuffleQuestions:false,shuffleAnswers:false});
  const updateOddSettings = (patch:Partial<typeof oddSettings>) => {
    const next={...oddSettings,...patch};setOddSettings(next);
    if(gameState.roomCode&&gameState.phase==="lobby")emit(WS_EVENTS.CONFIGURE_GAME,{roomCode:gameState.roomCode,mode:"odd_one_out",...next});
  };
  useEffect(() => {
    if (gameState.oddSettings) setOddSettings(gameState.oddSettings);
  }, [gameState.oddSettings]);
  const [presenting, setPresenting] = useState(false);
  const reducedMotion = useReducedMotion();
  const lastCountdownCue = useRef("");
  useEffect(() => {
    const sync = () => setPresenting(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!soundEnabled) return;
    if (gameState.phase === "reveal") playGameCue("reveal");
    if (gameState.phase === "finished") playGameCue("finish");
  }, [gameState.phase, soundEnabled]);
  useEffect(() => {
    if (!soundEnabled || gameState.phase !== "playing" || !gameState.currentQuestion) return;
    const question = gameState.currentQuestion;
    const interval = window.setInterval(() => {
      const seconds=Math.ceil((question.deadlineTs-Date.now())/1000);
      const id=question.serverStartTs + ":" + seconds;
      if (seconds>0 && seconds<=5 && lastCountdownCue.current!==id) {
        lastCountdownCue.current=id;
        playGameCue("countdown");
      }
    },250);
    return () => window.clearInterval(interval);
  }, [soundEnabled, gameState.phase, gameState.currentQuestion?.serverStartTs]);
  const toggleSound = async () => {
    if (soundEnabled) { setSoundEnabled(false); return; }
    if (await enableGameAudio()) { setSoundEnabled(true); playGameCue("start"); }
    else toast({title:"Sound unavailable", description:"Your browser blocked audio. Gameplay will continue normally."});
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {toast({title:"Fullscreen unavailable",description:"Your browser does not permit presenter fullscreen."});}
  };
  const invitationUrl = gameState.roomCode ? `${window.location.origin}/join?code=${encodeURIComponent(gameState.roomCode)}` : "";

  // Auto-create room on mount
  useEffect(() => {
    if (connected && deckId && !gameState.roomCode && !restoring && !createRequested.current) {
      createRequested.current = true;
      sessionStorage.setItem("trivia_host_deck_id", deckId);
      emit(WS_EVENTS.CREATE_ROOM, { deckId: parseInt(deckId) });
    }
  }, [connected, deckId, gameState.roomCode, restoring, emit]);

  useEffect(() => {
    if(!connected||!gameState.roomCode||gameState.phase!=="lobby"||sessionStorage.getItem("trivia_mode_preference")!=="odd_one_out")return;
    sessionStorage.removeItem("trivia_mode_preference");
    emit(WS_EVENTS.CONFIGURE_GAME,{roomCode:gameState.roomCode,mode:"odd_one_out",...oddSettings});
  },[connected,gameState.roomCode,gameState.phase,emit]);

  const copyCode = async () => {
    if (gameState.roomCode) {
      try {
        await navigator.clipboard.writeText(gameState.roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copied!", description: "Room code copied to clipboard" });
      } catch { toast({ title: "Clipboard unavailable", description: "Use the QR code or select the visible invitation link." }); }
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
    <div className="min-h-screen flex flex-col gap-4 items-center justify-center p-6 bg-background">
      <p role="status" className="text-2xl font-bold text-primary">Connecting to your room…</p>
      {lastError && <p role="alert" className="max-w-md text-center">{lastError}</p>}
      <Link href="/" className="underline">Return to decks</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      {/* Top Bar */}
      <div className="flex flex-wrap gap-3 justify-between items-center mb-8">
         <Button asChild variant="ghost" className="text-white hover:bg-white/10"><Link href="/">
             <ArrowLeft className="mr-2 h-4 w-4" /> Quit Game
           </Link></Button>
         <div className="flex flex-wrap items-center gap-2">
           <Button size="sm" variant="outline" onClick={() => void toggleSound()} aria-label={soundEnabled?"Mute game audio":"Enable game audio"} aria-pressed={soundEnabled}
             className="text-slate-900">{soundEnabled?<><Volume2 className="w-4 h-4 mr-2"/>Sound on</>:<><VolumeX className="w-4 h-4 mr-2"/>Sound off</>}</Button>
           <Button size="sm" variant="outline" onClick={() => void toggleFullscreen()} aria-label={presenting?"Exit fullscreen presentation":"Enter fullscreen presentation"}
             className="text-slate-900">{presenting?<Minimize className="w-4 h-4 mr-2"/>:<Maximize className="w-4 h-4 mr-2"/>}{presenting?"Exit full screen":"Present full screen"}</Button>
           <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
             <Users className="h-4 w-4" />
             <span className="font-bold">{gameState.players.length} Players</span>
           </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
        {lastError&&<p role="alert" className="p-4 bg-red-950 text-white rounded">{lastError} <Link href="/" className="underline">Return to decks</Link></p>}
        {invitationUrl && gameState.gameStatus !== "lobby" && <details className="lobby-invite-panel">
          <summary>Invite friends · QR &amp; sharing · {gameState.roomCode}</summary>
          <RoomInvitation url={invitationUrl} code={gameState.roomCode}/>
        </details>}
        
        {/* LOBBY STATE */}
        {gameState.gameStatus === 'lobby' && (
          <div className="w-full text-center space-y-12 animate-in fade-in duration-700">
            <div className="space-y-3"><label htmlFor="game-mode" className="block">Game mode</label>
              <select id="game-mode" className="p-3 rounded bg-slate-800 text-white border" value={gameState.mode??"classic"} disabled={!gameState.roomCode}
                onChange={e=>emit(WS_EVENTS.CONFIGURE_GAME,{roomCode:gameState.roomCode,mode:e.target.value,...(e.target.value==="odd_one_out"?oddSettings:{})})}>
                {[["classic","Classic quiz"],["teams","Team competition"],["buzzer","Buzzer race"],["wager","Confidence wager"],["workshop","Workshop upgrades"],["party","Party rounds"],["sprint","Sprint Trivia (speed bonus)"],["odd_one_out","Odd One Out"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}
              </select>
              {gameState.mode==="odd_one_out"&&<section aria-label="Odd One Out settings" className="mx-auto max-w-2xl bg-white/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <label className="text-sm">Number of rounds
                  <input aria-label="Odd One Out round count" type="number" className="mt-1 w-full p-3 rounded text-slate-900" min={1} max={500} value={oddSettings.roundCount} onChange={e=>updateOddSettings({roundCount:Math.max(1,Math.min(500,Math.floor(Number(e.target.value)||1)))})}/>
                </label>
                <label className="text-sm">Time per question
                  <select aria-label="Odd One Out timer" className="mt-1 w-full p-3 rounded bg-slate-800 text-white" value={oddSettings.timeLimitMs} onChange={e=>updateOddSettings({timeLimitMs:Number(e.target.value)})}>
                    {[15000,30000,45000,60000,90000].map(value=><option key={value} value={value}>{value/1000} seconds</option>)}
                  </select>
                </label>
                <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={oddSettings.shuffleQuestions} onChange={e=>updateOddSettings({shuffleQuestions:e.target.checked})}/>Shuffle question order</label>
                <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={oddSettings.shuffleAnswers} onChange={e=>updateOddSettings({shuffleAnswers:e.target.checked})}/>Shuffle answer positions</label>
              </section>}
              <p className="text-sm text-slate-300">Teams are balanced automatically. Buzzer gives one player five seconds to answer. Wagers use earned game points. Workshop coins buy original upgrades between rounds. Party doubles every third round. Sprint awards 500–1,000 points for speed. Odd One Out awards 1 point for the impostor and 1 host-reviewed explanation bonus. It requires a deck of four-choice questions with explanations.</p>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl text-slate-400 font-medium">Join at <span className="text-white font-bold underline">{window.location.host}/join</span> with code:</h2>
              <div 
                onClick={copyCode}
                data-testid="room-code" className="text-5xl sm:text-7xl md:text-8xl font-black font-mono tracking-wider cursor-pointer hover:scale-105 transition-transform text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-orange-500"
              >
                {gameState.roomCode || "..."}
              </div>
              <Button variant="ghost" size="sm" onClick={copyCode} className="text-slate-400 hover:text-white">
                {copied ? "Copied!" : <><Copy className="w-4 h-4 mr-2" /> Click to Copy</>}
              </Button>
              {invitationUrl && <RoomInvitation url={invitationUrl} code={gameState.roomCode}/>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {gameState.players.map((p) => (
                <motion.div 
                  key={p.playerId}
                  initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/10 backdrop-blur-xs p-4 rounded-xl text-xl font-bold border border-white/20 shadow-lg"
                >
                  <span className="block font-bold">{p.name}</span>
                  <span className={"block text-sm " + (p.connected?"text-green-300":"text-amber-200")}>{p.connected?"Connected":"Disconnected"}</span>
                  {gameState.mode==="teams"&&<span className="block text-sm">Team {p.teamId}</span>}
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
             {gameState.mode==="teams"&&<div className="flex gap-6 justify-center">{[1,2].map(team=><p key={team}>Team {team}: {gameState.players.filter(p=>p.teamId===team).reduce((n,p)=>n+p.score,0)} pts</p>)}</div>}
             {/* Question Screen */}
             {gameState.currentQuestion && !gameState.lastAnswerResult && (
               <div className="space-y-8 animate-in zoom-in-90 duration-300">
                 <p role="status" className="text-center text-xl font-semibold">Question {gameState.currentQuestion?.questionIndex !== undefined ? gameState.currentQuestion.questionIndex+1 : "…"} of {gameState.currentQuestion?.totalQuestions ?? "?"}</p>
                 {gameState.submissionProgress?.questionIndex === gameState.currentQuestion.questionIndex && (
                   <div className="max-w-md mx-auto space-y-2" role="status" aria-live="polite">
                     <p className="text-center text-lg font-semibold">
                       Answers received: {gameState.submissionProgress.received} / {gameState.submissionProgress.total}
                       <span className="block text-sm font-normal text-slate-300">
                         {gameState.submissionProgress.connected} connected
                       </span>
                     </p>
                     <div className="h-3 bg-white/20 rounded-full overflow-hidden" aria-hidden="true">
                       <div className="h-full bg-green-400 transition-[width]" style={{
                         width: (gameState.submissionProgress.total
                           ? 100 * gameState.submissionProgress.received / gameState.submissionProgress.total : 0) + "%"
                       }} />
                     </div>
                   </div>
                 )}
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
                   {gameState.currentQuestion.kind==="ordering" && <p className="col-span-full text-center text-sm">Players are arranging these items in order.</p>}
                    {gameState.currentQuestion.kind==="multiple_select" && <p className="col-span-full text-center text-sm">Players may select more than one answer.</p>}
                    {gameState.currentQuestion.choices.map((choice: string, i: number) => {
                     const colors = [
                       "bg-red-500 border-red-700", 
                       "bg-blue-500 border-blue-700", 
                       "bg-yellow-500 border-yellow-700", 
                       "bg-green-500 border-green-700"
                     ];
                     const symbols = ["▲", "◆", "●", "■"];
                     
                     return (
                       <div key={i} className={`${colors[i%colors.length]} border-b-4 rounded-xl p-6 flex items-center shadow-lg text-white`}>
                         <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center font-bold text-lg mr-4">
                           {symbols[i%symbols.length]}
                         </div>
                         <span className="text-2xl font-bold">{choice}</span>
                       </div>
                     );
                   })}
                 </div>
               </div>
             )}

             {/* Result/Leaderboard Screen */}
             {gameState.lastAnswerResult && gameState.currentQuestion && (
               <div className="text-center space-y-8 animate-in slide-in-from-right duration-500">
                 <div className="space-y-2">
                   <h2 className="text-2xl text-slate-400">Correct Answer:</h2>
                   <div className="text-4xl font-bold text-green-400">
                     {gameState.lastAnswerResult.correctAnswers?.join(gameState.currentQuestion.kind==="ordering" ? " → " : ", ") ?? (gameState.lastAnswerResult.correctLetter && gameState.currentQuestion.choices[["A", "B", "C", "D"].indexOf(gameState.lastAnswerResult.correctLetter)]) ?? "Not available"}
                   </div>
                 </div>

                 {gameState.lastAnswerResult.explanation&&<p className="max-w-2xl mx-auto text-lg text-white">{gameState.lastAnswerResult.explanation}</p>}
                 {gameState.mode==="odd_one_out"&&gameState.phase==="reveal"&&gameState.oddReview&&(
                   <section aria-label="Explanation bonus review" className="bg-white/10 rounded-2xl p-6 max-w-2xl mx-auto text-left space-y-4">
                     <h3 className="text-xl font-bold">Explanation bonuses · +1 per approved answer</h3>
                     {gameState.oddReview.entries.length===0&&<p>No explanations submitted.</p>}
                     {gameState.oddReview.entries.map(entry=><div key={entry.playerId} className="border-b border-white/20 pb-3 space-y-2">
                       <p className="font-bold">{entry.name} · {entry.correct?"Correct choice":"Wrong choice"}</p>
                       <p className="break-words">{entry.explanation||"No explanation"}</p>
                       <Button size="sm" disabled={!entry.correct||!entry.explanation.trim()||entry.bonusAwarded||gameState.oddReview?.finalized} onClick={()=>emit(WS_EVENTS.AWARD_ODD_BONUS,{roomCode:gameState.roomCode,questionIndex:gameState.oddReview?.questionIndex,playerId:entry.playerId})}>{entry.bonusAwarded?"Bonus approved ✓":"Approve +1"}</Button>
                     </div>)}
                     <Button className="w-full" disabled={gameState.oddReview.finalized} onClick={()=>emit(WS_EVENTS.FINALIZE_ODD_REVIEW,{roomCode:gameState.roomCode,questionIndex:gameState.oddReview?.questionIndex})}>{gameState.oddReview.finalized?"Review finalized":"Finish bonus review"}</Button>
                   </section>
                 )}
                 <div className="bg-white/10 rounded-3xl p-8 max-w-2xl mx-auto backdrop-blur-md">
                   <h3 className="text-2xl font-bold mb-6 flex items-center justify-center">
                     <Trophy className="mr-2 text-yellow-400" /> Leaderboard
                   </h3>
                   <div className="space-y-3">
                     {gameState.leaderboard?.slice(0, 5).map((player: any, i: number) => (
                       <motion.div 
                         key={player.playerId}
                         initial={reducedMotion ? false : { x: -20, opacity: 0 }}
                         animate={{ x: 0, opacity: 1 }}
                         transition={reducedMotion ? {duration: 0} : { delay: i * 0.1 }}
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
                   disabled={gameState.mode==="odd_one_out"&&gameState.phase==="reveal"&&!gameState.oddReview?.finalized}
                 >
                   {gameState.phase === "reveal" ? "Show leaderboard" : "Next / Finish"} <Play className="ml-2 w-5 h-5" />
                 </Button>
               </div>
             )}
          </div>
        )}

        {/* GAME OVER */}
        {gameState.gameStatus === 'ended' && (
           <div className="text-center space-y-8 animate-in zoom-in duration-700">
             <Trophy className="w-32 h-32 text-yellow-400 mx-auto drop-shadow-glow motion-safe:animate-bounce" />
             <h1 className="text-6xl font-black">GAME OVER</h1>
             
             <div className="flex items-end justify-center gap-4 h-64 pb-4">
                {/* 2nd Place */}
                {gameState.leaderboard?.[1] && (
                  <div className="w-24 md:w-32 break-words bg-slate-700 rounded-t-lg h-32 flex flex-col justify-end p-4 items-center">
                    <div className="font-bold text-xl mb-2">{gameState.leaderboard[1].name}</div>
                    <div className="w-8 h-8 rounded-full bg-slate-400 text-slate-900 flex items-center justify-center font-bold">2</div>
                  </div>
                )}
                
                {/* 1st Place */}
                {gameState.leaderboard?.[0] && (
                  <div className="w-24 md:w-32 break-words bg-yellow-500 rounded-t-lg h-48 flex flex-col justify-end p-4 items-center shadow-lg shadow-yellow-500/20 z-10">
                    <div className="font-bold text-2xl mb-2 text-yellow-900">{gameState.leaderboard[0].name}</div>
                    <div className="w-10 h-10 rounded-full bg-yellow-200 text-yellow-900 flex items-center justify-center font-bold text-xl">1</div>
                  </div>
                )}

                {/* 3rd Place */}
                {gameState.leaderboard?.[2] && (
                  <div className="w-24 md:w-32 break-words bg-slate-800 rounded-t-lg h-24 flex flex-col justify-end p-4 items-center">
                    <div className="font-bold text-lg mb-2">{gameState.leaderboard[2].name}</div>
                    <div className="w-8 h-8 rounded-full bg-orange-700 text-orange-100 flex items-center justify-center font-bold">3</div>
                  </div>
                )}
             </div>

             <Button asChild size="lg" variant="outline" className="mt-8 text-black border-white hover:bg-white hover:text-black"><Link href="/">
                 Back to Home
               </Link></Button>
           </div>
        )}
      </div>
    </div>
  );
}
