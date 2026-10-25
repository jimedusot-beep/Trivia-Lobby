import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Welcome from "@/pages/Welcome";
import AuthGate from "@/components/AuthGate";

// Keep the home route immediately available; load heavier tools only as needed.
const CardEditor = lazy(() => import("@/pages/CardEditor"));
const GuestLearn = lazy(() => import("@/pages/GuestLearn"));
const ImportDeck = lazy(() => import("@/pages/ImportDeck"));
const Study = lazy(() => import("@/pages/Study"));
const Practice = lazy(() => import("@/pages/Practice"));
const Host = lazy(() => import("@/pages/Host"));
const Join = lazy(() => import("@/pages/Join"));
const Play = lazy(() => import("@/pages/Play"));
const NotFound = lazy(() => import("@/pages/not-found"));
const ExamBuilder = lazy(() => import("@/pages/ExamBuilder"));
const NewExamDeck = lazy(() => import("@/pages/NewExamDeck"));
const VisualPractice = lazy(() => import("@/pages/VisualPractice"));
const Learning = lazy(() => import("@/pages/Learning"));
const LearningSources = lazy(() => import("@/pages/LearningSources"));
const Library = lazy(() => import("@/pages/Library"));
const Reports = lazy(() => import("@/pages/Reports"));
const Assignments = lazy(() => import("@/pages/Assignments"));
const AssignmentPlay = lazy(() => import("@/pages/AssignmentPlay"));
const AdaptiveReview = lazy(() => import("@/pages/Learning").then(module => ({ default: module.AdaptiveReview })));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Welcome} />
      <Route path="/learn-demo" component={GuestLearn} />
      <Route path="/decks"><AuthGate><Home /></AuthGate></Route>
      <Route path="/library"><AuthGate><Library /></AuthGate></Route>
      <Route path="/card-editor/:id"><AuthGate><CardEditor /></AuthGate></Route>
      <Route path="/import"><AuthGate><ImportDeck /></AuthGate></Route>
      <Route path="/study/:deckId"><AuthGate><AdaptiveReview /></AuthGate></Route>
      <Route path="/flashcards/:id"><AuthGate><Study /></AuthGate></Route>
      <Route path="/practice/:id"><AuthGate><Practice /></AuthGate></Route>
      <Route path="/host/:deckId"><AuthGate><Host /></AuthGate></Route>
      <Route path="/new-exam"><AuthGate><NewExamDeck /></AuthGate></Route>
      <Route path="/exam-builder/:id"><AuthGate><ExamBuilder /></AuthGate></Route>
      <Route path="/visual-practice/:id"><AuthGate><VisualPractice /></AuthGate></Route>
      <Route path="/learning/review/:deckId"><AuthGate><AdaptiveReview /></AuthGate></Route>
      <Route path="/learning"><AuthGate><Learning /></AuthGate></Route>
      <Route path="/learning/sources"><AuthGate><LearningSources /></AuthGate></Route>
      <Route path="/assignment/:id" component={AssignmentPlay} />
      <Route path="/assignments/:id"><AuthGate><Assignments /></AuthGate></Route>
      <Route path="/assignments"><AuthGate><Assignments /></AuthGate></Route>
      <Route path="/reports/:id"><AuthGate><Reports /></AuthGate></Route>
      <Route path="/reports"><AuthGate><Reports /></AuthGate></Route>
      <Route path="/join" component={Join} />
      <Route path="/play" component={Play} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Suspense fallback={
          <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <span>Loading Trivia Lobby…</span>
          </div>
        }>
          <Router />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
