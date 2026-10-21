import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";

type PlayerSummary = { playerId: string; name: string; score: number; lastPoints: number; connected: boolean };
type Question = {
  questionId: number; prompt: string; choices: string[];
  serverStartTs: number; timeLimitMs: number;
};
type AnswerResult = {
  questionId: number; correctLetter: string; explanation?: string;
  points?: number; correct?: boolean; leaderboard: PlayerSummary[];
};
type GameState = {
  roomCode?: string;
  playerId?: string;
  score?: number;
  players: PlayerSummary[];
  currentQuestion?: Question;
  leaderboard?: PlayerSummary[];
  gameStatus: "lobby" | "playing" | "ended";
  lastAnswerResult?: AnswerResult;
  answeredCurrentQuestion?: boolean;
  timeRemainingMs?: number;
  serverStartTs?: number;
  error?: string;
};
const initialState: GameState = { players: [], gameStatus: "lobby" };
const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
function playerSession(): { roomCode: string; name?: string; playerId?: string; reconnectToken?: string } | null {
  try {
    const raw = localStorage.getItem("trivia_player");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState>(initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;
      ws.onopen = () => {
        if (!active) { ws.close(); return; }
        setConnected(true);
        const stored = playerSession();
        if (stored?.roomCode && stored.playerId && stored.reconnectToken) {
          ws.send(JSON.stringify({
            type: WS_EVENTS.REJOIN_ROOM,
            payload: { roomCode: stored.roomCode, playerId: stored.playerId, reconnectToken: stored.reconnectToken }
          }));
        }
      };
      ws.onclose = () => {
        if (!active) return;
        setConnected(false);
        setGameState(prev => prev.playerId ? prev : {
          ...initialState
        });
        retry = setTimeout(connect, 1500);
      };
      ws.onmessage = event => {
        let message: { type: string; payload?: any };
        try { message = JSON.parse(event.data); }
        catch { return; }
        const payload = message.payload || {};
        switch (message.type) {
          case WS_EVENTS.ROOM_CREATED:
            setGameState(prev => ({ ...prev, roomCode: payload.roomCode, gameStatus: "lobby", error: undefined }));
            break;
          case WS_EVENTS.ROOM_JOINED: {
            const saved = playerSession();
            localStorage.setItem("trivia_player", JSON.stringify({
              roomCode: payload.roomCode, name: saved?.name,
              playerId: payload.playerId, reconnectToken: payload.reconnectToken
            }));
            setGameState(prev => ({ ...prev, roomCode: payload.roomCode, playerId: payload.playerId, error: undefined }));
            break;
          }
          case WS_EVENTS.LOBBY_UPDATE:
            setGameState(prev => ({ ...prev, players: payload.players }));
            break;
          case WS_EVENTS.GAME_STARTED:
            setGameState(prev => ({ ...prev, gameStatus: "playing", error: undefined }));
            break;
          case WS_EVENTS.QUESTION_START:
            setGameState(prev => ({
              ...prev, gameStatus: "playing", currentQuestion: payload,
              lastAnswerResult: undefined, answeredCurrentQuestion: false,
              timeRemainingMs: payload.timeLimitMs, serverStartTs: payload.serverStartTs
            }));
            break;
          case WS_EVENTS.ANSWER_ACCEPTED:
            setGameState(prev => ({ ...prev, answeredCurrentQuestion: true }));
            break;
          case WS_EVENTS.ANSWER_RESULT:
            setGameState(prev => ({
              ...prev, lastAnswerResult: payload, leaderboard: payload.leaderboard,
              answeredCurrentQuestion: true
            }));
            break;
          case WS_EVENTS.SYNC_SNAPSHOT:
            setGameState(prev => ({ ...prev, ...payload, error: undefined }));
            break;
          case WS_EVENTS.GAME_OVER:
            setGameState(prev => ({
              ...prev, gameStatus: "ended", leaderboard: payload.leaderboard
            }));
            break;
          case WS_EVENTS.ERROR:
            if (/session invalid|room is closed|room not found/i.test(payload.message || "")) {
              const session = playerSession();
              if (session) localStorage.setItem("trivia_player", JSON.stringify({
                roomCode: session.roomCode, name: session.name
              }));
              setGameState(prev => ({ ...prev, error: payload.message }));
            }
            toastRef.current({ title: "Game error", description: payload.message, variant: "destructive" });
            break;
        }
      };
      ws.onerror = () => {
        toastRef.current({ title: "Connection problem", description: "Trying to reconnect to the game server.", variant: "destructive" });
      };
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, []);

  const emit = useCallback((type: string, payload: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    } else {
      toastRef.current({ title: "Not connected", description: "Please check your connection.", variant: "destructive" });
    }
  }, []);

  return { connected, gameState, emit };
}
