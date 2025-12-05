import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  X, 
  Clock,
  ArrowRight,
  DollarSign
} from "lucide-react";
import type { Signal, SignalWithActions } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SignalCardProps {
  signal: SignalWithActions;
  onAdd: (signalId: string) => void;
  onRemove: (signalId: string) => void;
  onDismiss: (signalId: string) => void;
  onAllocationChange?: (signalId: string, amount: number) => void;
  showAllocationInput?: boolean;
  isLoading?: boolean;
}

export function SignalCard({ 
  signal, 
  onAdd, 
  onRemove, 
  onDismiss,
  onAllocationChange,
  showAllocationInput = false,
  isLoading 
}: SignalCardProps) {
  const edge = signal.edgeBps / 100;
  const isPositiveEdge = signal.edgeBps > 0;
  const marketPricePercent = (signal.marketPrice * 100).toFixed(1);
  const aiFairPricePercent = (signal.aiFairPrice * 100).toFixed(1);

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        signal.isSelected && "ring-2 ring-primary"
      )}
      data-testid={`card-signal-${signal.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base leading-snug" data-testid={`text-signal-question-${signal.id}`}>
              {signal.marketQuestion}
            </h4>
            {signal.endDate && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Ends {format(new Date(signal.endDate), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
          <Badge 
            variant={isPositiveEdge ? "default" : "secondary"}
            className={cn(
              "shrink-0 font-mono text-sm",
              isPositiveEdge 
                ? "bg-chart-3/10 text-chart-3 border-chart-3/20" 
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}
            data-testid={`badge-edge-${signal.id}`}
          >
            {isPositiveEdge ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            {isPositiveEdge ? "+" : ""}{edge.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Market Odds</p>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold" data-testid={`text-market-price-${signal.id}`}>
                {marketPricePercent}%
              </span>
              <Badge variant="outline" className="text-xs font-normal">
                {signal.side}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">AI Fair Price</p>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-2xl font-semibold text-primary" data-testid={`text-ai-price-${signal.id}`}>
                {aiFairPricePercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-explanation-${signal.id}`}>
            {signal.explanation}
          </p>
        </div>

        {signal.volume && signal.liquidity && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>Vol: ${signal.volume.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Liq: ${signal.liquidity.toLocaleString()}</span>
            </div>
          </div>
        )}

        {showAllocationInput && signal.isSelected && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">Allocation:</span>
            <div className="relative flex-1 max-w-32">
              <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                step="10"
                value={signal.allocation || 0}
                onChange={(e) => onAllocationChange?.(signal.id, parseFloat(e.target.value) || 0)}
                className="pl-7 font-mono text-right"
                placeholder="0"
                data-testid={`input-allocation-${signal.id}`}
              />
            </div>
            <span className="text-sm text-muted-foreground">USDC</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {signal.isSelected ? (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => onRemove(signal.id)}
              disabled={isLoading}
              data-testid={`button-remove-signal-${signal.id}`}
            >
              <X className="mr-1 h-4 w-4" />
              Remove from Strategy
            </Button>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => onAdd(signal.id)}
                disabled={isLoading}
                data-testid={`button-add-signal-${signal.id}`}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add to Strategy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(signal.id)}
                disabled={isLoading}
                data-testid={`button-dismiss-signal-${signal.id}`}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
