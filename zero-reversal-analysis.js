const TechnicalAnalysis = require('./analysis');

class ZeroReversalAnalysis {
  constructor(candles) {
    this.analysis = new TechnicalAnalysis(candles);
    this.candles = candles;
  }

  getZeroReversalRecommendation(marketType = 'spot', tradingType = 'spot', timeframe = '1h') {
    const currentPrice = this.candles[this.candles.length - 1].close;
    const normalizedTimeframe = timeframe?.toLowerCase().trim() || '1h';
    const candlesCount = this.candles.length;
    
    // حساب جميع المؤشرات
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
    
    // استخدام EMA/SMA طويلة المدى بناءً على عدد الشموع المتاحة
    let emaLong, smaLong;
    if (candlesCount >= 200) {
      emaLong = this.analysis.calculateEMA(200);
      smaLong = this.analysis.calculateSMA(200);
    } else if (candlesCount >= 100) {
      emaLong = this.analysis.calculateEMA(100);
      smaLong = this.analysis.calculateSMA(100);
    } else {
      // للحالات التي لدينا فيها 80-99 شمعة
      emaLong = this.analysis.calculateEMA(Math.floor(candlesCount * 0.8));
      smaLong = this.analysis.calculateSMA(Math.floor(candlesCount * 0.8));
    }
    
    const fibonacci = this.analysis.advancedAnalysis.calculateFibonacci();
    const candlePatterns = this.analysis.advancedAnalysis.detectCandlePatterns();
    const headShoulders = this.analysis.advancedAnalysis.detectHeadAndShoulders();
    const supportResistance = this.analysis.advancedAnalysis.calculateSupportResistance();

    // نقاط القوة
    let strengthScore = 0;
    const reasons = [];
    const warnings = [];
    let direction = null; // 'BUY' or 'SELL'

    // 1. تحليل الاتجاه طويل المدى - يجب أن يكون واضح جداً
    const currentPriceFloat = parseFloat(currentPrice);
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);
    const emaLongValue = parseFloat(emaLong.value);
    const smaLongValue = parseFloat(smaLong.value);

    // الاتجاه الصعودي القوي: السعر فوق جميع المتوسطات + المتوسطات مرتبة
    const strongBullishTrend = currentPriceFloat > ema20Value && 
                               ema20Value > ema50Value && 
                               ema50Value > emaLongValue &&
                               currentPriceFloat > smaLongValue;
    
    // الاتجاه الهبوطي القوي: السعر تحت جميع المتوسطات + المتوسطات مرتبة
    const strongBearishTrend = currentPriceFloat < ema20Value && 
                               ema20Value < ema50Value && 
                               ema50Value < emaLongValue &&
                               currentPriceFloat < smaLongValue;

    if (strongBullishTrend) {
      direction = 'BUY';
      strengthScore += 5;
      reasons.push('🟢 اتجاه صعودي قوي جداً - السعر فوق جميع المتوسطات المتحركة');
    } else if (strongBearishTrend) {
      direction = 'SELL';
      strengthScore += 5;
      reasons.push('🔴 اتجاه هبوطي قوي جداً - السعر تحت جميع المتوسطات المتحركة');
    } else {
      warnings.push('❌ لا يوجد اتجاه واضح - السعر متداخل مع المتوسطات');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }

