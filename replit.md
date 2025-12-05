# EdgeFinder - AI-Powered Prediction Market Strategy Platform

## Overview
EdgeFinder is a Base-native prediction market strategy platform that uses AI to detect mispricing opportunities in prediction markets. Users can browse topics, discover AI-generated signals, build strategies, and execute them on Base Sepolia.

## Current State
MVP is complete with the following features:
- Topic browsing with subscription/follow functionality
- AI-powered signal generation using OpenAI (via Replit AI Integrations)
- Strategy builder for allocating USDC across multiple signals
- Strategy execution with simulated blockchain transactions
- Strategy history with transaction tracking
- Dark/light mode support
- Responsive design for mobile and desktop

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
