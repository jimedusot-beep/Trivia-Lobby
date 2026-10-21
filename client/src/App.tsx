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
import VisualPractice from "@/pages/VisualPractice";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/import" component={ImportDeck} />
      <Route path="/study/:id" component={Study} />
      <Route path="/practice/:id" component={Practice} />
      <Route path="/exam-builder/:id" component={ExamBuilder} />
      <Route path="/visual-practice/:id" component={VisualPractice} />
      <Route path="/host/:deckId" component={Host} />
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
