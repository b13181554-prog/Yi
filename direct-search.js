const axios = require('axios');
const cacheManager = require('./cache-manager');

class DirectSearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 300000; // 5 دقائق
  }

  async searchCryptoFromOKX(query) {
    try {
      const cacheKey = `crypto_search:${query.toLowerCase()}`;
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`🔍 البحث في OKX عن: ${query}`);
      
      const response = await axios.get('https://www.okx.com/api/v5/public/instruments', {
        params: { instType: 'SPOT' },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const instruments = response.data.data;
        const searchLower = query.toLowerCase();
        
        const results = instruments
          .filter(inst => {
            if (!inst.instId || !inst.instId.endsWith('-USDT')) return false;
            
            const baseCcy = (inst.baseCcy || '').toLowerCase();
            const instId = (inst.instId || '').toLowerCase();
            
            return baseCcy.includes(searchLower) || 
                   instId.includes(searchLower) ||
                   baseCcy.startsWith(searchLower);
          })
          .map(inst => ({
            value: inst.instId.replace('-', ''),
            symbol: inst.instId.replace('-', ''),
            baseCcy: inst.baseCcy,
            quoteCcy: inst.quoteCcy,
            label: `${this.getCryptoEmoji(inst.baseCcy)} ${inst.baseCcy}`,
            market_type: 'crypto'
          }));

        await cacheManager.set(cacheKey, results, 300);
        console.log(`✅ تم العثور على ${results.length} عملة من OKX`);
        return results;
      }
      
      return [];
    } catch (error) {
      console.error('❌ خطأ في البحث في OKX:', error.message);
      return [];
    }
  }

  async searchStocksFromYahoo(query) {
    try {
      const cacheKey = `stocks_search:${query.toLowerCase()}`;
      const cached = await cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      console.log(`🔍 البحث في Yahoo Finance عن: ${query}`);
      
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search`;
      const response = await axios.get(searchUrl, {
        params: {
          q: query,
          quotesCount: 100,
          newsCount: 0,
          enableFuzzyQuery: false,
          quotesQueryId: 'tss_match_phrase_query',
          lang: 'en-US',
          region: 'US'
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data && response.data.quotes) {
        const results = response.data.quotes
          .filter(quote => 
            quote.quoteType === 'EQUITY' && 
            quote.symbol &&
            quote.exchange
          )
          .map(quote => ({
            value: quote.symbol,
            label: `📈 ${quote.shortname || quote.longname || quote.symbol}`,
            market: quote.exchange || 'Global',
            market_type: 'stocks'
          }));

        await cacheManager.set(cacheKey, results, 300);
        console.log(`✅ تم العثور على ${results.length} سهم من Yahoo`);
        return results;
      }
      
      return [];
    } catch (error) {
      console.error('❌ خطأ في البحث في Yahoo Finance:', error.message);
      return [];
    }
  }

  async searchForex(query) {
    const majorCurrencies = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];
    const minorCurrencies = ['NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR', 'MXN', 'SGD', 'HKD', 'THB', 'INR', 'CNY', 'KRW', 'BRL', 'RUB'];
    const allCurrencies = [...majorCurrencies, ...minorCurrencies];
    
    const flags = {
      'EUR': '🇪🇺', 'GBP': '🇬🇧', 'USD': '🇺🇸', 'JPY': '🇯🇵',
      'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CHF': '🇨🇭',
      'NOK': '🇳🇴', 'SEK': '🇸🇪', 'DKK': '🇩🇰', 'PLN': '🇵🇱',
      'TRY': '🇹🇷', 'ZAR': '🇿🇦', 'MXN': '🇲🇽', 'SGD': '🇸🇬',
      'HKD': '🇭🇰', 'THB': '🇹🇭', 'INR': '🇮🇳', 'CNY': '🇨🇳',
      'KRW': '🇰🇷', 'BRL': '🇧🇷', 'RUB': '🇷🇺'
    };

    const searchUpper = query.toUpperCase();
    const results = [];
    const validPairs = new Set();

    for (let i = 0; i < allCurrencies.length; i++) {
      for (let j = 0; j < allCurrencies.length; j++) {
        if (i !== j) {
          const base = allCurrencies[i];
          const quote = allCurrencies[j];
          const pair = base + quote;
          const reversePair = quote + base;
          
          if (!validPairs.has(reversePair) && 
              (pair.includes(searchUpper) || base.includes(searchUpper) || quote.includes(searchUpper))) {
            results.push({
              value: pair,
              label: `${flags[base] || '🌐'} ${base}/${quote} ${flags[quote] || '🌐'}`,
              market_type: 'forex'
            });
            validPairs.add(pair);
          }
        }
      }
    }

    return results;
  }

  getCommoditiesList() {
    return [
      { value: 'GC=F', label: '🥇 الذهب (Gold)', category: 'المعادن الثمينة' },
      { value: 'SI=F', label: '🥈 الفضة (Silver)', category: 'المعادن الثمينة' },
      { value: 'HG=F', label: '🟤 النحاس (Copper)', category: 'المعادن الصناعية' },
      { value: 'PL=F', label: '⚪ البلاتين (Platinum)', category: 'المعادن الثمينة' },
      { value: 'PA=F', label: '⚫ البلاديوم (Palladium)', category: 'المعادن الثمينة' },
      
      { value: 'CL=F', label: '🛢️ النفط الأمريكي (WTI)', category: 'الطاقة' },
      { value: 'BZ=F', label: '🛢️ النفط البريطاني (Brent)', category: 'الطاقة' },
      { value: 'NG=F', label: '🔥 الغاز الطبيعي (Natural Gas)', category: 'الطاقة' },
      { value: 'HO=F', label: '🔥 زيت التدفئة (Heating Oil)', category: 'الطاقة' },
      { value: 'RB=F', label: '⛽ البنزين (Gasoline)', category: 'الطاقة' },
      
      { value: 'ZC=F', label: '🌽 الذرة (Corn)', category: 'الزراعة' },
      { value: 'ZW=F', label: '🌾 القمح (Wheat)', category: 'الزراعة' },
      { value: 'ZS=F', label: '🫘 فول الصويا (Soybeans)', category: 'الزراعة' },
      { value: 'SB=F', label: '🍬 السكر (Sugar)', category: 'الزراعة' },
      { value: 'KC=F', label: '☕ القهوة (Coffee)', category: 'الزراعة' },
      { value: 'CC=F', label: '🍫 الكاكاو (Cocoa)', category: 'الزراعة' },
      { value: 'CT=F', label: '🧵 القطن (Cotton)', category: 'الزراعة' },
      
      { value: 'LE=F', label: '🐄 الماشية الحية (Live Cattle)', category: 'الماشية' },
      { value: 'HE=F', label: '🐷 الخنازير (Lean Hogs)', category: 'الماشية' }
    ].map(item => ({ ...item, market_type: 'commodities' }));
  }

  getIndicesList() {
    return [
      { value: '^DJI', label: '🇺🇸 داو جونز (Dow Jones)', region: 'USA' },
      { value: '^GSPC', label: '🇺🇸 S&P 500', region: 'USA' },
      { value: '^IXIC', label: '🇺🇸 ناسداك (Nasdaq)', region: 'USA' },
      { value: '^RUT', label: '🇺🇸 Russell 2000', region: 'USA' },
      { value: '^NYA', label: '🇺🇸 NYSE Composite', region: 'USA' },
      
      { value: '^FTSE', label: '🇬🇧 FTSE 100', region: 'UK' },
      { value: '^GDAXI', label: '🇩🇪 DAX 40', region: 'Germany' },
      { value: '^FCHI', label: '🇫🇷 CAC 40', region: 'France' },
      { value: '^IBEX', label: '🇪🇸 IBEX 35', region: 'Spain' },
      { value: 'FTSEMIB.MI', label: '🇮🇹 FTSE MIB', region: 'Italy' },
      { value: '^STOXX50E', label: '🇪🇺 Euro Stoxx 50', region: 'Europe' },
      
      { value: '^N225', label: '🇯🇵 Nikkei 225', region: 'Japan' },
      { value: '^HSI', label: '🇭🇰 Hang Seng', region: 'Hong Kong' },
      { value: '000001.SS', label: '🇨🇳 Shanghai Composite', region: 'China' },
      { value: '^AXJO', label: '🇦🇺 ASX 200', region: 'Australia' },
      { value: '^STI', label: '🇸🇬 STI', region: 'Singapore' },
      { value: '^KS11', label: '🇰🇷 KOSPI', region: 'South Korea' },
      { value: '^BSESN', label: '🇮🇳 BSE Sensex', region: 'India' },
      { value: '^NSEI', label: '🇮🇳 Nifty 50', region: 'India' },
      
      { value: '^VIX', label: '📊 VIX (مؤشر الخوف)', region: 'Volatility' }
    ].map(item => ({ ...item, market_type: 'indices' }));
  }

  async search(query, marketType = null) {
    try {
      const searchLower = query.toLowerCase().trim();
      
      let allResults = [];

      const searchPromises = [];

      if (!marketType || marketType === 'crypto') {
        searchPromises.push(this.searchCryptoFromOKX(searchLower));
      }

      if (!marketType || marketType === 'stocks') {
        searchPromises.push(this.searchStocksFromYahoo(searchLower));
      }

      if (!marketType || marketType === 'forex') {
        searchPromises.push(Promise.resolve(this.searchForex(searchLower)));
      }

      if (!marketType || marketType === 'commodities') {
        const commodities = this.getCommoditiesList();
        const commodityResults = commodities.filter(c => 
          c.value.toLowerCase().includes(searchLower) ||
          c.label.toLowerCase().includes(searchLower)
        );
        searchPromises.push(Promise.resolve(commodityResults));
      }

      if (!marketType || marketType === 'indices') {
        const indices = this.getIndicesList();
        const indexResults = indices.filter(i => 
          i.value.toLowerCase().includes(searchLower) ||
          i.label.toLowerCase().includes(searchLower)
        );
        searchPromises.push(Promise.resolve(indexResults));
      }

      const results = await Promise.all(searchPromises);
      allResults = results.flat();

      allResults.sort((a, b) => {
        const aSymbol = (a.symbol || a.value || '').toLowerCase();
        const bSymbol = (b.symbol || b.value || '').toLowerCase();
        
        if (aSymbol === searchLower && bSymbol !== searchLower) return -1;
        if (bSymbol === searchLower && aSymbol !== searchLower) return 1;
        
        if (aSymbol.startsWith(searchLower) && !bSymbol.startsWith(searchLower)) return -1;
        if (bSymbol.startsWith(searchLower) && !aSymbol.startsWith(searchLower)) return 1;
        
        return aSymbol.localeCompare(bSymbol);
      });

      console.log(`✅ إجمالي النتائج للبحث "${query}": ${allResults.length}`);
      return allResults;
    } catch (error) {
      console.error('❌ خطأ في البحث المباشر:', error.message);
      throw error;
    }
  }

  getCryptoEmoji(symbol) {
    const emojiMap = {
      'BTC': '₿', 'ETH': 'Ξ', 'BNB': '🟡', 'XRP': '💧', 'ADA': '🔷',
      'DOGE': '🐕', 'SOL': '☀️', 'DOT': '⚫', 'MATIC': '🟣', 'LTC': 'Ł',
      'AVAX': '🔺', 'LINK': '🔗', 'UNI': '🦄', 'ATOM': '⚛️', 'XLM': '🚀',
      'SHIB': '🐕', 'TRX': '🌐', 'TON': '💎', 'PEPE': '🐸', 'WIF': '🐶'
    };
    return emojiMap[symbol] || '💰';
  }
}

module.exports = new DirectSearchService();
