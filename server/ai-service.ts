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

    const aiYesProb = analysis.aiProbability / 100;
    const marketYesPrice = market.currentPrice;
    
    // Calculate side-aware prices and edge
    // For YES: we're betting the price should go up (AI thinks YES is underpriced)
    // For NO: we're betting the price should go down (AI thinks YES is overpriced, so NO is underpriced)
    const isYesSide = analysis.side === "YES";
    
    // The price we're trading at (what we pay for our side)
    const marketSidePrice = isYesSide ? marketYesPrice : (1 - marketYesPrice);
    // What AI thinks our side is worth
    const aiFairSidePrice = isYesSide ? aiYesProb : (1 - aiYesProb);
    
    // Edge = how much our side is underpriced (positive = good opportunity)
    const edgeBps = Math.round((aiFairSidePrice - marketSidePrice) * 10000);

    // Only create signal if edge is significant (and positive - we found value)
    if (edgeBps < 300) continue;

    signals.push({
      topicId,
      marketId: market.id,
      marketQuestion: market.question,
      marketDescription: market.description || null,
      side: analysis.side,
      marketPrice: marketSidePrice,  // Price of the side we're betting on
      aiFairPrice: aiFairSidePrice,  // AI's fair value for the side we're betting on
      edgeBps,
      explanation: analysis.explanation,
      volume: market.volume || null,
      liquidity: market.liquidity || null,
      endDate: market.endDate ? new Date(market.endDate) : null,
    });
  }

  return signals;
}

// Polymarket API configuration
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

interface PolymarketMarket {
  id: string;
  question: string;
  groupItemTitle?: string;
  description?: string;
  conditionId?: string;
  slug?: string;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  outcomePrices?: string;
  outcomes?: string;
  clobTokenIds?: string;
}

