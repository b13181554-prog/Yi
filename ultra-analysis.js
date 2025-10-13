const TechnicalAnalysis = require('./analysis');

class UltraAnalysis {
  constructor(candles) {
    this.analysis = new TechnicalAnalysis(candles);
    this.candles = candles;
  }

  getUltraRecommendation(marketType = 'spot', tradingType = 'spot', timeframe = '1h') {
    const currentPrice = this.candles[this.candles.length - 1].close;
    
    // تطبيع الإطار الزمني لضمان التوافق
    const normalizedTimeframe = timeframe?.toLowerCase().trim() || '1h';
    
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
    
    const fibonacci = this.analysis.advancedAnalysis.calculateFibonacci();
    const candlePatterns = this.analysis.advancedAnalysis.detectCandlePatterns();
    const headShoulders = this.analysis.advancedAnalysis.detectHeadAndShoulders();
    const supportResistance = this.analysis.advancedAnalysis.calculateSupportResistance();

    let buyScore = 0;
    let sellScore = 0;
    let totalIndicators = 0;
    const reasons = [];
    const warnings = [];

    if (parseFloat(rsi.value) < 30) {
      buyScore += 2;
      reasons.push('RSI تشبع بيعي قوي');
    } else if (parseFloat(rsi.value) < 40) {
      buyScore += 1;
      reasons.push('RSI في منطقة الشراء');
    } else if (parseFloat(rsi.value) > 70) {
      sellScore += 2;
      reasons.push('RSI تشبع شرائي قوي');
    } else if (parseFloat(rsi.value) > 60) {
      sellScore += 1;
      reasons.push('RSI في منطقة البيع');
    }
    totalIndicators++;

    if (macd.signal.includes('صاعد قوي')) {
      buyScore += 2;
      reasons.push('MACD إشارة صعودية قوية');
    } else if (macd.signal.includes('صاعد')) {
      buyScore += 1;
      reasons.push('MACD إشارة صعودية');
    } else if (macd.signal.includes('هابط قوي')) {
      sellScore += 2;
      reasons.push('MACD إشارة هبوطية قوية');
    } else if (macd.signal.includes('هابط')) {
      sellScore += 1;
      reasons.push('MACD إشارة هبوطية');
    }
    totalIndicators++;

    if (bb.signal.includes('تشبع بيعي')) {
      buyScore += 2;
      reasons.push('Bollinger Bands - تشبع بيعي');
    } else if (bb.signal.includes('هابط')) {
      buyScore += 1;
    } else if (bb.signal.includes('تشبع شرائي')) {
      sellScore += 2;
      reasons.push('Bollinger Bands - تشبع شرائي');
    } else if (bb.signal.includes('صاعد')) {
      sellScore += 1;
    }
    totalIndicators++;

    if (stoch.signal.includes('تشبع بيعي')) {
      buyScore += 1.5;
      reasons.push('Stochastic تشبع بيعي');
    } else if (stoch.signal.includes('تشبع شرائي')) {
      sellScore += 1.5;
      reasons.push('Stochastic تشبع شرائي');
    }
    totalIndicators++;

    const currentPriceFloat = parseFloat(currentPrice);
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);
    
    if (currentPriceFloat > ema20Value && ema20Value > ema50Value) {
      buyScore += 2;
      reasons.push('EMA Golden Cross - اتجاه صعودي قوي');
    } else if (currentPriceFloat > ema20Value) {
      buyScore += 1;
    } else if (currentPriceFloat < ema20Value && ema20Value < ema50Value) {
      sellScore += 2;
      reasons.push('EMA Death Cross - اتجاه هبوطي قوي');
    } else if (currentPriceFloat < ema20Value) {
      sellScore += 1;
    }
    totalIndicators++;

    const adxValue = parseFloat(adx.value);
    if (adxValue > 25) {
      if (adx.signal.includes('صاعد')) {
        buyScore += 2;
        reasons.push(`ADX قوي (${adxValue.toFixed(0)}) - اتجاه صعودي قوي`);
      } else if (adx.signal.includes('هابط')) {
        sellScore += 2;
        reasons.push(`ADX قوي (${adxValue.toFixed(0)}) - اتجاه هبوطي قوي`);
      }
    }
    totalIndicators++;

    if (volume.signal.includes('ضخم')) {
      if (buyScore > sellScore) {
        buyScore += 2;
        reasons.push('حجم تداول ضخم يدعم الاتجاه الصعودي');
      } else if (sellScore > buyScore) {
        sellScore += 2;
        reasons.push('حجم تداول ضخم يدعم الاتجاه الهبوطي');
      }
    } else if (volume.signal.includes('عالي')) {
      if (buyScore > sellScore) {
        buyScore += 1;
      } else if (sellScore > buyScore) {
        sellScore += 1;
      }
    }
    totalIndicators++;

