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

**Analysis Systems** (Updated October 2025 for balanced trading opportunities):
-   **Regular Analysis**: Requires 65%+ indicator agreement.
-   **Ultra Analysis**: Comprehensive analysis across 10+ indicators/patterns. **Balanced criteria**: 75-82% indicator agreement, ADX >= 25-30, 7-8+ confirmations, high/massive trading volume, R/R >= 2:1, RSI/MACD confirmation. Provides more trading opportunities while maintaining quality signals.
-   **Zero Reversal Analysis**: Strong trend analysis system with **balanced criteria**: ADX >= 30, widened RSI ranges (20-65 for BUY, 35-80 for SELL), high/massive volume, 3/5 candle confirmation, R/R >= 2.5:1, strength score 30+/41. Focuses on strong trends with manageable risk.
-   **V1 PRO AI Analysis** (NEW): Advanced AI-powered analysis system combining technical analysis with sentiment analysis and self-learning capabilities. Features: EMA 20/50/200, RSI, MACD, Stochastic, Bollinger Bands, ATR, ADX analysis + AI sentiment analysis (-1 to +1 scale) using Groq API with Llama 3.3 70B model + risk management (2% per trade, 1.5x ATR stop loss, 3x ATR take profit) + automatic position sizing + self-learning weight adjustment based on performance (3 consecutive losses = reduce weight 10%, 3 consecutive wins = increase weight 10%) + confidence scoring (0-1). Stores learning weights in MongoDB. Provides unified output with direction, technical signal, sentiment result, final signal (BUY/SELL/WAIT), SL/TP levels, position size, and confidence percentage.
All analysis systems include risk assessment, precise Stop Loss & Take Profit, and balanced Risk/Reward ratios. An Analyst Protection System with escrow and daily monitoring is in place. Referral systems are implemented, and automated pump analysis for cryptocurrencies identifies potential price surges. Customer support utilizes the Groq API with the Llama 3.3 70B Versatile model for free, fast, and multi-language responses.

### Feature Specifications
The platform offers a comprehensive Web App for technical analysis, top movers, a wallet for USDT TRC20 deposits/withdrawals, analyst subscriptions, and account management. Trading features include technical analysis for crypto, forex, stocks, indices, and commodities, alongside recommendations and trending cryptocurrency tracking. Financial functionalities include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management encompasses an analyst subscription system and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, withdrawal processing, transaction viewing, referral tracking, and mass messaging. Automated trade signal monitoring checks markets every 15 minutes for strong opportunities (70%+ indicator agreement) and sends instant notifications. The withdrawal system features robust security with transaction-safe refunding. The analysis system provides high-quality trade signals, including an advanced blockchain-based pump detection system. Notification settings are customizable. The system provides comprehensive asset coverage, including 1000+ cryptocurrencies, 400+ forex pairs, 140+ global stocks, 40+ commodities, and 50+ global indices. Pump analysis is integrated, and prorated refunds are handled for subscription cancellations.

### System Design Choices
The project uses MongoDB Atlas for its database and is configured for 24/7 operation. It incorporates improved error processing and logging, and employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing a queue-based processing with Bull and Redis, circuit breaker patterns for resilience, comprehensive monitoring, and enhanced security features such as rate limiting and transaction-safe processing with MongoDB transactions.

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