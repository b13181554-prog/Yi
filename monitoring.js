const cache = require('./cache-manager');
const db = require('./database');
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

class SystemMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastHealthCheck = null;
  }

  incrementRequest() {
    this.requestCount++;
  }

  incrementError() {
    this.errorCount++;
  }

  async getSystemHealth() {
    try {
      const cacheStats = await cache.getStats();

      let dbHealthy = true;
      try {
        await db.getUser(0);
      } catch (error) {
        dbHealthy = false;
      }

      const uptime = Date.now() - this.startTime;
      const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
      const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

      this.lastHealthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: {
          milliseconds: uptime,
          hours: uptimeHours,
          minutes: uptimeMinutes,
          formatted: `${uptimeHours}h ${uptimeMinutes}m`
        },
        metrics: {
          totalRequests: this.requestCount,
          totalErrors: this.errorCount,
          errorRate: this.requestCount > 0 
            ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
            : '0%'
        },
        cache: cacheStats,
        database: {
          connected: dbHealthy,
          status: dbHealthy ? 'healthy' : 'unhealthy'
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        }
      };

      return this.lastHealthCheck;
    } catch (error) {
      logger.error(`❌ Health check error: ${error.message}`);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getDetailedMetrics() {
    try {
      const health = await this.getSystemHealth();
      
      return {
        ...health,
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch
        },
        cpu: process.cpuUsage(),
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`❌ Detailed metrics error: ${error.message}`);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  getLastHealthCheck() {
    return this.lastHealthCheck || { status: 'not_checked_yet' };
  }
}

const monitor = new SystemMonitor();

setInterval(async () => {
  const health = await monitor.getSystemHealth();
  logger.info(`📊 System Health: ${health.status}`);
}, 60000);

module.exports = monitor;
