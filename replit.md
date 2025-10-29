# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot offering Sharia-compliant technical analysis, real-time market data, and automated spot trading. It features a Telegram Web App for user interaction, automated withdrawal/deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant, empowering users with advanced analytical tools and a seamless trading experience to secure a significant market share in automated trading. All trading is strictly spot-based, adhering to Islamic finance principles by excluding futures and leverage trading.

## User Preferences
- Default Language: Arabic (ar)
- Multi-Language Support: Full support for 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- Language System: Centralized translation system with complete language coverage across Bot, Web App, and Customer Service
- Owner Notifications: Always sent in Arabic with user language context for monitoring
- Data Policy: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture
The system features a professional, modern, and responsive Telegram Web App with a dark theme. The core logic runs on an Express server managing Telegram Bot interactions, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, and TRON blockchain integration. Security includes environment variables, error handling, rate limiting, and Telegram signature verification. The project is organized with clear directories for API routes, services, middleware, public assets, utilities, Kubernetes, Docker, scripts, and documentation.

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
- **Complete Multi-Language System Overhaul**: Full language support across all platform components including customer service, bot, and web app. This includes frontend (`public/js/translations.js`), backend (`languages.js` with `t()` function), and AI system prompts (`ai-system-prompts.js`).
- **AI Code Agent System**: Comprehensive AI-powered programming assistant built with Google Gemini AI (gemini-1.5-flash) for owner-only use, accessible via `/ai` command. Features include:
  - Simplified direct chat interface - type `/ai` to start chatting immediately
  - Automatic chat mode activation for continuous conversation
  - Quick access button in admin panel for easy activation
  - File analysis, code quality suggestions, and intent detection
  - Contextual messaging with HTML sanitization for reliable delivery
  - Smart chunking for long responses to prevent Telegram API errors
  - Chat history management and contextual assistance
  - Read-only operations for project safety
  - Clear, minimalist interface focused on direct interaction
- **Advanced AI Service for All Users** (October 2025 - Updated November 2025): Enhanced intelligent assistant system powered by Google Gemini AI, available to all users with the following capabilities:
  - **Smart Chat (`/ask`)**: Intelligent conversation with full context, market analysis, and comprehensive answers to user questions
  - **Group Chat Support**: AI assistant responds in Telegram groups when mentioned (@bot) or when replying to bot's message with full 7-language support (ar, en, fr, es, de, ru, zh)
  - **Internet Search (`/search`)**: Real-time web search using DuckDuckGo API (free, no API key required) with AI-powered analysis of results and cited sources
  - **Code Analysis (`/analyze`)**: Comprehensive file and code analysis, bug detection, improvement suggestions, and quality ratings
  - **Image Generation (`/imagine`)**: AI-powered image creation support (ready for Replicate API integration with Stable Diffusion)
  - **Conversation History Management**: Maintains context across multiple messages for intelligent follow-up responses
  - **Multi-language Support**: Full support for 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese) across all AI features and group interactions
  - **Intent Detection**: Smart detection of user intentions (search, chat, analyze, generate) for appropriate handling
  - **File Processing**: Ability to read, analyze, and provide insights on project files safely with security restrictions
  - **No Additional API Keys Required**: Uses existing Google Gemini AI infrastructure (except for image generation which optionally uses Replicate)
  - **Smart Reply in Groups**: Automatically detects user language and responds accordingly in group conversations

**Feature Specifications**:
The platform offers a Web App for technical analysis, top movers, a wallet for USDT TRC20, and account management. Trading features include technical analysis for diverse asset classes and trending cryptocurrency tracking. Financial features include an internal USDT TRC20 wallet and instant automated withdrawals via OKX API. User management includes analyst subscriptions and referral programs. An extensive admin dashboard provides system statistics, user/analyst management, and withdrawal processing. Automated trade signal monitoring and a blockchain-based pump detection system are integrated.

**System Design Choices**:
The project uses MongoDB Atlas, designed for 24/7 operation with improved error processing and logging. It employs multiple APIs for data redundancy and fallback. The payment system is designed for enterprise scalability, utilizing queue-based processing with Bull and Redis, circuit breaker patterns, comprehensive monitoring, and enhanced security. Subscriptions are non-refundable and non-cancellable.

**Deployment Architecture**:
The system supports Standalone, Docker, and Kubernetes deployment modes, with separate containers for HTTP Server, Bot Webhook Worker, Queue Worker, and Scheduler, all monitored via Prometheus and Grafana.

## Gemini AI - Complete Owner Capabilities (October 2025)

**Complete Project Access System**: The owner has exclusive access to advanced Gemini AI capabilities that provide deep insights into the entire project. This system is activated via the `/ai` command and offers comprehensive access to all project files, databases, and documentation.

### Owner-Only AI Features

#### 1. **Database Intelligence (Read-Only)**
- **Get Database Statistics**: Access complete database stats including users, analysts, transactions, withdrawals, subscriptions, and growth metrics
  - `getDatabaseStats()` - General statistics
  - `getUsersCount()` - Total and filtered user counts
  - `getAnalystsCount()` - Analyst statistics and performance
  - `getSubscriptionsStats()` - Active/expired subscription data
  - `getWithdrawalsStats()` - Withdrawal status and counts
  - `getGrowthStats()` - Growth metrics (today, week, month)

- **Safe Database Queries**: Execute read-only queries on allowed collections (users, transactions, withdrawals, signals, analysts, notifications)
  - `queryDatabase(collection, query, options)` - With full NoSQL injection protection
  - Allow-list based operators and fields
  - Automatic sanitization of sensitive data (passwords, API keys, balances, private keys)
  - Limited result sets (max 100 records)

