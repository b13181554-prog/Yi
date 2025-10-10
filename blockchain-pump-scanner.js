const axios = require('axios');

class BlockchainPumpScanner {
  constructor() {
    this.minLiquidity = 50000;
    this.minVolumeIncrease = 200;
    this.cache = new Map();
    this.cacheDuration = 300000;
  }

  async scanDexScreenerTrending() {
    try {
      console.log('🔍 Scanning DexScreener for trending tokens...');
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/trending', {
        timeout: 15000
      });

      if (response.data && Array.isArray(response.data)) {
        const trendingTokens = response.data.slice(0, 20).map(token => ({
          address: token.tokenAddress,
          symbol: token.symbol || 'N/A',
          name: token.name || 'N/A',
          priceUsd: parseFloat(token.priceUsd || 0),
          priceChange24h: parseFloat(token.priceChange?.h24 || 0),
          volume24h: parseFloat(token.volume?.h24 || 0),
          liquidity: parseFloat(token.liquidity?.usd || 0),
          source: 'dexscreener_trending'
        }));

        console.log(`✅ Found ${trendingTokens.length} trending tokens from DexScreener`);
        return trendingTokens;
      }
      return [];
    } catch (error) {
      console.error('❌ DexScreener trending error:', error.message);
      return [];
    }
  }

  async scanDexScreenerNewPairs() {
    try {
      console.log('🔍 Scanning DexScreener for new pairs...');
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/new', {
        timeout: 15000
      });

      if (response.data && Array.isArray(response.data)) {
        const newPairs = response.data
          .filter(pair => {
            const liquidity = parseFloat(pair.liquidity?.usd || 0);
            const volume = parseFloat(pair.volume?.h24 || 0);
            return liquidity >= this.minLiquidity && volume > 0;
          })
          .slice(0, 15)
          .map(pair => ({
            address: pair.baseToken?.address,
            symbol: pair.baseToken?.symbol || 'N/A',
            name: pair.baseToken?.name || 'N/A',
            priceUsd: parseFloat(pair.priceUsd || 0),
            priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
            volume24h: parseFloat(pair.volume?.h24 || 0),
            liquidity: parseFloat(pair.liquidity?.usd || 0),
            pairAge: pair.pairCreatedAt,
            source: 'dexscreener_new'
          }));

        console.log(`✅ Found ${newPairs.length} new pairs from DexScreener`);
        return newPairs;
      }
      return [];
    } catch (error) {
      console.error('❌ DexScreener new pairs error:', error.message);
      return [];
    }
  }

  async scanGeckoTerminalTrending() {
    try {
      console.log('🔍 Scanning GeckoTerminal for trending pools...');
      const response = await axios.get('https://api.geckoterminal.com/api/v2/networks/trending_pools', {
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const pools = response.data.data.slice(0, 15).map(pool => {
          const attrs = pool.attributes;
          return {
            address: attrs.base_token_address || attrs.address,
            symbol: attrs.base_token_symbol || 'N/A',
            name: attrs.name || 'N/A',
            priceUsd: parseFloat(attrs.base_token_price_usd || 0),
            priceChange24h: parseFloat(attrs.price_change_percentage?.h24 || 0),
            volume24h: parseFloat(attrs.volume_usd?.h24 || 0),
            liquidity: parseFloat(attrs.reserve_in_usd || 0),
            source: 'geckoterminal_trending'
          };
        });

        console.log(`✅ Found ${pools.length} trending pools from GeckoTerminal`);
        return pools;
      }
      return [];
    } catch (error) {
      console.error('❌ GeckoTerminal error:', error.message);
      return [];
    }
  }

  async analyzePumpPotential(tokens) {
    const analyzedTokens = [];

    for (const token of tokens) {
      try {
        const score = this.calculatePumpScore(token);
        
        if (score.total >= 70) {
          analyzedTokens.push({
            ...token,
            pumpScore: score.total,
            scoreBreakdown: score.breakdown,
            recommendation: score.total >= 85 ? 'STRONG_BUY' : 
                          score.total >= 75 ? 'BUY' : 'WATCH',
            confidence: score.total >= 85 ? 'عالية جداً' : 
                       score.total >= 75 ? 'عالية' : 'متوسطة'
          });
        }
      } catch (error) {
        console.error(`Error analyzing token ${token.symbol}:`, error.message);
      }
    }

    analyzedTokens.sort((a, b) => b.pumpScore - a.pumpScore);
    return analyzedTokens;
  }

  calculatePumpScore(token) {
    const breakdown = {};
    let total = 0;

    const volumeScore = Math.min((token.volume24h / 1000000) * 20, 25);
    breakdown.volume = volumeScore;
    total += volumeScore;

    const liquidityScore = Math.min((token.liquidity / 100000) * 15, 20);
    breakdown.liquidity = liquidityScore;
    total += liquidityScore;

    const priceChangeScore = token.priceChange24h > 0 ? 
      Math.min(token.priceChange24h / 2, 25) : 0;
    breakdown.priceChange = priceChangeScore;
    total += priceChangeScore;

    if (token.source.includes('new')) {
      breakdown.newPair = 15;
      total += 15;
    } else if (token.source.includes('trending')) {
      breakdown.trending = 15;
      total += 15;
    }

    const ratioScore = token.volume24h > 0 && token.liquidity > 0 ?
      Math.min((token.volume24h / token.liquidity) * 10, 15) : 0;
    breakdown.volumeLiquidityRatio = ratioScore;
    total += ratioScore;

    return { total: Math.min(total, 100), breakdown };
  }

  async scanAllSources() {
    console.log('🚀 Starting comprehensive pump scan from blockchain APIs...');
    
    const allTokens = [];
    
    const [trending, newPairs, geckoTrending] = await Promise.allSettled([
      this.scanDexScreenerTrending(),
      this.scanDexScreenerNewPairs(),
      this.scanGeckoTerminalTrending()
    ]);

    if (trending.status === 'fulfilled') allTokens.push(...trending.value);
    if (newPairs.status === 'fulfilled') allTokens.push(...newPairs.value);
    if (geckoTrending.status === 'fulfilled') allTokens.push(...geckoTrending.value);

    const uniqueTokens = this.deduplicateTokens(allTokens);
    
    console.log(`📊 Total unique tokens found: ${uniqueTokens.length}`);
    
    const pumpOpportunities = await this.analyzePumpPotential(uniqueTokens);
    
    console.log(`🎯 Found ${pumpOpportunities.length} high-potential pump opportunities`);
    
    return pumpOpportunities;
  }

  deduplicateTokens(tokens) {
    const seen = new Set();
    const unique = [];

    for (const token of tokens) {
      const key = `${token.address || token.symbol}_${token.source}`;
      if (!seen.has(key) && token.symbol !== 'N/A') {
        seen.add(key);
        unique.push(token);
      }
    }

    return unique;
  }

  async getTopPumpOpportunities(limit = 10) {
    const cacheKey = 'top_pump_opportunities';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log('✅ Returning cached pump opportunities');
      return cached.data;
    }

    const opportunities = await this.scanAllSources();
    const top = opportunities.slice(0, limit);

    this.cache.set(cacheKey, {
      data: top,
      timestamp: Date.now()
    });

    return top;
  }

  formatPumpAlert(token) {
    return `
🚀 <b>فرصة Pump محتملة!</b>

💎 <b>العملة:</b> ${token.symbol} (${token.name})
📍 <b>العنوان:</b> <code>${token.address}</code>

📊 <b>التحليل:</b>
💵 السعر: $${token.priceUsd.toFixed(8)}
📈 التغير 24س: ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%
💰 الحجم 24س: $${(token.volume24h / 1000).toFixed(1)}K
🏦 السيولة: $${(token.liquidity / 1000).toFixed(1)}K

⭐ <b>النتيجة:</b> ${token.pumpScore.toFixed(0)}/100
🎯 <b>التوصية:</b> ${token.recommendation === 'STRONG_BUY' ? '🟢 شراء قوي' : 
                                token.recommendation === 'BUY' ? '🟢 شراء' : '👀 مراقبة'}
📊 <b>الثقة:</b> ${token.confidence}

🔍 <b>المصدر:</b> ${token.source.includes('trending') ? 'Trending' : token.source.includes('new') ? 'New Pair' : 'Other'}

⚠️ <b>تحذير:</b> هذه العملات عالية المخاطر. تداول بحذر!
    `.trim();
  }
}

module.exports = new BlockchainPumpScanner();
