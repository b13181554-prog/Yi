/**
 * Advanced Tiered Rate Limiting System
 * نظام متقدم لتحديد معدل الطلبات حسب مستوى اشتراك المستخدم
 * 
 * Features:
 * - 5 Tier levels (Free, Basic, VIP, Analyst, Admin)
 * - Sliding Window Algorithm مع Redis
 * - Multi-Resource Limiting
 * - Burst Allowance
 * - Priority Queue
 * - Cost-based Limiting
 * - Monitoring & Analytics
 * - Dynamic Configuration
 */

const Redis = require('ioredis');
const { createLogger } = require('./centralized-logger');
const db = require('./database');
const config = require('./config');

const logger = createLogger('advanced-rate-limiter');

// ===== TIER DEFINITIONS =====

const TIER_CONFIGS = {
  free: {
    name: 'Free',
    limits: {
      analysis: { count: 10, window: 3600, cost: 1 },      // 10/hour
      market_data: { count: 50, window: 3600, cost: 1 },   // 50/hour
      search: { count: 5, window: 3600, cost: 1 },         // 5/hour
      ai: { count: 2, window: 3600, cost: 1 },             // 2/hour
      scanner: { count: 1, window: 86400, cost: 1 }        // 1/day
    },
    burst_allowance: 1.2,  // 20% burst
    priority: 1
  },
  
  basic: {
    name: 'Basic',
    limits: {
      analysis: { count: 50, window: 3600, cost: 1 },      // 50/hour
      market_data: { count: 200, window: 3600, cost: 1 },  // 200/hour
      search: { count: 20, window: 3600, cost: 1 },        // 20/hour
      ai: { count: 10, window: 3600, cost: 1 },            // 10/hour
      scanner: { count: 5, window: 86400, cost: 1 }        // 5/day
    },
    burst_allowance: 1.3,  // 30% burst
    priority: 2
  },
  
  vip: {
    name: 'VIP',
    limits: {
      analysis: { count: 200, window: 3600, cost: 1 },     // 200/hour
      market_data: { count: 1000, window: 3600, cost: 1 }, // 1000/hour
      search: { count: 100, window: 3600, cost: 1 },       // 100/hour
      ai: { count: 50, window: 3600, cost: 1 },            // 50/hour
      scanner: { count: 20, window: 86400, cost: 1 }       // 20/day
    },
    burst_allowance: 1.5,  // 50% burst
    priority: 3
  },
  
  analyst: {
    name: 'Analyst',
    limits: {
      analysis: { count: 500, window: 3600, cost: 1 },     // 500/hour
      market_data: { count: 2000, window: 3600, cost: 1 }, // 2000/hour
      search: { count: -1, window: 3600, cost: 1 },        // Unlimited
      ai: { count: 100, window: 3600, cost: 1 },           // 100/hour
      scanner: { count: -1, window: 86400, cost: 1 }       // Unlimited
    },
    burst_allowance: 2.0,  // 100% burst
    priority: 4
  },
  
  admin: {
    name: 'Admin',
    limits: {
      analysis: { count: -1, window: 3600, cost: 1 },      // Unlimited
      market_data: { count: -1, window: 3600, cost: 1 },   // Unlimited
      search: { count: -1, window: 3600, cost: 1 },        // Unlimited
      ai: { count: -1, window: 3600, cost: 1 },            // Unlimited
      scanner: { count: -1, window: 86400, cost: 1 }       // Unlimited
    },
    burst_allowance: 999,  // Effectively unlimited
    priority: 999
  }
};

// Resource cost modifiers (بعض العمليات أغلى من غيرها)
const RESOURCE_COSTS = {
  analysis_basic: 1,
  analysis_advanced: 2,
  analysis_ultra: 3,
  market_data_realtime: 1,
  market_data_historical: 2,
  search_basic: 1,
  search_advanced: 2,
  ai_simple: 1,
  ai_complex: 3,
  scanner_quick: 1,
  scanner_deep: 2
};

// ===== REDIS SETUP =====