    if (fibonacci.signal.includes('دعم قوية')) {
      buyScore += 2;
      reasons.push('Fibonacci - منطقة دعم قوية');
    } else if (fibonacci.signal.includes('دعم')) {
      buyScore += 1;
    } else if (fibonacci.signal.includes('مقاومة قوية')) {
      sellScore += 2;
      reasons.push('Fibonacci - منطقة مقاومة قوية');
    } else if (fibonacci.signal.includes('مقاومة')) {
      sellScore += 1;
    }
    totalIndicators++;

    if (candlePatterns.signal === 'صعودي') {
      const strongPatterns = candlePatterns.patterns.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي');
      if (strongPatterns.length > 0) {
        buyScore += 2;
        reasons.push(`أنماط شموع صعودية: ${strongPatterns.map(p => p.name).join(', ')}`);
      } else {
        buyScore += 1;
      }
    } else if (candlePatterns.signal === 'هبوطي') {
      const strongPatterns = candlePatterns.patterns.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي');
      if (strongPatterns.length > 0) {
        sellScore += 2;
        reasons.push(`أنماط شموع هبوطية: ${strongPatterns.map(p => p.name).join(', ')}`);
      } else {
        sellScore += 1;
      }
    }
    totalIndicators++;

    if (headShoulders.detected) {
      if (headShoulders.type === 'bullish') {
        buyScore += 2;
        reasons.push('نموذج Inverse H&S - إشارة صعودية قوية');
      } else if (headShoulders.type === 'bearish') {
        sellScore += 2;
        reasons.push('نموذج H&S - إشارة هبوطية قوية');
      }
      totalIndicators++;
    }

    if (supportResistance.signal.includes('دعم')) {
      buyScore += 1.5;
      reasons.push('السعر قريب من مستوى الدعم');
    } else if (supportResistance.signal.includes('مقاومة')) {
      sellScore += 1.5;
      reasons.push('السعر قريب من مستوى المقاومة');
    }
    totalIndicators++;

    const maxScore = totalIndicators * 2;
    const buyPercentage = (buyScore / maxScore) * 100;
    const sellPercentage = (sellScore / maxScore) * 100;
    const agreementPercentage = Math.max(buyPercentage, sellPercentage);

    const atrValue = parseFloat(atr.value);
    const atrPercent = (atrValue / currentPriceFloat) * 100;
    
    // معاملات دقيقة لكل إطار زمني
    const timeframeMultipliers = {
      '1m': { sl: 0.8, tp: 1.5 },   // صفقات سريعة جداً - أهداف قريبة
      '5m': { sl: 1.0, tp: 2.0 },   // صفقات سكالبينج - أهداف قريبة
      '15m': { sl: 1.2, tp: 2.5 },  // صفقات قصيرة - أهداف قريبة نسبياً
      '30m': { sl: 1.4, tp: 2.8 },  // صفقات قصيرة إلى متوسطة
      '1h': { sl: 1.5, tp: 3.0 },   // صفقات متوسطة - أهداف متوسطة
      '2h': { sl: 1.6, tp: 3.2 },   // صفقات متوسطة
      '4h': { sl: 1.8, tp: 3.5 },   // صفقات متوسطة إلى طويلة
      '1d': { sl: 2.0, tp: 4.0 },   // صفقات طويلة - أهداف بعيدة
      '1w': { sl: 2.5, tp: 5.0 }    // صفقات طويلة جداً - أهداف بعيدة جداً
    };
    
    // الحصول على المعاملات المناسبة للإطار الزمني
    const multiplier = timeframeMultipliers[normalizedTimeframe] || timeframeMultipliers['1h'];
    
    // حساب Stop Loss و Take Profit بناءً على الإطار الزمني
    let stopLossPercent = Math.max(atrPercent * multiplier.sl, 0.3);
    let takeProfitPercent = stopLossPercent * multiplier.tp;
    
    // تعديل إضافي للفيوتشر (مخاطر أعلى = أهداف أبعد)
    if (tradingType === 'futures') {
      takeProfitPercent = takeProfitPercent * 1.2;
    }
    
    const stopLossDistance = (currentPriceFloat * stopLossPercent) / 100;
    const takeProfitDistance = (currentPriceFloat * takeProfitPercent) / 100;

    let recommendation = 'انتظار';
    let action = 'WAIT';
    let emoji = '🟡';
    let confidenceLevel = 'منخفضة جداً';
    let stopLoss = 0;
    let takeProfit = 0;
    let entryPrice = currentPriceFloat;
    let riskLevel = 'مرتفع';
    let shouldTrade = false;

    const strictConditions = {
      minAgreement: 75,
      minADX: 25,
      requiredVolume: ['ضخم', 'عالي'],
      minConfirmations: 7
    };

    const confirmations = (buyScore > sellScore ? buyScore : sellScore) / 2;
    
    // التحقق من الحجم القوي أو الضخم
    const hasStrongVolume = volume.signal.includes('ضخم') || volume.signal.includes('عالي');
    
    // التحقق من نسبة Risk/Reward جيدة (1:2 على الأقل)
    const riskRewardRatio = takeProfitDistance / stopLossDistance;
    const hasGoodRiskReward = riskRewardRatio >= 2;
    
