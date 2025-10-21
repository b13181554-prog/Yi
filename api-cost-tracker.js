const Redis = require('ioredis');
const { createLogger, logError, logPerformance, createTimer } = require('./centralized-logger');

const logger = createLogger('APICostTracker');

class APICostTracker {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      keyPrefix: 'api_costs:',
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      }
    });

    this.redisAvailable = true;

    this.inMemoryStats = {
      hourly: new Map(),
      daily: new Map(),
      byAPI: new Map(),
      byEndpoint: new Map(),
      byUser: new Map()
    };

    this.apiRegistry = this.buildAPIRegistry();

    this.alerts = {
      hourlyBudget: 10,
      dailyBudget: 100,
      monthlyBudget: 1000,
      perAPILimit: 50,
      enabled: true
    };

    this.setupRedisHandlers();
    this.startCleanupTimer();

    logger.info('✅ API Cost Tracker initialized', {
      totalAPIs: Object.keys(this.apiRegistry).length,
      alertsEnabled: this.alerts.enabled
    });
  }

  buildAPIRegistry() {
    return {
      'CoinGecko': {
        name: 'CoinGecko',
        category: 'Cryptocurrency',
        baseURL: 'https://api.coingecko.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 10,
            requestsPerMonth: 10000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 500,
            requestsPerMonth: 500000,
            costPerRequest: 0.0001
          }
        },
        endpoints: {
          '/api/v3/simple/price': { weight: 1, cacheable: true, ttl: 30 },
          '/api/v3/coins/{id}': { weight: 2, cacheable: true, ttl: 300 },
          '/api/v3/coins/markets': { weight: 3, cacheable: true, ttl: 120 }
        },
        rateLimit: { requests: 10, window: 60 },
        alternatives: ['CoinPaprika', 'CoinMarketCap']
      },

      'CoinPaprika': {
        name: 'CoinPaprika',
        category: 'Cryptocurrency',
        baseURL: 'https://api.coinpaprika.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 10,
            requestsPerMonth: 25000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 100,
            requestsPerMonth: 500000,
            costPerRequest: 0.00005
          }
        },
        endpoints: {
          '/v1/tickers/{id}': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 10, window: 60 },
        alternatives: ['CoinGecko', 'CoinMarketCap']
      },

      'OKX': {
        name: 'OKX',
        category: 'Exchange',
        baseURL: 'https://www.okx.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 20,
            requestsPerMonth: 100000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/api/v5/market/ticker': { weight: 1, cacheable: true, ttl: 10 },
          '/api/v5/market/candles': { weight: 2, cacheable: true, ttl: 60 },
          '/api/v5/market/tickers': { weight: 3, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 20, window: 2 },
        alternatives: ['Binance', 'Bybit']
      },

      'Binance': {
        name: 'Binance',
        category: 'Exchange',
        baseURL: 'https://api.binance.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 1200,
            requestsPerMonth: 1000000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/api/v3/ticker/price': { weight: 1, cacheable: true, ttl: 10 },
          '/api/v3/ticker/24hr': { weight: 1, cacheable: true, ttl: 30 },
          '/api/v3/klines': { weight: 1, cacheable: true, ttl: 60 }
        },
        rateLimit: { requests: 1200, window: 60 },
        alternatives: ['OKX', 'Bybit']
      },

      'Bybit': {
        name: 'Bybit',
        category: 'Exchange',
        baseURL: 'https://api.bybit.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 120,
            requestsPerMonth: 500000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/v5/market/tickers': { weight: 1, cacheable: true, ttl: 10 },
          '/v5/market/kline': { weight: 1, cacheable: true, ttl: 60 }
        },
        rateLimit: { requests: 120, window: 60 },
        alternatives: ['Binance', 'OKX']
      },

      'Gate.io': {
        name: 'Gate.io',
        category: 'Exchange',
        baseURL: 'https://api.gateio.ws',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 900,
            requestsPerMonth: 500000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/api/v4/spot/tickers': { weight: 1, cacheable: true, ttl: 10 }
        },
        rateLimit: { requests: 900, window: 60 },
        alternatives: ['OKX', 'Binance']
      },

      'Kraken': {
        name: 'Kraken',
        category: 'Exchange',
        baseURL: 'https://api.kraken.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 15,
            requestsPerMonth: 100000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/0/public/Ticker': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 15, window: 60 },
        alternatives: ['Coinbase', 'Binance']
      },

      'Coinbase': {
        name: 'Coinbase',
        category: 'Exchange',
        baseURL: 'https://api.coinbase.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 10,
            requestsPerMonth: 10000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/v2/prices/{pair}/spot': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 10, window: 60 },
        alternatives: ['Kraken', 'Binance']
      },

      'Huobi': {
        name: 'Huobi',
        category: 'Exchange',
        baseURL: 'https://api.huobi.pro',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 100,
            requestsPerMonth: 500000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/market/detail/merged': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 100, window: 60 },
        alternatives: ['OKX', 'Binance']
      },

      'Crypto.com': {
        name: 'Crypto.com',
        category: 'Exchange',
        baseURL: 'https://api.crypto.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 100,
            requestsPerMonth: 500000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/v2/public/get-ticker': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 100, window: 60 },
        alternatives: ['OKX', 'Gate.io']
      },

      'Bitfinex': {
        name: 'Bitfinex',
        category: 'Exchange',
        baseURL: 'https://api-pub.bitfinex.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 90,
            requestsPerMonth: 500000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/v2/ticker/{symbol}': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 90, window: 60 },
        alternatives: ['Kraken', 'Binance']
      },

      'DexScreener': {
        name: 'DexScreener',
        category: 'DEX',
        baseURL: 'https://api.dexscreener.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 300,
            requestsPerMonth: 100000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/latest/dex/tokens/{address}': { weight: 1, cacheable: true, ttl: 60 },
          '/latest/dex/search': { weight: 1, cacheable: true, ttl: 120 },
          '/orders/v1/{chainId}/{pairAddress}': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 300, window: 60 },
        alternatives: ['GeckoTerminal', 'Birdeye']
      },

      'GeckoTerminal': {
        name: 'GeckoTerminal',
        category: 'DEX',
        baseURL: 'https://api.geckoterminal.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 30,
            requestsPerMonth: 50000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/api/v2/networks/trending_pools': { weight: 2, cacheable: true, ttl: 300 }
        },
        rateLimit: { requests: 30, window: 60 },
        alternatives: ['DexScreener', 'Birdeye']
      },

      'Birdeye': {
        name: 'Birdeye',
        category: 'DEX',
        baseURL: 'https://public-api.birdeye.so',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 10,
            requestsPerMonth: 10000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 300,
            requestsPerMonth: 1000000,
            costPerRequest: 0.0001
          }
        },
        endpoints: {
          '/public/tokenlist': { weight: 1, cacheable: true, ttl: 300 }
        },
        rateLimit: { requests: 10, window: 60 },
        alternatives: ['DexScreener', 'GeckoTerminal']
      },

      'TwelveData': {
        name: 'TwelveData',
        category: 'Forex/Stocks',
        baseURL: 'https://api.twelvedata.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 8,
            requestsPerDay: 800,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 60,
            requestsPerDay: 100000,
            costPerRequest: 0.001
          }
        },
        endpoints: {
          '/time_series': { weight: 1, cacheable: true, ttl: 60 },
          '/quote': { weight: 1, cacheable: true, ttl: 30 }
        },
        rateLimit: { requests: 8, window: 60 },
        alternatives: ['Yahoo Finance', 'Alpha Vantage']
      },

      'Yahoo Finance': {
        name: 'Yahoo Finance',
        category: 'Forex/Stocks',
        baseURL: 'https://query2.finance.yahoo.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 2000,
            requestsPerMonth: 1000000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/v8/finance/chart/{symbol}': { weight: 1, cacheable: true, ttl: 60 }
        },
        rateLimit: { requests: 2000, window: 60 },
        alternatives: ['TwelveData', 'Alpha Vantage']
      },

      'Alpha Vantage': {
        name: 'Alpha Vantage',
        category: 'Forex/Stocks',
        baseURL: 'https://www.alphavantage.co',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 5,
            requestsPerDay: 500,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 75,
            requestsPerMonth: 75000,
            costPerRequest: 0.01
          }
        },
        endpoints: {
          '/query': { weight: 1, cacheable: true, ttl: 60 }
        },
        rateLimit: { requests: 5, window: 60 },
        alternatives: ['TwelveData', 'Yahoo Finance']
      },

      'ExchangeRate-API': {
        name: 'ExchangeRate-API',
        category: 'Forex',
        baseURL: 'https://open.exchangerate-api.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMonth: 1500,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMonth: 100000,
            costPerRequest: 0.00001
          }
        },
        endpoints: {
          '/v6/latest/{base}': { weight: 1, cacheable: true, ttl: 3600 }
        },
        rateLimit: { requests: 1500, window: 2592000 },
        alternatives: ['Frankfurter', 'FloatRates']
      },

      'Frankfurter': {
        name: 'Frankfurter',
        category: 'Forex',
        baseURL: 'https://api.frankfurter.app',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMonth: 100000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/latest': { weight: 1, cacheable: true, ttl: 3600 },
          '/{date}': { weight: 1, cacheable: true, ttl: 86400 }
        },
        rateLimit: { requests: 1000, window: 60 },
        alternatives: ['ExchangeRate-API', 'FloatRates']
      },

      'FloatRates': {
        name: 'FloatRates',
        category: 'Forex',
        baseURL: 'https://www.floatrates.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerDay: 1000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/daily/{currency}.json': { weight: 1, cacheable: true, ttl: 3600 }
        },
        rateLimit: { requests: 1000, window: 86400 },
        alternatives: ['Frankfurter', 'ExchangeRate-API']
      },

      'VATComply': {
        name: 'VATComply',
        category: 'Forex',
        baseURL: 'https://api.vatcomply.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMonth: 100000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/rates': { weight: 1, cacheable: true, ttl: 3600 }
        },
        rateLimit: { requests: 1000, window: 60 },
        alternatives: ['Frankfurter', 'ExchangeRate-API']
      },

      'CurrencyFreaks': {
        name: 'CurrencyFreaks',
        category: 'Forex',
        baseURL: 'https://api.currencyfreaks.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMonth: 1000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMonth: 100000,
            costPerRequest: 0.0001
          }
        },
        endpoints: {
          '/latest': { weight: 1, cacheable: true, ttl: 3600 }
        },
        rateLimit: { requests: 1000, window: 2592000 },
        alternatives: ['Frankfurter', 'ExchangeRate-API']
      },

      'TRON Network': {
        name: 'TRON Network',
        category: 'Blockchain',
        baseURL: 'https://api.trongrid.io',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerSecond: 10,
            requestsPerMonth: 1000000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/wallet/getaccount': { weight: 1, cacheable: false, ttl: 0 },
          '/wallet/gettransactionbyid': { weight: 1, cacheable: true, ttl: 300 }
        },
        rateLimit: { requests: 10, window: 1 },
        alternatives: []
      },

      'Etherscan': {
        name: 'Etherscan',
        category: 'Blockchain',
        baseURL: 'https://api.etherscan.io',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerSecond: 5,
            requestsPerMonth: 100000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerSecond: 100,
            requestsPerMonth: 10000000,
            costPerRequest: 0.00001
          }
        },
        endpoints: {
          '/api': { weight: 1, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 5, window: 1 },
        alternatives: ['Alchemy', 'Infura']
      },

      'BscScan': {
        name: 'BscScan',
        category: 'Blockchain',
        baseURL: 'https://api.bscscan.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerSecond: 5,
            requestsPerMonth: 100000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerSecond: 100,
            requestsPerMonth: 10000000,
            costPerRequest: 0.00001
          }
        },
        endpoints: {
          '/api': { weight: 1, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 5, window: 1 },
        alternatives: []
      },

      'Groq API': {
        name: 'Groq API',
        category: 'AI',
        baseURL: 'https://api.groq.com',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 30,
            requestsPerDay: 14400,
            tokensPerMinute: 6000,
            costPerRequest: 0,
            costPer1MInputTokens: 0,
            costPer1MOutputTokens: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 1000,
            tokensPerMinute: 1000000,
            costPer1MInputTokens: 0.1,
            costPer1MOutputTokens: 0.1
          }
        },
        endpoints: {
          '/openai/v1/chat/completions': { weight: 10, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 30, window: 60 },
        alternatives: ['OpenAI', 'Anthropic']
      },

      'Telegram Bot API': {
        name: 'Telegram Bot API',
        category: 'Messaging',
        baseURL: 'https://api.telegram.org',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerSecond: 30,
            requestsPerMinute: 3000,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/bot{token}/sendMessage': { weight: 1, cacheable: false, ttl: 0 },
          '/bot{token}/sendPhoto': { weight: 2, cacheable: false, ttl: 0 },
          '/bot{token}/editMessageText': { weight: 1, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 30, window: 1 },
        alternatives: []
      },

      'CryptAPI': {
        name: 'CryptAPI',
        category: 'Payment',
        baseURL: 'https://api.cryptapi.io',
        pricing: {
          freeTier: {
            enabled: false
          },
          paidTier: {
            enabled: true,
            feePercentage: 1,
            costPerRequest: 0
          }
        },
        endpoints: {
          '/{coin}/create/': { weight: 1, cacheable: false, ttl: 0 },
          '/{coin}/logs/': { weight: 1, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 100, window: 60 },
        alternatives: []
      },

      'Whale Alert': {
        name: 'Whale Alert',
        category: 'Analytics',
        baseURL: 'https://api.whale-alert.io',
        pricing: {
          freeTier: {
            enabled: true,
            requestsPerMinute: 10,
            requestsPerMonth: 1000,
            costPerRequest: 0
          },
          paidTier: {
            enabled: false,
            requestsPerMinute: 60,
            requestsPerMonth: 100000,
            costPerRequest: 0.001
          }
        },
        endpoints: {
          '/v1/transactions': { weight: 1, cacheable: false, ttl: 0 }
        },
        rateLimit: { requests: 10, window: 60 },
        alternatives: []
      }
    };
  }

  setupRedisHandlers() {
    this.redis.on('connect', () => {
      this.redisAvailable = true;
      logger.info('✅ Redis connected for API cost tracking');
    });

    this.redis.on('error', (err) => {
      this.redisAvailable = false;
      logError(logger, err, { context: 'Redis connection error' });
    });

    this.redis.on('close', () => {
      this.redisAvailable = false;
      logger.warn('⚠️ Redis connection closed');
    });
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupOldMemoryData();
    }, 3600000);
  }

  cleanupOldMemoryData() {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;

    for (const [key, value] of this.inMemoryStats.hourly.entries()) {
      if (value.timestamp < hourAgo) {
        this.inMemoryStats.hourly.delete(key);
      }
    }

    for (const [key, value] of this.inMemoryStats.daily.entries()) {
      if (value.timestamp < dayAgo) {
        this.inMemoryStats.daily.delete(key);
      }
    }

    logger.debug('🧹 Cleaned up old memory data');
  }

  calculateCost(apiName, endpoint, metadata = {}) {
    const api = this.apiRegistry[apiName];
    if (!api) {
      logger.warn(`⚠️ Unknown API: ${apiName}`);
      return 0;
    }

    const pricing = api.pricing.freeTier.enabled ? api.pricing.freeTier : api.pricing.paidTier;
    
    let cost = pricing.costPerRequest || 0;

    if (apiName === 'Groq API' && metadata.tokens) {
      const inputCost = (metadata.tokens.input / 1000000) * (pricing.costPer1MInputTokens || 0);
      const outputCost = (metadata.tokens.output / 1000000) * (pricing.costPer1MOutputTokens || 0);
      cost = inputCost + outputCost;
    }

    if (apiName === 'CryptAPI' && metadata.amount) {
      cost = (metadata.amount * (pricing.feePercentage / 100));
    }

    return cost;
  }

  async trackAPICall(apiName, endpoint, options = {}) {
    const {
      status = 'success',
      responseTime = 0,
      userId = null,
      cacheHit = false,
      dataSize = 0,
      metadata = {}
    } = options;

    const timestamp = Date.now();
    const cost = this.calculateCost(apiName, endpoint, metadata);

    const callData = {
      apiName,
      endpoint,
      status,
      responseTime,
      userId,
      cacheHit,
      dataSize,
      cost,
      timestamp,
      metadata
    };

    await this.updateInMemoryStats(callData);

    if (this.redisAvailable) {
      await this.updateRedisStats(callData);
    }

    if (this.alerts.enabled) {
      await this.checkAlerts(callData);
    }

    logger.debug('📊 API call tracked', {
      api: apiName,
      endpoint,
      cost: `$${cost.toFixed(6)}`,
      responseTime: `${responseTime}ms`,
      cacheHit
    });

    return callData;
  }

  async updateInMemoryStats(callData) {
    const hour = new Date(callData.timestamp).setMinutes(0, 0, 0);
    const day = new Date(callData.timestamp).setHours(0, 0, 0, 0);

    if (!this.inMemoryStats.hourly.has(hour)) {
      this.inMemoryStats.hourly.set(hour, {
        timestamp: hour,
        calls: 0,
        cost: 0,
        errors: 0,
        cacheHits: 0,
        totalResponseTime: 0
      });
    }
    const hourStats = this.inMemoryStats.hourly.get(hour);
    hourStats.calls++;
    hourStats.cost += callData.cost;
    if (callData.status === 'error') hourStats.errors++;
    if (callData.cacheHit) hourStats.cacheHits++;
    hourStats.totalResponseTime += callData.responseTime;

    if (!this.inMemoryStats.daily.has(day)) {
      this.inMemoryStats.daily.set(day, {
        timestamp: day,
        calls: 0,
        cost: 0,
        errors: 0,
        cacheHits: 0,
        totalResponseTime: 0
      });
    }
    const dayStats = this.inMemoryStats.daily.get(day);
    dayStats.calls++;
    dayStats.cost += callData.cost;
    if (callData.status === 'error') dayStats.errors++;
    if (callData.cacheHit) dayStats.cacheHits++;
    dayStats.totalResponseTime += callData.responseTime;

    if (!this.inMemoryStats.byAPI.has(callData.apiName)) {
      this.inMemoryStats.byAPI.set(callData.apiName, {
        calls: 0,
        cost: 0,
        errors: 0,
        cacheHits: 0,
        totalResponseTime: 0
      });
    }
    const apiStats = this.inMemoryStats.byAPI.get(callData.apiName);
    apiStats.calls++;
    apiStats.cost += callData.cost;
    if (callData.status === 'error') apiStats.errors++;
    if (callData.cacheHit) apiStats.cacheHits++;
    apiStats.totalResponseTime += callData.responseTime;

    const endpointKey = `${callData.apiName}:${callData.endpoint}`;
    if (!this.inMemoryStats.byEndpoint.has(endpointKey)) {
      this.inMemoryStats.byEndpoint.set(endpointKey, {
        calls: 0,
        cost: 0,
        errors: 0,
        cacheHits: 0,
        totalResponseTime: 0
      });
    }
    const endpointStats = this.inMemoryStats.byEndpoint.get(endpointKey);
    endpointStats.calls++;
    endpointStats.cost += callData.cost;
    if (callData.status === 'error') endpointStats.errors++;
    if (callData.cacheHit) endpointStats.cacheHits++;
    endpointStats.totalResponseTime += callData.responseTime;

    if (callData.userId) {
      if (!this.inMemoryStats.byUser.has(callData.userId)) {
        this.inMemoryStats.byUser.set(callData.userId, {
          calls: 0,
          cost: 0,
          errors: 0
        });
      }
      const userStats = this.inMemoryStats.byUser.get(callData.userId);
      userStats.calls++;
      userStats.cost += callData.cost;
      if (callData.status === 'error') userStats.errors++;
    }
  }

  async updateRedisStats(callData) {
    try {
      const hour = new Date(callData.timestamp).setMinutes(0, 0, 0);
      const day = new Date(callData.timestamp).setHours(0, 0, 0, 0);
      const month = new Date(callData.timestamp).setDate(1);
      month = new Date(month).setHours(0, 0, 0, 0);

      const pipeline = this.redis.pipeline();

      pipeline.hincrby(`hour:${hour}`, 'calls', 1);
      pipeline.hincrbyfloat(`hour:${hour}`, 'cost', callData.cost);
      if (callData.status === 'error') pipeline.hincrby(`hour:${hour}`, 'errors', 1);
      if (callData.cacheHit) pipeline.hincrby(`hour:${hour}`, 'cacheHits', 1);
      pipeline.hincrby(`hour:${hour}`, 'totalResponseTime', callData.responseTime);
      pipeline.expire(`hour:${hour}`, 172800);

      pipeline.hincrby(`day:${day}`, 'calls', 1);
      pipeline.hincrbyfloat(`day:${day}`, 'cost', callData.cost);
      if (callData.status === 'error') pipeline.hincrby(`day:${day}`, 'errors', 1);
      if (callData.cacheHit) pipeline.hincrby(`day:${day}`, 'cacheHits', 1);
      pipeline.hincrby(`day:${day}`, 'totalResponseTime', callData.responseTime);
      pipeline.expire(`day:${day}`, 2592000);

      pipeline.hincrby(`month:${month}`, 'calls', 1);
      pipeline.hincrbyfloat(`month:${month}`, 'cost', callData.cost);
      if (callData.status === 'error') pipeline.hincrby(`month:${month}`, 'errors', 1);
      if (callData.cacheHit) pipeline.hincrby(`month:${month}`, 'cacheHits', 1);
      pipeline.expire(`month:${month}`, 7776000);

      pipeline.hincrby(`api:${callData.apiName}`, 'calls', 1);
      pipeline.hincrbyfloat(`api:${callData.apiName}`, 'cost', callData.cost);
      if (callData.status === 'error') pipeline.hincrby(`api:${callData.apiName}`, 'errors', 1);
      if (callData.cacheHit) pipeline.hincrby(`api:${callData.apiName}`, 'cacheHits', 1);

      const endpointKey = `${callData.apiName}:${callData.endpoint}`;
      pipeline.hincrby(`endpoint:${endpointKey}`, 'calls', 1);
      pipeline.hincrbyfloat(`endpoint:${endpointKey}`, 'cost', callData.cost);
      if (callData.status === 'error') pipeline.hincrby(`endpoint:${endpointKey}`, 'errors', 1);
      if (callData.cacheHit) pipeline.hincrby(`endpoint:${endpointKey}`, 'cacheHits', 1);

      if (callData.userId) {
        pipeline.hincrby(`user:${callData.userId}`, 'calls', 1);
        pipeline.hincrbyfloat(`user:${callData.userId}`, 'cost', callData.cost);
        if (callData.status === 'error') pipeline.hincrby(`user:${callData.userId}`, 'errors', 1);
      }

      await pipeline.exec();
    } catch (error) {
      logError(logger, error, { context: 'updateRedisStats' });
    }
  }

  async checkAlerts(callData) {
    try {
      const hour = new Date(callData.timestamp).setMinutes(0, 0, 0);
      const day = new Date(callData.timestamp).setHours(0, 0, 0, 0);

      const hourStats = this.inMemoryStats.hourly.get(hour);
      if (hourStats && hourStats.cost > this.alerts.hourlyBudget) {
        logger.warn('⚠️ ALERT: Hourly budget exceeded!', {
          current: `$${hourStats.cost.toFixed(2)}`,
          limit: `$${this.alerts.hourlyBudget}`
        });
      }

      const dayStats = this.inMemoryStats.daily.get(day);
      if (dayStats && dayStats.cost > this.alerts.dailyBudget) {
        logger.warn('⚠️ ALERT: Daily budget exceeded!', {
          current: `$${dayStats.cost.toFixed(2)}`,
          limit: `$${this.alerts.dailyBudget}`
        });
      }

      const apiStats = this.inMemoryStats.byAPI.get(callData.apiName);
      if (apiStats && apiStats.cost > this.alerts.perAPILimit) {
        logger.warn('⚠️ ALERT: Per-API budget exceeded!', {
          api: callData.apiName,
          current: `$${apiStats.cost.toFixed(2)}`,
          limit: `$${this.alerts.perAPILimit}`
        });
      }
    } catch (error) {
      logError(logger, error, { context: 'checkAlerts' });
    }
  }

  async wrapAPICall(apiName, endpoint, fn, options = {}) {
    const timer = createTimer();
    const { userId = null, metadata = {} } = options;

    try {
      const result = await fn();
      const elapsed = timer.elapsed();

      await this.trackAPICall(apiName, endpoint, {
        status: 'success',
        responseTime: elapsed,
        userId,
        cacheHit: false,
        metadata
      });

      return result;
    } catch (error) {
      const elapsed = timer.elapsed();

      await this.trackAPICall(apiName, endpoint, {
        status: 'error',
        responseTime: elapsed,
        userId,
        cacheHit: false,
        metadata
      });

      throw error;
    }
  }

  async getCostStats(period = 'today') {
    const now = Date.now();
    let startTime, endTime;

    switch (period) {
      case 'hour':
        startTime = new Date(now).setMinutes(0, 0, 0);
        endTime = now;
        break;
      case 'today':
        startTime = new Date(now).setHours(0, 0, 0, 0);
        endTime = now;
        break;
      case 'week':
        startTime = now - (7 * 86400000);
        endTime = now;
        break;
      case 'month':
        startTime = new Date(now).setDate(1);
        startTime = new Date(startTime).setHours(0, 0, 0, 0);
        endTime = now;
        break;
      default:
        startTime = new Date(now).setHours(0, 0, 0, 0);
        endTime = now;
    }

    const stats = {
      period,
      startTime,
      endTime,
      totalCalls: 0,
      totalCost: 0,
      totalErrors: 0,
      totalCacheHits: 0,
      avgResponseTime: 0,
      cacheHitRate: 0
    };

    if (period === 'hour') {
      const hourStats = this.inMemoryStats.hourly.get(startTime);
      if (hourStats) {
        stats.totalCalls = hourStats.calls;
        stats.totalCost = hourStats.cost;
        stats.totalErrors = hourStats.errors;
        stats.totalCacheHits = hourStats.cacheHits;
        stats.avgResponseTime = hourStats.calls > 0 ? hourStats.totalResponseTime / hourStats.calls : 0;
        stats.cacheHitRate = hourStats.calls > 0 ? (hourStats.cacheHits / hourStats.calls) * 100 : 0;
      }
    } else if (period === 'today') {
      const dayStats = this.inMemoryStats.daily.get(startTime);
      if (dayStats) {
        stats.totalCalls = dayStats.calls;
        stats.totalCost = dayStats.cost;
        stats.totalErrors = dayStats.errors;
        stats.totalCacheHits = dayStats.cacheHits;
        stats.avgResponseTime = dayStats.calls > 0 ? dayStats.totalResponseTime / dayStats.calls : 0;
        stats.cacheHitRate = dayStats.calls > 0 ? (dayStats.cacheHits / dayStats.calls) * 100 : 0;
      }
    } else {
      for (const [timestamp, data] of this.inMemoryStats.hourly.entries()) {
        if (timestamp >= startTime && timestamp <= endTime) {
          stats.totalCalls += data.calls;
          stats.totalCost += data.cost;
          stats.totalErrors += data.errors;
          stats.totalCacheHits += data.cacheHits;
          stats.avgResponseTime += data.totalResponseTime;
        }
      }
      stats.avgResponseTime = stats.totalCalls > 0 ? stats.avgResponseTime / stats.totalCalls : 0;
      stats.cacheHitRate = stats.totalCalls > 0 ? (stats.totalCacheHits / stats.totalCalls) * 100 : 0;
    }

    return stats;
  }

  async getAPIBreakdown() {
    const breakdown = [];

    for (const [apiName, stats] of this.inMemoryStats.byAPI.entries()) {
      const api = this.apiRegistry[apiName];
      breakdown.push({
        apiName,
        category: api?.category || 'Unknown',
        calls: stats.calls,
        cost: stats.cost,
        errors: stats.errors,
        errorRate: stats.calls > 0 ? (stats.errors / stats.calls) * 100 : 0,
        cacheHits: stats.cacheHits,
        cacheHitRate: stats.calls > 0 ? (stats.cacheHits / stats.calls) * 100 : 0,
        avgResponseTime: stats.calls > 0 ? stats.totalResponseTime / stats.calls : 0,
        pricing: api?.pricing || {}
      });
    }

    breakdown.sort((a, b) => b.cost - a.cost);

    return breakdown;
  }

  async getOptimizationSuggestions() {
    const suggestions = [];
    const breakdown = await this.getAPIBreakdown();

    for (const api of breakdown) {
      const apiInfo = this.apiRegistry[api.apiName];
      if (!apiInfo) continue;

      if (api.cacheHitRate < 50 && apiInfo.endpoints) {
        const cacheableEndpoints = Object.values(apiInfo.endpoints).filter(e => e.cacheable);
        if (cacheableEndpoints.length > 0) {
          suggestions.push({
            type: 'caching',
            priority: 'high',
            apiName: api.apiName,
            message: `Low cache hit rate (${api.cacheHitRate.toFixed(1)}%). Consider increasing cache TTL for this API.`,
            potentialSavings: api.cost * 0.5,
            action: `Increase cache TTL from ${cacheableEndpoints[0].ttl}s to ${cacheableEndpoints[0].ttl * 2}s`
          });
        }
      }

      if (api.cost > 10 && apiInfo.alternatives && apiInfo.alternatives.length > 0) {
        suggestions.push({
          type: 'alternative',
          priority: 'medium',
          apiName: api.apiName,
          message: `High cost API. Consider using alternatives: ${apiInfo.alternatives.join(', ')}`,
          potentialSavings: api.cost * 0.3,
          alternatives: apiInfo.alternatives
        });
      }

      if (api.errorRate > 10) {
        suggestions.push({
          type: 'reliability',
          priority: 'high',
          apiName: api.apiName,
          message: `High error rate (${api.errorRate.toFixed(1)}%). Consider implementing circuit breaker or fallback.`,
          potentialSavings: 0,
          action: 'Implement circuit breaker pattern'
        });
      }

      if (api.avgResponseTime > 5000) {
        suggestions.push({
          type: 'performance',
          priority: 'medium',
          apiName: api.apiName,
          message: `Slow response time (${api.avgResponseTime.toFixed(0)}ms). Consider implementing request timeout or using faster alternative.`,
          potentialSavings: 0,
          action: 'Set timeout to 3000ms or use faster API'
        });
      }

      const freeTier = apiInfo.pricing?.freeTier;
      if (freeTier && !freeTier.enabled && apiInfo.pricing?.paidTier) {
        const monthlyEstimate = api.calls * 30;
        const monthlyQuota = freeTier.requestsPerMonth || freeTier.requestsPerDay * 30 || 0;
        
        if (monthlyEstimate < monthlyQuota * 0.5) {
          suggestions.push({
            type: 'pricing',
            priority: 'low',
            apiName: api.apiName,
            message: `Currently using paid tier but usage (${monthlyEstimate} req/month) is well below free tier limit (${monthlyQuota} req/month)`,
            potentialSavings: api.cost,
            action: 'Switch to free tier'
          });
        }
      }
    }

    const endpointStats = Array.from(this.inMemoryStats.byEndpoint.entries());
    const duplicateGroups = new Map();
    
    for (const [key, stats] of endpointStats) {
      const [apiName, endpoint] = key.split(':');
      const groupKey = `${apiName}:similar`;
      
      if (!duplicateGroups.has(groupKey)) {
        duplicateGroups.set(groupKey, []);
      }
      duplicateGroups.get(groupKey).push({ endpoint, stats });
    }

    for (const [groupKey, endpoints] of duplicateGroups.entries()) {
      if (endpoints.length > 3) {
        const totalCalls = endpoints.reduce((sum, e) => sum + e.stats.calls, 0);
        const totalCost = endpoints.reduce((sum, e) => sum + e.stats.cost, 0);
        
        if (totalCalls > 1000) {
          suggestions.push({
            type: 'batching',
            priority: 'medium',
            apiName: groupKey.split(':')[0],
            message: `Multiple similar endpoints called frequently (${totalCalls} calls). Consider implementing batch requests.`,
            potentialSavings: totalCost * 0.4,
            action: 'Implement batch request pattern'
          });
        }
      }
    }

    suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

    return suggestions;
  }

  async setAlerts(thresholds) {
    if (thresholds.hourlyBudget !== undefined) {
      this.alerts.hourlyBudget = thresholds.hourlyBudget;
    }
    if (thresholds.dailyBudget !== undefined) {
      this.alerts.dailyBudget = thresholds.dailyBudget;
    }
    if (thresholds.monthlyBudget !== undefined) {
      this.alerts.monthlyBudget = thresholds.monthlyBudget;
    }
    if (thresholds.perAPILimit !== undefined) {
      this.alerts.perAPILimit = thresholds.perAPILimit;
    }
    if (thresholds.enabled !== undefined) {
      this.alerts.enabled = thresholds.enabled;
    }

    logger.info('✅ Alert thresholds updated', this.alerts);

    return this.alerts;
  }

  async exportReport(format = 'json', period = 'today') {
    const stats = await this.getCostStats(period);
    const breakdown = await this.getAPIBreakdown();
    const suggestions = await this.getOptimizationSuggestions();

    const report = {
      generatedAt: new Date().toISOString(),
      period,
      summary: stats,
      apiBreakdown: breakdown,
      optimizationSuggestions: suggestions,
      topAPIs: breakdown.slice(0, 10),
      totalAPIs: breakdown.length,
      alerts: this.alerts
    };

    if (format === 'csv') {
      let csv = 'API Name,Category,Calls,Cost,Errors,Error Rate,Cache Hits,Cache Hit Rate,Avg Response Time\n';
      for (const api of breakdown) {
        csv += `${api.apiName},${api.category},${api.calls},${api.cost.toFixed(6)},${api.errors},${api.errorRate.toFixed(2)}%,${api.cacheHits},${api.cacheHitRate.toFixed(2)}%,${api.avgResponseTime.toFixed(0)}ms\n`;
      }
      return csv;
    }

    return report;
  }

  async getDashboardData() {
    const hourStats = await this.getCostStats('hour');
    const todayStats = await this.getCostStats('today');
    const weekStats = await this.getCostStats('week');
    const monthStats = await this.getCostStats('month');
    const breakdown = await this.getAPIBreakdown();
    const suggestions = await this.getOptimizationSuggestions();

    const topExpensiveAPIs = breakdown
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const topCallsAPIs = breakdown
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    const categoryBreakdown = {};
    for (const api of breakdown) {
      if (!categoryBreakdown[api.category]) {
        categoryBreakdown[api.category] = {
          calls: 0,
          cost: 0,
          errors: 0
        };
      }
      categoryBreakdown[api.category].calls += api.calls;
      categoryBreakdown[api.category].cost += api.cost;
      categoryBreakdown[api.category].errors += api.errors;
    }

    const hourlyTrend = [];
    const sortedHours = Array.from(this.inMemoryStats.hourly.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-24);
    
    for (const [timestamp, data] of sortedHours) {
      hourlyTrend.push({
        timestamp,
        hour: new Date(timestamp).getHours(),
        calls: data.calls,
        cost: data.cost,
        errors: data.errors,
        cacheHits: data.cacheHits
      });
    }

    const totalCostSavings = todayStats.totalCacheHits * 0.0001;

    return {
      timestamp: Date.now(),
      periods: {
        hour: hourStats,
        today: todayStats,
        week: weekStats,
        month: monthStats
      },
      breakdown: {
        byAPI: topExpensiveAPIs,
        byCategory: categoryBreakdown,
        topCalls: topCallsAPIs
      },
      trends: {
        hourly: hourlyTrend
      },
      optimization: {
        suggestions,
        totalSuggestions: suggestions.length,
        potentialSavings: suggestions.reduce((sum, s) => sum + (s.potentialSavings || 0), 0),
        cacheSavings: totalCostSavings
      },
      alerts: this.alerts,
      registry: {
        totalAPIs: Object.keys(this.apiRegistry).length,
        byCategory: Object.values(this.apiRegistry).reduce((acc, api) => {
          acc[api.category] = (acc[api.category] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }

  getAPIRegistry() {
    return this.apiRegistry;
  }

  async close() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('🔌 API Cost Tracker Redis connection closed');
    }
  }
}

const apiCostTracker = new APICostTracker();

module.exports = {
  apiCostTracker,
  trackAPICall: (apiName, endpoint, options) => apiCostTracker.trackAPICall(apiName, endpoint, options),
  wrapAPICall: (apiName, endpoint, fn, options) => apiCostTracker.wrapAPICall(apiName, endpoint, fn, options),
  getCostStats: (period) => apiCostTracker.getCostStats(period),
  getAPIBreakdown: () => apiCostTracker.getAPIBreakdown(),
  getOptimizationSuggestions: () => apiCostTracker.getOptimizationSuggestions(),
  setAlerts: (thresholds) => apiCostTracker.setAlerts(thresholds),
  exportReport: (format, period) => apiCostTracker.exportReport(format, period),
  getDashboardData: () => apiCostTracker.getDashboardData(),
  getAPIRegistry: () => apiCostTracker.getAPIRegistry()
};
