import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { queryClient } from "./lib/queryClient";
import { wagmiConfig, baseSepolia } from "./lib/wagmi";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Navigation } from "@/components/navigation";
import NotFound from "@/pages/not-found";
import TopicsPage from "@/pages/topics";
import TopicDetailPage from "@/pages/topic-detail";
import StrategyReviewPage from "@/pages/strategy-review";
import HistoryPage from "@/pages/history";
import PortfolioPage from "@/pages/portfolio";
import MarketDetailPage from "@/pages/market-detail";

import "@coinbase/onchainkit/styles.css";

function Router({ walletAddress }: { walletAddress: string | null }) {
  return (
    <Switch>
      <Route path="/">
        <TopicsPage walletAddress={walletAddress} />
      </Route>
      <Route path="/topics/:id">
        <TopicDetailPage walletAddress={walletAddress} />
      </Route>
      <Route path="/strategy/review">
        <StrategyReviewPage walletAddress={walletAddress} />
      </Route>
      <Route path="/history">
        <HistoryPage walletAddress={walletAddress} />
      </Route>
      <Route path="/portfolio">
        <PortfolioPage walletAddress={walletAddress} />
      </Route>
      <Route path="/markets/:marketSlug">
        <MarketDetailPage walletAddress={walletAddress} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const walletAddress = isConnected && address ? address : null;

  const handleConnect = () => {
    const coinbaseConnector = connectors.find(c => c.id === "coinbaseWalletSDK");
    const connector = coinbaseConnector || connectors[0];
    if (connector) {
      connect({ connector });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    queryClient.invalidateQueries();
  };

  return (
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
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="edgefinder-theme">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <OnchainKitProvider chain={baseSepolia}>
            <TooltipProvider>
              <AppContent />
              <Toaster />
            </TooltipProvider>
          </OnchainKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

export default App;
