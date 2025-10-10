const axios = require('axios');

class EnhancedPumpScanner {
  constructor() {
    this.minLiquidity = 10000; // $10K minimum - lower to catch more tokens
    this.minVolumeIncrease = 150; // 150% volume increase
    this.cache = new Map();
    this.cacheDuration = 180000; // 3 minutes cache
    this.apiSources = [
      'dexscreener',
      'geckoterminal',
      'dextools',
      'birdeye',
      'coinmarketcap'
    ];
  }

  // DexScreener - يتتبع جميع العملات من DEX
  async scanDexScreenerAll() {
    try {
      console.log('🔍 Scanning DexScreener for ALL tokens...');
      const endpoints = [
        'https://api.dexscreener.com/latest/dex/tokens/trending',
        'https://api.dexscreener.com/latest/dex/tokens/new',
        'https://api.dexscreener.com/latest/dex/search?q=volume'
      ];

      const results = await Promise.allSettled(
        endpoints.map(url => axios.get(url, { timeout: 15000 }))
      );

      const allTokens = [];
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data) {
          const data = Array.isArray(result.value.data) ? result.value.data : result.value.data.pairs || [];
          data.forEach(token => {
            if (token && (token.tokenAddress || token.baseToken?.address)) {
              allTokens.push({
                address: token.tokenAddress || token.baseToken?.address,
                symbol: token.symbol || token.baseToken?.symbol || 'N/A',
                name: token.name || token.baseToken?.name || 'N/A',
                priceUsd: parseFloat(token.priceUsd || 0),
                priceChange24h: parseFloat(token.priceChange?.h24 || token.priceChange24h || 0),
                priceChange1h: parseFloat(token.priceChange?.h1 || 0),
                volume24h: parseFloat(token.volume?.h24 || token.volume24h || 0),
                liquidity: parseFloat(token.liquidity?.usd || 0),
                chain: token.chainId || 'unknown',
                dexId: token.dexId || 'unknown',
                pairAddress: token.pairAddress || null,
                source: 'dexscreener'
              });
            }
          });
        }
      });

      console.log(`✅ DexScreener: Found ${allTokens.length} tokens`);
      return allTokens;
    } catch (error) {
      console.error('❌ DexScreener scan error:', error.message);
      return [];
    }
  }

  // GeckoTerminal - يتتبع العملات من جميع الشبكات
  async scanGeckoTerminalAll() {
    try {
      console.log('🔍 Scanning GeckoTerminal for ALL networks...');
      const networks = ['eth', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'base', 'solana'];
      const allPools = [];

      const results = await Promise.allSettled(
        networks.map(network => 
          axios.get(`https://api.geckoterminal.com/api/v2/networks/${network}/trending_pools`, {
            timeout: 15000
          })
        )
      );

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data?.data) {
          result.value.data.data.forEach(pool => {
            const attrs = pool.attributes;
            allPools.push({
              address: attrs.base_token_address || attrs.address,
              symbol: attrs.base_token_symbol || 'N/A',
              name: attrs.name || 'N/A',
              priceUsd: parseFloat(attrs.base_token_price_usd || 0),
              priceChange24h: parseFloat(attrs.price_change_percentage?.h24 || 0),
              priceChange1h: parseFloat(attrs.price_change_percentage?.h1 || 0),
              volume24h: parseFloat(attrs.volume_usd?.h24 || 0),
              liquidity: parseFloat(attrs.reserve_in_usd || 0),
              chain: pool.relationships?.network?.data?.id || 'unknown',
              source: 'geckoterminal'
            });
          });
        }
      });

      console.log(`✅ GeckoTerminal: Found ${allPools.length} pools`);
      return allPools;
    } catch (error) {
      console.error('❌ GeckoTerminal scan error:', error.message);
      return [];
    }
  }

  // Birdeye API - يتتبع عملات Solana
  async scanBirdeyeSolana() {
    try {
      console.log('🔍 Scanning Birdeye for Solana tokens...');
      const response = await axios.get('https://public-api.birdeye.so/public/tokenlist', {
        params: { sort_by: 'v24hUSD', sort_type: 'desc', offset: 0, limit: 50 },
        timeout: 15000
      });

      const tokens = [];
      if (response.data?.data?.tokens) {
        response.data.data.tokens.forEach(token => {
          tokens.push({
            address: token.address,
            symbol: token.symbol || 'N/A',
            name: token.name || 'N/A',
            priceUsd: parseFloat(token.price || 0),
            priceChange24h: parseFloat(token.priceChange24h || 0),
            volume24h: parseFloat(token.v24hUSD || 0),
            liquidity: parseFloat(token.liquidity || 0),
            chain: 'solana',
            source: 'birdeye'
          });
        });
      }

      console.log(`✅ Birdeye: Found ${tokens.length} Solana tokens`);
      return tokens;
    } catch (error) {
      console.error('❌ Birdeye scan error:', error.message);
      return [];
    }
  }

  // تحليل محتمل البامب لأي عملة
  calculatePumpScore(token) {
    const breakdown = {};
    let total = 0;

    // 1. Volume Score (0-30 points)
    const volumeScore = Math.min((token.volume24h / 500000) * 30, 30);
    breakdown.volume = parseFloat(volumeScore.toFixed(2));
    total += volumeScore;

    // 2. Liquidity Score (0-25 points)
    const liquidityScore = Math.min((token.liquidity / 50000) * 25, 25);
    breakdown.liquidity = parseFloat(liquidityScore.toFixed(2));
    total += liquidityScore;

    // 3. Price Change 24h (0-25 points)
    const priceChangeScore = token.priceChange24h > 0 ? 
      Math.min(token.priceChange24h / 4, 25) : 0;
    breakdown.priceChange24h = parseFloat(priceChangeScore.toFixed(2));
    total += priceChangeScore;

    // 4. Price Change 1h (0-10 points) - momentum قصير
    const priceChange1hScore = token.priceChange1h > 0 ? 
      Math.min(token.priceChange1h * 2, 10) : 0;
    breakdown.priceChange1h = parseFloat(priceChange1hScore.toFixed(2));
    total += priceChange1hScore;

    // 5. Volume/Liquidity Ratio (0-10 points) - نشاط عالي
    const ratioScore = token.volume24h > 0 && token.liquidity > 0 ?
      Math.min((token.volume24h / token.liquidity) * 5, 10) : 0;
    breakdown.volumeLiquidityRatio = parseFloat(ratioScore.toFixed(2));
    total += ratioScore;

    return { 
      total: parseFloat(Math.min(total, 100).toFixed(2)), 
      breakdown 
    };
  }

  // تحليل البامب المحتمل
  async analyzePumpOpportunities(tokens) {
    const opportunities = [];

    for (const token of tokens) {
      try {
        // تصفية العملات ذات السيولة المنخفضة جداً
        if (token.liquidity < this.minLiquidity) continue;
        if (token.symbol === 'N/A' || !token.address) continue;

        const score = this.calculatePumpScore(token);
        
        // فقط العملات ذات النتيجة العالية
        if (score.total >= 60) {
          opportunities.push({
            ...token,
            pumpScore: score.total,
            scoreBreakdown: score.breakdown,
            recommendation: score.total >= 85 ? 'STRONG_BUY' : 
                          score.total >= 75 ? 'BUY' : 'WATCH',
            confidence: score.total >= 85 ? 'عالية جداً' : 
                       score.total >= 75 ? 'عالية' : 'متوسطة',
            potentialGain: this.estimatePotentialGain(score.total)
          });
        }
      } catch (error) {
        console.error(`Error analyzing token ${token.symbol}:`, error.message);
      }
    }

    // ترتيب حسب النتيجة
    opportunities.sort((a, b) => b.pumpScore - a.pumpScore);
    return opportunities;
  }

  // تقدير الربح المحتمل
  estimatePotentialGain(score) {
    if (score >= 90) return '150-300%';
    if (score >= 80) return '100-200%';
    if (score >= 70) return '50-100%';
    return '30-50%';
  }

  // مسح شامل لجميع المصادر
  async scanAllSources() {
    console.log('🚀 Starting comprehensive pump scan from ALL blockchain sources...');
    
    const allTokens = [];
    
    const [dexScreener, geckoTerminal, birdeye] = await Promise.allSettled([
      this.scanDexScreenerAll(),
      this.scanGeckoTerminalAll(),
      this.scanBirdeyeSolana()
    ]);

    if (dexScreener.status === 'fulfilled') allTokens.push(...dexScreener.value);
    if (geckoTerminal.status === 'fulfilled') allTokens.push(...geckoTerminal.value);
    if (birdeye.status === 'fulfilled') allTokens.push(...birdeye.value);

    // إزالة التكرار
    const uniqueTokens = this.deduplicateTokens(allTokens);
    
    console.log(`📊 Total unique tokens scanned: ${uniqueTokens.length}`);
    
    // تحليل البامب المحتمل
    const pumpOpportunities = await this.analyzePumpOpportunities(uniqueTokens);
    
    console.log(`🎯 Found ${pumpOpportunities.length} high-potential pump opportunities`);
    
    return pumpOpportunities;
  }

  // إزالة التكرار
  deduplicateTokens(tokens) {
    const seen = new Map();
    const unique = [];

    for (const token of tokens) {
      const key = token.address?.toLowerCase();
      if (!seen.has(key) && key) {
        seen.set(key, true);
        unique.push(token);
      }
    }

    return unique;
  }

  // الحصول على أفضل فرص البامب
  async getTopPumpOpportunities(limit = 20) {
    const cacheKey = 'enhanced_pump_opportunities';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log('✅ Returning cached enhanced pump opportunities');
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

  // البحث عن عملة محددة
  async searchToken(query) {
    try {
      console.log(`🔍 Searching for token: ${query}`);
      
      // البحث في DexScreener
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
        timeout: 15000
      });

      const tokens = [];
      if (response.data?.pairs) {
        response.data.pairs.forEach(pair => {
          tokens.push({
            address: pair.baseToken?.address,
            symbol: pair.baseToken?.symbol || 'N/A',
            name: pair.baseToken?.name || 'N/A',
            priceUsd: parseFloat(pair.priceUsd || 0),
            priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
            priceChange1h: parseFloat(pair.priceChange?.h1 || 0),
            volume24h: parseFloat(pair.volume?.h24 || 0),
            liquidity: parseFloat(pair.liquidity?.usd || 0),
            chain: pair.chainId || 'unknown',
            dexId: pair.dexId || 'unknown',
            pairAddress: pair.pairAddress,
            source: 'dexscreener'
          });
        });
      }

      // تحليل البامب للعملات المعثور عليها
      const analyzed = await this.analyzePumpOpportunities(tokens);
      
      return analyzed;
    } catch (error) {
      console.error('❌ Token search error:', error.message);
      return [];
    }
  }

  // تنسيق تنبيه البامب
  formatPumpAlert(token) {
    return `
🚀 <b>فرصة Pump محتملة!</b>

💎 <b>العملة:</b> ${token.symbol} (${token.name})
📍 <b>العنوان:</b> <code>${token.address}</code>
🔗 <b>الشبكة:</b> ${token.chain}

📊 <b>التحليل:</b>
💵 السعر: $${token.priceUsd.toFixed(8)}
📈 التغير 24س: ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%
${token.priceChange1h ? `⚡ التغير 1س: ${token.priceChange1h >= 0 ? '+' : ''}${token.priceChange1h.toFixed(2)}%\n` : ''}💰 الحجم 24س: $${(token.volume24h / 1000).toFixed(1)}K
🏦 السيولة: $${(token.liquidity / 1000).toFixed(1)}K

⭐ <b>النتيجة:</b> ${token.pumpScore}/100
🎯 <b>التوصية:</b> ${token.recommendation === 'STRONG_BUY' ? '🟢 شراء قوي' : 
                                token.recommendation === 'BUY' ? '🟢 شراء' : '👀 مراقبة'}
📊 <b>الثقة:</b> ${token.confidence}
💰 <b>الربح المحتمل:</b> ${token.potentialGain}

🔍 <b>المصدر:</b> ${token.source}

⚠️ <b>تحذير:</b> هذه العملات عالية المخاطر. تداول بحذر!
    `.trim();
  }
}

module.exports = new EnhancedPumpScanner();
