import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionState = "loading" | "authenticated" | "locked";
export default function LibraryGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>("loading");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("Unable to check library access.");
        return res.json() as Promise<{ authenticated: boolean }>;
      })
      .then(data => { if (!cancelled) setSession(data.authenticated ? "authenticated" : "locked"); })
      .catch(() => { if (!cancelled) { setSession("locked"); setError("Unable to check library access. Check your connection."); } });
    return () => { cancelled = true; };
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (!password || working) return;
    setWorking(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Could not sign in.");
      setPassword("");
      setSession("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally { setWorking(false); }
  }
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
    finally { window.location.assign("/"); }
  }

  if (session === "loading") {
    return <div className="min-h-screen flex items-center justify-center" role="status">Checking library access...</div>;
  }
  if (session === "locked") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-muted/30 p-5">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Trivia Lobby — Family Library</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Sign in with the family library password. Guests can still join an invited game without signing in.</p>
            <form onSubmit={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="library-password">Family library password</Label>
                <Input id="library-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={1} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={working}>{working ? "Signing in..." : "Open Library"}</Button>
            </form>
            <a href="/join" className="block text-center text-sm underline">Join a family game instead</a>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <>
      <div className="fixed z-40 bottom-4 right-4">
        <Button size="sm" variant="outline" onClick={logout}>Sign out</Button>
      </div>
      {children}
    </>
  );
}
