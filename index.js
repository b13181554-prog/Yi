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
        
        // Initialize Feature Flags Service
        const featureFlagService = require('./services/feature-flags');
        await featureFlagService.initialize(db.getDB());
        
        // Setup API routes
        await setupAPIRoutes();
        
        // بدء البوت في polling mode
        console.log('📡 Starting bot polling...');
        
        // تنظيف شامل لجميع الـ instances القديمة
        try {
          console.log('🧹 Performing complete cleanup...');
          
          // 1. Log out من جميع instances القديمة (يفصل جميع الـ sessions)
          try {
            await bot.logOut();
            console.log('🔓 Logged out from all old sessions');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            // خطأ طبيعي إذا لم يكن هناك session نشط
            console.log('ℹ️  No active session to log out:', error.message);
          }
          
          // 2. حذف webhook مع drop_pending_updates
          await bot.deleteWebHook({ drop_pending_updates: true });
          console.log('🗑️ Deleted webhook and pending updates');
          
          // 3. التأكد من عدم وجود تحديثات معلقة
          await bot.getUpdates({ offset: -1 });
          console.log('✅ Cleared remaining updates');
          
          // 4. انتظار 3 ثواني للتأكد من تنفيذ كل شيء
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.log('ℹ️  Cleanup error:', error.message);
        }
        
        // بدء polling بشكل نظيف
        try {
          console.log('🚀 Starting polling...');
          await bot.startPolling({
            restart: false,  // لا نحتاج restart لأننا نظفنا كل شيء
            polling: {
              interval: 1000,
              params: {
                timeout: 10
              }
            }
          });
          console.log('✅ Bot polling started successfully');
        } catch (error) {
          console.error('❌ Failed to start polling:', error.message);
          throw error;
        }
        
        // بدء Queue processors
        console.log('✅ Queue processors started (Withdrawals: 5 workers, Payments: 3 workers)');
        startWithdrawalProcessor();
        startPaymentProcessor();
        
        // بدء الخدمات الأخرى
        console.log('✅ Notification system initialized');
        initAnalystMonitor();
        console.log('✅ Analyst monitoring system initialized');
        
        initTradeSignalsMonitor();
        console.log('🔍 Trade Signals Monitor initialized');
        console.log('✅ البحث المباشر مُفعّل - الأصول تُجلب عند الطلب');
        console.log('✅ Trade Signals Monitor scheduled to run every 15 minutes');
        
        rankingScheduler.start();
        console.log('✅ Analyst ranking scheduler started (runs daily at midnight)');
        
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
    await bot.stopPolling();
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
