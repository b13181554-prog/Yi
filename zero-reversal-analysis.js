const TechnicalAnalysis = require('./analysis');

class ZeroReversalAnalysis {
  constructor(candles) {
    this.analysis = new TechnicalAnalysis(candles);
    this.candles = candles;
  }

  getZeroReversalRecommendation(marketType = 'spot', timeframe = '1h') {
    const currentPrice = this.candles[this.candles.length - 1].close;
    const normalizedTimeframe = timeframe?.toLowerCase().trim() || '1h';
    const candlesCount = this.candles.length;
    
    const rsi = this.analysis.calculateRSI();
    const macd = this.analysis.calculateMACD();
    const bb = this.analysis.calculateBollingerBands();
    const atr = this.analysis.calculateATR();
    const stoch = this.analysis.calculateStochastic();
    const adx = this.analysis.calculateADX();
    const volume = this.analysis.calculateVolumeAnalysis();
    const ema20 = this.analysis.calculateEMA(20);
    const ema50 = this.analysis.calculateEMA(50);
    const sma20 = this.analysis.calculateSMA(20);
    const sma50 = this.analysis.calculateSMA(50);
    
    let emaLong, smaLong;
    if (candlesCount >= 200) {
      emaLong = this.analysis.calculateEMA(200);
      smaLong = this.analysis.calculateSMA(200);
    } else if (candlesCount >= 100) {
      emaLong = this.analysis.calculateEMA(100);
      smaLong = this.analysis.calculateSMA(100);
    } else {
      emaLong = this.analysis.calculateEMA(Math.floor(candlesCount * 0.8));
      smaLong = this.analysis.calculateSMA(Math.floor(candlesCount * 0.8));
    }
    
    const fibonacci = this.analysis.advancedAnalysis.calculateFibonacci();
    const candlePatterns = this.analysis.advancedAnalysis.detectCandlePatterns();
    const headShoulders = this.analysis.advancedAnalysis.detectHeadAndShoulders();
    const supportResistance = this.analysis.advancedAnalysis.calculateSupportResistance();

    let strengthScore = 0;
    const maxScore = 100;
    const reasons = [];
    const warnings = [];
    let direction = null;

    const currentPriceFloat = parseFloat(currentPrice);
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);
    const emaLongValue = parseFloat(emaLong.value);
    const smaLongValue = parseFloat(smaLong.value);
    const adxValue = parseFloat(adx.value);
    const rsiValue = parseFloat(rsi.value);

    const strongBullishTrend = currentPriceFloat > ema20Value && 
                               ema20Value > ema50Value && 
                               ema50Value > emaLongValue &&
                               currentPriceFloat > smaLongValue;
    
    const strongBearishTrend = currentPriceFloat < ema20Value && 
                               ema20Value < ema50Value && 
                               ema50Value < emaLongValue &&
                               currentPriceFloat < smaLongValue;
    
    const moderateBullishTrend = currentPriceFloat > ema20Value && ema20Value > ema50Value;
    const moderateBearishTrend = currentPriceFloat < ema20Value && ema20Value < ema50Value;

