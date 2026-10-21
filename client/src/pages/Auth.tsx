import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Auth() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch(register ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(response.message || "Authentication failed");
      queryClient.clear(); // Prevent any previous user's private decks remaining in the client cache.
      queryClient.setQueryData(["/api/auth/me"], response);
      setLocation("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">{register ? "Create an account" : "Welcome to Trivia Lobby"}</CardTitle>
          <p className="text-muted-foreground">Sign in to access your private decks and study materials.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" autoComplete="email" required maxLength={254}
                value={email} onChange={event => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" type="password" autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 12 : 1} maxLength={128} required value={password}
                onChange={event => setPassword(event.target.value)} />
              {register && <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>}
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Please wait…" : register ? "Create account" : "Sign in"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => {
              setRegister(!register); setError("");
            }}>
              {register ? "Already have an account? Sign in" : "New here? Create an account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Playing with a room code? <a href="/join" className="underline">Join a game without signing in</a>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
