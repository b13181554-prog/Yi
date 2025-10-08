const TechnicalAnalysis = require('./analysis');

class UltraAnalysis {
  constructor(candles) {
    this.analysis = new TechnicalAnalysis(candles);
    this.candles = candles;
  }

  getUltraRecommendation(marketType = 'spot', tradingType = 'spot') {
    const currentPrice = this.candles[this.candles.length - 1].close;
    
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
    } else if (adxValue < 20) {
      warnings.push('⚠️ ADX ضعيف - لا يوجد اتجاه واضح');
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
    } else if (volume.signal.includes('منخفض')) {
      warnings.push('⚠️ حجم تداول منخفض - قد لا تكون الحركة قوية');
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
    const stopLossPercent = Math.max(atrPercent * 1.5, 0.5);
    const takeProfitPercent = stopLossPercent * (tradingType === 'futures' ? 3 : 2.5);
    
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
      requiredVolume: ['عالي', 'ضخم'],
      minConfirmations: 6
    };

    const confirmations = (buyScore > sellScore ? buyScore : sellScore) / 2;

    if (buyScore > sellScore) {
      recommendation = 'شراء';
      action = 'BUY';
      emoji = '🟢';
      stopLoss = currentPriceFloat - stopLossDistance;
      takeProfit = currentPriceFloat + takeProfitDistance;
      
      if (agreementPercentage >= 85 && adxValue >= 30 && confirmations >= 7) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '💚';
        riskLevel = 'منخفض جداً';
        shouldTrade = true;
      } else if (agreementPercentage >= 75 && adxValue >= 25 && confirmations >= 6) {
        confidenceLevel = 'عالية';
        riskLevel = 'منخفض';
        shouldTrade = true;
      } else if (agreementPercentage >= 65) {
        confidenceLevel = 'متوسطة';
        riskLevel = 'متوسط';
        warnings.push('⚠️ لا يفي بالمعايير الصارمة - يفضل الانتظار');
      } else {
        confidenceLevel = 'منخفضة';
        riskLevel = 'مرتفع';
        warnings.push('❌ إشارة ضعيفة - لا ينصح بالدخول');
      }
    } else if (sellScore > buyScore) {
      recommendation = 'بيع';
      action = 'SELL';
      emoji = '🔴';
      stopLoss = currentPriceFloat + stopLossDistance;
      takeProfit = currentPriceFloat - takeProfitDistance;
      
      if (agreementPercentage >= 85 && adxValue >= 30 && confirmations >= 7) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '❤️';
        riskLevel = 'منخفض جداً';
        shouldTrade = true;
      } else if (agreementPercentage >= 75 && adxValue >= 25 && confirmations >= 6) {
        confidenceLevel = 'عالية';
        riskLevel = 'منخفض';
        shouldTrade = true;
      } else if (agreementPercentage >= 65) {
        confidenceLevel = 'متوسطة';
        riskLevel = 'متوسط';
        warnings.push('⚠️ لا يفي بالمعايير الصارمة - يفضل الانتظار');
      } else {
        confidenceLevel = 'منخفضة';
        riskLevel = 'مرتفع';
        warnings.push('❌ إشارة ضعيفة - لا ينصح بالدخول');
      }
    } else {
      warnings.push('⚠️ إشارات متعارضة - انتظر حتى تتضح الصورة');
      riskLevel = 'مرتفع جداً';
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
        adxStrength: adxValue >= 25 ? '✅ قوي' : '❌ ضعيف',
        agreementLevel: agreementPercentage >= 75 ? '✅ عالي' : agreementPercentage >= 65 ? '⚠️ متوسط' : '❌ منخفض',
        volumeConfirmation: ['عالي', 'ضخم'].includes(volume.signal.replace('حجم ', '')) ? '✅ جيد' : '❌ ضعيف'
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
      },
      disclaimer: '⚠️ هذا التحليل لأغراض تعليمية فقط. التداول يحمل مخاطر عالية وقد تخسر رأس مالك. استشر خبير مالي قبل اتخاذ أي قرار.'
    };
  }
}

module.exports = UltraAnalysis;
