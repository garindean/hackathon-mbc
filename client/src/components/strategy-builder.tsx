import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Briefcase, 
  X, 
  AlertTriangle, 
  Shield, 
  Flame,
  ArrowRight,
  DollarSign,
  TrendingUp
} from "lucide-react";
import type { SignalWithActions } from "@shared/schema";
import { cn } from "@/lib/utils";

interface StrategyBuilderProps {
  selectedSignals: SignalWithActions[];
  onRemoveSignal: (signalId: string) => void;
  onAllocationChange: (signalId: string, amount: number) => void;
  onReviewStrategy: () => void;
  totalAllocation: number;
  isLoading?: boolean;
}

function getRiskLevel(signals: SignalWithActions[]): { level: string; color: string; icon: React.ReactNode } {
  if (signals.length === 0) {
    return { level: "None", color: "text-muted-foreground", icon: null };
  }
  
  const avgEdge = signals.reduce((sum, s) => sum + Math.abs(s.edgeBps), 0) / signals.length;
  
  if (avgEdge < 500) {
    return { 
      level: "Low", 
      color: "text-chart-3", 
      icon: <Shield className="h-4 w-4" /> 
    };
  } else if (avgEdge < 1000) {
    return { 
      level: "Medium", 
      color: "text-chart-5", 
      icon: <AlertTriangle className="h-4 w-4" /> 
    };
  } else {
    return { 
      level: "High", 
      color: "text-destructive", 
      icon: <Flame className="h-4 w-4" /> 
    };
  }
}

export function StrategyBuilder({
  selectedSignals,
  onRemoveSignal,
  onAllocationChange,
  onReviewStrategy,
  totalAllocation,
  isLoading
}: StrategyBuilderProps) {
  const riskInfo = getRiskLevel(selectedSignals);
  const weightedEdge = selectedSignals.length > 0
    ? selectedSignals.reduce((sum, s) => sum + (s.edgeBps * (s.allocation || 0)), 0) / 
      Math.max(totalAllocation, 1)
    : 0;

  return (
    <Card className="sticky top-20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Your Strategy</h3>
          </div>
          <Badge variant="secondary" data-testid="badge-signal-count">
            {selectedSignals.length} signals
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {selectedSignals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No signals selected yet</p>
            <p className="text-xs mt-1">Add signals to build your strategy</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {selectedSignals.map((signal) => (
              <div 
                key={signal.id}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                data-testid={`strategy-signal-${signal.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{signal.marketQuestion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className="text-xs font-mono"
                    >
                      {signal.side}
                    </Badge>
                    <span className={cn(
                      "text-xs font-mono",
                      signal.edgeBps > 0 ? "text-chart-3" : "text-destructive"
                    )}>
                      {signal.edgeBps > 0 ? "+" : ""}{(signal.edgeBps / 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-24">
                    <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={signal.allocation || 0}
                      onChange={(e) => onAllocationChange(signal.id, parseFloat(e.target.value) || 0)}
                      className="h-8 pl-6 pr-2 text-right font-mono text-sm"
                      data-testid={`input-strategy-allocation-${signal.id}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onRemoveSignal(signal.id)}
                    data-testid={`button-remove-strategy-signal-${signal.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Allocation</span>
            <span className="font-mono font-semibold text-lg" data-testid="text-total-allocation">
              ${totalAllocation.toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Weighted Avg Edge</span>
            <span className={cn(
              "font-mono font-medium",
              weightedEdge > 0 ? "text-chart-3" : "text-muted-foreground"
            )} data-testid="text-weighted-edge">
              {weightedEdge > 0 ? "+" : ""}{(weightedEdge / 100).toFixed(2)}%
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Risk Level</span>
            <div className={cn("flex items-center gap-1", riskInfo.color)} data-testid="text-risk-level">
              {riskInfo.icon}
              <span className="font-medium">{riskInfo.level}</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full gap-2"
          size="lg"
          disabled={selectedSignals.length === 0 || totalAllocation === 0 || isLoading}
          onClick={onReviewStrategy}
          data-testid="button-review-strategy"
        >
          <TrendingUp className="h-4 w-4" />
          Review & Execute
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
