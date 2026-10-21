import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";

export type LeaderboardEntry = { playerId: string; name: string; score: number; lastPoints: number };
type QuestionPayload = {
  prompt: string;
  choices: string[];
  roundId: number;
  timeLimitMs: number;
  serverStartTs: number;
};
type GameState = {
  roomCode?: string;
  playerId?: string;
  players: { playerId: string; name: string; score: number; connected: boolean }[];
  currentQuestion?: QuestionPayload;
  leaderboard?: LeaderboardEntry[];
  gameStatus: "lobby" | "playing" | "ended";
  lastAnswerResult?: { correctLetter: string; leaderboard: LeaderboardEntry[] };
  timeRemainingMs?: number;
  serverStartTs?: number;
};
export type SavedPlayerSession = {
  roomCode: string;
  name: string;
  playerId?: string;
  resumeToken?: string;
};
const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
const INITIAL_STATE: GameState = { players: [], gameStatus: "lobby" };

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const handleServerMessage = useCallback((message: { type: string; payload?: any }) => {
    const payload = message.payload ?? {};
    switch (message.type) {
      case WS_EVENTS.ROOM_CREATED:
        sessionStorage.setItem("trivia_host_room", payload.roomCode);
        setGameState(previous => ({ ...previous, roomCode: payload.roomCode, gameStatus: "lobby" }));
        break;
      case WS_EVENTS.ROOM_JOINED: {
        const existing = localStorage.getItem("trivia_player");
        const name = payload.name || (existing ? JSON.parse(existing).name : "");
        localStorage.setItem("trivia_player", JSON.stringify({
          roomCode: payload.roomCode, playerId: payload.playerId,
          resumeToken: payload.resumeToken, name,
        } satisfies SavedPlayerSession));
        setGameState(previous => ({ ...previous, roomCode: payload.roomCode, playerId: payload.playerId }));
        break;
      }
      case WS_EVENTS.LOBBY_UPDATE:
        setGameState(previous => ({ ...previous, players: payload.players || [] }));
        break;
      case WS_EVENTS.GAME_STARTED:
        setGameState(previous => ({ ...previous, gameStatus: "playing" }));
        break;
      case WS_EVENTS.QUESTION_START:
        setGameState(previous => ({
          ...previous,
          gameStatus: "playing",
          currentQuestion: payload,
          lastAnswerResult: undefined,
          timeRemainingMs: payload.timeLimitMs,
          serverStartTs: payload.serverStartTs,
        }));
        break;
      case WS_EVENTS.ANSWER_RESULT:
        setGameState(previous => ({ ...previous, lastAnswerResult: payload, leaderboard: payload.leaderboard }));
        break;
      case WS_EVENTS.SYNC_SNAPSHOT:
        setGameState(previous => ({
          ...previous, ...payload,
          timeRemainingMs: payload.currentQuestion?.timeLimitMs,
          serverStartTs: payload.currentQuestion?.serverStartTs,
        }));
        break;
      case WS_EVENTS.GAME_OVER:
        setGameState(previous => ({ ...previous, gameStatus: "ended", leaderboard: payload.leaderboard || [] }));
        sessionStorage.removeItem("trivia_host_room");
        break;
      case WS_EVENTS.ERROR:
        if (payload.message === "Room has expired") {
          sessionStorage.removeItem("trivia_host_room");
          setGameState(INITIAL_STATE);
        }
        toast({ title: "Game error", description: String(payload.message || "Unknown game error"), variant: "destructive" });
        break;
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const connect = () => {
      if (!active || socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;
      ws.onopen = () => {
        if (!active) { ws.close(); return; }
        attempt = 0;
        setConnected(true);
        const hostRoom = sessionStorage.getItem("trivia_host_room");
        if (hostRoom && window.location.pathname.startsWith("/host/")) {
          ws.send(JSON.stringify({ type: WS_EVENTS.REJOIN_ROOM, payload: { roomCode: hostRoom, role: "host" } }));
          return;
        }
        if (window.location.pathname === "/play") {
          const saved = localStorage.getItem("trivia_player");
          if (saved) {
            try {
              const player = JSON.parse(saved) as SavedPlayerSession;
              if (player.playerId && player.resumeToken && player.roomCode) {
                ws.send(JSON.stringify({ type: WS_EVENTS.REJOIN_ROOM, payload: {
                  role: "player", roomCode: player.roomCode, playerId: player.playerId, resumeToken: player.resumeToken,
                } }));
              }
            } catch { localStorage.removeItem("trivia_player"); }
          }
        }
      };
      ws.onmessage = event => {
        try { handleServerMessage(JSON.parse(event.data)); }
        catch { console.warn("Invalid game-server response"); }
      };
      ws.onclose = () => {
        if (socketRef.current === ws) socketRef.current = null;
        if (!active) return;
        setConnected(false);
        const wait = Math.min(1000 * Math.pow(2, Math.min(attempt++, 4)), 15000);
        reconnectTimer = setTimeout(connect, wait);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [handleServerMessage]);

  const emit = useCallback((type: string, payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    } else {
      toast({ title: "Connection error", description: "Waiting for the game server.", variant: "destructive" });
    }
  }, [toast]);

  return { connected, gameState, emit };
}
