import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useCreateDeck } from "@/hooks/use-decks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewExamDeck() {
  const [, navigate] = useLocation();
  const create = useCreateDeck();
  const [title,setTitle] = useState("");
  const [category,setCategory] = useState("General");
  const [description,setDescription] = useState("");
  const [error,setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {setError("A deck title is required.");return;}
    setError("");
    try {
      const deck = await create.mutateAsync({
        title:title.trim(),category:category.trim()||"General",description:description.trim(),
      });
      navigate(`/exam-builder/${deck.id}`);
    } catch(err) {setError(err instanceof Error?err.message:"Could not create deck");}
  }
  return <main className="min-h-screen bg-muted/30 p-4 md:p-8">
    <section className="max-w-xl mx-auto space-y-6">
      <Button asChild variant="ghost"><Link href="/">Back to library</Link></Button>
      <h1 className="text-3xl font-bold">New Visual Exam Deck</h1>
      <p className="text-sm text-amber-800 bg-amber-50 rounded p-3">
        Decks are currently public until accounts and ownership are implemented.
        Do not enter private exam or student information.
      </p>
      <Card><CardHeader><CardTitle>Deck details</CardTitle></CardHeader>
        <CardContent><form onSubmit={e=>void submit(e)} className="space-y-4">
          <div><Label htmlFor="exam-title">Title</Label>
            <Input id="exam-title" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Anatomy diagrams"/></div>
          <div><Label htmlFor="exam-category">Course / category</Label>
            <Input id="exam-category" maxLength={120} value={category} onChange={e=>setCategory(e.target.value)}/></div>
          <div><Label htmlFor="exam-description">Description (optional)</Label>
            <Textarea id="exam-description" maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></div>
          {error&&<p role="alert" className="text-destructive">{error}</p>}
          <Button type="submit" disabled={create.isPending}>{create.isPending?"Creating…":"Create deck and open builder"}</Button>
        </form></CardContent>
      </Card>
    </section>
  </main>;
}
