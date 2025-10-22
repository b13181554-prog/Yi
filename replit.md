# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot offering technical analysis, real-time market data, and automated trading across crypto and forex markets. It features a Telegram Web App for user interaction, automated withdrawal/deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical tools and a seamless trading experience to secure a significant market share in automated trading.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture
The system features a professional, modern, and responsive Telegram Web App with a dark theme. The core logic runs on an Express server managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security includes environment variables, error handling, rate limiting, and Telegram signature verification.

**Analysis Systems**:
-   **Regular Analysis**: Requires 65%+ indicator agreement.
-   **Ultra Analysis**: Comprehensive analysis across 11 indicators with dynamic weighting, 3 confidence tiers, ranging market detection, and improved SL/TP.
-   **Zero Reversal Analysis**: 100-point scoring system with 3 confidence tiers, flexible RSI ranges, graduated Stochastic scoring, dynamic R/R assessment, and improved SL/TP.
-   **V1 PRO AI Analysis**: AI-powered system with optional sentiment analysis, 3 signal strength tiers, ranging market detection, relaxed entry conditions, improved SL/TP, and self-learning weight adjustment.
All analysis systems include risk assessment, precise Stop Loss & Take Profit, and balanced Risk/Reward ratios.

**Advanced Analyst Performance System**: Comprehensive metrics (Win Rate, Profit Factor, Sharpe Ratio), a 5-tier ranking system, 12 achievement badges, and an AI Performance Advisor (Groq/Llama 3.3 70B).

**Feature Specifications**: The platform offers a Web App for technical analysis, top movers, a wallet for USDT TRC20, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**VIP Smart Search System**: A premium subscription service offering advanced search capabilities, including parallel multi-source searching, intelligent fuzzy matching, smart filtering, and VIP-only sorting algorithms.

**Smart Multi-Market Scanner** (VIP Feature): Dynamically fetches and scans all available symbols across multiple markets, providing real-time progress via Server-Sent Events (SSE) and displaying live results with entry/exit points and confidence levels.

**Advanced Admin Dashboard**: Provides revenue tracking, real-time withdrawal monitoring, database health metrics, server monitoring, and a top analysts leaderboard.

**System Design Choices**: The project uses MongoDB Atlas, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing a queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security.

**Enhanced Withdrawal System**: Features queue-based automated processing with Bull + Redis, robust retry mechanisms, intelligent failure handling, multi-channel notifications, admin integration, scheduled monitoring, and transaction-safe operations using MongoDB transactions.

**Subscription System Updates**: All subscription checks consistently use `subscription_expires`. All subscriptions (Basic, VIP Search, Pump, Analyst) are non-refundable and non-cancellable.

**Subscription UX Enhancements**: Improved error messages for analysis without active subscriptions, providing balance display and navigation to the subscription page. The subscription page features comprehensive benefits, a real-time balance indicator, and a quick deposit button. Auto-update functionality ensures balance and subscription status are always current.

**Robust Subscription Payment System**: Re-engineered for reliability and data integrity with MongoDB Transactions for atomic operations, graceful fallback, comprehensive error handling, referral integrity, owner notifications, enhanced user feedback, and Web App integration via `/api/subscribe` endpoint.

**Critical Architecture Refactoring**:
-   **Critical Double-Withdrawal Bug Fix**: Implemented atomic database operations and queue-level duplicate detection.
-   **Distributed Rate Limiting System**: Redis-based sliding window algorithm for scalable rate limiting.
-   **Microservices Architecture**: Separated into HTTP Server, Bot Worker, Queue Worker, and Scheduler, orchestrated by a process manager.
-   **Optimized Notification System**: Batch processing with caching, rate limiting, and parallel processing.
-   **Comprehensive API Timeout Configuration**: Centralized timeout management, exponential backoff retry logic, and circuit breaker pattern support.
-   **Centralized Logging System**: Unified structured logging framework with multiple levels and module-specific loggers.
-   **Comprehensive Health Checks**: Multi-level health monitoring for database, Redis, queues, memory, and CPU.
-   **Production Deployment Scripts**: Configuration for production mode.

**Optional Performance Enhancements**:
-   **Database Query Pagination**: Implemented `createPaginationHelper` and `getPaginatedResults` for efficient handling of large datasets, preventing memory overflow and improving API response times.
-   **Enhanced Health Check Metrics**: Comprehensive system, database, and request latency monitoring with automatic warnings for degraded status.
-   **Complete Centralized Logging Migration**: Replaced all `console.log` calls with the centralized logger for consistent, structured logging across the database layer.

## Recent Updates (October 22, 2025)

**New Systems Added** (see NEW_FEATURES_2025.md for full details):

1. **Dynamic Feature Control System** (`services/feature-flags.js`, `api-routes/feature-flag-routes.js`, `public/admin-feature-control.html`):
   - Real-time feature toggling without system restart
   - 3 scopes: Global, Tier-based, User-specific
   - Gradual rollout with percentage-based deployment
   - Redis + MongoDB caching for performance
   - Web-based admin control panel

2. **Smart Search Optimizer** (`smart-search-optimizer.js`):
   - Multi-level caching (LRU + Redis)
   - Parallel multi-market search
   - Fuzzy matching and intelligent ranking
   - Auto-complete suggestions based on popular searches
   - Performance analytics (70%+ cache hit rate)

3. **Enhanced Earning System** (`enhanced-earning-system.js`):
   - 3-level referral program: Level 1 (10%), Level 2 (5%), Level 3 (2.5%)
   - 5 milestone bonuses (10 to 250 referrals)
   - Analyst performance bonuses
   - Comprehensive earnings dashboard
   - Leaderboard system for top earners

4. **Advanced Security System** (`advanced-security-system.js`):
   - Automated fraud detection
   - Real-time user behavior analysis
   - Risk scoring (0-100) with 4 threat levels
   - Automatic actions: Log, Notify, Block, Ban
   - Device fingerprinting and IP reputation checks

5. **Flexible Action System** (`flexible-action-system.js`):
   - Custom action registration and execution
   - Action chaining with conditional logic
   - Scheduled actions (cron-based)
   - Action history and rollback capability
   - Pre-built templates for common workflows

6. **Automated Safety System** (`automated-safety-system.js`):
   - 24/7 automated monitoring
   - 4 active monitors: Withdrawals, Logins, Balance, System Health
   - Daily security audits (2 AM)
   - Anomaly detection every 5 minutes
   - Auto-cleanup of old data (every 15 minutes)
   - Instant admin notifications for critical issues

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