import { Link } from "wouter";
import { useDecks } from "@/hooks/use-decks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Users, Upload, Gamepad2, PlusCircle, Trash2, ClipboardList, Search } from "lucide-react";
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
  const [gameModes,setGameModes]=useState<Record<number,string>>({});
  const [search, setSearch] = useState("");
  const matchingDecks = (decks ?? []).filter(deck =>
    [deck.title, deck.category, deck.description].some(value =>
      (value ?? "").toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12 md:py-20">
        <img src="/images/study-lobby.webp" alt="" width="180" height="180" className="mx-auto rounded-3xl" />
        <h1 className="text-5xl md:text-7xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-secondary animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Trivia Lobby
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
          Family game night meets serious studying. Build reusable decks, practice with flashcards, and host live quiz battles.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/join">
            <Button size="lg" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-1 transition-all">
              <Gamepad2 className="mr-3 h-6 w-6" /> Join Game
            </Button>
          </Link>
          <Link href="/library"><Button size="lg" variant="secondary" className="h-16 px-8 rounded-2xl">Private source library</Button></Link>
          <Link href="/new-exam">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl border-2">
              <ClipboardList className="mr-3 h-6 w-6" /> New Exam Deck
            </Button>
          </Link>
          <Link href="/learning"><Button size="lg" variant="secondary" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl"><Brain className="mr-3 h-6 w-6" /> My Learning</Button></Link>
          <Link href="/import">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-16 px-8 text-xl font-bold rounded-2xl border-2 hover:bg-secondary/10 hover:border-secondary hover:text-secondary-foreground transition-all">
              <PlusCircle className="mr-3 h-6 w-6" /> Create Deck
            </Button>
          </Link>
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
            <Link href="/import">
              <Button>Create Deck</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matchingDecks.map((deck) => (
              <Card key={deck.id} className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300 rounded-3xl overflow-hidden border-2 bg-card">
                <CardHeader className="bg-gradient-to-br from-primary/5 to-transparent pb-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-display text-2xl truncate pr-2" title={deck.title}>
                      {deck.title}
                    </CardTitle>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button aria-label={`Delete ${deck.title}`} variant="ghost" size="icon" className="h-11 w-8 text-muted-foreground hover:text-destructive -mr-2 -mt-2">
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
                  <Link href={`/study/${deck.id}`}>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2 hover:border-primary hover:text-primary hover:bg-primary/5">
                      <Brain className="mr-2 h-4 w-4" /> Study
                    </Button>
                  </Link>
                  <Link href={`/practice/${deck.id}`}>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2">
                      <ClipboardList className="mr-2 h-4 w-4" /> Practice
                    </Button>
                  </Link>
                  <Link href={`/exam-builder/${deck.id}`}>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2">
                      <PlusCircle className="mr-2 h-4 w-4" /> Exam Builder
                    </Button>
                  </Link>
                  <Link href={`/visual-practice/${deck.id}`}>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2">
                      <ClipboardList className="mr-2 h-4 w-4" /> Visual Exam
                    </Button>
                  </Link>
                  <Link href={`/learning/review/${deck.id}?mode=due`}><Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2"><Brain className="mr-2 h-4 w-4" /> Adaptive</Button></Link>
                  <select aria-label={`Game mode for ${deck.title}`} className="col-span-2 border rounded p-3 bg-background" value={gameModes[deck.id]??"classic"} onChange={e=>setGameModes(old=>({...old,[deck.id]:e.target.value}))}>
                    <option value="classic">Classic quiz</option><option value="teams">Team challenge</option><option value="shop">Upgrade shop</option><option value="buzzer">Buzzer race</option><option value="wager">Wager points</option><option value="party">Round rush</option>
                  </select>
                  <Link id={`host-link-${deck.id}`} href={`/host/${deck.id}?mode=${gameModes[deck.id]??"classic"}`}>
                    <Button className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90">
                      <Users className="mr-2 h-4 w-4" /> Host
                    </Button>
                  </Link>
                  <Link href={`/learning/review/${deck.id}?mode=due`}><Button variant="outline" className="w-full h-12">Adaptive review</Button></Link>
                  <Link href={`/visual-practice/${deck.id}?mode=adaptive`}><Button variant="outline" className="w-full h-12">Adaptive visual practice</Button></Link>
                  <a className="underline text-sm" href={`/api/decks/${deck.id}/backup`}>Full JSON backup</a>
                  <a className="underline text-sm" href={`/api/decks/${deck.id}/export/qti`}>Export QTI</a>
                  <a className="underline text-sm" href={`/api/decks/${deck.id}/export/anki`}>Export Anki Basic</a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
