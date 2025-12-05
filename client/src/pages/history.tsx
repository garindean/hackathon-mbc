import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StrategyHistoryCard } from "@/components/strategy-history-card";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import type { StrategyWithDetails } from "@shared/schema";

interface HistoryPageProps {
  walletAddress?: string | null;
}

export default function HistoryPage({ walletAddress }: HistoryPageProps) {
  const [, setLocation] = useLocation();

  const { data: strategies, isLoading, error } = useQuery<StrategyWithDetails[]>({
    queryKey: ["/api/strategies", walletAddress],
    enabled: !!walletAddress,
  });

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
            Strategy History
          </h1>
          <p className="text-muted-foreground">
            View your past strategies and their performance
          </p>
        </div>
        <EmptyState 
          type="no-history" 
          onAction={() => setLocation("/")}
        />
        <p className="text-center text-sm text-muted-foreground mt-4">
          Connect your wallet to view your strategy history
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Strategy History</h1>
          <p className="text-muted-foreground">
            View your past strategies and their performance
          </p>
        </div>
        <PageLoadingSkeleton type="history" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-8">
        <EmptyState type="no-history" onAction={() => setLocation("/")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
          Strategy History
        </h1>
        <p className="text-muted-foreground">
          View your past strategies and their performance
        </p>
      </div>

      {!strategies || strategies.length === 0 ? (
        <EmptyState 
          type="no-history" 
          onAction={() => setLocation("/")}
        />
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <StrategyHistoryCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      )}
    </div>
  );
}
