import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SignalCard } from "@/components/signal-card";
import { StrategyBuilder } from "@/components/strategy-builder";
import { StrategyTemplates } from "@/components/strategy-templates";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Star, 
  StarOff, 
  RefreshCw,
  TrendingUp,
  Globe,
  Coins,
  Vote,
  Zap,
  Building2,
  Users,
  Sparkles,
  Bell,
  BellRing
} from "lucide-react";
import type { Topic, Signal, SignalWithActions, TopicWithSubscription } from "@shared/schema";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Globe,
  Coins,
  Vote,
  Zap,
  Building2,
  Users,
  Sparkles,
};

interface TopicDetailPageProps {
  walletAddress?: string | null;
}

const AUTO_REFRESH_INTERVAL = 30000;

export default function TopicDetailPage({ walletAddress }: TopicDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedSignals, setSelectedSignals] = useState<Map<string, SignalWithActions>>(new Map());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const prevSignalCountRef = useRef<number | null>(null);

  const { data: topic, isLoading: topicLoading } = useQuery<TopicWithSubscription>({
    queryKey: ["/api/topics", id, walletAddress],
  });

  const { data: signals, isLoading: signalsLoading, refetch: refetchSignals, dataUpdatedAt } = useQuery<Signal[]>({
    queryKey: ["/api/topics", id, "signals"],
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
  });

  useEffect(() => {
    if (!signals || signalsLoading) return;
    
    const activeCount = signals.filter(s => s.status === "active").length;
    
    if (prevSignalCountRef.current !== null && activeCount > prevSignalCountRef.current && notificationsEnabled) {
      const newCount = activeCount - prevSignalCountRef.current;
      toast({
        title: "New Signals Detected",
        description: `${newCount} new trading signal${newCount > 1 ? 's' : ''} available`,
      });
    }
    
    prevSignalCountRef.current = activeCount;
  }, [signals, signalsLoading, notificationsEnabled, toast]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/topics/${id}/subscribe`, { 
        userAddress: walletAddress 
      });
    },
    onSuccess: () => {
      // Invalidate all topic queries to refresh subscription state
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      toast({
        title: "Subscribed",
        description: "You're now following this topic",
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/topics/${id}/subscribe`, { 
        userAddress: walletAddress 
      });
    },
    onSuccess: () => {
      // Invalidate all topic queries to refresh subscription state
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      toast({
        title: "Unsubscribed",
        description: "You're no longer following this topic",
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/topics/${id}/scan`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "signals"] });
      toast({
        title: "Scan Complete",
        description: "New signals have been detected",
      });
    },
    onError: () => {
      toast({
        title: "Scan Failed",
        description: "Failed to scan for new signals",
        variant: "destructive",
      });
    },
  });

  const signalsWithActions: SignalWithActions[] = useMemo(() => {
    if (!signals) return [];
    return signals
      .filter(s => s.status === "active")
      .map(signal => ({
        ...signal,
        isSelected: selectedSignals.has(signal.id),
        allocation: selectedSignals.get(signal.id)?.allocation || 0,
      }));
  }, [signals, selectedSignals]);

  const handleAddSignal = (signalId: string) => {
    const signal = signals?.find(s => s.id === signalId);
    if (signal) {
      setSelectedSignals(prev => {
        const newMap = new Map(prev);
        newMap.set(signalId, { ...signal, isSelected: true, allocation: 100 });
        return newMap;
      });
    }
  };

  const handleRemoveSignal = (signalId: string) => {
    setSelectedSignals(prev => {
      const newMap = new Map(prev);
      newMap.delete(signalId);
      return newMap;
    });
  };

  const handleDismissSignal = async (signalId: string) => {
    try {
      await apiRequest("PATCH", `/api/signals/${signalId}`, { status: "dismissed" });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "signals"] });
    } catch {
      toast({
        title: "Error",
        description: "Failed to dismiss signal",
        variant: "destructive",
      });
    }
  };

  const handleAllocationChange = (signalId: string, amount: number) => {
    setSelectedSignals(prev => {
      const newMap = new Map(prev);
      const signal = newMap.get(signalId);
      if (signal) {
        newMap.set(signalId, { ...signal, allocation: amount });
      }
      return newMap;
    });
  };

  const handleApplyTemplate = (newSelections: Map<string, SignalWithActions>) => {
    setSelectedSignals(newSelections);
    toast({
      title: "Template Applied",
      description: `${newSelections.size} signals selected with auto-allocation`,
    });
  };

  const totalAllocation = useMemo(() => {
    return Array.from(selectedSignals.values()).reduce((sum, s) => sum + (s.allocation || 0), 0);
  }, [selectedSignals]);

  const handleReviewStrategy = () => {
    if (!walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to execute strategies",
      });
      return;
    }

    const strategyData = {
      topicId: id,
      signals: Array.from(selectedSignals.values()).map(s => ({
        signalId: s.id,
        allocation: s.allocation,
      })),
      totalAllocation,
    };

    sessionStorage.setItem("pendingStrategy", JSON.stringify(strategyData));
    setLocation("/strategy/review");
  };

  const handleSubscribeToggle = () => {
    if (!walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to follow topics",
      });
      return;
    }
    if (topic?.isSubscribed) {
      unsubscribeMutation.mutate();
    } else {
      subscribeMutation.mutate();
    }
  };

  if (topicLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <PageLoadingSkeleton type="signals" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <EmptyState type="no-topics" onAction={() => setLocation("/")} />
      </div>
    );
  }

  const IconComponent = iconMap[topic.iconName || "TrendingUp"] || TrendingUp;

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 mb-4"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Topics
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <IconComponent className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1" data-testid="text-topic-title">
                {topic.name}
              </h1>
              {topic.description && (
                <p className="text-muted-foreground max-w-2xl">{topic.description}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", autoRefresh && "text-chart-3")} />
              <span className="text-xs text-muted-foreground">Auto</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
                data-testid="switch-auto-refresh"
              />
            </div>
            <Button
              size="icon"
              variant={notificationsEnabled ? "secondary" : "ghost"}
              className="toggle-elevate"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              title={notificationsEnabled ? "Notifications on" : "Notifications off"}
              data-testid="button-notifications"
            >
              {notificationsEnabled ? (
                <BellRing className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              data-testid="button-scan"
            >
              <RefreshCw className={cn("h-4 w-4", scanMutation.isPending && "animate-spin")} />
              {scanMutation.isPending ? "Scanning..." : "Scan"}
            </Button>
            <Button
              variant={topic.isSubscribed ? "secondary" : "outline"}
              size="sm"
              className="gap-2"
              onClick={handleSubscribeToggle}
              disabled={subscribeMutation.isPending || unsubscribeMutation.isPending}
              data-testid="button-follow"
            >
              {topic.isSubscribed ? (
                <>
                  <Star className="h-4 w-4 fill-current" />
                  Following
                </>
              ) : (
                <>
                  <StarOff className="h-4 w-4" />
                  Follow
                </>
              )}
            </Button>
          </div>
        </div>

        {topic.keywords && topic.keywords.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-4">
            {topic.keywords.map((keyword, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Active Signals</h2>
              <Badge variant="secondary">
                {signalsWithActions.length} available
              </Badge>
            </div>
            {dataUpdatedAt && (
              <span className="text-xs text-muted-foreground font-mono" data-testid="text-last-updated">
                Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {signalsLoading ? (
            <PageLoadingSkeleton type="signals" />
          ) : signalsWithActions.length === 0 ? (
            <EmptyState 
              type="no-signals" 
              onAction={() => scanMutation.mutate()}
            />
          ) : (
            <div className="space-y-4">
              {signalsWithActions.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onAdd={handleAddSignal}
                  onRemove={handleRemoveSignal}
                  onDismiss={handleDismissSignal}
                  showAllocationInput={false}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 lg:mt-0 space-y-6">
          {signalsWithActions.length > 0 && (
            <StrategyTemplates
              signals={signalsWithActions}
              onApplyTemplate={handleApplyTemplate}
              currentSelectedCount={selectedSignals.size}
            />
          )}
          <StrategyBuilder
            selectedSignals={Array.from(selectedSignals.values())}
            onRemoveSignal={handleRemoveSignal}
            onAllocationChange={handleAllocationChange}
            onReviewStrategy={handleReviewStrategy}
            totalAllocation={totalAllocation}
          />
        </div>
      </div>
    </div>
  );
}