    // التحقق من توافق المؤشرات الرئيسية (RSI, MACD, ADX) - نطاق أوسع
    const hasRSIConfirmation = (buyScore > sellScore && parseFloat(rsi.value) < 50) || 
                               (sellScore > buyScore && parseFloat(rsi.value) > 50);
    const hasMACDConfirmation = (buyScore > sellScore && macd.signal.includes('صاعد')) || 
                                (sellScore > buyScore && macd.signal.includes('هابط'));

    if (buyScore > sellScore) {
      recommendation = 'شراء';
      action = 'BUY';
      emoji = '🟢';
      stopLoss = currentPriceFloat - stopLossDistance;
      takeProfit = currentPriceFloat + takeProfitDistance;
      
      // شروط متوازنة: 82%+ توافق، ADX قوي، 8+ تأكيدات، حجم جيد، نسبة R/R جيدة
      if (agreementPercentage >= 82 && adxValue >= 30 && confirmations >= 8 && 
          hasStrongVolume && hasGoodRiskReward && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '💚';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ جميع الشروط محققة - صفقة قوية جداً');
      } else if (agreementPercentage >= 75 && adxValue >= 25 && confirmations >= 7 && 
                 hasStrongVolume && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية';
        emoji = '💚';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ الشروط محققة - صفقة جيدة');
      } else {
        confidenceLevel = 'منخفضة - لا تتداول';
        riskLevel = 'مرتفع جداً';
        shouldTrade = false;
        warnings.push('❌ الإشارة لا تحقق المعايير - يُنصح بالانتظار');
      }
    } else if (sellScore > buyScore) {
      recommendation = 'بيع';
      action = 'SELL';
      emoji = '🔴';
      stopLoss = currentPriceFloat + stopLossDistance;
      takeProfit = currentPriceFloat - takeProfitDistance;
      
      // شروط متوازنة: 82%+ توافق، ADX قوي، 8+ تأكيدات، حجم جيد، نسبة R/R جيدة
      if (agreementPercentage >= 82 && adxValue >= 30 && confirmations >= 8 && 
          hasStrongVolume && hasGoodRiskReward && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '❤️';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ جميع الشروط محققة - صفقة قوية جداً');
      } else if (agreementPercentage >= 75 && adxValue >= 25 && confirmations >= 7 && 
                 hasStrongVolume && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية';
        emoji = '❤️';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ الشروط محققة - صفقة جيدة');
      } else {
        confidenceLevel = 'منخفضة - لا تتداول';
        riskLevel = 'مرتفع جداً';
        shouldTrade = false;
        warnings.push('❌ الإشارة لا تحقق المعايير - يُنصح بالانتظار');
      }
    } else {
      riskLevel = 'مرتفع جداً';
      shouldTrade = false;
      warnings.push('❌ إشارات متضاربة - لا تتداول');
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

    return {
      mode: 'ULTRA_ANALYSIS',
      recommendation,
      action,
      emoji,
      confidence: confidenceLevel,
      shouldTrade,
      riskLevel,
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
      entryPrice: formatPrice(entryPrice),
      stopLoss: formatPrice(stopLoss),
      takeProfit: formatPrice(takeProfit),
      stopLossPercent: stopLossPercent.toFixed(2) + '%',
      takeProfitPercent: takeProfitPercent.toFixed(2) + '%',
      riskRewardRatio: (takeProfitDistance / stopLossDistance).toFixed(2),
      scores: {
        buyScore: buyScore.toFixed(1),
        sellScore: sellScore.toFixed(1),
        buyPercentage: buyPercentage.toFixed(1) + '%',
        sellPercentage: sellPercentage.toFixed(1) + '%',
        agreementPercentage: agreementPercentage.toFixed(1) + '%',
        confirmations: confirmations.toFixed(0),
        totalIndicators
      },
      conditions: {
        meetsStrictCriteria: shouldTrade,
        adxStrength: adxValue >= 30 ? '✅ قوي' : adxValue >= 25 ? '✅ جيد' : '❌ ضعيف',
        agreementLevel: agreementPercentage >= 82 ? '✅ ممتاز' : agreementPercentage >= 75 ? '✅ عالي' : agreementPercentage >= 65 ? 'متوسط' : '❌ منخفض',
        volumeConfirmation: volume.signal.includes('ضخم') ? '✅ ممتاز' : volume.signal.includes('عالي') ? '✅ جيد' : '❌ ضعيف',
        riskRewardRatio: riskRewardRatio >= 2 ? '✅ جيد (1:' + riskRewardRatio.toFixed(1) + ')' : '❌ ضعيف (1:' + riskRewardRatio.toFixed(1) + ')'
      },
      reasons,
      warnings,
      indicators: {
        RSI: rsi,
        MACD: macd,
        EMA20: ema20,
        EMA50: ema50,
        SMA20: sma20,
        SMA50: sma50,
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
}

module.exports = UltraAnalysis;
