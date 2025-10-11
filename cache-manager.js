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

class CacheManager {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      keyPrefix: 'cache:',
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      }
    });

    this.redis.on('connect', () => {
      logger.info('✅ Cache Redis connected');
    });

    this.redis.on('error', (err) => {
      logger.error(`❌ Cache Redis error: ${err.message}`);
    });

    this.localCache = new Map();
    this.maxLocalCacheSize = 1000;
  }

  async get(key) {
    try {
      if (this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (cached.expiry > Date.now()) {
          logger.debug(`📦 Local cache hit: ${key}`);
          return cached.value;
        }
        this.localCache.delete(key);
      }

      const value = await this.redis.get(key);
      if (value) {
        logger.debug(`📦 Redis cache hit: ${key}`);
        return JSON.parse(value);
      }
      
      return null;
    } catch (error) {
      logger.error(`❌ Cache get error for ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      
      if (this.localCache.size >= this.maxLocalCacheSize) {
        const firstKey = this.localCache.keys().next().value;
        this.localCache.delete(firstKey);
      }
      
      this.localCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
      });
      
      logger.debug(`💾 Cached: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`❌ Cache set error for ${key}: ${error.message}`);
      return false;
    }
  }

  async del(key) {
    try {
      this.localCache.delete(key);
      await this.redis.del(key);
      logger.debug(`🗑️ Deleted cache: ${key}`);
      return true;
    } catch (error) {
      logger.error(`❌ Cache delete error for ${key}: ${error.message}`);
      return false;
    }
  }

  async exists(key) {
    try {
      if (this.localCache.has(key)) {
        const cached = this.localCache.get(key);
        if (cached.expiry > Date.now()) {
          return true;
        }
        this.localCache.delete(key);
      }
      
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`❌ Cache exists error for ${key}: ${error.message}`);
      return false;
    }
  }

  async clearPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`🗑️ Cleared ${keys.length} keys matching ${pattern}`);
      }
      return keys.length;
    } catch (error) {
      logger.error(`❌ Cache clear pattern error: ${error.message}`);
      return 0;
    }
  }

  async getStats() {
    try {
      const info = await this.redis.info('stats');
      const lines = info.split('\r\n');
      const stats = {};
      
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });
      
      return {
        localCacheSize: this.localCache.size,
        redisStats: stats
      };
    } catch (error) {
      logger.error(`❌ Failed to get cache stats: ${error.message}`);
      return null;
    }
  }

  clearLocalCache() {
    this.localCache.clear();
    logger.info('🗑️ Local cache cleared');
  }
}

module.exports = new CacheManager();
