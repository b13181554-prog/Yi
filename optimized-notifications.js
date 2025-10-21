/**
 * نظام إشعارات محسّن مع Batch Processing
 * يحل مشكلة المسح المتتابع O(n*m)
 */

const pino = require('pino');
const db = require('./database');
const bot = require('./bot');
const config = require('./config');
const { rateLimiter } = require('./redis-rate-limiter');

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

class OptimizedNotificationService {
  constructor() {
    this.BATCH_SIZE = 10; // معالجة 10 مستخدمين في المرة
    this.BATCH_DELAY = 2000; // 2 ثانية بين الدفعات
    this.MAX_CONCURRENT_ANALYSIS = 3; // 3 تحليلات متزامنة فقط
    this.isProcessing = false;
    this.cache = new Map(); // تخزين مؤقت للبيانات
    this.CACHE_TTL = 5 * 60 * 1000; // 5 دقائق
  }

  /**
   * الحصول على بيانات السوق مع تخزين مؤقت
   */
  async getCachedMarketData(symbol, marketType) {
    const cacheKey = `market:${marketType}:${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    // جلب البيانات
    let data;
    if (marketType === 'crypto') {
      const marketData = require('./market-data');
      data = await marketData.getCryptoPrice(symbol);
    } else {
      const forexService = require('./forex-service');
      data = await forexService.getForexPrice(symbol);
    }
    
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }

  /**
   * معالجة دفعة من المستخدمين
   */
  async processBatch(users, batchIndex, totalBatches) {
    logger.info(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${users.length} users)`);
    
    const results = [];
    
    // معالجة متوازية محدودة
    for (let i = 0; i < users.length; i += this.MAX_CONCURRENT_ANALYSIS) {
      const chunk = users.slice(i, i + this.MAX_CONCURRENT_ANALYSIS);
      
      const chunkResults = await Promise.allSettled(
        chunk.map(user => this.processUserNotifications(user))
      );
      
      results.push(...chunkResults);
      
      // تأخير صغير بين chunks
      if (i + this.MAX_CONCURRENT_ANALYSIS < users.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info(`✅ Batch ${batchIndex + 1} completed: ${successful} success, ${failed} failed`);
    
    return results;
  }

  /**
   * معالجة إشعارات مستخدم واحد
   */
  async processUserNotifications(user) {
    try {
      // التحقق من Rate Limit للمستخدم
      const rateLimitKey = `notifications:${user.user_id}`;
      const rateCheck = await rateLimiter.checkLimit(rateLimitKey, 5, 15 * 60 * 1000);
      
      if (!rateCheck.allowed) {
        logger.debug(`⏭️ User ${user.user_id} rate limited, skipping`);
        return { skipped: true, reason: 'rate_limit' };
      }
      
      // منطق الإشعارات هنا
      // ...
      
      return { success: true, user_id: user.user_id };
    } catch (error) {
      logger.error(`❌ Error processing notifications for user ${user.user_id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * مسح الفرص السوقية مع Batch Processing
   */
  async scanAndNotifyMarketOpportunities() {
    if (this.isProcessing) {
      logger.warn('⚠️ Previous scan still running, skipping this cycle');
      return;
    }
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      logger.info('🔍 Starting optimized market opportunities scan...');
      
      // الحصول على المستخدمين النشطين فقط مع subscription
      const users = await db.getDatabase().collection('users').find({
        is_active: true,
        subscription_expires: { $gt: new Date() },
        notifications_enabled: { $ne: false }
      }).project({
        user_id: 1,
        language: 1,
        notification_preferences: 1
      }).toArray();
      
      logger.info(`👥 Found ${users.length} eligible users`);
      
      if (users.length === 0) {
        logger.info('ℹ️ No users to process');
        return;
      }
      
      // تقسيم لدفعات
      const batches = [];
      for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
        batches.push(users.slice(i, i + this.BATCH_SIZE));
      }
      
      logger.info(`📦 Processing ${batches.length} batches (${this.BATCH_SIZE} users each)`);
      
      // معالجة الدفعات مع تأخير بينها
      let totalProcessed = 0;
      let totalFailed = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const batchResults = await this.processBatch(batches[i], i, batches.length);
        
        const batchSuccess = batchResults.filter(r => r.status === 'fulfilled').length;
        const batchFailed = batchResults.filter(r => r.status === 'rejected').length;
        
        totalProcessed += batchSuccess;
        totalFailed += batchFailed;
        
        // تأخير بين الدفعات
        if (i < batches.length - 1) {
          logger.debug(`⏸️ Waiting ${this.BATCH_DELAY}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`✅ Market scan completed in ${duration}s`);
      logger.info(`📊 Results: ${totalProcessed} processed, ${totalFailed} failed`);
      
      // تنظيف التخزين المؤقت القديم
      this.cleanupCache();
      
    } catch (error) {
      logger.error(`❌ Error in market scan: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * تنظيف التخزين المؤقت القديم
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * الحصول على إحصائيات
   */
  getStats() {
    return {
      isProcessing: this.isProcessing,
      cacheSize: this.cache.size,
      batchSize: this.BATCH_SIZE,
      maxConcurrent: this.MAX_CONCURRENT_ANALYSIS
    };
  }
}

const optimizedNotificationService = new OptimizedNotificationService();

module.exports = {
  optimizedNotificationService,
  scanAndNotifyMarketOpportunities: () => optimizedNotificationService.scanAndNotifyMarketOpportunities()
};
