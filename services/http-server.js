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
const { createRateLimitMiddleware } = require('../redis-rate-limiter');
const { authenticateAPI, validateRequestSize } = require('../api-security');

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

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check (بدون rate limiting)
app.get('/api/health', async (req, res) => {
  try {
    const dbHealthy = !!db.getDatabase();
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

// Rate limiters بمستويات مختلفة
const strictRateLimit = createRateLimitMiddleware({
  limit: 10,
  windowMs: 60000, // 10 requests per minute
  message: 'Too many requests from this user. Please try again in a minute.'
});

const moderateRateLimit = createRateLimitMiddleware({
  limit: 30,
  windowMs: 60000, // 30 requests per minute
  message: 'Too many requests. Please slow down.'
});

const lenientRateLimit = createRateLimitMiddleware({
  limit: 60,
  windowMs: 60000 // 60 requests per minute
});

// تحميل API routes
const setupAPIRoutes = async () => {
  const marketData = require('../market-data');
  const forexService = require('../forex-service');
  const TechnicalAnalysis = require('../analysis');
  const { getTelegramProfilePhoto } = require('../telegram-helpers');
  const { addPaymentCallback } = require('../payment-callback-queue');
  const monitoringService = require('../monitoring-service');
  
  // User data
  app.post('/api/user', authenticateAPI, moderateRateLimit, async (req, res) => {
    try {
      const { user_id } = req.body;
      const user = await db.getUser(user_id);
      
      if (!user) {
        return res.json({ success: false, error: 'User not found' });
      }
      
      res.json({ success: true, user });
    } catch (error) {
      logger.error(`Error fetching user: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Market data endpoints
  app.post('/api/price', authenticateAPI, lenientRateLimit, async (req, res) => {
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

  // Analysis endpoint - strict rate limit
  app.post('/api/analyze', authenticateAPI, strictRateLimit, async (req, res) => {
    try {
      const { symbol, marketType, user_id } = req.body;
      
      if (!symbol || !marketType) {
        return res.json({ success: false, error: 'Symbol and marketType are required' });
      }
      
      const hasSubscription = await db.hasActiveSubscription(user_id);
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

  // Withdrawal endpoints - very strict rate limit
  app.post('/api/withdraw', authenticateAPI, strictRateLimit, async (req, res) => {
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
    // Initialize database
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    
    // Setup routes
    await setupAPIRoutes();
    
    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🌐 HTTP Server running on port ${PORT}`);
      logger.info(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
      logger.info(`🔒 Rate limiting: Redis-based sliding window`);
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