#### 2. **Project Context Intelligence**
- **Full Project Context**: Complete overview of project structure, architecture, and recent changes
  - `getFullProjectContext()` - Reads from replit.md with detailed sections
  - `getTechnicalStack()` - Runtime, frameworks, dependencies, external services
  - `getFeaturesList()` - All core, advanced, and technical features
  - `getRecentChanges()` - Latest updates and modifications
  - `getProjectSummary()` - Comprehensive project summary with statistics

- **Documentation Search**: Intelligent search across all documentation files
  - `searchDocumentation(keyword)` - Finds relevant docs with preview

#### 3. **Code Analysis & File Access**
- **File Reading & Analysis**: Safe access to project files with security restrictions
  - `analyzeFile(filePath)` - Detailed file analysis with improvement suggestions
  - `analyzeCode(code)` - Comprehensive code review with quality ratings
  - Prevents directory traversal attacks
  - Limited to project directory only

- **Project Statistics**: Real-time metrics
  - File count (JavaScript files)
  - Lines of code count
  - Project structure overview

#### 4. **Advanced AI Chat & Tools**
- **Intelligent Conversation**: Context-aware chat with full project knowledge
  - Maintains conversation history (last 20 messages)
  - Smart intent detection (chat, search, analyze, query, context)
  - Multi-language support (7 languages)

- **Internet Search Integration**: Real-time web search with AI analysis
  - DuckDuckGo API integration (free, no API key required)
  - AI-powered analysis of search results
  - Cited sources with URLs

- **Code Quality Assistant**: Professional code review and suggestions
  - Detects potential issues and security vulnerabilities
  - Provides best practices and optimization tips
  - Quality ratings (Excellent/Good/Needs Improvement)

#### 5. **Security & Safety Features**
- **Read-Only Operations**: All database operations are strictly read-only
- **Data Sanitization**: Automatic removal of sensitive fields (passwords, API keys, private keys, balances)
- **User Privacy**: User IDs and wallet addresses are masked
- **NoSQL Injection Protection**: Allow-list based query sanitization
- **Command Injection Prevention**: Removed `exec(git log)` and replaced with file system operations
- **Path Traversal Protection**: File access restricted to project directory

### How to Use as Owner

**Basic AI Chat**: Just type `/ai` to start chatting with Gemini about the project.

**Database Queries Examples**:
- "Show me database statistics"
- "How many users are there?"
- "Get recent analyst performance"
- "Show growth stats for this month"

**Project Context Examples**:
- "What are the main features of this project?"
- "Show me the technical stack"
- "What were the recent changes?"
- "Give me a project summary"

**Code Analysis Examples**:
- "Analyze the file database.js"
- "Review this code: [paste code]"
- "What are the best practices for this function?"

**Search Examples**:
- "Search for information about Redis clustering"
- "Find news about cryptocurrency regulations"
- "What's the latest on Telegram Bot API?"

### Technical Implementation Details

**Security Layers**:
1. **Query Sanitization** (`sanitizeQuery()`): Removes dangerous operators ($where, $expr, $function, $regex, etc.)
2. **Field Allow-List**: Only permitted fields are queryable (user_id, username, status, etc.)
3. **Result Sanitization** (`sanitizeResults()`): Strips sensitive data from all results
4. **Projection Hardcoding**: Forces safe projection, cannot be overridden
5. **File System Safety**: No shell command execution, only Node.js fs operations

**Available Collections** (Read-Only):
- `users` - User accounts and subscriptions
- `transactions` - Payment and deposit transactions
- `withdrawals` - Withdrawal requests and statuses
- `signals` - Trading signals from analysts
- `analysts` - Analyst profiles and performance
- `notifications` - System notifications

**Gemini AI Models Used**:
- `gemini-2.0-flash-exp` - Latest experimental model (chat, analysis, vision)
- `gemini-flash-latest` - Auto-updated to newest version
- Free tier with generous limits (1500 requests/day)

**Files Structure**:
- `gemini-service.js` - Core Gemini AI service
- `advanced-ai-service.js` - Advanced AI features for all users
- `ai-code-agent.js` - Owner-only code agent
- `ai-database-tools.js` - Safe database access layer
- `ai-project-context.js` - Project context provider
- `ai-system-prompts.js` - Multi-language system prompts

**Recent Security Updates (October 2025)**:
- ✅ Removed `exec(git log)` - Replaced with `replit.md` reading
- ✅ Added NoSQL injection protection with allow-list approach
- ✅ Enforced read-only database operations
- ✅ Implemented automatic data sanitization
- ✅ Added file path traversal protection
- ✅ Removed balance and financial data exposure

## External Dependencies

-   **Databases**: MongoDB Atlas, Redis (v7.2.6)
-   **Cryptocurrency Market Data APIs**: OKX, Bybit, Binance, CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex, DexScreener, GeckoTerminal, Birdeye
-   **Forex/Stocks/Commodities/Indices Market Data APIs**: TwelveData API, Yahoo Finance, Alpha Vantage, ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
-   **Blockchain Integration**: TRON Network (for USDT TRC20), Etherscan, BscScan
-   **Withdrawal Integration**: OKX API (USDT TRC20)
-   **Telegram**: Telegram Bot API, Telegram Web App
-   **AI/Customer Support**: Google Gemini AI (gemini-2.0-flash-exp - updated October 2025)
-   **Payment Gateway**: CryptAPI
-   **Whale Tracking**: Whale Alert