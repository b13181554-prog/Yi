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
-   **Whale Tracking Integration**: Implemented comprehensive whale tracking system using public APIs (DexScreener, blockchain explorers) to monitor large transactions and whale activity. Integrated whale signals into pump analysis scoring for better predictions.
-   **Simplified Pump Analysis Output**: Streamlined pump analysis to show only essential information - coin name, entry price, and target (removed stop-loss as pumps are quick movements). Smart target calculation based on signal strength (50%-150% gains).
-   **Massive Asset Expansion to 1455+ Assets**:
    -   **Stocks**: Expanded from 152 to 375 global stocks, adding quantum computing (IonQ, Rigetti), clean energy (Enphase, Plug Power), biotech (Moderna, CRISPR), gaming (EA, Roblox), travel (Booking, Marriott), and extensive Canadian, European, and Asian stocks
    -   **Commodities**: Expanded from 46 to 123 commodities, adding rare metals (Neodymium, Gallium, Germanium, Tellurium), energy products (Propane, Methanol, Jet Fuel, Diesel), agricultural products (spices like Saffron, Cardamom), and animal products (Honey, Silk, Leather, Dairy)
-   **Enhanced Pump Analysis System**: Now combines technical analysis (60%) with whale activity tracking (40%) for more accurate pump predictions and recommendations.
-   **Pump Analysis Bug Fix**: Fixed critical `stopLoss.toFixed is not a function` error in pump analysis by adding proper validation for stopLoss and target values before formatting.
-   **Comprehensive Asset Coverage - ALL Available Assets**: Implemented complete asset management system that automatically fetches ALL available trading assets from multiple APIs:
    -   **Cryptocurrencies**: Dynamic fetching from OKX, Binance, and Bybit APIs - supports ALL USDT pairs (1000+ assets)
    -   **Forex**: Expanded to ALL major and minor currency pairs (400+ pairs including EUR, GBP, USD, JPY, AUD, CAD, NZD, CHF, NOK, SEK, DKK, PLN, HUF, CZK, TRY, ZAR, MXN, SGD, HKD, THB, INR, CNY, KRW, BRL, RUB)
    -   **Stocks**: Comprehensive global coverage (140+ stocks):
        * US Tech: AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, AMD, INTC, NFLX, ADBE, CRM, ORCL, CSCO, AVGO, QCOM, TXN, IBM
        * US Finance: JPM, BAC, WFC, C, GS, MS, V, MA, PYPL, BLK, SCHW, AXP
        * US Healthcare: JNJ, UNH, PFE, ABBV, TMO, MRK, ABT, LLY, BMY, AMGN
        * US Consumer: WMT, HD, MCD, NKE, SBUX, TGT, LOW, KO, PEP, PG, DIS, CMCSA
        * US Energy/Industrial: XOM, CVX, COP, SLB, BA, CAT, GE, MMM, HON, UPS, FDX
        * Asian: BABA, TSM, Tencent, JD, BIDU, NIO, XPEV, LI, PDD, Sony, Toyota, SoftBank, Samsung
        * European: ASML, SAP, Nestle, Novartis, Roche, LVMH, L'Oreal, Sanofi, VW, Siemens, Shell, BP, HSBC
        * Middle East: Aramco, Al Rajhi, STC, SABIC, ADNOC, FAB, ADIB, DIB, Emaar, QNB
    -   **Commodities**: Complete coverage (40+ commodities):
        * Precious Metals: Gold, Silver, Platinum, Palladium, Rhodium
        * Energy: WTI Oil, Brent Oil, Natural Gas, Heating Oil, Gasoline
        * Industrial Metals: Copper, Zinc, Nickel, Aluminum, Lead, Tin, Iron Ore, Steel
        * Grains: Wheat, Corn, Soybean, Rice, Oats, Barley
        * Soft: Sugar, Coffee, Cocoa, Cotton, Orange Juice, Lumber
        * Livestock: Cattle, Hogs
        * Other: Rubber, Palm Oil, Wool
    -   **Indices**: Global coverage (50+ indices):
        * Americas: US30, SPX500, NAS100, Russell 2000, VIX, Bovespa, IPC Mexico, MERVAL, IPSA, COLCAP
        * Europe: UK100, GER40, FRA40, ESP35, ITA40, SWI20, NLD25, Euro Stoxx 50, BEL20, ATX, PSI20
        * Asia-Pacific: JPN225, HK50, CHN50, AUS200, IND50, KOR200, STI, TAIEX, SET50, IDX, KLCI, PSEi
        * MENA: FTSE/JSE, EGX30, TA-35, TASI, ADX, QE Index, Kuwait
        * Other: MOEX Russia, BIST30, OBX, OMX30, OMX Copenhagen, OMX Helsinki
-   **New API Endpoint**: `/api/all-assets` - Returns all available assets with real-time fetching and caching
-   **Enhanced Trade Signals Monitor**: Now scans random samples from ALL available assets (50 crypto, 30 forex, 40 stocks, 20 commodities, 20 indices per cycle)
-   **Pump Analysis Integration**: Pump analysis is now integrated as a standard analysis type in the Analysis section alongside other analysis options (Complete, Ultra, Zero Reversal, Fibonacci, etc.). The separate pump subscription system has been completely removed. Pump analysis is now available to all users without subscription requirement, restricted to cryptocurrency market only.
-   **Analyst Subscription Cancellation**: Users can now cancel analyst subscriptions directly from the UI with automatic refund calculation based on remaining days (refunds available up to 90% usage).
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