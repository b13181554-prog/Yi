# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to offer comprehensive technical analysis, real-time market data, and automated trading functionalities across cryptocurrency and forex markets. The project integrates a Telegram Web App for user interaction, features automated withdrawal and deposit systems, and supports multiple languages. Its primary purpose is to serve as a robust and accessible trading assistant, providing users with advanced analytical capabilities and a seamless trading experience. The business vision is to secure a significant market share in automated trading by empowering users with cutting-edge tools.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture

### UI/UX Decisions
The system utilizes a professional, modern, and responsive Telegram Web App featuring a dark theme and a clean, intuitive layout. User interaction is primarily channeled through a single "🚀 Open App" button leading to the Web App.

### Technical Implementations
The core logic is built upon an Express server, managing Telegram Bot interactions, MongoDB operations, multi-language support (7 languages), automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security measures include environment variable-based API keys, robust error handling, rate limiting, and Telegram signature verification. Data quality is ensured through strict OHLC data validation, dynamic Fibonacci analysis, and advanced duplicate subscription prevention.

**Analysis Systems** (Updated October 16, 2025 - Major Improvements):
-   **Regular Analysis**: Requires 65%+ indicator agreement.
-   **Ultra Analysis (IMPROVED)**: Comprehensive analysis across 11 indicators with dynamic weighting. **Flexible criteria with 3 confidence tiers**: 
    - High Confidence (70%+ agreement, ADX >= 25, 6+ confirmations)
    - Medium Confidence (60%+ agreement, ADX >= 20, 5+ confirmations)  
    - Low Confidence (50%+ agreement, 4+ confirmations)
    Features ranging market detection (rejects if ADX < 20 or tight price/EMA convergence), dynamic indicator weights (EMA/MACD/ADX have highest weights), improved SL/TP (2-6x ATR based on timeframe), and conflict detection to prevent mixed signals.
-   **Zero Reversal Analysis (IMPROVED)**: 100-point scoring system replacing hard rejections. **Flexible criteria with 3 confidence tiers**:
    - Very High (75%+ score, ADX >= 25)
    - High (65%+ score, ADX >= 20)
    - Medium (55%+ score, ADX >= 18)
    Features flexible RSI ranges (30-60 ideal for BUY, 25-70 acceptable), graduated Stochastic scoring, dynamic R/R assessment (≥3.0 ideal, ≥2.0 good), candle pattern strength weighting, and improved SL/TP (1.2-3.5x ATR based on timeframe). Every indicator contributes points rather than causing immediate rejection.
-   **V1 PRO AI Analysis (IMPROVED)**: Advanced AI-powered system with optional sentiment analysis. **Flexible criteria with 3 signal strength tiers**:
    - Very High (≥5.5 strength, 70%+ confidence)
    - High (≥4.0 strength, 55%+ confidence)
    - Medium (≥3.0 strength, 40%+ confidence)
    Features optional sentiment analysis (no longer blocks trades if unavailable, weighted 0.8), ranging market detection (rejects if ADX < 18 or tight ranges), relaxed entry conditions (RSI < 55 for BUY, Stochastic < 40), improved SL/TP (2.0x/4.5x ATR), enhanced indicator weights (EMA 2.0, ADX 1.8, MACD 1.5), and self-learning weight adjustment. Sentiment enhances but doesn't override technical signals.

