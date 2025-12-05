import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface WalletButtonProps {
  address?: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function WalletButton({ address, onConnect, onDisconnect }: WalletButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      onConnect?.();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const handleViewOnBaseScan = () => {
    if (address) {
      window.open(`https://sepolia.basescan.org/address/${address}`, "_blank");
    }
  };

  if (!address) {
    return (
      <Button 
        onClick={handleConnect} 
        disabled={isConnecting}
        className="gap-2"
        data-testid="button-connect-wallet"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-wallet-menu">
          <div className="h-2 w-2 rounded-full bg-chart-3" />
          <span className="font-mono text-sm">{truncateAddress(address)}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyAddress} data-testid="menu-item-copy-address">
          <Copy className="mr-2 h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewOnBaseScan} data-testid="menu-item-view-basescan">
          <ExternalLink className="mr-2 h-4 w-4" />
          View on BaseScan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDisconnect} className="text-destructive" data-testid="menu-item-disconnect">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
