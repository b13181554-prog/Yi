# OBENTCHI Trading Bot

## Overview
OBENTCHI is a Telegram-based cryptocurrency trading bot offering comprehensive technical analysis, real-time data, and automated functionalities for both cryptocurrency and forex markets. It features a full-fledged Telegram Web App, automated withdrawal and deposit systems, and multi-language support. The project aims to be a robust, accessible trading assistant empowering users with advanced analytical capabilities and a seamless trading workflow.

## User Preferences
- Default Language: Arabic (ar)
- يمكن للمستخدمين تغيير اللغة من خلال القائمة الرئيسية
- **Data Policy**: No mock or placeholder data - all data must be authentic from real APIs and Telegram

## System Architecture

### UI/UX Decisions
- **Telegram Web App**: Professional, modern, and responsive interface embedded within Telegram.
- **Design**: Dark theme with a clean and intuitive layout.
- **Interaction**: All user interaction is directed through a single "🚀 Open App" button to the Web App.

### Technical Implementations
- **Core Logic**: Express server, Telegram Bot logic, MongoDB operations, multi-language support, automated withdrawals, market data fetching, technical analysis, notifications, TRON blockchain integration, and admin dashboard.
- **Web App Structure**: HTML, professional dark theme CSS, and JavaScript with Telegram integration.
- **Security**: API keys in environment variables, robust error handling, rate limiting, and Telegram signature verification.
- **Multi-language Support**: 7 languages (Arabic, English, French, Spanish, German, Russian, Chinese) with user-selectable preference.
- **Data Quality & Analysis**: Strict validation of OHLC data, dynamic Fibonacci analysis, advanced duplicate subscription prevention for analysts, and comprehensive trading room moderation for spam.
- **Analysis Systems**:
    - **Regular Analysis**: 65%+ indicator agreement, provides all available signals.
    - **Ultra Analysis**: Comprehensive analysis across 10+ indicators/patterns, 75%+ indicator agreement (or 85%+ with ADX>30), high trading volume, and confidence rating.
    - **Zero Reversal Analysis**: Strictest system, 93%+ criteria (38/41 points), ADX >= 45, R/R >= 1:4, massive volume, 100% clear trend, and multiple confirmations. Provides "100% guaranteed trade" when all conditions are met.
- **Risk Analysis**: All systems include risk assessment (very low, low, medium, high), precise Stop Loss & Take Profit, and balanced Risk/Reward ratios.
- **Analyst Protection System**: Escrow system for analyst earnings, daily activity monitoring with warnings, automatic suspension for inactivity (3 days), and automatic refund of subscriptions.
- **Referral Systems**: Separate referral systems for users (10%), analysts (20%), and analyst promoters (15%).

### Feature Specifications
- **Comprehensive Web App**: Technical analysis tools, top movers, wallet (deposit/withdraw USDT), analyst subscriptions, and account management.
- **Trading Features**: Technical analysis for crypto, forex, stocks, indices, commodities; trading recommendations; trending cryptocurrency tracking.
- **Financial Features**: Internal USDT TRC20 wallet, instant automated withdrawals via OKX API, and deposits via TRON blockchain.
- **User Management**: Analyst subscription system and referral systems.
- **Admin Dashboard**: System statistics, user management, withdrawal processing, transaction viewing, analyst management, referral tracking, and mass messaging.

### System Design Choices
- **Database**: MongoDB Atlas.
- **Deployment**: Configured for 24/7 operation.
- **Error Handling**: Improved error processing and logging.
- **API Strategy**: Multiple APIs for data redundancy and fallback.

## External Dependencies

- **Databases**:
    - MongoDB Atlas
- **Cryptocurrency Market Data APIs**:
    - OKX (Primary)
    - Bybit (Secondary)
    - Binance (Fallback)
    - CoinGecko, Gate.io, Kraken, Coinbase, CoinPaprika, Huobi, Crypto.com, Bitfinex (Alternative sources)
