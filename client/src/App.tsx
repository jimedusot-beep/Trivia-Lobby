import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import ImportDeck from "@/pages/ImportDeck";
import Study from "@/pages/Study";
import Practice from "@/pages/Practice";
import Host from "@/pages/Host";
import Join from "@/pages/Join";
import Play from "@/pages/Play";
import NotFound from "@/pages/not-found";
import ExamBuilder from "@/pages/ExamBuilder";
import NewExamDeck from "@/pages/NewExamDeck";
import VisualPractice from "@/pages/VisualPractice";
import Learning, { AdaptiveReview } from "@/pages/Learning";
import LearningSources from "@/pages/LearningSources";
import AuthGate from "@/components/AuthGate";
import Library from "@/pages/Library";

function Router() {
  return (
    <Switch>
      <Route path="/"><AuthGate><Home /></AuthGate></Route>
      <Route path="/library"><AuthGate><Library /></AuthGate></Route>
      <Route path="/import"><AuthGate><ImportDeck /></AuthGate></Route>
      <Route path="/study/:id"><AuthGate><Study /></AuthGate></Route>
      <Route path="/practice/:id"><AuthGate><Practice /></AuthGate></Route>
      <Route path="/host/:deckId"><AuthGate><Host /></AuthGate></Route>
      <Route path="/new-exam"><AuthGate><NewExamDeck /></AuthGate></Route>
      <Route path="/exam-builder/:id"><AuthGate><ExamBuilder /></AuthGate></Route>
      <Route path="/visual-practice/:id"><AuthGate><VisualPractice /></AuthGate></Route>
      <Route path="/learning/review/:deckId"><AuthGate><AdaptiveReview /></AuthGate></Route>
      <Route path="/learning"><AuthGate><Learning /></AuthGate></Route>
      <Route path="/learning/sources"><AuthGate><LearningSources /></AuthGate></Route>
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
