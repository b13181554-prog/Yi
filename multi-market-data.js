const axios = require('axios');

class MultiMarketDataService {
  constructor() {
    this.axiosConfig = {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    };
    this.cache = new Map();
    this.cacheTimeout = 60000;
  }

  async getCryptoPrice(symbol) {
    const sources = [
      { name: 'OKX', fn: () => this.getOKXPrice(symbol) },
      { name: 'KuCoin', fn: () => this.getKuCoinPrice(symbol) },
      { name: 'Bybit', fn: () => this.getBybitPrice(symbol) },
      { name: 'CoinGecko', fn: () => this.getCoinGeckoPrice(symbol) },
      { name: 'Binance', fn: () => this.getBinancePrice(symbol) }
    ];

    for (const source of sources) {
      try {
        const price = await source.fn();
        if (price && price > 0) {
          console.log(`✅ Got price from ${source.name}: ${symbol} = $${price}`);
          return price;
        }
      } catch (error) {
        console.warn(`⚠️ ${source.name} failed for ${symbol}:`, error.message);
        continue;
      }
    }
    
    throw new Error('فشل جلب السعر من جميع المصادر');
  }

  async getBinancePrice(symbol) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbol },
        timeout: 10000
      });
      return parseFloat(response.data.price);
    } catch (error) {
      throw new Error('Binance API failed');
    }
  }

  async getKuCoinPrice(symbol) {
    try {
      const pair = symbol.replace('USDT', '-USDT');
      const response = await axios.get(`https://api.kucoin.com/api/v1/market/orderbook/level1`, {
        params: { symbol: pair },
        timeout: 10000
      });
      return parseFloat(response.data.data.price);
    } catch (error) {
      throw new Error('KuCoin API failed');
    }
  }

  async getCoinGeckoPrice(symbol) {
    try {
      const coinId = this.symbolToCoinId(symbol);
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: coinId,
          vs_currencies: 'usd'
        },
        timeout: 10000
      });
      return response.data[coinId]?.usd || 0;
    } catch (error) {
      throw new Error('CoinGecko API failed');
    }
  }

  async getBybitPrice(symbol) {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: { 
          category: 'spot',
          symbol: symbol
        },
        timeout: 10000
      });
      if (response.data && response.data.result && response.data.result.list && response.data.result.list[0]) {
        return parseFloat(response.data.result.list[0].lastPrice);
      }
      throw new Error('No Bybit data');
    } catch (error) {
      throw new Error('Bybit API failed');
    }
  }

  async getOKXPrice(symbol) {
    try {
      const base = symbol.replace('USDT', '');
      const instId = `${base}-USDT`;
      const response = await axios.get('https://www.okx.com/api/v5/market/ticker', {
        params: { instId },
        timeout: 10000
      });
      if (response.data && response.data.data && response.data.data[0]) {
        return parseFloat(response.data.data[0].last);
      }
      throw new Error('No OKX data');
    } catch (error) {
      throw new Error('OKX API failed');
    }
  }

  symbolToCoinId(symbol) {
    const map = {
      'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'BNBUSDT': 'binancecoin',
      'XRPUSDT': 'ripple', 'ADAUSDT': 'cardano', 'DOGEUSDT': 'dogecoin',
      'SOLUSDT': 'solana', 'DOTUSDT': 'polkadot', 'MATICUSDT': 'matic-network',
      'LTCUSDT': 'litecoin', 'AVAXUSDT': 'avalanche-2', 'LINKUSDT': 'chainlink'
    };
    return map[symbol] || symbol.toLowerCase().replace('usdt', '');
  }

  async getCryptoCandles(symbol, interval, limit = 100) {
    // تشغيل جميع المصادر بالتوازي
    const sources = [
      this.getCandlesFromBinance(symbol, interval, limit),
      this.getCandlesFromKuCoin(symbol, interval, limit),
      this.getCandlesFromCryptoCompare(symbol, interval, limit),
      this.getCandlesFromCoinbase(symbol, interval, limit),
      this.getCandlesFromKraken(symbol, interval, limit)
    ];

    try {
      // انتظار أول مصدر ناجح
      const candles = await Promise.any(sources);
      return candles;
    } catch (error) {
      console.error('❌ All sources failed for candles');
      throw new Error('فشل جلب بيانات الشموع من جميع المصادر');
    }
  }

  async getCandlesFromBinance(symbol, interval, limit) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit },
        timeout: 10000
      });
      
      const candles = response.data.map(candle => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6]
      }));

      console.log(`✅ Got ${candles.length} candles from Binance for ${symbol}`);
      return candles;
    } catch (error) {
      console.warn('⚠️ Binance candles failed:', error.message);
      throw error;
    }
  }

  async getCandlesFromKuCoin(symbol, interval, limit) {
    try {
      const pair = symbol.replace('USDT', '-USDT');
      const kucoinInterval = this.convertToKuCoinInterval(interval);
      const startAt = Math.floor(Date.now() / 1000) - (limit * this.getIntervalSeconds(interval));
      
      const response = await axios.get(`https://api.kucoin.com/api/v1/market/candles`, {
        params: {
          symbol: pair,
          type: kucoinInterval,
          startAt: startAt
        },
        timeout: 10000
      });

      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('No data from KuCoin');
      }

      const candles = response.data.data.slice(0, limit).map(candle => ({
        openTime: candle[0] * 1000,
        open: candle[1],
        close: candle[2],
        high: candle[3],
        low: candle[4],
        volume: candle[5],
        closeTime: (candle[0] * 1000) + this.getIntervalMs(interval)
      }));

      console.log(`✅ Got ${candles.length} candles from KuCoin for ${symbol}`);
      return candles;
    } catch (error) {
      console.warn('⚠️ KuCoin candles failed:', error.message);
      throw error;
    }
  }

  async getCandlesFromCryptoCompare(symbol, interval, limit) {
    try {
      const fsym = symbol.replace('USDT', '');
      let endpoint = 'histominute';
      let aggregate = 1;

      switch(interval) {
        case '1m': endpoint = 'histominute'; aggregate = 1; break;
        case '5m': endpoint = 'histominute'; aggregate = 5; break;
        case '15m': endpoint = 'histominute'; aggregate = 15; break;
        case '30m': endpoint = 'histominute'; aggregate = 30; break;
        case '1h': endpoint = 'histohour'; aggregate = 1; break;
        case '4h': endpoint = 'histohour'; aggregate = 4; break;
        case '1d': endpoint = 'histoday'; aggregate = 1; break;
        default: endpoint = 'histohour'; aggregate = 1;
      }

      const response = await axios.get(`https://min-api.cryptocompare.com/data/v2/${endpoint}`, {
        params: {
          fsym: fsym,
          tsym: 'USDT',
          limit: limit,
          aggregate: aggregate
        },
        timeout: 10000
      });

      if (!response.data.Data || !response.data.Data.Data) {
        throw new Error('No data from CryptoCompare');
      }

      const candles = response.data.Data.Data.map(candle => ({
        openTime: candle.time * 1000,
        open: candle.open.toString(),
        high: candle.high.toString(),
        low: candle.low.toString(),
        close: candle.close.toString(),
        volume: candle.volumeto.toString(),
        closeTime: (candle.time * 1000) + this.getIntervalMs(interval)
      }));

      console.log(`✅ Got ${candles.length} candles from CryptoCompare for ${symbol}`);
      return candles;
    } catch (error) {
      console.warn('⚠️ CryptoCompare candles failed:', error.message);
      throw error;
    }
  }

  async getCandlesFromCoinbase(symbol, interval, limit) {
    try {
      const pair = symbol.replace('USDT', '-USD');
      const granularity = this.convertToCoinbaseGranularity(interval);
      const end = Math.floor(Date.now() / 1000);
      const start = end - (limit * granularity);

      const response = await axios.get(`https://api.exchange.coinbase.com/products/${pair}/candles`, {
        params: {
          start: new Date(start * 1000).toISOString(),
          end: new Date(end * 1000).toISOString(),
          granularity: granularity
        },
        timeout: 10000
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No data from Coinbase');
      }

      const candles = response.data.slice(0, limit).reverse().map(candle => ({
        openTime: candle[0] * 1000,
        low: candle[1].toString(),
        high: candle[2].toString(),
        open: candle[3].toString(),
        close: candle[4].toString(),
        volume: candle[5].toString(),
        closeTime: (candle[0] * 1000) + (granularity * 1000)
      }));

      console.log(`✅ Got ${candles.length} candles from Coinbase for ${symbol}`);
      return candles;
    } catch (error) {
      console.warn('⚠️ Coinbase candles failed:', error.message);
      throw error;
    }
  }

  async getCandlesFromKraken(symbol, interval, limit) {
    try {
      const pair = this.convertToKrakenPair(symbol);
      const krakenInterval = this.convertToKrakenInterval(interval);
      const since = Math.floor(Date.now() / 1000) - (limit * this.getIntervalSeconds(interval));

      const response = await axios.get(`https://api.kraken.com/0/public/OHLC`, {
        params: {
          pair: pair,
          interval: krakenInterval,
          since: since
        },
        timeout: 10000
      });

      if (!response.data.result || response.data.error.length > 0) {
        throw new Error('No data from Kraken');
      }

      const resultKey = Object.keys(response.data.result).find(key => key !== 'last');
      if (!resultKey) throw new Error('No data from Kraken');

      const candles = response.data.result[resultKey].slice(0, limit).map(candle => ({
        openTime: candle[0] * 1000,
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[6],
        closeTime: (candle[0] * 1000) + this.getIntervalMs(interval)
      }));

      console.log(`✅ Got ${candles.length} candles from Kraken for ${symbol}`);
      return candles;
    } catch (error) {
      console.warn('⚠️ Kraken candles failed:', error.message);
      throw error;
    }
  }

  convertToKuCoinInterval(interval) {
    const map = {
      '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
      '1h': '1hour', '4h': '4hour', '1d': '1day', '1w': '1week'
    };
    return map[interval] || '1hour';
  }

  convertToCoinbaseGranularity(interval) {
    const map = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400
    };
    return map[interval] || 3600;
  }

  convertToKrakenInterval(interval) {
    const map = {
      '1m': 1, '5m': 5, '15m': 15, '30m': 30,
      '1h': 60, '4h': 240, '1d': 1440, '1w': 10080
    };
    return map[interval] || 60;
  }

  convertToKrakenPair(symbol) {
    const base = symbol.replace('USDT', '');
    const map = {
      'BTC': 'XXBTZUSD', 'ETH': 'XETHZUSD', 'XRP': 'XXRPZUSD',
      'ADA': 'ADAUSD', 'DOGE': 'XDGUSD', 'SOL': 'SOLUSD'
    };
    return map[base] || `${base}USD`;
  }

  getIntervalSeconds(interval) {
    const map = {
      '1m': 60, '5m': 300, '15m': 900, '30m': 1800,
      '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800
    };
    return map[interval] || 3600;
  }

  async getForexPrice(pair) {
    try {
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      
      const response = await axios.get(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`, {
        timeout: 10000
      });
      
      if (response.data && response.data.rates && response.data.rates[quote]) {
        const price = response.data.rates[quote];
        console.log(`✅ Got forex price from Frankfurter: ${pair} = ${price}`);
        return price;
      }
      
      throw new Error('No data from Frankfurter');
    } catch (error) {
      console.error(`❌ Error fetching forex price for ${pair}:`, error.message);
      throw new Error(`فشل جلب سعر الفوركس لـ ${pair}`);
    }
  }


  async getForexCandles(pair, interval, limit = 100) {
    try {
      const base = pair.slice(0, 3);
      const quote = pair.slice(3, 6);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (limit + 10));
      
      const url = `https://api.frankfurter.app/${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}?from=${base}&to=${quote}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.rates) {
        const rates = response.data.rates;
        const candles = [];
        const dates = Object.keys(rates).slice(-limit);
        
        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          const rate = rates[date][quote];
          const timestamp = new Date(date).getTime();
          const intervalMs = this.getIntervalMs(interval);
          
          candles.push({
            openTime: timestamp,
            open: rate.toFixed(5),
            high: rate.toFixed(5),
            low: rate.toFixed(5),
            close: rate.toFixed(5),
            volume: '0',
            closeTime: timestamp + intervalMs
          });
        }
        
        console.log(`✅ Got ${candles.length} real forex daily close rates for ${pair} from Frankfurter API (ECB data)`);
        return candles;
      }
      
      throw new Error('No data from Frankfurter API');
    } catch (error) {
      console.error('Error fetching forex candles:', error.message);
      throw new Error('فشل جلب بيانات الفوركس');
    }
  }

  getIntervalMs(interval) {
    const map = {
      '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
      '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000
    };
    return map[interval] || 3600000;
  }

  convertToYahooInterval(interval) {
    const map = {
      '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1h', '4h': '1h', '1d': '1d', '1w': '1wk'
    };
    return map[interval] || '1h';
  }

  getYahooRange(limit, interval) {
    const intervalMap = {
      '1m': Math.min(limit / 390, 7),
      '5m': Math.min(limit / 78, 30),
      '15m': Math.min(limit / 26, 60),
      '30m': Math.min(limit / 13, 60),
      '1h': Math.min(limit / 6.5, 730),
      '1d': Math.min(limit, 3650),
      '1w': Math.min(limit * 7, 3650)
    };
    const days = Math.ceil(intervalMap[interval] || 30);
    
    if (interval === '1m') {
      if (limit <= 390) return '1d';
      if (limit <= 1950) return '5d';
      return '7d';
    }
    
    if (interval === '5m') {
      if (limit <= 78) return '1d';
      if (limit <= 390) return '5d';
      return '1mo';
    }
    
    if (interval === '15m' || interval === '30m') {
      if (days <= 5) return `${Math.max(days, 1)}d`;
      if (days <= 30) return '1mo';
      return '2mo';
    }
    
    if (days <= 1) return '1d';
    if (days <= 5) return '5d';
    if (days <= 30) return '1mo';
    if (days <= 90) return '3mo';
    if (days <= 180) return '6mo';
    if (days <= 365) return '1y';
    if (days <= 730) return '2y';
    if (days <= 1825) return '5y';
    return 'max';
  }

  convertToYahooCommoditySymbol(symbol) {
    const map = {
      'XAUUSD': 'GC=F',
      'XAGUSD': 'SI=F',
      'XPTUSD': 'PL=F',
      'XPDUSD': 'PA=F',
      'WTIUSD': 'CL=F',
      'BCOUSD': 'BZ=F',
      'NGAS': 'NG=F',
      'COPPER': 'HG=F',
      'WHEAT': 'ZW=F',
      'CORN': 'ZC=F',
      'SOYBEAN': 'ZS=F',
      'SUGAR': 'SB=F',
      'COFFEE': 'KC=F',
      'COCOA': 'CC=F',
      'COTTON': 'CT=F',
      'ZINC': 'ZN=F',
      'NICKEL': 'NI=F',
      'ALUMINUM': 'AL=F'
    };
    return map[symbol] || 'GC=F';
  }

  convertToYahooIndexSymbol(symbol) {
    const map = {
      'US30': '^DJI',
      'SPX500': '^GSPC',
      'NAS100': '^IXIC',
      'UK100': '^FTSE',
      'GER40': '^GDAXI',
      'FRA40': '^FCHI',
      'JPN225': '^N225',
      'HK50': '^HSI',
      'AUS200': '^AXJO',
      'ESP35': '^IBEX',
      'ITA40': 'FTSEMIB.MI',
      'CHN50': '000001.SS',
      'IND50': '^NSEI',
      'KOR200': '^KS11',
      'SWI20': '^SSMI',
      'NLD25': '^AEX',
      'RUS50': 'IMOEX.ME',
      'BRA60': '^BVSP',
      'MEX35': '^MXX',
      'SAF40': 'J203.JO'
    };
    return map[symbol] || '^GSPC';
  }

  async getCrypto24hrStats(symbol) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        params: { symbol },
        timeout: 10000
      });
      
      return {
        symbol: response.data.symbol,
        priceChange: parseFloat(response.data.priceChange),
        priceChangePercent: parseFloat(response.data.priceChangePercent),
        lastPrice: response.data.lastPrice,
        highPrice: response.data.highPrice,
        lowPrice: response.data.lowPrice,
        volume: response.data.volume
      };
    } catch (error) {
      console.error('Error fetching 24hr stats:', error.message);
      throw new Error('فشل جلب إحصائيات 24 ساعة');
    }
  }

  async getTopMovers(type = 'gainers', marketType = 'crypto', limit = 10) {
    if (marketType === 'crypto') {
      return this.getCryptoMovers(type, limit);
    } else {
      return this.getForexMovers(type, limit);
    }
  }

  async getCryptoMovers(type, limit) {
    // تشغيل جميع المصادر بالتوازي
    const sources = [
      this.getMoversFromBinance(type, limit),
      this.getMoversFromKuCoin(type, limit),
      this.getMoversFromCryptoCompare(type, limit)
    ];

    try {
      const movers = await Promise.any(sources);
      return movers;
    } catch (error) {
      console.error('❌ All sources failed for movers');
      return [];
    }
  }

  async getMoversFromBinance(type, limit) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        timeout: 10000
      });
      
      const filtered = response.data
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => {
          const changeA = parseFloat(a.priceChangePercent);
          const changeB = parseFloat(b.priceChangePercent);
          return type === 'gainers' ? changeB - changeA : changeA - changeB;
        })
        .slice(0, limit);
      
      const movers = filtered.map(coin => ({
        symbol: coin.symbol,
        price: parseFloat(coin.lastPrice),
        change: parseFloat(coin.priceChangePercent)
      }));

      console.log(`✅ Got ${movers.length} movers from Binance`);
      return movers;
    } catch (error) {
      console.warn('⚠️ Binance movers failed:', error.message);
      throw error;
    }
  }

  async getMoversFromKuCoin(type, limit) {
    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers', {
        timeout: 10000
      });

      const filtered = response.data.data.ticker
        .filter(t => t.symbol.endsWith('-USDT'))
        .map(t => ({
          symbol: t.symbol.replace('-', ''),
          price: parseFloat(t.last),
          change: parseFloat(t.changeRate) * 100
        }))
        .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
        .slice(0, limit);

      console.log(`✅ Got ${filtered.length} movers from KuCoin`);
      return filtered;
    } catch (error) {
      console.warn('⚠️ KuCoin movers failed:', error.message);
      throw error;
    }
  }

  async getMoversFromCryptoCompare(type, limit) {
    try {
      const response = await axios.get('https://min-api.cryptocompare.com/data/top/mktcapfull', {
        params: {
          limit: 100,
          tsym: 'USD'
        },
        timeout: 10000
      });

      const filtered = response.data.Data
        .filter(coin => coin.RAW && coin.RAW.USD)
        .map(coin => ({
          symbol: coin.CoinInfo.Name + 'USDT',
          price: coin.RAW.USD.PRICE,
          change: coin.RAW.USD.CHANGEPCT24HOUR
        }))
        .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
        .slice(0, limit);

      console.log(`✅ Got ${filtered.length} movers from CryptoCompare`);
      return filtered;
    } catch (error) {
      console.warn('⚠️ CryptoCompare movers failed:', error.message);
      throw error;
    }
  }

  async getForexMovers(type, limit) {
    const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURJPY', 'GBPJPY', 'EURGBP'];
    const movers = [];
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    for (const pair of pairs) {
      try {
        const base = pair.slice(0, 3);
        const quote = pair.slice(3, 6);
        
        const url = `https://api.frankfurter.app/${yesterday}..${today}?from=${base}&to=${quote}`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data && response.data.rates) {
          const rates = Object.values(response.data.rates);
          if (rates.length >= 2) {
            const currentPrice = rates[rates.length - 1][quote];
            const previousPrice = rates[0][quote];
            const change = ((currentPrice - previousPrice) / previousPrice) * 100;
            
            movers.push({ symbol: pair, price: currentPrice, change });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch forex mover for ${pair}`);
        continue;
      }
    }
    
    movers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
    console.log(`✅ Got ${movers.length} real forex movers from Frankfurter API`);
    return movers.slice(0, limit);
  }


  async getStockCandles(symbol, interval, limit = 100) {
    try {
      if (interval === '4h') {
        const hourlyCandles = await this.getStockCandles(symbol, '1h', limit * 4);
        return this.convertTo4hCandles(hourlyCandles, limit);
      }

      const yahooInterval = this.convertToYahooInterval(interval);
      const range = this.getYahooRange(limit, interval);
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${yahooInterval}&range=${range}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        const candles = timestamps.slice(-limit).map((time, index) => ({
          openTime: time * 1000,
          open: quote.open[index]?.toFixed(2) || '0',
          high: quote.high[index]?.toFixed(2) || '0',
          low: quote.low[index]?.toFixed(2) || '0',
          close: quote.close[index]?.toFixed(2) || '0',
          volume: quote.volume[index]?.toString() || '0',
          closeTime: (time * 1000) + this.getIntervalMs(interval)
        }));
        
        console.log(`✅ Got ${candles.length} real candles for stock ${symbol} from Yahoo Finance`);
        return candles;
      }
      
      throw new Error('No data from Yahoo Finance');
    } catch (error) {
      console.error(`❌ Error fetching stock candles for ${symbol}:`, error.message);
      throw new Error(`فشل جلب بيانات الأسهم لـ ${symbol}`);
    }
  }

  async getCommodityCandles(symbol, interval, limit = 100) {
    try {
      if (interval === '4h') {
        const hourlyCandles = await this.getCommodityCandles(symbol, '1h', limit * 4);
        return this.convertTo4hCandles(hourlyCandles, limit);
      }

      const yahooSymbol = this.convertToYahooCommoditySymbol(symbol);
      const yahooInterval = this.convertToYahooInterval(interval);
      const range = this.getYahooRange(limit, interval);
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&range=${range}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        const candles = timestamps.slice(-limit).map((time, index) => ({
          openTime: time * 1000,
          open: quote.open[index]?.toFixed(2) || '0',
          high: quote.high[index]?.toFixed(2) || '0',
          low: quote.low[index]?.toFixed(2) || '0',
          close: quote.close[index]?.toFixed(2) || '0',
          volume: quote.volume[index]?.toString() || '0',
          closeTime: (time * 1000) + this.getIntervalMs(interval)
        }));
        
        console.log(`✅ Got ${candles.length} real candles for commodity ${symbol} from Yahoo Finance`);
        return candles;
      }
      
      throw new Error('No data from Yahoo Finance');
    } catch (error) {
      console.error(`❌ Error fetching commodity candles for ${symbol}:`, error.message);
      throw new Error(`فشل جلب بيانات السلع لـ ${symbol}`);
    }
  }

  async getIndicesCandles(symbol, interval, limit = 100) {
    try {
      if (interval === '4h') {
        const hourlyCandles = await this.getIndicesCandles(symbol, '1h', limit * 4);
        return this.convertTo4hCandles(hourlyCandles, limit);
      }

      const yahooSymbol = this.convertToYahooIndexSymbol(symbol);
      const yahooInterval = this.convertToYahooInterval(interval);
      const range = this.getYahooRange(limit, interval);
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&range=${range}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.chart && response.data.chart.result && response.data.chart.result[0]) {
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        const candles = timestamps.slice(-limit).map((time, index) => ({
          openTime: time * 1000,
          open: quote.open[index]?.toFixed(2) || '0',
          high: quote.high[index]?.toFixed(2) || '0',
          low: quote.low[index]?.toFixed(2) || '0',
          close: quote.close[index]?.toFixed(2) || '0',
          volume: quote.volume[index]?.toString() || '0',
          closeTime: (time * 1000) + this.getIntervalMs(interval)
        }));
        
        console.log(`✅ Got ${candles.length} real candles for index ${symbol} from Yahoo Finance`);
        return candles;
      }
      
      throw new Error('No data from Yahoo Finance');
    } catch (error) {
      console.error(`❌ Error fetching index candles for ${symbol}:`, error.message);
      throw new Error(`فشل جلب بيانات المؤشرات لـ ${symbol}`);
    }
  }

  convertTo4hCandles(hourlyCandles, limit) {
    const candles4h = [];
    
    for (let i = 0; i < hourlyCandles.length; i += 4) {
      const chunk = hourlyCandles.slice(i, i + 4);
      if (chunk.length === 4) {
        const open = chunk[0].open;
        const high = Math.max(...chunk.map(c => parseFloat(c.high))).toFixed(2);
        const low = Math.min(...chunk.map(c => parseFloat(c.low))).toFixed(2);
        const close = chunk[3].close;
        const volume = chunk.reduce((sum, c) => sum + parseFloat(c.volume || 0), 0).toString();
        
        candles4h.push({
          openTime: chunk[0].openTime,
          open,
          high,
          low,
          close,
          volume,
          closeTime: chunk[3].closeTime
        });
      }
    }
    
    return candles4h.slice(-limit);
  }
}

module.exports = new MultiMarketDataService();
