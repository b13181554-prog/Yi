const axios = require('axios');

class MarketDataService {
  constructor() {
    this.axiosConfig = {
      timeout: 15000,
      headers: {
        'Accept': 'application/json'
      }
    };
    this.priceCache = new Map();
    this.cacheTimeout = 30000; // 30 ثانية
  }

  symbolToCoinId(symbol) {
    const symbolMap = {
      'BTCUSDT': 'bitcoin',
      'ETHUSDT': 'ethereum',
      'BNBUSDT': 'binancecoin',
      'XRPUSDT': 'ripple',
      'ADAUSDT': 'cardano',
      'DOGEUSDT': 'dogecoin',
      'SOLUSDT': 'solana',
      'DOTUSDT': 'polkadot',
      'MATICUSDT': 'matic-network',
      'LTCUSDT': 'litecoin',
      'AVAXUSDT': 'avalanche-2',
      'LINKUSDT': 'chainlink',
      'UNIUSDT': 'uniswap',
      'ATOMUSDT': 'cosmos',
      'XLMUSDT': 'stellar',
      'SHIBUSDT': 'shiba-inu',
      'TRXUSDT': 'tron',
      'WBTCUSDT': 'wrapped-bitcoin',
      'DAIUSDT': 'dai',
      'TONUSDT': 'the-open-network'
    };
    
    return symbolMap[symbol] || symbol.toLowerCase().replace('usdt', '');
  }

  symbolToCoinPaprikaId(symbol) {
    const symbolMap = {
      'BTCUSDT': 'btc-bitcoin',
      'ETHUSDT': 'eth-ethereum',
      'BNBUSDT': 'bnb-binance-coin',
      'XRPUSDT': 'xrp-xrp',
      'ADAUSDT': 'ada-cardano',
      'DOGEUSDT': 'doge-dogecoin',
      'SOLUSDT': 'sol-solana',
      'DOTUSDT': 'dot-polkadot',
      'MATICUSDT': 'matic-polygon',
      'LTCUSDT': 'ltc-litecoin',
      'AVAXUSDT': 'avax-avalanche',
      'LINKUSDT': 'link-chainlink',
      'UNIUSDT': 'uni-uniswap',
      'ATOMUSDT': 'atom-cosmos',
      'XLMUSDT': 'xlm-stellar',
      'SHIBUSDT': 'shib-shiba-inu',
      'TRXUSDT': 'trx-tron',
      'TONUSDT': 'ton-the-open-network'
    };
    
    return symbolMap[symbol] || null;
  }

  symbolToYahooFinance(symbol, marketType) {
    if (marketType === 'indices') {
      const indicesMap = {
        'US30': '^DJI',
        'SPX500': '^GSPC',
        'NAS100': '^IXIC',
        'US500': '^GSPC',
        'DJ30': '^DJI'
      };
      return indicesMap[symbol] || symbol;
    }
    
    if (marketType === 'commodities') {
      const commoditiesMap = {
        'XAUUSD': 'GC=F',
        'XAGUSD': 'SI=F',
        'USOIL': 'CL=F',
        'UKOIL': 'BZ=F',
        'GOLD': 'GC=F',
        'SILVER': 'SI=F',
        'COPPER': 'HG=F',
        'NATGAS': 'NG=F'
      };
      return commoditiesMap[symbol] || symbol;
    }
    
    return symbol;
  }

