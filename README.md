# EdgeFinder - AI-Powered Prediction Market Strategy Platform

EdgeFinder is a Base-native prediction market strategy platform that uses AI to detect mispricing opportunities in prediction markets. The platform fetches real market data from Polymarket, analyzes it with OpenAI, and enables users to build and execute trading strategies with optional gasless transactions.

## Features

- **Real Polymarket Data** - Live market data from Polymarket Gamma API with keyword-based filtering
- **AI-Powered Analysis** - OpenAI-powered mispricing detection with fair price estimation
- **Strategy Builder** - Build multi-market strategies with manual or template-based allocation
- **Strategy Templates** - Pre-built risk profiles (Conservative, Balanced, Aggressive) with auto-allocation
- **Backtesting** - Monte Carlo simulation for projected returns and risk metrics
- **Smart Wallet Integration** - Coinbase Smart Wallet (ERC-4337) with gasless transaction support
- **Portfolio Tracking** - Track positions, PnL, and execution history
- **Real-time Updates** - Auto-refresh signals with notification system

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Topics    │  │   Signals   │  │  Strategy   │  │    Portfolio    │ │
│  │    Page     │  │    Cards    │  │   Builder   │  │    Dashboard    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                │                   │          │
│  ┌──────┴────────────────┴────────────────┴───────────────────┴────────┐ │
│  │                    TanStack Query + Wagmi + OnchainKit              │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express.js)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   REST API      │  │   AI Service    │  │   Polymarket Service    │  │
│  │   /api/topics   │  │   (OpenAI)      │  │   (Gamma + CLOB API)    │  │
│  │   /api/signals  │  │                 │  │                         │  │
│  │   /api/strategies│ │                 │  │                         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                        │               │
│  ┌────────┴────────────────────┴────────────────────────┴─────────────┐ │
│  │                    Storage Layer (Drizzle ORM)                      │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────────────┼─────────────────────────────────────┘
                                     │
                                     ▼
                        ┌────────────────────────┐
                        │   PostgreSQL Database  │
                        │   (Neon-backed)        │
                        └────────────────────────┘
