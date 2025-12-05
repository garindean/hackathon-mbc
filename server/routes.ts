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

  return httpServer;
}