  async getPriceFromBinance(symbol) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbol },
        timeout: 10000
      });
      
      const price = parseFloat(response.data.price);
      if (price && price > 0) {
        console.log(`✅ Binance: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Binance error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromCoinGecko(symbol) {
    try {
      const coinId = this.symbolToCoinId(symbol);
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: coinId,
          vs_currencies: 'usd'
        },
        ...this.axiosConfig
      });

      const price = response.data[coinId]?.usd;
      if (price && price > 0) {
        console.log(`✅ CoinGecko: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ CoinGecko error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromCoinPaprika(symbol) {
    try {
      const coinId = this.symbolToCoinPaprikaId(symbol);
      if (!coinId) return null;

      const response = await axios.get(`https://api.coinpaprika.com/v1/tickers/${coinId}`, {
        timeout: 10000
      });

      const price = response.data.quotes?.USD?.price;
      if (price && price > 0) {
        console.log(`✅ CoinPaprika: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ CoinPaprika error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromKraken(symbol) {
    try {
      const krakenSymbol = symbol.replace('USDT', 'USD');
      const response = await axios.get('https://api.kraken.com/0/public/Ticker', {
        params: { pair: krakenSymbol },
        timeout: 10000
      });

      const data = response.data.result;
      const key = Object.keys(data)[0];
      const price = parseFloat(data[key]?.c?.[0]);
      
      if (price && price > 0) {
        console.log(`✅ Kraken: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Kraken error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromCoinbase(symbol) {
    try {
      const coinbasePair = symbol.replace('USDT', '-USD');
      const response = await axios.get(`https://api.coinbase.com/v2/prices/${coinbasePair}/spot`, {
        timeout: 10000
      });

      const price = parseFloat(response.data.data?.amount);
      if (price && price > 0) {
        console.log(`✅ Coinbase: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Coinbase error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromBybit(symbol) {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: { 
          category: 'spot',
          symbol: symbol
        },
        timeout: 10000
      });

      const price = parseFloat(response.data.result?.list?.[0]?.lastPrice);
      if (price && price > 0) {
        console.log(`✅ Bybit: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Bybit error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromOKX(symbol) {
    try {
      const okxSymbol = symbol.replace('USDT', '-USDT');
      const response = await axios.get('https://www.okx.com/api/v5/market/ticker', {
        params: { instId: okxSymbol },
        timeout: 10000
      });

      const price = parseFloat(response.data.data?.[0]?.last);
      if (price && price > 0) {
        console.log(`✅ OKX: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ OKX error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromGateIO(symbol) {
    try {
      const gateSymbol = symbol.replace('USDT', '_USDT');
      const response = await axios.get(`https://api.gateio.ws/api/v4/spot/tickers`, {
        params: { currency_pair: gateSymbol },
        timeout: 10000
      });

      const price = parseFloat(response.data?.[0]?.last);
      if (price && price > 0) {
        console.log(`✅ Gate.io: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Gate.io error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromCryptoCom(symbol) {
    try {
      const cryptoSymbol = symbol.replace('USDT', '_USDT');
      const response = await axios.get('https://api.crypto.com/v2/public/get-ticker', {
        params: { instrument_name: cryptoSymbol },
        timeout: 10000
      });

      const price = parseFloat(response.data.result?.data?.a);
      if (price && price > 0) {
        console.log(`✅ Crypto.com: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Crypto.com error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromBitfinex(symbol) {
    try {
      const bitfinexSymbol = 't' + symbol.replace('USDT', 'UST');
      const response = await axios.get(`https://api-pub.bitfinex.com/v2/ticker/${bitfinexSymbol}`, {
        timeout: 10000
      });

      const price = parseFloat(response.data?.[6]);
      if (price && price > 0) {
        console.log(`✅ Bitfinex: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Bitfinex error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromHuobi(symbol) {
    try {
      const huobiSymbol = symbol.toLowerCase();
      const response = await axios.get('https://api.huobi.pro/market/detail/merged', {
        params: { symbol: huobiSymbol },
        timeout: 10000
      });

      const price = parseFloat(response.data.tick?.close);
      if (price && price > 0) {
        console.log(`✅ Huobi: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Huobi error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getPriceFromYahooFinance(symbol, marketType) {
    try {
      const yahooSymbol = this.symbolToYahooFinance(symbol, marketType);
      const response = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
          interval: '1d',
          range: '1d'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
      });

      const result = response.data?.chart?.result?.[0];
      const price = result?.meta?.regularMarketPrice;
      
      if (price && price > 0) {
        console.log(`✅ Yahoo Finance: ${symbol} = $${price}`);
        return price;
      }
      return null;
    } catch (error) {
      console.error(`❌ Yahoo Finance error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCurrentPrice(symbol, marketType = 'spot') {
    const cacheKey = `${symbol}_${marketType}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 Cache hit for ${symbol}: $${cached.price}`);
      return cached.price;
    }

    console.log(`🔍 Fetching real-time price for ${symbol} from multiple sources...`);

    let price;
    
    if (marketType === 'forex') {
      const ForexService = require('./forex-service');
      const forexService = new ForexService();
      price = await forexService.getCurrentPrice(symbol);
    } else if (marketType === 'stocks' || marketType === 'indices' || marketType === 'commodities') {
      price = await this.getPriceFromYahooFinance(symbol, marketType);
    } else {
      price = await this.getPriceFromOKX(symbol) ||
              await this.getPriceFromBybit(symbol) ||
              await this.getPriceFromGateIO(symbol) ||
              await this.getPriceFromCoinGecko(symbol) ||
              await this.getPriceFromKraken(symbol) ||
              await this.getPriceFromCoinbase(symbol) ||
              await this.getPriceFromCoinPaprika(symbol) ||
              await this.getPriceFromHuobi(symbol) ||
              await this.getPriceFromCryptoCom(symbol) ||
              await this.getPriceFromBitfinex(symbol) ||
              await this.getPriceFromBinance(symbol);
    }

    if (price) {
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });
      return price;
    }

    throw new Error(`فشل في الحصول على السعر الحقيقي لـ ${symbol} من جميع المنصات`);
  }

  async get24hrStatsFromBinance(symbol) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        params: { symbol },
        timeout: 10000
      });

      const data = response.data;
      return {
        symbol: symbol,
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        lastPrice: data.lastPrice,
        highPrice: data.highPrice,
        lowPrice: data.lowPrice,
        volume: data.volume
      };
    } catch (error) {
      console.error(`❌ Binance 24hr stats error for ${symbol}:`, error.message);
      return null;
    }
  }

  async get24hrStatsFromCoinGecko(symbol) {
    try {
      const coinId = this.symbolToCoinId(symbol);
      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
        params: {
          localization: false,
          tickers: false,
          community_data: false,
          developer_data: false
        },
        ...this.axiosConfig
      });

      const data = response.data.market_data;
      
      return {
        symbol: symbol,
        priceChange: data.price_change_24h || 0,
        priceChangePercent: data.price_change_percentage_24h || 0,
        lastPrice: data.current_price?.usd?.toString() || '0',
        highPrice: data.high_24h?.usd?.toString() || '0',
        lowPrice: data.low_24h?.usd?.toString() || '0',
        volume: data.total_volume?.usd?.toString() || '0'
      };
    } catch (error) {
      console.error(`❌ CoinGecko 24hr stats error for ${symbol}:`, error.message);
      return null;
    }
  }

  async get24hrStats(symbol, marketType = 'spot') {
    console.log(`📊 Fetching 24hr stats for ${symbol}...`);

    let stats;
    
    if (marketType === 'forex') {
      const ForexService = require('./forex-service');
      const forexService = new ForexService();
      stats = await forexService.get24hrStats(symbol);
    } else if (marketType === 'stocks' || marketType === 'indices' || marketType === 'commodities') {
      const currentPrice = await this.getCurrentPrice(symbol, marketType);
      stats = {
        symbol: symbol,
        priceChange: 0,
        priceChangePercent: 0,
        lastPrice: currentPrice.toString(),
        highPrice: currentPrice.toString(),
        lowPrice: currentPrice.toString(),
        volume: '0'
      };
    } else {
      stats = await this.get24hrStatsFromCoinGecko(symbol) ||
              await this.get24hrStatsFromBinance(symbol);
    }

    if (stats) {
      console.log(`✅ Got 24hr stats for ${symbol}`);
      return stats;
    }

    throw new Error(`فشل في الحصول على إحصائيات 24 ساعة الحقيقية لـ ${symbol}`);
  }

  async getCandlesFromBinance(symbol, interval, limit = 100) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol,
          interval,
          limit
        },
        timeout: 15000
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

      console.log(`✅ Binance: Got ${candles.length} real candles for ${symbol}`);
      return candles;
    } catch (error) {
      console.error(`❌ Binance candles error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCandlesFromBybit(symbol, interval, limit = 100) {
    try {
      const intervalMap = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1h': '60',
        '4h': '240',
        '1d': 'D',
        '1w': 'W'
      };

      const response = await axios.get('https://api.bybit.com/v5/market/kline', {
        params: {
          category: 'spot',
          symbol: symbol,
          interval: intervalMap[interval] || '60',
          limit: limit
        },
        timeout: 15000
      });

      if (response.data && response.data.result && response.data.result.list) {
        const candles = response.data.result.list.reverse().map(candle => ({
          openTime: parseInt(candle[0]),
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
          closeTime: parseInt(candle[0]) + 60000
        }));

        console.log(`✅ Bybit: Got ${candles.length} real candles for ${symbol}`);
        return candles;
      }
      return null;
    } catch (error) {
      console.error(`❌ Bybit candles error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCandlesFromOKX(symbol, interval, limit = 100) {
    try {
      const okxSymbol = symbol.replace('USDT', '-USDT');
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1H',
        '4h': '4H',
        '1d': '1D',
        '1w': '1W'
      };

      const response = await axios.get('https://www.okx.com/api/v5/market/candles', {
        params: {
          instId: okxSymbol,
          bar: intervalMap[interval] || '1H',
          limit: limit
        },
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const candles = response.data.data.reverse().map(candle => ({
          openTime: parseInt(candle[0]),
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
          closeTime: parseInt(candle[0]) + 60000
        }));

        console.log(`✅ OKX: Got ${candles.length} real candles for ${symbol}`);
        return candles;
      }
      return null;
    } catch (error) {
      console.error(`❌ OKX candles error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCandlesFromYahooFinance(symbol, interval, limit = 100, marketType) {
    try {
      const yahooSymbol = this.symbolToYahooFinance(symbol, marketType);
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
        '1w': '1wk'
      };

      const intervalDurationMs = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000
      };

      const period2 = Math.floor(Date.now() / 1000);
      let period1;
      
      // للسلع والأسهم، نحتاج فترة زمنية أطول لضمان الحصول على 100 شمعة
      // لأن الأسواق لا تعمل 24/7 وهناك عطلات نهاية الأسبوع والعطلات الرسمية
      if (marketType === 'commodities' || marketType === 'stocks' || marketType === 'indices') {
        switch(interval) {
          case '1m': case '5m': case '15m': case '30m':
            period1 = period2 - (60 * 24 * 60 * 60); // 60 يوم
            break;
          case '1h':
            period1 = period2 - (365 * 24 * 60 * 60); // سنة واحدة
            break;
          case '4h':
            period1 = period2 - (730 * 24 * 60 * 60); // سنتين
            break;
          case '1d':
            period1 = period2 - (1095 * 24 * 60 * 60); // 3 سنوات
            break;
          case '1w':
            period1 = period2 - (5 * 365 * 24 * 60 * 60); // 5 سنوات
            break;
          default:
            period1 = period2 - (365 * 24 * 60 * 60); // سنة واحدة
        }
      } else {
        // للعملات الرقمية والفوركس (تعمل 24/7)
        switch(interval) {
          case '1m': case '5m': case '15m': case '30m':
            period1 = period2 - (7 * 24 * 60 * 60);
            break;
          case '1h':
            period1 = period2 - (30 * 24 * 60 * 60);
            break;
          case '4h':
            period1 = period2 - (90 * 24 * 60 * 60);
            break;
          case '1d':
            period1 = period2 - (365 * 24 * 60 * 60);
            break;
          case '1w':
            period1 = period2 - (5 * 365 * 24 * 60 * 60);
            break;
          default:
            period1 = period2 - (30 * 24 * 60 * 60);
        }
      }

      const response = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
          period1,
          period2,
          interval: intervalMap[interval] || '1h'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 15000
      });

      const result = response.data?.chart?.result?.[0];
      const timestamps = result?.timestamp;
      const quote = result?.indicators?.quote?.[0];

      if (timestamps && quote && timestamps.length > 0) {
        const startIndex = Math.max(0, timestamps.length - limit);
        const endIndex = timestamps.length;
        const duration = intervalDurationMs[interval] || 3600000;
        
        const candles = timestamps
          .slice(startIndex, endIndex)
          .map((ts, i) => {
            const dataIndex = startIndex + i;
            const open = quote.open[dataIndex];
            const high = quote.high[dataIndex];
            const low = quote.low[dataIndex];
            const close = quote.close[dataIndex];
            const volume = quote.volume[dataIndex];
            
            if (open == null || high == null || low == null || close == null) {
              return null;
            }
            
            return {
              openTime: ts * 1000,
              open: open.toString(),
              high: high.toString(),
              low: low.toString(),
              close: close.toString(),
              volume: (volume || 0).toString(),
              closeTime: (ts * 1000) + duration
            };
          })
          .filter(candle => candle !== null);

        console.log(`✅ Yahoo Finance: Got ${candles.length} real candles for ${symbol}`);
        return candles.length > 0 ? candles : null;
      }
      return null;
    } catch (error) {
      console.error(`❌ Yahoo Finance candles error for ${symbol}:`, error.message);
      return null;
    }
  }

  async getCandles(symbol, interval, limit = 100, marketType = 'spot') {
    console.log(`🕯️ Fetching real candles for ${symbol} (${interval})...`);

    let candles;
    
    if (marketType === 'forex') {
      const ForexService = require('./forex-service');
      const forexService = new ForexService();
      candles = await forexService.getCandles(symbol, interval, limit);
    } else if (marketType === 'stocks' || marketType === 'indices' || marketType === 'commodities') {
      candles = await this.getCandlesFromYahooFinance(symbol, interval, limit, marketType);
    } else {
      candles = await this.getCandlesFromOKX(symbol, interval, limit) ||
                await this.getCandlesFromBybit(symbol, interval, limit) ||
                await this.getCandlesFromBinance(symbol, interval, limit);
    }

    if (candles && candles.length > 0) {
      this.validateCandleData(candles, symbol);
      return candles;
    }

    throw new Error(`فشل في الحصول على بيانات الشموع الحقيقية لـ ${symbol}`);
  }

  validateCandleData(candles, symbol) {
    if (candles.length < 20) {
      console.warn(`⚠️ عدد الشموع قليل لـ ${symbol}: ${candles.length}`);
    }

    for (let i = 0; i < Math.min(5, candles.length); i++) {
      const candle = candles[i];
      const open = parseFloat(candle.open);
      const high = parseFloat(candle.high);
      const low = parseFloat(candle.low);
      const close = parseFloat(candle.close);

      if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
        console.error(`❌ بيانات غير صحيحة لـ ${symbol} في الشمعة ${i}:`, candle);
        throw new Error(`بيانات OHLC غير صحيحة لـ ${symbol}`);
      }
    }

    console.log(`✅ تم التحقق من صحة البيانات لـ ${symbol}`);
  }

  async getTopMoversFromBinance(type = 'gainers') {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        timeout: 15000
      });

      const usdtPairs = response.data
        .filter(ticker => ticker.symbol.endsWith('USDT'))
        .map(ticker => ({
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          volume: parseFloat(ticker.volume)
        }))
        .sort((a, b) => {
          return type === 'gainers' 
            ? b.priceChangePercent - a.priceChangePercent
            : a.priceChangePercent - b.priceChangePercent;
        })
        .slice(0, 10);

      console.log(`✅ Binance: Got ${usdtPairs.length} real movers`);
      return usdtPairs;
    } catch (error) {
      console.error('❌ Binance top movers error:', error.message);
      return null;
    }
  }

  async getTopMoversFromCoinGecko(type = 'gainers') {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: type === 'gainers' ? 'price_change_percentage_24h_desc' : 'price_change_percentage_24h_asc',
          per_page: 10,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h'
        },
        ...this.axiosConfig
      });

      const movers = response.data.map(coin => ({
        symbol: coin.symbol.toUpperCase() + 'USDT',
        name: coin.name,
        price: coin.current_price,
        priceChangePercent: coin.price_change_percentage_24h,
        volume: coin.total_volume
      }));

      console.log(`✅ CoinGecko: Got ${movers.length} real movers`);
      return movers;
    } catch (error) {
      console.error('❌ CoinGecko top movers error:', error.message);
      return null;
    }
  }

  async getTopMovers(type = 'gainers') {
    console.log(`🔥 Fetching real top ${type}...`);

    const movers = await this.getTopMoversFromCoinGecko(type) ||
                   await this.getTopMoversFromBinance(type);

    if (movers && movers.length > 0) {
      return movers;
    }

    throw new Error(`فشل في الحصول على بيانات العملات الأكثر حركة`);
  }

  async getAllCryptoStats() {
    try {
      console.log('📊 جلب بيانات جميع العملات من Binance...');
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        timeout: 20000
      });

      const usdtPairs = response.data
        .filter(ticker => ticker.symbol.endsWith('USDT'))
        .map(ticker => ({
          symbol: ticker.symbol,
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          volume: parseFloat(ticker.volume) * parseFloat(ticker.lastPrice),
          lastPrice: parseFloat(ticker.lastPrice),
          highPrice: parseFloat(ticker.highPrice),
          lowPrice: parseFloat(ticker.lowPrice),
          trades: parseInt(ticker.count)
        }));

      console.log(`✅ تم جلب بيانات ${usdtPairs.length} عملة من Binance`);
      return usdtPairs;
    } catch (error) {
      console.error('❌ خطأ في جلب بيانات جميع العملات:', error.message);
      return [];
    }
  }

  getSmartCryptoSelection(allStats, limit = 50) {
    if (!allStats || allStats.length === 0) return [];

    const minVolume = 1000000;
    const minPrice = 0.0001;

    const filtered = allStats.filter(coin => 
      coin.volume >= minVolume && 
      coin.lastPrice >= minPrice &&
      coin.trades >= 1000
    );

    const scored = filtered.map(coin => {
      const volatility = ((coin.highPrice - coin.lowPrice) / coin.lastPrice) * 100;
      const absChangePercent = Math.abs(coin.priceChangePercent);
      
      const volumeScore = Math.min(coin.volume / 10000000, 10);
      const volatilityScore = Math.min(volatility, 10);
      const momentumScore = Math.min(absChangePercent, 10);
      const tradeScore = Math.min(coin.trades / 10000, 10);
      
      const totalScore = (volumeScore * 0.4) + (volatilityScore * 0.25) + (momentumScore * 0.25) + (tradeScore * 0.1);
      
      return {
        ...coin,
        volatility,
        score: totalScore
      };
    });

    scored.sort((a, b) => b.score - a.score);
    
    const topCoins = scored.slice(0, limit);
    
    console.log(`✅ تم اختيار أفضل ${topCoins.length} عملة بناءً على:
      - حجم التداول: ${topCoins[0]?.volume.toFixed(0)}$ (الأعلى)
      - التقلب: ${topCoins[0]?.volatility.toFixed(2)}% (الأعلى)
      - التغير: ${topCoins[0]?.priceChangePercent.toFixed(2)}% (الأعلى)
    `);
    
    return topCoins.map(coin => coin.symbol);
  }
}

module.exports = new MarketDataService();
