/**
 * API Timeout Configuration
 * تحديد timeouts موحدة لجميع استدعاءات API الخارجية
 */

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

/**
 * Timeouts بالميلي ثانية
 */
const TIMEOUTS = {
  // Cryptocurrency APIs
  CRYPTO: {
    OKX: 15000,           // 15s
    BINANCE: 15000,       // 15s
    BYBIT: 15000,         // 15s
    COINGECKO: 20000,     // 20s (أبطأ أحياناً)
    GATE_IO: 15000,       // 15s
    KRAKEN: 15000,        // 15s
    COINBASE: 15000,      // 15s
    COINPAPRIKA: 20000,   // 20s
    DEXSCREENER: 15000,   // 15s
    GECKOTERMINAL: 15000, // 15s
  },
  
  // Forex/Stock APIs
  FOREX: {
    TWELVEDATA: 15000,    // 15s
    YAHOO_FINANCE: 15000, // 15s
    ALPHA_VANTAGE: 15000, // 15s
    EXCHANGERATE: 10000,  // 10s
    FRANKFURTER: 10000,   // 10s
  },
  
  // Blockchain APIs
  BLOCKCHAIN: {
    TRON: 15000,          // 15s
    ETHERSCAN: 15000,     // 15s
    BSCSCAN: 15000,       // 15s
    WHALE_ALERT: 10000,   // 10s
  },
  
  // Payment/Withdrawal
  PAYMENT: {
    CRYPTAPI: 15000,      // 15s
    OKX_WITHDRAWAL: 30000, // 30s (عمليات سحب قد تأخذ وقت)
  },
  
  // Telegram
  TELEGRAM: {
    API: 10000,           // 10s
    SEND_MESSAGE: 10000,  // 10s
    SEND_PHOTO: 15000,    // 15s
  },
  
  // AI/ML
  AI: {
    GROQ: 30000,          // 30s (تحليل AI قد يأخذ وقت)
  },
  
  // Database
  DATABASE: {
    QUERY: 10000,         // 10s
    TRANSACTION: 15000,   // 15s (transactions أطول)
  }
};

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,      // 1s
  MAX_DELAY: 10000,      // 10s
  BACKOFF_MULTIPLIER: 2, // exponential
};

/**
 * Circuit Breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 5,  // 5 فشل متتالي
  SUCCESS_THRESHOLD: 2,  // 2 نجاح لإعادة الفتح
  TIMEOUT: 15000,        // 15s
  RESET_TIMEOUT: 60000,  // دقيقة قبل المحاولة مرة أخرى
};

/**
 * دالة مساعدة لإنشاء axios config مع timeout
 */
function createAxiosConfig(apiType, apiName, additionalConfig = {}) {
  const timeout = TIMEOUTS[apiType]?.[apiName] || 15000;
  
  return {
    timeout,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'OBENTCHI-Bot/1.0',
      ...additionalConfig.headers
    },
    ...additionalConfig
  };
}

/**
 * دالة retry مع exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    baseDelay = RETRY_CONFIG.BASE_DELAY,
    maxDelay = RETRY_CONFIG.MAX_DELAY,
    multiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay);
      
      logger.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);
      logger.warn(`⏳ Retrying in ${delay}ms...`);
      
      if (onRetry) {
        onRetry(attempt, error, delay);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * دالة timeout wrapper
 */
async function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * دالة مساعدة لتنفيذ API call مع timeout وretry
 */
async function executeWithTimeoutAndRetry(fn, options = {}) {
  const {
    timeout = 15000,
    maxRetries = 3,
    timeoutMessage = 'API call timed out',
    ...retryOptions
  } = options;

  return retryWithBackoff(
    () => withTimeout(fn(), timeout, timeoutMessage),
    { maxRetries, ...retryOptions }
  );
}

module.exports = {
  TIMEOUTS,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  createAxiosConfig,
  retryWithBackoff,
  withTimeout,
  executeWithTimeoutAndRetry
};
