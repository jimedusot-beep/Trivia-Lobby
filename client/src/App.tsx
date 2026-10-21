import { Switch, Route, useLocation } from "wouter";
import LibraryGate from "@/components/LibraryGate";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/import" component={ImportDeck} />
      <Route path="/study/:id" component={Study} />
      <Route path="/practice/:id" component={Practice} />
      <Route path="/host/:deckId" component={Host} />
      <Route path="/join" component={Join} />
      <Route path="/play" component={Play} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const guestRoute = location === "/join" || location === "/play";
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {guestRoute ? <Router /> : <LibraryGate><Router /></LibraryGate>}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
