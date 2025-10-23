/**
 * Smart Search Optimizer
 * نظام بحث ذكي محسّن مع تخزين مؤقت ذكي
 * 
 * Features:
 * - Intelligent caching with LRU
 * - Query optimization
 * - Parallel searches
 * - Search result ranking
 * - Fuzzy matching
 * - Auto-complete suggestions
 */

const { createLogger } = require('./centralized-logger');
const cacheManager = require('./cache-manager');
const LRU = require('lru-cache');

const logger = createLogger('smart-search');

class SmartSearchOptimizer {
  constructor() {
    this.searchCache = new LRU({
      max: 500,
      ttl: 1000 * 60 * 10,
      updateAgeOnGet: true,
      updateAgeOnHas: false
    });
    
    this.queryCache = new LRU({
      max: 1000,
      ttl: 1000 * 60 * 5
    });
    
    this.popularSearches = new Map();
    this.searchHistory = [];
    this.maxHistorySize = 10000;
  }

  async optimizeSearch(query, options = {}) {
    try {
      const startTime = Date.now();
      
      const normalizedQuery = this.normalizeQuery(query);
      const cacheKey = this.getCacheKey(normalizedQuery, options);
      
      const cached = this.searchCache.get(cacheKey);
      if (cached && !options.forceRefresh) {
        logger.debug({ query, cached: true }, '📦 Cache hit');
        this.recordSearchMetrics(normalizedQuery, Date.now() - startTime, true);
        return {
          success: true,
          results: cached.results,
          cached: true,
          query: normalizedQuery,
          suggestions: this.getSuggestions(normalizedQuery)
        };
      }

      const searchResults = await this.performSmartSearch(normalizedQuery, options);
      
      if (searchResults.success) {
        this.searchCache.set(cacheKey, searchResults);
        await this.cacheToRedis(cacheKey, searchResults);
      }
      
      this.recordSearchMetrics(normalizedQuery, Date.now() - startTime, false);
      
      return {
        ...searchResults,
        cached: false,
        query: normalizedQuery,
        suggestions: this.getSuggestions(normalizedQuery)
      };
    } catch (error) {
      logger.error({ err: error, query }, '❌ Search optimization error');
      throw error;
    }
  }

