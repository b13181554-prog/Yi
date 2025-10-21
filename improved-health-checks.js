/**
 * Improved Health Checks
 * فحوصات صحة شاملة لجميع مكونات النظام
 */

const { createLogger } = require('./centralized-logger');
const db = require('./database');
const { rateLimiter } = require('./redis-rate-limiter');
const { withdrawalQueue } = require('./withdrawal-queue');
const { paymentCallbackQueue } = require('./payment-callback-queue');

const logger = createLogger('HealthChecks');

/**
 * فحص صحة قاعدة البيانات
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    const database = db.getDB();
    
    if (!database) {
      return {
        status: 'unhealthy',
        message: 'Database not initialized',
        responseTime: Date.now() - startTime
      };
    }
    
    // اختبار ping
    await database.admin().ping();
    
    // عد المستخدمين كاختبار بسيط
    const userCount = await database.collection('users').estimatedDocumentCount();
    
    return {
      status: 'healthy',
      message: 'Database operational',
      responseTime: Date.now() - startTime,
      details: {
        userCount
      }
    };
  } catch (error) {
    logger.error(`Database health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * فحص صحة Redis
 */
async function checkRedisHealth() {
  const startTime = Date.now();
  
  try {
    // اختبار بسيط للتحقق من Redis
    const testKey = 'health_check_test';
    const result = await rateLimiter.checkLimit(testKey, 1, 1000);
    
    if (!result) {
      throw new Error('Redis check limit failed');
    }
    
    // تنظيف
    await rateLimiter.reset(testKey);
    
    return {
      status: 'healthy',
      message: 'Redis operational',
      responseTime: Date.now() - startTime,
      details: {
        available: rateLimiter.redisAvailable
      }
    };
  } catch (error) {
    logger.error(`Redis health check failed: ${error.message}`);
    return {
      status: 'degraded',
      message: `Redis unavailable (fallback active): ${error.message}`,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * فحص صحة Withdrawal Queue
 */
async function checkWithdrawalQueueHealth() {
  const startTime = Date.now();
  
  try {
    const stats = await withdrawalQueue.getJobCounts();
    
    const totalJobs = stats.waiting + stats.active + stats.delayed;
    const hasStalled = stats.active > 10; // أكثر من 10 jobs نشطة قد يكون مشكلة
    
    return {
      status: hasStalled ? 'degraded' : 'healthy',
      message: hasStalled ? 'High number of active jobs' : 'Queue operational',
      responseTime: Date.now() - startTime,
      details: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed,
        total: totalJobs
      }
    };
  } catch (error) {
    logger.error(`Withdrawal queue health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * فحص صحة Payment Queue
 */
async function checkPaymentQueueHealth() {
  const startTime = Date.now();
  
  try {
    const stats = await paymentCallbackQueue.getJobCounts();
    
    const totalJobs = stats.waiting + stats.active + stats.delayed;
    
    return {
      status: 'healthy',
      message: 'Queue operational',
      responseTime: Date.now() - startTime,
      details: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        total: totalJobs
      }
    };
  } catch (error) {
    logger.error(`Payment queue health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * فحص صحة الذاكرة
 */
function checkMemoryHealth() {
  const usage = process.memoryUsage();
  const totalMemoryMB = usage.heapTotal / 1024 / 1024;
  const usedMemoryMB = usage.heapUsed / 1024 / 1024;
  const usagePercent = (usedMemoryMB / totalMemoryMB) * 100;
  
  let status = 'healthy';
  let message = 'Memory usage normal';
  
  if (usagePercent > 90) {
    status = 'critical';
    message = 'Memory usage critical';
  } else if (usagePercent > 75) {
    status = 'degraded';
    message = 'Memory usage high';
  }
  
  return {
    status,
    message,
    details: {
      heapUsed: `${usedMemoryMB.toFixed(2)} MB`,
      heapTotal: `${totalMemoryMB.toFixed(2)} MB`,
      usagePercent: `${usagePercent.toFixed(2)}%`,
      rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`
    }
  };
}

/**
 * فحص صحة الـ Uptime
 */
function checkUptimeHealth() {
  const uptime = process.uptime();
  const uptimeHours = uptime / 3600;
  
  return {
    status: 'healthy',
    message: `Uptime: ${uptimeHours.toFixed(2)} hours`,
    details: {
      uptime: `${uptime.toFixed(0)} seconds`,
      uptimeHours: `${uptimeHours.toFixed(2)} hours`,
      uptimeDays: `${(uptimeHours / 24).toFixed(2)} days`
    }
  };
}

/**
 * فحص صحي شامل
 */
async function performFullHealthCheck() {
  const startTime = Date.now();
  
  logger.info('🔍 Performing full health check...');
  
  const checks = await Promise.allSettled([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkWithdrawalQueueHealth(),
    checkPaymentQueueHealth()
  ]);
  
  const results = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', message: checks[0].reason?.message },
    redis: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', message: checks[1].reason?.message },
    withdrawalQueue: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', message: checks[2].reason?.message },
    paymentQueue: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'error', message: checks[3].reason?.message },
    memory: checkMemoryHealth(),
    uptime: checkUptimeHealth()
  };
  
  // تحديد الحالة العامة
  const statuses = Object.values(results).map(r => r.status);
  let overallStatus = 'healthy';
  
  if (statuses.includes('unhealthy') || statuses.includes('critical') || statuses.includes('error')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  const totalTime = Date.now() - startTime;
  
  logger.info(`✅ Health check completed in ${totalTime}ms - Overall: ${overallStatus}`);
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalResponseTime: `${totalTime}ms`,
    checks: results
  };
}

/**
 * فحص سريع (للاستخدام المتكرر)
 */
async function performQuickHealthCheck() {
  try {
    const database = db.getDB();
    
    return {
      status: database ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Readiness check (هل النظام جاهز لاستقبال طلبات)
 */
async function checkReadiness() {
  try {
    const database = db.getDB();
    
    if (!database) {
      return {
        ready: false,
        reason: 'Database not initialized'
      };
    }
    
    // اختبار ping سريع
    await database.admin().ping();
    
    return {
      ready: true
    };
  } catch (error) {
    return {
      ready: false,
      reason: error.message
    };
  }
}

/**
 * Liveness check (هل العملية لا تزال حية)
 */
function checkLiveness() {
  return {
    alive: true,
    timestamp: new Date().toISOString(),
    pid: process.pid
  };
}

module.exports = {
  performFullHealthCheck,
  performQuickHealthCheck,
  checkReadiness,
  checkLiveness,
  checkDatabaseHealth,
  checkRedisHealth,
  checkWithdrawalQueueHealth,
  checkPaymentQueueHealth,
  checkMemoryHealth,
  checkUptimeHealth
};
