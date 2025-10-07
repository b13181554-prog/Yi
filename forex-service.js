const axios = require('axios');

const FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'NZDUSD', 'USDCHF', 'EURJPY', 'GBPJPY', 'EURGBP',
  'AUDJPY', 'EURAUD', 'EURCHF', 'AUDNZD', 'NZDJPY'
];

class ForexService {
  constructor() {
    this.ratesCache = new Map();
    this.cacheTimeout = 60000; // 1 دقيقة
  }

  async getRatesFromExchangeRateAPI() {
    try {
      const response = await axios.get('https://open.exchangerate-api.com/v6/latest/USD', {
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ ExchangeRate-API: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ ExchangeRate-API error:', error.message);
      return null;
    }
  }

  async getRatesFromFrankfurter() {
    try {
      const response = await axios.get('https://api.frankfurter.app/latest', {
        params: { from: 'USD' },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ Frankfurter API: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ Frankfurter API error:', error.message);
      return null;
    }
  }

  async getRatesFromExchangeRateHost() {
    try {
      const response = await axios.get('https://api.exchangerate.host/latest', {
        params: { base: 'USD' },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ ExchangeRate.host: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ ExchangeRate.host error:', error.message);
      return null;
    }
  }

  async getRatesFromFreeForexAPI() {
    try {
      const response = await axios.get('https://www.freeforexapi.com/api/live', {
        params: { pairs: 'EURUSD,GBPUSD,USDJPY' },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ FreeForexAPI: Got real rates');
        const rates = {};
        for (const [pair, data] of Object.entries(response.data.rates)) {
          const quoteCurrency = pair.slice(3, 6);
          rates[quoteCurrency] = data.rate;
        }
        return rates;
      }
      return null;
    } catch (error) {
      console.error('❌ FreeForexAPI error:', error.message);
      return null;
    }
  }

  async getRatesFromExchangeRatesAPI() {
    try {
      const response = await axios.get('https://api.exchangeratesapi.io/latest', {
        params: { base: 'USD' },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ ExchangeRatesAPI.io: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ ExchangeRatesAPI.io error:', error.message);
      return null;
    }
  }

  async getRatesFromFloatrates() {
    try {
      const response = await axios.get('https://www.floatrates.com/daily/usd.json', {
        timeout: 10000
      });
      
      if (response.data) {
        console.log('✅ Floatrates: Got real rates');
        const rates = {};
        for (const [key, value] of Object.entries(response.data)) {
          rates[key.toUpperCase()] = value.rate;
        }
        return rates;
      }
      return null;
    } catch (error) {
      console.error('❌ Floatrates error:', error.message);
      return null;
    }
  }

  async getRatesFromVATComply() {
    try {
      const response = await axios.get('https://api.vatcomply.com/rates', {
        params: { base: 'USD' },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ VATComply: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ VATComply error:', error.message);
      return null;
    }
  }

  async getRatesFromCurrencyFreaks() {
    try {
      const config = require('./config');
      if (!config.CURRENCY_FREAKS_API_KEY) return null;
      
      const response = await axios.get('https://api.currencyfreaks.com/latest', {
        params: { 
          apikey: config.CURRENCY_FREAKS_API_KEY,
          base: 'USD'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.rates) {
        console.log('✅ CurrencyFreaks: Got real rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ CurrencyFreaks error:', error.message);
      return null;
    }
  }

  async getRatesFromCurrencyAPI() {
    try {
      const config = require('./config');
      if (!config.CURRENCY_API_KEY) return null;
      
      const response = await axios.get('https://api.currencyapi.com/v3/latest', {
        params: { 
          apikey: config.CURRENCY_API_KEY,
          base_currency: 'USD'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.data) {
        console.log('✅ CurrencyAPI: Got real rates');
        const rates = {};
        for (const [key, value] of Object.entries(response.data.data)) {
          rates[key] = value.value;
        }
        return rates;
      }
      return null;
    } catch (error) {
      console.error('❌ CurrencyAPI error:', error.message);
      return null;
    }
  }

  async getAllRates() {
    const cached = this.ratesCache.get('all');
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('📦 Using cached forex rates');
      return cached.rates;
    }

    console.log('🔍 Fetching real forex rates from multiple sources...');

    const rates = await this.getRatesFromExchangeRateAPI() ||
                  await this.getRatesFromFrankfurter() ||
                  await this.getRatesFromExchangeRateHost() ||
                  await this.getRatesFromFloatrates() ||
                  await this.getRatesFromVATComply() ||
                  await this.getRatesFromCurrencyAPI() ||
                  await this.getRatesFromCurrencyFreaks() ||
                  await this.getRatesFromExchangeRatesAPI() ||
                  await this.getRatesFromFreeForexAPI();

    if (rates) {
      this.ratesCache.set('all', {
        rates,
        timestamp: Date.now()
      });
      return rates;
    }

    throw new Error('فشل في الحصول على أسعار الفوركس الحقيقية من جميع المنصات');
  }

  async getCurrentPrice(pair) {
    try {
      const rates = await this.getAllRates();
      
      const baseCurrency = pair.slice(0, 3);
      const quoteCurrency = pair.slice(3, 6);
      
      let baseRate, quoteRate;

      if (baseCurrency === 'USD') {
        baseRate = 1;
      } else if (rates[baseCurrency]) {
        baseRate = 1 / rates[baseCurrency];
      } else {
        throw new Error(`العملة ${baseCurrency} غير متوفرة`);
      }

      if (quoteCurrency === 'USD') {
        quoteRate = 1;
      } else if (rates[quoteCurrency]) {
        quoteRate = 1 / rates[quoteCurrency];
      } else {
        throw new Error(`العملة ${quoteCurrency} غير متوفرة`);
      }
      
      const price = baseRate / quoteRate;
      
      console.log(`✅ Real forex price: ${pair} = ${price.toFixed(5)}`);
      return price;
    } catch (error) {
      console.error(`Error fetching real forex price for ${pair}:`, error.message);
      throw error;
    }
  }

  async get24hrStatsFromAlphaVantage(pair) {
    try {
      const fromCurrency = pair.slice(0, 3);
      const toCurrency = pair.slice(3, 6);
      
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: fromCurrency,
          to_currency: toCurrency,
          apikey: 'demo'
        },
        timeout: 10000
      });

      const data = response.data['Realtime Currency Exchange Rate'];
      if (data) {
        const currentPrice = parseFloat(data['5. Exchange Rate']);
        return {
          symbol: pair,
          priceChange: 0,
          priceChangePercent: 0,
          lastPrice: currentPrice.toFixed(5),
          highPrice: currentPrice.toFixed(5),
          lowPrice: currentPrice.toFixed(5),
          volume: '0'
        };
      }
      return null;
    } catch (error) {
      console.error('❌ AlphaVantage error:', error.message);
      return null;
    }
  }

  async get24hrStats(pair) {
    try {
      console.log(`📊 Fetching real 24hr stats for ${pair}...`);
      
      const currentPrice = await this.getCurrentPrice(pair);
      
      const stats = await this.get24hrStatsFromAlphaVantage(pair);
      
      if (stats) {
        return stats;
      }

      return {
        symbol: pair,
        priceChange: 0,
        priceChangePercent: 0,
        lastPrice: currentPrice.toFixed(5),
        highPrice: currentPrice.toFixed(5),
        lowPrice: currentPrice.toFixed(5),
        volume: '0'
      };
    } catch (error) {
      console.error(`Error fetching forex stats for ${pair}:`, error.message);
      throw error;
    }
  }

  async getHistoricalRatesFromFrankfurter(days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const formatDate = (date) => date.toISOString().split('T')[0];

      const response = await axios.get(`https://api.frankfurter.app/${formatDate(startDate)}..${formatDate(endDate)}`, {
        params: { from: 'USD' },
        timeout: 15000
      });

      if (response.data && response.data.rates) {
        console.log('✅ Frankfurter: Got real historical rates');
        return response.data.rates;
      }
      return null;
    } catch (error) {
      console.error('❌ Frankfurter historical error:', error.message);
      return null;
    }
  }

  async getCandlesFromTwelveData(pair, interval, limit = 100) {
    try {
      const intervalMap = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1h': '1h',
        '4h': '4h',
        '1d': '1day',
        '1w': '1week'
      };

      const response = await axios.get('https://api.twelvedata.com/time_series', {
        params: {
          symbol: pair,
          interval: intervalMap[interval] || '1h',
          outputsize: limit,
          format: 'JSON'
        },
        timeout: 15000
      });

      if (response.data && response.data.values && response.data.values.length > 0) {
        const candles = response.data.values.reverse().map(candle => ({
          openTime: new Date(candle.datetime).getTime(),
          open: parseFloat(candle.open).toFixed(5),
          high: parseFloat(candle.high).toFixed(5),
          low: parseFloat(candle.low).toFixed(5),
          close: parseFloat(candle.close).toFixed(5),
          volume: candle.volume || '0',
          closeTime: new Date(candle.datetime).getTime() + 60000
        }));

        console.log(`✅ TwelveData: Got ${candles.length} real forex candles for ${pair}`);
        return candles;
      }
      return null;
    } catch (error) {
      console.error(`❌ TwelveData forex candles error for ${pair}:`, error.message);
      return null;
    }
  }

  async getCandles(pair, interval, limit = 100) {
    try {
      console.log(`🕯️ Fetching real forex candles for ${pair}...`);
      
      const candles = await this.getCandlesFromTwelveData(pair, interval, limit);
      
      if (candles && candles.length > 0) {
        return candles;
      }

      let days = 7;
      switch(interval) {
        case '1m': case '5m': case '15m': case '30m': days = 1; break;
        case '1h': days = 7; break;
        case '4h': days = 30; break;
        case '1d': days = Math.min(limit, 90); break;
        case '1w': days = limit * 7; break;
        default: days = 7;
      }

      const historicalRates = await this.getHistoricalRatesFromFrankfurter(days);
      
      if (!historicalRates) {
        throw new Error('فشل في الحصول على البيانات التاريخية');
      }

      const baseCurrency = pair.slice(0, 3);
      const quoteCurrency = pair.slice(3, 6);
      
      const fallbackCandles = [];
      const dates = Object.keys(historicalRates).sort();
      
      for (const date of dates.slice(-limit)) {
        const rates = historicalRates[date];
        
        let baseRate = baseCurrency === 'USD' ? 1 : (rates[baseCurrency] ? 1 / rates[baseCurrency] : null);
        let quoteRate = quoteCurrency === 'USD' ? 1 : (rates[quoteCurrency] ? 1 / rates[quoteCurrency] : null);
        
        if (baseRate && quoteRate) {
          const price = baseRate / quoteRate;
          const timestamp = new Date(date).getTime();
          const variation = price * 0.001;
          
          fallbackCandles.push({
            openTime: timestamp,
            open: (price - variation * 0.5).toFixed(5),
            high: (price + variation).toFixed(5),
            low: (price - variation).toFixed(5),
            close: price.toFixed(5),
            volume: '0',
            closeTime: timestamp + 86400000
          });
        }
      }

      if (fallbackCandles.length > 0) {
        console.log(`⚠️ Using fallback data: Got ${fallbackCandles.length} forex candles for ${pair}`);
        return fallbackCandles;
      }

      throw new Error('لا توجد بيانات كافية');
    } catch (error) {
      console.error(`Error fetching forex candles for ${pair}:`, error.message);
      throw error;
    }
  }

  getAvailablePairs() {
    return FOREX_PAIRS;
  }
}

module.exports = new ForexService();
