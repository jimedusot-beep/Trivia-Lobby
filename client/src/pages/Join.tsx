import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Join() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // If we receive a ROOM_JOINED type event or successfully transition to play, we redirect.
  // Actually, better to just redirect to /play immediately and let the socket there handle state.
  // But we need to emit JOIN_ROOM first.

  const handleJoin = () => {
    if (!name || !code) return;
    

    setIsJoining(true);
    
    // Store pending join. Server assigns identity and an unpredictable token.
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
            <Label htmlFor="room-code" className="text-lg">Room Code</Label>
            <Input 
              className="h-14 text-center text-2xl font-mono uppercase tracking-widest bg-muted/50 border-2 focus:border-primary" 
              id="room-code" placeholder="ABC234"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-name" className="text-lg">Your Name</Label>
            <Input 
              className="h-14 text-center text-xl font-bold bg-muted/50 border-2 focus:border-primary" 
              id="player-name" placeholder="Enter nickname"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
            />
          </div>
          <Button 
            className="w-full h-14 text-xl font-bold rounded-xl shadow-lg shadow-primary/20 btn-bouncy"
            onClick={handleJoin}
            disabled={!name.trim() || !/^[A-HJ-NP-Z2-9]{6}$/.test(code) || isJoining}
          >
            {isJoining ? <Loader2 className="animate-spin" /> : "Enter Game"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
