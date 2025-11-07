#!/usr/bin/env node

/**
 * OBENTCHI Trading Bot - Main Entry Point
 * نقطة دخول موحدة ونظيفة للمشروع
 */

// تحميل المتغيرات البيئية
require('dotenv').config();

// إجبار polling mode في Replit (تجنب الكشف التلقائي الخاطئ بسبب PUBLIC_URL)
if (!process.env.FORCE_POLLING && !process.env.FORCE_WEBHOOK) {
  process.env.FORCE_POLLING = 'true';
  console.log('🔧 Auto-configured FORCE_POLLING=true for Replit environment');
}

const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./database');
const bot = require('./bot');
const { rateLimitMiddleware } = require('./advanced-rate-limiter');
const accessControl = require('./user-access-control');
const { authenticateAPI, validateRequestSize } = require('./api-security');
const { createMetricsEndpoint, httpMetricsMiddleware } = require('./metrics-exporter');
const monitoringService = require('./monitoring-service');
const { startPaymentProcessor } = require('./payment-callback-queue');
const { startWithdrawalProcessor } = require('./withdrawal-queue');
const { startWithdrawalScheduler } = require('./withdrawal-scheduler');
const { initAnalystMonitor } = require('./analyst-monitor');
const { initTradeSignalsMonitor } = require('./trade-signals-monitor');
const rankingScheduler = require('./ranking-scheduler');
const aiMonitor = require('./ai-monitor');
const memoryOptimizer = require('./memory-optimizer');
const geminiService = require('./gemini-service');

