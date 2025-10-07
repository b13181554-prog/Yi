# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to provide comprehensive technical analysis using various market APIs. The project aims to offer advanced trading tools, real-time data, and automated functionalities to users, supporting both cryptocurrency and forex markets. It includes features like a full-fledged Telegram Web App for a rich user experience, automated withdrawal and deposit systems, and multi-language support. The business vision is to provide a robust and accessible trading assistant with global market potential, empowering users with advanced analytical capabilities and a seamless trading workflow.

## Recent Changes (October 2025)

### Latest Update - Enhanced Analyst System (Oct 7, 2025)
- **Subscription Management**: Implemented single-subscription policy per analyst
  - Prevents users from subscribing multiple times to the same analyst
  - Clear error messages when attempting duplicate subscriptions
  
- **Analyst Profile Enhancement**: Added market specialization fields
  - Analysts can now specify which markets they analyze (Crypto, Forex, Stocks, etc.)
  - Market information displayed in analyst profiles and registration
  
- **Name Uniqueness Enforcement**: Database-level duplicate name prevention
  - Unique index with case-insensitive collation prevents duplicate analyst names
  - Automatic data cleanup removes invalid analyst records
  - Safe name normalization (trimming) before storage
  
- **Trading Room Feature**: Dedicated space for analysts to post trade signals
  - Content moderation system prevents off-topic discussions
  - Automatic blocking of external channel/product promotions
  - Forbidden words detection (channel, telegram, whatsapp, instagram, etc.)
  - Subscribers automatically notified of new trade posts
  
- **Analyst Notifications**: Real-time alerts for new subscribers
  - Analysts receive immediate notification when gaining a subscriber
  - Notification includes subscriber info, payment amount, and analyst's revenue share
  
- **Subscriber Dashboard**: Analysts can view their subscriber list
  - `/api/analyst-subscribers` endpoint provides subscriber details
  - Real-time subscriber count tracking

### Data Accuracy Improvements (Oct 7, 2025)
- **Real Price Data Implementation**: Replaced all estimated/placeholder data with authentic real-time market data
  - **Cryptocurrency Candles**: Now using OKX API (primary), Bybit (secondary), and Binance (fallback) for accurate OHLC data
  - **Forex Candles**: Integrated TwelveData API for real forex candle data with proper OHLC values
  - **Removed Deprecated Services**: Deleted old unused files (`multi-market-data.js`, `unified-market-service.js`, `binance-service.js`)
  - **Priority System**: OKX is now the primary data source for all cryptocurrency market data
  - **Fallback Strategy**: Enhanced error handling with proper fallback mechanisms for data reliability

### Data Integrity Enhancement
- Removed all mock/test data from the project
  - Eliminated `test_mode` bypass in API authentication
  - Removed placeholder user ID (123456789) from frontend
  - Deleted test files: `test-market-data.js`, `test-prices.js`, `public/test-analysis.html`
  - Application now strictly requires genuine Telegram WebApp data to function
  - Clear error messages displayed when app is accessed outside Telegram bot

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
- **Core Logic**:
    - `index.js`: Main entry point, Express server, and API endpoints.
    - `bot.js`: Telegram Bot logic and message handling.
    - `database.js`: MongoDB operations.
    - `config.js`: Environment settings and secrets.
    - `languages.js`: Multi-language translation system (7 languages).
    - `binance-service.js`: Integration with Binance API for automated withdrawals.
    - `market-data.js`: Fetches market data from various cryptocurrency APIs.
    - `forex-service.js`: Fetches forex market data.
    - `analysis.js`: Technical analysis indicators (RSI, MACD, EMA, SMA, BBANDS, ATR).
    - `notifications.js`: User notifications.
    - `tron.js`: TRON blockchain integration for USDT TRC20 deposits.
    - `admin.js`: Owner dashboard for bot management.
    - `rate-limiter.js`: Protects against repeated requests.
- **Web App Structure**:
    - `/public/index.html`: Main web application interface.
    - `/public/css/style.css`: Comprehensive professional dark theme styling.
    - `/public/js/app.js`: Full application logic and Telegram integration.
- **Security**:
    - API keys are stored in environment variables, not hardcoded.
    - Application stops immediately if essential environment variables are missing.
    - Advanced security with rate limiting.
    - Telegram signature verification for all Web App API requests.
- **Multi-language Support**: 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese) with user-selectable preference.

### Feature Specifications
- **Comprehensive Web App**:
    - Technical Analysis: Select currency, timeframe, indicators, market type (Crypto/Forex).
    - Top Movers: Displaying top gainers, losers, and highest volume assets.
    - Wallet: Deposit/withdraw USDT with transaction history.
    - Analysts: View available analysts and subscribe to services.
    - My Account: User info, subscription, referral system, language settings.
- **Trading Features**:
    - Technical analysis for crypto and forex.
    - Trading recommendations with entry/exit points.
    - Tracking of trending cryptocurrencies.
    - Support for 15+ cryptocurrencies and 10+ forex pairs.
- **Financial Features**:
    - Internal wallet for USDT TRC20.
    - Automated withdrawals via Binance API.
    - Deposits via TRON blockchain (USDT TRC20 transaction verification, duplicate prevention, instant notifications).
- **User Management**:
    - Analyst subscription system.
    - Referral system with 10% commission.
- **Admin Dashboard**: Accessible via `/admin` command, offering system statistics, user management, withdrawal processing, transaction viewing, analyst management, referral tracking, and mass messaging.

### System Design Choices
- **Database**: MongoDB Atlas for scalable and flexible data storage.
- **Deployment**: Configured for 24/7 operation on Replit using Reserved VM or UptimeRobot.
- **Error Handling**: Improved error processing and logging for better diagnostics in `config.js`, `multi-market-data.js`, and `tron.js`.
- **API Strategy**: Utilizes multiple APIs for data redundancy and fallback, addressing regional restrictions (e.g., Binance/Bybit in Libya).

## External Dependencies

- **Databases**:
    - MongoDB Atlas
- **Cryptocurrency Market Data APIs** (Priority Order):
    - **OKX** (Primary) - Real-time prices and authentic OHLC candle data
    - **Bybit** (Secondary) - Real candle data with proper High/Low values
    - **Binance** (Fallback) - Additional data source
    - CoinGecko - Price verification
    - Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex - Alternative sources
- **Forex Market Data APIs**:
    - **TwelveData API** (Primary) - Real forex candle data with authentic OHLC
    - **Frankfurter API** (Fallback) - ECB historical data
    - ExchangeRate-API, FloatRates, VATComply - Rate verification
- **Market Data APIs (No API Keys Required)**:
    - **Yahoo Finance API** - للأسهم والسلع والمؤشرات (بدون مفاتيح API)
    - **Frankfurter API (ECB Data)** - للفوركس (بدون مفاتيح API، بيانات البنك المركزي الأوروبي)
- **Blockchain Integration**:
    - TRON Network (for USDT TRC20 deposits)
- **Withdrawal Integration**:
    - Binance API
- **Telegram**:
    - Telegram Bot API
    - Telegram Web App