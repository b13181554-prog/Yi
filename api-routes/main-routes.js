/**
 * Main API Routes
 * الـ API endpoints الرئيسية للتطبيق
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const marketData = require('../market-data');
const { authenticateAPI } = require('../api-security');
const { rateLimitMiddleware } = require('../advanced-rate-limiter');
const { createLogger } = require('../centralized-logger');
const TechnicalAnalysis = require('../analysis');
const forexService = require('../forex-service');
const { addPaymentCallback } = require('../payment-callback-queue');

const logger = createLogger('main-routes');

const analysisRateLimit = rateLimitMiddleware.analysis();
const marketDataRateLimit = rateLimitMiddleware.marketData();
const searchRateLimit = rateLimitMiddleware.search();

// Search Assets endpoint
router.post('/search-assets', authenticateAPI, searchRateLimit, async (req, res) => {
  try {
    const { query, market_type } = req.body;
    
    if (!query) {
      return res.json({ success: false, error: 'Query is required' });
    }
    
    let results = [];
    
    if (market_type === 'crypto') {
      results = await marketData.searchCrypto(query);
    } else if (market_type === 'forex' || market_type === 'stocks') {
      results = await forexService.searchAssets(query, market_type);
    }
    
    res.json({ success: true, results });
  } catch (error) {
    logger.error(`Error searching assets: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full Analysis endpoint
router.post('/analyze-full', authenticateAPI, analysisRateLimit, async (req, res) => {
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
    const analysis = await analyzer.analyzeWithAI(symbol, marketType);
    
    res.json({ success: true, analysis });
  } catch (error) {
    logger.error(`Error analyzing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribe to Analyst endpoint
router.post('/subscribe-analyst', authenticateAPI, analysisRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id, amount } = req.body;
    
    if (!user_id || !analyst_id || !amount) {
      return res.json({ success: false, error: 'Missing required fields' });
    }
    
    const result = await db.subscribeToAnalyst(user_id, analyst_id, amount);
    
    res.json({ success: true, subscription: result });
  } catch (error) {
    logger.error(`Error subscribing to analyst: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rate Analyst endpoint
router.post('/rate-analyst', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id, rating } = req.body;
    
    if (!user_id || !analyst_id || rating === undefined) {
      return res.json({ success: false, error: 'Missing required fields' });
    }
    
    const analyst = await db.getAnalyst(analyst_id);
    if (!analyst) {
      return res.json({ success: false, error: 'Analyst not found' });
    }
    
    const updateField = rating ? 'likes' : 'dislikes';
    await db.updateAnalyst(analyst_id, {
      [updateField]: (analyst[updateField] || 0) + 1
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error rating analyst: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Analyst Profile endpoint
router.post('/my-analyst-profile', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const analyst = await db.getAnalystByUserId(user_id);
    
    if (!analyst) {
      return res.json({ success: false, error: 'No analyst profile found' });
    }
    
    res.json({ success: true, analyst });
  } catch (error) {
    logger.error(`Error getting analyst profile: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Analyst Referral Link endpoint
router.post('/get-analyst-referral-link', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id } = req.body;
    
    if (!user_id || !analyst_id) {
      return res.json({ success: false, error: 'Missing required fields' });
    }
    
    const bot = require('../bot');
    const botInfo = await bot.getMe();
    const link = `https://t.me/${botInfo.username}?start=ref_analyst_${analyst_id}_${user_id}`;
    
    res.json({ success: true, link });
  } catch (error) {
    logger.error(`Error getting referral link: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Analyst Promoter Link endpoint
router.post('/get-analyst-promoter-link', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id } = req.body;
    
    if (!user_id || !analyst_id) {
      return res.json({ success: false, error: 'Missing required fields' });
    }
    
    const bot = require('../bot');
    const botInfo = await bot.getMe();
    const link = `https://t.me/${botInfo.username}?start=promoter_${analyst_id}_${user_id}`;
    
    res.json({ success: true, link });
  } catch (error) {
    logger.error(`Error getting promoter link: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle Analyst Status endpoint
router.post('/toggle-analyst-status', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id, active } = req.body;
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst || analyst._id.toString() !== analyst_id) {
      return res.json({ success: false, error: 'Unauthorized' });
    }
    
    await db.updateAnalyst(analyst_id, { active });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error toggling analyst status: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Analyst endpoint
router.post('/delete-analyst', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id } = req.body;
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst || analyst._id.toString() !== analyst_id) {
      return res.json({ success: false, error: 'Unauthorized' });
    }
    
    await db.getDB().collection('analysts').deleteOne({ _id: analyst._id });
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting analyst: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create Room Post endpoint
router.post('/create-room-post', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, analyst_id, content } = req.body;
    
    const result = await db.createAnalystRoomPost(analyst_id, user_id, content);
    
    res.json({ success: true, post: result });
  } catch (error) {
    logger.error(`Error creating room post: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CryptAPI Create Payment endpoint
router.post('/cryptapi/create-payment', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, amount, purpose } = req.body;
    
    const cryptapi = require('../cryptapi');
    const payment = await cryptapi.createPayment(user_id, amount, purpose);
    
    res.json({ success: true, payment });
  } catch (error) {
    logger.error(`Error creating payment: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribe endpoint
router.post('/subscribe', authenticateAPI, analysisRateLimit, async (req, res) => {
  try {
    const { user_id, plan, amount } = req.body;
    
    const result = await db.processSubscriptionPayment(user_id, plan, amount);
    
    res.json({ success: true, subscription: result });
  } catch (error) {
    logger.error(`Error subscribing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Transactions endpoint
router.post('/transactions', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, page = 1, limit = 50 } = req.body;
    
    const transactions = await db.getUserTransactions(user_id, { page, limit, paginated: true });
    
    res.json({ success: true, transactions });
  } catch (error) {
    logger.error(`Error getting transactions: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Subscription endpoint
router.post('/subscription', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const isActive = await db.isSubscriptionActive(user_id);
    const subscription = await db.checkSubscription(user_id);
    
    res.json({ 
      success: true, 
      is_active: isActive,
      subscription 
    });
  } catch (error) {
    logger.error(`Error getting subscription: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Referral Stats endpoint
router.post('/referral-stats', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const stats = await db.getReferralStats(user_id);
    
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Error getting referral stats: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change Language endpoint
router.post('/change-language', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, language } = req.body;
    
    await db.setUserLanguage(user_id, language);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error changing language: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scan Best Signals endpoint
router.post('/scan-best-signals', authenticateAPI, searchRateLimit, async (req, res) => {
  try {
    const { market_type } = req.body;
    
    const signalScanner = require('../signal-scanner');
    const signals = await signalScanner.scanBestSignals(market_type || 'crypto');
    
    res.json({ success: true, signals });
  } catch (error) {
    logger.error(`Error scanning signals: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Analysts by Status endpoint
router.post('/analysts-by-status', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { status = 'active' } = req.body;
    
    const analysts = await db.getAllAnalysts({ status });
    
    res.json({ success: true, analysts });
  } catch (error) {
    logger.error(`Error getting analysts by status: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notification Settings endpoint
router.post('/notification-settings', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const settings = await db.getNotificationSettings(user_id);
    
    res.json({ success: true, settings });
  } catch (error) {
    logger.error(`Error getting notification settings: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle Notifications endpoint
router.post('/toggle-notifications', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, enabled } = req.body;
    
    await db.toggleNotifications(user_id, enabled);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error toggling notifications: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update Notification Markets endpoint
router.post('/update-notification-markets', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, markets } = req.body;
    
    await db.updateNotificationMarkets(user_id, markets);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error updating notification markets: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customer Support endpoint
router.post('/customer-support', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { user_id, message } = req.body;
    
    const bot = require('../bot');
    const config = require('../config');
    
    if (config.ADMIN_ID) {
      await bot.sendMessage(config.ADMIN_ID, 
        `📧 رسالة دعم جديدة\n\n` +
        `المستخدم: ${user_id}\n` +
        `الرسالة: ${message}`
      );
    }
    
    res.json({ success: true, message: 'تم إرسال رسالتك بنجاح' });
  } catch (error) {
    logger.error(`Error sending support message: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyst Performance endpoint
router.post('/analyst-performance', authenticateAPI, marketDataRateLimit, async (req, res) => {
  try {
    const { analyst_id } = req.body;
    
    const performance = await db.getAnalystPerformance(analyst_id);
    
    res.json({ success: true, performance });
  } catch (error) {
    logger.error(`Error getting analyst performance: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyst AI Insights endpoint
router.post('/analyst-ai-insights', authenticateAPI, analysisRateLimit, async (req, res) => {
  try {
    const { analyst_id } = req.body;
    
    const analystAIAdvisor = require('../analyst-ai-advisor');
    const insights = await analystAIAdvisor.getAnalystInsights(analyst_id);
    
    res.json({ success: true, insights });
  } catch (error) {
    logger.error(`Error getting AI insights: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
