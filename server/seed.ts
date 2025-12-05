import { db } from "./db";
import { topics, signals } from "@shared/schema";
import { eq } from "drizzle-orm";

const seedTopics = [
  {
    name: "US Politics",
    description: "Presidential elections, congressional races, policy decisions, and political outcomes",
    keywords: ["politics", "election", "congress", "president", "policy"],
    iconName: "Vote",
  },
  {
    name: "Cryptocurrency",
    description: "Bitcoin, Ethereum, DeFi protocols, and crypto market predictions",
    keywords: ["crypto", "bitcoin", "ethereum", "defi", "blockchain"],
    iconName: "Coins",
  },
  {
    name: "Artificial Intelligence",
    description: "AI model releases, AGI timelines, and technology breakthroughs",
    keywords: ["ai", "gpt", "artificial intelligence", "machine learning", "agi"],
    iconName: "Sparkles",
  },
  {
    name: "Global Economics",
    description: "Interest rates, GDP growth, inflation, and macroeconomic indicators",
    keywords: ["economy", "fed", "gdp", "inflation", "rates", "recession"],
    iconName: "TrendingUp",
  },
  {
    name: "Technology Giants",
    description: "Apple, Google, Tesla, and major tech company predictions",
    keywords: ["tech", "apple", "google", "tesla", "microsoft", "meta"],
    iconName: "Building2",
  },
  {
    name: "Sports",
    description: "NFL, NBA, FIFA, and major sporting event outcomes",
    keywords: ["sports", "nfl", "nba", "soccer", "super bowl", "championship"],
    iconName: "Zap",
  },
];

export async function seed() {
  console.log("Seeding database...");

  for (const topicData of seedTopics) {
    // Check if topic already exists
    const existing = await db
      .select()
      .from(topics)
      .where(eq(topics.name, topicData.name));

    if (existing.length === 0) {
      await db.insert(topics).values(topicData);
      console.log(`Created topic: ${topicData.name}`);
    } else {
      console.log(`Topic already exists: ${topicData.name}`);
    }
  }

  console.log("Seeding complete!");
}
