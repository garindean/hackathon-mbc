import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Scale, 
  Flame,
  Sparkles,
  Check,
  DollarSign,
  TrendingUp,
  Target
} from "lucide-react";
import type { SignalWithActions } from "@shared/schema";
import { cn } from "@/lib/utils";

export type RiskLevel = "conservative" | "balanced" | "aggressive";

interface StrategyTemplate {
  id: RiskLevel;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  maxPositions: number;
  minEdge: number;
  maxAllocationPercent: number;
  allocationStrategy: "equal" | "weighted" | "kelly";
}

const strategyTemplates: StrategyTemplate[] = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Lower risk, focus on high-confidence signals only",
    icon: <Shield className="h-5 w-5" />,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    maxPositions: 3,
    minEdge: 500,
    maxAllocationPercent: 20,
    allocationStrategy: "equal",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Moderate risk, diversified across multiple signals",
    icon: <Scale className="h-5 w-5" />,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
    maxPositions: 5,
    minEdge: 300,
    maxAllocationPercent: 30,
    allocationStrategy: "weighted",
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Higher risk, maximize exposure to best opportunities",
    icon: <Flame className="h-5 w-5" />,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    maxPositions: 10,
    minEdge: 100,
    maxAllocationPercent: 50,
    allocationStrategy: "kelly",
  },
];

interface StrategyTemplatesProps {
  signals: SignalWithActions[];
  onApplyTemplate: (selectedSignals: Map<string, SignalWithActions>) => void;
  currentSelectedCount: number;
}

export function StrategyTemplates({ 
  signals, 
  onApplyTemplate, 
  currentSelectedCount 
}: StrategyTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<RiskLevel | null>(null);
  const [totalBudget, setTotalBudget] = useState<number>(1000);
  const [isApplying, setIsApplying] = useState(false);

  const activeSignals = signals.filter(s => s.status === "active");

  const getEligibleSignals = (template: StrategyTemplate) => {
    return activeSignals
      .filter(s => Math.abs(s.edgeBps) >= template.minEdge)
      .sort((a, b) => Math.abs(b.edgeBps) - Math.abs(a.edgeBps))
      .slice(0, template.maxPositions);
  };

  const calculateAllocation = (
    signals: SignalWithActions[], 
    template: StrategyTemplate,
    budget: number
  ): Map<string, SignalWithActions> => {
    const result = new Map<string, SignalWithActions>();
    
    if (signals.length === 0) return result;

    const maxPerSignal = budget * (template.maxAllocationPercent / 100);
    
    switch (template.allocationStrategy) {
      case "equal": {
        const perSignal = Math.min(budget / signals.length, maxPerSignal);
        signals.forEach(signal => {
          result.set(signal.id, {
            ...signal,
            isSelected: true,
            allocation: Math.round(perSignal),
          });
        });
        break;
      }
      case "weighted": {
        const totalEdge = signals.reduce((sum, s) => sum + Math.abs(s.edgeBps), 0);
        signals.forEach(signal => {
          const weight = Math.abs(signal.edgeBps) / totalEdge;
          const allocation = Math.min(budget * weight, maxPerSignal);
          result.set(signal.id, {
            ...signal,
            isSelected: true,
            allocation: Math.round(allocation),
          });
        });
        break;
      }
      case "kelly": {
        const totalEdge = signals.reduce((sum, s) => sum + Math.abs(s.edgeBps), 0);
        const kellyMultiplier = 0.5;
        
        signals.forEach(signal => {
          const edgePercent = Math.abs(signal.edgeBps) / 10000;
          const kellyFraction = edgePercent * kellyMultiplier;
          const normalizedWeight = Math.abs(signal.edgeBps) / totalEdge;
          const allocation = Math.min(
            budget * kellyFraction + (budget * normalizedWeight * 0.3),
            maxPerSignal
          );
          result.set(signal.id, {
            ...signal,
            isSelected: true,
            allocation: Math.round(allocation),
          });
        });
        break;
      }
    }

    return result;
  };

  const handleApplyTemplate = (template: StrategyTemplate) => {
    setIsApplying(true);
    const eligibleSignals = getEligibleSignals(template);
    const allocatedSignals = calculateAllocation(eligibleSignals, template, totalBudget);
    
    setTimeout(() => {
      onApplyTemplate(allocatedSignals);
      setIsApplying(false);
    }, 300);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Strategy Templates</h3>
          </div>
          {currentSelectedCount > 0 && (
            <Badge variant="outline" className="font-mono">
              {currentSelectedCount} selected
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget" className="text-sm text-muted-foreground">
            Total Budget (USDC)
          </Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="budget"
              type="number"
              min="100"
              step="100"
              value={totalBudget}
              onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
              className="pl-9 font-mono"
              data-testid="input-template-budget"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          {strategyTemplates.map((template) => {
            const eligibleCount = getEligibleSignals(template).length;
            const isSelected = selectedTemplate === template.id;
            
            return (
              <button
                key={template.id}
                className={cn(
                  "w-full p-4 rounded-md border text-left transition-all",
                  "hover-elevate active-elevate-2",
                  isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border",
                  eligibleCount === 0 && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => eligibleCount > 0 && setSelectedTemplate(template.id)}
                disabled={eligibleCount === 0}
                data-testid={`button-template-${template.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    "rounded-md p-2",
                    template.bgColor
                  )}>
                    <span className={template.color}>{template.icon}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{template.name}</h4>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>Min edge: {(template.minEdge / 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>Max {template.maxPositions} positions</span>
                      </div>
                    </div>
                  </div>

                  <Badge 
                    variant={eligibleCount > 0 ? "secondary" : "outline"} 
                    className="shrink-0"
                  >
                    {eligibleCount} eligible
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {selectedTemplate && (
          <>
            <Separator />
            <Button
              className="w-full gap-2"
              onClick={() => {
                const template = strategyTemplates.find(t => t.id === selectedTemplate);
                if (template) handleApplyTemplate(template);
              }}
              disabled={isApplying}
              data-testid="button-apply-template"
            >
              {isApplying ? (
                <>
                  <span className="animate-spin">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  Applying...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Apply Template
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
