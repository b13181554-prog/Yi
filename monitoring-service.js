const pino = require('pino');
const { paymentCallbackQueue } = require('./payment-callback-queue');
const db = require('./database');

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

class MonitoringService {
  constructor() {
    this.metrics = {
      payments: {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0
      },
      queue: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      },
      performance: {
        avgProcessingTime: 0,
        lastCheckTime: Date.now()
      }
    };
    
    this.healthChecks = new Map();
  }

  async collectMetrics() {
    try {
      const [queueStats, dbStats] = await Promise.all([
        this.getQueueMetrics(),
        this.getDatabaseMetrics()
      ]);

      this.metrics.queue = queueStats;
      this.metrics.payments = dbStats;
      this.metrics.performance.lastCheckTime = Date.now();

      return this.metrics;
    } catch (error) {
      logger.error(`❌ Error collecting metrics: ${error.message}`);
      return this.metrics;
    }
  }

  async getQueueMetrics() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        paymentCallbackQueue.getWaitingCount(),
        paymentCallbackQueue.getActiveCount(),
        paymentCallbackQueue.getCompletedCount(),
        paymentCallbackQueue.getFailedCount(),
        paymentCallbackQueue.getDelayedCount()
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error(`❌ Queue metrics error: ${error.message}`);
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }

  async getDatabaseMetrics() {
    try {
      const pendingPayments = await db.getCryptAPIPaymentsByStatus('pending');
      const confirmedPayments = await db.getCryptAPIPaymentsByStatus('confirmed');
      const completedPayments = await db.getCryptAPIPaymentsByStatus('completed');

      return {
        total: pendingPayments.length + confirmedPayments.length + completedPayments.length,
        pending: pendingPayments.length,
        confirmed: confirmedPayments.length,
        success: completedPayments.length,
        failed: 0
      };
    } catch (error) {
      logger.error(`❌ Database metrics error: ${error.message}`);
      return { total: 0, success: 0, failed: 0, pending: 0 };
    }
  }

  async checkHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    const checks = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'queue', check: () => this.checkQueue() },
      { name: 'redis', check: () => this.checkRedis() }
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        health.services[name] = result;
        
        if (!result.healthy) {
          health.status = 'degraded';
        }
      } catch (error) {
        health.services[name] = {
          healthy: false,
          error: error.message
        };
        health.status = 'unhealthy';
      }
    }

    this.healthChecks.set('last_check', health);
    return health;
  }

  async checkDatabase() {
    try {
      await db.getUser(1);
      return {
        healthy: true,
        responseTime: Date.now() - this.metrics.performance.lastCheckTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkQueue() {
    try {
      const stats = await this.getQueueMetrics();
      const isHealthy = stats.failed < 100 && stats.waiting < 1000;
      
      return {
        healthy: isHealthy,
        stats,
        message: isHealthy ? 'Queue operating normally' : 'Queue has high load or failures'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkRedis() {
    try {
      const start = Date.now();
      await paymentCallbackQueue.client.ping();
      const responseTime = Date.now() - start;
      
      return {
        healthy: responseTime < 1000,
        responseTime,
        message: responseTime < 1000 ? 'Redis responding normally' : 'Redis slow response'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async getSystemStatus() {
    const [metrics, health] = await Promise.all([
      this.collectMetrics(),
      this.checkHealth()
    ]);

    return {
      health,
      metrics,
      timestamp: new Date().toISOString()
    };
  }

  logMetrics() {
    logger.info('📊 System Metrics:', {
      queue: this.metrics.queue,
      payments: this.metrics.payments
    });
  }

  async alertOnAnomalies() {
    const metrics = await this.collectMetrics();
    
    if (metrics.queue.failed > 50) {
      logger.warn(`⚠️ High queue failure rate: ${metrics.queue.failed} failed jobs`);
    }

    if (metrics.queue.waiting > 500) {
      logger.warn(`⚠️ High queue backlog: ${metrics.queue.waiting} waiting jobs`);
    }

    if (metrics.queue.delayed > 100) {
      logger.warn(`⚠️ Many delayed jobs: ${metrics.queue.delayed} delayed jobs`);
    }
  }

  startMonitoring(intervalMs = 60000) {
    logger.info(`📊 Starting monitoring service (interval: ${intervalMs}ms)`);
    
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      this.logMetrics();
      await this.alertOnAnomalies();
    }, intervalMs);

    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, 30000);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      logger.info('⏹️ Monitoring service stopped');
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

module.exports = new MonitoringService();
