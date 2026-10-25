import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Download } from "lucide-react";

type Source = { id: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string;
  importStatus: string; folder: string; course: string; tags: string[]; createdAt: string };
type DraftCard = { front: string; back: string; type: "flashcard" | "multiple_choice";
  options: string[]; correctOption: string | null; sourceRef?: string };
type Preview = { cards: DraftCard[]; support: string };
async function jsonRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "same-origin", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || ("Request failed (" + res.status + ")"));
  return data;
}
export default function Library() {
  const [, navigate] = useLocation();
  const [files, setFiles] = useState<Source[]>([]);
  const [selected, setSelected] = useState<Source | null>(null);
  const [cards, setCards] = useState<DraftCard[]>([]);
  const [support, setSupport] = useState("");
  const [folder, setFolder] = useState("Unfiled");
  const [course, setCourse] = useState("");
  const [tags, setTags] = useState("");
  const [title, setTitle] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh(search = q) {
    try { setFiles(await jsonRequest("/api/library/files?q=" + encodeURIComponent(search))); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load files"); }
  }
  useEffect(() => { void refresh(""); }, []);
  async function choose(source: Source) {
    setSelected(source); setTitle(source.originalName.replace(/\.[^.]+$/, ""));
    setFolder(source.folder); setCourse(source.course||""); setTags(source.tags.join(", ")); setCards([]); setSupport(""); setError("");
    try {
      const result: Preview = await jsonRequest("/api/library/files/" + source.id + "/preview");
      setCards(result.cards); setSupport(result.support);
    } catch (e) { setError(e instanceof Error ? e.message : "Cannot preview file"); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("8 MB maximum source size"); return; }
    setBusy(true); setError("");
    try {
      const source: Source = await jsonRequest("/api/library/files", {
        method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      await refresh();
      await choose(source);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  function edit(index: number, key: "front" | "back", value: string) {
    setCards(prev => prev.map((card, i) => i === index ? { ...card, [key]: value } : card));
  }
  async function createDeck() {
    if (!selected || !title.trim() || !cards.length) return;
    setBusy(true); setError("");
    try {
      const result = await jsonRequest("/api/library/files/" + selected.id + "/decks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deck: { title, description: "Imported from " + selected.originalName, category: folder },
          cards: cards.map(({ sourceRef: _ref, ...card }) => card),
        }),
      });
      navigate("/study/" + result.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }
  async function saveMetadata() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const result: Source = await jsonRequest("/api/library/files/" + selected.id, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, course, tags: tags.split(",").map(s => s.trim()).filter(Boolean) }),
      });
      setSelected(result); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function remove(source: Source) {
    if (!window.confirm("Permanently delete original " + source.originalName + "? Saved decks will remain.")) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/library/files/" + source.id, { method: "DELETE" });
      if (!res.ok) throw new Error("Deletion failed");
      if (selected?.id === source.id) setSelected(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Deletion failed"); }
    finally { setBusy(false); }
  }
  return <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <h1 className="text-3xl font-bold">Private source library</h1>
      <Button asChild variant="outline"><Link href="/decks">Back to decks</Link></Button>
      <Button disabled={!selected||busy} variant="outline" onClick={async()=>{if(!selected)return;setBusy(true);try{await jsonRequest(`/api/library/files/${selected.id}/study-source`,{method:"POST"});navigate("/learning/sources");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Use selected document for source-backed drafts</Button>
    </div>
    <p className="text-sm text-muted-foreground">
      Originals are retained in private server storage and linked to approved decks. Files must be 8 MB or smaller.
      Search saved text from PDF, DOCX, PPTX and text files. Review suggested pairs before saving. Basic two-field legacy Anki packages and QTI 2.1 single-choice/short-answer items are supported; scanned PDFs and complex packages need manual review.
    </p>
    {error && <p role="alert" className="text-destructive bg-destructive/10 p-3 rounded">{error}</p>}
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Original documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="course">Course</Label><Input id="course" value={course} onChange={e=>setCourse(e.target.value)} maxLength={100}/>
          <Label htmlFor="source-upload">Upload original (private)</Label>
          <Input id="source-upload" type="file" disabled={busy}
            accept=".csv,.tsv,.json,.txt,.md,.pdf,.docx,.pptx,.apkg,.qti,.h5p,.png,.jpg,.jpeg,.webp"
            onChange={e => void upload(e.target.files?.[0])} />
          <Input aria-label="Find a source" placeholder="Search names, courses, tags and document contents" value={q} onChange={e => { setQ(e.target.value); void refresh(e.target.value); }} />
          <ul className="space-y-2">
            {files.map(source => <li key={source.id} className="border rounded-lg p-3 flex gap-2 justify-between items-start">
              <button type="button" onClick={() => void choose(source)} className="text-left min-w-0 flex-1">
                <strong className="break-all">{source.originalName}</strong>
                <div className="text-xs text-muted-foreground">{source.folder} · {Math.ceil(source.sizeBytes / 1024)} KB · {source.importStatus}</div>
              </button>
              <Button size="icon" variant="outline" disabled={busy} aria-label={"Delete " + source.originalName} onClick={() => void remove(source)}><Trash2 className="w-4 h-4" /></Button>
            </li>)}
            {files.length === 0 && <li className="text-muted-foreground text-sm">No saved sources found.</li>}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{selected ? selected.originalName : "Select a source to preview"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {selected && <>
            <a href={"/api/library/files/" + selected.id + "/original"} className="underline inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download untouched original</a>
            <div className="space-y-1"><Label>Folder or course</Label><Input value={folder} onChange={e => setFolder(e.target.value)} /></div>
            <div className="space-y-1"><Label>Tags (comma separated)</Label><Input value={tags} onChange={e => setTags(e.target.value)} /></div>
            <Button variant="outline" disabled={busy} onClick={() => void saveMetadata()}>Save organization</Button>
            <hr />
            <p className="text-sm text-muted-foreground">
              {support === "manual-only" ? "No verified automatic conversion. Add and review cards manually below." :
                "Review and edit all suggested question-answer pairs before saving. Line references are hints, not verified citations."}
            </p>
            <Label>New linked deck title</Label><Input value={title} onChange={e => setTitle(e.target.value)} />
            <div className="max-h-[400px] overflow-auto space-y-3">
              {cards.map((card, index) => <div className="border rounded p-3 space-y-2" key={index}>
                <p className="text-xs text-muted-foreground">Card {index + 1} {card.sourceRef || ""}</p>
                <Textarea aria-label={"Question " + (index + 1)} value={card.front} onChange={e => edit(index, "front", e.target.value)} />
                <Textarea aria-label={"Answer " + (index + 1)} value={card.back} onChange={e => edit(index, "back", e.target.value)} />
                {card.options?.length > 0 && <p className="text-xs">Choices: {card.options.join(" | ")}</p>}
                <Button variant="ghost" size="sm" onClick={() => setCards(cs => cs.filter((_, i) => i !== index))}>Remove question</Button>
              </div>)}
            </div>
            <Button variant="outline" onClick={() => setCards(cs => [...cs, { front: "", back: "", type: "flashcard", options: [], correctOption: null }])}>Add question manually</Button>
            <Button className="w-full" disabled={busy || !title.trim() || !cards.length || cards.some(c => !c.front.trim() || !c.back.trim())}
              onClick={() => void createDeck()}>Approve & save {cards.length} cards as linked deck</Button>
          </>}
        </CardContent>
      </Card>
    </div>
  </main>;
}