  normalizeQuery(query) {
    if (!query) return '';
    
    return query
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s/-]/g, '');
  }

  getCacheKey(query, options) {
    const optionsKey = JSON.stringify({
      markets: options.markets || [],
      limit: options.limit || 500,
      minConfidence: options.minConfidence || 0
    });
    
    return `search:${query}:${Buffer.from(optionsKey).toString('base64')}`;
  }

  async performSmartSearch(query, options = {}) {
    try {
      const {
        markets = ['crypto', 'forex', 'stocks'],
        limit = 500,
        parallel = true,
        minConfidence = 0.3
      } = options;

      const searchPromises = markets.map(market => 
        this.searchMarket(query, market, { limit: Math.ceil(limit / markets.length) })
      );

      let results;
      if (parallel) {
        results = await Promise.allSettled(searchPromises);
        results = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value)
          .flat();
      } else {
        results = [];
        for (const promise of searchPromises) {
          try {
            const result = await promise;
            results.push(...result);
          } catch (error) {
            logger.warn({ err: error, query }, 'Market search failed');
          }
        }
      }

      results = this.rankResults(query, results);
      
      results = results.filter(r => r.confidence >= minConfidence);
      
      results = results.slice(0, limit);

      return {
        success: true,
        results,
        total: results.length,
        markets_searched: markets,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error({ err: error, query }, '❌ Smart search failed');
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  async searchMarket(query, market, options = {}) {
    const results = [];
    
    try {
      const symbols = await this.getMarketSymbols(market);
      
      for (const symbol of symbols) {
        const match = this.calculateMatch(query, symbol);
        
        if (match.score > 0) {
          results.push({
            symbol: symbol.symbol,
            name: symbol.name || symbol.symbol,
            market,
            confidence: match.score,
            matchType: match.type,
            price: symbol.price || null
          });
        }
      }
      
      results.sort((a, b) => b.confidence - a.confidence);
      
      return results.slice(0, options.limit || 100);
    } catch (error) {
      logger.warn({ err: error, market, query }, 'Market search error');
      return [];
    }
  }

  async getMarketSymbols(market) {
    const cacheKey = `symbols:${market}`;
    const cached = await cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    let symbols = [];
    
    try {
      const marketData = require('./market-data');
      const forexService = require('./forex-service');
      
      if (market === 'crypto') {
        symbols = await marketData.getTopCryptos(1000);
        symbols = symbols.map(s => ({
          symbol: s.symbol,
          name: s.name,
          price: s.price
        }));
      } else if (market === 'forex') {
        symbols = await forexService.getForexPairs();
      } else if (market === 'stocks') {
        symbols = await forexService.getStockSymbols();
      }
      
      await cacheManager.set(cacheKey, symbols, 3600);
      
      return symbols;
    } catch (error) {
      logger.warn({ err: error, market }, 'Failed to get market symbols');
      return [];
    }
  }

  calculateMatch(query, symbol) {
    const symbolStr = (symbol.symbol || '').toUpperCase();
    const nameStr = (symbol.name || '').toUpperCase();
    const queryUpper = query.toUpperCase();

    if (symbolStr === queryUpper) {
      return { score: 1.0, type: 'exact' };
    }

    if (symbolStr.startsWith(queryUpper)) {
      return { score: 0.9, type: 'prefix' };
    }

    if (symbolStr.includes(queryUpper)) {
      return { score: 0.7, type: 'contains' };
    }

    if (nameStr && nameStr.includes(queryUpper)) {
      return { score: 0.6, type: 'name_match' };
    }

    const fuzzyScore = this.fuzzyMatch(queryUpper, symbolStr);
    if (fuzzyScore > 0.7) {
      return { score: fuzzyScore * 0.5, type: 'fuzzy' };
    }

    return { score: 0, type: 'none' };
  }

  fuzzyMatch(query, target) {
    if (!query || !target) return 0;
    
    const queryLen = query.length;
    const targetLen = target.length;
    
    if (queryLen > targetLen) return 0;

    let matches = 0;
    let queryIndex = 0;
    
    for (let i = 0; i < targetLen && queryIndex < queryLen; i++) {
      if (query[queryIndex] === target[i]) {
        matches++;
        queryIndex++;
      }
    }
    
    if (queryIndex !== queryLen) return 0;
    
    const distance = targetLen - queryLen;
    return Math.max(0, 1 - (distance / targetLen));
  }

  rankResults(query, results) {
    const queryLower = query.toLowerCase();
    
    return results.map(result => {
      let boost = 1.0;
      
      if (this.isPopularSearch(result.symbol)) {
        boost *= 1.2;
      }
      
      if (result.matchType === 'exact') {
        boost *= 1.5;
      } else if (result.matchType === 'prefix') {
        boost *= 1.3;
      }
      
      if (result.volume && result.volume > 1000000) {
        boost *= 1.1;
      }
      
      result.confidence = Math.min(1.0, result.confidence * boost);
      result.rank_boost = boost;
      
      return result;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  getSuggestions(query) {
    if (!query || query.length < 2) return [];
    
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    for (const [search, count] of this.popularSearches.entries()) {
      if (search.toLowerCase().startsWith(queryLower) && search !== query) {
        suggestions.push({
          query: search,
          popularity: count
        });
      }
    }
    
    suggestions.sort((a, b) => b.popularity - a.popularity);
    
    return suggestions.slice(0, 5).map(s => s.query);
  }

  isPopularSearch(symbol) {
    return this.popularSearches.has(symbol.toUpperCase());
  }

  recordSearchMetrics(query, duration, cached) {
    this.searchHistory.push({
      query,
      timestamp: Date.now(),
      duration,
      cached
    });
    
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory.shift();
    }
    
    const current = this.popularSearches.get(query) || 0;
    this.popularSearches.set(query, current + 1);
    
    logger.debug({ 
      query, 
      duration, 
      cached 
    }, '📊 Search metrics recorded');
  }

  async cacheToRedis(key, data) {
    try {
      await cacheManager.set(key, data, 600);
    } catch (error) {
      logger.debug({ err: error }, 'Redis cache failed (non-critical)');
    }
  }

  getAnalytics() {
    const now = Date.now();
    const last24h = this.searchHistory.filter(
      s => (now - s.timestamp) < 86400000
    );
    
    const cacheHitRate = last24h.length > 0 
      ? (last24h.filter(s => s.cached).length / last24h.length) * 100
      : 0;
    
    const avgDuration = last24h.length > 0
      ? last24h.reduce((sum, s) => sum + s.duration, 0) / last24h.length
      : 0;
    
    const topSearches = Array.from(this.popularSearches.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return {
      total_searches: this.searchHistory.length,
      searches_24h: last24h.length,
      cache_hit_rate: cacheHitRate.toFixed(2) + '%',
      avg_duration_ms: avgDuration.toFixed(2),
      cache_size: this.searchCache.size,
      top_searches: topSearches
    };
  }

  clearCache() {
    this.searchCache.clear();
    this.queryCache.clear();
    logger.info('🗑️ Search cache cleared');
  }

  async warmupCache(symbols = []) {
    logger.info({ count: symbols.length }, '🔥 Warming up search cache');
    
    for (const symbol of symbols) {
      try {
        await this.optimizeSearch(symbol, { limit: 10 });
      } catch (error) {
        logger.debug({ err: error, symbol }, 'Warmup failed for symbol');
      }
    }
    
    logger.info('✅ Cache warmup completed');
  }
}

const smartSearchOptimizer = new SmartSearchOptimizer();

module.exports = smartSearchOptimizer;
