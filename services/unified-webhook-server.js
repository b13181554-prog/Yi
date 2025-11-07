#!/usr/bin/env node

/**
 * Unified Webhook Server
 * خادم موحد يعمل بنظام webhook فقط (AWS)
 * يدمج جميع الخدمات: Bot Webhook + HTTP Server + Queue Worker + Scheduler
 */

const express = require('express');
const path = require('path');
const pino = require('pino');
const config = require('../config');
const db = require('../database');
const { bot, processUpdate, initializeBot, setupWebhook } = require('../bot-webhook');
const { rateLimitMiddleware } = require('../advanced-rate-limiter');
const accessControl = require('../user-access-control');
const { authenticateAPI, validateRequestSize } = require('../api-security');
const { createMetricsEndpoint, httpMetricsMiddleware, trackBotUpdate } = require('../metrics-exporter');
const { envDetector } = require('../environment-detector');
const { webhookHandler } = require('../webhook-handler');

// Queue Workers
const { withdrawalQueue, startWithdrawalProcessor } = require('../withdrawal-queue');
const { paymentCallbackQueue, startPaymentProcessor } = require('../payment-callback-queue');

// Schedulers
const { startWithdrawalScheduler, stopWithdrawalScheduler } = require('../withdrawal-scheduler');
const rankingScheduler = require('../ranking-scheduler');
const { initAnalystMonitor } = require('../analyst-monitor');
const { initTradeSignalsMonitor } = require('../trade-signals-monitor');
const featureFlagService = require('./feature-flags');
const automatedSafety = require('../automated-safety-system');

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

// زيادة حد المستمعين لتجنب التحذيرات
process.setMaxListeners(20);

const app = express();

// تحديد البورت حسب البيئة
// Replit: port 5000 (الوحيد المكشوف)
// AWS: port 8443 (standard webhook port) أو متغير PORT
const PORT = envDetector.isReplit 
  ? 5000 
  : (process.env.PORT || process.env.BOT_WEBHOOK_PORT || 8443);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateRequestSize);
app.use(httpMetricsMiddleware);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = !!db.getDB();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      service: 'unified-webhook-server',
      mode: 'webhook',
      instance: process.env.INSTANCE_ID || 'default',
      environment: config.ENVIRONMENT.platform
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// API Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = !!db.getDB();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      service: 'unified-webhook-server'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Prometheus metrics endpoint
createMetricsEndpoint(app);

// Telegram Webhook endpoint
webhookHandler.setProcessUpdateFunction(processUpdate);
webhookHandler.setTrackBotUpdateFunction(trackBotUpdate);
app.post('/webhook', webhookHandler.getExpressMiddleware());

// Rate Limiters
const analysisRateLimit = rateLimitMiddleware.analysis();
const marketDataRateLimit = rateLimitMiddleware.marketData();
const searchRateLimit = rateLimitMiddleware.search();
const aiRateLimit = rateLimitMiddleware.ai();
const scannerRateLimit = rateLimitMiddleware.scanner();

