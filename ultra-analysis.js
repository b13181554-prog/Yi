const TechnicalAnalysis = require('./analysis');
const { t } = require('./languages');

class UltraAnalysis {
  constructor(candles) {
    this.analysis = new TechnicalAnalysis(candles);
    this.candles = candles;
  }

  getUltraRecommendation(marketType = 'crypto', tradingType = 'spot', timeframe = '1h', lang = 'ar') {
    const currentPrice = this.candles[this.candles.length - 1].close;
    
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

    const currentPriceFloat = parseFloat(currentPrice);
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);
    const adxValue = parseFloat(adx.value);
    const rsiValue = parseFloat(rsi.value);

    let buyScore = 0;
    let sellScore = 0;
    let totalIndicators = 0;
    const reasons = [];
    const warnings = [];

    const rangingMarket = this.detectRangingMarket(adxValue, bb, ema20Value, ema50Value, currentPriceFloat, lang);
    if (rangingMarket.isRanging) {
      warnings.push('⚠️ ' + t(lang, 'analysis_warning_ranging_market'));
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType, rangingMarket.reason, lang);
    }

    const indicatorWeights = {
      rsi: 1.5,
      macd: 2.0,
      ema: 2.5,
      stochastic: 1.0,
      bollingerBands: 1.5,
      adx: 2.0,
      volume: 1.8,
      fibonacci: 1.2,
      candlePatterns: 1.5,
      supportResistance: 1.3
    };

    if (rsiValue < 30) {
      buyScore += 2.5 * indicatorWeights.rsi;
      reasons.push(t(lang, 'analysis_rsi_strong_oversold'));
    } else if (rsiValue < 45) {
      buyScore += 1.5 * indicatorWeights.rsi;
      reasons.push(t(lang, 'analysis_rsi_buy_zone'));
    } else if (rsiValue > 70) {
      sellScore += 2.5 * indicatorWeights.rsi;
      reasons.push(t(lang, 'analysis_rsi_strong_overbought'));
    } else if (rsiValue > 55) {
      sellScore += 1.5 * indicatorWeights.rsi;
      reasons.push(t(lang, 'analysis_rsi_sell_zone'));
    }
    totalIndicators++;

    if (macd.signal.includes('صاعد قوي')) {
      buyScore += 2.5 * indicatorWeights.macd;
      reasons.push(t(lang, 'analysis_macd_strong_bullish'));
    } else if (macd.signal.includes('صاعد')) {
      buyScore += 1.5 * indicatorWeights.macd;
      reasons.push(t(lang, 'analysis_macd_bullish'));
    } else if (macd.signal.includes('هابط قوي')) {
      sellScore += 2.5 * indicatorWeights.macd;
      reasons.push(t(lang, 'analysis_macd_strong_bearish'));
    } else if (macd.signal.includes('هابط')) {
      sellScore += 1.5 * indicatorWeights.macd;
      reasons.push(t(lang, 'analysis_macd_bearish'));
    }
    totalIndicators++;

    if (bb.signal.includes('تشبع بيعي')) {
      buyScore += 2.5 * indicatorWeights.bollingerBands;
      reasons.push('Bollinger Bands - تشبع بيعي');
    } else if (bb.signal.includes('هابط')) {
      buyScore += 1.2 * indicatorWeights.bollingerBands;
    } else if (bb.signal.includes('تشبع شرائي')) {
      sellScore += 2.5 * indicatorWeights.bollingerBands;
      reasons.push('Bollinger Bands - تشبع شرائي');
    } else if (bb.signal.includes('صاعد')) {
      sellScore += 1.2 * indicatorWeights.bollingerBands;
    }
    totalIndicators++;

    if (stoch.signal.includes('تشبع بيعي')) {
      buyScore += 2.0 * indicatorWeights.stochastic;
      reasons.push('Stochastic تشبع بيعي');
    } else if (stoch.signal.includes('تشبع شرائي')) {
      sellScore += 2.0 * indicatorWeights.stochastic;
      reasons.push('Stochastic تشبع شرائي');
    }
    totalIndicators++;
    
    if (currentPriceFloat > ema20Value && ema20Value > ema50Value) {
      buyScore += 3.0 * indicatorWeights.ema;
      reasons.push('EMA Golden Cross - اتجاه صعودي قوي');
    } else if (currentPriceFloat > ema20Value) {
      buyScore += 1.5 * indicatorWeights.ema;
    } else if (currentPriceFloat < ema20Value && ema20Value < ema50Value) {
      sellScore += 3.0 * indicatorWeights.ema;
      reasons.push('EMA Death Cross - اتجاه هبوطي قوي');
    } else if (currentPriceFloat < ema20Value) {
      sellScore += 1.5 * indicatorWeights.ema;
    }
    totalIndicators++;

    if (adxValue > 30) {
      if (adx.signal.includes('صاعد')) {
        buyScore += 2.5 * indicatorWeights.adx;
        reasons.push(`ADX قوي (${adxValue.toFixed(0)}) - اتجاه صعودي قوي`);
      } else if (adx.signal.includes('هابط')) {
        sellScore += 2.5 * indicatorWeights.adx;
        reasons.push(`ADX قوي (${adxValue.toFixed(0)}) - اتجاه هبوطي قوي`);
      }
    } else if (adxValue > 25) {
      if (adx.signal.includes('صاعد')) {
        buyScore += 1.5 * indicatorWeights.adx;
        reasons.push(`ADX متوسط (${adxValue.toFixed(0)}) - اتجاه صعودي`);
      } else if (adx.signal.includes('هابط')) {
        sellScore += 1.5 * indicatorWeights.adx;
        reasons.push(`ADX متوسط (${adxValue.toFixed(0)}) - اتجاه هبوطي`);
      }
    }
    totalIndicators++;

    if (volume.signal.includes('ضخم')) {
      if (buyScore > sellScore) {
        buyScore += 2.5 * indicatorWeights.volume;
        reasons.push('حجم تداول ضخم يدعم الاتجاه الصعودي');
      } else if (sellScore > buyScore) {
        sellScore += 2.5 * indicatorWeights.volume;
        reasons.push('حجم تداول ضخم يدعم الاتجاه الهبوطي');
      }
    } else if (volume.signal.includes('عالي')) {
      if (buyScore > sellScore) {
        buyScore += 1.5 * indicatorWeights.volume;
        reasons.push('حجم تداول عالي');
      } else if (sellScore > buyScore) {
        sellScore += 1.5 * indicatorWeights.volume;
        reasons.push('حجم تداول عالي');
      }
    }
    totalIndicators++;

    if (fibonacci.signal.includes('دعم قوية')) {
      buyScore += 2.0 * indicatorWeights.fibonacci;
      reasons.push('Fibonacci - منطقة دعم قوية');
    } else if (fibonacci.signal.includes('دعم')) {
      buyScore += 1.0 * indicatorWeights.fibonacci;
    } else if (fibonacci.signal.includes('مقاومة قوية')) {
      sellScore += 2.0 * indicatorWeights.fibonacci;
      reasons.push('Fibonacci - منطقة مقاومة قوية');
    } else if (fibonacci.signal.includes('مقاومة')) {
      sellScore += 1.0 * indicatorWeights.fibonacci;
    }
    totalIndicators++;

    if (candlePatterns.signal === 'صعودي') {
      const strongPatterns = candlePatterns.patterns.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي');
      if (strongPatterns.length > 0) {
        buyScore += 2.5 * indicatorWeights.candlePatterns;
        reasons.push(`أنماط شموع صعودية: ${strongPatterns.map(p => p.name).join(', ')}`);
      } else {
        buyScore += 1.2 * indicatorWeights.candlePatterns;
      }
    } else if (candlePatterns.signal === 'هبوطي') {
      const strongPatterns = candlePatterns.patterns.filter(p => p.strength === 'قوي جداً' || p.strength === 'قوي');
      if (strongPatterns.length > 0) {
        sellScore += 2.5 * indicatorWeights.candlePatterns;
        reasons.push(`أنماط شموع هبوطية: ${strongPatterns.map(p => p.name).join(', ')}`);
      } else {
        sellScore += 1.2 * indicatorWeights.candlePatterns;
      }
    }
    totalIndicators++;

    if (headShoulders.detected) {
      if (headShoulders.type === 'bullish') {
        buyScore += 2.5 * indicatorWeights.candlePatterns;
        reasons.push('نموذج Inverse H&S - إشارة صعودية قوية');
      } else if (headShoulders.type === 'bearish') {
        sellScore += 2.5 * indicatorWeights.candlePatterns;
        reasons.push('نموذج H&S - إشارة هبوطية قوية');
      }
      totalIndicators++;
    }

    if (supportResistance.signal.includes('دعم')) {
      buyScore += 2.0 * indicatorWeights.supportResistance;
      reasons.push('السعر قريب من مستوى الدعم');
    } else if (supportResistance.signal.includes('مقاومة')) {
      sellScore += 2.0 * indicatorWeights.supportResistance;
      reasons.push('السعر قريب من مستوى المقاومة');
    }
    totalIndicators++;

    const maxPossibleScore = this.calculateMaxScore(indicatorWeights, totalIndicators);
    const buyPercentage = (buyScore / maxPossibleScore) * 100;
    const sellPercentage = (sellScore / maxPossibleScore) * 100;
    const agreementPercentage = Math.max(buyPercentage, sellPercentage);
    
    const scoreDifference = Math.abs(buyScore - sellScore);
    const minScoreDifference = maxPossibleScore * 0.15;
    
    if (scoreDifference < minScoreDifference) {
      warnings.push('❌ إشارات متعارضة - الفرق بين الشراء والبيع ضئيل جداً');
      return this.generateWaitResponse(warnings, currentPriceFloat, timeframe, marketType, tradingType, 'إشارات متعارضة', lang);
    }

    const atrValue = parseFloat(atr.value);
    const atrPercent = (atrValue / currentPriceFloat) * 100;
    
    const timeframeMultipliers = {
      '1m': { sl: 1.0, tp: 2.0 },
      '5m': { sl: 1.2, tp: 2.5 },
      '15m': { sl: 1.5, tp: 3.0 },
      '30m': { sl: 1.8, tp: 3.5 },
      '1h': { sl: 2.0, tp: 4.0 },
      '2h': { sl: 2.2, tp: 4.5 },
      '4h': { sl: 2.5, tp: 5.0 },
      '1d': { sl: 3.0, tp: 6.0 },
      '1w': { sl: 3.5, tp: 7.0 }
    };
    
    const multiplier = timeframeMultipliers[normalizedTimeframe] || timeframeMultipliers['1h'];
    
    const stopLossPercent = Math.max(atrPercent * multiplier.sl, 0.5);
    const takeProfitPercent = stopLossPercent * (multiplier.tp / multiplier.sl);
    
    const stopLossDistance = (currentPriceFloat * stopLossPercent) / 100;
    const takeProfitDistance = (currentPriceFloat * takeProfitPercent) / 100;

    let recommendation = 'انتظار';
    let action = 'WAIT';
    let emoji = '🟡';
    let confidenceLevel = 'منخفضة';
    let stopLoss = 0;
    let takeProfit = 0;
    let entryPrice = currentPriceFloat;
    let riskLevel = 'مرتفع';
    let shouldTrade = false;

    const confirmations = Math.max(buyScore, sellScore) / 2;
    
    const hasStrongVolume = volume.signal.includes('ضخم') || volume.signal.includes('عالي');
    
    const riskRewardRatio = takeProfitDistance / stopLossDistance;
    const hasGoodRiskReward = riskRewardRatio >= 2.0;
    
    const hasRSIConfirmation = (buyScore > sellScore && rsiValue < 60) || 
                               (sellScore > buyScore && rsiValue > 40);
    const hasMACDConfirmation = (buyScore > sellScore && macd.signal.includes('صاعد')) || 
                                (sellScore > buyScore && macd.signal.includes('هابط'));
    const hasADXConfirmation = adxValue >= 20;

    if (buyScore > sellScore) {
      recommendation = 'شراء';
      action = 'BUY';
      emoji = '🟢';
      stopLoss = currentPriceFloat - stopLossDistance;
      takeProfit = currentPriceFloat + takeProfitDistance;
      
      if (agreementPercentage >= 70 && adxValue >= 25 && confirmations >= 6 && 
          hasStrongVolume && hasGoodRiskReward && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '💚';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ جميع الشروط محققة - صفقة قوية جداً');
      } else if (agreementPercentage >= 60 && adxValue >= 20 && confirmations >= 5 && 
                 hasADXConfirmation && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية';
        emoji = '💚';
        riskLevel = 'متوسط';
        shouldTrade = true;
        reasons.push('✅ الشروط محققة - صفقة جيدة');
      } else if (agreementPercentage >= 50 && confirmations >= 4 && hasRSIConfirmation) {
        confidenceLevel = 'متوسطة';
        emoji = '🟢';
        riskLevel = 'متوسط';
        shouldTrade = true;
        warnings.push('⚠️ صفقة متوسطة القوة - تداول بحذر');
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
      
      if (agreementPercentage >= 70 && adxValue >= 25 && confirmations >= 6 && 
          hasStrongVolume && hasGoodRiskReward && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية جداً (Ultra High)';
        emoji = '❤️';
        riskLevel = 'منخفض';
        shouldTrade = true;
        reasons.push('✅ جميع الشروط محققة - صفقة قوية جداً');
      } else if (agreementPercentage >= 60 && adxValue >= 20 && confirmations >= 5 && 
                 hasADXConfirmation && hasRSIConfirmation && hasMACDConfirmation) {
        confidenceLevel = 'عالية';
        emoji = '❤️';
        riskLevel = 'متوسط';
        shouldTrade = true;
        reasons.push('✅ الشروط محققة - صفقة جيدة');
      } else if (agreementPercentage >= 50 && confirmations >= 4 && hasRSIConfirmation) {
        confidenceLevel = 'متوسطة';
        emoji = '🔴';
        riskLevel = 'متوسط';
        shouldTrade = true;
        warnings.push('⚠️ صفقة متوسطة القوة - تداول بحذر');
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
      riskRewardRatio: riskRewardRatio.toFixed(2),
      scores: {
        buyScore: buyScore.toFixed(1),
        sellScore: sellScore.toFixed(1),
        buyPercentage: buyPercentage.toFixed(1) + '%',
        sellPercentage: sellPercentage.toFixed(1) + '%',
        agreementPercentage: agreementPercentage.toFixed(1) + '%',
        confirmations: confirmations.toFixed(0),
        totalIndicators,
        scoreDifference: scoreDifference.toFixed(1)
      },
      conditions: {
        meetsStrictCriteria: shouldTrade,
        adxStrength: adxValue >= 25 ? '✅ قوي' : adxValue >= 20 ? '✅ جيد' : '❌ ضعيف',
        agreementLevel: agreementPercentage >= 70 ? '✅ ممتاز' : agreementPercentage >= 60 ? '✅ عالي' : agreementPercentage >= 50 ? 'متوسط' : '❌ منخفض',
        volumeConfirmation: volume.signal.includes('ضخم') ? '✅ ممتاز' : volume.signal.includes('عالي') ? '✅ جيد' : '❌ ضعيف',
        riskRewardRatio: riskRewardRatio >= 2.5 ? '✅ ممتاز (1:' + riskRewardRatio.toFixed(1) + ')' : riskRewardRatio >= 2.0 ? '✅ جيد (1:' + riskRewardRatio.toFixed(1) + ')' : '⚠️ مقبول (1:' + riskRewardRatio.toFixed(1) + ')',
        rangingMarket: rangingMarket.isRanging ? '❌ نعم' : '✅ لا'
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

  detectRangingMarket(adxValue, bb, ema20Value, ema50Value, currentPrice) {
    if (adxValue < 20) {
      return {
        isRanging: true,
        reason: `ADX ضعيف جداً (${adxValue.toFixed(0)}) - السوق في حالة جانبية`
      };
    }

    const priceRange = Math.abs(currentPrice - ema20Value) / currentPrice * 100;
    const emaRange = Math.abs(ema20Value - ema50Value) / ema20Value * 100;
    
    if (priceRange < 0.5 && emaRange < 0.3) {
      return {
        isRanging: true,
        reason: 'السعر والمتوسطات متقاربة جداً - سوق جانبي'
      };
    }

    if (bb.signal.includes('محايد') && adxValue < 25) {
      return {
        isRanging: true,
        reason: 'Bollinger Bands ضيقة و ADX ضعيف - سوق جانبي'
      };
    }

    return {
      isRanging: false,
      reason: ''
    };
  }

  calculateMaxScore(weights, totalIndicators) {
    return (weights.rsi * 2.5 + 
            weights.macd * 2.5 + 
            weights.bollingerBands * 2.5 + 
            weights.stochastic * 2.0 +
            weights.ema * 3.0 +
            weights.adx * 2.5 +
            weights.volume * 2.5 +
            weights.fibonacci * 2.0 +
            weights.candlePatterns * 2.5 +
            weights.candlePatterns * 2.5 +
            weights.supportResistance * 2.0);
  }

  generateWaitResponse(warnings, currentPrice, timeframe, marketType, tradingType, reason, lang = 'ar') {
    return {
      mode: 'ULTRA_ANALYSIS',
      recommendation: 'انتظار',
      action: 'WAIT',
      emoji: '⛔',
      confidence: 'لا تتداول',
      shouldTrade: false,
      riskLevel: 'مرتفع جداً',
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
      reasons: [`السبب: ${reason}`],
      warnings,
      scores: {
        buyScore: '0.0',
        sellScore: '0.0',
        buyPercentage: '0.0%',
        sellPercentage: '0.0%',
        agreementPercentage: '0.0%',
        confirmations: '0',
        totalIndicators: 0,
        scoreDifference: '0.0'
      },
      conditions: {
        meetsStrictCriteria: false,
        adxStrength: '❌ غير متاح',
        agreementLevel: '❌ غير متاح',
        volumeConfirmation: '❌ غير متاح',
        riskRewardRatio: '❌ غير متاح',
        rangingMarket: '✅ نعم'
      },
      indicators: {}
    };
  }
}

module.exports = UltraAnalysis;
