import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from "recharts";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Target,
  Percent,
  DollarSign
} from "lucide-react";
import type { SignalWithActions } from "@shared/schema";
import { cn } from "@/lib/utils";

interface BacktestingPanelProps {
  signals: SignalWithActions[];
  totalAllocation: number;
}

type SimulationMode = "conservative" | "expected" | "optimistic";

interface SimulationResult {
  day: number;
  conservative: number;
  expected: number;
  optimistic: number;
}

interface ScenarioStats {
  finalValue: number;
  totalReturn: number;
  returnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

function calculateEdgeWinProbability(edgeBps: number): number {
  const edge = Math.abs(edgeBps) / 10000;
  return Math.min(0.5 + edge * 0.8, 0.85);
}

function runMonteCarloSimulation(
  signals: SignalWithActions[],
  totalAllocation: number,
  days: number,
  mode: SimulationMode
): SimulationResult[] {
  const results: SimulationResult[] = [];
  
  const modeMultipliers = {
    conservative: { win: 0.7, loss: 1.3 },
    expected: { win: 1.0, loss: 1.0 },
    optimistic: { win: 1.3, loss: 0.7 },
  };
  
  let conservativeValue = totalAllocation;
  let expectedValue = totalAllocation;
  let optimisticValue = totalAllocation;
  
  results.push({
    day: 0,
    conservative: conservativeValue,
    expected: expectedValue,
    optimistic: optimisticValue,
  });
  
  if (signals.length === 0 || totalAllocation === 0) {
    for (let day = 1; day <= days; day++) {
      results.push({
        day,
        conservative: totalAllocation,
        expected: totalAllocation,
        optimistic: totalAllocation,
      });
    }
    return results;
  }
  
  const avgEdge = signals.reduce((sum, s) => sum + Math.abs(s.edgeBps), 0) / signals.length;
  const avgAllocation = signals.reduce((sum, s) => sum + (s.allocation || 0), 0) / signals.length;
  const winProb = calculateEdgeWinProbability(avgEdge);
  
  const dailyVolatility = 0.02;
  const drift = (avgEdge / 10000) / days;
  
  for (let day = 1; day <= days; day++) {
    const randomConservative = Math.random();
    const randomExpected = Math.random();
    const randomOptimistic = Math.random();
    
    const conservativeWin = randomConservative < winProb * modeMultipliers.conservative.win;
    const expectedWin = randomExpected < winProb;
    const optimisticWin = randomOptimistic < winProb * modeMultipliers.optimistic.win;
    
    const conservativeReturn = conservativeWin 
      ? drift * modeMultipliers.conservative.win 
      : -drift * modeMultipliers.conservative.loss;
    const expectedReturn = expectedWin 
      ? drift 
      : -drift;
    const optimisticReturn = optimisticWin 
      ? drift * modeMultipliers.optimistic.win 
      : -drift * modeMultipliers.optimistic.loss;
    
    const noise = (Math.random() - 0.5) * dailyVolatility;
    
    conservativeValue = Math.max(0, conservativeValue * (1 + conservativeReturn + noise * 0.5));
    expectedValue = Math.max(0, expectedValue * (1 + expectedReturn + noise));
    optimisticValue = Math.max(0, optimisticValue * (1 + optimisticReturn + noise * 1.5));
    
    results.push({
      day,
      conservative: Math.round(conservativeValue * 100) / 100,
      expected: Math.round(expectedValue * 100) / 100,
      optimistic: Math.round(optimisticValue * 100) / 100,
    });
  }
  
  return results;
}

function calculateStats(
  data: SimulationResult[],
  mode: SimulationMode,
  initialValue: number
): ScenarioStats {
  const values = data.map(d => d[mode]);
  const finalValue = values[values.length - 1];
  const totalReturn = finalValue - initialValue;
  const returnPercent = (totalReturn / initialValue) * 100;
  
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  
  let maxDrawdown = 0;
  let peak = values[0];
  for (const value of values) {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  const positiveReturns = returns.filter(r => r > 0).length;
  const winRate = (positiveReturns / returns.length) * 100;
  
  return {
    finalValue: Math.round(finalValue * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    returnPercent: Math.round(returnPercent * 10) / 10,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 1000) / 10,
    winRate: Math.round(winRate),
  };
}

export function BacktestingPanel({ signals, totalAllocation }: BacktestingPanelProps) {
  const [timeframe, setTimeframe] = useState<string>("30");
  const [selectedMode, setSelectedMode] = useState<SimulationMode>("expected");
  
  const simulationData = useMemo(() => {
    const days = parseInt(timeframe, 10);
    return runMonteCarloSimulation(signals, totalAllocation, days, selectedMode);
  }, [signals, totalAllocation, timeframe]);
  
  const stats = useMemo(() => {
    return {
      conservative: calculateStats(simulationData, "conservative", totalAllocation),
      expected: calculateStats(simulationData, "expected", totalAllocation),
      optimistic: calculateStats(simulationData, "optimistic", totalAllocation),
    };
  }, [simulationData, totalAllocation]);
  
  const currentStats = stats[selectedMode];
  const isPositive = currentStats.totalReturn >= 0;
  
  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Backtesting</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">Select signals to run backtest simulation</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Backtesting</h3>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-28" data-testid="select-timeframe">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(["conservative", "expected", "optimistic"] as SimulationMode[]).map((mode) => {
            const modeStats = stats[mode];
            const modePositive = modeStats.totalReturn >= 0;
            return (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={cn(
                  "flex-1 p-3 rounded-md border text-center transition-all",
                  "hover-elevate active-elevate-2",
                  selectedMode === mode 
                    ? "border-primary bg-primary/5" 
                    : "border-border"
                )}
                data-testid={`button-mode-${mode}`}
              >
                <p className="text-xs text-muted-foreground capitalize mb-1">{mode}</p>
                <p className={cn(
                  "font-mono font-semibold",
                  modePositive ? "text-chart-3" : "text-destructive"
                )}>
                  {modePositive ? "+" : ""}{modeStats.returnPercent}%
                </p>
              </button>
            );
          })}
        </div>
        
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={simulationData}>
              <defs>
                <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, selectedMode]}
              />
              <ReferenceLine 
                y={totalAllocation} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3" 
              />
              <Area
                type="monotone"
                dataKey={selectedMode}
                stroke={isPositive ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"}
                fill={isPositive ? "url(#colorPositive)" : "url(#colorNegative)"}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              <span className="text-xs">Projected Value</span>
            </div>
            <p className="font-mono font-semibold" data-testid="text-projected-value">
              ${currentStats.finalValue.toLocaleString()}
            </p>
          </div>
          
          <div className="p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-chart-3" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <span className="text-xs">Total Return</span>
            </div>
            <p className={cn(
              "font-mono font-semibold",
              isPositive ? "text-chart-3" : "text-destructive"
            )} data-testid="text-total-return">
              {isPositive ? "+" : ""}${currentStats.totalReturn.toLocaleString()}
            </p>
          </div>
          
          <div className="p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              <span className="text-xs">Win Rate</span>
            </div>
            <p className="font-mono font-semibold" data-testid="text-win-rate">
              {currentStats.winRate}%
            </p>
          </div>
          
          <div className="p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Percent className="h-3 w-3" />
              <span className="text-xs">Max Drawdown</span>
            </div>
            <p className="font-mono font-semibold text-destructive" data-testid="text-max-drawdown">
              -{currentStats.maxDrawdown}%
            </p>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          Based on Monte Carlo simulation using signal edge values.
          Past performance does not guarantee future results.
        </div>
      </CardContent>
    </Card>
  );
}
