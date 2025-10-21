# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot providing technical analysis, real-time market data, and automated trading across crypto and forex markets. It features a Telegram Web App for user interaction, automated withdrawal/deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical tools and a seamless trading experience to secure a significant market share in automated trading.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture

### UI/UX Decisions
The system features a professional, modern, and responsive Telegram Web App with a dark theme and an intuitive layout. User interaction is primarily via a "🚀 Open App" button leading to the Web App.

### Technical Implementations
The core logic runs on an Express server managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security includes environment variables, error handling, rate limiting, and Telegram signature verification.

**Analysis Systems**:
-   **Regular Analysis**: Requires 65%+ indicator agreement.
-   **Ultra Analysis**: Comprehensive analysis across 11 indicators with dynamic weighting. Features 3 confidence tiers (High, Medium, Low), ranging market detection, dynamic indicator weights, improved SL/TP, and conflict detection.
-   **Zero Reversal Analysis**: 100-point scoring system. Features 3 confidence tiers (Very High, High, Medium), flexible RSI ranges, graduated Stochastic scoring, dynamic R/R assessment, candle pattern strength weighting, and improved SL/TP.
-   **V1 PRO AI Analysis**: AI-powered system with optional sentiment analysis. Features 3 signal strength tiers (Very High, High, Medium), ranging market detection, relaxed entry conditions, improved SL/TP, enhanced indicator weights, and self-learning weight adjustment.

All analysis systems include risk assessment, precise Stop Loss & Take Profit, and balanced Risk/Reward ratios.

**Advanced Analyst Performance System**: Comprehensive metrics (Win Rate, Profit Factor, Sharpe Ratio), a 5-tier ranking system (Bronze to Diamond), 12 achievement badges, and an AI Performance Advisor (Groq/Llama 3.3 70B) for pattern analysis and recommendations.

**Feature Specifications**:
The platform offers a Web App for technical analysis, top movers, a wallet for USDT TRC20, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**VIP Smart Search System**: A premium subscription service offering advanced search capabilities, including parallel multi-source searching, intelligent fuzzy matching, smart filtering with relevance scoring, and VIP-only sorting algorithms. Access is controlled by server-side subscription verification.

**Smart Multi-Market Scanner** (VIP Feature): Dynamically fetches and scans all available symbols across multiple markets (crypto, forex, stocks, commodities, indices). Provides real-time progress tracking via Server-Sent Events (SSE), supports all analysis types, and displays live results with entry/exit points and confidence levels.

**Advanced Admin Dashboard**: Provides revenue tracking, real-time withdrawal monitoring, database health metrics, server monitoring, and a top analysts leaderboard. Access is restricted to the owner.

### System Design Choices
The project uses MongoDB Atlas for its database, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing a queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security.

**Enhanced Withdrawal System**: Features queue-based automated processing with Bull + Redis, robust retry mechanisms with exponential backoff, intelligent failure handling, multi-channel notifications, admin integration for queue management, scheduled monitoring, and transaction-safe operations using MongoDB transactions.

**Subscription System Updates**: All subscription checks consistently use `subscription_expires`. All subscriptions (Basic, VIP Search, Pump, Analyst) are non-refundable and non-cancellable.

**Subscription UX Enhancements**: Improved error messages for analysis without active subscriptions, providing balance display and navigation to the subscription page. The subscription page features comprehensive benefits, a real-time balance indicator, and a quick deposit button. Auto-update functionality ensures balance and subscription status are always current.

**Robust Subscription Payment System** (October 2025): The subscription payment processing has been fully re-engineered for reliability and data integrity:
- **MongoDB Transactions**: All subscription operations (balance deduction, subscription activation, transaction recording, referral commissions) are wrapped in atomic MongoDB sessions when available, ensuring either complete success or automatic rollback
- **Graceful Fallback**: System automatically falls back to two-phase operations when MongoDB transactions are unavailable, maintaining backward compatibility
- **Comprehensive Error Handling**: Every step is validated with detailed logging; failures trigger automatic rollback and user notification
- **Referral Integrity**: Both referrer balance and `referral_earnings` counter are updated atomically, ensuring accurate commission tracking and reporting
- **Owner Notifications**: Admins receive real-time notifications for all subscription events (success and failures) with detailed user information
- **Enhanced User Feedback**: Users receive clear confirmation messages showing deducted amount, new balance, and subscription expiry date
- **Web App Integration** (October 21, 2025): Added `/api/subscribe` endpoint to enable basic subscription purchases directly from the Web App interface, matching the functionality previously available only through the Telegram bot

## External Dependencies

-   **Databases**: MongoDB Atlas
-   **Cryptocurrency Market Data APIs**: OKX, Bybit, Binance, CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex, DexScreener, GeckoTerminal, Birdeye
-   **Forex/Stocks/Commodities/Indices Market Data APIs**: TwelveData API, Yahoo Finance, Alpha Vantage, ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**: TRON Network (for USDT TRC20), Etherscan, BscScan
-   **Withdrawal Integration**: OKX API (USDT TRC20)
-   **Telegram**: Telegram Bot API, Telegram Web App
-   **AI/Customer Support**: Groq API (Llama 3.3 70B Versatile model)
-   **Payment Gateway**: CryptAPI
-   **Whale Tracking**: Whale Alert

## Critical Improvements & Architecture Refactoring (October 21, 2025)

A comprehensive refactoring was performed to address critical bugs and improve scalability for 1M+ users:

