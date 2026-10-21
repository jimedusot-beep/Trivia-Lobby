import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function Join() {
  const [, setLocation] = useLocation();
  
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = () => {
    if (!name || !code) return;
    
    setIsJoining(true);
    
    // The server assigns an authenticated resume token once the player joins.
    localStorage.setItem("trivia_player", JSON.stringify({ name: name.trim(), roomCode: code.trim().toUpperCase() }));
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
              placeholder="ABC123"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-lg">Your Name</Label>
            <Input 
              className="h-14 text-center text-xl font-bold bg-muted/50 border-2 focus:border-primary" 
              placeholder="Enter nickname"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
            />
          </div>
          <Button 
            className="w-full h-14 text-xl font-bold rounded-xl shadow-lg shadow-primary/20 btn-bouncy"
            onClick={handleJoin}
            disabled={!name.trim() || code.trim().length !== 6 || isJoining}
          >
            {isJoining ? <Loader2 className="animate-spin" /> : "Enter Game"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
