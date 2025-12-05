import OpenAI from "openai";
import type { InsertSignal } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access
// without requiring your own API key. Charges are billed to your Replit credits.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface MarketData {
  id: string;
  question: string;
  description?: string;
  currentPrice: number;
  volume?: number;
  liquidity?: number;
  endDate?: string;
}

interface AIMarketAnalysis {
  marketId: string;
  aiProbability: number;
  side: "YES" | "NO";
  explanation: string;
  shouldTrade: boolean;
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";

export async function analyzeMarkets(
  topicName: string,
  markets: MarketData[]
): Promise<AIMarketAnalysis[]> {
  if (markets.length === 0) {
    return [];
  }

  const prompt = `You are an expert prediction market analyst. Analyze the following prediction markets related to "${topicName}" and estimate fair probabilities.

For each market, provide:
1. Your estimated fair probability (0-100%) for the YES outcome
2. Whether to bet YES or NO based on the current price
3. A brief 1-2 sentence explanation of your reasoning
4. Whether this represents a tradeable mispricing (edge > 3%)

Markets to analyze:
${markets.map((m, i) => `
${i + 1}. Question: ${m.question}
   ${m.description ? `Description: ${m.description}` : ''}
   Current YES Price: ${(m.currentPrice * 100).toFixed(1)}%
   ${m.volume ? `Volume: $${m.volume.toLocaleString()}` : ''}
   ${m.endDate ? `Ends: ${m.endDate}` : ''}
   Market ID: ${m.id}
`).join('\n')}

Respond in JSON format:
{
  "analyses": [
    {
      "marketId": "string",
      "aiProbability": number (0-100),
      "side": "YES" or "NO",
      "explanation": "string",
      "shouldTrade": boolean
    }
  ]
}

Be conservative with your estimates. Only mark shouldTrade as true if the edge is significant (>3%) and you have reasonable confidence.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert prediction market analyst. Provide accurate probability estimates based on available information. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed.analyses || [];
  } catch (error) {
    console.error("AI analysis error:", error);
    throw error;
  }
}

export function createSignalsFromAnalysis(
  topicId: string,
  markets: MarketData[],
  analyses: AIMarketAnalysis[]
): InsertSignal[] {
  const signals: InsertSignal[] = [];

  for (const analysis of analyses) {
    if (!analysis.shouldTrade) continue;

    const market = markets.find(m => m.id === analysis.marketId);
    if (!market) continue;

    const aiFairPrice = analysis.aiProbability / 100;
    const edgeBps = Math.round((aiFairPrice - market.currentPrice) * 10000);

    // Only create signal if edge is significant
    if (Math.abs(edgeBps) < 300) continue;

    signals.push({
      topicId,
      marketId: market.id,
      marketQuestion: market.question,
      marketDescription: market.description || null,
      side: analysis.side,
      marketPrice: market.currentPrice,
      aiFairPrice,
      edgeBps,
      explanation: analysis.explanation,
      volume: market.volume || null,
      liquidity: market.liquidity || null,
      endDate: market.endDate ? new Date(market.endDate) : null,
    });
  }

  return signals;
}

// Mock Polymarket API integration
// In production, this would call the actual Polymarket API
export async function fetchMarketsForTopic(
  topicKeywords: string[]
): Promise<MarketData[]> {
  // Simulated market data based on topic keywords
  // In production, this would query the Polymarket API
  
  const mockMarkets: Record<string, MarketData[]> = {
    politics: [
      {
        id: "pm-001",
        question: "Will the incumbent party win the next election?",
        description: "Resolves YES if the incumbent party wins the majority of seats",
        currentPrice: 0.45,
        volume: 2500000,
        liquidity: 150000,
        endDate: "2025-11-05"
      },
      {
        id: "pm-002",
        question: "Will there be a government shutdown before Q2 2025?",
        currentPrice: 0.28,
        volume: 800000,
        liquidity: 45000,
        endDate: "2025-03-31"
      },
      {
        id: "pm-003",
        question: "Will the approval rating exceed 50% by year end?",
        currentPrice: 0.35,
        volume: 450000,
        liquidity: 25000,
        endDate: "2025-12-31"
      }
    ],
    crypto: [
      {
        id: "pm-101",
        question: "Will Bitcoin exceed $150,000 by end of 2025?",
        currentPrice: 0.42,
        volume: 5000000,
        liquidity: 350000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-102",
        question: "Will Ethereum flip Bitcoin by market cap in 2025?",
        currentPrice: 0.08,
        volume: 1200000,
        liquidity: 80000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-103",
        question: "Will a major exchange collapse in 2025?",
        currentPrice: 0.15,
        volume: 650000,
        liquidity: 40000,
        endDate: "2025-12-31"
      }
    ],
    ai: [
      {
        id: "pm-201",
        question: "Will GPT-5 be released before July 2025?",
        currentPrice: 0.72,
        volume: 1800000,
        liquidity: 120000,
        endDate: "2025-06-30"
      },
      {
        id: "pm-202",
        question: "Will AI pass the Turing test in a public competition in 2025?",
        currentPrice: 0.55,
        volume: 900000,
        liquidity: 60000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-203",
        question: "Will an AI system achieve AGI as defined by leading researchers?",
        currentPrice: 0.12,
        volume: 2000000,
        liquidity: 150000,
        endDate: "2025-12-31"
      }
    ],
    sports: [
      {
        id: "pm-301",
        question: "Will the defending champions repeat in the Super Bowl?",
        currentPrice: 0.18,
        volume: 3500000,
        liquidity: 200000,
        endDate: "2026-02-08"
      },
      {
        id: "pm-302",
        question: "Will any team go undefeated in the regular season?",
        currentPrice: 0.02,
        volume: 500000,
        liquidity: 30000,
        endDate: "2025-12-30"
      }
    ],
    economy: [
      {
        id: "pm-401",
        question: "Will the Fed cut rates by more than 100bps in 2025?",
        currentPrice: 0.38,
        volume: 4000000,
        liquidity: 280000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-402",
        question: "Will US GDP growth exceed 3% in 2025?",
        currentPrice: 0.32,
        volume: 1500000,
        liquidity: 95000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-403",
        question: "Will unemployment rise above 5% by Q4 2025?",
        currentPrice: 0.22,
        volume: 800000,
        liquidity: 50000,
        endDate: "2025-12-31"
      }
    ],
    tech: [
      {
        id: "pm-501",
        question: "Will Apple's market cap exceed $4 trillion in 2025?",
        currentPrice: 0.55,
        volume: 2200000,
        liquidity: 160000,
        endDate: "2025-12-31"
      },
      {
        id: "pm-502",
        question: "Will Tesla release a fully autonomous vehicle in 2025?",
        currentPrice: 0.25,
        volume: 1800000,
        liquidity: 110000,
        endDate: "2025-12-31"
      }
    ]
  };

  // Find markets matching any keyword
  const matchingMarkets: MarketData[] = [];
  
  for (const keyword of topicKeywords) {
    const lowerKeyword = keyword.toLowerCase();
    for (const [category, markets] of Object.entries(mockMarkets)) {
      if (category.includes(lowerKeyword) || lowerKeyword.includes(category)) {
        matchingMarkets.push(...markets);
      }
    }
  }

  // If no specific matches, return a mix of markets
  if (matchingMarkets.length === 0) {
    return [
      mockMarkets.politics[0],
      mockMarkets.crypto[0],
      mockMarkets.ai[0],
    ];
  }

  // Remove duplicates
  return Array.from(new Map(matchingMarkets.map(m => [m.id, m])).values());
}
