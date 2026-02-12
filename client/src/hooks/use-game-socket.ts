import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { WS_EVENTS } from "@shared/schema";

type GameState = {
  roomCode?: string;
  players: any[];
  currentQuestion?: any;
  leaderboard?: any[];
  gameStatus: 'lobby' | 'playing' | 'ended';
  lastAnswerResult?: any;
  timeRemainingMs?: number;
  serverStartTs?: number;
};

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

export function useGameSocket() {
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    gameStatus: 'lobby'
  });
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to Game Server");
      setConnected(true);
      
      // Attempt reconnect if we have a session
      const storedPlayer = localStorage.getItem('trivia_player');
      if (storedPlayer) {
        try {
          const { playerId, roomCode } = JSON.parse(storedPlayer);
          if (playerId && roomCode) {
             ws.send(JSON.stringify({ 
               type: WS_EVENTS.REJOIN_ROOM, 
               payload: { roomCode, playerId } 
             }));
          }
        } catch (e) {
          console.error("Invalid stored session", e);
        }
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from Game Server");
      setConnected(false);
      // Simple reconnect logic could go here
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => {
      ws?.close();
    };
  }, [connect]);

  const handleServerMessage = (message: any) => {
    switch (message.type) {
      case WS_EVENTS.ROOM_CREATED:
        setGameState(prev => ({ 
          ...prev, 
          roomCode: message.payload.roomCode,
          gameStatus: 'lobby' 
        }));
        break;

      case WS_EVENTS.LOBBY_UPDATE:
        setGameState(prev => ({ 
          ...prev, 
          players: message.payload.players 
        }));
        break;

      case WS_EVENTS.GAME_STARTED:
        setGameState(prev => ({ ...prev, gameStatus: 'playing' }));
        break;

      case WS_EVENTS.QUESTION_START:
        setGameState(prev => ({
          ...prev,
          currentQuestion: message.payload,
          lastAnswerResult: undefined,
          timeRemainingMs: message.payload.timeLimitMs,
          serverStartTs: message.payload.serverStartTs
        }));
        break;

      case WS_EVENTS.ANSWER_RESULT:
        setGameState(prev => ({
          ...prev,
          lastAnswerResult: message.payload,
          leaderboard: message.payload.leaderboard
        }));
        break;
        
      case WS_EVENTS.SYNC_SNAPSHOT:
        setGameState(prev => ({
          ...prev,
          ...message.payload
        }));
        break;

      case WS_EVENTS.GAME_OVER:
        setGameState(prev => ({ ...prev, gameStatus: 'ended' }));
        break;

      case WS_EVENTS.ERROR:
        toast({
          title: "Error",
          description: message.payload.message,
          variant: "destructive",
        });
        break;
    }
  };

  const emit = (type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn("WebSocket not connected, cannot emit", type);
      toast({ title: "Connection Error", description: "Not connected to server", variant: "destructive" });
    }
  };

  return { connected, gameState, emit };
}
