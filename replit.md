# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed for Sharia-compliant automated spot trading. It provides real-time market data, advanced technical analysis, and a seamless user experience through a Telegram Web App. The project aims to offer accessible, robust trading assistance, focusing on Islamic finance principles by excluding futures and leverage trading, and to secure a significant market share in automated trading.

## User Preferences
- Default Language: Arabic (ar)
- Multi-Language Support: Full support for 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Language System: Centralized translation system with complete language coverage across Bot, Web App, and Customer Service
- Owner Notifications: Always sent in Arabic with user language context for monitoring
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture
The system utilizes a professional, modern, and responsive Telegram Web App with a dark theme. An Express server forms the core, managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security measures include environment variables, error handling, rate limiting, and Telegram signature verification. The project is organized with clear directories for API routes, services, middleware, public assets, utilities, Kubernetes, Docker, scripts, and documentation.

**UI/UX Decisions**:
The Telegram Web App features a dark theme, providing a professional, modern, and responsive user experience. Notifications are centralized in a dedicated "More" section with modern gradient styling, dynamic status badges, and multi-language support.

**Technical Implementations**:
- **Analysis Systems**: Includes Regular, Ultra, Zero Reversal, and V1 PRO AI Analysis (AI-powered, sentiment analysis, self-learning weights, risk assessment, SL/TP).
- **Advanced Analyst Performance System**: Metrics, 5-tier ranking, achievement badges, and AI Performance Advisor.
- **Smart Multi-Market Scanner**: Real-time scanning with SSE, live results, entry/exit points, and confidence levels.
- **Enhanced Withdrawal System**: Queue-based automated processing with Bull + Redis, retry mechanisms, failure handling, and MongoDB transactions.
- **Robust Subscription Payment System**: Re-engineered for reliability with MongoDB Transactions, referral integrity, and Web App integration.
- **Critical Architecture Refactoring**: Atomic database operations, Redis-based distributed rate limiting, microservices architecture, optimized notifications, API timeout configuration, and centralized logging.
- **Dynamic Feature Control System**: Real-time feature toggling (Global, Tier-based, User-specific) with gradual rollout and caching.
- **Smart Search Optimizer**: Multi-level caching (LRU + Redis), parallel multi-market search, fuzzy matching, and auto-complete.
- **Enhanced Earning System**: 3-level referral program, milestone bonuses, analyst performance bonuses, and earnings dashboard.
- **Advanced Security System**: Automated fraud detection, real-time user behavior analysis, risk scoring, device fingerprinting, and IP reputation checks.
- **Automated Safety System**: 24/7 monitoring for withdrawals, logins, balance, and system health, with anomaly detection.
- **Google Gemini AI Service**: Free and powerful AI service with comprehensive features, caching, and graceful fallback.
- **Multi-Exchange Candle Data Fallback**: Automatic failover for cryptocurrency candle data fetching.
- **Enhanced User Error Messaging**: Context-aware, user-friendly error explanations in Arabic with actionable solutions.
- **Quality-Based Refund System**: Intelligent refund for per-analysis payments when signal quality falls below 60%.
- **Enterprise Scalability Optimizations**: Batch Data Loader, LRU Membership Cache, and Safe Database Query Guards.
- **Production-Scale Infrastructure Overhaul**: Telegram Webhooks migration, Docker Containerization, Redis Cluster, Dynamic Queue Auto-Scaling, Kubernetes Orchestration, Nginx Load Balancer, Prometheus Monitoring, and Centralized Configuration.
- **Unified Webhook Server Architecture (November 2025)**: Consolidated all services (Bot Webhook, HTTP API, Queue Workers, Schedulers) into a single `unified-webhook-server.js` for simplified deployment. Eliminated polling mode entirely - system operates exclusively via webhooks. Smart secret token handling: disabled in Replit (HTTPS sufficient), required in AWS/Production for defense-in-depth security.
- **Complete Multi-Language System Overhaul**: Full language support across all platform components including customer service, bot, and web app.
- **AI Code Agent System (Owner-only)**: AI-powered programming assistant (Google Gemini AI) for code analysis, quality suggestions, intent detection, and contextual messaging. Features include: direct chat via `/ai`, automatic chat mode, file analysis, read-only operations for safety, and smart chunking for responses.
- **Advanced AI Service for All Users**: Enhanced intelligent assistant (Google Gemini AI) with:
    - **Smart Chat (`/ask`)**: Intelligent conversation, market analysis, comprehensive answers.
    - **Group Chat Support**: AI responds when mentioned or replied to, with full 7-language support.
    - **Internet Search (`/search`)**: Real-time web search (DuckDuckGo API) with AI analysis and cited sources.
    - **Code Analysis (`/analyze`)**: File and code analysis, bug detection, suggestions.
    - **Image Generation (`/imagine`)**: AI-powered image creation support (ready for Replicate API integration).
    - **Conversation History Management**: Maintains context across messages.
    - **Multi-language Support**: Full 7-language support across all AI features and group interactions.
    - **Intent Detection**: Smart detection of user intentions.
    - **File Processing**: Safe reading and analysis of project files.
    - **No Additional API Keys Required**: Uses existing Google Gemini AI infrastructure (except for optional image generation).
    - **Smart Reply in Groups**: Automatically detects user language and responds.