// Setup API routes
const setupAPIRoutes = async () => {
  const marketData = require('../market-data');
  const forexService = require('../forex-service');
  const TechnicalAnalysis = require('../analysis');
  const { getTelegramProfilePhoto } = require('../telegram-helpers');
  const { addPaymentCallback } = require('../payment-callback-queue');
  const monitoringService = require('../monitoring-service');
  
  // Access Control Routes
  const accessControlRoutes = require('../api-routes/access-control-routes');
  app.use('/api/access', accessControlRoutes);
  
  // Real-time Dashboard Routes
  const realtimeDashboardRoutes = require('../api-routes/realtime-dashboard-routes');
  app.use('/api/realtime', realtimeDashboardRoutes);
  
  // Feature Flags Routes
  const featureFlagRoutes = require('../api-routes/feature-flag-routes');
  app.use('/api/feature-flags', featureFlagRoutes);
  
  // Main Routes
  const mainRoutes = require('../api-routes/main-routes');
  app.use('/api', mainRoutes);
  
  // Admin Routes
  const adminRoutes = require('../api-routes/admin-routes');
  app.use('/api/admin', adminRoutes);
  
  // User data
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
      logger.error(`Error fetching user: ${error.message}`);
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
      logger.error(`Error fetching price: ${error.message}`);
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
      logger.error(`Error analyzing: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Withdrawal endpoint
  app.post('/api/withdraw', authenticateAPI, analysisRateLimit, async (req, res) => {
    try {
      const { user_id, amount, wallet_address } = req.body;
      
      if (!user_id || !amount || !wallet_address) {
        return res.json({ success: false, error: 'Missing required fields' });
      }
      
      res.json({ success: false, error: 'Not implemented in HTTP server' });
    } catch (error) {
      logger.error(`Error processing withdrawal: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Top Movers endpoint
  app.post('/api/top-movers', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const { type, market_type } = req.body;
      const marketDataService = require('../market-data');
      
      const movers = await marketDataService.getTopMovers(type || 'gainers', market_type || 'crypto');
      
      res.json({ success: true, movers });
    } catch (error) {
      logger.error(`Error fetching top movers: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Analysts endpoint
  app.post('/api/analysts', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const { user_id } = req.body;
      
      const analysts = await db.getAllAnalysts();
      const activeSubscriptions = await db.getAllUserAnalystSubscriptions(user_id);
      
      const analystsWithStatus = analysts.map(analyst => {
        const subscription = activeSubscriptions.find(sub => 
          sub.analyst_id.toString() === analyst._id.toString()
        );
        
        return {
          id: analyst._id,
          name: analyst.name,
          description: analyst.description,
          monthly_price: analyst.monthly_price,
          total_subscribers: analyst.total_subscribers || 0,
          likes: analyst.likes || 0,
          dislikes: analyst.dislikes || 0,
          profile_picture: analyst.profile_picture,
          is_subscribed: !!subscription,
          subscription_end_date: subscription?.end_date
        };
      });
      
      res.json({
        success: true,
        analysts: analystsWithStatus,
        active_subscriptions: activeSubscriptions
      });
    } catch (error) {
      logger.error(`Error fetching analysts: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Top Analysts endpoint
  app.post('/api/top-analysts', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const topAnalysts = await db.getTop100Analysts(10);
      
      res.json({ success: true, analysts: topAnalysts });
    } catch (error) {
      logger.error(`Error fetching top analysts: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  logger.info('✅ API routes loaded');
};

// Initialize Queue Workers
const initializeQueueWorkers = async () => {
  logger.info('⚙️ Initializing Queue Workers...');
  
  startWithdrawalProcessor(5);
  logger.info('  ✅ Withdrawal queue: 5 concurrent workers');
  
  startPaymentProcessor(3);
  logger.info('  ✅ Payment callback queue: 3 concurrent workers');
  
  logger.info('✅ Queue Workers initialized');
};

// Initialize Schedulers
const initializeSchedulers = async () => {
  logger.info('📅 Initializing Schedulers...');
  
  await featureFlagService.initialize(db.getDB());
  logger.info('  ✅ Feature flags initialized');
  
  automatedSafety.initialize();
  logger.info('  ✅ Automated safety system initialized');
  
  startWithdrawalScheduler();
  logger.info('  ✅ Withdrawal scheduler started');
  
  rankingScheduler.start();
  logger.info('  ✅ Ranking scheduler started');
  
  initAnalystMonitor();
  logger.info('  ✅ Analyst monitor started');
  
  initTradeSignalsMonitor();
  logger.info('  ✅ Trade signals monitor started');
  
  logger.info('✅ All schedulers initialized');
};

// Main startup function
const startUnifiedServer = async () => {
  try {
    logger.info('🚀 Starting Unified Webhook Server...');
    logger.info('==========================================');
    logger.info(`🌍 Environment: ${config.ENVIRONMENT.platform}`);
    logger.info(`🔧 Mode: WEBHOOK ONLY (AWS Deployment)`);
    logger.info('');
    
    // Initialize database
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    logger.info('✅ Database initialized');
    
    // Initialize bot
    logger.info('🤖 Initializing Telegram Bot...');
    await initializeBot();
    logger.info('✅ Bot initialized');
    
    // Setup webhook
    const webhookUrl = config.WEBHOOK_CONFIG.publicUrl 
      ? `${config.WEBHOOK_CONFIG.publicUrl}${config.WEBHOOK_CONFIG.webhookPath}`
      : process.env.WEBHOOK_URL || `${process.env.PUBLIC_URL}/webhook`;
    
    if (!webhookUrl || webhookUrl.includes('undefined')) {
      throw new Error('WEBHOOK_URL or PUBLIC_URL environment variable is required');
    }
    
    try {
      await setupWebhook(webhookUrl, webhookHandler.getWebhookSecret());
      logger.info(`✅ Webhook configured successfully`);
      webhookHandler.logWebhookInfo(config.ENVIRONMENT.platform, PORT, webhookUrl);
    } catch (error) {
      logger.error(`⚠️ Failed to setup webhook: ${error.message}`);
    }
    
    if (!process.env.WEBHOOK_SECRET) {
      logger.warn('⚠️ WARNING: WEBHOOK_SECRET not set! Using auto-generated secret.');
    }
    
    // Setup API routes
    logger.info('🔧 Setting up API routes...');
    await setupAPIRoutes();
    
    // Initialize Queue Workers
    await initializeQueueWorkers();
    
    // Initialize Schedulers
    await initializeSchedulers();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('');
      logger.info('✅ Unified Webhook Server is running!');
      logger.info('==========================================');
      logger.info(`🌐 Server listening on port ${PORT}`);
      logger.info(`📡 Webhook URL: ${webhookUrl}`);
      logger.info(`🔒 Webhook secret: ${process.env.WEBHOOK_SECRET ? 'ENABLED' : 'AUTO-GENERATED'}`);
      logger.info(`📊 Health endpoint: http://localhost:${PORT}/health`);
      logger.info(`📈 Metrics endpoint: http://localhost:${PORT}/metrics`);
      logger.info(`🔢 Instance ID: ${process.env.INSTANCE_ID || 'default'}`);
      logger.info('');
      logger.info('Services Status:');
      logger.info('  ✅ Telegram Webhook - Active');
      logger.info('  ✅ HTTP API - Active');
      logger.info('  ✅ Queue Workers - Running');
      logger.info('  ✅ Schedulers - Running');
      logger.info('');
      logger.info('👂 Ready to receive webhook updates...');
      logger.info('==========================================');
    });
    
  } catch (error) {
    logger.error(`❌ Failed to start Unified Webhook Server: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('');
  logger.info('⚠️ Shutdown signal received...');
  logger.info('==========================================');
  
  try {
    // Pause queues
    logger.info('⏸️ Pausing queues...');
    await withdrawalQueue.pause();
    await paymentCallbackQueue.pause();
    
    // Wait for active jobs
    logger.info('⏳ Waiting for active jobs to complete (max 30s)...');
    await Promise.race([
      Promise.all([
        withdrawalQueue.whenCurrentJobsFinished(),
        paymentCallbackQueue.whenCurrentJobsFinished()
      ]),
      new Promise(resolve => setTimeout(resolve, 30000))
    ]);
    
    // Close queues
    logger.info('🔴 Closing queues...');
    await withdrawalQueue.close();
    await paymentCallbackQueue.close();
    
    // Stop schedulers
    logger.info('⏹️ Stopping schedulers...');
    stopWithdrawalScheduler();
    rankingScheduler.stop();
    automatedSafety.stop();
    
    logger.info('');
    logger.info('✅ Unified Webhook Server shut down successfully');
    logger.info('==========================================');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

// Start the server
if (require.main === module) {
  startUnifiedServer();
}

module.exports = { startUnifiedServer };
