/**
 * Centralized Logger
 * نظام logging موحد لكل المشروع مع مستويات مختلفة
 */

const pino = require('pino');
const path = require('path');

// تحديد مستوى الـ log من متغيرات البيئة
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// إنشاء logger أساسي
const baseLogger = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{levelLabel} [{name}] {msg}'
    }
  }
});

/**
 * إنشاء child logger لكل module
 */
function createLogger(moduleName) {
  return baseLogger.child({ name: moduleName });
}

/**
 * Log levels:
 * - trace: معلومات تفصيلية جداً للتطوير
 * - debug: معلومات مفيدة للتطوير
 * - info: معلومات عامة عن سير العمل
 * - warn: تحذيرات - شيء غير متوقع لكن ليس خطأ
 * - error: أخطاء - فشل في عملية
 * - fatal: أخطاء حرجة - النظام قد يتوقف
 */

/**
 * دالة مساعدة لتسجيل الأخطاء مع stack trace
 */
function logError(logger, error, context = {}) {
  logger.error({
    err: error,
    stack: error.stack,
    ...context
  }, error.message);
}

/**
 * دالة لتسجيل API calls
 */
function logAPICall(logger, method, url, duration, status, error = null) {
  const logData = {
    method,
    url,
    duration: `${duration}ms`,
    status
  };

  if (error) {
    logger.error(logData, `API call failed: ${method} ${url}`);
  } else if (status >= 400) {
    logger.warn(logData, `API call warning: ${method} ${url}`);
  } else {
    logger.debug(logData, `API call successful: ${method} ${url}`);
  }
}

/**
 * دالة لتسجيل Database operations
 */
function logDatabaseOperation(logger, operation, collection, duration, error = null) {
  const logData = {
    operation,
    collection,
    duration: `${duration}ms`
  };

  if (error) {
    logger.error({
      ...logData,
      error: error.message
    }, `Database operation failed: ${operation} on ${collection}`);
  } else {
    logger.debug(logData, `Database operation: ${operation} on ${collection}`);
  }
}

/**
 * دالة لتسجيل User actions
 */
function logUserAction(logger, userId, action, details = {}) {
  logger.info({
    user_id: userId,
    action,
    ...details
  }, `User action: ${action}`);
}

/**
 * دالة لتسجيل Payment/Withdrawal operations
 */
function logPaymentOperation(logger, type, userId, amount, status, details = {}) {
  logger.info({
    type,
    user_id: userId,
    amount,
    status,
    ...details
  }, `${type} operation: ${amount} USDT for user ${userId} - ${status}`);
}

/**
 * دالة لتسجيل Security events
 */
function logSecurityEvent(logger, event, severity, userId = null, details = {}) {
  const logData = {
    event,
    severity,
    user_id: userId,
    ...details
  };

  if (severity === 'critical' || severity === 'high') {
    logger.error(logData, `Security event: ${event}`);
  } else {
    logger.warn(logData, `Security event: ${event}`);
  }
}

/**
 * دالة لتسجيل Performance metrics
 */
function logPerformance(logger, operation, duration, threshold = 1000) {
  const logData = {
    operation,
    duration: `${duration}ms`,
    threshold: `${threshold}ms`
  };

  if (duration > threshold) {
    logger.warn(logData, `⚠️ Slow operation: ${operation} took ${duration}ms`);
  } else {
    logger.debug(logData, `Performance: ${operation}`);
  }
}

/**
 * Middleware لتسجيل HTTP requests
 */
function createHttpLoggerMiddleware(logger) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // تسجيل الطلب
    logger.debug({
      method: req.method,
      url: req.url,
      ip: req.ip,
      user_agent: req.get('user-agent')
    }, `Incoming request: ${req.method} ${req.url}`);
    
    // تسجيل الاستجابة
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`
      };
      
      if (res.statusCode >= 500) {
        logger.error(logData, `Server error: ${req.method} ${req.url}`);
      } else if (res.statusCode >= 400) {
        logger.warn(logData, `Client error: ${req.method} ${req.url}`);
      } else {
        logger.info(logData, `Request completed: ${req.method} ${req.url}`);
      }
    });
    
    next();
  };
}

/**
 * دالة مساعدة لقياس الوقت
 */
function createTimer() {
  const startTime = Date.now();
  
  return {
    elapsed: () => Date.now() - startTime,
    log: (logger, message) => {
      const elapsed = Date.now() - startTime;
      logger.info({ duration: `${elapsed}ms` }, message);
    }
  };
}

module.exports = {
  createLogger,
  logError,
  logAPICall,
  logDatabaseOperation,
  logUserAction,
  logPaymentOperation,
  logSecurityEvent,
  logPerformance,
  createHttpLoggerMiddleware,
  createTimer,
  LOG_LEVELS: {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
  }
};
