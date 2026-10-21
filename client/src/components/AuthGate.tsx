import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type User = { id: string; email: string };
export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null).then(u => setUser(u))
      .catch(() => setError("Cannot reach the account service"))
      .finally(() => setLoading(false));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError("");
    try {
      const res = await fetch("/api/auth/" + mode, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ email, password }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.message || "Sign-in failed"); return; }
      window.location.reload();
    } catch { setError("Network error; please retry"); }
    finally { setWorking(false); }
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/");
  }
  if (loading) return <p className="p-8" role="status">Checking your account…</p>;
  if (!user) return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{mode === "login" ? "Sign in to your study library" : "Create your private account"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm">Email
              <Input autoComplete="email" type="email" value={email} required onChange={e => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm">Password (12 characters minimum)
              <Input autoComplete={mode === "register" ? "new-password" : "current-password"} type="password"
                value={password} required minLength={12} onChange={e => setPassword(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            <Button className="w-full" disabled={working} type="submit">{mode === "login" ? "Sign in" : "Create account"}</Button>
          </form>
          <Button variant="ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">You can join a public game without an account. Private decks and files require sign-in.</p>
          <Link href="/join"><Button variant="outline">Join a game</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
  return <>
    <nav className="flex flex-wrap gap-3 items-center justify-end px-4 py-2 border-b bg-background text-sm">
      <Link href="/"><Button size="sm" variant="ghost">Decks</Button></Link>
      <Link href="/library"><Button size="sm" variant="ghost">Source library</Button></Link>
      <span className="text-muted-foreground">{user.email}</span>
      <Button size="sm" variant="outline" onClick={logout}>Sign out</Button>
    </nav>
    {children}
  </>;
}
