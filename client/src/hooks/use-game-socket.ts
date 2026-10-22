import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";
import {
  PROTOCOL_VERSION, serverMessageSchema,
  type PublicPlayer, type PublicQuestion, type AnswerResult, type RoomState,
} from "@shared/game-protocol";

export type GameState = {
  mode?:"classic"|"teams"|"buzzer"|"wager"|"workshop"|"party";
  status?:{coins:number;focus:number;guard:number};
  buzzedPlayerId?:string|null;
  answered?:boolean;
  roomCode?: string;
  playerId?: string;
  score?: number;
  players: PublicPlayer[];
  currentQuestion?: PublicQuestion;
  leaderboard?: PublicPlayer[];
  gameStatus: "lobby" | "playing" | "ended";
  phase: RoomState;
  lastAnswerResult?: AnswerResult;
  timeRemainingMs?: number;
  serverStartTs?: number;
};
type PlayerSession = { roomCode: string; name: string; playerId?: string; token?: string };
type HostSession = { roomCode: string; hostToken: string; deckId: number };
const wsUrl = () => `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
function safeRead<T>(store: Storage, key: string): T | null {
  try { const text = store.getItem(key); return text ? JSON.parse(text) as T : null; }
  catch { store.removeItem(key); return null; }
}
function statusFrom(phase: RoomState): GameState["gameStatus"] {
  return phase === "finished" ? "ended" : phase === "lobby" ? "lobby" : "playing";
}

export function useGameSocket(role: "host" | "player" = "player") {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastError,setLastError]=useState("");
  const [restoring, setRestoring] = useState(
    () => role === "host" && !!safeRead<HostSession>(sessionStorage, "trivia_host"),
  );
  const [gameState, setGameState] = useState<GameState>({
    players: [], phase: "lobby", gameStatus: "lobby",
  });

  const emit = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      toast({ title: "Connection Error", description: "Not connected", variant: "destructive" });
      return;
    }
    socketRef.current.send(JSON.stringify({ v: PROTOCOL_VERSION, type, payload }));
  }, [toast]);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl());
      socketRef.current = ws;
      ws.onopen = () => {
        if (disposed) return;
        setConnected(true);
        if (role === "player") {
          const saved = safeRead<PlayerSession>(localStorage, "trivia_player");
          if (saved?.token && saved.playerId) {
            ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.REJOIN_ROOM,
              payload: { roomCode: saved.roomCode, playerId: saved.playerId, token: saved.token } }));
          } else if (saved?.name && saved.roomCode) {
            ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.JOIN_ROOM,
              payload: { roomCode: saved.roomCode, playerName: saved.name } }));
          }
        } else {
          const saved = safeRead<HostSession>(sessionStorage, "trivia_host");
          if (saved) {
            setRestoring(true);
            ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.RESUME_HOST,
              payload: { roomCode: saved.roomCode, hostToken: saved.hostToken } }));
          } else setRestoring(false);
        }
      };
      ws.onmessage = (event) => {
        let decoded: unknown;
        try { decoded = JSON.parse(event.data); } catch { return; }
        const valid = serverMessageSchema.safeParse(decoded);
        if (!valid.success) { console.error("Invalid server protocol event"); return; }
        const { type, payload } = valid.data;
        switch (type) {
          case WS_EVENTS.ROOM_CREATED:
          case WS_EVENTS.HOST_RESUMED: {
            const saved = safeRead<HostSession>(sessionStorage, "trivia_host");
            sessionStorage.setItem("trivia_host", JSON.stringify({
              roomCode: payload.roomCode, hostToken: payload.hostToken, deckId: saved?.deckId ?? Number(sessionStorage.getItem("trivia_host_deck_id") ?? 0),
            }));
            setRestoring(false);
            setGameState(prev => ({ ...prev, roomCode: payload.roomCode, phase: "lobby" }));
            break;
          }
          case WS_EVENTS.ROOM_JOINED: {
            setLastError("");
            const saved = safeRead<PlayerSession>(localStorage, "trivia_player");
            if (saved) localStorage.setItem("trivia_player", JSON.stringify({
              ...saved, playerId: payload.playerId, token: payload.token,
            }));
            setGameState(prev => ({ ...prev, roomCode: payload.roomCode, playerId: payload.playerId }));
            break;
          }
          case WS_EVENTS.LOBBY_UPDATE:
            setGameState(prev => ({ ...prev, players: payload.players }));
            break;
          case WS_EVENTS.GAME_STARTED:
            setGameState(prev => ({ ...prev, gameStatus: "playing", phase: "playing" }));
            break;
          case WS_EVENTS.GAME_CONFIGURED:
            setGameState(prev=>({...prev,mode:payload.mode}));break;
          case WS_EVENTS.BUZZ_STATE:
            setGameState(prev=>({...prev,buzzedPlayerId:payload.playerId}));break;
          case WS_EVENTS.PLAYER_STATUS:
            setGameState(prev=>({...prev,status:payload}));break;
          case WS_EVENTS.ANSWER_ACCEPTED:
            setGameState(prev=>({...prev,answered:true}));break;
          case WS_EVENTS.QUESTION_START:
            setGameState(prev => ({
              ...prev, currentQuestion: payload, lastAnswerResult: undefined,
              phase: "playing", gameStatus: "playing", answered:false,
              serverStartTs: payload.serverStartTs, timeRemainingMs: payload.timeLimitMs,
            }));
            break;
          case WS_EVENTS.ANSWER_RESULT:
            setGameState(prev => ({ ...prev, phase: "reveal", lastAnswerResult: payload }));
            break;
          case WS_EVENTS.LEADERBOARD:
            setGameState(prev => ({
              ...prev, phase: "leaderboard", leaderboard: payload.leaderboard,
              players: payload.leaderboard,
            }));
            break;
          case WS_EVENTS.SYNC_SNAPSHOT:
            setGameState(prev => ({
              ...prev, roomCode: payload.roomCode, playerId: payload.playerId ?? prev.playerId,
              players: payload.players, score: payload.score ?? prev.score, answered:payload.answered,
              phase: payload.state, gameStatus: statusFrom(payload.state),
              currentQuestion: payload.question,
              lastAnswerResult: payload.answerResult,
              leaderboard: payload.leaderboard,
              serverStartTs: payload.question?.serverStartTs,
              timeRemainingMs: payload.question?.timeLimitMs,
              mode:payload.mode,status:payload.status,buzzedPlayerId:payload.buzzedPlayerId,
            }));
            break;
          case WS_EVENTS.GAME_OVER:
            setGameState(prev => ({
              ...prev, phase: "finished", gameStatus: "ended",
              leaderboard: payload.leaderboard, players: payload.leaderboard,
            }));
            break;
          case WS_EVENTS.ERROR:
            setLastError(payload.message);
            if (role === "host" && payload.message === "Invalid host credentials") {
              sessionStorage.removeItem("trivia_host");
              setRestoring(false);
            }
            if (role === "player" && payload.message === "Invalid reconnect credentials") {
              localStorage.removeItem("trivia_player");
            }
            toast({ title: "Game error", description: payload.message, variant: "destructive" });
            break;
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) retry = setTimeout(connect, 1200);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [role, toast]);

  return { connected, restoring, gameState, emit, lastError };
}
