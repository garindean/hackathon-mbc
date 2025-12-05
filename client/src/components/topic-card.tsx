import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Globe, 
  Coins, 
  Vote, 
  Zap, 
  Building2,
  Users,
  Sparkles,
  Star,
  StarOff
} from "lucide-react";
import type { TopicWithSubscription } from "@shared/schema";
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

interface TopicCardProps {
  topic: TopicWithSubscription;
  onSubscribe: (topicId: string) => void;
  onUnsubscribe: (topicId: string) => void;
  onClick: () => void;
  isLoading?: boolean;
}

export function TopicCard({ 
  topic, 
  onSubscribe, 
  onUnsubscribe, 
  onClick,
  isLoading 
}: TopicCardProps) {
  const IconComponent = iconMap[topic.iconName || "TrendingUp"] || TrendingUp;

  const handleSubscribeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (topic.isSubscribed) {
      onUnsubscribe(topic.id);
    } else {
      onSubscribe(topic.id);
    }
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover-elevate",
        topic.isSubscribed && "ring-1 ring-primary/20"
      )}
      onClick={onClick}
      data-testid={`card-topic-${topic.id}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <IconComponent className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg leading-tight truncate" data-testid={`text-topic-name-${topic.id}`}>
              {topic.name}
            </h3>
          </div>
        </div>
        <Button
          variant={topic.isSubscribed ? "secondary" : "ghost"}
          size="icon"
          onClick={handleSubscribeClick}
          disabled={isLoading}
          className={cn(
            "shrink-0",
            topic.isSubscribed && "text-primary"
          )}
          data-testid={`button-subscribe-${topic.id}`}
        >
          {topic.isSubscribed ? (
            <Star className="h-4 w-4 fill-current" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {topic.description && (
          <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-topic-description-${topic.id}`}>
            {topic.description}
          </p>
        )}
        
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge 
            variant="secondary" 
            className="text-xs"
            data-testid={`badge-signal-count-${topic.id}`}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {topic.activeSignalCount || 0} signals
          </Badge>
          
          {topic.keywords && topic.keywords.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {topic.keywords.slice(0, 2).map((keyword, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-xs font-normal"
                >
                  {keyword}
                </Badge>
              ))}
              {topic.keywords.length > 2 && (
                <Badge variant="outline" className="text-xs font-normal">
                  +{topic.keywords.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
