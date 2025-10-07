const axios = require('axios');

class UnifiedMarketService {
  constructor() {
    this.axiosConfig = {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    };
    this.cache = new Map();
    this.cacheTimeout = 60000;
  }

  async getAllCryptoAssets() {
    console.log('🔍 جلب جميع الأصول من جميع المنصات...');
    
    const sources = [
      this.getBinanceAssets(),
      this.getBybitAssets(),
      this.getOKXAssets(),
      this.getKuCoinAssets(),
      this.getGateIOAssets()
    ];

    try {
      const results = await Promise.allSettled(sources);
      
      const allAssets = new Map();
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          for (const asset of result.value) {
            if (!allAssets.has(asset.symbol)) {
              allAssets.set(asset.symbol, asset);
            }
          }
        }
      }

      const assetsArray = Array.from(allAssets.values());
      console.log(`✅ تم جلب ${assetsArray.length} أصل من جميع المنصات`);
      
      return assetsArray;
    } catch (error) {
      console.error('❌ خطأ في جلب الأصول:', error.message);
      return [];
    }
  }

  async getBinanceAssets() {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo', {
        timeout: 10000
      });
      
      if (response.data && response.data.symbols) {
        const assets = response.data.symbols
          .filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING')
          .map(s => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            source: 'Binance'
          }));
        
        console.log(`✅ Binance: ${assets.length} أصل`);
        return assets;
      }
      return [];
    } catch (error) {
      console.error('❌ Binance assets error:', error.message);
      return [];
    }
  }

  async getBybitAssets() {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/instruments-info', {
        params: { category: 'spot' },
        timeout: 10000
      });
      
      if (response.data && response.data.result && response.data.result.list) {
        const assets = response.data.result.list
          .filter(s => s.symbol.endsWith('USDT') && s.status === 'Trading')
          .map(s => ({
            symbol: s.symbol,
            baseAsset: s.baseCoin,
            quoteAsset: s.quoteCoin,
            source: 'Bybit'
          }));
        
        console.log(`✅ Bybit: ${assets.length} أصل`);
        return assets;
      }
      return [];
    } catch (error) {
      console.error('❌ Bybit assets error:', error.message);
      return [];
    }
  }

  async getOKXAssets() {
    try {
      const response = await axios.get('https://www.okx.com/api/v5/public/instruments', {
        params: { instType: 'SPOT' },
        timeout: 10000
      });
      
      if (response.data && response.data.data) {
        const assets = response.data.data
          .filter(s => s.instId.endsWith('-USDT'))
          .map(s => {
            const parts = s.instId.split('-');
            return {
              symbol: parts[0] + parts[1],
              baseAsset: parts[0],
              quoteAsset: parts[1],
              source: 'OKX'
            };
          });
        
        console.log(`✅ OKX: ${assets.length} أصل`);
        return assets;
      }
      return [];
    } catch (error) {
      console.error('❌ OKX assets error:', error.message);
      return [];
    }
  }

  async getKuCoinAssets() {
    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/symbols', {
        timeout: 10000
      });
      
      if (response.data && response.data.data) {
        const assets = response.data.data
          .filter(s => s.quoteCurrency === 'USDT' && s.enableTrading)
          .map(s => ({
            symbol: s.baseCurrency + s.quoteCurrency,
            baseAsset: s.baseCurrency,
            quoteAsset: s.quoteCurrency,
            source: 'KuCoin'
          }));
        
        console.log(`✅ KuCoin: ${assets.length} أصل`);
        return assets;
      }
      return [];
    } catch (error) {
      console.error('❌ KuCoin assets error:', error.message);
      return [];
    }
  }

  async getGateIOAssets() {
    try {
      const response = await axios.get('https://api.gateio.ws/api/v4/spot/currency_pairs', {
        timeout: 10000
      });
      
      if (response.data && Array.isArray(response.data)) {
        const assets = response.data
          .filter(s => s.id.endsWith('_USDT') && s.trade_status === 'tradable')
          .map(s => {
            const parts = s.id.split('_');
            return {
              symbol: parts[0] + parts[1],
              baseAsset: parts[0],
              quoteAsset: parts[1],
              source: 'Gate.io'
            };
          });
        
        console.log(`✅ Gate.io: ${assets.length} أصل`);
        return assets;
      }
      return [];
    } catch (error) {
      console.error('❌ Gate.io assets error:', error.message);
      return [];
    }
  }

  async getCryptoPrice(symbol) {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }

    const sources = [
      () => this.getBinancePrice(symbol),
      () => this.getBybitPrice(symbol),
      () => this.getOKXPrice(symbol),
      () => this.getCoinGeckoPrice(symbol),
      () => this.getKuCoinPrice(symbol)
    ];

    const promises = sources.map(fn => fn().catch(err => null));
    
    try {
      const results = await Promise.allSettled(promises);
      
      const prices = results
        .filter(r => r.status === 'fulfilled' && r.value && r.value > 0)
        .map(r => r.value);

      if (prices.length > 0) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        this.cache.set(symbol, {
          price: avgPrice,
          timestamp: Date.now()
        });
        
        console.log(`✅ متوسط السعر من ${prices.length} مصادر: ${symbol} = $${avgPrice.toFixed(2)}`);
        return avgPrice;
      }

      throw new Error('فشل جلب السعر من جميع المصادر');
    } catch (error) {
      console.error(`❌ خطأ في جلب السعر لـ ${symbol}:`, error.message);
      throw error;
    }
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

  async getBybitPrice(symbol) {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: { category: 'spot', symbol },
        timeout: 10000
      });
      
      if (response.data && response.data.result && response.data.result.list && response.data.result.list[0]) {
        return parseFloat(response.data.result.list[0].lastPrice);
      }
      throw new Error('No price data');
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
      throw new Error('No price data');
    } catch (error) {
      throw new Error('OKX API failed');
    }
  }

  async getKuCoinPrice(symbol) {
    try {
      const pair = symbol.replace('USDT', '-USDT');
      const response = await axios.get('https://api.kucoin.com/api/v1/market/orderbook/level1', {
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

  symbolToCoinId(symbol) {
    const map = {
      'BTCUSDT': 'bitcoin', 'ETHUSDT': 'ethereum', 'BNBUSDT': 'binancecoin',
      'XRPUSDT': 'ripple', 'ADAUSDT': 'cardano', 'DOGEUSDT': 'dogecoin',
      'SOLUSDT': 'solana', 'DOTUSDT': 'polkadot', 'MATICUSDT': 'matic-network',
      'LTCUSDT': 'litecoin', 'AVAXUSDT': 'avalanche-2', 'LINKUSDT': 'chainlink'
    };
    return map[symbol] || symbol.toLowerCase().replace('usdt', '');
  }

  async getTopMovers(type = 'gainers') {
    console.log(`🔥 جلب ${type === 'gainers' ? 'الرابحة' : 'الخاسرة'} من جميع المنصات...`);
    
    const sources = [
      this.getTopMoversFromBinance(type),
      this.getTopMoversFromBybit(type),
      this.getTopMoversFromOKX(type),
      this.getTopMoversFromKuCoin(type)
    ];

    try {
      const results = await Promise.allSettled(sources);
      
      const allMovers = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
          allMovers.push(...result.value);
        }
      }

      if (allMovers.length === 0) {
        throw new Error('لم يتم العثور على بيانات');
      }

      const moversMap = new Map();
      for (const mover of allMovers) {
        if (!moversMap.has(mover.symbol)) {
          moversMap.set(mover.symbol, mover);
        } else {
          const existing = moversMap.get(mover.symbol);
          existing.change = ((existing.change + mover.change) / 2);
        }
      }

      const uniqueMovers = Array.from(moversMap.values());
      uniqueMovers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
      
      const topMovers = uniqueMovers.slice(0, 20);
      console.log(`✅ تم جلب ${topMovers.length} عملة ${type === 'gainers' ? 'رابحة' : 'خاسرة'}`);
      
      return topMovers;
    } catch (error) {
      console.error('❌ خطأ في جلب Top Movers:', error.message);
      throw error;
    }
  }

  async getTopMoversFromBinance(type) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        timeout: 15000
      });

      if (response.data && Array.isArray(response.data)) {
        const movers = response.data
          .filter(ticker => ticker.symbol.endsWith('USDT') && parseFloat(ticker.quoteVolume) > 1000000)
          .map(ticker => ({
            symbol: ticker.symbol,
            price: parseFloat(ticker.lastPrice),
            change: parseFloat(ticker.priceChangePercent),
            volume: parseFloat(ticker.quoteVolume),
            source: 'Binance'
          }))
          .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
          .slice(0, 10);

        console.log(`✅ Binance Top Movers: ${movers.length}`);
        return movers;
      }
      return [];
    } catch (error) {
      console.error('❌ Binance Top Movers error:', error.message);
      return [];
    }
  }

  async getTopMoversFromBybit(type) {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: { category: 'spot' },
        timeout: 15000
      });

      if (response.data && response.data.result && response.data.result.list) {
        const movers = response.data.result.list
          .filter(ticker => ticker.symbol.endsWith('USDT') && parseFloat(ticker.turnover24h) > 1000000)
          .map(ticker => ({
            symbol: ticker.symbol,
            price: parseFloat(ticker.lastPrice),
            change: parseFloat(ticker.price24hPcnt) * 100,
            volume: parseFloat(ticker.turnover24h),
            source: 'Bybit'
          }))
          .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
          .slice(0, 10);

        console.log(`✅ Bybit Top Movers: ${movers.length}`);
        return movers;
      }
      return [];
    } catch (error) {
      console.error('❌ Bybit Top Movers error:', error.message);
      return [];
    }
  }

  async getTopMoversFromOKX(type) {
    try {
      const response = await axios.get('https://www.okx.com/api/v5/market/tickers', {
        params: { instType: 'SPOT' },
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const movers = response.data.data
          .filter(ticker => ticker.instId.endsWith('-USDT'))
          .map(ticker => {
            const parts = ticker.instId.split('-');
            const changePercent = ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100;
            return {
              symbol: parts[0] + parts[1],
              price: parseFloat(ticker.last),
              change: changePercent,
              volume: parseFloat(ticker.vol24h),
              source: 'OKX'
            };
          })
          .filter(m => m.volume > 1000000 && !isNaN(m.change))
          .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
          .slice(0, 10);

        console.log(`✅ OKX Top Movers: ${movers.length}`);
        return movers;
      }
      return [];
    } catch (error) {
      console.error('❌ OKX Top Movers error:', error.message);
      return [];
    }
  }

  async getTopMoversFromKuCoin(type) {
    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers', {
        timeout: 15000
      });

      if (response.data && response.data.data && response.data.data.ticker) {
        const movers = response.data.data.ticker
          .filter(ticker => ticker.symbol.endsWith('-USDT') && parseFloat(ticker.volValue) > 1000000)
          .map(ticker => ({
            symbol: ticker.symbol.replace('-', ''),
            price: parseFloat(ticker.last),
            change: parseFloat(ticker.changeRate) * 100,
            volume: parseFloat(ticker.volValue),
            source: 'KuCoin'
          }))
          .filter(m => !isNaN(m.change))
          .sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change)
          .slice(0, 10);

        console.log(`✅ KuCoin Top Movers: ${movers.length}`);
        return movers;
      }
      return [];
    } catch (error) {
      console.error('❌ KuCoin Top Movers error:', error.message);
      return [];
    }
  }

  async getCryptoCandles(symbol, interval, limit = 100) {
    console.log(`🕯️ جلب بيانات الشموع من مصادر متعددة لـ ${symbol}...`);
    
    const sources = [
      this.getCandlesFromBinance(symbol, interval, limit),
      this.getCandlesFromKuCoin(symbol, interval, limit),
      this.getCandlesFromBybit(symbol, interval, limit),
      this.getCandlesFromOKX(symbol, interval, limit)
    ];

    try {
      const candles = await Promise.any(sources);
      console.log(`✅ تم جلب ${candles.length} شمعة لـ ${symbol}`);
      return candles;
    } catch (error) {
      console.error('❌ فشل جلب بيانات الشموع من جميع المصادر');
      throw new Error('فشل جلب بيانات الشموع من جميع المصادر');
    }
  }

  async getCandlesFromBinance(symbol, interval, limit) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol, interval, limit },
        timeout: 10000
      });
      
      return response.data.map(candle => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6]
      }));
    } catch (error) {
      throw new Error('Binance candles failed');
    }
  }

  async getCandlesFromKuCoin(symbol, interval, limit) {
    try {
      const intervalMap = {
        '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
        '1h': '1hour', '4h': '4hour', '1d': '1day', '1w': '1week'
      };
      
      const pair = symbol.replace('USDT', '-USDT');
      const kucoinInterval = intervalMap[interval] || '1hour';
      
      const response = await axios.get('https://api.kucoin.com/api/v1/market/candles', {
        params: {
          symbol: pair,
          type: kucoinInterval
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        return response.data.data.slice(0, limit).reverse().map(candle => ({
          openTime: parseInt(candle[0]) * 1000,
          open: candle[1],
          high: candle[3],
          low: candle[4],
          close: candle[2],
          volume: candle[5],
          closeTime: parseInt(candle[0]) * 1000
        }));
      }
      throw new Error('No candles data');
    } catch (error) {
      throw new Error('KuCoin candles failed');
    }
  }

  async getCandlesFromBybit(symbol, interval, limit) {
    try {
      const intervalMap = {
        '1m': '1', '5m': '5', '15m': '15', '30m': '30',
        '1h': '60', '4h': '240', '1d': 'D', '1w': 'W'
      };
      
      const bybitInterval = intervalMap[interval] || '60';
      
      const response = await axios.get('https://api.bybit.com/v5/market/kline', {
        params: {
          category: 'spot',
          symbol: symbol,
          interval: bybitInterval,
          limit: limit
        },
        timeout: 10000
      });

      if (response.data && response.data.result && response.data.result.list) {
        return response.data.result.list.reverse().map(candle => ({
          openTime: parseInt(candle[0]),
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
          closeTime: parseInt(candle[0])
        }));
      }
      throw new Error('No candles data');
    } catch (error) {
      throw new Error('Bybit candles failed');
    }
  }

  async getCandlesFromOKX(symbol, interval, limit) {
    try {
      const intervalMap = {
        '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
        '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W'
      };
      
      const base = symbol.replace('USDT', '');
      const instId = `${base}-USDT`;
      const okxInterval = intervalMap[interval] || '1H';
      
      const response = await axios.get('https://www.okx.com/api/v5/market/candles', {
        params: {
          instId: instId,
          bar: okxInterval,
          limit: limit
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        return response.data.data.reverse().map(candle => ({
          openTime: parseInt(candle[0]),
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
          closeTime: parseInt(candle[0])
        }));
      }
      throw new Error('No candles data');
    } catch (error) {
      throw new Error('OKX candles failed');
    }
  }
}

module.exports = new UnifiedMarketService();
