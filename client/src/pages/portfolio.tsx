import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  DollarSign,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrategyWithDetails } from "@shared/schema";

interface PortfolioPageProps {
  walletAddress?: string | null;
}

type PositionStatus = "active" | "won" | "lost" | "pending";

interface Position {
  id: string;
  marketQuestion: string;
  side: string;
  entryPrice: number;
  currentPrice: number;
  allocation: number;
  pnl: number;
  pnlPercent: number;
  status: PositionStatus;
  endDate: Date | null;
  strategyId: string;
  topicName: string;
}

function createPosition(
  strategySignal: any,
  signal: any,
  topicName: string,
  strategyId: string,
  currentPrices: Map<string, number>
): Position {
  const entryPrice = signal.marketPrice;
  // Use real current price from Polymarket if available, otherwise use entry price
  const currentPrice = currentPrices.get(signal.marketId) ?? entryPrice;
  
  // Calculate PnL based on position side
  // For YES positions: profit if price goes up
  // For NO positions: profit if price goes down  
  const isYesSide = signal.side === "YES";
  const effectiveCurrentPrice = isYesSide ? currentPrice : (1 - currentPrice);
  const effectiveEntryPrice = entryPrice;
  
  const pnl = (effectiveCurrentPrice - effectiveEntryPrice) * strategySignal.usdcAllocation;
  const pnlPercent = effectiveEntryPrice > 0 ? ((effectiveCurrentPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100 : 0;
  
  // Determine status based on market end date
  let status: PositionStatus = "active";
  if (signal.endDate && new Date(signal.endDate) < new Date()) {
    // Market has ended - check if resolved based on final price
    if (currentPrice >= 0.95 || currentPrice <= 0.05) {
      // Market resolved (price near 0 or 1)
      const resolvedYes = currentPrice >= 0.95;
      const wonBet = (isYesSide && resolvedYes) || (!isYesSide && !resolvedYes);
      status = wonBet ? "won" : "lost";
    } else {
      status = "pending"; // Awaiting resolution
    }
  }
  
  return {
    id: strategySignal.id,
    marketQuestion: signal.marketQuestion,
    side: signal.side,
    entryPrice,
    currentPrice: effectiveCurrentPrice,
    allocation: strategySignal.usdcAllocation,
    pnl,
    pnlPercent,
    status,
    endDate: signal.endDate ? new Date(signal.endDate) : null,
    strategyId,
    topicName,
  };
}

export default function PortfolioPage({ walletAddress }: PortfolioPageProps) {
  const [, setLocation] = useLocation();

  const { data: strategies, isLoading } = useQuery<StrategyWithDetails[]>({
    queryKey: ["/api/strategies", walletAddress],
    enabled: !!walletAddress,
  });

  // Get unique market IDs from all executed strategies
  const marketIds = useMemo(() => {
    if (!strategies) return [];
    const ids = new Set<string>();
    for (const strategy of strategies) {
      if (strategy.status !== "executed" || !strategy.signals) continue;
      for (const ss of strategy.signals) {
        if (ss.signal?.marketId) {
          ids.add(ss.signal.marketId);
        }
      }
    }
    return Array.from(ids);
  }, [strategies]);

  // Fetch current prices for all markets in portfolio
  const { data: currentPrices } = useQuery<Record<string, number>>({
    queryKey: ["/api/portfolio/prices", marketIds],
    queryFn: async () => {
      if (marketIds.length === 0) return {};
      const res = await fetch(`/api/portfolio/prices?marketIds=${marketIds.join(",")}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: marketIds.length > 0,
    refetchInterval: 60000, // Refresh prices every minute
  });

  const positions = useMemo(() => {
    if (!strategies) return [];
    
    const priceMap = new Map<string, number>(
      Object.entries(currentPrices || {}).map(([k, v]) => [k, v])
    );
    
    const allPositions: Position[] = [];
    
    for (const strategy of strategies) {
      if (strategy.status !== "executed" || !strategy.signals) continue;
      
      for (const ss of strategy.signals) {
        if (!ss.signal) continue;
        allPositions.push(
          createPosition(ss, ss.signal, strategy.topic?.name || "Unknown", strategy.id, priceMap)
        );
      }
    }
    
    return allPositions;
  }, [strategies, currentPrices]);

  const stats = useMemo(() => {
    if (!positions.length) {
      return {
        totalValue: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        activeCount: 0,
        wonCount: 0,
        lostCount: 0,
        winRate: 0,
      };
    }

    const totalValue = positions.reduce((sum, p) => sum + p.allocation, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const totalPnlPercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0;
    
    const activeCount = positions.filter(p => p.status === "active").length;
    const wonCount = positions.filter(p => p.status === "won").length;
    const lostCount = positions.filter(p => p.status === "lost").length;
    const resolved = wonCount + lostCount;
    const winRate = resolved > 0 ? (wonCount / resolved) * 100 : 0;

    return { totalValue, totalPnl, totalPnlPercent, activeCount, wonCount, lostCount, winRate };
  }, [positions]);

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            Track your positions, PnL, and market resolutions
          </p>
        </div>
        <EmptyState 
          type="no-wallet" 
          title="Connect Wallet"
          description="Connect your wallet to view your portfolio and positions"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            Track your positions, PnL, and market resolutions
          </p>
        </div>
        <PageLoadingSkeleton type="signals" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
          Portfolio
        </h1>
        <p className="text-muted-foreground">
          Track your positions, PnL, and market resolutions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Wallet className="h-4 w-4" />
              Total Value
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-value">
              ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Total PnL
            </div>
            <div className={cn(
              "text-2xl font-bold font-mono flex items-center gap-1",
              stats.totalPnl >= 0 ? "text-chart-3" : "text-destructive"
            )} data-testid="text-total-pnl">
              {stats.totalPnl >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              ${Math.abs(stats.totalPnl).toFixed(2)}
              <span className="text-sm font-normal">
                ({stats.totalPnlPercent >= 0 ? "+" : ""}{stats.totalPnlPercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Activity className="h-4 w-4" />
              Active Positions
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="text-active-count">
              {stats.activeCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="h-4 w-4" />
              Win Rate
            </div>
            <div className="text-2xl font-bold font-mono" data-testid="text-win-rate">
              {stats.winRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.wonCount}W / {stats.lostCount}L
            </div>
          </CardContent>
        </Card>
      </div>

      {positions.length === 0 ? (
        <EmptyState
          type="no-strategies"
          title="No Positions Yet"
          description="Execute your first strategy to start tracking positions"
          actionLabel="Browse Topics"
          onAction={() => setLocation("/")}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Positions</h2>
            <Badge variant="secondary">{positions.length} total</Badge>
          </div>

          <div className="grid gap-4">
            {positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionCard({ position }: { position: Position }) {
  const getStatusConfig = (status: PositionStatus) => {
    switch (status) {
      case "active":
        return { 
          label: "Active", 
          icon: Activity,
          variant: "secondary" as const,
          color: "text-chart-4"
        };
      case "won":
        return { 
          label: "Won", 
          icon: CheckCircle2,
          variant: "default" as const,
          color: "text-chart-3"
        };
      case "lost":
        return { 
          label: "Lost", 
          icon: XCircle,
          variant: "destructive" as const,
          color: "text-destructive"
        };
      case "pending":
        return { 
          label: "Pending Resolution", 
          icon: Clock,
          variant: "outline" as const,
          color: "text-muted-foreground"
        };
    }
  };

  const statusConfig = getStatusConfig(position.status);
  const StatusIcon = statusConfig.icon;
  const isPositive = position.pnl >= 0;

  return (
    <Card className="overflow-visible" data-testid={`card-position-${position.id}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant={statusConfig.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
              <Badge variant="outline">{position.side}</Badge>
              <span className="text-xs text-muted-foreground">{position.topicName}</span>
            </div>
            <h3 className="font-medium text-sm md:text-base line-clamp-2" data-testid="text-market-question">
              {position.marketQuestion}
            </h3>
            {position.endDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                {position.endDate.toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Entry</div>
              <div className="font-mono text-sm">{(position.entryPrice * 100).toFixed(1)}c</div>
            </div>

            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Current</div>
              <div className="font-mono text-sm">{(position.currentPrice * 100).toFixed(1)}c</div>
            </div>

            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-0.5">Size</div>
              <div className="font-mono text-sm">${position.allocation.toFixed(0)}</div>
            </div>

            <div className="text-center min-w-[80px]">
              <div className="text-xs text-muted-foreground mb-0.5">PnL</div>
              <div className={cn(
                "font-mono text-sm font-semibold flex items-center justify-center gap-0.5",
                isPositive ? "text-chart-3" : "text-destructive"
              )} data-testid="text-position-pnl">
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? "+" : "-"}${Math.abs(position.pnl).toFixed(2)}
                <span className="text-muted-foreground font-normal">
                  ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
