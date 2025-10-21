/**
 * Intelligent Multi-Layer Caching System
 * نظام تخزين مؤقت متعدد الطبقات ذكي
 * 
 * الهدف: تقليل استدعاءات API بنسبة 80%+ وتحسين سرعة الاستجابة 10x
 * 
 * Features:
 * - Memory Cache Layer (LRU) for hot data
 * - Redis Cache Layer for distributed caching
 * - Request Coalescing to prevent duplicate requests
 * - Smart TTL Strategy based on data type
 * - Cache Warming & Invalidation
 * - Comprehensive Metrics & Monitoring
 */

const { LRUCache } = require('lru-cache');
const Redis = require('ioredis');
const { createLogger, logError, logPerformance, createTimer } = require('./centralized-logger');

const logger = createLogger('IntelligentCache');

class IntelligentCache {
  constructor(options = {}) {
    this.namespace = options.namespace || 'app';
    this.version = options.version || 'v1';
    
    this.memoryCache = new LRUCache({
      max: options.memoryCacheSize || 500,
      ttl: options.memoryCacheTTL || 60000,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      allowStale: false
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      keyPrefix: `${this.namespace}:${this.version}:`,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: false
    });

    this.redisAvailable = true;
    this.pendingRequests = new Map();
    
    this.metrics = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
      errors: 0,
      coalescedRequests: 0,
      apiCallsSaved: 0,
      totalLatency: 0
    };

    this.ttlStrategies = {
      'market_prices': 30,
      'market_prices_fast': 10,
      'analysis_results': 300,
      'user_data': 60,
      'static_data': 3600,
      'trending_coins': 120,
      'candles': 60,
      'stats_24hr': 30,
      'top_movers': 120,
      'default': 300
    };

    this.setupRedisEventHandlers();
    