// Fetch live price from CLOB API for a token (with short timeout)
async function fetchClobPrice(tokenId: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout per token
  
  try {
    const response = await fetch(
      `${CLOB_API_BASE}/price?token_id=${tokenId}&side=BUY`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const price = parseFloat(data.price);
    return !isNaN(price) && price >= 0 && price <= 1 ? price : null;
  } catch (error) {
    clearTimeout(timeout);
    return null;
  }
}

// Get YES token ID from market data
function getYesTokenId(market: PolymarketMarket): string | null {
  if (!market.clobTokenIds || !market.outcomes) return null;
  
  try {
    const tokenIds: string[] = JSON.parse(market.clobTokenIds);
    const outcomes: string[] = JSON.parse(market.outcomes);
    
    const yesIndex = outcomes.findIndex(o => 
      o.toLowerCase() === "yes" || o.toLowerCase() === "true"
    );
    
    return yesIndex >= 0 && tokenIds[yesIndex] ? tokenIds[yesIndex] : tokenIds[0] || null;
  } catch {
    return null;
  }
}

// Parse YES price from Polymarket market data
function parseYesPrice(market: PolymarketMarket): number | null {
  if (!market.outcomePrices) return null;
  
  try {
    const prices: string[] = JSON.parse(market.outcomePrices);
    const outcomes: string[] = market.outcomes ? JSON.parse(market.outcomes) : ["Yes", "No"];
    
    // Find the YES outcome index
    const yesIndex = outcomes.findIndex(o => 
      o.toLowerCase() === "yes" || o.toLowerCase() === "true"
    );
    
    if (yesIndex >= 0 && prices[yesIndex]) {
      const price = parseFloat(prices[yesIndex]);
      if (!isNaN(price) && price >= 0 && price <= 1) {
        return price;
      }
    }
    
    // Fallback: if outcomes are ["Yes", "No"], first price is YES
    if (outcomes.length === 2 && prices.length >= 1) {
      const price = parseFloat(prices[0]);
      if (!isNaN(price) && price >= 0 && price <= 1) {
        return price;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to parse prices for market ${market.id}:`, error);
    return null;
  }
}

// Check if market matches any keyword
function matchesKeywords(market: PolymarketMarket, keywords: string[]): boolean {
  const searchText = [
    market.question,
    market.groupItemTitle,
    market.description,
  ].filter(Boolean).join(" ").toLowerCase();
  
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    // Match whole keyword or individual words for multi-word keywords
    return searchText.includes(lowerKeyword) || 
           lowerKeyword.split(/\s+/).every(word => word.length > 2 && searchText.includes(word));
  });
}

// Fetch markets from Polymarket Gamma API
export async function fetchMarketsForTopic(
  topicKeywords: string[]
): Promise<MarketData[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    console.log(`Fetching Polymarket data for keywords: ${topicKeywords.join(", ")}`);
    
    // Fetch active markets from Gamma API
    const response = await fetch(
      `${GAMMA_API_BASE}/markets?active=true&closed=false&limit=200`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.error(`Gamma API error: ${response.status}`);
      return [];
    }
    
    const allMarkets: PolymarketMarket[] = await response.json();
    console.log(`Fetched ${allMarkets.length} markets from Polymarket`);
    
    // Filter markets by keywords
    const matchingMarkets: MarketData[] = [];
    
    for (const market of allMarkets) {
      if (market.closed) continue;
      
      // Check if market matches any keyword
      if (!matchesKeywords(market, topicKeywords)) continue;
      
      // Parse YES price from Gamma - skip market if no reliable price
      const gammaPrice = parseYesPrice(market);
      if (gammaPrice === null) {
        console.log(`Skipping market ${market.id}: no reliable price`);
        continue;
      }
      
      matchingMarkets.push({
        id: market.id,
        question: market.question,
        description: market.description,
        currentPrice: gammaPrice,
        volume: market.volume,
        liquidity: market.liquidity,
        endDate: market.endDate,
      });
    }
    
    // Sort by volume (descending) and take top 10 with valid volume
    const sortedMarkets = matchingMarkets
      .filter(m => typeof m.volume === 'number' && m.volume > 0)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 10);
    
    // Fetch live CLOB prices for top markets (in parallel with timeout)
    const marketsToEnrich = sortedMarkets.slice(0, 5); // Limit CLOB calls for performance
    const clobPricePromises = marketsToEnrich.map(async (market) => {
      const originalMarket = allMarkets.find(m => m.id === market.id);
      if (!originalMarket) return null;
      
      const tokenId = getYesTokenId(originalMarket);
      if (!tokenId) return null;
      
      const livePrice = await fetchClobPrice(tokenId);
      return { marketId: market.id, livePrice };
    });
    
    try {
      const clobResults = await Promise.all(clobPricePromises);
      for (const result of clobResults) {
        if (result?.livePrice !== null && result?.livePrice !== undefined) {
          const market = sortedMarkets.find(m => m.id === result.marketId);
          if (market) {
            console.log(`Updated price for ${market.id}: ${market.currentPrice} -> ${result.livePrice} (CLOB)`);
            market.currentPrice = result.livePrice;
          }
        }
      }
    } catch (error) {
      console.log("CLOB price fetch failed, using Gamma prices:", error);
    }
    
    // Fallback: if very few matches, return top markets by volume regardless of keywords
    if (sortedMarkets.length < 3) {
      console.log(`Few keyword matches (${sortedMarkets.length}), adding top markets by volume`);
      
      const topVolumeMarkets = allMarkets
        .filter(m => !m.closed && parseYesPrice(m) !== null)
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 5)
        .map(market => ({
          id: market.id,
          question: market.question,
          description: market.description,
          currentPrice: parseYesPrice(market)!,
          volume: market.volume,
          liquidity: market.liquidity,
          endDate: market.endDate,
        }));
      
      // Merge without duplicates
      const existingIds = new Set(sortedMarkets.map(m => m.id));
      for (const market of topVolumeMarkets) {
        if (!existingIds.has(market.id)) {
          sortedMarkets.push(market);
          if (sortedMarkets.length >= 10) break;
        }
      }
    }
    
    console.log(`Found ${sortedMarkets.length} matching markets for keywords: ${topicKeywords.join(", ")}`);
    
    return sortedMarkets;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("Polymarket API request timed out");
    } else {
      console.error("Failed to fetch Polymarket data:", error);
    }
    return [];
  }
}