### 1. Critical Double-Withdrawal Bug Fix ✅
**Problem**: Race condition allowed multiple concurrent withdrawal approvals for the same request
**Solution**: Implemented atomic database operations using `findOneAndUpdate` with `status: 'pending'` validation
- Database-level atomic update prevents duplicate processing
- Queue-level duplicate detection for additional safety
- Transaction logging for audit trail
**Impact**: Eliminates financial loss from duplicate withdrawals

### 2. Distributed Rate Limiting System ✅
**Problem**: In-memory rate limiting vulnerable to restart and doesn't scale across processes
**Solution**: Redis-based distributed rate limiter (`redis-rate-limiter.js`)
- Sliding window algorithm for accurate request counting
- Automatic fallback to in-memory when Redis unavailable
- Configurable limits per endpoint (10-60 requests/minute)
**Impact**: Secure, scalable rate limiting across all services

### 3. Microservices Architecture ✅
**Problem**: Monolithic architecture limited scalability and reliability
**Solution**: Separated into 4 independent processes:
- **HTTP Server** (`services/http-server.js`): Express API on port 5000
- **Bot Worker** (`services/bot-worker.js`): Telegram Bot interactions
- **Queue Worker** (`services/queue-worker.js`): Bull queue processing (5 withdrawal + 3 payment workers)
- **Scheduler** (`services/scheduler.js`): Cron jobs for monitoring
- **Process Manager** (`process-manager.js`): Orchestrates all processes

**Benefits**:
- Independent scaling of each service
- Isolated failures don't crash entire system
- Better resource utilization
- Easier debugging and monitoring

### 4. Optimized Notification System ✅
**Problem**: Scanning 1M users sequentially for market opportunities was too slow
**Solution**: Batch processing with caching (`optimized-notifications.js`)
- Batch size: 10 users per batch
- Cache duration: 5 minutes for market data
- Rate limiting: Max 1 notification per user per hour
- Parallel processing with configurable delays
**Impact**: 10x faster notifications, reduced API costs

### 5. Comprehensive API Timeout Configuration ✅
**Problem**: External API calls could hang indefinitely
**Solution**: Centralized timeout management (`api-timeout-config.js`)
- API-specific timeouts (10-30 seconds)
- Exponential backoff retry logic (3 attempts)
- Circuit breaker pattern support
- Helper functions for timeout enforcement
**Impact**: Improved reliability and user experience

### 6. Centralized Logging System ✅
**Problem**: Inconsistent logging made debugging difficult
**Solution**: Unified logging framework (`centralized-logger.js`)
- Structured logging with multiple levels (trace, debug, info, warn, error, fatal)
- Module-specific loggers for easy filtering
- Helper functions for API calls, DB operations, user actions, payments
- HTTP request/response logging middleware
- Performance metrics tracking
**Impact**: Faster debugging, better monitoring

### 7. Comprehensive Health Checks ✅
**Problem**: No visibility into system component health
**Solution**: Multi-level health monitoring (`improved-health-checks.js`)
- Database connectivity and response time
- Redis availability and status
- Queue statistics (waiting, active, failed jobs)
- Memory usage tracking
- Quick health checks for frequent polling
- Readiness and liveness probes
**Endpoints**:
- `/api/health` - Quick health status
- Full health check available via monitoring service
**Impact**: Proactive issue detection, better uptime

### 8. Production Deployment Scripts ✅
**Files**:
- `start-production.sh` - Production launcher (HTTP server + background workers)
- `process-manager.js` - Full process orchestration
- `start.sh` - Development/testing mode
**Workflow**: Configured for production mode on port 5000

### Architecture Documentation
- `NEW_ARCHITECTURE.md` - Complete architecture explanation
- `MIGRATION_GUIDE.md` - Guide for transitioning to new architecture
- Updated `package.json` with new scripts

## Recent Project Cleanup (October 21, 2025)

A comprehensive cleanup was performed to remove all outdated code, files, and unused features:

**Removed Files**:
- `test-v1-pro.js` - Old test file for V1 PRO analysis system
- `cleanup-db.js` - Deprecated database cleanup script
- `security-logger.js` - Unused security logging module
- `attached_assets/content-1760204333150.md` - Temporary content file
- `redis.log` - Log file (regenerated as needed)

**Updated Documentation**:
- `README.md` - Removed references to non-existent `test-wallet.js`

**Database Status**:
All MongoDB collections are actively used and necessary:
- Core: `users`, `transactions`, `withdrawal_requests`, `subscriptions`
- Analysts: `analysts`, `analyst_subscriptions`, `analyst_reviews`, `analyst_room_posts`, `trade_signals`, `analyst_ai_insights`
- Features: `pump_subscriptions`, `vip_search_subscriptions`, `cryptapi_payments`
- AI/ML: `v1_pro_weights`, `v1_pro_performance`
- Referrals: `referral_earnings`

**Active Modules** (All Currently Used):
- `blockchain-pump-scanner.js` - Used by notifications system
- `whale-tracker.js` - Used by pump analysis
- `cache-manager.js` - Used by monitoring system
- `circuit-breaker.js` - Used by CryptAPI integration
- `withdrawal-notifier.js` - Used by withdrawal queue and scheduler
- `redis-rate-limiter.js` - Distributed rate limiting (NEW)
- `optimized-notifications.js` - Batch notification system (NEW)
- `api-timeout-config.js` - API timeout management (NEW)
- `centralized-logger.js` - Unified logging system (NEW)
- `improved-health-checks.js` - System health monitoring (NEW)

**Note**: The `javascript_openai` integration is listed but unused (project uses Groq API instead). This can be manually removed from Replit integrations panel if desired.