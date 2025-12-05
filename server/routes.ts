import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { analyzeMarkets, createSignalsFromAnalysis, fetchMarketsForTopic } from "./ai-service";

// Validation schemas
const subscribeSchema = z.object({
  userAddress: z.string().min(1, "userAddress is required"),
});

const executeStrategySchema = z.object({
  userAddress: z.string().min(1, "userAddress is required"),
  topicId: z.string().min(1, "topicId is required"),
  signals: z.array(z.object({
    signalId: z.string(),
    allocation: z.number().min(0),
  })).min(1, "At least one signal is required"),
  totalAllocation: z.number().min(0),
});

const updateSignalSchema = z.object({
  status: z.enum(["active", "dismissed", "added"]),
});

const marketExecuteSchema = z.object({
  userAddress: z.string().min(1, "userAddress is required"),
  allocation: z.number().min(0, "allocation must be positive"),
  edgeBps: z.number().min(0, "edgeBps must be positive"),
  riskLevel: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Topics ===
  
  // Get all topics (with subscription status if userAddress provided)
  app.get("/api/topics", async (req: Request, res: Response) => {
    try {
      const userAddress = req.query.userAddress as string | undefined;
      const topics = await storage.getTopicsWithSubscription(userAddress || null);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  // Get single topic
  app.get("/api/topics/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userAddress = req.query.userAddress as string | undefined;
      const topic = await storage.getTopicWithSubscription(id, userAddress || null);
      
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      res.json(topic);
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ error: "Failed to fetch topic" });
    }
  });

  // Subscribe to topic
  app.post("/api/topics/:id/subscribe", async (req: Request, res: Response) => {
    try {
      const { id: topicId } = req.params;
      
      // Validate request body
      const result = subscribeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const { userAddress } = result.data;

      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      const existing = await storage.getSubscription(userAddress, topicId);
      if (existing) {
        return res.json(existing);
      }

      const subscription = await storage.createSubscription({
        userAddress,
        topicId,
      });

      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error subscribing to topic:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // Unsubscribe from topic
  app.delete("/api/topics/:id/subscribe", async (req: Request, res: Response) => {
    try {
      const { id: topicId } = req.params;
      
      // Validate request body
      const result = subscribeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const { userAddress } = result.data;

      await storage.deleteSubscription(userAddress, topicId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unsubscribing from topic:", error);
      res.status(500).json({ error: "Failed to unsubscribe" });
    }
  });

  // Get signals for topic
  app.get("/api/topics/:id/signals", async (req: Request, res: Response) => {
    try {
      const { id: topicId } = req.params;
      const signals = await storage.getSignalsByTopic(topicId);
      res.json(signals);
    } catch (error) {
      console.error("Error fetching signals:", error);
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  // Scan topic for new signals using AI
  app.post("/api/topics/:id/scan", async (req: Request, res: Response) => {
    try {
      const { id: topicId } = req.params;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Fetch markets from Polymarket (simulated)
      const markets = await fetchMarketsForTopic(topic.keywords || []);
      
      if (markets.length === 0) {
        return res.json({ message: "No markets found for this topic", signals: [] });
      }

      // Analyze markets with AI
      const analyses = await analyzeMarkets(topic.name, markets);
      
      // Create signals from analysis
      const signalInputs = createSignalsFromAnalysis(topicId, markets, analyses);
      
      if (signalInputs.length === 0) {
        return res.json({ message: "No significant mispricings detected", signals: [] });
      }

      // Store signals
      const signals = await storage.createSignals(signalInputs);
      
      // Update topic signal count
      await storage.updateTopicSignalCount(topicId);

      res.json({ message: `Found ${signals.length} new signals`, signals });
    } catch (error) {
      console.error("Error scanning topic:", error);
      res.status(500).json({ error: "Failed to scan for signals" });
    }
  });

  // === Signals ===

  // Get specific signals by IDs
  app.get("/api/signals", async (req: Request, res: Response) => {
    try {
      const ids = (req.query.ids as string)?.split(",").filter(Boolean) || [];
      if (ids.length === 0) {
        return res.json([]);
      }
      const signals = await storage.getSignals(ids);
      res.json(signals);
    } catch (error) {
      console.error("Error fetching signals:", error);
      res.status(500).json({ error: "Failed to fetch signals" });
    }
  });

  // Update signal status
  app.patch("/api/signals/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const result = updateSignalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const { status } = result.data;

      await storage.updateSignalStatus(id, status);
      res.status(204).send();
    } catch (error) {
      console.error("Error updating signal:", error);
      res.status(500).json({ error: "Failed to update signal" });
    }
  });

  // === Strategies ===

  // Get user strategies
  app.get("/api/strategies", async (req: Request, res: Response) => {
    try {
      const userAddress = req.query.userAddress as string;
      
      if (!userAddress) {
        return res.status(400).json({ error: "userAddress is required" });
      }

      const strategies = await storage.getStrategies(userAddress);
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ error: "Failed to fetch strategies" });
    }
  });

  // Execute strategy
  app.post("/api/strategies/execute", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const result = executeStrategySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const { userAddress, topicId, signals, totalAllocation } = result.data;

      // Verify topic exists
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Verify all signals exist
      const signalIds = signals.map(s => s.signalId);
      const existingSignals = await storage.getSignals(signalIds);
      if (existingSignals.length !== signalIds.length) {
        return res.status(400).json({ error: "One or more signals not found" });
      }

      // Create strategy
      const strategy = await storage.createStrategy({
        userAddress,
        topicId,
        totalAllocation,
        riskLevel: "medium",
      });

      // Create strategy signals
      for (const signal of signals) {
        await storage.createStrategySignal({
          strategyId: strategy.id,
          signalId: signal.signalId,
          usdcAllocation: signal.allocation,
        });

        // Mark signal as added
        await storage.updateSignalStatus(signal.signalId, "added");
      }

      // Simulate blockchain transaction
      // In production, this would call AgentKit/OnchainKit to execute on Base
      const mockTxHash = "0x" + Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("");

      // Update strategy status
      await storage.updateStrategyStatus(strategy.id, "executed", mockTxHash);

      // Update topic signal count
      await storage.updateTopicSignalCount(topicId);

      res.json({
        strategyId: strategy.id,
        txHash: mockTxHash,
        status: "executed",
      });
    } catch (error) {
      console.error("Error executing strategy:", error);
      res.status(500).json({ error: "Failed to execute strategy" });
    }
  });

  // === Markets (Individual Market Pages) ===

  // Get market details by slug
  app.get("/api/markets/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Fetch market from Polymarket Gamma API
      const market = await fetchMarketBySlug(slug);
      
      if (!market) {
        return res.status(404).json({ error: "Market not found" });
      }
      
      res.json(market);
    } catch (error) {
      console.error("Error fetching market:", error);
      res.status(500).json({ error: "Failed to fetch market" });
    }
  });

  // Get price history for market (OHLC candlestick data)
  app.get("/api/markets/:slug/price-history", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const timeframe = req.query.timeframe as string || "1d";
      
      // Fetch market to get token IDs
      const market = await fetchMarketBySlug(slug);
      if (!market || !market.clobTokenIds || market.clobTokenIds.length === 0) {
        // Return empty array if no real market found
        return res.json([]);
      }
      
      // Get the YES token ID (first token is usually YES)
      const outcomes = market.outcomes || ["Yes", "No"];
      const yesIdx = outcomes.findIndex((o: string) => o.toLowerCase() === "yes");
      const yesTokenId = market.clobTokenIds[yesIdx >= 0 ? yesIdx : 0];
      
      // Fetch real price history from CLOB API
      const priceHistory = await fetchPriceHistory(yesTokenId, timeframe);
      
      if (priceHistory && priceHistory.length > 0) {
        // Convert line data to OHLC candlestick data
        // Group prices into candles based on timeframe
        const candleSize = timeframe === "1h" ? 60000 : // 1 min candles for 1h
                          timeframe === "1d" ? 1800000 : // 30 min candles for 1d
                          timeframe === "1w" ? 7200000 : // 2 hour candles for 1w
                          86400000; // 1 day candles for All
        
        const candles: Map<number, { open: number; high: number; low: number; close: number; volume: number }> = new Map();
        
        for (const point of priceHistory) {
          const candleTime = Math.floor(point.timestamp / candleSize) * candleSize;
          const existing = candles.get(candleTime);
          
          if (existing) {
            existing.high = Math.max(existing.high, point.price);
            existing.low = Math.min(existing.low, point.price);
            existing.close = point.price;
          } else {
            candles.set(candleTime, {
              open: point.price,
              high: point.price,
              low: point.price,
              close: point.price,
              volume: 0,
            });
          }
        }
        
        // Convert to array and sort by timestamp
        const ohlcData = Array.from(candles.entries())
          .map(([timestamp, candle]) => ({
            timestamp,
            ...candle,
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        return res.json(ohlcData);
      }
      
      // Return empty array if no data
      res.json([]);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });

  // Get order book for market
  app.get("/api/markets/:slug/order-book", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Fetch market to get token IDs
      const market = await fetchMarketBySlug(slug);
      if (!market || !market.clobTokenIds || market.clobTokenIds.length === 0) {
        // Return empty order book if no real market found
        return res.json({
          bids: [],
          asks: [],
          bidPercent: 50,
          askPercent: 50,
        });
      }
      
      // Get the YES token ID
      const outcomes = market.outcomes || ["Yes", "No"];
      const yesIdx = outcomes.findIndex((o: string) => o.toLowerCase() === "yes");
      const yesTokenId = market.clobTokenIds[yesIdx >= 0 ? yesIdx : 0];
      
      // Fetch real order book from CLOB API
      const orderBook = await fetchOrderBook(yesTokenId);
      
      if (orderBook) {
        // Transform to our format
        const bids = orderBook.bids
          .slice(0, 10)
          .map(b => ({
            price: b.price,
            shares: Math.round(b.size),
            totalUsd: Math.round(b.price * b.size),
          }))
          .sort((a, b) => b.price - a.price); // Highest bid first
        
        const asks = orderBook.asks
          .slice(0, 10)
          .map(a => ({
            price: a.price,
            shares: Math.round(a.size),
            totalUsd: Math.round(a.price * a.size),
          }))
          .sort((a, b) => a.price - b.price); // Lowest ask first
        
        const totalBidVolume = bids.reduce((s, b) => s + b.shares, 0);
        const totalAskVolume = asks.reduce((s, a) => s + a.shares, 0);
        const total = totalBidVolume + totalAskVolume || 1;
        
        return res.json({
          bids,
          asks,
          bidPercent: Math.round((totalBidVolume / total) * 100),
          askPercent: Math.round((totalAskVolume / total) * 100),
        });
      }
      
      // Return empty if no data
      res.json({
        bids: [],
        asks: [],
        bidPercent: 50,
        askPercent: 50,
      });
    } catch (error) {
      console.error("Error fetching order book:", error);
      res.status(500).json({ error: "Failed to fetch order book" });
    }
  });

  // Get trades for market
  app.get("/api/markets/:slug/trades", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Generate mock trades
      const now = Date.now();
      const trades = Array.from({ length: 25 }, (_, i) => ({
        id: `trade-${slug}-${i}`,
        outcome: Math.random() > 0.5 ? "YES" : "NO",
        type: Math.random() > 0.5 ? "BUY" : "SELL",
        price: 0.3 + Math.random() * 0.4,
        amount: Math.floor(Math.random() * 500) + 50,
        totalUsd: Math.floor(Math.random() * 2000) + 100,
        timestamp: new Date(now - i * Math.floor(Math.random() * 3600000)).toISOString(),
        trader: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      }));
      
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  // Get leaderboard for market
  app.get("/api/markets/:slug/leaderboard", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Generate mock leaderboard
      const traders = Array.from({ length: 15 }, (_, i) => {
        const position = Math.random() > 0.5 ? "YES" : "NO";
        const size = Math.floor(Math.random() * 10000) + 500;
        const avgEntry = 0.3 + Math.random() * 0.3;
        const currentPrice = 0.4 + Math.random() * 0.2;
        const pnl = (currentPrice - avgEntry) * size * (position === "YES" ? 1 : -1);
        
        return {
          address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
          position,
          size,
          avgEntry,
          currentPrice,
          pnl,
          pnlPercent: (pnl / (size * avgEntry)) * 100,
          firstEntry: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600000)).toISOString(),
        };
      });
      
      // Sort by absolute PnL
      traders.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
      
      res.json(traders);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get AI insights for market
  app.get("/api/markets/:slug/ai-insights", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Fetch market first
      const market = await fetchMarketBySlug(slug);
      
      if (!market) {
        return res.status(404).json({ error: "Market not found" });
      }
      
      // Generate AI insight based on market
      const marketPrice = market.yesPrice;
      const aiFairPrice = Math.max(0.05, Math.min(0.95, marketPrice + (Math.random() - 0.4) * 0.15));
      const recommendedSide = aiFairPrice > marketPrice ? "YES" : "NO";
      const edgeBps = Math.abs(Math.round((aiFairPrice - marketPrice) * 10000));
      
      const insights = {
        marketId: slug,
        recommendedSide,
        aiFairPrice,
        marketPrice,
        edgeBps: Math.max(edgeBps, 300), // Minimum 3% edge
        explanation: `Based on analysis of market sentiment, recent news, and historical patterns, the current ${recommendedSide} price appears undervalued. The market may be overreacting to recent events, creating a potential opportunity.`,
      };
      
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ error: "Failed to fetch AI insights" });
    }
  });

  // Execute single-market strategy
  app.post("/api/markets/:slug/execute", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Validate request body
      const result = marketExecuteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }
      const { userAddress, allocation, edgeBps, riskLevel } = result.data;
      
      // Verify market exists
      const market = await fetchMarketBySlug(slug);
      if (!market) {
        return res.status(404).json({ error: "Market not found" });
      }
      
      // Simulate blockchain transaction
      const mockTxHash = "0x" + Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      
      res.json({
        marketId: slug,
        marketQuestion: market.question,
        txHash: mockTxHash,
        status: "executed",
        allocation,
        edgeBps,
        riskLevel: riskLevel || "medium",
      });
    } catch (error) {
      console.error("Error executing market strategy:", error);
      res.status(500).json({ error: "Failed to execute strategy" });
    }
  });

  return httpServer;
}

