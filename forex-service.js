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
      const config = require('./config');
      if (!config.ALPHA_VANTAGE_API_KEY) {
        return null;
      }
      
      const fromCurrency = pair.slice(0, 3);
      const toCurrency = pair.slice(3, 6);
      
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'CURRENCY_EXCHANGE_RATE',
          from_currency: fromCurrency,
          to_currency: toCurrency,
          apikey: config.ALPHA_VANTAGE_API_KEY
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
      
      const config = require('./config');
      if (config.ALPHA_VANTAGE_API_KEY) {
        const stats = await this.get24hrStatsFromAlphaVantage(pair);
        if (stats) {
          return stats;
        }
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

  async getCandlesFromYahooFinance(pair, interval, limit = 100) {
    try {
      const yahooSymbol = `${pair}=X`;
      
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '1h',
        '1d': '1d',
        '1w': '1wk'
      };
      
      const rangeMap = {
        '1m': '1d',
        '5m': '5d',
        '15m': '5d',
        '30m': '1mo',
        '1h': '1mo',
        '4h': '3mo',
        '1d': '1y',
        '1w': '5y'
      };

      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
          interval: intervalMap[interval] || '1h',
          range: rangeMap[interval] || '1mo'
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      const result = response.data?.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        return null;
      }

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      
      const intervalMs = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '30m': 1800000,
        '1h': 3600000,
        '4h': 14400000,
        '1d': 86400000,
        '1w': 604800000
      }[interval] || 3600000;

      const candles = [];
      for (let i = 0; i < timestamps.length; i++) {
        const open = quote.open?.[i];
        const high = quote.high?.[i];
        const low = quote.low?.[i];
        const close = quote.close?.[i];
        
        if (open == null || high == null || low == null || close == null) {
          continue;
        }

        candles.push({
          openTime: timestamps[i] * 1000,
          open: parseFloat(open).toFixed(5),
          high: parseFloat(high).toFixed(5),
          low: parseFloat(low).toFixed(5),
          close: parseFloat(close).toFixed(5),
          volume: quote.volume?.[i] || '0',
          closeTime: (timestamps[i] * 1000) + intervalMs
        });
      }

      if (candles.length > 0) {
        const limitedCandles = candles.slice(-limit);
        console.log(`✅ Yahoo Finance: Got ${limitedCandles.length} real forex candles for ${pair}`);
        return limitedCandles;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Yahoo Finance forex candles error for ${pair}:`, error.message);
      return null;
    }
  }

  async getCandlesFromAlphaVantage(pair, interval, limit = 100) {
    try {
      const config = require('./config');
      if (!config.ALPHA_VANTAGE_API_KEY) {
        return null;
      }
      
      const fromCurrency = pair.slice(0, 3);
      const toCurrency = pair.slice(3, 6);
      
      const intervalMap = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1h': '60min',
        '4h': '60min',
        '1d': 'daily',
        '1w': 'weekly'
      };
      
      const apiInterval = intervalMap[interval] || '60min';
      const isIntraday = !['daily', 'weekly'].includes(apiInterval);
      const functionType = isIntraday ? 'FX_INTRADAY' : (apiInterval === 'weekly' ? 'FX_WEEKLY' : 'FX_DAILY');

      const params = {
        function: functionType,
        from_symbol: fromCurrency,
        to_symbol: toCurrency,
        apikey: config.ALPHA_VANTAGE_API_KEY,
        outputsize: 'full'
      };
      
      if (isIntraday) {
        params.interval = apiInterval;
      }

      const response = await axios.get('https://www.alphavantage.co/query', {
        params,
        timeout: 15000
      });

      let timeSeriesKey;
      if (isIntraday) {
        timeSeriesKey = `Time Series FX (${apiInterval})`;
      } else if (apiInterval === 'weekly') {
        timeSeriesKey = 'Time Series FX (Weekly)';
      } else {
        timeSeriesKey = 'Time Series FX (Daily)';
      }

      const timeSeries = response.data?.[timeSeriesKey];
      
      if (!timeSeries) {
        return null;
      }

      const intervalMs = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '30m': 1800000,
        '1h': 3600000,
        '4h': 14400000,
        '1d': 86400000,
        '1w': 604800000
      }[interval] || 3600000;

      const candles = Object.entries(timeSeries)
        .map(([timestamp, data]) => {
          const openTime = new Date(timestamp).getTime();
          return {
            openTime,
            open: parseFloat(data['1. open']).toFixed(5),
            high: parseFloat(data['2. high']).toFixed(5),
            low: parseFloat(data['3. low']).toFixed(5),
            close: parseFloat(data['4. close']).toFixed(5),
            volume: '0',
            closeTime: openTime + intervalMs
          };
        })
        .sort((a, b) => a.openTime - b.openTime)
        .slice(-limit);

      if (candles.length > 0) {
        console.log(`✅ Alpha Vantage: Got ${candles.length} real forex candles for ${pair}`);
        return candles;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Alpha Vantage forex candles error for ${pair}:`, error.message);
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
        const intervalMs = {
          '1m': 60000,
          '5m': 300000,
          '15m': 900000,
          '30m': 1800000,
          '1h': 3600000,
          '4h': 14400000,
          '1d': 86400000,
          '1w': 604800000
        }[interval] || 3600000;

        const candles = response.data.values.reverse().map(candle => {
          const openTime = new Date(candle.datetime).getTime();
          return {
            openTime,
            open: parseFloat(candle.open).toFixed(5),
            high: parseFloat(candle.high).toFixed(5),
            low: parseFloat(candle.low).toFixed(5),
            close: parseFloat(candle.close).toFixed(5),
            volume: candle.volume || '0',
            closeTime: openTime + intervalMs
          };
        });

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
      
      let candles = await this.getCandlesFromTwelveData(pair, interval, limit);
      
      if (candles && candles.length > 0) {
        return candles;
      }

      console.log(`⚠️ TwelveData failed, trying Yahoo Finance for ${pair}...`);
      candles = await this.getCandlesFromYahooFinance(pair, interval, limit);
      
      if (candles && candles.length > 0) {
        return candles;
      }

      const config = require('./config');
      if (config.ALPHA_VANTAGE_API_KEY) {
        console.log(`⚠️ Yahoo Finance failed, trying Alpha Vantage for ${pair}...`);
        candles = await this.getCandlesFromAlphaVantage(pair, interval, limit);
        
        if (candles && candles.length > 0) {
          return candles;
        }
      }

      throw new Error(`فشل في الحصول على بيانات الشموع الحقيقية لـ ${pair} من جميع المصادر`);
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
