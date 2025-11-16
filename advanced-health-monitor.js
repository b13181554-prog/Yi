
const { createLogger } = require('./centralized-logger');
const db = require('./database');
const cache = require('./intelligent-cache');

const logger = createLogger('health-monitor');

class AdvancedHealthMonitor {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.alertThresholds = {
      errorRate: 0.05, // 5%
      responseTime: 2000, // 2 seconds
      queueBacklog: 100
    };
  }

  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      interval: options.interval || 60000, // 1 minute default
      critical: options.critical || false,
      timeout: options.timeout || 5000
    });
  }

  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) return null;

    const startTime = Date.now();
    try {
      const result = await Promise.race([
        check.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Check timeout')), check.timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      const checkResult = {
        name,
        status: 'healthy',
        duration,
        timestamp: new Date(),
        ...result
      };

      this.lastResults.set(name, checkResult);
      return checkResult;

    } catch (error) {
      const checkResult = {
        name,
        status: 'unhealthy',
        error: error.message,
        critical: check.critical,
        timestamp: new Date()
      };

      this.lastResults.set(name, checkResult);
      logger.error(`Health check failed: ${name}`, error);
      return checkResult;
    }
  }

  async runAllChecks() {
    const results = await Promise.all(
      Array.from(this.checks.keys()).map(name => this.runCheck(name))
    );

    const summary = {
      timestamp: new Date(),
      overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
      checks: results,
      criticalFailures: results.filter(r => r.status === 'unhealthy' && r.critical)
    };

    return summary;
  }

  getLastResults() {
    return Array.from(this.lastResults.values());
  }
}

// إنشاء instance واحد
const healthMonitor = new AdvancedHealthMonitor();

// تسجيل الفحوصات الأساسية
healthMonitor.registerCheck('database', async () => {
  const startTime = Date.now();
  await db.getDB().admin().ping();
  return {
    responseTime: Date.now() - startTime,
    details: 'MongoDB connection is healthy'
  };
}, { critical: true, interval: 30000 });

healthMonitor.registerCheck('cache', async () => {
  const health = await cache.healthCheck();
  return {
    details: health
  };
}, { interval: 60000 });

healthMonitor.registerCheck('queues', async () => {
  const withdrawalQueue = require('./withdrawal-queue');
  const paymentQueue = require('./payment-callback-queue');
  
  const [wStats, pStats] = await Promise.all([
    withdrawalQueue.getWithdrawalQueueStats(),
    paymentQueue.getQueueStats()
  ]);

  const totalPending = wStats.waiting + pStats.waiting;
  
  return {
    status: totalPending > 100 ? 'warning' : 'healthy',
    withdrawalQueue: wStats,
    paymentQueue: pStats,
    totalPending
  };
}, { interval: 30000 });

module.exports = healthMonitor;
