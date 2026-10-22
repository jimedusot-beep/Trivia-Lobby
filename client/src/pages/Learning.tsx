import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type User = { id: string; email: string };
type CardRow = { id: number; front: string; back: string; dueAt: string | null; needsWork: boolean };
type DeckStat = { deckId: number; title: string; subject: string; total: number; learned: number; due: number; mastered: number; attempts: number; correct: number; accuracy: number | null };
type SubjectProgress = { subject: string; attempts: number; accuracy: number; weakCards: number; improvementPoints: number | null };
type Dashboard = { visual:{attempts:number;correct:number;due:number}; attempts: number; correct: number; accuracy: number; sessions: number; studyDays: number; subjectProgress: SubjectProgress[]; dueReviews: number; studyStreak: number; xp: number; achievements: string[]; decks: DeckStat[]; historyLimited: boolean };
type WrongEvent = { id: string; cardId: number; deckId: number; front: string; subject: string; reviewedAt: string; rating: number };
const api = async <T,>(url: string, method = "GET", body?: unknown): Promise<T> => {
  const response = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
};

function AccountGate({ onReady }: { onReady: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const user = await api<User>(`/api/auth/${register ? "register" : "login"}`, "POST", { email, password });
      setPassword(""); onReady(user);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return <Card className="max-w-md mx-auto mt-16"><CardHeader><CardTitle>Save your learning across devices</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Sign in to your private library to save reviews.</p>
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="study-email" className="block font-medium mb-1">Email</label>
          <Input id="study-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label htmlFor="study-password" className="block font-medium mb-1">Password (12 characters minimum)</label>
          <Input id="study-password" type="password" required minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : register ? "Create study account" : "Sign in"}</Button>
      </form>
      <Button variant="ghost" className="w-full" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already have an account? Sign in" : "Need an account? Register"}</Button>
    </CardContent>
  </Card>;
}

