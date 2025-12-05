import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TopicCard } from "@/components/topic-card";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TopicWithSubscription } from "@shared/schema";

interface TopicsPageProps {
  walletAddress?: string | null;
}

export default function TopicsPage({ walletAddress }: TopicsPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: topics, isLoading, error } = useQuery<TopicWithSubscription[]>({
    queryKey: ["/api/topics", walletAddress],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return apiRequest("POST", `/api/topics/${topicId}/subscribe`, { 
        userAddress: walletAddress 
      });
    },
    onSuccess: (_, topicId) => {
      // Invalidate all topic queries to refresh subscription state
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      toast({
        title: "Subscribed",
        description: "You're now following this topic",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to subscribe to topic",
        variant: "destructive",
      });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return apiRequest("DELETE", `/api/topics/${topicId}/subscribe`, { 
        userAddress: walletAddress 
      });
    },
    onSuccess: (_, topicId) => {
      // Invalidate all topic queries to refresh subscription state
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      toast({
        title: "Unsubscribed",
        description: "You're no longer following this topic",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unsubscribe from topic",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (topicId: string) => {
    if (!walletAddress) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to follow topics",
      });
      return;
    }
    subscribeMutation.mutate(topicId);
  };

  const handleUnsubscribe = (topicId: string) => {
    if (!walletAddress) return;
    unsubscribeMutation.mutate(topicId);
  };

  const handleTopicClick = (topicId: string) => {
    setLocation(`/topics/${topicId}`);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Topics</h1>
          <p className="text-muted-foreground">
            Discover AI-detected mispricing opportunities across prediction markets
          </p>
        </div>
        <PageLoadingSkeleton type="topics" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
        <EmptyState type="no-topics" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-page-title">
          Topics
        </h1>
        <p className="text-muted-foreground">
          Discover AI-detected mispricing opportunities across prediction markets
        </p>
      </div>

      {!topics || topics.length === 0 ? (
        <EmptyState type="no-topics" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onSubscribe={handleSubscribe}
              onUnsubscribe={handleUnsubscribe}
              onClick={() => handleTopicClick(topic.id)}
              isLoading={subscribeMutation.isPending || unsubscribeMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
