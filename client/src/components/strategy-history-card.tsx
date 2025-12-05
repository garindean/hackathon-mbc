import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign
} from "lucide-react";
import type { StrategyWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

interface StrategyHistoryCardProps {
  strategy: StrategyWithDetails;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  executed: {
    label: "Executed",
    color: "text-chart-3 bg-chart-3/10 border-chart-3/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  pending: {
    label: "Pending",
    color: "text-chart-5 bg-chart-5/10 border-chart-5/20",
    icon: <Clock className="h-3 w-3" />,
  },
  failed: {
    label: "Failed",
    color: "text-destructive bg-destructive/10 border-destructive/20",
    icon: <XCircle className="h-3 w-3" />,
  },
  draft: {
    label: "Draft",
    color: "text-muted-foreground bg-muted border-muted",
    icon: <Clock className="h-3 w-3" />,
  },
};

export function StrategyHistoryCard({ strategy }: StrategyHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = statusConfig[strategy.status] || statusConfig.draft;
  const signalCount = strategy.signals?.length || 0;

  return (
    <Card 
      className="transition-all duration-200"
      data-testid={`card-history-${strategy.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {strategy.topic?.name || "Unknown Topic"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(strategy.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-semibold text-lg" data-testid={`text-strategy-amount-${strategy.id}`}>
                  ${strategy.totalAllocation.toLocaleString()}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {signalCount} market{signalCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Badge 
            variant="outline"
            className={cn("shrink-0 gap-1", status.color)}
            data-testid={`badge-status-${strategy.id}`}
          >
            {status.icon}
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid={`button-expand-${strategy.id}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Details
              </>
            )}
          </Button>
          
          {strategy.txHash && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => window.open(`https://sepolia.basescan.org/tx/${strategy.txHash}`, "_blank")}
              data-testid={`button-basescan-${strategy.id}`}
            >
              <ExternalLink className="h-3 w-3" />
              BaseScan
            </Button>
          )}
        </div>

        {isExpanded && strategy.signals && strategy.signals.length > 0 && (
          <div className="rounded-md border bg-muted/30 divide-y">
            {strategy.signals.map((ss) => (
              <div 
                key={ss.id} 
                className="flex items-center justify-between gap-4 p-3"
                data-testid={`history-signal-${ss.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ss.signal?.marketQuestion || "Unknown Market"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {ss.signal?.side || "N/A"}
                    </Badge>
                    {ss.signal && (
                      <span className={cn(
                        "text-xs font-mono",
                        ss.signal.edgeBps > 0 ? "text-chart-3" : "text-destructive"
                      )}>
                        {ss.signal.edgeBps > 0 ? "+" : ""}{(ss.signal.edgeBps / 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-medium">
                    ${ss.usdcAllocation.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
