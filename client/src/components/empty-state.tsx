import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Sparkles, 
  History, 
  Star,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateType = "no-topics" | "no-signals" | "no-history" | "not-following";

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
  className?: string;
}

const emptyStateConfig: Record<EmptyStateType, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
}> = {
  "no-topics": {
    icon: <TrendingUp className="h-12 w-12 text-muted-foreground/50" />,
    title: "No Topics Available",
    description: "Topics will appear here once they're added to the system.",
  },
  "no-signals": {
    icon: <Sparkles className="h-12 w-12 text-muted-foreground/50" />,
    title: "No Active Signals",
    description: "Our AI hasn't detected any mispricing opportunities in this topic yet. Check back later or scan for new signals.",
    actionLabel: "Scan for Signals",
  },
  "no-history": {
    icon: <History className="h-12 w-12 text-muted-foreground/50" />,
    title: "No Strategy History",
    description: "You haven't executed any strategies yet. Find mispricing opportunities and build your first strategy.",
    actionLabel: "Explore Topics",
  },
  "not-following": {
    icon: <Star className="h-12 w-12 text-muted-foreground/50" />,
    title: "Not Following Any Topics",
    description: "Follow topics to get notified about new signals and opportunities.",
    actionLabel: "Browse Topics",
  },
};

export function EmptyState({ type, onAction, className }: EmptyStateProps) {
  const config = emptyStateConfig[type];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-4",
      className
    )} data-testid={`empty-state-${type}`}>
      <div className="mb-4">{config.icon}</div>
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {config.description}
      </p>
      {config.actionLabel && onAction && (
        <Button onClick={onAction} className="gap-2" data-testid={`button-empty-action-${type}`}>
          {config.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
