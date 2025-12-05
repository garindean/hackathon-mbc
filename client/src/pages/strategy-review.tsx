import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { useWriteContracts, useCallsStatus, useCapabilities } from "wagmi/experimental";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BacktestingPanel } from "@/components/backtesting-panel";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { strategyRegistryAbi, STRATEGY_REGISTRY_ADDRESS } from "@/lib/contracts";
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Shield,
  Flame,
  Check,
  Loader2,
  ExternalLink,
  DollarSign,
  Sparkles
} from "lucide-react";
import type { Signal, Topic, SignalWithActions } from "@shared/schema";
import { cn } from "@/lib/utils";

interface StrategyData {
  topicId: string;
  signals: Array<{ signalId: string; allocation: number }>;
  totalAllocation: number;
}

interface StrategyReviewPageProps {
  walletAddress?: string | null;
}

export default function StrategyReviewPage({ walletAddress }: StrategyReviewPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executedTxHash, setExecutedTxHash] = useState<string | null>(null);
  const [useGasless, setUseGasless] = useState(true);

  const { isConnected, address, chainId } = useAccount();
  
  const { data: capabilities } = useCapabilities({ account: address });
  const chainCapabilities = chainId ? capabilities?.[chainId] : undefined;
  const hasPaymasterCapability = chainCapabilities?.paymasterService?.supported || false;

  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  
  const { 
    writeContracts, 
    data: batchId, 
    isPending: isBatchPending,
    error: batchError 
  } = useWriteContracts();

  const { data: callsStatus, isLoading: isCallsStatusLoading } = useCallsStatus({
    id: batchId as string,
    query: {
      enabled: !!batchId,
      refetchInterval: (data) => {
        const status = data.state.data?.status;
        if (status === "CONFIRMED" || status === "FAILED" || status === "REVERTED") {
          return false;
        }
        return 1000;
      },
    },
  });
  
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingStrategy");
    if (stored) {
      setStrategyData(JSON.parse(stored));
    } else {
      setLocation("/");
    }
  }, [setLocation]);

  useEffect(() => {
    if (!callsStatus) return;
    
    if (callsStatus.status === "CONFIRMED" && callsStatus.receipts?.[0]?.transactionHash) {
      setExecutedTxHash(callsStatus.receipts[0].transactionHash);
      sessionStorage.removeItem("pendingStrategy");
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsExecuting(false);
      toast({
        title: "Strategy Executed (Gasless)",
        description: "Your strategy has been recorded on Base Sepolia with sponsored gas!",
      });
    } else if (callsStatus.status === "FAILED" || callsStatus.status === "REVERTED") {
      setIsExecuting(false);
      toast({
        title: "Transaction Failed",
        description: `Gasless transaction ${callsStatus.status.toLowerCase()}. Please try again.`,
        variant: "destructive",
      });
    }
  }, [callsStatus, toast]);

  useEffect(() => {
    if (isTxSuccess && txHash) {
      setExecutedTxHash(txHash);
      sessionStorage.removeItem("pendingStrategy");
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({
        title: "Strategy Executed",
        description: "Your strategy has been recorded on Base Sepolia",
      });
    }
  }, [isTxSuccess, txHash, toast]);

  useEffect(() => {
    const error = writeError || batchError;
    if (error) {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to execute strategy",
        variant: "destructive",
      });
      setIsExecuting(false);
    }
  }, [writeError, batchError, toast]);

  const { data: topic } = useQuery<Topic>({
    queryKey: ["/api/topics", strategyData?.topicId],
    enabled: !!strategyData?.topicId,
  });

  const signalIds = strategyData?.signals.map(s => s.signalId) || [];
  const { data: signalsData } = useQuery<Signal[]>({
    queryKey: ["/api/signals", signalIds.join(",")],
    enabled: signalIds.length > 0,
  });

  const signals = useMemo(() => {
    if (!signalsData || !strategyData) return [];
    return signalsData.map(signal => {
      const strategySignal = strategyData.signals.find(s => s.signalId === signal.id);
      return {
        ...signal,
        allocation: strategySignal?.allocation || 0,
      };
    });
  }, [signalsData, strategyData]);

  const stats = useMemo(() => {
    if (!signals.length) return { weightedEdge: 0, riskLevel: "None", expectedValue: 0 };

    const totalAlloc = signals.reduce((sum, s) => sum + s.allocation, 0);
    const weightedEdge = totalAlloc > 0
      ? signals.reduce((sum, s) => sum + (s.edgeBps * s.allocation), 0) / totalAlloc
      : 0;
    
    const avgEdge = signals.reduce((sum, s) => sum + Math.abs(s.edgeBps), 0) / signals.length;
    
    let riskLevel = "Low";
    if (avgEdge >= 1000) riskLevel = "High";
    else if (avgEdge >= 500) riskLevel = "Medium";

    const expectedValue = (weightedEdge / 10000) * totalAlloc;

    return { weightedEdge, riskLevel, expectedValue };
  }, [signals]);

  const signalsWithActions: SignalWithActions[] = useMemo(() => {
    return signals.map(signal => ({
      ...signal,
      isSelected: true,
      allocation: signal.allocation,
    }));
  }, [signals]);

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!strategyData || !walletAddress) throw new Error("Missing data");
      
      return apiRequest("POST", "/api/strategies/execute", {
        userAddress: walletAddress,
        topicId: strategyData.topicId,
        signals: strategyData.signals,
        totalAllocation: strategyData.totalAllocation,
      });
    },
    onSuccess: (data: any) => {
      setExecutedTxHash(data.txHash);
      sessionStorage.removeItem("pendingStrategy");
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({
        title: "Strategy Executed",
        description: "Your strategy has been recorded",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute strategy",
        variant: "destructive",
      });
    },
  });

  const handleExecuteOnchain = async () => {
    if (!strategyData || !isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to execute onchain",
      });
      return;
    }

    if (STRATEGY_REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000") {
      toast({
        title: "Contract Not Deployed",
        description: "Using simulated execution. Deploy the contract for real onchain transactions.",
      });
      await handleExecuteSimulated();
      return;
    }

    const marketIds = signals.map(s => s.marketId);
    const allocations = signals.map(s => BigInt(Math.floor(s.allocation * 1e6)));
    const edgeBps = signals.map(s => BigInt(Math.abs(s.edgeBps)));

    if (useGasless && hasPaymasterCapability) {
      const paymasterUrl = import.meta.env.VITE_PAYMASTER_URL;
      if (!paymasterUrl) {
        toast({
          title: "Paymaster Not Configured",
          description: "Set VITE_PAYMASTER_URL environment variable for gasless transactions.",
          variant: "destructive",
        });
        return;
      }

      setIsExecuting(true);
      writeContracts({
        contracts: [
          {
            address: STRATEGY_REGISTRY_ADDRESS,
            abi: strategyRegistryAbi,
            functionName: "recordStrategy",
            args: [strategyData.topicId, marketIds, allocations, edgeBps],
          },
        ],
        capabilities: {
          paymasterService: {
            url: paymasterUrl,
          },
        },
      });
    } else {
      setIsExecuting(true);
      writeContract({
        address: STRATEGY_REGISTRY_ADDRESS,
        abi: strategyRegistryAbi,
        functionName: "recordStrategy",
        args: [strategyData.topicId, marketIds, allocations, edgeBps],
      });
    }
  };

  const handleExecuteSimulated = async () => {
    if (!walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to execute",
      });
      return;
    }
    setIsExecuting(true);
    try {
      await executeMutation.mutateAsync();
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecute = handleExecuteOnchain;

  const getRiskColor = (level: string) => {
    switch (level) {
      case "Low": return "text-chart-3";
      case "Medium": return "text-chart-5";
      case "High": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "Low": return <Shield className="h-4 w-4" />;
      case "Medium": return <AlertTriangle className="h-4 w-4" />;
      case "High": return <Flame className="h-4 w-4" />;
      default: return null;
    }
  };

  const isLoading = isExecuting || isWritePending || isBatchPending || isTxLoading || isCallsStatusLoading;

  if (!strategyData) {
    return null;
  }

  if (executedTxHash) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/10 mx-auto mb-4">
              <Check className="h-8 w-8 text-chart-3" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Strategy Executed!</h2>
            <p className="text-muted-foreground mb-6">
              Your strategy has been recorded on Base Sepolia
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Transaction Hash</p>
              <code className="text-sm font-mono break-all">{executedTxHash}</code>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(`https://sepolia.basescan.org/tx/${executedTxHash}`, "_blank")}
                data-testid="button-view-basescan"
              >
                <ExternalLink className="h-4 w-4" />
                View on BaseScan
              </Button>
              <Button onClick={() => setLocation("/history")} data-testid="button-view-history">
                View History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-8">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 mb-6"
        onClick={() => setLocation(-1)}
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" />
        Edit Strategy
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-review-title">
          Review Strategy
        </h1>
        <p className="text-muted-foreground">
          Review your strategy before executing on Base Sepolia
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{topic?.name || "Unknown Topic"}</Badge>
              <span className="text-sm text-muted-foreground">
                {signals.length} market{signals.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total</p>
              <p className="font-mono text-2xl font-semibold" data-testid="text-summary-total">
                ${strategyData.totalAllocation.toLocaleString()}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Edge</p>
              <p className={cn(
                "font-mono text-2xl font-semibold",
                stats.weightedEdge > 0 ? "text-chart-3" : "text-muted-foreground"
              )} data-testid="text-summary-edge">
                {stats.weightedEdge > 0 ? "+" : ""}{(stats.weightedEdge / 100).toFixed(2)}%
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Expected</p>
              <p className={cn(
                "font-mono text-2xl font-semibold",
                stats.expectedValue > 0 ? "text-chart-3" : "text-muted-foreground"
              )} data-testid="text-summary-ev">
                {stats.expectedValue > 0 ? "+" : ""}${stats.expectedValue.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Risk</p>
              <div className={cn("flex items-center justify-center gap-1", getRiskColor(stats.riskLevel))} data-testid="text-summary-risk">
                {getRiskIcon(stats.riskLevel)}
                <span className="text-2xl font-semibold">{stats.riskLevel}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-center">Side</TableHead>
                  <TableHead className="text-right">Odds</TableHead>
                  <TableHead className="text-right">Edge</TableHead>
                  <TableHead className="text-right">Allocation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <TableRow key={signal.id} data-testid={`row-signal-${signal.id}`}>
                    <TableCell className="max-w-xs">
                      <p className="font-medium truncate">{signal.marketQuestion}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{signal.side}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(signal.marketPrice * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      signal.edgeBps > 0 ? "text-chart-3" : "text-destructive"
                    )}>
                      {signal.edgeBps > 0 ? "+" : ""}{(signal.edgeBps / 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${signal.allocation.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BacktestingPanel 
        signals={signalsWithActions} 
        totalAllocation={strategyData.totalAllocation} 
      />

      <Card>
        <CardFooter className="flex-col gap-4 pt-6">
          {STRATEGY_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000" && (
            <div className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-chart-3" />
                <Label htmlFor="gasless-toggle" className="text-sm font-medium">
                  Gasless Transaction
                </Label>
                <Badge variant="secondary" className="text-xs">
                  {hasPaymasterCapability ? "Available" : "Smart Wallet Required"}
                </Badge>
              </div>
              <Switch
                id="gasless-toggle"
                checked={useGasless}
                onCheckedChange={setUseGasless}
                disabled={!hasPaymasterCapability}
                data-testid="switch-gasless"
              />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <div className="text-sm text-muted-foreground">
              {STRATEGY_REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000" 
                ? "Simulated execution (contract not deployed)"
                : useGasless && hasPaymasterCapability 
                  ? "Gasless execution on Base Sepolia (sponsored)" 
                  : "Executing on Base Sepolia testnet"}
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2"
              onClick={handleExecute}
              disabled={isLoading || !walletAddress}
              data-testid="button-execute"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isTxLoading || isCallsStatusLoading ? "Confirming..." : "Executing..."}
                </>
              ) : useGasless && hasPaymasterCapability ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Execute Gasless
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Execute Strategy on Base
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
