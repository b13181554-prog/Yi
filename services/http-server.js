#!/usr/bin/env node

/**
 * HTTP Server Process
 * يدير فقط Express API endpoints
 * منفصل عن Bot والـ Workers
 */

const express = require('express');
const path = require('path');
const pino = require('pino');
const config = require('../config');
const db = require('../database');
const { rateLimitMiddleware } = require('../advanced-rate-limiter');
const accessControl = require('../user-access-control');
const { authenticateAPI, validateRequestSize } = require('../api-security');
const { createMetricsEndpoint, httpMetricsMiddleware } = require('../metrics-exporter');

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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(validateRequestSize);
app.use(httpMetricsMiddleware);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check (بدون rate limiting)
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = !!db.getDB();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      service: 'http-server'
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

// Telegram Webhook endpoint (يجب أن يكون على port 5000 حتى يكون متاح للعامة)
const crypto = require('crypto');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');

app.post('/webhook', async (req, res) => {
  try {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (process.env.WEBHOOK_SECRET && secretToken !== WEBHOOK_SECRET) {
      logger.warn('⚠️ Unauthorized webhook request - invalid secret token');
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const update = req.body;
    
    if (!update || !update.update_id) {
      return res.status(400).json({ error: 'Invalid update' });
    }
    
    res.status(200).json({ ok: true });
    
    setImmediate(async () => {
      try {
        const bot = require('../bot');
        await bot.processUpdate(update);
      } catch (error) {
        logger.error(`Error processing update ${update.update_id}:`, error);
      }
    });
    
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Advanced Tiered Rate Limiters - per resource type
const analysisRateLimit = rateLimitMiddleware.analysis();
const marketDataRateLimit = rateLimitMiddleware.marketData();
const searchRateLimit = rateLimitMiddleware.search();
const aiRateLimit = rateLimitMiddleware.ai();
const scannerRateLimit = rateLimitMiddleware.scanner();

// تحميل API routes
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
  
  // User data
  app.post('/api/user', authenticateAPI, marketDataRateLimit, async (req, res) => {
    try {
      const { user_id } = req.body;
      const user = await db.getUser(user_id);
      
      if (!user) {
        return res.json({ success: false, error: 'User not found' });
      }
      
      const bot = require('../bot');
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

  // Analysis endpoint - tier-based rate limit
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

  // Withdrawal endpoints - tier-based analysis rate limit
  app.post('/api/withdraw', authenticateAPI, analysisRateLimit, async (req, res) => {
    try {
      const { user_id, amount, wallet_address } = req.body;
      
      if (!user_id || !amount || !wallet_address) {
        return res.json({ success: false, error: 'Missing required fields' });
      }
      
      // سيتم نقل منطق السحب هنا
      res.json({ success: false, error: 'Not implemented in HTTP server' });
    } catch (error) {
      logger.error(`Error processing withdrawal: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  logger.info('✅ API routes loaded');
};

// Startup
const startServer = async () => {
  try {
    // Initialize database FIRST - critical!
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    logger.info('✅ Database initialized successfully');
    
    // Initialize Feature Flags Service
    const featureFlagService = require('../services/feature-flags');
    await featureFlagService.initialize(db.getDB());
    
    // Setup routes
    await setupAPIRoutes();
    
    // Setup Telegram Webhook
    const bot = require('../bot');
    const webhookUrl = `${process.env.PUBLIC_URL}/webhook`;
    if (webhookUrl && !webhookUrl.includes('undefined')) {
      try {
        await bot.deleteWebHook();
        logger.info('🗑️ Deleted old webhook');
        
        const webhookOptions = {
          drop_pending_updates: false,
          max_connections: 100,
          allowed_updates: ['message', 'callback_query', 'inline_query']
        };
        
        if (process.env.WEBHOOK_SECRET) {
          webhookOptions.secret_token = WEBHOOK_SECRET;
        }
        
        await bot.setWebHook(webhookUrl, webhookOptions);
        logger.info(`✅ Webhook set: ${webhookUrl}`);
        logger.info(`🔒 Webhook secret: ${process.env.WEBHOOK_SECRET ? 'ENABLED' : 'DISABLED'}`);
      } catch (error) {
        logger.error(`⚠️ Failed to setup webhook: ${error.message}`);
      }
    }
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🌐 HTTP Server running on port ${PORT}`);
      logger.info(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
      logger.info(`📡 Webhook endpoint: ${webhookUrl}`);
      logger.info(`🔒 Rate limiting: Advanced Tiered System (Free/Basic/VIP/Analyst/Admin)`);
      logger.info(`🎯 Access Control: /api/access/* endpoints available`);
    });
  } catch (error) {
    logger.error(`❌ Failed to start HTTP server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('⚠️ SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('⚠️ SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app };
