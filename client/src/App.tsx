import { useState, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import NotFound from "@/pages/not-found";
import TopicsPage from "@/pages/topics";
import TopicDetailPage from "@/pages/topic-detail";
import StrategyReviewPage from "@/pages/strategy-review";
import HistoryPage from "@/pages/history";

function Router({ walletAddress }: { walletAddress: string | null }) {
  return (
    <Switch>
      <Route path="/">
        <TopicsPage walletAddress={walletAddress} />
      </Route>
      <Route path="/topic/:id">
        <TopicDetailPage walletAddress={walletAddress} />
      </Route>
      <Route path="/strategy/review">
        <StrategyReviewPage walletAddress={walletAddress} />
      </Route>
      <Route path="/history">
        <HistoryPage walletAddress={walletAddress} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    return localStorage.getItem("mockWalletAddress");
  });

  const handleConnect = useCallback(() => {
    const mockAddress = "0x" + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    setWalletAddress(mockAddress);
    localStorage.setItem("mockWalletAddress", mockAddress);
    queryClient.invalidateQueries();
  }, []);

  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    localStorage.removeItem("mockWalletAddress");
    queryClient.invalidateQueries();
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="edgefinder-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen bg-background">
            <Navigation
              walletAddress={walletAddress}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            <main>
              <Router walletAddress={walletAddress} />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
