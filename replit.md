# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot designed to provide comprehensive technical analysis using various market APIs. The project aims to offer advanced trading tools, real-time data, and automated functionalities to users, supporting both cryptocurrency and forex markets. It includes features like a full-fledged Telegram Web App for a rich user experience, automated withdrawal and deposit systems, and multi-language support. The business vision is to provide a robust and accessible trading assistant with global market potential, empowering users with advanced analytical capabilities and a seamless trading workflow.

## Recent Changes
- **2025-10-09**:
  - **ربط بيانات المحللين بحساباتهم في تلجرام (Telegram Profile Integration):**
    - إزالة حقول الإدخال اليدوي للاسم والصورة من نموذج التسجيل كمحلل
    - جلب تلقائي لبيانات المحلل من حساب تلجرام (الاسم الكامل، صورة البروفايل، username)
    - إنشاء ملف telegram-helpers.js لدوال مساعدة (getTelegramUserInfo, getTelegramProfilePhoto)
    - استخدام first_name + last_name من تلجرام كاسم المحلل
    - استخدام صورة البروفايل من Telegram API (getUserProfilePhotos, getFileLink)
    - عرض username بجانب اسم المحلل في جميع البطاقات (@username) بدون إمكانية التواصل المباشر
    - تحديث قاعدة البيانات لإضافة username في استعلامات المحللين (MongoDB $lookup)
    - منع تعديل الاسم والصورة في /api/update-analyst (بيانات تلجرام ثابتة)
    - عرض username في ملف المحلل الشخصي مع ملاحظة أن البيانات من تلجرام
  
  - **تنبيه اليوم الثاني للمحللين (Day 2 Warning):**
    - إضافة رسالة تحذير واضحة وبارزة للمحللين في اليوم الثاني من عدم النشر
    - الرسالة تحتوي على: عدد المشتركين، الأرباح المعرضة للخطر، مؤقت 24 ساعة، والعواقب
    - تصميم ملفت بإيموجيات تحذير وخطوط فاصلة وألوان بارزة
  
  - **إضافة زر رابط الإحالة لجميع بطاقات المحللين:**
    - إضافة زر "🎁 رابط الإحالة (15% عمولة)" في كل أماكن عرض المحللين
    - الأماكن: كل المحللين، المحللين حسب السوق، المحللين النشطين، توب 100
    - تصميم موحد وجذاب للزر في جميع الأماكن
  
  - **نظام حماية المشتركين من المحللين غير النشطين (Analyst Protection System):**
    - نظام ضمان (Escrow): أرباح المحللين تُحجز في escrow_balance حتى نهاية الشهر
    - مراقبة يومية تلقائية: cron job يفحص نشاط المحللين يومياً
    - تنبيه اليوم الثاني: رسالة تحذير واضحة بعد يومين من عدم النشر
    - إيقاف تلقائي: إذا لم ينشر المحلل صفقة لمدة 3 أيام، يتم إيقافه تلقائياً
    - استرجاع الأموال: عند إيقاف المحلل، يتم إرجاع اشتراكات جميع المشتركين
    - تحرير الأرباح شهرياً: نهاية كل شهر، يتم نقل escrow_balance إلى available_balance
    - سحب محدود: المحللون يمكنهم فقط سحب من available_balance (الأشهر السابقة)
    - إعادة تفعيل تلقائية: المحلل الموقوف يُعاد تفعيله تلقائياً عند نشر صفقة جديدة
    - حقول جديدة للمحللين: escrow_balance, available_balance, current_month_start, last_post_date, is_suspended, suspension_reason
    - إشعارات شاملة: للمحللين والمشتركين عند الإيقاف والاسترجاع وتحرير الأرباح

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
  
  - **Fixed Referral Link Issue:**
    - Fixed referral link showing "undefined" in bot username
    - Now correctly fetches bot username from Telegram API and displays proper referral links
    - Format: https://t.me/Uuttyibv76bot?start=ref_{user_id}
  
  - **Fixed Admin Panel in Web App:**
    - Admin panel now loads automatically for owner (user ID: 7594466342)
    - Added loadAdminPanel() call in initialization
    - All admin features (user management, ban/unban, user deletion) now fully functional
  
  - **Implemented Complete Multi-Language System for Frontend:**
    - Created comprehensive translation system (public/js/translations.js) with support for 7 languages
    - Languages supported: Arabic (ar), English (en), French (fr), Spanish (de), German (de), Russian (ru), Chinese (zh)
    - Added data-i18n attributes to all UI elements for automatic translation
    - Translations now apply instantly when user changes language
    - RTL support for Arabic, Hebrew, and Farsi languages
    - All sections now translatable: navigation, analysis, wallet, analysts, profile, admin panel
  
  - **Enhanced Admin Panel Moderation System:**
    - Added user search by ID functionality with temporary state management
    - Implemented comprehensive ban system with custom duration (hours, days, weeks, months)
    - Added user restriction system (can_read_only, can_receive_signals, full_restriction)
    - Added user account deletion with confirmation dialog
    - Added unban functionality for banned users
    - Fixed critical callback guard bug that was blocking admin moderation actions
    - All admin features restricted to OWNER_ID for security
  
  - **Analyst Promoter Referral System (15% Commission):**
    - Created independent referral system for each analyst with 15% commission for promoters
    - Added "رابط الإحالة (15% عمولة)" button on each analyst card in the Web App
    - Implemented `/api/get-analyst-promoter-link` endpoint for generating promoter links
    - Format: https://t.me/botname?start=analyst_promoter_{promoter_id}_{analyst_id}
    - Commission hierarchy: Promoter Analyst (15%) → General Analyst (20%) → Regular User (10%)
    - Database tracks both promoter and analyst for accurate commission distribution
  
  - **UI/UX Improvements:**
    - Moved language selector from profile section to top-right corner of main page
    - Language selector now always visible and accessible from any section
    - Added proper styling with flag emoji and smooth transitions

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