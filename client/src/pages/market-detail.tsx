import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  DollarSign,
  BarChart3,
  Users,
  Zap,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface MarketDetailProps {
  walletAddress: string | null;
}

interface MarketData {
  id: string;
  slug: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  openInterest: number;
  change24h: number;
  endDate: string;
  outcomes: string[];
}

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  id: string;
  outcome: "YES" | "NO";
  type: "BUY" | "SELL";
  price: number;
  amount: number;
  totalUsd: number;
  timestamp: string;
  trader: string;
}

interface Trader {
  address: string;
  position: "YES" | "NO";
  size: number;
  avgEntry: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  firstEntry: string;
}

interface OrderBookLevel {
  price: number;
  shares: number;
  totalUsd: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidPercent: number;
  askPercent: number;
}

interface AIInsight {
  marketId: string;
  recommendedSide: "YES" | "NO";
  aiFairPrice: number;
  marketPrice: number;
  edgeBps: number;
  explanation: string;
}

export default function MarketDetailPage({ walletAddress }: MarketDetailProps) {
  const params = useParams<{ marketSlug: string }>();
  const marketSlug = params.marketSlug || "";
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("trades");
  const [timeframe, setTimeframe] = useState("1d");
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("100");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");

  const { data: market, isLoading: marketLoading } = useQuery<MarketData>({
    queryKey: ["/api/markets", marketSlug],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}`);
      if (!res.ok) throw new Error("Failed to fetch market");
      return res.json();
    },
    enabled: !!marketSlug,
  });

  const { data: priceHistory } = useQuery<CandleData[]>({
    queryKey: ["/api/markets", marketSlug, "price-history", timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}/price-history?timeframe=${timeframe}`);
      if (!res.ok) throw new Error("Failed to fetch price history");
      return res.json();
    },
    enabled: !!marketSlug,
  });

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ["/api/markets", marketSlug, "trades"],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}/trades`);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json();
    },
    enabled: !!marketSlug && activeTab === "trades",
  });

  const { data: topTraders } = useQuery<Trader[]>({
    queryKey: ["/api/markets", marketSlug, "leaderboard"],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}/leaderboard`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    enabled: !!marketSlug && (activeTab === "topTraders" || activeTab === "holders"),
  });

  const { data: orderBook } = useQuery<OrderBook>({
    queryKey: ["/api/markets", marketSlug, "order-book"],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}/order-book`);
      if (!res.ok) throw new Error("Failed to fetch order book");
      return res.json();
    },
    enabled: !!marketSlug,
  });

  const { data: aiInsight, isLoading: aiLoading } = useQuery<AIInsight>({
    queryKey: ["/api/markets", marketSlug, "ai-insights"],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketSlug}/ai-insights`);
      if (!res.ok) throw new Error("Failed to fetch AI insights");
      return res.json();
    },
    enabled: !!marketSlug && activeTab === "aiInsights",
  });

  const executeStrategyMutation = useMutation({
    mutationFn: async (payload: {
      userAddress: string;
      allocation: number;
      edgeBps: number;
      riskLevel: string;
    }) => {
      const response = await apiRequest("POST", `/api/markets/${marketSlug}/execute`, payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Strategy Executed",
        description: `Transaction submitted: ${data.txHash?.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Execution Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExecuteStrategy = () => {
    if (!walletAddress) {
      toast({
        title: "Wallet Required",
        description: "Connect your wallet to execute strategies",
        variant: "destructive",
      });
      return;
    }

    if (!aiInsight) return;

    executeStrategyMutation.mutate({
      userAddress: walletAddress,
      allocation: parseFloat(amount),
      edgeBps: aiInsight.edgeBps,
      riskLevel,
    });
  };

  const formatAge = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (marketLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-[1800px] mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-7 h-[400px]" />
            <Skeleton className="col-span-2 h-[400px]" />
            <Skeleton className="col-span-3 h-[400px]" />
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Market Not Found</h2>
          <p className="text-muted-foreground">The requested market could not be loaded.</p>
        </div>
      </div>
    );
  }

  const priceChange = market.change24h;
  const isPositive = priceChange >= 0;

  // Transform price history into simple line data
  const chartData = (priceHistory || []).map((point) => ({
    timestamp: point.timestamp,
    price: point.close,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold leading-tight" data-testid="text-market-question">
                  {market.question}
                </h1>
                <p className="text-sm text-muted-foreground">{market.description}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-lg font-mono ${
                  market.yesPrice > 0.5 ? "border-emerald-500 text-emerald-500" : "border-rose-500 text-rose-500"
                }`}
                data-testid="badge-yes-price"
              >
                {(market.yesPrice * 100).toFixed(1)}%
              </Badge>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Expires</span>
                <span className="font-medium" data-testid="text-expiry">
                  {new Date(market.endDate).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                )}
                <span className="text-muted-foreground">24h</span>
                <span
                  className={`font-mono font-medium ${isPositive ? "text-emerald-500" : "text-rose-500"}`}
                  data-testid="text-24h-change"
                >
                  {isPositive ? "+" : ""}
                  {(priceChange * 100).toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">24h Vol</span>
                <span className="font-mono font-medium" data-testid="text-24h-volume">
                  ${market.volume24h?.toLocaleString() || "0"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total Vol</span>
                <span className="font-mono font-medium" data-testid="text-total-volume">
                  ${market.totalVolume?.toLocaleString() || "0"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">OI</span>
                <span className="font-mono font-medium" data-testid="text-open-interest">
                  ${market.openInterest?.toLocaleString() || "0"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4">
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className="col-span-12 lg:col-span-7">
            <Card className="p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Price Chart</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-mono font-bold">
                      {(market.yesPrice * 100).toFixed(1)}%
                    </span>
                    <span
                      className={`text-sm font-mono ${isPositive ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {isPositive ? "+" : ""}
                      {(priceChange * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {["1h", "1d", "1w", "All"].map((tf) => (
                    <Button
                      key={tf}
                      variant={timeframe === tf ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTimeframe(tf)}
                      data-testid={`button-timeframe-${tf}`}
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="h-[300px]">
                {chartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {new Date(market.endDate) < new Date() 
                        ? "Market resolved - no active trading data"
                        : "No price history available for this timeframe"}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(val) => {
                          const date = new Date(val);
                          return timeframe === "All" 
                            ? date.toLocaleDateString([], { month: "short", day: "numeric" })
                            : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        }}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelFormatter={(val) => new Date(val).toLocaleString()}
                        formatter={(val: number) => [`${(val * 100).toFixed(2)}%`, "Price"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#priceGradient)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="col-span-12 md:col-span-6 lg:col-span-2">
            <Card className="p-4 h-full">
              <h3 className="font-medium text-sm mb-3">Order Book (Yes)</h3>

              {orderBook && orderBook.bids.length > 0 && orderBook.asks.length > 0 && (() => {
                const displayedAsks = orderBook.asks.slice(0, 5);
                const displayedBids = orderBook.bids.slice(0, 5);
                const maxShares = Math.max(
                  ...displayedAsks.map(l => l.shares),
                  ...displayedBids.map(l => l.shares),
                  1
                );
                return (
                  <>
                    <div className="flex items-center gap-2 mb-3 overflow-hidden">
                      <div
                        className="h-2 bg-emerald-500 rounded-l"
                        style={{ width: `${Math.min(orderBook.bidPercent, 100)}%` }}
                      />
                      <div
                        className="h-2 bg-rose-500 rounded-r"
                        style={{ width: `${Math.min(orderBook.askPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-3">
                      <span>B {orderBook.bidPercent}%</span>
                      <span>{orderBook.askPercent}% S</span>
                    </div>

                    <div className="space-y-1 text-xs overflow-hidden">
                      <div className="grid grid-cols-3 text-muted-foreground border-b border-border pb-1">
                        <span>Price</span>
                        <span className="text-right">Shares</span>
                        <span className="text-right">USD</span>
                      </div>

                      {displayedAsks.reverse().map((level, i) => (
                        <div key={`ask-${i}`} className="grid grid-cols-3 relative overflow-hidden">
                          <div
                            className="absolute inset-0 bg-rose-500/10"
                            style={{ width: `${Math.min((level.shares / maxShares) * 100, 100)}%` }}
                          />
                          <span className="relative text-rose-400 font-mono">
                            {(level.price * 100).toFixed(1)}
                          </span>
                          <span className="relative text-right font-mono">{level.shares.toLocaleString()}</span>
                          <span className="relative text-right font-mono text-muted-foreground">
                            ${level.totalUsd.toLocaleString()}
                          </span>
                        </div>
                      ))}

                      <div className="border-y border-border py-1 text-center font-medium">
                        {(market.yesPrice * 100).toFixed(1)}%
                      </div>

                      {displayedBids.map((level, i) => (
                        <div key={`bid-${i}`} className="grid grid-cols-3 relative overflow-hidden">
                          <div
                            className="absolute inset-0 bg-emerald-500/10"
                            style={{ width: `${Math.min((level.shares / maxShares) * 100, 100)}%` }}
                          />
                          <span className="relative text-emerald-400 font-mono">
                            {(level.price * 100).toFixed(1)}
                          </span>
                          <span className="relative text-right font-mono">{level.shares.toLocaleString()}</span>
                          <span className="relative text-right font-mono text-muted-foreground">
                            ${level.totalUsd.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {orderBook && (orderBook.bids.length === 0 || orderBook.asks.length === 0) && (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
                  <Activity className="h-6 w-6 mb-2 opacity-50" />
                  <p className="text-xs text-center">
                    {new Date(market.endDate) < new Date() 
                      ? "Market resolved - no active orders"
                      : "No orders in book"}
                  </p>
                </div>
              )}

              {!orderBook && (
                <div className="space-y-2">
                  {Array(10).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <Card className="p-4 h-full">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={orderSide === "buy" ? "default" : "outline"}
                  className={`flex-1 ${orderSide === "buy" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  onClick={() => setOrderSide("buy")}
                  data-testid="button-buy"
                >
                  Buy
                </Button>
                <Button
                  variant={orderSide === "sell" ? "default" : "outline"}
                  className={`flex-1 ${orderSide === "sell" ? "bg-rose-600 hover:bg-rose-700" : ""}`}
                  onClick={() => setOrderSide("sell")}
                  data-testid="button-sell"
                >
                  Sell
                </Button>
              </div>

              <div className="flex gap-2 mb-4">
                <Button variant="default" size="sm" className="flex-1" disabled>
                  Market
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled>
                  Limit
                </Button>
              </div>

              <div className="flex gap-2 mb-4">
                <Button
                  variant={selectedOutcome === "yes" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSelectedOutcome("yes")}
                  data-testid="button-outcome-yes"
                >
                  Yes {(market.yesPrice * 100).toFixed(1)}%
                </Button>
                <Button
                  variant={selectedOutcome === "no" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSelectedOutcome("no")}
                  data-testid="button-outcome-no"
                >
                  No {(market.noPrice * 100).toFixed(1)}%
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Amount ($)</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono"
                    data-testid="input-amount"
                  />
                </div>

                <div>
                  <Slider
                    value={[parseFloat(amount) || 0]}
                    max={1000}
                    step={10}
                    onValueChange={([val]) => setAmount(val.toString())}
                    className="my-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span>$1,000</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-medium">${parseFloat(amount) || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">If you win</span>
                    <span className="font-mono font-medium text-emerald-500">
                      $
                      {(
                        (parseFloat(amount) || 0) /
                        (selectedOutcome === "yes" ? market.yesPrice : market.noPrice)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolves</span>
                    <span className="font-mono">{new Date(market.endDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <Button
                  className={`w-full ${
                    orderSide === "buy"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                  disabled
                  data-testid="button-trade"
                >
                  Trade (Demo)
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <Card className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger
                value="positions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-positions"
              >
                My Positions
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-orders"
              >
                My Orders
              </TabsTrigger>
              <TabsTrigger
                value="trades"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-trades"
              >
                Trades
              </TabsTrigger>
              <TabsTrigger
                value="topTraders"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-top-traders"
              >
                Top Traders
              </TabsTrigger>
              <TabsTrigger
                value="holders"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-holders"
              >
                Holders
              </TabsTrigger>
              <TabsTrigger
                value="news"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-news"
              >
                News & Events
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-comments"
              >
                Comments
              </TabsTrigger>
              <TabsTrigger
                value="aiInsights"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                data-testid="tab-ai-insights"
              >
                <Bot className="h-4 w-4 mr-1" />
                AI Insights
              </TabsTrigger>
            </TabsList>

            <div className="p-4">
              <TabsContent value="positions" className="m-0">
                <div className="text-center py-8 text-muted-foreground">
                  {walletAddress ? (
                    <p>No positions in this market</p>
                  ) : (
                    <p>Connect wallet to view positions</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="orders" className="m-0">
                <div className="text-center py-8 text-muted-foreground">
                  {walletAddress ? (
                    <p>No open orders</p>
                  ) : (
                    <p>Connect wallet to view orders</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trades" className="m-0">
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Traders:</span>
                    <span className="font-mono font-medium">{trades?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Total trades:</span>
                    <span className="font-mono font-medium">{trades?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Avg size:</span>
                    <span className="font-mono font-medium">
                      ${trades?.length ? (trades.reduce((s, t) => s + t.totalUsd, 0) / trades.length).toFixed(0) : 0}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3">Outcome</th>
                        <th className="text-left py-2 px-3">Type</th>
                        <th className="text-right py-2 px-3">Price</th>
                        <th className="text-right py-2 px-3">Amount</th>
                        <th className="text-right py-2 px-3">Total</th>
                        <th className="text-right py-2 px-3">Age</th>
                        <th className="text-left py-2 px-3">Trader</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades?.map((trade) => (
                        <tr key={trade.id} className="border-b border-border/50 hover-elevate">
                          <td className="py-2 px-3">
                            <Badge variant={trade.outcome === "YES" ? "default" : "secondary"}>
                              {trade.outcome}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={
                                trade.type === "BUY" ? "text-emerald-500" : "text-rose-500"
                              }
                            >
                              {trade.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {(trade.price * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{trade.amount}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            ${trade.totalUsd.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {formatAge(trade.timestamp)}
                          </td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">
                            {formatAddress(trade.trader)}
                          </td>
                        </tr>
                      ))}
                      {(!trades || trades.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No trades yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="topTraders" className="m-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3">Trader</th>
                        <th className="text-left py-2 px-3">Position</th>
                        <th className="text-right py-2 px-3">Size</th>
                        <th className="text-right py-2 px-3">Avg Entry</th>
                        <th className="text-right py-2 px-3">Current</th>
                        <th className="text-right py-2 px-3">PnL</th>
                        <th className="text-right py-2 px-3">First Entry</th>
                        <th className="text-center py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTraders?.map((trader) => (
                        <tr key={trader.address} className="border-b border-border/50 hover-elevate">
                          <td className="py-2 px-3 font-mono">{formatAddress(trader.address)}</td>
                          <td className="py-2 px-3">
                            <Badge variant={trader.position === "YES" ? "default" : "secondary"}>
                              {trader.position}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{trader.size}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {(trader.avgEntry * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {(trader.currentPrice * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`font-mono ${
                                trader.pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              {trader.pnl >= 0 ? "+" : ""}${trader.pnl.toFixed(2)} (
                              {trader.pnlPercent >= 0 ? "+" : ""}
                              {trader.pnlPercent.toFixed(1)}%)
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {formatAge(trader.firstEntry)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!topTraders || topTraders.length === 0) && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground">
                            No trader data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="holders" className="m-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3">Holder</th>
                        <th className="text-left py-2 px-3">Position</th>
                        <th className="text-right py-2 px-3">Size</th>
                        <th className="text-right py-2 px-3">Value</th>
                        <th className="text-right py-2 px-3">Avg Entry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTraders
                        ?.sort((a, b) => b.size - a.size)
                        .map((trader) => (
                          <tr key={trader.address} className="border-b border-border/50 hover-elevate">
                            <td className="py-2 px-3 font-mono">{formatAddress(trader.address)}</td>
                            <td className="py-2 px-3">
                              <Badge variant={trader.position === "YES" ? "default" : "secondary"}>
                                {trader.position}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{trader.size}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              ${(trader.size * trader.currentPrice).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {(trader.avgEntry * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      {(!topTraders || topTraders.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            No holder data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="news" className="m-0">
                <div className="text-center py-8 text-muted-foreground">
                  <p>News & Events coming soon</p>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="m-0">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Comments coming soon</p>
                </div>
              </TabsContent>

              <TabsContent value="aiInsights" className="m-0">
                {aiLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-60 w-full" />
                  </div>
                ) : aiInsight ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="p-4 border-primary/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Bot className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">AI Mispricing Insight</h3>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Recommended:</span>
                          <Badge
                            className={`text-lg ${
                              aiInsight.recommendedSide === "YES"
                                ? "bg-emerald-600"
                                : "bg-rose-600"
                            }`}
                          >
                            Buy {aiInsight.recommendedSide}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground block">Market Price</span>
                            <span className="text-2xl font-mono font-bold">
                              {(aiInsight.marketPrice * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground block">AI Fair Price</span>
                            <span className="text-2xl font-mono font-bold text-primary">
                              {(aiInsight.aiFairPrice * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-primary/10 rounded-md">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <span className="font-medium">Estimated Edge</span>
                          </div>
                          <span className="text-3xl font-mono font-bold text-primary">
                            +{(aiInsight.edgeBps / 100).toFixed(1)}%
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">{aiInsight.explanation}</p>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold mb-4">Suggested Allocation</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">
                            Max Allocation (USDC)
                          </label>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="font-mono"
                            data-testid="input-ai-amount"
                          />
                        </div>

                        <div>
                          <label className="text-sm text-muted-foreground block mb-2">Risk Level</label>
                          <div className="flex gap-2">
                            {(["low", "medium", "high"] as const).map((level) => (
                              <Button
                                key={level}
                                variant={riskLevel === level ? "default" : "outline"}
                                size="sm"
                                onClick={() => setRiskLevel(level)}
                                className="flex-1 capitalize"
                                data-testid={`button-risk-${level}`}
                              >
                                {level}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-muted/50 rounded-md space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Recommended allocation</span>
                            <span className="font-mono font-medium">
                              $
                              {(
                                parseFloat(amount) *
                                (riskLevel === "low" ? 0.5 : riskLevel === "medium" ? 0.75 : 1)
                              ).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Expected return</span>
                            <span className="font-mono font-medium text-emerald-500">
                              +$
                              {(
                                parseFloat(amount) *
                                (riskLevel === "low" ? 0.5 : riskLevel === "medium" ? 0.75 : 1) *
                                (aiInsight.edgeBps / 10000)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {walletAddress ? (
                          <Button
                            className="w-full"
                            onClick={handleExecuteStrategy}
                            disabled={executeStrategyMutation.isPending}
                            data-testid="button-execute-strategy"
                          >
                            {executeStrategyMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Executing...
                              </>
                            ) : (
                              <>
                                <Zap className="h-4 w-4 mr-2" />
                                Create Strategy Intent
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="text-center p-4 border border-dashed border-border rounded-md">
                            <p className="text-muted-foreground text-sm">
                              Connect wallet above to execute on Base
                            </p>
                          </div>
                        )}

                        {executeStrategyMutation.isSuccess && executeStrategyMutation.data?.txHash && (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                            <p className="text-sm text-emerald-500 mb-2">Strategy executed successfully!</p>
                            <a
                              href={`https://sepolia.basescan.org/tx/${executeStrategyMutation.data.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-primary hover:underline flex items-center gap-1"
                            >
                              {executeStrategyMutation.data.txHash.slice(0, 20)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No AI insights available for this market</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
