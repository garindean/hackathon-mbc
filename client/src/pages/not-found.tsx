import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-6">
        This page doesn't exist or has been moved
      </p>
      <Link href="/">
        <Button className="gap-2" data-testid="button-go-home">
          <ArrowLeft className="h-4 w-4" />
          Back to Topics
        </Button>
      </Link>
    </div>
  );
}