**Advanced Analyst Performance System** (October 2025):
-   **Performance Analytics**: Comprehensive metrics including Win Rate, Profit Factor, Sharpe Ratio, Max Drawdown, Average R/R, Average Win/Loss, Expectancy, Consistency Score, and Monthly Performance tracking.
-   **Tier System**: 5-tier ranking (Bronze → Silver → Gold → Platinum → Diamond) based on performance score calculated from win rate, profit factor, R/R ratio, consistency, subscriber count, and signal volume.
-   **Badge System**: 12 achievement badges including Expert Trader, Master Trader, Profit Machine, Consistent Performer, Popular Analyst, Celebrity Analyst, Experienced, Veteran, Risk Master, Low Risk, High Sharpe, and Hot Streak.
-   **AI Performance Advisor**: Groq-powered AI analysis using Llama 3.3 70B to analyze analyst patterns, identify strengths/weaknesses, detect trading patterns (win/loss streaks, best performing symbols/timeframes), and provide actionable recommendations with priority levels.
-   **Pattern Detection**: Advanced pattern recognition for win streaks, loss streaks, best/worst performing symbols, optimal timeframes, and market type performance analysis.
-   **Comparison Tool**: Side-by-side analyst comparison with detailed metrics and visualizations.
-   **Achievements System**: Automated achievement tracking for milestones like 70% win rate, 50 subscribers, 100 signals, 2.5+ profit factor, and 80% consistency score.

All analysis systems include risk assessment, precise Stop Loss & Take Profit, and balanced Risk/Reward ratios. An Analyst Protection System with escrow and daily monitoring is in place. Referral systems are implemented, and automated pump analysis for cryptocurrencies identifies potential price surges. Customer support utilizes the Groq API with the Llama 3.3 70B Versatile model for free, fast, and multi-language responses.

### Feature Specifications
The platform offers a comprehensive Web App for technical analysis, top movers, a wallet for USDT TRC20 deposits/withdrawals, analyst subscriptions, and account management. Trading features include technical analysis for crypto, forex, stocks, indices, and commodities, alongside recommendations and trending cryptocurrency tracking. Financial functionalities include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management encompasses an analyst subscription system and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, withdrawal processing, transaction viewing, referral tracking, and mass messaging. Automated trade signal monitoring checks markets every 15 minutes for strong opportunities (70%+ indicator agreement) and sends instant notifications. The withdrawal system features robust security with transaction-safe refunding. The analysis system provides high-quality trade signals, including an advanced blockchain-based pump detection system. Notification settings are customizable. The system provides comprehensive asset coverage, including 1000+ cryptocurrencies, 400+ forex pairs, 140+ global stocks, 40+ commodities, and 50+ global indices. Pump analysis is integrated, and prorated refunds are handled for subscription cancellations.

**VIP Smart Search System** (October 17, 2025):
- **Premium Subscription Service**: Monthly subscription at 10 USDT for exclusive access to advanced search capabilities
- **Advanced Search Features**: 
  - Parallel multi-source searching across all markets (crypto, forex, stocks, commodities, indices)
  - Intelligent fuzzy matching for symbol discovery
  - Smart filtering with relevance scoring (100 points for exact match, 75 for starts-with, 50 for contains, 25 for description match)
  - VIP-only enhanced sorting and ranking algorithms
- **Access Control**: Server-side subscription verification on all VIP endpoints (/api/search-assets, /api/smart-scanner)
- **User Experience**: Real-time subscription status display, subscribe/cancel functionality with pro-rated refunds
- **Multi-Language Support**: Full translation coverage across 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese)
- **Security**: Telegram WebApp data verification, user_id validation, active subscription checks before granting VIP features
- **Database Schema**: MongoDB collection 'vip_search_subscriptions' with status tracking, dates, and automatic refund calculations
- **Documentation**: Comprehensive VIP_SEARCH_README.md with feature details, pricing, API usage, and system architecture

