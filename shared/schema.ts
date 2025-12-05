import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Topics - categories for grouping prediction markets
export const topics = pgTable("topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  keywords: text("keywords").array().notNull().default(sql`ARRAY[]::text[]`),
  iconName: text("icon_name").default("TrendingUp"),
  activeSignalCount: integer("active_signal_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topicsRelations = relations(topics, ({ many }) => ({
  subscriptions: many(topicSubscriptions),
  signals: many(signals),
  strategies: many(strategies),
}));

// Topic Subscriptions - users following topics
export const topicSubscriptions = pgTable("topic_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAddress: text("user_address").notNull(),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topicSubscriptionsRelations = relations(topicSubscriptions, ({ one }) => ({
  topic: one(topics, {
    fields: [topicSubscriptions.topicId],
    references: [topics.id],
  }),
}));

// Signals - AI-detected mispricing opportunities
export const signals = pgTable("signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  marketId: text("market_id").notNull(),
  marketQuestion: text("market_question").notNull(),
  marketDescription: text("market_description"),
  side: text("side").notNull(), // "YES" or "NO"
  marketPrice: real("market_price").notNull(), // Current odds (0-1)
  aiFairPrice: real("ai_fair_price").notNull(), // AI predicted fair price (0-1)
  edgeBps: integer("edge_bps").notNull(), // Edge in basis points
  explanation: text("explanation").notNull(), // AI reasoning
  volume: real("volume"), // Market volume in USD
  liquidity: real("liquidity"), // Market liquidity
  endDate: timestamp("end_date"),
  status: text("status").default("active").notNull(), // active, dismissed, added
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const signalsRelations = relations(signals, ({ one, many }) => ({
  topic: one(topics, {
    fields: [signals.topicId],
    references: [topics.id],
  }),
  strategySignals: many(strategySignals),
}));

// Strategies - user-created trading strategies
export const strategies = pgTable("strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userAddress: text("user_address").notNull(),
  topicId: varchar("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  name: text("name"),
  totalAllocation: real("total_allocation").notNull().default(0), // Total USDC
  riskLevel: text("risk_level").default("medium").notNull(), // low, medium, high
  status: text("status").default("draft").notNull(), // draft, pending, executed, failed
  onchainStrategyId: text("onchain_strategy_id"),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
});

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  topic: one(topics, {
    fields: [strategies.topicId],
    references: [topics.id],
  }),
  strategySignals: many(strategySignals),
}));

// Strategy Signals - junction table linking strategies to signals with allocations
export const strategySignals = pgTable("strategy_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => strategies.id, { onDelete: "cascade" }),
  signalId: varchar("signal_id").notNull().references(() => signals.id, { onDelete: "cascade" }),
  usdcAllocation: real("usdc_allocation").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const strategySignalsRelations = relations(strategySignals, ({ one }) => ({
  strategy: one(strategies, {
    fields: [strategySignals.strategyId],
    references: [strategies.id],
  }),
  signal: one(signals, {
    fields: [strategySignals.signalId],
    references: [signals.id],
  }),
}));

// Insert schemas
export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  createdAt: true,
  activeSignalCount: true,
});

export const insertTopicSubscriptionSchema = createInsertSchema(topicSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertSignalSchema = createInsertSchema(signals).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  executedAt: true,
  status: true,
  onchainStrategyId: true,
  txHash: true,
});

export const insertStrategySignalSchema = createInsertSchema(strategySignals).omit({
  id: true,
  createdAt: true,
});

// Types
export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;

export type TopicSubscription = typeof topicSubscriptions.$inferSelect;
export type InsertTopicSubscription = z.infer<typeof insertTopicSubscriptionSchema>;

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;

export type StrategySignal = typeof strategySignals.$inferSelect;
export type InsertStrategySignal = z.infer<typeof insertStrategySignalSchema>;

// Extended types for frontend use
export type TopicWithSubscription = Topic & {
  isSubscribed: boolean;
};

export type SignalWithActions = Signal & {
  isSelected: boolean;
  allocation: number;
};

export type StrategyWithDetails = Strategy & {
  topic: Topic;
  signals: (StrategySignal & { signal: Signal })[];
};

// Users table (keeping for auth if needed later)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
