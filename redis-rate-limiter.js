const Redis = require('ioredis');
const pino = require('pino');

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

class RedisRateLimiter {
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
      logger.error(`❌ Redis Error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      logger.info('✅ Redis connected for rate limiting');
    });

    // Fallback to in-memory if Redis fails
    this.memoryFallback = new Map();
    this.redisAvailable = true;
  }

  /**
   * تحقق من حد الطلبات باستخدام Sliding Window
   * @param {string} key - المفتاح (user_id, ip, etc.)
   * @param {number} limit - عدد الطلبات المسموح
   * @param {number} windowMs - نافذة الوقت بالملي ثانية
   * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
   */
  async checkLimit(key, limit, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    try {
      if (this.redisAvailable) {
        // استخدام Redis Sliding Window
        const multi = this.redis.multi();
        
        // إزالة الطلبات القديمة
        multi.zremrangebyscore(redisKey, 0, windowStart);
        
        // عد الطلبات الحالية
        multi.zcard(redisKey);
        
        // إضافة الطلب الحالي
        multi.zadd(redisKey, now, `${now}-${Math.random()}`);
        
        // تعيين انتهاء صلاحية المفتاح
        multi.expire(redisKey, Math.ceil(windowMs / 1000) + 10);
        
        const results = await multi.exec();
        
        if (!results || results.some(r => r[0])) {
          throw new Error('Redis multi command failed');
        }
        
        const count = results[1][1]; // النتيجة من zcard
        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);
        const resetTime = now + windowMs;
        
        if (!allowed) {
          logger.warn(`⚠️ Rate limit exceeded for ${key}: ${count}/${limit}`);
        }
        
        return { allowed, remaining, resetTime, count };
      }
    } catch (error) {
      logger.error(`❌ Redis rate limit error: ${error.message}`);
      this.redisAvailable = false;
      
      // Fallback to memory
      return this.checkLimitMemory(key, limit, windowMs, now);
    }
    
    // Fallback to memory if Redis is not available
    return this.checkLimitMemory(key, limit, windowMs, now);
  }

  /**
   * Fallback للذاكرة إذا فشل Redis
   */
  checkLimitMemory(key, limit, windowMs, now) {
    const windowStart = now - windowMs;
    
    if (!this.memoryFallback.has(key)) {
      this.memoryFallback.set(key, []);
    }
    
    let requests = this.memoryFallback.get(key);
    
    // إزالة الطلبات القديمة
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // إضافة الطلب الحالي
    requests.push(now);
    
    this.memoryFallback.set(key, requests);
    
    const count = requests.length;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetTime = now + windowMs;
    
    // تنظيف الذاكرة دورياً
    if (Math.random() < 0.01) {
      this.cleanupMemory(now - windowMs * 2);
    }
    
    return { allowed, remaining, resetTime, count };
  }

  /**
   * تنظيف الذاكرة من البيانات القديمة
   */
  cleanupMemory(cutoffTime) {
    for (const [key, requests] of this.memoryFallback.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoffTime);
      if (validRequests.length === 0) {
        this.memoryFallback.delete(key);
      } else {
        this.memoryFallback.set(key, validRequests);
      }
    }
  }

  /**
   * إعادة تعيين حد الطلبات لمفتاح معين
   */
  async reset(key) {
    const redisKey = `ratelimit:${key}`;
    
    try {
      if (this.redisAvailable) {
        await this.redis.del(redisKey);
      }
    } catch (error) {
      logger.error(`❌ Redis reset error: ${error.message}`);
    }
    
    this.memoryFallback.delete(key);
    logger.info(`🔄 Rate limit reset for ${key}`);
  }

  /**
   * الحصول على إحصائيات الطلبات
   */
  async getStats(key) {
    const redisKey = `ratelimit:${key}`;
    
    try {
      if (this.redisAvailable) {
        const count = await this.redis.zcard(redisKey);
        const ttl = await this.redis.ttl(redisKey);
        return { count, ttl };
      }
    } catch (error) {
      logger.error(`❌ Redis stats error: ${error.message}`);
    }
    
    const requests = this.memoryFallback.get(key) || [];
    return { count: requests.length, ttl: -1 };
  }

  /**
   * إغلاق الاتصال
   */
  async close() {
    await this.redis.quit();
    this.memoryFallback.clear();
    logger.info('🔴 Redis rate limiter closed');
  }
}

// إنشاء instance واحد للاستخدام في كل المشروع
const rateLimiter = new RedisRateLimiter();

/**
 * Middleware للتحقق من حد الطلبات
 */
function createRateLimitMiddleware(options = {}) {
  const {
    keyGenerator = (req) => req.body?.user_id || req.query?.user_id || req.ip || 'anonymous',
    limit = 60,
    windowMs = 60000, // دقيقة واحدة
    message = 'Too many requests. Please try again later.',
    statusCode = 429,
    skipSuccessfulRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
      const result = await rateLimiter.checkLimit(key, limit, windowMs);
      
      // إضافة headers للاستجابة
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (!result.allowed) {
        return res.status(statusCode).json({
          success: false,
          error: message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      next();
    } catch (error) {
      logger.error(`Rate limit middleware error: ${error.message}`);
      // في حالة الخطأ، نسمح بالطلب للمحافظة على توفر الخدمة
      next();
    }
  };
}

module.exports = {
  rateLimiter,
  createRateLimitMiddleware
};
