import { Link } from "wouter";
import { useDecks } from "@/hooks/use-decks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Users, Upload, Gamepad2, PlusCircle, Trash2, ClipboardList, Search, ChartBar } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useDeleteDeck } from "@/hooks/use-decks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const { data: decks, isLoading } = useDecks();
  const deleteDeck = useDeleteDeck();
  const [search, setSearch] = useState("");
  const matchingDecks = (decks ?? []).filter(deck =>
    [deck.title, deck.category, deck.description].some(value =>
      (value ?? "").toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <img src="/lobby-welcome.png" alt="" className="w-full max-h-72 object-cover rounded-3xl" />
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12 md:py-20">
        <h1 className="text-5xl md:text-7xl font-display font-extrabold text-transparent bg-clip-text bg-linear-to-r from-primary via-purple-500 to-secondary animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Trivia Lobby
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
          Family game night meets serious studying. Build reusable decks, practice with flashcards, and host live quiz battles.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 pt-4">
          <Button asChild size="lg" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-1 transition-all"><Link href="/join">
              <Gamepad2 className="mr-3 h-6 w-6" /> Join Game
            </Link></Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl border-2"><Link href="/new-exam">
              <ClipboardList className="mr-3 h-6 w-6" /> New Exam Deck
            </Link></Button>
          <Button asChild size="lg" variant="secondary" className="h-16 px-8 rounded-2xl"><Link href="/learning">Learning & memory</Link></Button>
          <Button asChild size="lg" variant="secondary" className="h-16 px-8 rounded-2xl"><Link href="/library">Private source library</Link></Button>
          <Button asChild size="lg" variant="outline" className="h-16 px-8 rounded-2xl"><Link href="/assignments">Self-paced assignments</Link></Button>
          <Button asChild size="lg" variant="outline" className="h-16 px-8 rounded-2xl"><Link href="/reports"><ChartBar className="mr-2 h-5 w-5"/> Game reports</Link></Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl border-2 hover:bg-secondary/10 hover:border-secondary hover:text-secondary-foreground transition-all"><Link href="/import">
              <PlusCircle className="mr-3 h-6 w-6" /> Create Deck
            </Link></Button>
        </div>
      </div>

      {/* Decks Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold font-display text-foreground">Your Decks</h2>
        </div>

        <div className="relative max-w-xl">
          <Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input aria-label="Search saved decks" placeholder="Search saved decks by name, course or topic" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : matchingDecks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">{search ? "No matching decks" : "No decks yet"}</h3>
            <p className="text-muted-foreground mb-6">{search ? "Try a different search term." : "Import your first deck to get started!"}</p>
            <Button asChild><Link href="/import">Create Deck</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingDecks.map((deck) => (
              <Card key={deck.id} className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300 rounded-3xl overflow-hidden border-2 bg-card">
                <CardHeader className="bg-linear-to-br from-primary/5 to-transparent pb-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-display text-2xl truncate pr-2" title={deck.title}>
                      {deck.title}
                    </CardTitle>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button aria-label={`Delete ${deck.title}`} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive -mr-2 -mt-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete deck?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{deck.title}" and all its cards.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteDeck.mutate(deck.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {deck.description || "No description provided."}
                  </CardDescription>
                  <div className="flex gap-2 mt-2">
                    <span className="px-3 py-1 bg-secondary/20 text-secondary-foreground text-xs font-bold rounded-full uppercase tracking-wider">
                      {deck.category}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-2 gap-3">
                  <Button asChild variant="outline" className="w-full h-12 rounded-xl font-bold border-2 hover:border-primary hover:text-primary hover:bg-primary/5"><Link href={`/learning/review/${deck.id}?mode=due`}>
                      <Brain className="mr-2 h-4 w-4" /> Study
                    </Link></Button>
                  <Button asChild variant="outline" className="w-full h-12 rounded-xl font-bold border-2"><Link href={`/practice/${deck.id}`}>
                      <ClipboardList className="mr-2 h-4 w-4" /> Practice
                    </Link></Button>
                  <Button asChild variant="outline" className="w-full h-12 rounded-xl font-bold border-2"><Link href={`/exam-builder/${deck.id}`}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Exam Builder
                    </Link></Button>
                  <Button asChild variant="outline" className="w-full h-12 rounded-xl font-bold border-2"><Link href={`/visual-practice/${deck.id}`}>
                      <ClipboardList className="mr-2 h-4 w-4" /> Visual Exam
                    </Link></Button>
                  <Button asChild className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"><Link href={`/host/${deck.id}`}>
                      <Users className="mr-2 h-4 w-4" /> Host
                    </Link></Button>
                  <Button asChild variant="outline"><Link href={`/flashcards/${deck.id}`}>Flashcards</Link></Button>
                  <Button asChild variant="outline"><Link href={`/card-editor/${deck.id}`}>Edit saved cards</Link></Button>
                  <a className="underline p-3 text-sm" href={`/api/decks/${deck.id}/backup`}>Download full backup</a>
                  <a className="underline p-3 text-sm" href={`/api/decks/${deck.id}/backup?format=anki`}>Export Anki text</a>
                  <a className="underline p-3 text-sm" href={`/api/decks/${deck.id}/backup?format=qti`}>Export QTI package</a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