    // 2. قوة الاتجاه ADX - يجب أن تكون قوية
    const adxValue = parseFloat(adx.value);
    if (adxValue < 30) {
      warnings.push(`❌ ADX ضعيف (${adxValue.toFixed(0)}) - يجب أن يكون 30+ للتأكد من قوة الاتجاه`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    
    const adxDirection = adx.signal.includes('صاعد') ? 'BUY' : 'SELL';
    if (adxDirection !== direction) {
      warnings.push('❌ ADX لا يتوافق مع الاتجاه الرئيسي');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    
    strengthScore += 5;
    reasons.push(`💪 ADX قوي (${adxValue.toFixed(0)}) - اتجاه قوي ومستمر`);

    // 3. RSI - يجب أن يكون في المنطقة المناسبة وليس في التشبع الشديد
    const rsiValue = parseFloat(rsi.value);
    if (direction === 'BUY') {
      if (rsiValue < 20 || rsiValue > 65) {
        warnings.push(`❌ RSI غير مناسب للشراء (${rsiValue.toFixed(0)}) - يجب أن يكون بين 20-65`);
        return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
      }
      strengthScore += 3;
      reasons.push(`✅ RSI جيد للشراء (${rsiValue.toFixed(0)}) - في منطقة مناسبة`);
    } else {
      if (rsiValue < 35 || rsiValue > 80) {
        warnings.push(`❌ RSI غير مناسب للبيع (${rsiValue.toFixed(0)}) - يجب أن يكون بين 35-80`);
        return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
      }
      strengthScore += 3;
      reasons.push(`✅ RSI جيد للبيع (${rsiValue.toFixed(0)}) - في منطقة مناسبة`);
    }

    // 4. MACD - يجب أن يتوافق مع الاتجاه
    const macdDirection = macd.signal.includes('صاعد') ? 'BUY' : 'SELL';
    if (macdDirection !== direction) {
      warnings.push('❌ MACD لا يتوافق مع الاتجاه');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 4;
    reasons.push(`✅ MACD ${direction === 'BUY' ? 'صعودي' : 'هبوطي'} - يؤكد الاتجاه`);

    // 5. الحجم - يجب أن يكون قوي أو ضخم
    if (!volume.signal.includes('ضخم') && !volume.signal.includes('عالي')) {
      warnings.push(`❌ الحجم غير كافٍ (${volume.signal}) - يجب أن يكون عالي أو ضخم`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 4;
    const volumeText = volume.signal.includes('ضخم') ? 'ضخم' : 'عالي';
    reasons.push(`🔥 حجم التداول ${volumeText} - يدعم الاتجاه`);

    // 6. Stochastic - يجب أن يكون في المنطقة المناسبة
    const stochK = parseFloat(stoch.value.split('K: ')[1]?.split(' /')[0]);
    if (direction === 'BUY' && stochK > 60) {
      warnings.push(`❌ Stochastic مرتفع جداً للشراء (${stochK.toFixed(0)})`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    if (direction === 'SELL' && stochK < 40) {
      warnings.push(`❌ Stochastic منخفض جداً للبيع (${stochK.toFixed(0)})`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 3;
    reasons.push('✅ Stochastic في المنطقة المثالية');

    // 7. Bollinger Bands - السعر يجب أن يكون في المنطقة الآمنة
    if (direction === 'BUY' && bb.signal.includes('تشبع شرائي')) {
      warnings.push('❌ السعر عند الحد العلوي لـ Bollinger - خطر انعكاس');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    if (direction === 'SELL' && bb.signal.includes('تشبع بيعي')) {
      warnings.push('❌ السعر عند الحد السفلي لـ Bollinger - خطر انعكاس');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 2;
    reasons.push('✅ السعر في منطقة آمنة من Bollinger Bands');

    // 8. الدعم والمقاومة - يجب أن تدعم الاتجاه
    if (direction === 'BUY' && !supportResistance.signal.includes('دعم')) {
      warnings.push('❌ السعر ليس قريباً من مستوى دعم قوي');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    if (direction === 'SELL' && !supportResistance.signal.includes('مقاومة')) {
      warnings.push('❌ السعر ليس قريباً من مستوى مقاومة قوية');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 3;
    reasons.push(`✅ السعر ${direction === 'BUY' ? 'قرب دعم قوي' : 'قرب مقاومة قوية'}`);

    // 9. Fibonacci - يجب أن يكون في المنطقة المناسبة
    if (direction === 'BUY' && !fibonacci.signal.includes('دعم')) {
      warnings.push('❌ Fibonacci لا يدعم الشراء');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    if (direction === 'SELL' && !fibonacci.signal.includes('مقاومة')) {
      warnings.push('❌ Fibonacci لا يدعم البيع');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 3;
    reasons.push('✅ Fibonacci يدعم الاتجاه');

    // 10. أنماط الشموع - يجب أن تكون قوية جداً
    if (candlePatterns.signal === 'محايد' || candlePatterns.signal === 'غير متاح') {
      warnings.push('❌ لا توجد أنماط شموع قوية');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    
    const patternsDirection = candlePatterns.signal === 'صعودي' ? 'BUY' : 'SELL';
    if (patternsDirection !== direction) {
      warnings.push('❌ أنماط الشموع لا تتوافق مع الاتجاه');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    
    const strongPatterns = candlePatterns.patterns?.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي') || [];
    if (strongPatterns.length < 1) {
      warnings.push('❌ لا توجد أنماط شموع قوية بما يكفي');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 4;
    reasons.push(`✅ أنماط شموع قوية: ${strongPatterns.map(p => p.name).join(', ')}`);

    // 11. التحقق من آخر 5 شموع - يجب أن يكون معظمها في نفس الاتجاه
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
    
    if (direction === 'BUY' && bullishCandles < 3) {
      warnings.push(`❌ آخر 5 شموع ليست صعودية بما يكفي (${bullishCandles}/5)`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    if (direction === 'SELL' && bearishCandles < 3) {
      warnings.push(`❌ آخر 5 شموع ليست هبوطية بما يكفي (${bearishCandles}/5)`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 2;
    reasons.push(`✅ آخر 5 شموع تؤكد الاتجاه (${direction === 'BUY' ? bullishCandles : bearishCandles}/5)`);

    // 12. حساب نقاط الدخول والخروج بدقة عالية
    const atrValue = parseFloat(atr.value);
    const atrPercent = (atrValue / currentPriceFloat) * 100;
    
    // معاملات دقيقة حسب الإطار الزمني
    const timeframeMultipliers = {
      '1m': { sl: 0.5, tp: 2.0 },
      '5m': { sl: 0.8, tp: 2.5 },
      '15m': { sl: 1.0, tp: 3.0 },
      '30m': { sl: 1.2, tp: 3.5 },
      '1h': { sl: 1.5, tp: 4.0 },
      '2h': { sl: 1.8, tp: 4.5 },
      '4h': { sl: 2.0, tp: 5.0 },
      '1d': { sl: 2.5, tp: 6.0 },
      '1w': { sl: 3.0, tp: 8.0 }
    };
    
    const multiplier = timeframeMultipliers[normalizedTimeframe] || timeframeMultipliers['1h'];
    let stopLossPercent = Math.max(atrPercent * multiplier.sl, 0.5);
    let takeProfitPercent = stopLossPercent * multiplier.tp;
    
    if (tradingType === 'futures') {
      takeProfitPercent = takeProfitPercent * 1.3;
    }
    
    const stopLossDistance = (currentPriceFloat * stopLossPercent) / 100;
    const takeProfitDistance = (currentPriceFloat * takeProfitPercent) / 100;
    const riskRewardRatio = takeProfitDistance / stopLossDistance;

    // نسبة المخاطرة/العائد يجب أن تكون 2.5:1 على الأقل
    if (riskRewardRatio < 2.5) {
      warnings.push(`❌ نسبة المخاطرة/العائد غير كافية (1:${riskRewardRatio.toFixed(1)}) - يجب أن تكون 1:2.5 على الأقل`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }
    strengthScore += 3;
    reasons.push(`✅ نسبة جيدة للمخاطرة/العائد (1:${riskRewardRatio.toFixed(1)})`);

    // التحقق النهائي: يجب أن تكون نقاط القوة 30+ من 41
    if (strengthScore < 30) {
      warnings.push(`❌ نقاط القوة غير كافية (${strengthScore}/41) - يجب 30+ للتأكد من قوة الاتجاه`);
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType);
    }

    // حساب نقاط الدخول والخروج
    let recommendation, action, emoji, stopLoss, takeProfit;
    
    if (direction === 'BUY') {
      recommendation = 'شراء';
      action = 'BUY';
      emoji = '💚';
      stopLoss = currentPriceFloat - stopLossDistance;
      takeProfit = currentPriceFloat + takeProfitDistance;
    } else {
      recommendation = 'بيع';
      action = 'SELL';
      emoji = '❤️';
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

    // حساب النسب المئوية
    const buyScore = direction === 'BUY' ? strengthScore : 0;
    const sellScore = direction === 'SELL' ? strengthScore : 0;
    const maxScore = 41;
    const buyPercentage = (buyScore / maxScore) * 100;
    const sellPercentage = (sellScore / maxScore) * 100;
    const agreementPercentage = Math.max(buyPercentage, sellPercentage);

    return {
      mode: 'ZERO_REVERSAL',
      recommendation,
      action,
      emoji,
      confidence: 'عالية - اتجاه قوي',
      shouldTrade: true,
      riskLevel: 'منخفض جداً',
      reversalProbability: '0%',
      strengthScore: `${strengthScore}/41`,
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
      warnings: [],
      scores: {
        buyScore: buyScore.toFixed(1),
        sellScore: sellScore.toFixed(1),
        buyPercentage: buyPercentage.toFixed(1) + '%',
        sellPercentage: sellPercentage.toFixed(1) + '%',
        agreementPercentage: agreementPercentage.toFixed(1) + '%',
        confirmations: strengthScore.toFixed(0),
        totalIndicators: 11
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

  generateWaitResponse(warnings, currentPrice, timeframe, marketType, tradingType) {
    return {
      mode: 'ZERO_REVERSAL',
      recommendation: 'انتظار',
      action: 'WAIT',
      emoji: '⛔',
      confidence: 'لا تتداول - احتمال الانعكاس مرتفع',
      shouldTrade: false,
      riskLevel: 'مرتفع جداً',
      reversalProbability: 'مرتفع',
      strengthScore: '0/41',
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
      reasons: [],
      warnings,
      scores: {
        buyScore: '0.0',
        sellScore: '0.0',
        buyPercentage: '0.0%',
        sellPercentage: '0.0%',
        agreementPercentage: '0.0%',
        confirmations: '0',
        totalIndicators: 11
      },
      indicators: {}
    };
  }
}

module.exports = ZeroReversalAnalysis;