export function useStudyUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<User>("/api/auth/me").then(x => { if (active) setUser(x); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { user, setUser, loading };
}

export default function Learning() {
  const { user, setUser, loading } = useStudyUser();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [wrong, setWrong] = useState<WrongEvent[]>([]);
  const [error, setError] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const load = useCallback(async () => {
    try {
      const [summary, history] = await Promise.all([
        api<Dashboard>("/api/study/dashboard"),
        api<{ wrongAnswers: WrongEvent[] }>("/api/study/history"),
      ]);
      setDashboard(summary); setWrong(history.wrongAnswers); setError("");
    } catch (err) { setError((err as Error).message); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  if (loading) return <main className="p-8" role="status">Loading account...</main>;
  if (!user) return <main className="p-4"><Link href="/">← Library</Link><AccountGate onReady={setUser} /></main>;
  const subjects = Array.from(new Set(wrong.map(x => x.subject || "General"))).sort();
  const filtered = wrong.filter(x => subjectFilter === "all" || (x.subject || "General") === subjectFilter);
  const unique = filtered.filter((x, i, all) => all.findIndex(y => y.cardId === x.cardId) === i);
  return <main className="min-h-screen bg-muted/20 p-4 md:p-8">
    <div className="max-w-5xl mx-auto space-y-7">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div><Link href="/" className="underline">← Library</Link><h1 className="text-3xl font-bold mt-2">My learning</h1><p className="text-muted-foreground">{user.email}</p></div>
        <div className="flex gap-2 flex-wrap"><Button asChild variant="outline"><Link href="/learning/sources">Source drafts</Link></Button>
          <Button variant="outline" onClick={() => { window.location.href = "/api/study/export"; }}>Export progress</Button>
          <Button variant="outline" onClick={async () => { await api("/api/auth/logout", "POST"); setUser(null); setDashboard(null); }}>Sign out</Button></div>
      </header>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {dashboard && <>
        <p className="p-4 border rounded">Visual exams: {dashboard.visual.attempts} attempts · {dashboard.visual.correct} correct · {dashboard.visual.due} due reviews. Open a deck’s Visual Exam for adaptive practice.</p>
        <section aria-label="Learning statistics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([["Due reviews", dashboard.dueReviews], ["Self-rated recall", `${dashboard.accuracy}%`], ["Attempts", dashboard.attempts], ["Study sessions", dashboard.sessions]] as const).map(([label, value]) =>
            <Card key={label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold">{value}</p></CardContent></Card>)}
        </section>
        <p className="text-sm text-muted-foreground">Study days: {dashboard.studyDays}. Optional milestones: {dashboard.xp} practice XP · {dashboard.studyStreak} day current streak. A break never removes achievements. XP is not a multiplayer score.</p>
        <p className="text-sm">Achievements: {dashboard.achievements.length ? dashboard.achievements.join(" · ") : "Your first review is waiting."}</p>
        {dashboard.historyLimited && <p role="note">Analytics shows your most recent 10,000 reviews. Export includes all events.</p>}
        <section className="space-y-3" aria-label="Subject improvement">
          <h2 className="text-2xl font-bold">Weak subjects and improvement</h2>
          <p className="text-sm text-muted-foreground">Improvement compares self-rated recall success in the latest 10 attempts with the previous 10 for the same subject. A change is shown only when both windows contain reviews.</p>
          {!dashboard.subjectProgress.length ? <p>Study cards to see subject trends.</p> :
            <div className="grid md:grid-cols-2 gap-3">{dashboard.subjectProgress.map(subject =>
              <Card key={subject.subject}><CardContent className="p-4 space-y-1">
                <h3 className="font-bold">{subject.subject}</h3>
                <p>{subject.accuracy}% self-rated recall across {subject.attempts} attempts</p>
                <p className="text-sm text-muted-foreground">{subject.weakCards} unresolved weak cards</p>
                <p className="text-sm">{subject.improvementPoints === null ? "Not enough reviews to compare yet" : `${subject.improvementPoints > 0 ? "+" : ""}${subject.improvementPoints} percentage points in recent recall`}</p>
              </CardContent></Card>)}</div>}
        </section>
        <section className="space-y-3"><h2 className="text-2xl font-bold">Course pathways</h2>
          <p className="text-muted-foreground">Explore cards → build recall → reach long-term mastery (21+ day intervals). Study at your own pace.</p>
          <div className="grid md:grid-cols-2 gap-4">{dashboard.decks.map(deck =>
            <Card key={deck.deckId}><CardHeader><CardTitle>{deck.title}</CardTitle><p className="text-sm text-muted-foreground">{deck.subject}</p></CardHeader>
              <CardContent className="space-y-3">
                <Progress aria-label={`${deck.title} learned cards`} value={deck.total ? 100 * deck.learned / deck.total : 0} />
                <p className="text-sm">{deck.learned}/{deck.total} started · {deck.mastered} mastered · {deck.due} due · {deck.accuracy === null ? "No attempts" : `${deck.accuracy}% self-rated recall`}</p>
                <ol className="text-sm space-y-1" aria-label={`${deck.title} milestones`}>
                  <li>{deck.learned > 0 ? "✓" : "○"} Explore: start reviewing your first card</li>
                  <li>{deck.total > 0 && deck.learned === deck.total ? "✓" : "○"} Cover: review every card at least once</li>
                  <li>{deck.total > 0 && deck.mastered >= Math.ceil(0.8 * deck.total) ? "✓" : "○"} Retain: achieve 21-day intervals for 80% of cards</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button asChild><Link href={`/learning/review/${deck.deckId}?mode=due`}>Review due</Link></Button>
                  <Button asChild variant="outline"><Link href={`/learning/review/${deck.deckId}?mode=missed`}>Retry weak cards</Link></Button>
                  <Button asChild variant="outline"><Link href={`/learning/review/${deck.deckId}?mode=all`}>Study all</Link></Button>
                </div>
              </CardContent></Card>)}</div>
        </section>
      </>}
      <section className="space-y-4"><h2 className="text-2xl font-bold">Wrong-answer notebook</h2>
        <label htmlFor="subject-filter">Filter subject</label>
        <select id="subject-filter" className="border rounded p-2 block bg-background" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
          <option value="all">All subjects</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {!unique.length ? <p className="text-muted-foreground">No unresolved weak cards in this subject.</p> :
          <ul className="space-y-2">{unique.slice(0, 100).map(item =>
            <li key={item.cardId} className="p-3 rounded border bg-card flex justify-between gap-3 items-center">
              <div><strong>{item.front}</strong><p className="text-sm text-muted-foreground">{item.subject} · Missed {new Date(item.reviewedAt).toLocaleDateString()}</p></div>
              <Button asChild variant="outline"><Link href={`/learning/review/${item.deckId}?mode=missed`}>Retry</Link></Button>
            </li>)}</ul>}
      </section>
    </div>
  </main>;
}

export function AdaptiveReview() {
  const { deckId } = useParams<{ deckId: string }>();
  const { user, setUser, loading } = useStudyUser();
  const mode = new URLSearchParams(window.location.search).get("mode");
  const validMode = mode === "all" || mode === "missed" ? mode : "due";
  const [queueLoading,setQueueLoading] = useState(true);
  const [queue, setQueue] = useState<CardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!user) return;
    let active = true;setQueueLoading(true);
    api<{ cards: CardRow[]; totalMatching: number }>(`/api/study/queue?deckId=${encodeURIComponent(deckId)}&mode=${validMode}`)
      .then(result => { if (active) { setQueue(result.cards); setTotal(result.totalMatching); setIndex(0); setShown(false); } })
      .catch(err => { if (active) setError(err.message); }).finally(()=>{if(active)setQueueLoading(false);});
    return () => { active = false; };
  }, [user, deckId, validMode]);
  const card = queue[index];
  const rate = async (rating: number) => {
    if (!card || !shown || busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/study/review", "POST", { cardId: card.id, rating, requestId });
      setRequestId(crypto.randomUUID()); setShown(false); setIndex(n => n + 1);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  if (loading) return <main className="p-8">Loading...</main>;
  if (!user) return <main className="p-4"><Link href="/learning">← My learning</Link><AccountGate onReady={setUser} /></main>;
  return <main className="min-h-screen bg-muted/20 p-4 md:p-8">
    <div className="max-w-xl mx-auto space-y-6">
      <Link href="/learning" className="underline">← My learning</Link>
      <h1 className="text-3xl font-bold">Adaptive review</h1>
      <p className="text-muted-foreground">Due queue · {validMode} · Card {Math.min(index + 1, queue.length)} of {queue.length}{total > 100 ? " (first 100)" : ""}</p>
      <Progress value={queue.length ? 100 * index / queue.length : 100} aria-label="Review progress" />
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {queueLoading?<p role="status">Loading saved review queue…</p>:!card ? <Card><CardContent className="p-8 text-center space-y-3"><h2 className="text-2xl font-bold">Queue complete</h2>
        <p>Reviews are saved. Come back when cards are due, including from another device.</p><Button asChild><Link href="/learning">View dashboard</Link></Button></CardContent></Card> :
        <Card><CardHeader><CardTitle><h2 className="text-2xl">{card.front}</h2></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!shown ? <Button className="w-full" onClick={() => setShown(true)}>Reveal answer</Button> :
              <><div aria-live="polite" className="p-4 rounded bg-muted"><strong>Answer</strong><p className="mt-2 whitespace-pre-wrap">{card.back}</p></div>
                <p className="text-sm text-muted-foreground">How well did you recall it? Your rating adjusts the next review.</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["Again", 1], ["Hard", 2], ["Good", 3], ["Easy", 4]] as const).map(([label, value]) =>
                    <Button key={value} variant={value <= 2 ? "outline" : "default"} disabled={busy} onClick={() => void rate(value)}>{label}</Button>)}
                </div></>}
          </CardContent></Card>}
    </div>
  </main>;
}