    logger.info('✅ Intelligent Cache initialized', {
      memoryCacheSize: options.memoryCacheSize || 500,
      namespace: this.namespace,
      version: this.version
    });
  }

  setupRedisEventHandlers() {
    this.redis.on('connect', () => {
      this.redisAvailable = true;
      logger.info('✅ Redis connected for caching');
    });

    this.redis.on('error', (err) => {
      this.redisAvailable = false;
      this.metrics.errors++;
      logError(logger, err, { context: 'Redis connection error' });
    });

    this.redis.on('ready', () => {
      this.redisAvailable = true;
      logger.info('✅ Redis ready for caching operations');
    });

    this.redis.on('close', () => {
      this.redisAvailable = false;
      logger.warn('⚠️ Redis connection closed');
    });
  }

  generateCacheKey(key, params = {}) {
    if (typeof key === 'string' && Object.keys(params).length === 0) {
      return key;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, k) => {
        acc[k] = params[k];
        return acc;
      }, {});

    const paramString = JSON.stringify(sortedParams);
    const baseKey = typeof key === 'object' ? JSON.stringify(key) : key;
    
    return `${baseKey}:${Buffer.from(paramString).toString('base64').slice(0, 32)}`;
  }

  getTTL(dataType) {
    return this.ttlStrategies[dataType] || this.ttlStrategies.default;
  }

  async cacheGet(key, options = {}) {
    const timer = createTimer();
    this.metrics.totalRequests++;
    
    try {
      const cacheKey = this.generateCacheKey(key, options.params || {});
      
      const memoryValue = this.memoryCache.get(cacheKey);
      if (memoryValue !== undefined) {
        this.metrics.memoryHits++;
        this.metrics.apiCallsSaved++;
        
        const elapsed = timer.elapsed();
        this.metrics.totalLatency += elapsed;
        
        logger.debug('📦 Memory cache hit', { 
          key: cacheKey, 
          elapsed: `${elapsed}ms` 
        });
        
        return memoryValue;
      }
      
      this.metrics.memoryMisses++;

      if (!this.redisAvailable) {
        logger.warn('⚠️ Redis unavailable, skipping Redis cache layer');
        return null;
      }

      const redisValue = await this.redis.get(cacheKey);
      if (redisValue) {
        this.metrics.redisHits++;
        this.metrics.apiCallsSaved++;
        
        const parsed = JSON.parse(redisValue);
        
        this.memoryCache.set(cacheKey, parsed);
        
        const elapsed = timer.elapsed();
        this.metrics.totalLatency += elapsed;
        
        logger.debug('📦 Redis cache hit', { 
          key: cacheKey, 
          elapsed: `${elapsed}ms` 
        });
        
        return parsed;
      }
      
      this.metrics.redisMisses++;
      
      const elapsed = timer.elapsed();
      this.metrics.totalLatency += elapsed;
      
      logger.debug('❌ Cache miss', { 
        key: cacheKey, 
        elapsed: `${elapsed}ms` 
      });
      
      return null;
    } catch (error) {
      this.metrics.errors++;
      logError(logger, error, { context: 'cacheGet', key });
      return null;
    }
  }

  async cacheSet(key, value, ttlOrType) {
    const timer = createTimer();
    
    try {
      const cacheKey = typeof key === 'object' 
        ? this.generateCacheKey(key.key, key.params || {})
        : key;
      
      const ttl = typeof ttlOrType === 'string' 
        ? this.getTTL(ttlOrType) 
        : (ttlOrType || this.ttlStrategies.default);

      this.memoryCache.set(cacheKey, value, { ttl: ttl * 1000 });

      if (this.redisAvailable) {
        await this.redis.setex(cacheKey, ttl, JSON.stringify(value));
      }
      
      const elapsed = timer.elapsed();
      
      logger.debug('💾 Cache set', { 
        key: cacheKey, 
        ttl: `${ttl}s`,
        elapsed: `${elapsed}ms` 
      });
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      logError(logger, error, { context: 'cacheSet', key });
      return false;
    }
  }

  async cacheWrap(key, fn, options = {}) {
    const timer = createTimer();
    
    try {
      const cacheKey = this.generateCacheKey(key, options.params || {});
      
      if (this.pendingRequests.has(cacheKey)) {
        this.metrics.coalescedRequests++;
        logger.debug('🔄 Request coalescing', { key: cacheKey });
        return await this.pendingRequests.get(cacheKey);
      }

      const cached = await this.cacheGet(key, options);
      if (cached !== null) {
        return cached;
      }

      const promise = (async () => {
        try {
          const result = await fn();
          
          const ttl = options.ttl || options.dataType || 'default';
          await this.cacheSet(
            typeof key === 'string' ? key : { key, params: options.params },
            result,
            ttl
          );
          
          return result;
        } finally {
          this.pendingRequests.delete(cacheKey);
        }
      })();

      this.pendingRequests.set(cacheKey, promise);
      
      const result = await promise;
      
      const elapsed = timer.elapsed();
      logPerformance(logger, `cacheWrap:${cacheKey}`, elapsed, options.slowThreshold || 1000);
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      logError(logger, error, { context: 'cacheWrap', key });
      throw error;
    }
  }

  async cacheInvalidate(pattern) {
    const timer = createTimer();
    
    try {
      let deletedCount = 0;

      if (pattern === '*' || pattern.includes('*')) {
        this.memoryCache.clear();
        deletedCount += this.memoryCache.size;
        logger.info('🗑️ Memory cache cleared');
      } else {
        const keys = Array.from(this.memoryCache.keys());
        const matchingKeys = keys.filter(k => k.includes(pattern));
        matchingKeys.forEach(k => this.memoryCache.delete(k));
        deletedCount += matchingKeys.length;
      }

      if (this.redisAvailable) {
        const fullPattern = `${this.namespace}:${this.version}:${pattern}`;
        
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          const unprefixedKeys = keys.map(k => 
            k.replace(`${this.namespace}:${this.version}:`, '')
          );
          
          await this.redis.del(...unprefixedKeys);
          deletedCount += keys.length;
        }
      }
      
      const elapsed = timer.elapsed();
      
      logger.info('🗑️ Cache invalidated', { 
        pattern, 
        deletedCount,
        elapsed: `${elapsed}ms` 
      });
      
      return deletedCount;
    } catch (error) {
      this.metrics.errors++;
      logError(logger, error, { context: 'cacheInvalidate', pattern });
      return 0;
    }
  }

  async cacheWarm(keysData) {
    const timer = createTimer();
    
    try {
      if (!Array.isArray(keysData)) {
        throw new Error('keysData must be an array of {key, fn, options}');
      }

      const results = await Promise.allSettled(
        keysData.map(async ({ key, fn, options = {} }) => {
          const cached = await this.cacheGet(key, options);
          if (cached !== null) {
            logger.debug('⏭️ Skipping warm (already cached)', { key });
            return { key, status: 'skipped' };
          }

          const value = await fn();
          const ttl = options.ttl || options.dataType || 'default';
          await this.cacheSet(
            typeof key === 'string' ? key : { key, params: options.params },
            value,
            ttl
          );
          
          return { key, status: 'warmed' };
        })
      );

      const warmed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'warmed').length;
      const skipped = results.filter(r => r.status === 'fulfilled' && r.value.status === 'skipped').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      const elapsed = timer.elapsed();
      
      logger.info('🔥 Cache warming completed', { 
        total: keysData.length,
        warmed,
        skipped,
        failed,
        elapsed: `${elapsed}ms` 
      });
      
      return { total: keysData.length, warmed, skipped, failed };
    } catch (error) {
      this.metrics.errors++;
      logError(logger, error, { context: 'cacheWarm' });
      return { total: 0, warmed: 0, skipped: 0, failed: 0 };
    }
  }

  async backgroundRefresh(key, fn, options = {}) {
    try {
      const cacheKey = this.generateCacheKey(key, options.params || {});
      
      const ttl = typeof options.ttl === 'string' 
        ? this.getTTL(options.ttl)
        : (options.ttl || this.getTTL('default'));
      
      const refreshBefore = ttl * 0.8;
      
      let currentTTL;
      if (this.redisAvailable) {
        currentTTL = await this.redis.ttl(cacheKey);
      }
      
      if (currentTTL && currentTTL > 0 && currentTTL < refreshBefore) {
        logger.debug('🔄 Background refresh triggered', { 
          key: cacheKey, 
          ttl: currentTTL 
        });
        
        setImmediate(async () => {
          try {
            const result = await fn();
            await this.cacheSet(
              typeof key === 'string' ? key : { key, params: options.params },
              result,
              options.ttl || options.dataType || 'default'
            );
            logger.debug('✅ Background refresh completed', { key: cacheKey });
          } catch (error) {
            logError(logger, error, { context: 'backgroundRefresh', key: cacheKey });
          }
        });
      }
    } catch (error) {
      logError(logger, error, { context: 'backgroundRefresh check' });
    }
  }

  getCacheStats() {
    const memoryHitRate = this.metrics.totalRequests > 0
      ? ((this.metrics.memoryHits / this.metrics.totalRequests) * 100).toFixed(2)
      : 0;
    
    const redisHitRate = this.metrics.memoryMisses > 0
      ? ((this.metrics.redisHits / this.metrics.memoryMisses) * 100).toFixed(2)
      : 0;
    
    const overallHitRate = this.metrics.totalRequests > 0
      ? (((this.metrics.memoryHits + this.metrics.redisHits) / this.metrics.totalRequests) * 100).toFixed(2)
      : 0;

    const avgLatency = this.metrics.totalRequests > 0
      ? (this.metrics.totalLatency / this.metrics.totalRequests).toFixed(2)
      : 0;

    const estimatedAPICost = this.metrics.apiCallsSaved * 0.001;
    const estimatedTimeSaved = (this.metrics.apiCallsSaved * 500).toFixed(0);

    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.memoryCache.max,
        hits: this.metrics.memoryHits,
        misses: this.metrics.memoryMisses,
        hitRate: `${memoryHitRate}%`
      },
      redis: {
        available: this.redisAvailable,
        hits: this.metrics.redisHits,
        misses: this.metrics.redisMisses,
        hitRate: `${redisHitRate}%`
      },
      overall: {
        totalRequests: this.metrics.totalRequests,
        hitRate: `${overallHitRate}%`,
        errors: this.metrics.errors,
        coalescedRequests: this.metrics.coalescedRequests,
        avgLatency: `${avgLatency}ms`
      },
      savings: {
        apiCallsSaved: this.metrics.apiCallsSaved,
        estimatedCostSaved: `$${estimatedAPICost.toFixed(2)}`,
        estimatedTimeSaved: `${estimatedTimeSaved}ms`
      },
      pendingRequests: this.pendingRequests.size
    };
  }

  async getDetailedStats() {
    const stats = this.getCacheStats();
    
    if (this.redisAvailable) {
      try {
        const info = await this.redis.info('stats');
        const memory = await this.redis.info('memory');
        
        stats.redis.serverInfo = {
          info: info.split('\r\n').slice(0, 10).join(', '),
          memory: memory.split('\r\n').slice(0, 5).join(', ')
        };
      } catch (error) {
        logError(logger, error, { context: 'getDetailedStats' });
      }
    }
    
    return stats;
  }

  resetMetrics() {
    this.metrics = {
      memoryHits: 0,
      memoryMisses: 0,
      redisHits: 0,
      redisMisses: 0,
      totalRequests: 0,
      errors: 0,
      coalescedRequests: 0,
      apiCallsSaved: 0,
      totalLatency: 0
    };
    
    logger.info('🔄 Cache metrics reset');
  }

  clearAll() {
    this.memoryCache.clear();
    this.pendingRequests.clear();
    
    if (this.redisAvailable) {
      this.redis.flushdb().catch(err => {
        logError(logger, err, { context: 'clearAll Redis' });
      });
    }
    
    logger.info('🗑️ All caches cleared');
  }

  async healthCheck() {
    const health = {
      memory: {
        status: 'healthy',
        size: this.memoryCache.size,
        maxSize: this.memoryCache.max
      },
      redis: {
        status: 'unknown',
        available: this.redisAvailable
      },
      overall: 'healthy'
    };

    if (this.redisAvailable) {
      try {
        const pong = await this.redis.ping();
        health.redis.status = pong === 'PONG' ? 'healthy' : 'unhealthy';
      } catch (error) {
        health.redis.status = 'unhealthy';
        health.overall = 'degraded';
        logError(logger, error, { context: 'healthCheck' });
      }
    } else {
      health.redis.status = 'unavailable';
      health.overall = 'degraded';
    }

    return health;
  }

  async disconnect() {
    try {
      this.memoryCache.clear();
      this.pendingRequests.clear();
      
      if (this.redis) {
        await this.redis.quit();
      }
      
      logger.info('👋 Intelligent Cache disconnected');
    } catch (error) {
      logError(logger, error, { context: 'disconnect' });
    }
  }
}

const defaultCache = new IntelligentCache({
  namespace: 'obentchi',
  version: 'v1',
  memoryCacheSize: 500
});

module.exports = {
  IntelligentCache,
  default: defaultCache,
  
  cacheGet: (key, options) => defaultCache.cacheGet(key, options),
  cacheSet: (key, value, ttl) => defaultCache.cacheSet(key, value, ttl),
  cacheWrap: (key, fn, options) => defaultCache.cacheWrap(key, fn, options),
  cacheInvalidate: (pattern) => defaultCache.cacheInvalidate(pattern),
  cacheWarm: (keysData) => defaultCache.cacheWarm(keysData),
  getCacheStats: () => defaultCache.getCacheStats(),
  getDetailedStats: () => defaultCache.getDetailedStats(),
  backgroundRefresh: (key, fn, options) => defaultCache.backgroundRefresh(key, fn, options),
  resetMetrics: () => defaultCache.resetMetrics(),
  clearAll: () => defaultCache.clearAll(),
  healthCheck: () => defaultCache.healthCheck()
};
