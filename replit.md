# EdgeFinder - AI-Powered Prediction Market Strategy Platform

## Overview
EdgeFinder is a Base-native prediction market strategy platform that uses AI to detect mispricing opportunities in prediction markets. Users can browse topics, discover AI-generated signals, build strategies, and execute them on Base Sepolia.

## Current State
MVP is complete with the following features:
- Topic browsing with subscription/follow functionality
- **Real Polymarket data** - Fetches live markets from Polymarket Gamma API
- AI-powered signal generation using OpenAI (via Replit AI Integrations)
- Strategy builder for allocating USDC across multiple signals
- Strategy templates (Conservative, Balanced, Aggressive) with auto-allocation
- Real wallet integration with OnchainKit + wagmi on Base Sepolia
- Smart Wallet (ERC-4337) support with gasless transaction capability
- Strategy execution with simulated blockchain transactions (real onchain execution ready when contract is deployed)
- Strategy history with transaction tracking
- Portfolio tracking dashboard with positions and PnL
- Real-time signal refresh with notification system
- Backtesting visualization with Monte Carlo simulation
- Dark/light mode support
- Responsive design for mobile and desktop

## Polymarket Integration
- **Gamma API**: Fetches 200 active markets from `https://gamma-api.polymarket.com/markets`
- **CLOB API**: Gets live bid prices from `https://clob.polymarket.com/price` for top 5 markets
- Markets are filtered by topic keywords (question, title, description)
- YES price is correctly mapped using outcomes array (not assumed to be first)
- Markets without reliable prices are skipped (no fallback to 0.5)
- Top 10 highest-volume matching markets are displayed per topic
- Fallback: if < 3 keyword matches, adds top volume markets to ensure content
- Timeouts: 15s for Gamma API, 3s per CLOB token price request

## Wallet & Blockchain
- **Wallet Connection**: OnchainKit 0.36.6 + wagmi
- **Chain**: Base Sepolia (testnet)
- **Smart Wallet**: Coinbase Smart Wallet (ERC-4337) with "smartWalletOnly" preference
- **Gasless Transactions**: Paymaster support for sponsored transactions (requires VITE_PAYMASTER_URL env var)
- **Smart Contract**: StrategyRegistry.sol (deployment pending - requires test ETH)

## Project Architecture

### Frontend (client/)
- **Framework**: React with TypeScript
- **Routing**: wouter
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Theme**: Dark mode by default, toggle available

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI via Replit AI Integrations
- **API**: REST endpoints for topics, signals, strategies

### Database Schema
- **topics**: Prediction market categories (politics, crypto, AI, etc.)
- **topicSubscriptions**: User follows for topics
- **signals**: AI-detected mispricing opportunities
- **strategies**: User-created trading strategies
- **strategySignals**: Junction table linking strategies to signals

## Key Files
- `shared/schema.ts` - Database schema and TypeScript types
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database operations
- `server/ai-service.ts` - OpenAI integration for market analysis
- `client/src/App.tsx` - Main app with routing
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable UI components
- `client/src/lib/wagmi.ts` - Wagmi config with Smart Wallet connectors
- `client/src/lib/contracts.ts` - Smart contract ABI and address
- `contracts/StrategyRegistry.sol` - Solidity contract for onchain strategy recording

## API Endpoints
- `GET /api/topics` - List all topics with subscription status
- `GET /api/topics/:id` - Get single topic
- `POST /api/topics/:id/subscribe` - Subscribe to topic
- `DELETE /api/topics/:id/subscribe` - Unsubscribe from topic
- `GET /api/topics/:id/signals` - Get signals for topic
- `POST /api/topics/:id/scan` - Scan for new signals using AI
- `GET /api/signals?ids=` - Get specific signals by IDs
- `PATCH /api/signals/:id` - Update signal status
- `GET /api/strategies` - Get user's strategies
- `POST /api/strategies/execute` - Execute a strategy

## Running the Project
```bash
npm run dev      # Start development server
npm run db:push  # Push schema changes to database
```

## User Preferences
- Dark mode preferred
- Professional, data-focused design
- Monospace fonts for numerical data
- Minimal animations, focus on information clarity
