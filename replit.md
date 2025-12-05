# EdgeFinder

AI-powered prediction market strategy platform on Base. Detects mispricing in Polymarket using OpenAI, lets users build strategies, and executes them onchain.

## Features

- **Topic Discovery** - Browse categories (Politics, Crypto, AI, Sports, etc.) and follow topics
- **Real Market Data** - Live prices and order books from Polymarket CLOB API
- **AI Signals** - OpenAI analyzes markets to find mispriced opportunities with edge estimates
- **Strategy Builder** - Allocate USDC across multiple signals with templates (Conservative/Balanced/Aggressive)
- **Onchain Execution** - Execute strategies via smart contract on Base Sepolia
- **Smart Wallet** - Coinbase Smart Wallet (ERC-4337) with gasless transactions
- **Trading Terminal** - Professional market pages with live charts and order books
- **Portfolio Tracking** - View positions, PnL, and strategy history

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind, shadcn/ui, TanStack Query |
| Backend | Express.js, TypeScript, Drizzle ORM |
| Database | PostgreSQL |
| AI | OpenAI via Replit Integrations |
| Blockchain | Base Sepolia, wagmi, OnchainKit |
| Data | Polymarket Gamma API + CLOB API |

## Project Structure

```
client/src/
  pages/           - Route components (topics, strategies, portfolio, market-detail)
  components/      - Reusable UI components
  lib/             - Utilities (wagmi config, contracts, query client)

server/
  routes.ts        - API endpoints
  storage.ts       - Database operations
  ai-service.ts    - OpenAI market analysis

shared/
  schema.ts        - Drizzle schema + TypeScript types

contracts/
  StrategyRegistry.sol - Onchain strategy recording
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/topics | List topics with subscription status |
| GET | /api/topics/:id | Single topic details |
| POST | /api/topics/:id/subscribe | Follow a topic |
| DELETE | /api/topics/:id/subscribe | Unfollow a topic |
| GET | /api/topics/:id/signals | Signals for a topic |
| POST | /api/topics/:id/scan | Generate new AI signals |
| GET | /api/signals | Get signals by IDs |
| PATCH | /api/signals/:id | Update signal status |
| GET | /api/strategies | User's strategies |
| POST | /api/strategies/execute | Execute a strategy |
| GET | /api/polymarket/markets/:slug | Market detail with order book |
| GET | /api/polymarket/price-history/:tokenId | Price history for charts |

## Polymarket Integration

- **Gamma API** - Fetches active markets, filters by topic keywords
- **CLOB API** - Real-time order books and price history
- **Price History Intervals** - 1h, 1d, 1w, max
- **Caching** - 1 minute cache to reduce API calls

## Smart Contract

Deployed on Base Sepolia at `0xd4e090539A26862EF0661d9DD9c39d9e52AAbef9`

Records strategy executions onchain with allocations and metadata.

## Commands

```bash
npm run dev       # Start dev server
npm run db:push   # Sync database schema
```

## Design

- Dark mode default
- Monospace fonts for numbers
- Professional, data-focused UI
- Minimal animations
