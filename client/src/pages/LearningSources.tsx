import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useStudyUser } from "./Learning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Source = { id: string; title: string; body: string };
type Draft = { id: string; sourceId: string; front: string; back: string; evidence: string; approved: boolean };
const request = async <T,>(url: string, method = "GET", body?: unknown): Promise<T> => {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
};

export default function LearningSources() {
  const { user, loading } = useStudyUser();
  const [sources, setSources] = useState<Source[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [sources, drafts] = await Promise.all([request<Source[]>("/api/study/sources"), request<Draft[]>("/api/study/drafts")]);
      setSources(sources); setDrafts(drafts);
    } catch (err) { setError((err as Error).message); }
  }, []);
  useEffect(() => { if (user) void refresh(); }, [user, refresh]);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/study/sources", "POST", { title, body });
      setTitle(""); setBody(""); setNotice("Source saved privately.");
      await refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const generate = async (sourceId: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<{ drafts: Draft[]; skipped: number }>("/api/study/drafts/generate", "POST", { sourceId });
      setNotice(`${result.drafts.length} new drafts saved for approval; ${result.skipped} unsupported or duplicate suggestions skipped.`);
      await refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const update = async (draft: Draft) => {
    setBusy(true); setError("");
    try {
      await request(`/api/study/drafts/${draft.id}`, "PATCH", { front: draft.front, back: draft.back, approved: !draft.approved });
      await refresh(); setNotice(draft.approved ? "Draft returned to pending." : "Draft approved privately.");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-muted/20 p-4 md:p-8"><div className="max-w-4xl mx-auto space-y-6">
    <Link href="/learning" className="underline">← My learning</Link>
    <h1 className="text-3xl font-bold">Source-backed study drafts</h1>
    <p className="text-muted-foreground">Save your own text; optionally ask an administrator-configured AI provider to suggest cards. A draft must cite an exact excerpt. Nothing is published automatically, and you can edit every suggestion.</p>
    {loading ? <p>Checking your account...</p> : !user ? <p role="alert">Sign in from <Link href="/learning" className="underline">My learning</Link> to save private sources.</p> : <>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <Card><CardHeader><CardTitle>Add private source text</CardTitle></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={create}>
          <div><label htmlFor="source-title">Source title</label><Input id="source-title" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><label htmlFor="source-text">Source text (80–20,000 characters)</label><Textarea id="source-text" required minLength={80} maxLength={20000} rows={7} value={body} onChange={e => setBody(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>Save source</Button>
        </form>
      </CardContent></Card>
      <section><h2 className="text-2xl font-bold mb-3">My sources</h2><div className="space-y-3">
        {sources.length === 0 ? <p>No sources yet.</p> : sources.map(s => <Card key={s.id}><CardContent className="p-4 flex gap-3 justify-between items-center">
          <div><strong>{s.title}</strong><p className="text-sm text-muted-foreground">{s.body.length} characters saved</p></div>
          <Button disabled={busy} onClick={() => void generate(s.id)}>Suggest cards</Button>
        </CardContent></Card>)}
      </div></section>
      <section className="space-y-3"><h2 className="text-2xl font-bold">Suggested cards — human review</h2>
        {drafts.length === 0 ? <p>No AI draft suggestions yet. AI is optional and may not be configured.</p> : drafts.map(d =>
          <Card key={d.id}><CardContent className="p-4 space-y-3">
            <label htmlFor={`front-${d.id}`}>Question</label>
            <Input id={`front-${d.id}`} value={d.front} maxLength={400} onChange={e => setDrafts(v => v.map(x => x.id === d.id ? { ...x, front: e.target.value } : x))} />
            <label htmlFor={`back-${d.id}`}>Answer</label>
            <Textarea id={`back-${d.id}`} rows={2} maxLength={1000} value={d.back} onChange={e => setDrafts(v => v.map(x => x.id === d.id ? { ...x, back: e.target.value } : x))} />
            <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">Evidence: “{d.evidence}”</blockquote>
            <Button disabled={busy} variant={d.approved ? "outline" : "default"} onClick={() => void update(d)}>{d.approved ? "Return to pending" : "Save edits and approve"}</Button>
            <span className="ml-3 text-sm">{d.approved ? "Approved (private)" : "Not approved"}</span>
          </CardContent></Card>)}
      </section>
    </>}
  </div></main>;
}
