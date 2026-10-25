import { Link } from "wouter";
import { BookOpen, Gamepad2, GraduationCap, LockKeyhole, Smartphone, Sparkles, Users, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Public, no-account entry point. Protected decks remain behind /decks. */
export default function Welcome() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Main navigation">
          <Link href="/" className="text-xl font-display font-bold text-primary">Trivia Lobby</Link>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm"><a href="/party/">Party games</a></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/learn-demo">Try learning</Link></Button>
            <Button asChild variant="ghost" size="sm"><a href="/party/create.html">Make a quiz</a></Button>
            <Button asChild variant="outline" size="sm"><Link href="/decks">Private library</Link></Button>
          </div>
        </nav>

        <section className="rounded-3xl bg-linear-to-br from-primary/15 via-secondary/15 to-background border p-6 sm:p-12 text-center space-y-5">
          <div className="flex justify-center"><Sparkles className="h-10 w-10 text-primary" aria-hidden="true" /></div>
          <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight">Play together. Learn for fun.</h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">Family trivia, Charades and short study lessons. No email, no password, no account needed to get started.</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-3">
            <Button asChild size="lg" className="min-h-14 text-lg rounded-xl"><a href="/party/"><Gamepad2 className="mr-2 h-5 w-5" /> Start a Party</a></Button>
            <Button asChild size="lg" variant="secondary" className="min-h-14 text-lg rounded-xl"><Link href="/learn-demo"><GraduationCap className="mr-2 h-5 w-5" /> Try a Lesson</Link></Button>
            <Button asChild size="lg" variant="outline" className="min-h-14 text-lg rounded-xl"><a href="/party/create.html"><PencilLine className="mr-2 h-5 w-5" /> Make a Quiz</a></Button>
          </div>
          <p className="text-sm text-muted-foreground">Party hosts and players enter as guests. Your sample-lesson progress and personal quizzes stay on this device.</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="How to get started">
          <Card className="rounded-2xl">
            <CardHeader><Users className="h-7 w-7 text-primary" aria-hidden="true" /><CardTitle>Host or join a party</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Choose Quiz, Prompt Duel or Charades. Share a six-character code and join with nicknames.</p>
              <Button asChild variant="outline" className="w-full"><a href="/party/">Play as a guest</a></Button>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><BookOpen className="h-7 w-7 text-primary" aria-hidden="true" /><CardTitle>Practice in minutes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Answer short lessons, get explanations and collect local practice XP. Restart any time.</p>
              <Button asChild variant="outline" className="w-full"><Link href="/learn-demo">Start sample lessons</Link></Button>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><LockKeyhole className="h-7 w-7 text-primary" aria-hidden="true" /><CardTitle>Your private library</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Personal decks, original documents and synchronized study history remain protected. Open them only when you choose.</p>
              <Button asChild variant="outline" className="w-full"><Link href="/decks">Open private library</Link></Button>
            </CardContent>
          </Card>
        </section>
        <footer className="text-center text-sm text-muted-foreground flex flex-wrap items-center justify-center gap-2">
          <Smartphone className="h-4 w-4" aria-hidden="true" /> Works on phones, tablets and computers. Guest party rooms end if the game server restarts.
        </footer>
      </div>
    </main>
  );
}
