import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, CheckCircle2, RotateCcw, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LobbyBrand, LobbyCelebration } from "@/components/LobbyIdentity";

type Question = { prompt: string; choices: [string, string, string]; correct: number; explanation: string };
type Lesson = { id: string; title: string; subject: string; questions: Question[] };
const lessons: Lesson[] = [
  { id: "science", title: "Science Starter", subject: "Science", questions: [
    { prompt: "Which part of a plant typically absorbs water?", choices: ["Roots", "Leaves", "Flowers"], correct: 0, explanation: "Roots absorb most of the water and minerals that a plant needs." },
    { prompt: "Water freezes at about what temperature in Celsius at normal pressure?", choices: ["100°C", "0°C", "50°C"], correct: 1, explanation: "The freezing point of pure water at normal atmospheric pressure is 0°C." },
    { prompt: "Which planet is known as the Red Planet?", choices: ["Jupiter", "Venus", "Mars"], correct: 2, explanation: "Mars looks reddish because iron-rich minerals on its surface have oxidized." },
  ] },
  { id: "words", title: "Word Wonders", subject: "Language", questions: [
    { prompt: "Which word means almost the same as 'enormous'?", choices: ["Tiny", "Huge", "Quiet"], correct: 1, explanation: "Enormous and huge both describe something very large." },
    { prompt: "Which sentence is a question?", choices: ["Where is the book?", "I found the book.", "Read the book."], correct: 0, explanation: "A question asks for information and normally ends with a question mark." },
    { prompt: "What is the opposite of 'ancient'?", choices: ["Historic", "Antique", "Modern"], correct: 2, explanation: "Ancient means very old; modern refers to recent times." },
  ] },
  { id: "geography", title: "Around the World", subject: "Geography", questions: [
    { prompt: "Which is the world's largest ocean?", choices: ["Atlantic", "Pacific", "Indian"], correct: 1, explanation: "The Pacific Ocean covers more surface area than any other ocean." },
    { prompt: "Which continent contains Brazil?", choices: ["Africa", "Europe", "South America"], correct: 2, explanation: "Brazil occupies a large portion of eastern South America." },
    { prompt: "What is the capital of Japan?", choices: ["Tokyo", "Osaka", "Kyoto"], correct: 0, explanation: "Tokyo is the capital of Japan." },
  ] },
];
const STORAGE_KEY = "trivia-lobby-guest-learning-v1";
function loadCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? lessons.map(l => l.id).filter(id => data.includes(id)) : [];
  } catch { return []; }
}
export default function GuestLearn() {
  const [completed, setCompleted] = useState<string[]>(loadCompleted);
  const [lessonIndex, setLessonIndex] = useState(() => {
    const saved = loadCompleted();
    const next = lessons.findIndex(l => !saved.includes(l.id));
    return next === -1 ? 0 : next;
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const lesson = lessons[lessonIndex];
  const question = lesson.questions[questionIndex];
  const lessonCompleted = completed.includes(lesson.id);
  const xp = completed.length * 30;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(completed)); }
    catch { /* Browser storage may be unavailable; current session still works. */ }
  }, [completed]);

  function choose(choice: number) {
    if (selected !== null) return;
    setSelected(choice);
    if (choice === question.correct) setSessionCorrect(value => value + 1);
  }
  function advance() {
    if (selected === null) return;
    if (questionIndex + 1 === lesson.questions.length) {
      setSessionFinished(true);
      setCompleted(prev => prev.includes(lesson.id) ? prev : [...prev, lesson.id]);
    } else {
      setQuestionIndex(n => n + 1);
      setSelected(null);
    }
  }
  function openLesson(index: number) {
    setLessonIndex(index);
    setQuestionIndex(0);
    setSelected(null);
    setSessionFinished(false);
    setSessionCorrect(0);
  }

  return (
    <main className="sample-learning sakura-learning min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <LobbyBrand />
          <Button asChild variant="ghost"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link></Button>
          <div className="flex items-center gap-2 font-bold"><Star className="h-5 w-5 text-amber-500" aria-hidden="true" /> {xp} practice XP</div>
        </header>
        <div className="sample-heading"><div className="space-y-2">
          <span className="lobby-kicker">Small lessons. Big little wins.</span>
          <h1 className="text-3xl font-display font-bold">Learn something today</h1>
          <p className="text-muted-foreground">Three bite-sized sample lessons. No email or password required.</p>
          <p className="text-sm text-muted-foreground">Completed lessons are saved on this browser only. Clearing site data removes this progress; it does not synchronize between devices.</p>
          <Button asChild variant="outline" className="whitespace-normal h-auto text-left"><a href="/party/learn.html">Learn from my quizzes: courses, levels and daily lessons</a></Button>
        </div><img className="lobby-hello" src="/party/lobby-spark.svg" alt="" /></div>

        <section aria-label="Learning path" className="sample-path grid sm:grid-cols-3 gap-3">
          {lessons.map((item, i) => (
            <Button
              key={item.id} variant={lessonIndex === i ? "default" : "outline"}
              className="min-h-16 h-auto py-3 flex flex-col gap-1"
              aria-current={lessonIndex === i ? "step" : undefined}
              onClick={() => openLesson(i)}
            >
              <span className="flex items-center gap-1">{completed.includes(item.id) && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{i + 1}. {item.title}</span>
              <span className="text-xs font-normal">{completed.includes(item.id) ? "Completed" : item.subject}</span>
            </Button>
          ))}
        </section>

        {sessionFinished ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center space-y-5">
              <LobbyCelebration />
              <Trophy className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
              <h2 className="text-3xl font-bold">Lesson complete!</h2>
              <p className="text-lg">You answered {sessionCorrect} of {lesson.questions.length} correctly.</p>
              <p className="text-muted-foreground">{lessonCompleted ? "This lesson is saved as completed on this device." : "Your practice was recorded on this device."} Replays do not earn extra XP.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => openLesson((lessonIndex + 1) % lessons.length)}>
                  {lessonIndex + 1 === lessons.length ? "Back to first lesson" : "Continue to next lesson"}
                </Button>
                <Button variant="outline" onClick={() => openLesson(lessonIndex)}><RotateCcw className="mr-2 h-4 w-4" /> Try again</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /> {lesson.subject} · Question {questionIndex + 1} of {lesson.questions.length}</div>
              <Progress aria-label="Lesson progress" value={100 * questionIndex / lesson.questions.length} />
              <CardTitle className="text-2xl leading-relaxed">{question.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="sample-answers grid gap-3">
                {question.choices.map((choice, index) => (
                  <Button key={choice} variant={selected !== null && index === question.correct ? "default" : "outline"}
                    data-correct={selected !== null && index === question.correct}
                    className="justify-start text-left whitespace-normal min-h-14 h-auto py-3 text-base"
                    disabled={selected !== null} onClick={() => choose(index)}>
                    <span className="font-bold mr-3">{String.fromCharCode(65 + index)}.</span>{choice}
                  </Button>
                ))}
              </div>
              {selected !== null && (
                <section role="status" aria-live="polite" className="sample-feedback rounded-xl p-4 space-y-3">
                  <p className="font-bold">{selected === question.correct ? "Correct!" : "Good try! Here's the answer."}</p>
                  <p>{question.explanation}</p>
                  <Button onClick={advance}>{questionIndex + 1 === lesson.questions.length ? "Finish lesson" : "Next question"}</Button>
                </section>
              )}
            </CardContent>
          </Card>
        )}
        <p className="text-center text-sm text-muted-foreground">Sample content, not private study data. <Link href="/decks" className="underline">Private study library</Link> is optional and separate.</p>
      </div>
    </main>
  );
}