class AdvancedRateLimiter {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('❌ Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 50, 2000);
      }
    });

    this.redis.on('error', (err) => {
      logger.error({ err }, '❌ Redis Error in Advanced Rate Limiter');
    });

    this.redis.on('connect', () => {
      logger.info('✅ Redis connected for Advanced Rate Limiter');
    });

    // Fallback to in-memory if Redis fails
    this.memoryFallback = new Map();
    this.redisAvailable = true;
    
    // Whitelist and Blacklist
    this.whitelist = new Set();
    this.blacklist = new Set();
    
    // Analytics storage
    this.analytics = {
      violations: [],
      usage: new Map(),
      tierDistribution: new Map()
    };
    
    // Dynamic config overrides
    this.configOverrides = new Map();
    
    logger.info('🚀 Advanced Tiered Rate Limiter initialized');
  }

  // ===== CORE FUNCTIONS =====

  /**
   * الحصول على tier المستخدم من قاعدة البيانات
   */
  async getUserTier(userId) {
    try {
      // Admin check
      if (userId === config.OWNER_ID) {
        return 'admin';
      }
      
      // Whitelist check
      if (this.whitelist.has(userId)) {
        return 'admin';
      }
      
      // Blacklist check (return most restrictive)
      if (this.blacklist.has(userId)) {
        return 'free';
      }
      
      const user = await db.getUser(userId);
      if (!user) {
        return 'free';
      }
      
      // Check if analyst
      const analyst = await db.getAnalyst(userId);
      if (analyst && analyst.is_active) {
        return 'analyst';
      }
      
      // Check subscription status
      const isVIP = await db.isVIPSearchActive(userId);
      if (isVIP) {
        return 'vip';
      }
      
      const hasSubscription = await db.isSubscriptionActive(userId);
      if (hasSubscription) {
        return 'basic';
      }
      
      return 'free';
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting user tier');
      return 'free'; // Default to most restrictive
    }
  }

  /**
   * الحصول على configuration الـ tier
   */
  getRateLimitConfig(tier) {
    // Check for dynamic overrides
    if (this.configOverrides.has(tier)) {
      return { ...TIER_CONFIGS[tier], ...this.configOverrides.get(tier) };
    }
    
    return TIER_CONFIGS[tier] || TIER_CONFIGS.free;
  }

  /**
   * فحص الحد - Sliding Window Algorithm
   */
  async checkRateLimit(userId, resource, options = {}) {
    try {
      const tier = options.tier || await this.getUserTier(userId);
      const tierConfig = this.getRateLimitConfig(tier);
      const resourceLimit = tierConfig.limits[resource];
      
      if (!resourceLimit) {
        logger.warn({ userId, resource, tier }, 'Unknown resource type');
        return {
          allowed: true,
          remaining: 999,
          limit: 999,
          tier,
          resource,
          warning: 'Unknown resource type'
        };
      }
      
      // Unlimited check
      if (resourceLimit.count === -1) {
        return {
          allowed: true,
          remaining: -1,
          limit: -1,
          tier,
          resource,
          unlimited: true
        };
      }
      
      const cost = options.cost || resourceLimit.cost || 1;
      const limit = Math.floor(resourceLimit.count * tierConfig.burst_allowance);
      const windowMs = resourceLimit.window * 1000;
      
      const now = Date.now();
      const windowStart = now - windowMs;
      const redisKey = `ratelimit:${tier}:${userId}:${resource}`;
      
      let count = 0;
      let resetTime = now + windowMs;
      
      if (this.redisAvailable) {
        try {
          // Sliding window implementation
          const multi = this.redis.multi();
          
          // Remove old entries
          multi.zremrangebyscore(redisKey, 0, windowStart);
          
          // Count current requests
          multi.zcard(redisKey);
          
          // Get TTL
          multi.ttl(redisKey);
          
          const results = await multi.exec();
          
          if (!results || results.some(r => r[0])) {
            throw new Error('Redis multi command failed');
          }
          
          count = results[1][1];
          const ttl = results[2][1];
          
          if (ttl > 0) {
            resetTime = now + (ttl * 1000);
          }
        } catch (error) {
          logger.error({ err: error }, 'Redis check error, using fallback');
          this.redisAvailable = false;
          return this.checkRateLimitMemory(userId, resource, tier, tierConfig, cost);
        }
      } else {
        return this.checkRateLimitMemory(userId, resource, tier, tierConfig, cost);
      }
      
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count - cost);
      const percentUsed = (count / limit) * 100;
      
      // Soft limit warning (80%)
      const softLimitWarning = percentUsed >= 80 && percentUsed < 100;
      
      const response = {
        allowed,
        remaining,
        limit,
        count,
        cost,
        tier,
        resource,
        resetTime,
        retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000),
        percentUsed: Math.round(percentUsed),
        softLimitWarning
      };
      
      if (softLimitWarning) {
        response.warning = `⚠️ اقتربت من الحد المسموح (${Math.round(percentUsed)}%)`;
      }
      
      if (!allowed) {
        response.message = this.generateLimitMessage(tier, resource, limit, resetTime, resourceLimit.window);
        response.upgrade_suggestion = this.getUpgradeSuggestion(tier, resource);
        
        // Track violation
        this.trackViolation(userId, tier, resource);
      }
      
      // Track usage
      this.trackUsage(userId, tier, resource, cost);
      
      return response;
    } catch (error) {
      logger.error({ err: error, userId, resource }, 'Error in checkRateLimit');
      // In case of error, allow the request (fail open)
      return {
        allowed: true,
        remaining: 0,
        limit: 0,
        error: true,
        message: 'Rate limit check failed, allowing request'
      };
    }
  }

  /**
   * استهلاك من الحد
   */
  async consumeRateLimit(userId, resource, options = {}) {
    try {
      const check = await this.checkRateLimit(userId, resource, options);
      
      if (!check.allowed) {
        return check;
      }
      
      const tier = check.tier;
      const cost = options.cost || check.cost || 1;
      const tierConfig = this.getRateLimitConfig(tier);
      const resourceLimit = tierConfig.limits[resource];
      
      // Skip if unlimited
      if (resourceLimit.count === -1) {
        return { ...check, consumed: true };
      }
      
      const now = Date.now();
      const windowMs = resourceLimit.window * 1000;
      const redisKey = `ratelimit:${tier}:${userId}:${resource}`;
      
      if (this.redisAvailable) {
        try {
          const multi = this.redis.multi();
          
          // Add request(s) based on cost
          for (let i = 0; i < cost; i++) {
            multi.zadd(redisKey, now + i, `${now}-${i}-${Math.random()}`);
          }
          
          // Set expiry
          multi.expire(redisKey, Math.ceil(windowMs / 1000) + 10);
          
          await multi.exec();
          
          logger.debug({ userId, resource, tier, cost }, 'Rate limit consumed');
        } catch (error) {
          logger.error({ err: error }, 'Redis consume error');
          this.redisAvailable = false;
          this.consumeRateLimitMemory(userId, resource, tier, cost);
        }
      } else {
        this.consumeRateLimitMemory(userId, resource, tier, cost);
      }
      
      return { ...check, consumed: true };
    } catch (error) {
      logger.error({ err: error, userId, resource }, 'Error in consumeRateLimit');
      return {
        allowed: true,
        consumed: false,
        error: true,
        message: 'Failed to consume rate limit'
      };
    }
  }

  /**
   * الحصول على حالة الحد الحالية
   */
  async getRateLimitStatus(userId, resource = null) {
    try {
      const tier = await this.getUserTier(userId);
      const tierConfig = this.getRateLimitConfig(tier);
      
      if (resource) {
        const status = await this.checkRateLimit(userId, resource, { tier });
        return {
          tier,
          resource,
          ...status
        };
      }
      
      // Get status for all resources
      const resources = Object.keys(tierConfig.limits);
      const statuses = await Promise.all(
        resources.map(async (res) => {
          const status = await this.checkRateLimit(userId, res, { tier });
          return { resource: res, ...status };
        })
      );
      
      return {
        tier,
        tierName: tierConfig.name,
        priority: tierConfig.priority,
        resources: statuses
      };
    } catch (error) {
      logger.error({ err: error, userId, resource }, 'Error getting rate limit status');
      return { error: true, message: 'Failed to get status' };
    }
  }

  /**
   * إعادة تعيين الحد (admin only)
   */
  async resetRateLimit(userId, resource = null, adminId = null) {
    try {
      // Verify admin
      if (adminId !== config.OWNER_ID && !this.whitelist.has(adminId)) {
        logger.warn({ adminId, userId }, 'Unauthorized reset attempt');
        return { success: false, message: 'Unauthorized' };
      }
      
      const tier = await this.getUserTier(userId);
      
      if (resource) {
        const redisKey = `ratelimit:${tier}:${userId}:${resource}`;
        
        if (this.redisAvailable) {
          await this.redis.del(redisKey);
        }
        
        this.memoryFallback.delete(`${tier}:${userId}:${resource}`);
        
        logger.info({ adminId, userId, resource }, 'Rate limit reset');
        
        return {
          success: true,
          message: `تم إعادة تعيين حد ${resource} للمستخدم ${userId}`
        };
      }
      
      // Reset all resources
      const tierConfig = this.getRateLimitConfig(tier);
      const resources = Object.keys(tierConfig.limits);
      
      for (const res of resources) {
        const redisKey = `ratelimit:${tier}:${userId}:${res}`;
        
        if (this.redisAvailable) {
          await this.redis.del(redisKey);
        }
        
        this.memoryFallback.delete(`${tier}:${userId}:${res}`);
      }
      
      logger.info({ adminId, userId }, 'All rate limits reset');
      
      return {
        success: true,
        message: `تم إعادة تعيين جميع الحدود للمستخدم ${userId}`
      };
    } catch (error) {
      logger.error({ err: error, userId, resource }, 'Error resetting rate limit');
      return { success: false, message: 'Failed to reset' };
    }
  }

  // ===== ADVANCED FEATURES =====

  /**
   * تعديل الـ limits ديناميكياً بدون restart
   */
  setDynamicLimit(tier, resource, newLimit) {
    if (!TIER_CONFIGS[tier]) {
      return { success: false, message: 'Invalid tier' };
    }
    
    if (!this.configOverrides.has(tier)) {
      this.configOverrides.set(tier, { limits: {} });
    }
    
    const override = this.configOverrides.get(tier);
    if (!override.limits) {
      override.limits = {};
    }
    
    override.limits[resource] = newLimit;
    this.configOverrides.set(tier, override);
    
    logger.info({ tier, resource, newLimit }, 'Dynamic limit updated');
    
    return {
      success: true,
      message: `تم تحديث حد ${resource} للـ ${tier} tier`
    };
  }

  /**
   * إضافة مستخدم إلى Whitelist
   */
  addToWhitelist(userId, adminId = null) {
    if (adminId !== config.OWNER_ID) {
      return { success: false, message: 'Unauthorized' };
    }
    
    this.whitelist.add(userId);
    logger.info({ userId, adminId }, 'User added to whitelist');
    
    return {
      success: true,
      message: `تم إضافة المستخدم ${userId} إلى القائمة البيضاء`
    };
  }

  /**
   * إزالة من Whitelist
   */
  removeFromWhitelist(userId, adminId = null) {
    if (adminId !== config.OWNER_ID) {
      return { success: false, message: 'Unauthorized' };
    }
    
    this.whitelist.delete(userId);
    logger.info({ userId, adminId }, 'User removed from whitelist');
    
    return {
      success: true,
      message: `تم إزالة المستخدم ${userId} من القائمة البيضاء`
    };
  }

  /**
   * إضافة مستخدم إلى Blacklist
   */
  addToBlacklist(userId, adminId = null, reason = '') {
    if (adminId !== config.OWNER_ID) {
      return { success: false, message: 'Unauthorized' };
    }
    
    this.blacklist.add(userId);
    logger.warn({ userId, adminId, reason }, 'User added to blacklist');
    
    return {
      success: true,
      message: `تم إضافة المستخدم ${userId} إلى القائمة السوداء`
    };
  }

  /**
   * إزالة من Blacklist
   */
  removeFromBlacklist(userId, adminId = null) {
    if (adminId !== config.OWNER_ID) {
      return { success: false, message: 'Unauthorized' };
    }
    
    this.blacklist.delete(userId);
    logger.info({ userId, adminId }, 'User removed from blacklist');
    
    return {
      success: true,
      message: `تم إزالة المستخدم ${userId} من القائمة السوداء`
    };
  }

  /**
   * IP-based rate limiting (fallback)
   */
  async checkIPRateLimit(ip, resource = 'general') {
    const limit = 100; // 100 requests per hour for unknown IPs
    const windowMs = 3600000; // 1 hour
    
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:ip:${ip}:${resource}`;
    
    try {
      if (this.redisAvailable) {
        const multi = this.redis.multi();
        
        multi.zremrangebyscore(redisKey, 0, windowStart);
        multi.zcard(redisKey);
        multi.zadd(redisKey, now, `${now}-${Math.random()}`);
        multi.expire(redisKey, Math.ceil(windowMs / 1000) + 10);
        
        const results = await multi.exec();
        const count = results[1][1];
        
        const allowed = count < limit;
        const remaining = Math.max(0, limit - count);
        
        return {
          allowed,
          remaining,
          limit,
          count,
          resetTime: now + windowMs,
          retryAfter: allowed ? 0 : Math.ceil(windowMs / 1000),
          isIPBased: true
        };
      }
    } catch (error) {
      logger.error({ err: error, ip }, 'IP rate limit check failed');
    }
    
    return {
      allowed: true,
      remaining: limit,
      limit,
      isIPBased: true,
      error: true
    };
  }

  // ===== MONITORING & ANALYTICS =====

  /**
   * تتبع انتهاكات الحدود
   */
  trackViolation(userId, tier, resource) {
    const violation = {
      userId,
      tier,
      resource,
      timestamp: new Date(),
      count: 1
    };
    
    this.analytics.violations.push(violation);
    
    // Keep only last 1000 violations
    if (this.analytics.violations.length > 1000) {
      this.analytics.violations.shift();
    }
    
    logger.warn({ userId, tier, resource }, '⚠️ Rate limit violation');
  }

  /**
   * تتبع الاستخدام
   */
  trackUsage(userId, tier, resource, cost) {
    const key = `${tier}:${resource}`;
    
    if (!this.analytics.usage.has(key)) {
      this.analytics.usage.set(key, {
        tier,
        resource,
        totalRequests: 0,
        totalCost: 0,
        uniqueUsers: new Set()
      });
    }
    
    const usage = this.analytics.usage.get(key);
    usage.totalRequests++;
    usage.totalCost += cost;
    usage.uniqueUsers.add(userId);
    
    // Track tier distribution
    if (!this.analytics.tierDistribution.has(tier)) {
      this.analytics.tierDistribution.set(tier, new Set());
    }
    this.analytics.tierDistribution.get(tier).add(userId);
  }

  /**
   * الحصول على المستخدمين الأكثر انتهاكاً
   */
  getMostLimitedUsers(limit = 10) {
    const userViolations = new Map();
    
    for (const violation of this.analytics.violations) {
      const count = userViolations.get(violation.userId) || 0;
      userViolations.set(violation.userId, count + 1);
    }
    
    const sorted = Array.from(userViolations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    return sorted.map(([userId, violations]) => ({
      userId,
      violations
    }));
  }

  /**
   * الحصول على أنماط استخدام الموارد
   */
  getResourceUsagePatterns() {
    const patterns = [];
    
    for (const [key, usage] of this.analytics.usage.entries()) {
      patterns.push({
        tier: usage.tier,
        resource: usage.resource,
        totalRequests: usage.totalRequests,
        totalCost: usage.totalCost,
        uniqueUsers: usage.uniqueUsers.size,
        avgCostPerUser: usage.totalCost / usage.uniqueUsers.size || 0
      });
    }
    
    return patterns.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * الحصول على توزيع الـ tiers
   */
  getTierDistribution() {
    const distribution = [];
    
    for (const [tier, users] of this.analytics.tierDistribution.entries()) {
      distribution.push({
        tier,
        tierName: TIER_CONFIGS[tier]?.name || tier,
        userCount: users.size,
        priority: TIER_CONFIGS[tier]?.priority || 0
      });
    }
    
    return distribution.sort((a, b) => b.priority - a.priority);
  }

  /**
   * تصدير التحليلات
   */
  exportAnalytics(format = 'json') {
    const analytics = {
      timestamp: new Date().toISOString(),
      summary: {
        totalViolations: this.analytics.violations.length,
        totalTiers: this.analytics.tierDistribution.size,
        totalResources: this.analytics.usage.size
      },
      mostLimitedUsers: this.getMostLimitedUsers(20),
      resourceUsage: this.getResourceUsagePatterns(),
      tierDistribution: this.getTierDistribution(),
      recentViolations: this.analytics.violations.slice(-100)
    };
    
    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    }
    
    if (format === 'csv') {
      let csv = 'Type,Data\n';
      csv += `Total Violations,${analytics.summary.totalViolations}\n`;
      csv += `Total Tiers,${analytics.summary.totalTiers}\n`;
      csv += `Total Resources,${analytics.summary.totalResources}\n\n`;
      
      csv += 'User ID,Violations\n';
      for (const user of analytics.mostLimitedUsers) {
        csv += `${user.userId},${user.violations}\n`;
      }
      
      return csv;
    }
    
    return analytics;
  }

  /**
   * الحصول على إحصائيات شاملة
   */
  async getSystemStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        redis: {
          available: this.redisAvailable,
          ping: false
        },
        analytics: {
          violations: this.analytics.violations.length,
          tiers: this.analytics.tierDistribution.size,
          resources: this.analytics.usage.size
        },
        whitelist: this.whitelist.size,
        blacklist: this.blacklist.size,
        configOverrides: this.configOverrides.size
      };
      
      // Test Redis connection
      if (this.redisAvailable) {
        try {
          await this.redis.ping();
          stats.redis.ping = true;
        } catch (error) {
          stats.redis.ping = false;
          stats.redis.error = error.message;
        }
      }
      
      return stats;
    } catch (error) {
      logger.error({ err: error }, 'Error getting system stats');
      return { error: true, message: error.message };
    }
  }

  // ===== HELPER FUNCTIONS =====

  /**
   * Memory fallback for rate limiting
   */
  checkRateLimitMemory(userId, resource, tier, tierConfig, cost) {
    const resourceLimit = tierConfig.limits[resource];
    const limit = Math.floor(resourceLimit.count * tierConfig.burst_allowance);
    const windowMs = resourceLimit.window * 1000;
    
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `${tier}:${userId}:${resource}`;
    
    if (!this.memoryFallback.has(key)) {
      this.memoryFallback.set(key, []);
    }
    
    let requests = this.memoryFallback.get(key);
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    const count = requests.length;
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count - cost);
    const resetTime = now + windowMs;
    
    return {
      allowed,
      remaining,
      limit,
      count,
      cost,
      tier,
      resource,
      resetTime,
      retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000),
      fallbackMode: true
    };
  }

  /**
   * Consume rate limit in memory
   */
  consumeRateLimitMemory(userId, resource, tier, cost) {
    const key = `${tier}:${userId}:${resource}`;
    
    if (!this.memoryFallback.has(key)) {
      this.memoryFallback.set(key, []);
    }
    
    const requests = this.memoryFallback.get(key);
    const now = Date.now();
    
    for (let i = 0; i < cost; i++) {
      requests.push(now + i);
    }
    
    this.memoryFallback.set(key, requests);
  }

  /**
   * توليد رسالة عند الوصول للحد
   */
  generateLimitMessage(tier, resource, limit, resetTime, windowSeconds) {
    const now = Date.now();
    const minutesLeft = Math.ceil((resetTime - now) / 60000);
    const hoursLeft = Math.ceil((resetTime - now) / 3600000);
    
    const resourceNameAr = {
      analysis: 'التحليل',
      market_data: 'بيانات السوق',
      search: 'البحث',
      ai: 'الذكاء الاصطناعي',
      scanner: 'الماسح الضوئي'
    };
    
    const timeUnit = windowSeconds >= 86400 ? 'يوم' : 'ساعة';
    const timeLeft = windowSeconds >= 86400 ? 'بعد يوم' : minutesLeft > 60 ? `بعد ${hoursLeft} ساعة` : `بعد ${minutesLeft} دقيقة`;
    
    return `⛔ تم تجاوز الحد المسموح لـ${resourceNameAr[resource] || resource}. لديك ${limit} طلب/${timeUnit}. حاول مرة أخرى ${timeLeft}`;
  }

  /**
   * الحصول على اقتراح الترقية
   */
  getUpgradeSuggestion(currentTier, resource) {
    const upgradePath = {
      free: { next: 'basic', resource_limits: TIER_CONFIGS.basic.limits },
      basic: { next: 'vip', resource_limits: TIER_CONFIGS.vip.limits },
      vip: { next: 'analyst', resource_limits: TIER_CONFIGS.analyst.limits },
      analyst: { next: null, resource_limits: null }
    };
    
    const upgrade = upgradePath[currentTier];
    if (!upgrade || !upgrade.next) {
      return null;
    }
    
    const nextLimit = upgrade.resource_limits[resource];
    if (!nextLimit) {
      return null;
    }
    
    const tierNameAr = {
      basic: 'Basic',
      vip: 'VIP',
      analyst: 'Analyst'
    };
    
    if (nextLimit.count === -1) {
      return `💎 ترقية للاشتراك ${tierNameAr[upgrade.next]} للحصول على طلبات غير محدودة!`;
    }
    
    const timeUnit = nextLimit.window >= 86400 ? 'يوم' : 'ساعة';
    return `💎 ترقية للاشتراك ${tierNameAr[upgrade.next]} للحصول على ${nextLimit.count} طلب/${timeUnit}`;
  }

  /**
   * إغلاق الاتصالات
   */
  async close() {
    try {
      await this.redis.quit();
      this.memoryFallback.clear();
      this.whitelist.clear();
      this.blacklist.clear();
      this.analytics.violations = [];
      this.analytics.usage.clear();
      this.analytics.tierDistribution.clear();
      logger.info('🔴 Advanced Rate Limiter closed');
    } catch (error) {
      logger.error({ err: error }, 'Error closing rate limiter');
    }
  }
}

// ===== EXPRESS MIDDLEWARE =====

/**
 * إنشاء middleware للـ Express
 */
function createAdvancedRateLimitMiddleware(resource, options = {}) {
  const limiter = options.limiter || advancedRateLimiter;
  const getUserId = options.getUserId || ((req) => req.body?.user_id || req.query?.user_id || req.user?.id);
  const getIP = options.getIP || ((req) => req.ip || req.connection.remoteAddress);
  const onLimitReached = options.onLimitReached || null;
  
  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      const ip = getIP(req);
      
      let result;
      
      if (userId) {
        // User-based rate limiting
        result = await limiter.consumeRateLimit(userId, resource, {
          cost: options.cost || 1
        });
      } else {
        // IP-based fallback
        result = await limiter.checkIPRateLimit(ip, resource);
      }
      
      // Set response headers
      if (result.limit !== undefined) {
        res.setHeader('X-RateLimit-Limit', result.limit === -1 ? 'unlimited' : result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining === -1 ? 'unlimited' : result.remaining);
      }
      
      if (result.resetTime) {
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      }
      
      if (result.tier) {
        res.setHeader('X-RateLimit-Tier', result.tier);
      }
      
      if (result.softLimitWarning) {
        res.setHeader('X-RateLimit-Warning', result.warning);
      }
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }
        
        if (onLimitReached) {
          onLimitReached(req, res, result);
        }
        
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: result.message,
          limit: result.limit,
          remaining: 0,
          retryAfter: result.retryAfter,
          tier: result.tier,
          resource: result.resource,
          upgrade_suggestion: result.upgrade_suggestion
        });
      }
      
      // Attach rate limit info to request
      req.rateLimit = result;
      
      next();
    } catch (error) {
      logger.error({ err: error }, 'Rate limit middleware error');
      // Fail open - allow request in case of error
      next();
    }
  };
}

/**
 * Helper middleware للموارد المختلفة
 */
const rateLimitMiddleware = {
  analysis: (cost = 1) => createAdvancedRateLimitMiddleware('analysis', { cost }),
  marketData: (cost = 1) => createAdvancedRateLimitMiddleware('market_data', { cost }),
  search: (cost = 1) => createAdvancedRateLimitMiddleware('search', { cost }),
  ai: (cost = 1) => createAdvancedRateLimitMiddleware('ai', { cost }),
  scanner: (cost = 1) => createAdvancedRateLimitMiddleware('scanner', { cost })
};

// ===== EXPORTS =====

const advancedRateLimiter = new AdvancedRateLimiter();

module.exports = {
  advancedRateLimiter,
  AdvancedRateLimiter,
  createAdvancedRateLimitMiddleware,
  rateLimitMiddleware,
  TIER_CONFIGS,
  RESOURCE_COSTS
};
