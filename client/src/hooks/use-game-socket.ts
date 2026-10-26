import { createRecoveringConnection } from "../../../examples/party-engine/public/connection-recovery.js";
import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";
import {
  PROTOCOL_VERSION, serverMessageSchema,
  type PublicPlayer, type PublicQuestion, type AnswerResult, type RoomState, type OddReview,
} from "@shared/game-protocol";

export type GameState = {
  mode?:"classic"|"teams"|"buzzer"|"wager"|"workshop"|"party"|"sprint"|"odd_one_out";
  submissionProgress?:{questionIndex:number;received:number;total:number;connected:number};
  status?:{coins:number;focus:number;guard:number};
  oddReview?:OddReview;
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
type PlayerSession = { roomCode: string; name: string; playerId?: string; token?: string; resumeRequestId?: string };
type HostSession = { roomCode: string; hostToken: string; deckId: number; resumeRequestId?: string };
const wsUrl = () => `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
function safeRead<T>(store: Storage, key: string): T | null {
  try { const text = store.getItem(key); return text ? JSON.parse(text) as T : null; }
  catch { try { store.removeItem(key); } catch {} return null; }
}
function statusFrom(phase: RoomState): GameState["gameStatus"] {
  return phase === "finished" ? "ended" : phase === "lobby" ? "lobby" : "playing";
}

export function useGameSocket(role: "host" | "player" = "player") {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const readyRef = useRef(false);
  const wireRef = useRef<{ matchId?: string; revision?: number }>({});
  const pendingRef = useRef(new Map<string, object>());
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
    const handshake = [WS_EVENTS.CREATE_ROOM, WS_EVENTS.JOIN_ROOM, WS_EVENTS.REJOIN_ROOM, WS_EVENTS.RESUME_HOST].includes(type as any);
    if (!handshake && !readyRef.current) {
      toast({ title: "Reconnecting", description: "Wait for your room to synchronize." }); return;
    }
    if (!handshake && pendingRef.current.size >= 16) {
      toast({ title: "Sending", description: "Wait for the current requests to finish." }); return;
    }
    const requestId = crypto.randomUUID();
    const frame = { v: PROTOCOL_VERSION, type, payload, requestId, ...(!handshake ? wireRef.current : {}) };
    if (!handshake) pendingRef.current.set(requestId, frame);
    socketRef.current.send(JSON.stringify(frame));
  }, [toast]);

  useEffect(() => {
    let playerSession = safeRead<PlayerSession>(localStorage, "trivia_player");
    let hostSession = safeRead<HostSession>(sessionStorage, "trivia_host");
    const retryPending = () => {
      const socket = socketRef.current;
      if (readyRef.current && socket?.readyState === WebSocket.OPEN)
        for (const frame of pendingRef.current.values()) socket.send(JSON.stringify(frame));
    };
    const connection = createRecoveringConnection(wsUrl, {
      onStatus(status) {
        readyRef.current = status === "connected";
        setConnected(readyRef.current);
        if (role === "host" && hostSession && status !== "connected") setRestoring(true);
      },
      onOpen(ws) {
        socketRef.current = ws;
        if (role === "player") {
          const saved = playerSession;
          if (saved?.token && saved.playerId) {
            const requestId = saved.resumeRequestId ?? crypto.randomUUID();
            playerSession = { ...saved, resumeRequestId: requestId };
            try { localStorage.setItem("trivia_player", JSON.stringify(playerSession)); } catch {}
            ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.REJOIN_ROOM, requestId,
              payload: { roomCode: saved.roomCode, playerId: saved.playerId, token: saved.token } }));
          } else if (saved?.name && saved.roomCode) {
            ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.JOIN_ROOM, requestId: crypto.randomUUID(),
              payload: { roomCode: saved.roomCode, playerName: saved.name } }));
          } else connection.ready();
        } else if (hostSession) {
          setRestoring(true);
          const requestId = hostSession.resumeRequestId ?? crypto.randomUUID();
          hostSession = { ...hostSession, resumeRequestId: requestId };
          try { sessionStorage.setItem("trivia_host", JSON.stringify(hostSession)); } catch {}
          ws.send(JSON.stringify({ v: 1, type: WS_EVENTS.RESUME_HOST, requestId,
            payload: { roomCode: hostSession.roomCode, hostToken: hostSession.hostToken } }));
        } else { setRestoring(false); connection.ready(); }
      },
      onMessage(event) {

        let decoded: unknown;
        try { decoded = JSON.parse(event.data); } catch { return; }
        const valid = serverMessageSchema.safeParse(decoded);
        if (!valid.success) { console.error("Invalid server protocol event"); return; }
        const { type, payload, matchId, revision } = valid.data;
        if (matchId !== undefined && revision !== undefined) wireRef.current = { matchId, revision };
        switch (type) {
          case WS_EVENTS.ROOM_CREATED:
          case WS_EVENTS.HOST_RESUMED: {
            const saved = safeRead<HostSession>(sessionStorage, "trivia_host");
            const nextSession = {
              roomCode: payload.roomCode, hostToken: payload.hostToken, deckId: saved?.deckId ?? Number(sessionStorage.getItem("trivia_host_deck_id") ?? 0),
            };
            hostSession = nextSession;
            try { sessionStorage.setItem("trivia_host", JSON.stringify(nextSession)); } catch {}
            if (type === WS_EVENTS.HOST_RESUMED) socketRef.current?.send(JSON.stringify({ v: 1, type: WS_EVENTS.CONFIRM_SESSION, payload: { roomCode: payload.roomCode } }));
            setGameState(prev => ({ ...prev, roomCode: payload.roomCode,
              ...(type === WS_EVENTS.ROOM_CREATED ? { phase: "lobby" as const } : {}),
            }));
            break;
          }
          case WS_EVENTS.ROOM_JOINED: {
            setLastError("");
            const saved = safeRead<PlayerSession>(localStorage, "trivia_player");
            const resumed = !!playerSession?.resumeRequestId;
            const { resumeRequestId: _, ...profile } = saved ?? playerSession ?? { name: "", roomCode: payload.roomCode };
            playerSession = { ...profile, roomCode: payload.roomCode, playerId: payload.playerId, token: payload.token };
            try { localStorage.setItem("trivia_player", JSON.stringify(playerSession)); } catch {}
            if (resumed) socketRef.current?.send(JSON.stringify({ v: 1, type: WS_EVENTS.CONFIRM_SESSION, payload: { roomCode: payload.roomCode } }));
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
          case WS_EVENTS.SUBMISSION_PROGRESS:
            if(role==="host") setGameState(prev=>({...prev,submissionProgress:payload}));
            break;
          case WS_EVENTS.QUESTION_START:
            setGameState(prev => ({
              ...prev, currentQuestion: payload, lastAnswerResult: undefined,
              phase: "playing", gameStatus: "playing", answered:false,submissionProgress:undefined,oddReview:undefined,
              serverStartTs: payload.serverStartTs, timeRemainingMs: payload.timeLimitMs,
            }));
            break;
          case WS_EVENTS.ODD_REVIEW_STATE:
            if(role==="host") setGameState(prev=>({...prev,oddReview:payload}));
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
            readyRef.current = true; connection.ready(); setRestoring(false); setLastError(""); retryPending();
            setGameState(prev => ({
              ...prev, roomCode: payload.roomCode, playerId: payload.playerId ?? prev.playerId,
              players: payload.players, score: payload.score ?? prev.score, answered:payload.answered,
              phase: payload.state, gameStatus: statusFrom(payload.state),
              currentQuestion: payload.question,
              lastAnswerResult: payload.answerResult,
              leaderboard: payload.leaderboard,
              serverStartTs: payload.question?.serverStartTs,
              timeRemainingMs: payload.question?.timeLimitMs,
              mode:payload.mode,status:payload.status,buzzedPlayerId:payload.buzzedPlayerId,submissionProgress:undefined,oddReview:payload.oddReview,
            }));
            break;
          case WS_EVENTS.GAME_OVER:
            setGameState(prev => ({
              ...prev, phase: "finished", gameStatus: "ended",
              leaderboard: payload.leaderboard, players: payload.leaderboard,
            }));
            break;
          case WS_EVENTS.ACTION_ACK:
            pendingRef.current.delete(payload.requestId); break;
          case WS_EVENTS.ERROR:
            setLastError(payload.message);
            if (!/recovery.*(saved|unavailable)|temporarily unavailable/i.test(payload.message)) pendingRef.current.clear();
            if (role === "host" && payload.message === "Invalid host credentials") {
              try { sessionStorage.removeItem("trivia_host"); } catch {}
              hostSession = null; connection.stop(); readyRef.current = false; setConnected(false); setRestoring(false);
            }
            if (role === "player" && payload.message === "Invalid reconnect credentials") {
              try { localStorage.removeItem("trivia_player"); } catch {}
              playerSession = null; connection.stop(); readyRef.current = false; setConnected(false);
            }
            toast({ title: "Game error", description: payload.message, variant: "destructive" });
            break;
        }

      },
      onClose(event, retrying) {
        readyRef.current = false; setConnected(false);
        if (!retrying) { setRestoring(false); pendingRef.current.clear(); setLastError(event.reason || "This session ended. Join again to continue."); }
      },
    });
    const retry = setInterval(retryPending, 2000);
    return () => {
      clearInterval(retry); connection.stop(); readyRef.current = false;
      socketRef.current = null; pendingRef.current.clear();
    };
  }, [role, toast]);

  return { connected, restoring, gameState, emit, lastError };
}
