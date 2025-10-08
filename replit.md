# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to provide comprehensive technical analysis using various market APIs. The project aims to offer advanced trading tools, real-time data, and automated functionalities to users, supporting both cryptocurrency and forex markets. It includes features like a full-fledged Telegram Web App for a rich user experience, automated withdrawal and deposit systems, and multi-language support. The business vision is to provide a robust and accessible trading assistant with global market potential, empowering users with advanced analytical capabilities and a seamless trading workflow.

## Recent Changes
- **2025-10-08**: 
  - **Fixed critical referral system bugs:**
    - Fixed bot.js subscription referral earnings not being saved (was calling non-existent `createReferralEarning` instead of `addReferralEarning`)
    - Fixed API referral stats showing incorrect total earnings (was summing transaction amounts instead of commissions)
    - Verified 10% referral commission rate is correctly applied across all payment types
    - Referral system now fully operational with accurate tracking and reporting
  
  - **Added Analyst Referral System (20% Commission):**
    - Created separate referral system for analysts with 20% commission rate (vs 10% for regular users)
    - Implemented analyst_ref_ link format for analyst referrals
    - Added priority logic: analyst referrals take precedence over regular user referrals
    - Built dedicated UI section in analyst dashboard displaying referral link with promotional text
    - Created API endpoint `/api/get-analyst-referral-link` for fetching analyst referral links
    - Database schema updated with `referred_by_analyst` field to track analyst referrals
    - Commission distribution: 20% to referring analyst, remainder to owner (after deducting analyst's share)

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- **Data Policy**: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture

### UI/UX Decisions
- **Telegram Web App**: A professional, modern, and responsive web interface embedded within Telegram for an enhanced user experience.
- **Design**: Dark theme with a clean and intuitive layout.
- **Interaction**: Transitioned from traditional Telegram buttons to a single "🚀 Open App" button to direct all user interaction through the Web App.

### Technical Implementations
- **Core Logic**: Express server, Telegram Bot logic, MongoDB operations, environment configuration, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, TRON blockchain integration, and admin dashboard.
- **Web App Structure**: Main HTML interface, comprehensive professional dark theme styling (CSS), and full application logic with Telegram integration (JavaScript).
- **Security**: API keys in environment variables, robust error handling, rate limiting, and Telegram signature verification for Web App API requests.
- **Multi-language Support**: 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese) with user-selectable preference.
- **Data Quality & Analysis**:
    - **Data Validation**: Strict validation of OHLC data (High >= Low, High >= Max(Open, Close), Low <= Min(Open, Close), all values > 0) and minimum 20 candles for analysis.
    - **Stop Loss & Take Profit**: Calculated as a percentage of the price, adapting to different price ranges with a balanced Risk/Reward ratio and a minimum of 0.5%.
    - **Fibonacci Analysis**: Dynamic range up to 100 candles using actual High/Low for improved accuracy.
    - **Analyst System Enhancements**: Advanced duplicate subscription prevention, centralized analyst name sanitization (supports Arabic, English, numbers, limited special chars, 3-50 chars length), and unique index for case-insensitive names.
    - **Trading Room Moderation**: Comprehensive banned words system (30+ terms in Arabic & English) to prevent spam and promotion, blocking channel references, social media, contact requests, and URLs.
    - **Analysis Systems**:
        - **Regular Analysis**: 65%+ indicator agreement, provides all available signals.
        - **Ultra Analysis**: Comprehensive analysis across 10+ indicators and patterns. Requires 75%+ indicator agreement (or 85%+ with ADX>30) and high trading volume for entry. Includes a confidence rating (Ultra High, High, Medium, Low).
        - **Zero Reversal Analysis**: Strictest system, requiring 93%+ criteria (38/41 points), ADX >= 45, Risk/Reward >= 1:4, massive trading volume, 100% clear trend, safe RSI zone, strong MACD, ideal Stochastic, Bollinger Bands confirmation, and 4+ candle confirmations. Provides "100% guaranteed trade" only when all conditions are met, otherwise explains why not. Features a distinctive red UI.
    - **Risk Analysis**: All systems include risk assessment (very low, low, medium, high), precise Stop Loss & Take Profit calculation, and balanced Risk/Reward ratios.

### Feature Specifications
- **Comprehensive Web App**: Offers technical analysis tools, top movers, wallet (deposit/withdraw USDT), analyst subscriptions, and account management (user info, subscription, referral, language).
- **Trading Features**: Technical analysis for crypto, forex, stocks, indices, commodities; trading recommendations; trending cryptocurrency tracking.
- **Financial Features**: Internal USDT TRC20 wallet, **instant automated withdrawals** via OKX API (fully automatic with comprehensive error handling and fund protection), and deposits via TRON blockchain with transaction verification.
- **User Management**: Analyst subscription system and a 10% commission referral system.
- **Admin Dashboard**: Provides system statistics, user management, withdrawal processing, transaction viewing, analyst management, referral tracking, and mass messaging.

### System Design Choices
- **Database**: MongoDB Atlas for scalable and flexible data storage.
- **Deployment**: Configured for 24/7 operation on Replit.
- **Error Handling**: Improved error processing and logging across the system.
- **API Strategy**: Utilizes multiple APIs for data redundancy and fallback, addressing regional restrictions.

## External Dependencies

- **Databases**:
    - MongoDB Atlas
- **Cryptocurrency Market Data APIs** (Priority Order):
    - **OKX** (Primary)
    - **Bybit** (Secondary)
    - **Binance** (Fallback)
    - CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex (Alternative sources)
- **Forex Market Data APIs** (Priority Order):
    - **TwelveData API** (Primary)
    - **Yahoo Finance** (Secondary)
    - **Alpha Vantage** (Tertiary)
    - ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply (Rate verification)
- **Market Data APIs (No API Keys Required)**:
    - **Yahoo Finance API** (for stocks, commodities, indices)
    - **Frankfurter API (ECB Data)** (for forex)
- **Blockchain Integration**:
    - TRON Network (for USDT TRC20 deposits)
- **Withdrawal Integration**:
    - **OKX API** (USDT TRC20 instant automated withdrawals)
      - Fully automatic processing without admin approval
      - Comprehensive error handling with automatic fund refund on failure
      - Protected against double-withdrawal scenarios
      - Real-time user notifications for all withdrawal states
- **Telegram**:
    - Telegram Bot API
    - Telegram Web App