```

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| TanStack Query | Server state management |
| wouter | Routing |
| Recharts | Data visualization |
| Wagmi + OnchainKit | Wallet integration |
| Coinbase Smart Wallet | ERC-4337 account abstraction |

### Backend
| Technology | Purpose |
|------------|---------|
| Express.js | API server |
| TypeScript | Type safety |
| Drizzle ORM | Database queries and schema |
| PostgreSQL (Neon) | Persistent data storage |
| OpenAI (via Replit AI Integrations) | AI market analysis |

### Blockchain
| Technology | Purpose |
|------------|---------|
| Base Sepolia | Target testnet |
| Coinbase Smart Wallet | ERC-4337 smart wallet (smartWalletOnly mode) |
| Paymaster | Optional gasless transaction sponsorship |

## Project Structure

```
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   ├── navigation.tsx   # Header navigation
│   │   │   ├── wallet-button.tsx
│   │   │   ├── signal-card.tsx
│   │   │   ├── strategy-builder.tsx
│   │   │   ├── strategy-templates.tsx
│   │   │   ├── backtesting-panel.tsx
│   │   │   └── empty-state.tsx
│   │   ├── pages/               # Route pages
│   │   │   ├── topics.tsx       # Topic discovery
│   │   │   ├── topic-detail.tsx # Signals list + strategy builder
│   │   │   ├── strategy-review.tsx # Review and execute strategy
│   │   │   ├── portfolio.tsx    # Portfolio dashboard
│   │   │   └── history.tsx      # Execution history
│   │   ├── lib/                 # Utilities and configs
│   │   │   ├── wagmi.ts         # Wallet configuration
│   │   │   ├── contracts.ts     # Smart contract ABIs
│   │   │   └── queryClient.ts   # TanStack Query setup
│   │   └── App.tsx              # Main app with routing
│   └── index.html
├── server/                      # Backend Express server
│   ├── routes.ts                # API endpoints
│   ├── storage.ts               # Database operations (Drizzle)
│   ├── db.ts                    # Drizzle client + PostgreSQL pool
│   ├── ai-service.ts            # OpenAI + Polymarket integration
│   ├── vite.ts                  # Vite dev server integration
│   └── index.ts                 # Server entry point
├── shared/                      # Shared types and schemas
│   └── schema.ts                # Drizzle schema + Zod validation
├── contracts/                   # Solidity smart contracts
│   └── StrategyRegistry.sol     # Onchain strategy recording
└── design_guidelines.md         # UI/UX design system
```

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Schema defined in `shared/schema.ts`:

### Tables

```sql
-- Topics: Prediction market categories
topics (
  id VARCHAR PRIMARY KEY,     -- UUID
  name VARCHAR NOT NULL,
  description TEXT,
  keywords TEXT[],            -- Array of search keywords
  icon_name VARCHAR,
  active_signal_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Topic Subscriptions: User follows
topic_subscriptions (
  id VARCHAR PRIMARY KEY,
  topic_id VARCHAR REFERENCES topics(id),
  user_address VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Signals: AI-detected trading opportunities
signals (
  id VARCHAR PRIMARY KEY,
  topic_id VARCHAR REFERENCES topics(id),
  market_id VARCHAR NOT NULL,
  market_question TEXT NOT NULL,
  side VARCHAR NOT NULL,         -- 'YES' or 'NO'
  market_price NUMERIC NOT NULL, -- 0-1 decimal
  ai_fair_price NUMERIC NOT NULL,
  edge_bps INTEGER NOT NULL,     -- Basis points
  explanation TEXT,
  volume NUMERIC,
  liquidity NUMERIC,
  end_date TIMESTAMP,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
)

-- Strategies: User-created trading strategies
strategies (
  id VARCHAR PRIMARY KEY,
  user_address VARCHAR NOT NULL,
  topic_id VARCHAR REFERENCES topics(id),
  total_allocation NUMERIC NOT NULL,
  status VARCHAR DEFAULT 'pending',
  tx_hash VARCHAR,
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Strategy Signals: Junction table for strategy positions
strategy_signals (
  id VARCHAR PRIMARY KEY,
  strategy_id VARCHAR REFERENCES strategies(id),
  signal_id VARCHAR REFERENCES signals(id),
  allocation NUMERIC NOT NULL
)
```

## API Endpoints

### Topics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/topics` | List all topics with subscription counts |
| GET | `/api/topics/:id` | Get single topic details |
| POST | `/api/topics/:id/subscribe` | Subscribe to topic (requires wallet) |
| DELETE | `/api/topics/:id/subscribe` | Unsubscribe from topic |
| GET | `/api/topics/:id/signals` | Get active signals for topic |
| POST | `/api/topics/:id/scan` | Trigger AI scan for new signals |

### Signals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/signals?ids=` | Get signals by comma-separated IDs |
| PATCH | `/api/signals/:id` | Update signal status |

### Strategies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strategies` | Get user's strategies (requires wallet) |
| GET | `/api/strategies/:id` | Get single strategy details |
| POST | `/api/strategies/execute` | Execute/record a strategy |

### Portfolio
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolio/stats` | Get portfolio statistics (simulated PnL) |

## Polymarket Integration

EdgeFinder integrates with Polymarket's APIs to fetch real prediction market data:

### Data Flow
```
1. Gamma API (gamma-api.polymarket.com)
   └── Fetches 100+ active events with metadata
   └── 15 second timeout, keyword + title filtering

2. CLOB API (clob.polymarket.com)  
   └── Gets live bid/ask prices for top 5 markets
   └── 3 second timeout per token ID

3. Keyword Matching
   └── Filters markets by topic keywords
   └── Matches against question and description text

4. Price Parsing
   └── Identifies YES outcome from outcomes array
   └── Maps token IDs to correct price data
```

### Edge Calculation
Edges are calculated from the perspective of the recommended side:

```typescript
// For YES recommendation
const marketSidePrice = marketYesPrice;
const aiFairSidePrice = aiYesProb;
const edgeBps = (aiFairSidePrice - marketSidePrice) * 10000;

// For NO recommendation  
const marketSidePrice = 1 - marketYesPrice;  // Convert to NO price
const aiFairSidePrice = 1 - aiYesProb;        // Convert to NO probability
const edgeBps = (aiFairSidePrice - marketSidePrice) * 10000;
```

- **Positive edge** = The recommended side is underpriced (value found)
- **Minimum 300 bps** (3%) required to create a signal
- All displayed edges are positive (we only show opportunities)

## AI Analysis Pipeline

1. **Market Discovery** - Fetch active markets from Polymarket Gamma API
2. **Keyword Matching** - Filter to top 10 markets matching topic keywords  
3. **Price Enrichment** - Get live CLOB prices for top 5 markets
4. **AI Analysis** - Send to OpenAI for probability estimation
5. **Signal Creation** - Create signals for markets with >3% edge

### OpenAI Integration
The platform uses **Replit AI Integrations** for OpenAI access:
- Environment variables `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` are automatically configured
- No manual API key setup needed
- Billed to Replit credits
- Uses `gpt-4o-mini` model for analysis

## Wallet Integration

### Smart Wallet Configuration
```typescript
const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: "EdgeFinder",
      preference: "smartWalletOnly", // ERC-4337 only, no browser extension
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});
```

The app uses Coinbase Smart Wallet in `smartWalletOnly` mode, which means:
- Users get an ERC-4337 smart contract wallet
- No browser extension required
- Supports gasless transactions via paymaster

### Gasless Transactions (Optional)
When `VITE_PAYMASTER_URL` is configured:
1. User signs transaction intent
2. Paymaster sponsors gas fees  
3. Transaction submitted via bundler
4. User pays $0 in gas

To enable gasless transactions:
1. Create a project at [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Enable Base Paymaster for Base Sepolia
3. Set `VITE_PAYMASTER_URL` environment variable

### Smart Contract Status
- **Contract Source**: `contracts/StrategyRegistry.sol` 
- **Contract Address**: `0xd4e090539A26862EF0661d9DD9c39d9e52AAbef9` (Base Sepolia)
- **Deployment Status**: Deployed and operational
- **Execution**: Strategies are recorded onchain with transaction hash stored in database

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `SESSION_SECRET` | Express session secret | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `VITE_PAYMASTER_URL` | Coinbase Paymaster URL | No | - |

> **Note**: On Replit, `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` are auto-configured. For local development, use `OPENAI_API_KEY` directly.

## Local Development Setup

### Prerequisites

- **Node.js** 18+ 
- **npm** 9+
- **PostgreSQL** 14+ (local or cloud-hosted like Neon, Supabase, or Railway)
- **OpenAI API Key** from [platform.openai.com](https://platform.openai.com)

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/edgefinder.git
cd edgefinder
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up PostgreSQL Database

**Option A: Local PostgreSQL**
```bash
# Create database
createdb edgefinder

# Your connection string will be:
# postgresql://localhost:5432/edgefinder
```

**Option B: Cloud PostgreSQL (Neon - recommended)**
1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=postgresql://username:password@host:5432/edgefinder

# Session
SESSION_SECRET=your-secret-key-here-make-it-long-and-random

# OpenAI (get from platform.openai.com)
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Gasless transactions
# VITE_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base-sepolia/your-key
```

### Step 5: Initialize the Database

```bash
npm run db:push
```

This creates all the required tables (topics, signals, strategies, etc.).

### Step 6: Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### Step 7: Seed Initial Data (Optional)

The app starts with default topics (US Politics, Crypto, AI/Tech, Sports, Entertainment). To trigger an AI scan for signals:

1. Open `http://localhost:5000` in your browser
2. Click on any topic card
3. Click the "Scan for Signals" button
4. Wait for the AI to analyze Polymarket and generate signals

### Local Development Notes

- **Hot Reload**: Both frontend (Vite HMR) and backend auto-restart on file changes
- **Database**: Data persists across restarts when using PostgreSQL
- **API Requests**: All API calls go through `/api/*` endpoints on the same port
- **Wallet Testing**: Connect a Coinbase Smart Wallet to test blockchain features

### Troubleshooting

**"DATABASE_URL must be set" error**
- Ensure your `.env` file exists and contains a valid `DATABASE_URL`
- Check that PostgreSQL is running if using local database

**"OpenAI API error" when scanning**
- Verify your `OPENAI_API_KEY` is valid and has credits
- Check API rate limits if you've made many requests

**Wallet connection issues**
- Ensure you're on Base Sepolia network
- Clear browser cache/cookies if wallet state is stale
- Coinbase Smart Wallet requires a Coinbase account

**No markets appearing**
- Polymarket API may be rate-limited; wait a few minutes
- Check browser console for API errors
- Gamma API timeout is 15 seconds

## Running on Replit

If deploying on Replit, environment variables are auto-configured:
- Database is provisioned automatically
- OpenAI access is via Replit AI Integrations (no key needed)
- Just click "Run" and the app starts

```bash
npm run dev
```

The app runs on `http://localhost:5000` with:
- Frontend: Vite dev server with HMR
- Backend: Express API server
- Database: PostgreSQL (persistent)

## Strategy Templates

### Conservative
- **Focus**: High-volume, established markets
- **Risk**: Minimal exposure per market
- **Allocation**: Equal split across all signals

### Balanced  
- **Focus**: Weighted by edge strength
- **Risk**: Moderate diversification
- **Allocation**: Higher allocation to stronger edges

### Aggressive
- **Focus**: Kelly Criterion optimization
- **Risk**: Concentrated positions
- **Allocation**: Mathematically optimal sizing based on edge

## Backtesting

The platform includes Monte Carlo simulation for strategy backtesting:
- Projects expected returns based on AI confidence levels
- Simulates 1000 scenarios with random outcomes
- Displays probability distribution of returns
- Shows best/worst case scenarios and expected value

**Note**: Backtesting uses simulated outcomes based on AI fair prices. Real performance tracking would require integration with Polymarket resolution data.

## Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract StrategyRegistry {
    event StrategyRecorded(
        address indexed user,
        string topicId,
        string[] marketIds,
        uint256[] allocations,
        uint256[] edgeBps,
        uint256 timestamp
    );

    function recordStrategy(
        string calldata topicId,
        string[] calldata marketIds,
        uint256[] calldata allocations,
        uint256[] calldata edgeBps
    ) external {
        emit StrategyRecorded(
            msg.sender,
            topicId,
            marketIds,
            allocations,
            edgeBps,
            block.timestamp
        );
    }
}
```

## Known Limitations

1. **No Real Trading**: The platform records trading strategies onchain but doesn't execute actual trades on Polymarket. It's designed to identify opportunities and track intended positions.

2. **Simulated PnL**: Portfolio performance uses Monte Carlo simulation based on AI fair prices, not actual market resolution data.

3. **Backtesting Caveats**: Historical performance projections are simulated, not based on real historical outcomes.

4. **Gasless Requires Configuration**: Gasless transactions only work when `VITE_PAYMASTER_URL` is set with a valid Coinbase Paymaster endpoint.

## Future Improvements

- [x] Deploy StrategyRegistry contract to Base Sepolia
- [ ] Add Polymarket resolution API integration for real PnL
- [ ] Implement actual position tracking on Polymarket
- [ ] Add historical performance analytics with real data
- [ ] Support Base mainnet deployment
- [ ] Add multi-wallet support

## License

MIT