    if (strongBullishTrend) {
      direction = 'BUY';
      strengthScore += 15;
      reasons.push('🟢 اتجاه صعودي قوي جداً - السعر فوق جميع المتوسطات المتحركة');
    } else if (moderateBullishTrend) {
      direction = 'BUY';
      strengthScore += 10;
      reasons.push('🟢 اتجاه صعودي متوسط - السعر فوق المتوسطات القصيرة');
    } else if (strongBearishTrend) {
      direction = 'SELL';
      strengthScore += 15;
      reasons.push('🔴 اتجاه هبوطي قوي جداً - السعر تحت جميع المتوسطات المتحركة');
    } else if (moderateBearishTrend) {
      direction = 'SELL';
      strengthScore += 10;
      reasons.push('🔴 اتجاه هبوطي متوسط - السعر تحت المتوسطات القصيرة');
    } else {
      warnings.push('❌ لا يوجد اتجاه واضح - السعر متداخل مع المتوسطات');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, strengthScore, maxScore);
    }

    if (adxValue >= 35) {
      strengthScore += 15;
      reasons.push(`💪 ADX قوي جداً (${adxValue.toFixed(0)}) - اتجاه قوي ومستمر`);
    } else if (adxValue >= 25) {
      strengthScore += 12;
      reasons.push(`💪 ADX قوي (${adxValue.toFixed(0)}) - اتجاه جيد`);
    } else if (adxValue >= 20) {
      strengthScore += 8;
      reasons.push(`⚠️ ADX متوسط (${adxValue.toFixed(0)}) - اتجاه متوسط القوة`);
    } else {
      warnings.push(`⚠️ ADX ضعيف (${adxValue.toFixed(0)}) - اتجاه ضعيف`);
    }
    
    const adxDirection = adx.signal.includes('صاعد') ? 'BUY' : 'SELL';
    if (adxDirection === direction) {
      strengthScore += 3;
      reasons.push('✅ ADX يتوافق مع الاتجاه الرئيسي');
    } else {
      warnings.push('⚠️ ADX لا يتوافق تماماً مع الاتجاه');
    }

    if (direction === 'BUY') {
      if (rsiValue >= 30 && rsiValue <= 60) {
        strengthScore += 12;
        reasons.push(`✅ RSI ممتاز للشراء (${rsiValue.toFixed(0)}) - في منطقة مثالية`);
      } else if (rsiValue >= 25 && rsiValue <= 70) {
        strengthScore += 8;
        reasons.push(`✅ RSI جيد للشراء (${rsiValue.toFixed(0)}) - في منطقة مقبولة`);
      } else if (rsiValue < 25) {
        strengthScore += 5;
        warnings.push(`⚠️ RSI منخفض جداً (${rsiValue.toFixed(0)}) - قد يكون تشبع بيعي مفرط`);
      } else {
        strengthScore += 3;
        warnings.push(`⚠️ RSI مرتفع (${rsiValue.toFixed(0)}) - احتمال تصحيح`);
      }
    } else {
      if (rsiValue >= 40 && rsiValue <= 70) {
        strengthScore += 12;
        reasons.push(`✅ RSI ممتاز للبيع (${rsiValue.toFixed(0)}) - في منطقة مثالية`);
      } else if (rsiValue >= 30 && rsiValue <= 75) {
        strengthScore += 8;
        reasons.push(`✅ RSI جيد للبيع (${rsiValue.toFixed(0)}) - في منطقة مقبولة`);
      } else if (rsiValue > 75) {
        strengthScore += 5;
        warnings.push(`⚠️ RSI مرتفع جداً (${rsiValue.toFixed(0)}) - قد يكون تشبع شرائي مفرط`);
      } else {
        strengthScore += 3;
        warnings.push(`⚠️ RSI منخفض (${rsiValue.toFixed(0)}) - احتمال ارتداد`);
      }
    }

    const macdDirection = macd.signal.includes('صاعد') ? 'BUY' : 'SELL';
    if (macdDirection === direction) {
      if (macd.signal.includes('قوي')) {
        strengthScore += 12;
        reasons.push(`✅ MACD ${direction === 'BUY' ? 'صعودي قوي' : 'هبوطي قوي'} - يؤكد الاتجاه بقوة`);
      } else {
        strengthScore += 8;
        reasons.push(`✅ MACD ${direction === 'BUY' ? 'صعودي' : 'هبوطي'} - يؤكد الاتجاه`);
      }
    } else {
      warnings.push('⚠️ MACD لا يتوافق مع الاتجاه');
      strengthScore += 2;
    }

    if (volume.signal.includes('ضخم')) {
      strengthScore += 10;
      reasons.push('🔥 حجم التداول ضخم - يدعم الاتجاه بقوة');
    } else if (volume.signal.includes('عالي')) {
      strengthScore += 7;
      reasons.push('✅ حجم التداول عالي - يدعم الاتجاه');
    } else if (volume.signal.includes('متوسط')) {
      strengthScore += 4;
      warnings.push('⚠️ حجم التداول متوسط');
    } else {
      warnings.push('⚠️ حجم التداول منخفض');
      strengthScore += 1;
    }

    const stochK = parseFloat(stoch.value.split('K: ')[1]?.split(' /')[0]);
    if (direction === 'BUY') {
      if (stochK <= 40) {
        strengthScore += 8;
        reasons.push(`✅ Stochastic مثالي للشراء (${stochK.toFixed(0)})`);
      } else if (stochK <= 55) {
        strengthScore += 5;
        reasons.push(`✅ Stochastic جيد للشراء (${stochK.toFixed(0)})`);
      } else {
        strengthScore += 2;
        warnings.push(`⚠️ Stochastic مرتفع (${stochK.toFixed(0)}) - قد يعيق الدخول`);
      }
    } else {
      if (stochK >= 60) {
        strengthScore += 8;
        reasons.push(`✅ Stochastic مثالي للبيع (${stochK.toFixed(0)})`);
      } else if (stochK >= 45) {
        strengthScore += 5;
        reasons.push(`✅ Stochastic جيد للبيع (${stochK.toFixed(0)})`);
      } else {
        strengthScore += 2;
        warnings.push(`⚠️ Stochastic منخفض (${stochK.toFixed(0)}) - قد يعيق الدخول`);
      }
    }

    if (direction === 'BUY' && bb.signal.includes('تشبع شرائي')) {
      warnings.push('⚠️ السعر عند الحد العلوي لـ Bollinger - احتمال انعكاس');
    } else if (direction === 'SELL' && bb.signal.includes('تشبع بيعي')) {
      warnings.push('⚠️ السعر عند الحد السفلي لـ Bollinger - احتمال انعكاس');
    } else if ((direction === 'BUY' && bb.signal.includes('هابط')) || 
               (direction === 'SELL' && bb.signal.includes('صاعد'))) {
      strengthScore += 6;
      reasons.push('✅ السعر في منطقة مناسبة من Bollinger Bands');
    } else {
      strengthScore += 3;
    }

    if ((direction === 'BUY' && supportResistance.signal.includes('دعم')) ||
        (direction === 'SELL' && supportResistance.signal.includes('مقاومة'))) {
      strengthScore += 8;
      reasons.push(`✅ السعر ${direction === 'BUY' ? 'قرب دعم قوي' : 'قرب مقاومة قوية'}`);
    } else {
      strengthScore += 3;
      warnings.push('⚠️ السعر ليس عند مستوى دعم/مقاومة واضح');
    }

    if ((direction === 'BUY' && fibonacci.signal.includes('دعم')) ||
        (direction === 'SELL' && fibonacci.signal.includes('مقاومة'))) {
      strengthScore += 6;
      reasons.push('✅ Fibonacci يدعم الاتجاه');
    } else {
      strengthScore += 2;
    }

    if (candlePatterns.signal !== 'محايد' && candlePatterns.signal !== 'غير متاح') {
      const patternsDirection = candlePatterns.signal === 'صعودي' ? 'BUY' : 'SELL';
      if (patternsDirection === direction) {
        const strongPatterns = candlePatterns.patterns?.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي') || [];
        if (strongPatterns.length >= 2) {
          strengthScore += 10;
          reasons.push(`✅ أنماط شموع قوية جداً: ${strongPatterns.map(p => p.name).join(', ')}`);
        } else if (strongPatterns.length >= 1) {
          strengthScore += 7;
          reasons.push(`✅ أنماط شموع قوية: ${strongPatterns.map(p => p.name).join(', ')}`);
        } else {
          strengthScore += 4;
          reasons.push('✅ أنماط شموع متوسطة');
        }
      } else {
        warnings.push('⚠️ أنماط الشموع لا تتوافق مع الاتجاه');
        strengthScore += 1;
      }
    } else {
      strengthScore += 2;
    }

    const last5Candles = this.candles.slice(-5);
    let bullishCandles = 0;
    let bearishCandles = 0;
    
    last5Candles.forEach(candle => {
      if (parseFloat(candle.close) > parseFloat(candle.open)) {
        bullishCandles++;
      } else {
        bearishCandles++;
      }
    });
    
    if ((direction === 'BUY' && bullishCandles >= 4) || (direction === 'SELL' && bearishCandles >= 4)) {
      strengthScore += 6;
      reasons.push(`✅ آخر 5 شموع تؤكد الاتجاه بقوة (${direction === 'BUY' ? bullishCandles : bearishCandles}/5)`);
    } else if ((direction === 'BUY' && bullishCandles >= 3) || (direction === 'SELL' && bearishCandles >= 3)) {
      strengthScore += 4;
      reasons.push(`✅ آخر 5 شموع تؤكد الاتجاه (${direction === 'BUY' ? bullishCandles : bearishCandles}/5)`);
    } else {
      strengthScore += 2;
      warnings.push(`⚠️ آخر 5 شموع ليست قوية (${direction === 'BUY' ? bullishCandles : bearishCandles}/5)`);
    }

    const atrValue = parseFloat(atr.value);
    const atrPercent = (atrValue / currentPriceFloat) * 100;
    
    const timeframeMultipliers = {
      '1m': { sl: 1.2, tp: 2.5 },
      '5m': { sl: 1.5, tp: 3.0 },
      '15m': { sl: 1.8, tp: 3.5 },
      '30m': { sl: 2.0, tp: 4.0 },
      '1h': { sl: 2.2, tp: 4.5 },
      '2h': { sl: 2.5, tp: 5.0 },
      '4h': { sl: 2.8, tp: 5.5 },
      '1d': { sl: 3.0, tp: 6.0 },
      '1w': { sl: 3.5, tp: 7.0 }
    };
    
    const multiplier = timeframeMultipliers[normalizedTimeframe] || timeframeMultipliers['1h'];
    const stopLossPercent = Math.max(atrPercent * multiplier.sl, 0.5);
    const takeProfitPercent = stopLossPercent * (multiplier.tp / multiplier.sl);
    
    const stopLossDistance = (currentPriceFloat * stopLossPercent) / 100;
    const takeProfitDistance = (currentPriceFloat * takeProfitPercent) / 100;
    const riskRewardRatio = takeProfitDistance / stopLossDistance;

    if (riskRewardRatio >= 3.0) {
      strengthScore += 6;
      reasons.push(`✅ نسبة ممتازة للمخاطرة/العائد (1:${riskRewardRatio.toFixed(1)})`);
    } else if (riskRewardRatio >= 2.0) {
      strengthScore += 4;
      reasons.push(`✅ نسبة جيدة للمخاطرة/العائد (1:${riskRewardRatio.toFixed(1)})`);
    } else {
      strengthScore += 2;
      warnings.push(`⚠️ نسبة المخاطرة/العائد مقبولة (1:${riskRewardRatio.toFixed(1)})`);
    }

    const percentageScore = (strengthScore / maxScore) * 100;
    let shouldTrade = false;
    let confidenceLevel = 'منخفضة';
    let riskLevel = 'مرتفع';
    let reversalProbability = 'مرتفع';

    if (percentageScore >= 75 && adxValue >= 25) {
      shouldTrade = true;
      confidenceLevel = 'عالية جداً - اتجاه قوي';
      riskLevel = 'منخفض جداً';
      reversalProbability = '0-5%';
    } else if (percentageScore >= 65 && adxValue >= 20) {
      shouldTrade = true;
      confidenceLevel = 'عالية - اتجاه جيد';
      riskLevel = 'منخفض';
      reversalProbability = '5-10%';
    } else if (percentageScore >= 55 && adxValue >= 18) {
      shouldTrade = true;
      confidenceLevel = 'متوسطة - اتجاه متوسط';
      riskLevel = 'متوسط';
      reversalProbability = '10-20%';
      warnings.push('⚠️ صفقة متوسطة القوة - تداول بحذر');
    } else {
      shouldTrade = false;
      confidenceLevel = 'منخفضة - لا تتداول';
      riskLevel = 'مرتفع جداً';
      reversalProbability = 'مرتفع (20%+)';
      warnings.push('❌ نقاط القوة غير كافية - يُنصح بالانتظار');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType, strengthScore, maxScore);
    }

    let recommendation, action, emoji, stopLoss, takeProfit;
    
    if (direction === 'BUY') {
      recommendation = 'شراء';
      action = 'BUY';
      emoji = percentageScore >= 75 ? '💚' : percentageScore >= 65 ? '🟢' : '🟢';
      stopLoss = currentPriceFloat - stopLossDistance;
      takeProfit = currentPriceFloat + takeProfitDistance;
    } else {
      recommendation = 'بيع';
      action = 'SELL';
      emoji = percentageScore >= 75 ? '❤️' : percentageScore >= 65 ? '🔴' : '🔴';
      stopLoss = currentPriceFloat + stopLossDistance;
      takeProfit = currentPriceFloat - takeProfitDistance;
    }

    const formatPrice = (price) => {
      if (price === null || price === undefined || isNaN(price)) return 'N/A';
      price = parseFloat(price);
      if (price === 0) return '0';
      let str = price.toString();
      if (str.includes('e-')) {
        const parts = str.split('e-');
        const decimals = parseInt(parts[1], 10);
        const precision = Math.min(decimals + (parts[0].replace('.', '').length - 1), 20);
        str = price.toFixed(precision);
      }
      str = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
      return str;
    };

    const buyScore = direction === 'BUY' ? strengthScore : 0;
    const sellScore = direction === 'SELL' ? strengthScore : 0;
    const buyPercentage = (buyScore / maxScore) * 100;
    const sellPercentage = (sellScore / maxScore) * 100;
    const agreementPercentage = Math.max(buyPercentage, sellPercentage);

    return {
      mode: 'ZERO_REVERSAL',
      recommendation,
      action,
      emoji,
      confidence: confidenceLevel,
      shouldTrade,
      riskLevel,
      reversalProbability,
      strengthScore: `${strengthScore}/${maxScore}`,
      tradingType,
      marketType,
      timeframe,
      analysisTime: new Date().toLocaleString('ar-SA', { 
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      entryPrice: formatPrice(currentPriceFloat),
      stopLoss: formatPrice(stopLoss),
      takeProfit: formatPrice(takeProfit),
      stopLossPercent: stopLossPercent.toFixed(2) + '%',
      takeProfitPercent: takeProfitPercent.toFixed(2) + '%',
      riskRewardRatio: riskRewardRatio.toFixed(2),
      reasons,
      warnings,
      scores: {
        buyScore: buyScore.toFixed(1),
        sellScore: sellScore.toFixed(1),
        buyPercentage: buyPercentage.toFixed(1) + '%',
        sellPercentage: sellPercentage.toFixed(1) + '%',
        agreementPercentage: agreementPercentage.toFixed(1) + '%',
        confirmations: strengthScore.toFixed(0),
        totalIndicators: 11,
        percentageScore: percentageScore.toFixed(1) + '%'
      },
      indicators: {
        RSI: rsi,
        MACD: macd,
        EMA20: ema20,
        EMA50: ema50,
        EMA_LONG: emaLong,
        SMA_LONG: smaLong,
        BBANDS: bb,
        ATR: atr,
        STOCH: stoch,
        ADX: adx,
        VOLUME: volume,
        FIBONACCI: fibonacci,
        CANDLE_PATTERNS: candlePatterns,
        HEAD_SHOULDERS: headShoulders,
        SUPPORT_RESISTANCE: supportResistance
      }
    };
  }

  generateWaitResponse(warnings, currentPrice, timeframe, marketType, tradingType, strengthScore, maxScore) {
    const percentageScore = (strengthScore / maxScore) * 100;
    
    return {
      mode: 'ZERO_REVERSAL',
      recommendation: 'انتظار',
      action: 'WAIT',
      emoji: '⛔',
      confidence: 'لا تتداول - احتمال الانعكاس مرتفع',
      shouldTrade: false,
      riskLevel: 'مرتفع جداً',
      reversalProbability: 'مرتفع (25%+)',
      strengthScore: `${strengthScore}/${maxScore} (${percentageScore.toFixed(1)}%)`,
      tradingType,
      marketType,
      timeframe,
      analysisTime: new Date().toLocaleString('ar-SA', { 
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      entryPrice: 'N/A',
      stopLoss: 'N/A',
      takeProfit: 'N/A',
      stopLossPercent: 'N/A',
      takeProfitPercent: 'N/A',
      riskRewardRatio: 'N/A',
      reasons: ['السبب: نقاط القوة غير كافية للتداول الآمن'],
      warnings,
      scores: {
        buyScore: '0.0',
        sellScore: '0.0',
        buyPercentage: '0.0%',
        sellPercentage: '0.0%',
        agreementPercentage: '0.0%',
        confirmations: strengthScore.toFixed(0),
        totalIndicators: 11,
        percentageScore: percentageScore.toFixed(1) + '%'
      },
      indicators: {}
    };
  }
}

module.exports = ZeroReversalAnalysis;
