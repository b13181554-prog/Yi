/**
 * Memory Optimizer
 * نظام تحسين الذاكرة التلقائي
 * يقوم بتنظيف الذاكرة وإدارة الـ caches لمنع استخدام الذاكرة المفرط
 */

const { createLogger } = require('./centralized-logger');
const { checkMemoryHealth } = require('./improved-health-checks');

const logger = createLogger('MemoryOptimizer');

class MemoryOptimizer {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.checkInterval = options.checkInterval || 5 * 60 * 1000; // كل 5 دقائق
    this.gcThreshold = options.gcThreshold || 80; // تشغيل GC عند 80%
    this.forceGCThreshold = options.forceGCThreshold || 90; // GC قوي عند 90%
    this.intervalId = null;
    
    // تتبع الإحصائيات
    this.stats = {
      totalGCRuns: 0,
      totalCacheCleanups: 0,
      lastGCTime: null,
      lastCleanupTime: null,
      memoryFreed: 0
    };
    
    // مراجع للـ caches (سيتم تعيينها من الخارج)
    this.caches = new Map();
    
    logger.info('✅ Memory Optimizer initialized');
  }
  
  /**
   * تسجيل cache للتنظيف التلقائي
   */
  registerCache(name, cache, cleanupMethod = 'clear') {
    this.caches.set(name, { cache, cleanupMethod });
    logger.info(`📝 Registered cache: ${name}`);
  }
  
  /**
   * إلغاء تسجيل cache
   */
  unregisterCache(name) {
    this.caches.delete(name);
    logger.info(`❌ Unregistered cache: ${name}`);
  }
  
  /**
   * تشغيل garbage collection إذا كان متاحاً
   */
  async runGarbageCollection(force = false) {
    try {
      const beforeMemory = process.memoryUsage();
      
      if (global.gc) {
        logger.info(`🗑️ Running garbage collection (force: ${force})...`);
        global.gc();
        
        const afterMemory = process.memoryUsage();
        const freedMB = (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024;
        
        this.stats.totalGCRuns++;
        this.stats.lastGCTime = new Date();
        this.stats.memoryFreed += freedMB;
        
        logger.info(`✅ GC completed - Freed: ${freedMB.toFixed(2)} MB`);
        return { success: true, freedMB };
      } else {
        logger.warn('⚠️ Garbage collection not available (run with --expose-gc flag)');
        return { success: false, reason: 'GC not available' };
      }
    } catch (error) {
      logger.error(`❌ GC failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * تنظيف جميع الـ caches المسجلة
   */
  async cleanupCaches(selective = true) {
    try {
      logger.info(`🧹 Cleaning up ${this.caches.size} cache(s)...`);
      
      let cleanedCount = 0;
      
      for (const [name, { cache, cleanupMethod }] of this.caches.entries()) {
        try {
          if (cleanupMethod === 'clear' && typeof cache.clear === 'function') {
            const sizeBefore = cache.size || 0;
            cache.clear();
            logger.info(`  ✓ Cleared cache: ${name} (size: ${sizeBefore})`);
            cleanedCount++;
          } else if (cleanupMethod === 'reset' && typeof cache.reset === 'function') {
            cache.reset();
            logger.info(`  ✓ Reset cache: ${name}`);
            cleanedCount++;
          } else if (cleanupMethod === 'purge' && typeof cache.purgeStale === 'function') {
            cache.purgeStale();
            logger.info(`  ✓ Purged stale entries: ${name}`);
            cleanedCount++;
          } else if (cleanupMethod === 'custom' && typeof cache.cleanup === 'function') {
            await cache.cleanup();
            logger.info(`  ✓ Custom cleanup: ${name}`);
            cleanedCount++;
          }
        } catch (error) {
          logger.error(`  ❌ Failed to clean cache ${name}: ${error.message}`);
        }
      }
      
      this.stats.totalCacheCleanups++;
      this.stats.lastCleanupTime = new Date();
      
      logger.info(`✅ Cache cleanup completed (${cleanedCount}/${this.caches.size} caches cleaned)`);
      return { success: true, cleanedCount };
    } catch (error) {
      logger.error(`❌ Cache cleanup failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * فحص الذاكرة وتنفيذ إجراءات التحسين عند الحاجة
   */
  async checkAndOptimize() {
    try {
      const memoryHealth = checkMemoryHealth();
      const avgUsage = parseFloat(memoryHealth.details.avgUsagePercent.replace('%', ''));
      const currentUsage = parseFloat(memoryHealth.details.currentUsagePercent.replace('%', ''));
      
      logger.info(`📊 Memory check - Current: ${currentUsage.toFixed(1)}%, Avg: ${avgUsage.toFixed(1)}%, Status: ${memoryHealth.status}`);
      
      // إذا كانت الذاكرة في حالة حرجة
      if (memoryHealth.status === 'critical' || avgUsage > this.forceGCThreshold) {
        logger.warn(`🚨 Critical memory usage detected! Running aggressive optimization...`);
        
        // تنظيف الـ caches أولاً
        await this.cleanupCaches(false);
        
        // ثم تشغيل GC
        await this.runGarbageCollection(true);
        
        return { action: 'aggressive', memoryHealth };
      }
      // إذا كانت الذاكرة مرتفعة
      else if (memoryHealth.status === 'degraded' || avgUsage > this.gcThreshold) {
        logger.info(`⚠️ High memory usage detected - Running optimization...`);
        
        // تنظيف انتقائي للـ caches
        await this.cleanupCaches(true);
        
        // تشغيل GC عادي
        await this.runGarbageCollection(false);
        
        return { action: 'normal', memoryHealth };
      }
      // الذاكرة طبيعية
      else {
        logger.debug(`✅ Memory usage healthy - No action needed`);
        return { action: 'none', memoryHealth };
      }
    } catch (error) {
      logger.error(`❌ Check and optimize failed: ${error.message}`);
      return { action: 'error', error: error.message };
    }
  }
  
  /**
   * بدء المراقبة التلقائية
   */
  start() {
    if (!this.enabled) {
      logger.warn('⚠️ Memory Optimizer is disabled');
      return;
    }
    
    if (this.intervalId) {
      logger.warn('⚠️ Memory Optimizer is already running');
      return;
    }
    
    logger.info(`🚀 Starting Memory Optimizer (interval: ${this.checkInterval}ms)`);
    
    // فحص فوري
    this.checkAndOptimize();
    
    // فحص دوري
    this.intervalId = setInterval(() => {
      this.checkAndOptimize();
    }, this.checkInterval);
  }
  
  /**
   * إيقاف المراقبة
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('⏹️ Memory Optimizer stopped');
    }
  }
  
  /**
   * الحصول على إحصائيات الأداء
   */
  getStats() {
    return {
      ...this.stats,
      registeredCaches: this.caches.size,
      cacheNames: Array.from(this.caches.keys()),
      uptime: this.intervalId ? 'running' : 'stopped'
    };
  }
  
  /**
   * إعادة تعيين الإحصائيات
   */
  resetStats() {
    this.stats = {
      totalGCRuns: 0,
      totalCacheCleanups: 0,
      lastGCTime: null,
      lastCleanupTime: null,
      memoryFreed: 0
    };
    logger.info('📊 Stats reset');
  }
  
  /**
   * تشغيل تحسين يدوي
   */
  async optimize(aggressive = false) {
    logger.info(`🔧 Manual optimization triggered (aggressive: ${aggressive})`);
    
    if (aggressive) {
      await this.cleanupCaches(false);
      await this.runGarbageCollection(true);
    } else {
      await this.cleanupCaches(true);
      await this.runGarbageCollection(false);
    }
    
    const memoryHealth = checkMemoryHealth();
    logger.info(`✅ Manual optimization completed - Status: ${memoryHealth.status}`);
    
    return memoryHealth;
  }
}

// إنشاء نسخة واحدة
const memoryOptimizer = new MemoryOptimizer({
  enabled: true,
  checkInterval: 5 * 60 * 1000, // كل 5 دقائق
  gcThreshold: 80,
  forceGCThreshold: 90
});

module.exports = memoryOptimizer;
