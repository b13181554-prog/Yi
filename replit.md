# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to provide comprehensive technical analysis, real-time data, and automated functionalities for both cryptocurrency and forex markets. It features a full-fledged Telegram Web App, automated withdrawal and deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical capabilities and a seamless trading workflow, with a business vision to capture a significant share of the automated trading market.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture

### UI/UX Decisions
The system features a professional, modern, and responsive Telegram Web App with a dark theme and a clean, intuitive layout. User interaction is primarily directed through a single "🚀 Open App" button to the Web App.

### Technical Implementations
The core logic is built on an Express server handling Telegram Bot interactions, MongoDB operations, multi-language support (7 languages), automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security measures include API keys in environment variables, robust error handling, rate limiting, and Telegram signature verification. Data quality is ensured through strict OHLC data validation, dynamic Fibonacci analysis, and advanced duplicate subscription prevention.

**Analysis Systems**:
-   **Regular Analysis**: Requires 65%+ indicator agreement.
-   **Ultra Analysis**: Comprehensive analysis across 10+ indicators/patterns, 75%+ (or 85%+ with ADX>30) indicator agreement, high trading volume, and confidence rating.
-   **Zero Reversal Analysis**: The strictest system, requiring 93%+ criteria (38/41 points), ADX >= 45, R/R >= 1:4, massive volume, 100% clear trend, and multiple confirmations for "100% guaranteed trade" signals.

All analysis systems include risk assessment (very low, low, medium, high), precise Stop Loss & Take Profit, and balanced Risk/Reward ratios. The system also incorporates an Analyst Protection System with an escrow for earnings, daily activity monitoring, and automatic suspension for inactivity. Referral systems are implemented for users, analysts, and analyst promoters. Automated pump analysis for cryptocurrencies identifies potential 100%+ price surges.

### Feature Specifications
The platform offers a comprehensive Web App with technical analysis tools, top movers, a wallet for USDT TRC20 deposits/withdrawals, analyst subscriptions, and account management. Trading features include technical analysis for crypto, forex, stocks, indices, and commodities, along with trading recommendations and trending cryptocurrency tracking. Financial functionalities include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes an analyst subscription system and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, withdrawal processing, transaction viewing, referral tracking, and mass messaging. Automated trade signal monitoring checks all markets every 15 minutes for strong opportunities (70%+ indicator agreement) and sends instant notifications based on user preferences.

**Recent Updates (October 10, 2025):**
-   **Pump Analysis Integration**: Pump analysis is now integrated as a standard analysis type in the Analysis section alongside other analysis options (Complete, Ultra, Zero Reversal, Fibonacci, etc.). The separate pump subscription system has been completely removed. Pump analysis is now available to all users without subscription requirement, restricted to cryptocurrency market only.
-   **Analyst Subscription Cancellation**: Users can now cancel analyst subscriptions directly from the UI with automatic refund calculation based on remaining days (refunds available up to 90% usage).
-   **Expanded Market Coverage**: Trade signals monitoring expanded to cover:
    -   Forex: 15 pairs (added AUDJPY, EURAUD, EURCHF, AUDNZD, NZDJPY)
    -   Commodities: 18 assets (added Platinum, Palladium, Natural Gas, Copper, grains, metals)
    -   Indices: 20 global indices (added FRA40, JPN225, HK50, AUS200, and more)
    -   Stocks: 31 major stocks (added BABA, JPM, V, JNJ, WMT, and more)
-   **Analyst Subscription UI Fix**: Fixed unsubscribe button not appearing in subscriptions tab by ensuring `loadAnalysts()` is called when switching to subscriptions view, refreshing the DOM with current subscription data.
-   **Multi-Language Support for Pump Analysis**: Full translation support added for Pump analysis in all 7 supported languages (Arabic, English, French, Spanish, German, Russian, Chinese).

### System Design Choices
The project utilizes MongoDB Atlas for its database and is configured for 24/7 operation. It features improved error processing and logging, and employs multiple APIs for data redundancy and fallback.

## External Dependencies

-   **Databases**:
    -   MongoDB Atlas
-   **Cryptocurrency Market Data APIs**:
    -   OKX (Primary)
    -   Bybit (Secondary)
    -   Binance (Fallback)
    -   CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex (Alternative sources)
-   **Forex Market Data APIs**:
    -   TwelveData API (Primary)
    -   Yahoo Finance (Secondary)
    -   Alpha Vantage (Tertiary)
    -   ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**:
    -   TRON Network (for USDT TRC20 deposits)
-   **Withdrawal Integration**:
    -   OKX API (USDT TRC20 instant automated withdrawals)
-   **Telegram**:
    -   Telegram Bot API
    -   Telegram Web App