- **Forex Market Data APIs**:
    - TwelveData API (Primary)
    - Yahoo Finance (Secondary)
    - Alpha Vantage (Tertiary)
    - ExchangeRate-API, Frankfurter (ECB), FloatRates, VATComply
- **Market Data APIs (No API Keys Required)**:
    - Yahoo Finance API (for stocks, commodities, indices)
    - Frankfurter API (ECB Data) (for forex)
- **Blockchain Integration**:
    - TRON Network (for USDT TRC20 deposits)
- **Withdrawal Integration**:
    - OKX API (USDT TRC20 instant automated withdrawals)
- **Telegram**:
    - Telegram Bot API
    - Telegram Web App

## Recent Changes - 2025-10-09

### تحسينات نظام حذف حساب المحلل
- ✅ إرجاع كامل المبالغ المتبقية للمشتركين عند حذف المحلل لحسابه
- ✅ حذف سجل المحلل بالكامل من قاعدة البيانات (deleteOne بدلاً من is_active: false)
- ✅ السماح للمحلل بإنشاء حساب جديد بعد حذف حسابه السابق
- ✅ إرسال إشعارات للمشتركين والمحلل عند الحذف
- ✅ إضافة logging مفصل (deleteResult.deletedCount) للتأكد من نجاح عملية الحذف
- ✅ معالجة أخطاء محسّنة مع رسالة خطأ واضحة في حالة فشل الحذف

### تحويل نظام الحجز من شهري إلى يومي
- ✅ نظام إطلاق يومي للأرباح بدلاً من الانتظار حتى نهاية الشهر
- ✅ حساب المبلغ بناءً على نسبة الوقت المنقضي الدقيقة (progressRatio)
- ✅ ضمان إطلاق كامل المبلغ (30/30) لجميع الاشتراكات
- ✅ معالجة الاشتراكات المنتهية خلال آخر 24 ساعة للدفعة الأخيرة
- ✅ تتبع دقيق للمبالغ المفرج عنها (released_amount)

### إخفاء معرف المحلل
- ✅ إزالة @username من جميع بطاقات المحللين
- ✅ إزالة من صفحة المحلل الشخصية
- ✅ الاحتفاظ بالاسم الكامل فقط

### تحسين واجهة المستخدم
- ✅ نقل عرض "رصيدك الحالي" من القائمة الرئيسية إلى أعلى قسم المحفظة
- ✅ تحسين تجربة المستخدم بجعل الرصيد ظاهراً مباشرة عند فتح المحفظة

### إصلاحات نهائية نظام المحللين والإدارة - 2025-10-09
- ✅ **إصلاح حذف حساب المحلل** (تم التحديث في 09/10/2025): 
  - **المشكلة**: كان النظام يحذف سجل المستخدم من جدول `users` عند حذف حساب المحلل، مما يُفقد المستخدم كل بياناته (الرصيد، المعاملات، إلخ)
  - **الحل**: الآن عند حذف حساب المحلل، يتم:
    - ✅ حذف سجل المحلل من جدول `analysts` فقط
    - ✅ الحفاظ على بيانات المستخدم في جدول `users` (الرصيد، المعاملات، الإحالات)
    - ✅ السماح للمحلل بإنشاء حساب محلل جديد بنفس username دون مشاكل
    - ✅ يمكن للمستخدم إعادة التسجيل كمحلل في أي وقت دون فقدان أي بيانات
  
- ✅ **إصلاح حساب الاسترجاع النسبي**:
  - حساب المبلغ المسترجع بناءً على الأيام المتبقية من الاشتراك (proportional refund)
  - مثال: إذا اشتغل المحلل 5 أيام وحذف حسابه، يُسترجع فقط 25/30 من المبلغ (25 يوم متبقي)
  - حماية من الاسترجاع الزائد عن المبلغ الأصلي (clamping mechanism)
  - معالجة الحالات الخاصة (اشتراكات منتهية، اشتراكات مستقبلية)
  