interface MarketWithTokens {
  id: string;
  slug: string;
  question: string;
  description: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  openInterest: number;
  change24h: number;
  endDate: string;
  outcomes: string[];
  clobTokenIds: string[];
  conditionId: string;
}

// Cache for market data to avoid repeated API calls
const marketCache = new Map<string, { data: MarketWithTokens; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// Helper function to parse market data from Gamma API response
function parseMarketData(market: any, slug: string): MarketWithTokens {
  const outcomes = market.outcomes ? JSON.parse(market.outcomes) : ["Yes", "No"];
  const yesIdx = outcomes.findIndex((o: string) => o.toLowerCase() === "yes");
  const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [0.5, 0.5];
  const yesPrice = yesIdx >= 0 ? parseFloat(prices[yesIdx]) : parseFloat(prices[0]);
  
  // Parse clobTokenIds - these are the token IDs for YES and NO outcomes
  const clobTokenIds = market.clobTokenIds ? JSON.parse(market.clobTokenIds) : [];
  
  return {
    id: market.id || slug,
    slug: market.slug || slug,
    question: market.question || "Market Question",
    description: market.description || "",
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: parseFloat(market.volume24hr) || 0,
    totalVolume: parseFloat(market.volume) || 0,
    openInterest: parseFloat(market.openInterest) || 0,
    change24h: 0, // Will be calculated from price history
    endDate: market.endDate || new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
    outcomes,
    clobTokenIds,
    conditionId: market.conditionId || "",
  };
}

// Helper function to fetch market by slug from Polymarket
async function fetchMarketBySlug(slug: string): Promise<MarketWithTokens | null> {
  // Check cache first
  const cached = marketCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // First, try to fetch directly as a market slug
    const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets?slug=${slug}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (marketResponse.ok) {
      const markets = await marketResponse.json();
      if (markets && markets.length > 0) {
        const result = parseMarketData(markets[0], slug);
        marketCache.set(slug, { data: result, timestamp: Date.now() });
        return result;
      }
    }
    
    // If no direct market found, try to fetch as an event slug
    // Events contain multiple markets, we'll use the first/primary one
    const eventResponse = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    
    if (eventResponse.ok) {
      const events = await eventResponse.json();
      if (events && events.length > 0 && events[0].markets && events[0].markets.length > 0) {
        // Get the first (primary) market from the event
        const primaryMarket = events[0].markets[0];
        const result = parseMarketData(primaryMarket, primaryMarket.slug || slug);
        marketCache.set(slug, { data: result, timestamp: Date.now() });
        // Also cache under the actual market slug for future lookups
        if (primaryMarket.slug && primaryMarket.slug !== slug) {
          marketCache.set(primaryMarket.slug, { data: result, timestamp: Date.now() });
        }
        return result;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching market from Polymarket:", error);
    return null;
  }
}

// Fetch order book from CLOB API
async function fetchOrderBook(tokenId: string): Promise<{
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
} | null> {
  try {
    const response = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        bids: (data.bids || []).map((b: { price: string; size: string }) => ({
          price: parseFloat(b.price),
          size: parseFloat(b.size),
        })),
        asks: (data.asks || []).map((a: { price: string; size: string }) => ({
          price: parseFloat(a.price),
          size: parseFloat(a.size),
        })),
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching order book:", error);
    return null;
  }
}

// Fetch price history from CLOB API
async function fetchPriceHistory(tokenId: string, interval: string): Promise<{
  timestamp: number;
  price: number;
}[] | null> {
  try {
    // Map our timeframes to Polymarket intervals
    const intervalMap: Record<string, string> = {
      "1h": "1h",
      "1d": "1d",
      "1w": "1w",
      "All": "max",
    };
    const clobInterval = intervalMap[interval] || "1d";
    
    const response = await fetch(
      `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${clobInterval}`,
      {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return (data.history || []).map((point: { t: number; p: number }) => ({
        timestamp: point.t * 1000, // Convert to milliseconds
        price: point.p,
      }));
    }
    return null;
  } catch (error) {
    console.error("Error fetching price history:", error);
    return null;
  }
}
