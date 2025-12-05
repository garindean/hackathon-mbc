import { Link, useLocation } from "wouter";
import { TrendingUp, History, Menu, X, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  walletAddress?: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function Navigation({ walletAddress, onConnect, onDisconnect }: NavigationProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Topics", icon: TrendingUp },
    { href: "/portfolio", label: "Portfolio", icon: PieChart },
    { href: "/history", label: "History", icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg hidden sm:block">EdgeFinder</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href || 
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid={`nav-link-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:block">
              <WalletButton
                address={walletAddress}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-link-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
            <div className="pt-2 border-t">
              <WalletButton
                address={walletAddress}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