- ✅ **إصلاح أزرار لوحة الإدارة**:
  - حل مشكلة استدعاء answerCallbackQuery المتكرر
  - كل زر الآن يستجيب بشكل صحيح ومستقل
  - تحسين تجربة المستخدم للمالك في لوحة التحكم

### لوحة إدارة احترافية في Web App - 2025-10-09
- ✅ **إنشاء لوحة إدارة شاملة للمالك في Web App**:
  - **8 تبويبات رئيسية**:
    - 📊 الإحصائيات (9 مؤشرات: المستخدمين، النشطين، الأرصدة، الاشتراكات، المحللين، المعاملات، طلبات السحب، الإحالات)
    - 👥 المستخدمين (عرض، حظر دائم/مؤقت، حذف، بحث)
    - 👨‍💼 المحللين (عرض، تفعيل/إيقاف، إحصائيات)
    - 💸 طلبات السحب (موافقة/رفض مع إشعارات تلقائية)
    - 💰 المعاملات (سجل كامل مع فلترة حسب النوع)
    - 🎁 الإحالات (أفضل 20 محيل مع الأرباح)
    - 📢 رسالة جماعية (إرسال لجميع المستخدمين، دعم HTML)
    - 🔍 بحث متقدم (بالـ ID أو الاسم مع تفاصيل شاملة)
  
  - **9 API Endpoints جديدة**:
    - `/api/admin/stats` - الإحصائيات الشاملة
    - `/api/admin/analysts` - إدارة المحللين
    - `/api/admin/withdrawals` - طلبات السحب
    - `/api/admin/approve-withdrawal` - الموافقة على سحب
    - `/api/admin/reject-withdrawal` - رفض سحب
    - `/api/admin/transactions` - سجل المعاملات
    - `/api/admin/top-referrers` - أفضل المحيلين
    - `/api/admin/broadcast` - رسالة جماعية
    - `/api/admin/search` - بحث متقدم
  
  - **الأمان المُحسّن**:
    - دالة `getUserIdFromInitData()` لاستخراج user_id من init_data المُتحقق منه
    - جميع admin endpoints تستخرج user_id من init_data (لا تثق بـ request body)
    - التحقق الصارم من OWNER_ID في كل endpoint
    - إصلاح ثغرة أمنية خطيرة كانت تسمح بتزوير صلاحيات المالك
  
  - **التصميم**:
    - كروت إحصائيات ملونة بألوان متدرجة احترافية
    - تصميم responsive ومتناسق مع باقي التطبيق
    - أزرار واضحة وفعالة مع رسائل تأكيد
    - معالجة أخطاء شاملة
  
  - **البيانات**:
    - جميع البيانات حقيقية من MongoDB (no mock data)
    - استخدام دوال database.js الموجودة
    - تحديثات فورية للإحصائيات

### تحسينات نظام المحللين - 2025-10-09
- ✅ **إضافة زر الاشتراك في قسم Top 100 المحللين**:
  - عرض السعر الشهري للمحلل مباشرة في البطاقة
  - زر اشتراك/تجديد متكامل مع النظام الحالي
  - معالجة fallback للأسعار غير المعرفة (عرض 0 USDT)
  - تصميم متناسق مع باقي واجهة المحللين

### تنظيف المشروع - 2025-10-09
- ✅ **حذف الملفات والأكواد القديمة غير المستخدمة**:
  - حذف ملفات Render (render.yaml - لا حاجة للنشر على Render)
  - حذف ملفات التوثيق المكررة (RENDER_DEPLOY.md, RENDER_DEPLOY_GUIDE.md, SETUP_INSTRUCTIONS.md)
  - حذف 15 صورة screenshot قديمة من attached_assets/
  - تنظيف الكود وتحسين هيكلة المشروع