import { 
  topics, 
  topicSubscriptions, 
  signals, 
  strategies, 
  strategySignals,
  users,
  type Topic, 
  type InsertTopic, 
  type TopicSubscription, 
  type InsertTopicSubscription,
  type Signal, 
  type InsertSignal,
  type Strategy, 
  type InsertStrategy,
  type StrategySignal, 
  type InsertStrategySignal,
  type User,
  type InsertUser,
  type TopicWithSubscription,
  type StrategyWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getTopics(): Promise<Topic[]>;
  getTopicsWithSubscription(userAddress: string | null): Promise<TopicWithSubscription[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  getTopicWithSubscription(id: string, userAddress: string | null): Promise<TopicWithSubscription | undefined>;
  createTopic(topic: InsertTopic): Promise<Topic>;
  updateTopicSignalCount(topicId: string): Promise<void>;
  
  getSubscription(userAddress: string, topicId: string): Promise<TopicSubscription | undefined>;
  createSubscription(subscription: InsertTopicSubscription): Promise<TopicSubscription>;
  deleteSubscription(userAddress: string, topicId: string): Promise<void>;
  
  getSignalsByTopic(topicId: string): Promise<Signal[]>;
  getSignals(signalIds: string[]): Promise<Signal[]>;
  getSignalByMarketId(marketId: string): Promise<Signal | undefined>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  createSignals(signals: InsertSignal[]): Promise<Signal[]>;
  updateSignalStatus(signalId: string, status: string): Promise<void>;
  
  getStrategies(userAddress: string): Promise<StrategyWithDetails[]>;
  getStrategy(id: string): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategyStatus(id: string, status: string, txHash?: string): Promise<void>;
  
  createStrategySignal(strategySignal: InsertStrategySignal): Promise<StrategySignal>;
  getStrategySignals(strategyId: string): Promise<(StrategySignal & { signal: Signal })[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getTopics(): Promise<Topic[]> {
    return await db.select().from(topics).orderBy(topics.name);
  }

  async getTopicsWithSubscription(userAddress: string | null): Promise<TopicWithSubscription[]> {
    const allTopics = await db.select().from(topics).orderBy(topics.name);
    
    if (!userAddress) {
      return allTopics.map(t => ({ ...t, isSubscribed: false }));
    }

    const subscriptions = await db
      .select()
      .from(topicSubscriptions)
      .where(eq(topicSubscriptions.userAddress, userAddress));

    const subscribedTopicIds = new Set(subscriptions.map(s => s.topicId));

    return allTopics.map(t => ({
      ...t,
      isSubscribed: subscribedTopicIds.has(t.id),
    }));
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic || undefined;
  }

  async getTopicWithSubscription(id: string, userAddress: string | null): Promise<TopicWithSubscription | undefined> {
    const topic = await this.getTopic(id);
    if (!topic) return undefined;

    if (!userAddress) {
      return { ...topic, isSubscribed: false };
    }

    const subscription = await this.getSubscription(userAddress, id);
    return { ...topic, isSubscribed: !!subscription };
  }

  async createTopic(insertTopic: InsertTopic): Promise<Topic> {
    const [topic] = await db
      .insert(topics)
      .values(insertTopic)
      .returning();
    return topic;
  }

  async updateTopicSignalCount(topicId: string): Promise<void> {
    const activeSignals = await db
      .select()
      .from(signals)
      .where(and(eq(signals.topicId, topicId), eq(signals.status, "active")));

    await db
      .update(topics)
      .set({ activeSignalCount: activeSignals.length })
      .where(eq(topics.id, topicId));
  }

  async getSubscription(userAddress: string, topicId: string): Promise<TopicSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(topicSubscriptions)
      .where(
        and(
          eq(topicSubscriptions.userAddress, userAddress),
          eq(topicSubscriptions.topicId, topicId)
        )
      );
    return subscription || undefined;
  }

  async createSubscription(insertSubscription: InsertTopicSubscription): Promise<TopicSubscription> {
    const [subscription] = await db
      .insert(topicSubscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async deleteSubscription(userAddress: string, topicId: string): Promise<void> {
    await db
      .delete(topicSubscriptions)
      .where(
        and(
          eq(topicSubscriptions.userAddress, userAddress),
          eq(topicSubscriptions.topicId, topicId)
        )
      );
  }

  async getSignalsByTopic(topicId: string): Promise<Signal[]> {
    return await db
      .select()
      .from(signals)
      .where(eq(signals.topicId, topicId))
      .orderBy(desc(signals.createdAt));
  }

  async getSignals(signalIds: string[]): Promise<Signal[]> {
    if (signalIds.length === 0) return [];
    return await db
      .select()
      .from(signals)
      .where(inArray(signals.id, signalIds));
  }

  async getSignalByMarketId(marketId: string): Promise<Signal | undefined> {
    const [signal] = await db
      .select()
      .from(signals)
      .where(eq(signals.marketId, marketId))
      .orderBy(desc(signals.createdAt))
      .limit(1);
    return signal || undefined;
  }

  async createSignal(insertSignal: InsertSignal): Promise<Signal> {
    const [signal] = await db
      .insert(signals)
      .values(insertSignal)
      .returning();
    return signal;
  }

  async createSignals(insertSignals: InsertSignal[]): Promise<Signal[]> {
    if (insertSignals.length === 0) return [];
    return await db
      .insert(signals)
      .values(insertSignals)
      .returning();
  }

  async updateSignalStatus(signalId: string, status: string): Promise<void> {
    await db
      .update(signals)
      .set({ status })
      .where(eq(signals.id, signalId));
  }

  async getStrategies(userAddress: string): Promise<StrategyWithDetails[]> {
    const userStrategies = await db
      .select()
      .from(strategies)
      .where(eq(strategies.userAddress, userAddress))
      .orderBy(desc(strategies.createdAt));

    const result: StrategyWithDetails[] = [];

    for (const strategy of userStrategies) {
      const topic = await this.getTopic(strategy.topicId);
      const strategySignalData = await this.getStrategySignals(strategy.id);

      result.push({
        ...strategy,
        topic: topic!,
        signals: strategySignalData,
      });
    }

    return result;
  }

  async getStrategy(id: string): Promise<Strategy | undefined> {
    const [strategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, id));
    return strategy || undefined;
  }

  async createStrategy(insertStrategy: InsertStrategy): Promise<Strategy> {
    const [strategy] = await db
      .insert(strategies)
      .values(insertStrategy)
      .returning();
    return strategy;
  }

  async updateStrategyStatus(id: string, status: string, txHash?: string): Promise<void> {
    const updateData: Partial<Strategy> = { status };
    if (txHash) {
      updateData.txHash = txHash;
      updateData.executedAt = new Date();
    }
    await db
      .update(strategies)
      .set(updateData)
      .where(eq(strategies.id, id));
  }

  async createStrategySignal(insertStrategySignal: InsertStrategySignal): Promise<StrategySignal> {
    const [strategySignal] = await db
      .insert(strategySignals)
      .values(insertStrategySignal)
      .returning();
    return strategySignal;
  }

  async getStrategySignals(strategyId: string): Promise<(StrategySignal & { signal: Signal })[]> {
    const ssRecords = await db
      .select()
      .from(strategySignals)
      .where(eq(strategySignals.strategyId, strategyId));

    const result: (StrategySignal & { signal: Signal })[] = [];

    for (const ss of ssRecords) {
      const [signal] = await db
        .select()
        .from(signals)
        .where(eq(signals.id, ss.signalId));
      
      if (signal) {
        result.push({ ...ss, signal });
      }
    }

    return result;
  }
}

export const storage = new DatabaseStorage();
