# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to offer technical analysis, real-time market data, and automated trading across crypto and forex markets. It features a Telegram Web App for user interaction, automated withdrawal/deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical tools and a seamless trading experience to secure a significant market share in automated trading.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture
The system features a professional, modern, and responsive Telegram Web App with a dark theme. The core logic runs on an Express server managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security includes environment variables, error handling, rate limiting, and Telegram signature verification.

**UI/UX Decisions**:
The Telegram Web App features a dark theme, providing a professional, modern, and responsive user experience.

**Technical Implementations**:
- **Analysis Systems**: Includes Regular Analysis (65%+ indicator agreement), Ultra Analysis (11 indicators, dynamic weighting, 3 confidence tiers), Zero Reversal Analysis (100-point scoring, flexible RSI, dynamic R/R), and V1 PRO AI Analysis (AI-powered, sentiment analysis, self-learning weights). All systems include risk assessment and precise SL/TP.
- **Advanced Analyst Performance System**: Comprehensive metrics, 5-tier ranking, 12 achievement badges, and an AI Performance Advisor (Groq/Llama 3.3 70B).
- **Smart Multi-Market Scanner**: Real-time scanning across markets with SSE, live results, entry/exit points, and confidence levels.
- **Enhanced Withdrawal System**: Queue-based automated processing with Bull + Redis, retry mechanisms, failure handling, multi-channel notifications, and MongoDB transactions.
- **Robust Subscription Payment System**: Re-engineered for reliability with MongoDB Transactions, graceful fallback, error handling, referral integrity, and Web App integration.
- **Critical Architecture Refactoring**: Implemented atomic database operations, Redis-based distributed rate limiting, microservices architecture (HTTP Server, Bot Worker, Queue Worker, Scheduler), optimized notification system, comprehensive API timeout configuration, and centralized logging.
- **Dynamic Feature Control System**: Real-time feature toggling with Global, Tier-based, and User-specific scopes, gradual rollout, and Redis + MongoDB caching.
- **Smart Search Optimizer**: Multi-level caching (LRU + Redis), parallel multi-market search, fuzzy matching, intelligent ranking, and auto-complete suggestions.
- **Enhanced Earning System**: 3-level referral program, milestone bonuses, analyst performance bonuses, and an earnings dashboard.
- **Advanced Security System**: Automated fraud detection, real-time user behavior analysis, risk scoring, device fingerprinting, and IP reputation checks.
- **Flexible Action System**: Custom action registration, chaining with conditional logic, scheduled actions, and rollback capability.
- **Automated Safety System**: 24/7 monitoring for withdrawals, logins, balance, and system health, with daily security audits and anomaly detection.
- **Groq AI Service with Circuit Breaker** (Added Oct 2025): Enterprise-grade Groq API wrapper with circuit breaker pattern (3 failures threshold), intelligent caching (30min TTL, 100 entries max), exponential backoff retry mechanism, rate limit tracking, and graceful fallback responses. Includes monitoring endpoint `/api/groq/status` for usage statistics and health checks.
- **Multi-Exchange Candle Data Fallback** (Added Oct 2025): Automatic failover system for cryptocurrency candle data fetching with prioritized sources (OKX → Bybit → Gate.io), exchange-specific error handling, and detailed logging for debugging rare/unlisted assets.
- **Enhanced User Error Messaging** (Added Oct 2025): Comprehensive error message catalog (`error-messages.js`) providing context-aware, user-friendly error explanations in Arabic with actionable solutions, severity indicators, and retry guidance for common failures (network issues, data unavailability, AI capacity limits, payment errors).
- **Quality-Based Refund System** (Added Oct 2025): Intelligent refund mechanism for per-analysis payments (0.1 USDT) that automatically refunds users when signal quality (agreementPercentage) falls below 60%. System charges upfront on analysis request, then evaluates signal confidence after analysis completes - high-quality signals (≥60%) retain the fee, while low-quality signals (<60%) trigger automatic refund. Implemented across all analysis endpoints (analyze, ultra, zero-reversal, v1-pro, pump, master) with comprehensive logging for audit trails.

**Feature Specifications**:
The platform offers a Web App for technical analysis, top movers, a wallet for USDT TRC20, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**System Design Choices**:
The project uses MongoDB Atlas, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security. Subscriptions are non-refundable and non-cancellable, with improved UX for error messages and balance display.

## External Dependencies

-   **Databases**: MongoDB Atlas, Redis (v7.2.6)
-   **Cryptocurrency Market Data APIs**: OKX, Bybit, Binance, CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex, DexScreener, GeckoTerminal, Birdeye
-   **Forex/Stocks/Commodities/Indices Market Data APIs**: TwelveData API, Yahoo Finance, Alpha Vantage, ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**: TRON Network (for USDT TRC20), Etherscan, BscScan
-   **Withdrawal Integration**: OKX API (USDT TRC20)
-   **Telegram**: Telegram Bot API, Telegram Web App
-   **AI/Customer Support**: Groq API (Llama 3.3 70B Versatile model)
-   **Payment Gateway**: CryptAPI
-   **Whale Tracking**: Whale Alert