// تكوين Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware أساسي
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateRequestSize);
app.use(httpMetricsMiddleware);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check (بدون rate limiting)
app.get('/api/health', async (req, res) => {
  try {
    const health = await monitoringService.checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 207 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Prometheus metrics endpoint
createMetricsEndpoint(app);

// Advanced Tiered Rate Limiters
const analysisRateLimit = rateLimitMiddleware.analysis();
const marketDataRateLimit = rateLimitMiddleware.marketData();
const searchRateLimit = rateLimitMiddleware.search();
const aiRateLimit = rateLimitMiddleware.ai();
const scannerRateLimit = rateLimitMiddleware.scanner();

// دالة لتحميل API routes
const setupAPIRoutes = async () => {
  const marketData = require('./market-data');
  const forexService = require('./forex-service');
  const TechnicalAnalysis = require('./analysis');
  const { getTelegramProfilePhoto } = require('./telegram-helpers');
  const { addPaymentCallback } = require('./payment-callback-queue');
  
  // Access Control Routes
  const accessControlRoutes = require('./api-routes/access-control-routes');
  app.use('/api/access', accessControlRoutes);
  
  // Real-time Dashboard Routes
  const realtimeDashboardRoutes = require('./api-routes/realtime-dashboard-routes');
  app.use('/api/realtime', realtimeDashboardRoutes);
  
  // Feature Flags Routes
  const featureFlagRoutes = require('./api-routes/feature-flag-routes');
  app.use('/api/feature-flags', featureFlagRoutes);
  
  // User data endpoint
  app.post('/api/user', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const { user_id } = req.body;
      const user = await db.getUser(user_id);
      
      if (!user) {
        return res.json({ success: false, error: 'User not found' });
      }
      
      const botInfo = await bot.getMe();
      const botUsername = botInfo.username;
      
      res.json({ success: true, user, botUsername });
    } catch (error) {
      console.error(`Error fetching user: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Market data endpoints
  app.post('/api/price', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const { symbol, marketType } = req.body;
      
      if (!symbol) {
        return res.json({ success: false, error: 'Symbol is required' });
      }
      
      let price;
      if (marketType === 'forex' || marketType === 'stocks' || marketType === 'commodities' || marketType === 'indices') {
        price = await forexService.getForexPrice(symbol);
      } else {
        price = await marketData.getCryptoPrice(symbol);
      }
      
      res.json({ success: true, price });
    } catch (error) {
      console.error(`Error fetching price: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Analysis endpoint
  app.post('/api/analyze', authenticateAPI, analysisRateLimit, async (req, res) => {
    try {
      const { symbol, marketType, user_id } = req.body;
      
      if (!symbol || !marketType) {
        return res.json({ success: false, error: 'Symbol and marketType are required' });
      }
      
      const hasSubscription = await db.isSubscriptionActive(user_id);
      if (!hasSubscription) {
        return res.json({ 
          success: false, 
          error: 'subscription_required',
          message: 'يجب الاشتراك للحصول على التحليل الفني'
        });
      }
      
      const analyzer = new TechnicalAnalysis();
      const analysis = await analyzer.analyze(symbol, marketType);
      
      res.json({ success: true, analysis });
    } catch (error) {
      console.error(`Error analyzing: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('✅ API routes loaded');
};

// دالة البدء الرئيسية
const startApp = async () => {
  try {
    console.log('🚀 Starting OBENTCHI Bot...');
    console.log('🔄 Mode: POLLING');
    
    // بدء الاستماع على port 5000 فوراً (أولوية قصوى)
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 HTTP Server is running on port ${PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`📊 Metrics endpoint: http://localhost:${PORT}/api/metrics`);
      console.log(`📈 Queue stats: http://localhost:${PORT}/api/queue/stats`);
      console.log(`🔗 Public URL will be available at your Replit domain`);
    });
    
    // تحميل الباقي بشكل async (بعد فتح port 5000)
    setImmediate(async () => {
      try {
        // Initialize database
        console.log('📊 Initializing database...');
        await db.initDatabase();
        
        // Initialize batch loader (after database)
        const { initBatchLoader } = require('./bot');
        initBatchLoader();
        
        // Initialize Feature Flags Service
        const featureFlagService = require('./services/feature-flags');
        await featureFlagService.initialize(db.getDB());
        
        // Setup API routes
        await setupAPIRoutes();
        
        // بدء البوت في polling mode
        console.log('📡 Starting bot polling...');
        
        // تنظيف شامل قبل بدء Polling
        // 1. إيقاف أي polling نشط
        try {
          console.log('🛑 Stopping any active polling...');
          const { safeStopPolling } = require('./bot');
          await safeStopPolling();
          console.log('✅ Active polling stopped');
        } catch (error) {
          console.log('ℹ️ No active polling to stop');
        }
        
        // 2. حذف webhook
        let webhookDeleted = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`🧹 Cleanup attempt ${attempt}/3: Deleting webhook...`);
            await bot.deleteWebHook({ drop_pending_updates: true });
            console.log('✅ Webhook deleted successfully');
            webhookDeleted = true;
            break;
          } catch (error) {
            console.log(`⚠️ Attempt ${attempt} failed:`, error.message);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!webhookDeleted) {
          console.log('⚠️ Warning: Could not delete webhook, but will try polling anyway');
        }
        
        // 3. انتظار طويل للتأكد من تنظيف الجلسة السابقة
        // زيادة الوقت إلى 10 ثوانٍ لضمان إغلاق الاتصال السابق
        console.log('⏳ Waiting for Telegram to fully cleanup previous session (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // بدء polling باستخدام الدالة الآمنة
        console.log('🚀 Starting bot polling...');
        const { safeStartPolling } = require('./bot');
        const pollingStarted = safeStartPolling();
        if (pollingStarted) {
          console.log('✅ Polling initiated');
        } else {
          console.log('⚠️ Polling could not start (may already be active)');
        }
        
        // بدء Queue processors
        console.log('✅ Queue processors started (Withdrawals: 5 workers, Payments: 3 workers)');
        startWithdrawalProcessor();
        startPaymentProcessor();
        
        // بدء الخدمات الأخرى
        console.log('✅ Notification system initialized');
        
        // ملاحظة: تم نقل Monitors و Schedulers إلى services/scheduler.js لتجنب التكرار
        // initAnalystMonitor, initTradeSignalsMonitor, rankingScheduler يتم تشغيلهم من scheduler فقط
        console.log('ℹ️ Monitors and schedulers managed by scheduler service');
        
        startWithdrawalScheduler();
        
        console.log('✅ Bot started successfully');
        console.log('✅ OBENTCHI Bot is now running!');
        console.log('📊 Bot ready to analyze crypto markets');
        
        // بدء AI Monitor
        aiMonitor.start();
        
        // بدء Memory Optimizer
        memoryOptimizer.start();
        
      } catch (error) {
        console.error('❌ Error during async initialization:', error);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start app:', error);
    process.exit(1);
  }
};

// Graceful shutdown
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('\n⚠️ Shutdown signal received...');
  
  try {
    const { safeStopPolling } = require('./bot');
    await safeStopPolling();
    console.log('✅ Bot stopped');
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
  console.error(`💥 Uncaught Exception: ${error.message}`);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`💥 Unhandled Rejection at: ${promise}`);
  console.error(`Reason: ${reason}`);
});

// بدء التطبيق
if (require.main === module) {
  startApp();
}

module.exports = { app };
