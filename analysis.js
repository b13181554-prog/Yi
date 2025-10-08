const { RSI, MACD, EMA, SMA, BollingerBands, ATR, Stochastic, ADX } = require('technicalindicators');
const AdvancedAnalysis = require('./advanced-analysis');

class TechnicalAnalysis {
  constructor(candles) {
    this.candles = candles;
    this.closes = candles.map(c => parseFloat(c.close));
    this.highs = candles.map(c => parseFloat(c.high));
    this.lows = candles.map(c => parseFloat(c.low));
    this.opens = candles.map(c => parseFloat(c.open));
    this.volumes = candles.map(c => parseFloat(c.volume));
    
    // تهيئة التحليل المتقدم
    this.advancedAnalysis = new AdvancedAnalysis(candles);
  }

  formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return 'N/A';
    
    price = parseFloat(price);
    
    if (price === 0) return '0';
    
    let str = price.toString();
    
    if (str.includes('e-')) {
      try {
        const parts = str.split('e-');
        const decimals = parseInt(parts[1], 10);
        const precision = Math.min(decimals + (parts[0].replace('.', '').length - 1), 20);
        str = price.toFixed(precision);
      } catch (e) {
        return str;
      }
    }
    
    str = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    
    return str;
  }

  calculateRSI(period = 14) {
    const rsiInput = {
      values: this.closes,
      period: period
    };
    const rsiValues = RSI.calculate(rsiInput);
    const currentRSI = rsiValues[rsiValues.length - 1];
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (currentRSI > 70) {
      signal = 'تشبع شرائي';
      emoji = '🔴';
      recommendation = 'فرصة بيع محتملة';
    } else if (currentRSI < 30) {
      signal = 'تشبع بيعي';
      emoji = '🟢';
      recommendation = 'فرصة شراء محتملة';
    } else if (currentRSI >= 50 && currentRSI <= 70) {
      signal = 'صاعد';
      emoji = '🔺';
      recommendation = 'اتجاه صعودي';
    } else if (currentRSI >= 30 && currentRSI < 50) {
      signal = 'هابط';
      emoji = '🔻';
      recommendation = 'اتجاه هبوطي';
    }
    
    return {
      name: 'RSI',
      value: currentRSI?.toFixed(2) || 'N/A',
      signal,
      emoji,
      recommendation
    };
  }

  calculateMACD() {
    const macdInput = {
      values: this.closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    };
    
    const macdValues = MACD.calculate(macdInput);
    const current = macdValues[macdValues.length - 1];
    
    if (!current) {
      return {
        name: 'MACD',
        value: 'N/A',
        signal: 'غير متاح',
        emoji: '⚪',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (current.MACD > current.signal && current.MACD > 0) {
      signal = 'صاعد قوي';
      emoji = '🟢';
      recommendation = 'إشارة شراء قوية';
    } else if (current.MACD > current.signal && current.MACD < 0) {
      signal = 'بداية صعود';
      emoji = '🔺';
      recommendation = 'بداية اتجاه صعودي';
    } else if (current.MACD < current.signal && current.MACD < 0) {
      signal = 'هابط قوي';
      emoji = '🔴';
      recommendation = 'إشارة بيع قوية';
    } else if (current.MACD < current.signal && current.MACD > 0) {
      signal = 'بداية هبوط';
      emoji = '🔻';
      recommendation = 'بداية اتجاه هبوطي';
    }
    
    return {
      name: 'MACD',
      value: `${current.MACD?.toFixed(4)} / ${current.signal?.toFixed(4)}`,
      signal,
      emoji,
      recommendation
    };
  }

  calculateEMA(period = 20) {
    const emaInput = {
      values: this.closes,
      period: period
    };
    const emaValues = EMA.calculate(emaInput);
    const currentEMA = emaValues[emaValues.length - 1];
    const currentPrice = this.closes[this.closes.length - 1];
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (currentPrice > currentEMA) {
      signal = 'صاعد';
      emoji = '🔺';
      recommendation = 'السعر فوق المتوسط - اتجاه صعودي';
    } else if (currentPrice < currentEMA) {
      signal = 'هابط';
      emoji = '🔻';
      recommendation = 'السعر تحت المتوسط - اتجاه هبوطي';
    }
    
    return {
      name: `EMA(${period})`,
      value: currentEMA?.toFixed(2) || 'N/A',
      signal,
      emoji,
      recommendation
    };
  }

  calculateSMA(period = 20) {
    const smaInput = {
      values: this.closes,
      period: period
    };
    const smaValues = SMA.calculate(smaInput);
    const currentSMA = smaValues[smaValues.length - 1];
    const currentPrice = this.closes[this.closes.length - 1];
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (currentPrice > currentSMA) {
      signal = 'صاعد';
      emoji = '🔺';
      recommendation = 'السعر فوق المتوسط - اتجاه صعودي';
    } else if (currentPrice < currentSMA) {
      signal = 'هابط';
      emoji = '🔻';
      recommendation = 'السعر تحت المتوسط - اتجاه هبوطي';
    }
    
    return {
      name: `SMA(${period})`,
      value: currentSMA?.toFixed(2) || 'N/A',
      signal,
      emoji,
      recommendation
    };
  }

  calculateBollingerBands(period = 20, stdDev = 2) {
    const bbInput = {
      values: this.closes,
      period: period,
      stdDev: stdDev
    };
    const bbValues = BollingerBands.calculate(bbInput);
    const current = bbValues[bbValues.length - 1];
    const currentPrice = this.closes[this.closes.length - 1];
    
    if (!current) {
      return {
        name: 'Bollinger Bands',
        value: 'N/A',
        signal: 'غير متاح',
        emoji: '⚪',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (currentPrice >= current.upper) {
      signal = 'تشبع شرائي';
      emoji = '🔴';
      recommendation = 'السعر عند الحد العلوي - فرصة بيع';
    } else if (currentPrice <= current.lower) {
      signal = 'تشبع بيعي';
      emoji = '🟢';
      recommendation = 'السعر عند الحد السفلي - فرصة شراء';
    } else if (currentPrice > current.middle) {
      signal = 'صاعد';
      emoji = '🔺';
      recommendation = 'السعر فوق الوسط';
    } else if (currentPrice < current.middle) {
      signal = 'هابط';
      emoji = '🔻';
      recommendation = 'السعر تحت الوسط';
    }
    
    return {
      name: 'Bollinger Bands',
      value: `${current.upper?.toFixed(2)} / ${current.middle?.toFixed(2)} / ${current.lower?.toFixed(2)}`,
      signal,
      emoji,
      recommendation
    };
  }

  calculateATR(period = 14) {
    const atrInput = {
      high: this.highs,
      low: this.lows,
      close: this.closes,
      period: period
    };
    const atrValues = ATR.calculate(atrInput);
    const currentATR = atrValues[atrValues.length - 1];
    const currentPrice = this.closes[this.closes.length - 1];
    
    const volatilityPercent = (currentATR / currentPrice) * 100;
    
    let signal = 'منخفضة';
    let emoji = '🟢';
    let recommendation = '';
    
    if (volatilityPercent > 5) {
      signal = 'عالية جداً';
      emoji = '🔴';
      recommendation = 'تقلب عالي - خطر مرتفع';
    } else if (volatilityPercent > 3) {
      signal = 'عالية';
      emoji = '🟠';
      recommendation = 'تقلب متوسط إلى عالي';
    } else if (volatilityPercent > 1.5) {
      signal = 'متوسطة';
      emoji = '🟡';
      recommendation = 'تقلب متوسط';
    } else {
      signal = 'منخفضة';
      emoji = '🟢';
      recommendation = 'تقلب منخفض - مناسب للمحافظين';
    }
    
    return {
      name: 'ATR (التقلب)',
      value: currentATR?.toFixed(2) || 'N/A',
      signal,
      emoji,
      recommendation
    };
  }

  calculateStochastic(period = 14, signalPeriod = 3) {
    const stochInput = {
      high: this.highs,
      low: this.lows,
      close: this.closes,
      period: period,
      signalPeriod: signalPeriod
    };
    
    const stochValues = Stochastic.calculate(stochInput);
    const current = stochValues[stochValues.length - 1];
    
    if (!current) {
      return {
        name: 'Stochastic',
        value: 'N/A',
        signal: 'غير متاح',
        emoji: '⚪',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    let signal = 'محايد';
    let emoji = '⚪';
    let recommendation = '';
    
    if (current.k > 80 && current.d > 80) {
      signal = 'تشبع شرائي';
      emoji = '🔴';
      recommendation = 'منطقة تشبع شرائي - فرصة بيع محتملة';
    } else if (current.k < 20 && current.d < 20) {
      signal = 'تشبع بيعي';
      emoji = '🟢';
      recommendation = 'منطقة تشبع بيعي - فرصة شراء محتملة';
    } else if (current.k > current.d && current.k < 80) {
      signal = 'صاعد';
      emoji = '🔺';
      recommendation = 'تقاطع صعودي';
    } else if (current.k < current.d && current.k > 20) {
      signal = 'هابط';
      emoji = '🔻';
      recommendation = 'تقاطع هبوطي';
    }
    
    return {
      name: 'Stochastic',
      value: `K: ${current.k?.toFixed(2)} / D: ${current.d?.toFixed(2)}`,
      signal,
      emoji,
      recommendation
    };
  }

  calculateADX(period = 14) {
    const adxInput = {
      high: this.highs,
      low: this.lows,
      close: this.closes,
      period: period
    };
    
    const adxValues = ADX.calculate(adxInput);
    const current = adxValues[adxValues.length - 1];
    
    if (!current) {
      return {
        name: 'ADX',
        value: 'N/A',
        signal: 'غير متاح',
        emoji: '⚪',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    let signal = 'ضعيف';
    let emoji = '⚪';
    let recommendation = '';
    
    if (current.adx > 50) {
      signal = 'اتجاه قوي جداً';
      emoji = '🔥';
      recommendation = 'اتجاه قوي جداً - فرصة متابعة الاتجاه';
    } else if (current.adx > 25) {
      signal = 'اتجاه قوي';
      emoji = '💪';
      recommendation = 'اتجاه قوي - يمكن المتابعة';
    } else if (current.adx > 20) {
      signal = 'اتجاه متوسط';
      emoji = '🟡';
      recommendation = 'اتجاه متوسط القوة';
    } else {
      signal = 'اتجاه ضعيف';
      emoji = '⚪';
      recommendation = 'لا يوجد اتجاه واضح - تجنب التداول';
    }
    
    const trendDirection = current.pdi > current.mdi ? 'صاعد' : 'هابط';
    
    return {
      name: 'ADX',
      value: current.adx?.toFixed(2) || 'N/A',
      signal: `${signal} - ${trendDirection}`,
      emoji,
      recommendation
    };
  }

  calculateVolumeAnalysis() {
    if (this.volumes.length < 20) {
      return {
        name: 'تحليل الحجم',
        value: 'N/A',
        signal: 'غير متاح',
        emoji: '⚪',
        recommendation: 'بيانات غير كافية'
      };
    }
    
    const currentVolume = this.volumes[this.volumes.length - 1];
    const avgVolume = this.volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volumeRatio = currentVolume / avgVolume;
    
    let signal = 'عادي';
    let emoji = '⚪';
    let recommendation = '';
    
    if (volumeRatio > 2) {
      signal = 'حجم ضخم';
      emoji = '🔥';
      recommendation = 'حجم تداول ضخم - حركة قوية متوقعة';
    } else if (volumeRatio > 1.5) {
      signal = 'حجم عالي';
      emoji = '📈';
      recommendation = 'حجم تداول عالي - نشاط قوي';
    } else if (volumeRatio > 0.8) {
      signal = 'حجم عادي';
      emoji = '⚪';
      recommendation = 'حجم تداول عادي';
    } else {
      signal = 'حجم منخفض';
      emoji = '📉';
      recommendation = 'حجم تداول منخفض - حذر من التحركات';
    }
    
    return {
      name: 'تحليل الحجم',
      value: `${(volumeRatio * 100).toFixed(0)}% من المتوسط`,
      signal,
      emoji,
      recommendation
    };
  }

  getAnalysis(indicators = ['RSI', 'MACD', 'EMA', 'SMA', 'BBANDS', 'ATR', 'STOCH', 'ADX', 'VOLUME', 'FIBONACCI', 'CANDLE_PATTERNS', 'HEAD_SHOULDERS', 'SUPPORT_RESISTANCE']) {
    const results = [];
    
    if (indicators.includes('RSI')) {
      results.push(this.calculateRSI());
    }
    if (indicators.includes('MACD')) {
      results.push(this.calculateMACD());
    }
    if (indicators.includes('EMA')) {
      results.push(this.calculateEMA(20));
    }
    if (indicators.includes('SMA')) {
      results.push(this.calculateSMA(20));
    }
    if (indicators.includes('BBANDS')) {
      results.push(this.calculateBollingerBands());
    }
    if (indicators.includes('ATR')) {
      results.push(this.calculateATR());
    }
    if (indicators.includes('STOCH')) {
      results.push(this.calculateStochastic());
    }
    if (indicators.includes('ADX')) {
      results.push(this.calculateADX());
    }
    if (indicators.includes('VOLUME')) {
      results.push(this.calculateVolumeAnalysis());
    }
    if (indicators.includes('FIBONACCI')) {
      results.push(this.advancedAnalysis.calculateFibonacci());
    }
    if (indicators.includes('CANDLE_PATTERNS')) {
      results.push(this.advancedAnalysis.detectCandlePatterns());
    }
    if (indicators.includes('HEAD_SHOULDERS')) {
      results.push(this.advancedAnalysis.detectHeadAndShoulders());
    }
    if (indicators.includes('SUPPORT_RESISTANCE')) {
      results.push(this.advancedAnalysis.calculateSupportResistance());
    }
    
    return results;
  }

  getTradeRecommendationWithMarketType(marketType = 'spot', tradingType = 'spot') {
    const currentPrice = this.closes[this.closes.length - 1];
    const analysisTime = new Date().toLocaleString('ar-SA', { 
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const rsi = this.calculateRSI();
    const macd = this.calculateMACD();
    const bb = this.calculateBollingerBands();
    const atr = this.calculateATR();
    const stoch = this.calculateStochastic();
    const adx = this.calculateADX();
    const volume = this.calculateVolumeAnalysis();
    
    const fibonacci = this.advancedAnalysis.calculateFibonacci();
    const candlePatterns = this.advancedAnalysis.detectCandlePatterns();
    const supportResistance = this.advancedAnalysis.calculateSupportResistance();
    
    let buySignals = 0;
    let sellSignals = 0;
    let strength = 0;
    
    if (rsi.signal.includes('تشبع بيعي')) { buySignals++; strength++; }
    if (rsi.signal.includes('تشبع شرائي')) { sellSignals++; strength++; }
    if (rsi.signal.includes('صاعد')) buySignals += 0.5;
    if (rsi.signal.includes('هابط')) sellSignals += 0.5;
    
    if (macd.signal.includes('صاعد')) { buySignals++; strength++; }
    if (macd.signal.includes('هابط')) { sellSignals++; strength++; }
    
    if (bb.signal.includes('تشبع بيعي')) { buySignals++; strength++; }
    if (bb.signal.includes('تشبع شرائي')) { sellSignals++; strength++; }
    
    if (stoch.signal.includes('تشبع بيعي')) buySignals++;
    if (stoch.signal.includes('تشبع شرائي')) sellSignals++;
    
    if (fibonacci.signal.includes('دعم')) { buySignals++; strength++; }
    if (fibonacci.signal.includes('مقاومة')) { sellSignals++; strength++; }
    
    if (candlePatterns.signal === 'صعودي') { buySignals += 1.5; strength++; }
    if (candlePatterns.signal === 'هبوطي') { sellSignals += 1.5; strength++; }
    
    if (supportResistance.signal.includes('دعم')) { buySignals++; strength++; }
    if (supportResistance.signal.includes('مقاومة')) { sellSignals++; strength++; }
    
    const adxValue = parseFloat(adx.value);
    if (adxValue > 25) {
      strength += 2;
      if (adx.signal.includes('صاعد')) buySignals += 0.5;
      if (adx.signal.includes('هابط')) sellSignals += 0.5;
    }
    
    if (volume.signal.includes('عالي') || volume.signal.includes('ضخم')) {
      strength++;
    }
    
    const atrValue = parseFloat(atr.value);
    const leverage = tradingType === 'futures' ? 10 : 1;
    
    const atrPercent = (atrValue / currentPrice) * 100;
    const stopLossPercent = Math.max(atrPercent * 1.5, 0.5);
    const takeProfitPercent = stopLossPercent * (tradingType === 'futures' ? 3 : 2);
    
    const stopLossDistance = (currentPrice * stopLossPercent) / 100;
    const takeProfitDistance = (currentPrice * takeProfitPercent) / 100;
    
    let recommendation = '';
    let entryPrice = currentPrice;
    let stopLoss = 0;
    let takeProfit = 0;
    let emoji = '';
    let confidence = '';
    
    const signalDifference = Math.abs(buySignals - sellSignals);
    
    if (buySignals > sellSignals) {
      recommendation = 'شراء';
      emoji = '🟢';
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + takeProfitDistance;
      
      if (signalDifference >= 3 && strength >= 5) {
        confidence = 'عالية جداً';
        emoji = '💚';
      } else if (signalDifference >= 2 && strength >= 3) {
        confidence = 'عالية';
      } else if (signalDifference >= 1) {
        confidence = 'متوسطة';
      } else {
        confidence = 'ضعيفة';
      }
    } else if (sellSignals > buySignals) {
      recommendation = 'بيع';
      emoji = '🔴';
      stopLoss = currentPrice + stopLossDistance;
      takeProfit = currentPrice - takeProfitDistance;
      
      if (signalDifference >= 3 && strength >= 5) {
        confidence = 'عالية جداً';
        emoji = '❤️';
      } else if (signalDifference >= 2 && strength >= 3) {
        confidence = 'عالية';
      } else if (signalDifference >= 1) {
        confidence = 'متوسطة';
      } else {
        confidence = 'ضعيفة';
      }
    } else {
      recommendation = 'انتظار';
      emoji = '🟡';
      confidence = 'منخفضة';
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + takeProfitDistance;
    }
    
    return {
      recommendation,
      action: recommendation,
      emoji,
      confidence,
      tradingType,
      marketType,
      leverage,
      analysisTime,
      entryPrice: this.formatPrice(entryPrice),
      stopLoss: this.formatPrice(stopLoss),
      takeProfit: this.formatPrice(takeProfit),
      riskRewardRatio: (Math.abs(takeProfitDistance) / stopLossDistance).toFixed(2),
      buySignals: buySignals.toFixed(1),
      sellSignals: sellSignals.toFixed(1),
      trendStrength: strength,
      indicators: {
        RSI: rsi,
        MACD: macd,
        EMA: this.calculateEMA(20),
        SMA: this.calculateSMA(20),
        BBANDS: bb,
        ATR: atr,
        STOCH: stoch,
        ADX: adx,
        VOLUME: volume,
        FIBONACCI: fibonacci,
        CANDLE_PATTERNS: candlePatterns,
        SUPPORT_RESISTANCE: supportResistance
      }
    };
  }

  getTradeRecommendation() {
    const currentPrice = this.closes[this.closes.length - 1];
    const rsi = this.calculateRSI();
    const macd = this.calculateMACD();
    const bb = this.calculateBollingerBands();
    const atr = this.calculateATR();
    const stoch = this.calculateStochastic();
    const adx = this.calculateADX();
    const volume = this.calculateVolumeAnalysis();
    
    let buySignals = 0;
    let sellSignals = 0;
    let strength = 0;
    
    // RSI signals
    if (rsi.signal.includes('تشبع بيعي')) { buySignals++; strength++; }
    if (rsi.signal.includes('تشبع شرائي')) { sellSignals++; strength++; }
    if (rsi.signal.includes('صاعد')) buySignals += 0.5;
    if (rsi.signal.includes('هابط')) sellSignals += 0.5;
    
    // MACD signals
    if (macd.signal.includes('صاعد')) { buySignals++; strength++; }
    if (macd.signal.includes('هابط')) { sellSignals++; strength++; }
    
    // Bollinger Bands signals
    if (bb.signal.includes('تشبع بيعي')) { buySignals++; strength++; }
    if (bb.signal.includes('تشبع شرائي')) { sellSignals++; strength++; }
    
    // Stochastic signals
    if (stoch.signal.includes('تشبع بيعي')) buySignals++;
    if (stoch.signal.includes('تشبع شرائي')) sellSignals++;
    
    // ADX for trend strength
    const adxValue = parseFloat(adx.value);
    if (adxValue > 25) {
      strength += 2;
      if (adx.signal.includes('صاعد')) buySignals += 0.5;
      if (adx.signal.includes('هابط')) sellSignals += 0.5;
    }
    
    // Volume confirmation
    if (volume.signal.includes('عالي') || volume.signal.includes('ضخم')) {
      strength++;
    }
    
    const atrValue = parseFloat(atr.value);
    
    const atrPercent = (atrValue / currentPrice) * 100;
    const stopLossPercent = Math.max(atrPercent * 1.5, 0.5);
    const takeProfitPercent = stopLossPercent * 2;
    
    const stopLossDistance = (currentPrice * stopLossPercent) / 100;
    const takeProfitDistance = (currentPrice * takeProfitPercent) / 100;
    
    let recommendation = '';
    let entryPrice = currentPrice;
    let stopLoss = 0;
    let takeProfit = 0;
    let emoji = '';
    let confidence = '';
    
    const signalDifference = Math.abs(buySignals - sellSignals);
    
    if (buySignals > sellSignals) {
      recommendation = 'شراء';
      emoji = '🟢';
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + takeProfitDistance;
      
      if (signalDifference >= 3 && strength >= 4) {
        confidence = 'عالية جداً';
        emoji = '💚';
      } else if (signalDifference >= 2 && strength >= 3) {
        confidence = 'عالية';
      } else if (signalDifference >= 1) {
        confidence = 'متوسطة';
      } else {
        confidence = 'ضعيفة';
      }
    } else if (sellSignals > buySignals) {
      recommendation = 'بيع';
      emoji = '🔴';
      stopLoss = currentPrice + stopLossDistance;
      takeProfit = currentPrice - takeProfitDistance;
      
      if (signalDifference >= 3 && strength >= 4) {
        confidence = 'عالية جداً';
        emoji = '❤️';
      } else if (signalDifference >= 2 && strength >= 3) {
        confidence = 'عالية';
      } else if (signalDifference >= 1) {
        confidence = 'متوسطة';
      } else {
        confidence = 'ضعيفة';
      }
    } else {
      recommendation = 'انتظار';
      emoji = '🟡';
      confidence = 'منخفضة';
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + takeProfitDistance;
    }
    
    return {
      recommendation,
      action: recommendation,
      emoji,
      confidence,
      entryPrice: this.formatPrice(entryPrice),
      stopLoss: this.formatPrice(stopLoss),
      takeProfit: this.formatPrice(takeProfit),
      riskRewardRatio: (takeProfitDistance / stopLossDistance).toFixed(2),
      buySignals: buySignals.toFixed(1),
      sellSignals: sellSignals.toFixed(1),
      trendStrength: strength,
      indicators: {
        RSI: rsi,
        MACD: macd,
        EMA: this.calculateEMA(20),
        SMA: this.calculateSMA(20),
        BBANDS: bb,
        ATR: atr,
        STOCH: stoch,
        ADX: adx,
        VOLUME: volume
      }
    };
  }
}

module.exports = TechnicalAnalysis;
