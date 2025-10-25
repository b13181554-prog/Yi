# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to offer technical analysis, real-time market data, and automated trading across crypto and forex markets. It features a Telegram Web App for user interaction, automated withdrawal/deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical tools and a seamless trading experience to secure a significant market share in automated trading.

## User Preferences
- Default Language: Arabic (ar)
- Multi-Language Support: Full support for 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Language System: Centralized translation system with complete language coverage across Bot, Web App, and Customer Service
- Owner Notifications: Always sent in Arabic with user language context for monitoring
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture
The system features a professional, modern, and responsive Telegram Web App with a dark theme. The core logic runs on an Express server managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security includes environment variables, error handling, rate limiting, and Telegram signature verification.

**UI/UX Decisions**:
The Telegram Web App features a dark theme, providing a professional, modern, and responsive user experience.

**Technical Implementations**:
- **Analysis Systems**: Includes Regular Analysis, Ultra Analysis, Zero Reversal Analysis, and V1 PRO AI Analysis (AI-powered, sentiment analysis, self-learning weights). All systems include risk assessment and precise SL/TP.
- **Advanced Analyst Performance System**: Comprehensive metrics, 5-tier ranking, 12 achievement badges, and an AI Performance Advisor.
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
- **Groq AI Service with Circuit Breaker**: Enterprise-grade Groq API wrapper with circuit breaker pattern, intelligent caching, exponential backoff retry mechanism, rate limit tracking, and graceful fallback responses.
- **Multi-Exchange Candle Data Fallback**: Automatic failover system for cryptocurrency candle data fetching with prioritized sources and exchange-specific error handling.
- **Enhanced User Error Messaging**: Comprehensive error message catalog providing context-aware, user-friendly error explanations in Arabic with actionable solutions.
- **Quality-Based Refund System**: Intelligent refund mechanism for per-analysis payments that automatically refunds users when signal quality falls below 60%.
- **Enhanced Analysis Fee Management System**: Overhaul of the fee deduction and refund system with centralized module, instant deductions, intelligent quality extraction, comprehensive error handling, and detailed logging.
- **Enterprise Scalability Optimizations**: Batch Data Loader, LRU Membership Cache, and Safe Database Query Guards to prevent memory issues and optimize performance for large datasets.
- **Production-Scale Infrastructure Overhaul**: Architectural transformation for millions of users with Telegram Webhooks migration, Docker Containerization, Redis Cluster Configuration, Dynamic Queue Auto-Scaling, Kubernetes Orchestration, Nginx Load Balancer, Prometheus Monitoring, and Centralized Configuration.
- **Active Webhook Deployment on Replit**: Successfully converted bot from polling mode to webhook mode on Replit.
- **Redis Installation & Configuration**: Redis v7.2.6 installed and configured for Bull queue processing, intelligent caching, API cost tracking, and distributed rate limiting.
- **Advanced Memory Management System**: Intelligent memory monitoring and optimization system with enhanced memory health checks, automated memory optimizer, and AI monitor improvements.
- **Complete Multi-Language System Overhaul**: Comprehensive update ensuring full language support across all platform components, including customer service messages, bot language integration, web app language support, and a smart notification system.
- **Enhanced Translation System** (October 2025): 
  - Frontend: `public/js/translations.js` with 7 languages (ar, en, fr, es, de, ru, zh) 
  - Backend: `languages.js` with t() function for bot messages
  - Frontend applies translations via `applyTranslations()` function using data-i18n attributes
  - Language switching implemented in bot and web app with persistent storage
  - Added admin panel, system monitoring, and broadcast message translation keys
  - Translation system integrated with page load and language change events
- **AI Customer Support Multi-Language System** (October 2025):
  - Created `ai-system-prompts.js` module with complete system prompts for all 7 supported languages
  - Each language receives a fully translated system prompt containing all project information
  - Centralized prompt selection via `getSystemPrompt(language)` function with fallback to Arabic
  - Integration with Groq API customer support endpoint ensures AI responds in user's selected language
  - All languages receive identical information (features, pricing, analysis types, system specs) in their native language

**Feature Specifications**:
The platform offers a Web App for technical analysis, top movers, a wallet for USDT TRC20, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**System Design Choices**:
The project uses MongoDB Atlas, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security. Subscriptions are non-refundable and non-cancellable, with improved UX for error messages and balance display.

**Deployment Architecture**:
The system supports three deployment modes: Standalone (single-server), Docker (containerized microservices), and Kubernetes (full orchestration with auto-scaling). Infrastructure includes separate containers for HTTP Server, Bot Webhook Worker, Queue Worker, and Scheduler, all monitored via Prometheus metrics and Grafana dashboards.

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