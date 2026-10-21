import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import ImportDeck from "@/pages/ImportDeck";
import Study from "@/pages/Study";
import Practice from "@/pages/Practice";
import Host from "@/pages/Host";
import Join from "@/pages/Join";
import Play from "@/pages/Play";
import NotFound from "@/pages/not-found";

function PrivateRoutes() {
  const { data: account, isPending, isError } = useQuery<{ id: string; email: string } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Unable to check sign-in status");
      return response.json();
    },
    staleTime: 30_000,
    retry: false
  });
  if (isPending) return <div className="min-h-screen grid place-items-center">Checking your session…</div>;
  if (isError) return <div role="alert" className="p-8">Unable to reach the account service. Please reload.</div>;
  if (!account) return <Auth />;
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/import" component={ImportDeck} />
      <Route path="/study/:id" component={Study} />
      <Route path="/practice/:id" component={Practice} />
      <Route path="/host/:deckId" component={Host} />
      <Route component={NotFound} />
    </Switch>
  );
}
function Router() {
  return (
    <Switch>
      <Route path="/join" component={Join} />
      <Route path="/play" component={Play} />
      <Route component={PrivateRoutes} />
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