- **Critical Performance Fixes (November 2025)**:
    - **Database Singleton Pattern**: Implemented robust singleton pattern in database.js to prevent duplicate initialization, reducing memory usage and improving startup performance.
    - **Telegram 409 Conflict Resolution**: Enhanced polling startup sequence with explicit stopPolling, extended cleanup wait (10s), and proper session management to eliminate 409 conflicts.
    - **Memory Usage Optimization**: Reduced memory consumption from 94.2% to 68.9% (25.3% improvement) by eliminating duplicate database connections and service initialization.
    - **Batch Loader Initialization**: Moved BatchLoader initialization to proper lifecycle position after database initialization, preventing race conditions.
    - **System Health Status**: Improved from "degraded" to "healthy" status through optimized resource management and proper initialization order.

**Feature Specifications**:
The platform offers a Web App for technical analysis, top movers, a USDT TRC20 wallet, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**System Design Choices**:
The project uses MongoDB Atlas, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security. Subscriptions are non-refundable and non-cancellable.

**Deployment Architecture**:
The system supports Standalone, Docker, and Kubernetes deployment modes, with separate containers for HTTP Server, Bot Webhook Worker, Queue Worker, and Scheduler, all monitored via Prometheus and Grafana.

**Simplified Webhook-Only Architecture (November 2025)**:
- **Webhook Mode Only**: System operates exclusively in webhook mode - polling mode has been completely removed
- **Single Unified Server**: All services consolidated into `unified-webhook-server.js` (Bot Webhook + HTTP API + Queue Workers + Schedulers)
- **Simplified Configuration**: Removed complex environment detection - single configuration for production deployment
- **Required Environment Variables**:
  - `PUBLIC_URL`: Your server's public URL (required)
  - `WEBHOOK_SECRET`: Security token for webhook verification (required)
  - `PORT`: Server port (default: 8443)
  - `BOT_TOKEN`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`, `OWNER_ID`, `CHANNEL_ID`
- **Deployment Target**: Optimized for AWS/Production deployment only
- **Simplified Entry Point**: `index.js` → `services/unified-webhook-server.js`
- **No Auto-Detection**: Removed automatic environment detection complexity that caused deployment issues

## External Dependencies

-   **Databases**: MongoDB Atlas, Redis (v7.2.6)
-   **Cryptocurrency Market Data APIs**: OKX, Bybit, Binance, CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex, DexScreener, GeckoTerminal, Birdeye
-   **Forex/Stocks/Commodities/Indices Market Data APIs**: TwelveData API, Yahoo Finance, Alpha Vantage, ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**: TRON Network (for USDT TRC20), Etherscan, BscScan
-   **Withdrawal Integration**: OKX API (USDT TRC20)
-   **Telegram**: Telegram Bot API, Telegram Web App
-   **AI/Customer Support**: Google Gemini AI (gemini-2.0-flash - 1500 requests/day free tier)
-   **Payment Gateway**: CryptAPI
-   **Whale Tracking**: Whale Alert