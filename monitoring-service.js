const pino = require('pino');
const os = require('os');
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
        lastCheckTime: Date.now(),
        requestLatencies: []
      },
      system: {
        memory: {},
        cpu: {},
        uptime: 0
      },
      database: {
        poolStats: {},
        responseTime: 0
      }
    };
    
    this.healthChecks = new Map();
    this.requestStartTimes = new Map();
  }

  async collectMetrics() {
    try {
      const [queueStats, dbStats, systemStats, dbPerformance] = await Promise.all([
        this.getQueueMetrics(),
        this.getDatabaseMetrics(),
        this.getSystemMetrics(),
        this.getDatabasePerformance()
      ]);

      this.metrics.queue = queueStats;
      this.metrics.payments = dbStats;
      this.metrics.system = systemStats;
      this.metrics.database = dbPerformance;
      this.metrics.performance.lastCheckTime = Date.now();

      return this.metrics;
    } catch (error) {
      logger.error(`❌ Error collecting metrics: ${error.message}`);
      return this.metrics;
    }
  }
  
  getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    
    const cpus = os.cpus();
    const cpuUsage = cpus.map((cpu, i) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      const usage = 100 - (idle / total * 100);
      return { core: i, usage: Math.round(usage * 100) / 100 };
    });
    
    const avgCpuUsage = cpuUsage.reduce((sum, cpu) => sum + cpu.usage, 0) / cpuUsage.length;
    
    return {
      memory: {
        total: Math.round(totalMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        usagePercent: Math.round(memUsagePercent * 100) / 100,
        processMemory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        usage: cpuUsage,
        avgUsage: Math.round(avgCpuUsage * 100) / 100
      },
      uptime: {
        system: Math.round(os.uptime()),
        process: Math.round(process.uptime())
      },
      loadAverage: os.loadavg().map(load => Math.round(load * 100) / 100),
      platform: os.platform(),
      arch: os.arch()
    };
  }
  
  async getDatabasePerformance() {
    const start = Date.now();
    
    try {
      const database = db.getDB();
      if (!database) {
        return {
          responseTime: 0,
          status: 'disconnected',
          poolStats: {}
        };
      }
      
      await database.admin().ping();
      const responseTime = Date.now() - start;
      
      return {
        responseTime,
        status: 'connected',
        poolStats: {
          maxPoolSize: 100,
          minPoolSize: 10,
          message: 'MongoDB connection pooling active'
        }
      };
    } catch (error) {
      return {
        responseTime: Date.now() - start,
        status: 'error',
        error: error.message,
        poolStats: {}
      };
    }
  }
  
  trackRequestLatency(requestId, duration) {
    if (this.metrics.performance.requestLatencies.length >= 100) {
      this.metrics.performance.requestLatencies.shift();
    }
    
    this.metrics.performance.requestLatencies.push({
      id: requestId,
      duration,
      timestamp: Date.now()
    });
    
    const latencies = this.metrics.performance.requestLatencies.map(r => r.duration);
    this.metrics.performance.avgProcessingTime = 
      Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    
    this.metrics.performance.p95Latency = this.calculatePercentile(latencies, 95);
    this.metrics.performance.p99Latency = this.calculatePercentile(latencies, 99);
  }
  
  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] || 0);
  }
  
  createRequestTracker() {
    const requestId = Date.now() + Math.random();
    this.requestStartTimes.set(requestId, Date.now());
    
    return {
      finish: () => {
        const start = this.requestStartTimes.get(requestId);
        if (start) {
          const duration = Date.now() - start;
          this.trackRequestLatency(requestId, duration);
          this.requestStartTimes.delete(requestId);
          return duration;
        }
        return 0;
      }
    };
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
    const startTime = Date.now();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      system: {},
      performance: {}
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
    
    const systemMetrics = this.getSystemMetrics();
    health.system = {
      memory: systemMetrics.memory,
      cpu: {
        cores: systemMetrics.cpu.cores,
        avgUsage: systemMetrics.cpu.avgUsage
      },
      uptime: systemMetrics.uptime
    };
    
    if (systemMetrics.memory.usagePercent > 90) {
      health.status = 'degraded';
      health.warnings = health.warnings || [];
      health.warnings.push('High memory usage detected');
    }
    
    if (systemMetrics.cpu.avgUsage > 80) {
      health.status = 'degraded';
      health.warnings = health.warnings || [];
      health.warnings.push('High CPU usage detected');
    }
    
    health.performance = {
      avgLatency: this.metrics.performance.avgProcessingTime || 0,
      p95Latency: this.metrics.performance.p95Latency || 0,
      p99Latency: this.metrics.performance.p99Latency || 0,
      healthCheckDuration: Date.now() - startTime
    };

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