**Smart Multi-Market Scanner** (October 2025 - VIP Feature):
- **Dynamic Symbol Discovery**: Automatically fetches and scans ALL available symbols from assets-manager (1000+ cryptocurrencies, 400+ forex pairs, 140+ stocks, 40+ commodities, 50+ indices)
- **Real-Time Progress Tracking**: Server-Sent Events (SSE) stream live updates showing scan progress, current symbol being analyzed, signals found, and estimated time remaining
- **Multi-Analysis Support**: Compatible with all analysis types (Ultra, Zero Reversal, V1 Pro, Regular, Master)
- **Market Filtering**: Scan specific markets (crypto, forex, stocks, commodities, indices) or all markets simultaneously
- **Live Results Display**: Signals appear instantly in UI as they're discovered, showing entry/exit points, confidence levels, R/R ratios, and signal reasons
- **Separate Navigation**: Dedicated "👑 VIP البحث الذكي" button in top navigation, requires active VIP subscription
- **Progressive Display**: Shows up to 20 most recent signals with visual indicators (🟢 BUY / 🔴 SELL), color-coded borders, and detailed metrics
- **Scalable Architecture**: Uses streaming to handle large symbol sets efficiently without blocking or timeouts
- **VIP Protection**: Server-side verification prevents unauthorized access, frontend blocks non-subscribers with subscription prompts

**Advanced Admin Dashboard** (October 2025):
- **Revenue Tracking**: Comprehensive revenue analytics tracking bot subscriptions, analyst commissions (owner's 30% share), total deposits, and aggregate revenue with detailed breakdowns.
- **Withdrawal Monitoring**: Real-time tracking of all withdrawal statuses (pending, completed, rejected, failed) with total amount calculations for pending and completed withdrawals.
- **Database Health**: Live database metrics showing total users, analysts, transactions, withdrawals, analyst subscriptions, and active subscriptions.
- **System Information**: Server monitoring displaying uptime, memory usage (heap used/total), Node.js version, and platform information.
- **Top Analysts Leaderboard**: Dynamic ranking of top 10 analysts by revenue with gold/silver/bronze styling for top 3 positions, showing subscriber count and total revenue per analyst.
- **Color Scheme**: Matches new branding with cyan (#00D9FF) and purple (#A855F7) gradient themes throughout admin interface.
- **Security**: Owner-only access (OWNER_ID: 7594466342) with Telegram init_data verification for all admin endpoints.

### System Design Choices
The project uses MongoDB Atlas for its database and is configured for 24/7 operation. It incorporates improved error processing and logging, and employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing a queue-based processing with Bull and Redis, circuit breaker patterns for resilience, comprehensive monitoring, and enhanced security features such as rate limiting and transaction-safe processing with MongoDB transactions.

**Enhanced Withdrawal System** (October 2025):
- Queue-based automated processing with Bull + Redis (5 parallel workers)
- Robust retry mechanism: 10 attempts with exponential backoff (5s base delay)
- Intelligent failure handling: auto-retry → owner notification → manual intervention
- Multi-channel notifications: instant user alerts (success/delay) + owner notifications (success/failure/daily reports)
- Admin integration: seamless queue management with manual approval/retry capabilities
- Scheduled monitoring: 15-minute failed withdrawal checks + 24-hour daily summary reports
- Transaction-safe operations: MongoDB transactions ensure balance consistency during retries
- System files: withdrawal-queue.js (processor), withdrawal-notifier.js (alerts), withdrawal-scheduler.js (monitoring)

## External Dependencies

-   **Databases**:
    -   MongoDB Atlas
-   **Cryptocurrency Market Data APIs**:
    -   OKX
    -   Bybit
    -   Binance
    -   CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex
    -   DexScreener, GeckoTerminal, Birdeye
-   **Forex/Stocks/Commodities/Indices Market Data APIs**:
    -   TwelveData API
    -   Yahoo Finance
    -   Alpha Vantage
    -   ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**:
    -   TRON Network (for USDT TRC20)
    -   Etherscan, BscScan
-   **Withdrawal Integration**:
    -   OKX API (USDT TRC20)
-   **Telegram**:
    -   Telegram Bot API
    -   Telegram Web App
-   **AI/Customer Support**:
    -   Groq API (Llama 3.3 70B Versatile model)
-   **Payment Gateway**:
    -   CryptAPI
-   **Whale Tracking**:
    -   Whale Alert