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

  async getCurrentPrice(symbol, marketType = 'spot') {
    const cacheKey = `${symbol}_${marketType}`;
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 Cache hit for ${symbol}: $${cached.price}`);
      return cached.price;
    }

    console.log(`🔍 Fetching real-time price for ${symbol} from multiple sources...`);

    const price = await this.getPriceFromOKX(symbol) ||
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

    const stats = await this.get24hrStatsFromCoinGecko(symbol) ||
                  await this.get24hrStatsFromBinance(symbol);

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

  async getCandles(symbol, interval, limit = 100, marketType = 'spot') {
    console.log(`🕯️ Fetching real candles for ${symbol} (${interval})...`);

    const candles = await this.getCandlesFromOKX(symbol, interval, limit) ||
                    await this.getCandlesFromBybit(symbol, interval, limit) ||
                    await this.getCandlesFromBinance(symbol, interval, limit);

    if (candles && candles.length > 0) {
      return candles;
    }

    throw new Error(`فشل في الحصول على بيانات الشموع الحقيقية لـ ${symbol}`);
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
}

module.exports = new MarketDataService();
