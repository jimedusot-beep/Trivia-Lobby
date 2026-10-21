import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { WS_EVENTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Join() {
  const [, setLocation] = useLocation();
  const { connected, emit } = useGameSocket(); // Just use socket for joining logic
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // If we receive a ROOM_JOINED type event or successfully transition to play, we redirect.
  // Actually, better to just redirect to /play immediately and let the socket there handle state.
  // But we need to emit JOIN_ROOM first.

  const handleJoin = () => {
    if (!name.trim() || !/^[A-HJ-NP-Z2-9]{8}$/.test(code)) return;
    
    if (!connected) {
      toast({ title: "Connecting...", description: "Please wait for server connection." });
      return;
    }

    setIsJoining(true);
    
    // The server alone issues a player ID and a secret reconnect credential.
    localStorage.setItem('trivia_player', JSON.stringify({
      name,
      roomCode: code.toUpperCase()
    }));

    // We can't actually emit here effectively because we're about to navigate.
    // Instead, we navigate to /play, and /play handles the join/rejoin logic on mount.
    setLocation("/play");
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-2xl border-none">
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-4xl font-display font-black text-primary">Join Game</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="space-y-2">
            <Label className="text-lg">Room Code</Label>
            <Input 
              className="h-14 text-center text-2xl font-mono uppercase tracking-widest bg-muted/50 border-2 focus:border-primary" 
              placeholder="8-character code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              aria-describedby="room-code-help"
            />
            <p id="room-code-help" className="text-xs text-muted-foreground">Enter the eight-character code shown by your host.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-lg">Your Name</Label>
            <Input 
              className="h-14 text-center text-xl font-bold bg-muted/50 border-2 focus:border-primary" 
              placeholder="Enter nickname"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
            />
          </div>
          <Button 
            className="w-full h-14 text-xl font-bold rounded-xl shadow-lg shadow-primary/20 btn-bouncy"
            onClick={handleJoin}
            disabled={!name.trim() || !/^[A-HJ-NP-Z2-9]{8}$/.test(code) || isJoining}
          >
            {isJoining ? <Loader2 className="animate-spin" /> : "Enter Game"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
