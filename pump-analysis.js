const TechnicalAnalysis = require('./analysis');

class PumpAnalysis {
  constructor(candles, symbol) {
    if (!candles || candles.length < 100) {
      throw new Error('يجب توفر 100 شمعة على الأقل لتحليل Pump');
    }
    
    this.candles = candles;
    this.symbol = symbol;
    this.closes = candles.map(c => parseFloat(c.close));
    this.highs = candles.map(c => parseFloat(c.high));
    this.lows = candles.map(c => parseFloat(c.low));
    this.volumes = candles.map(c => parseFloat(c.volume));
    this.analysis = new TechnicalAnalysis(candles);
  }

  getPumpPotential() {
    const currentPrice = this.closes[this.closes.length - 1];
    
    const volumeScore = this.analyzeVolumeSpike();
    const consolidationScore = this.analyzeConsolidation();
    const momentumScore = this.analyzeMomentum();
    const breakoutScore = this.analyzeBreakout();
    const priceActionScore = this.analyzePriceAction();
    
    const totalScore = (
      volumeScore * 0.25 +
      consolidationScore * 0.20 +
      momentumScore * 0.25 +
      breakoutScore * 0.20 +
      priceActionScore * 0.10
    );
    
    let potential = 'منخفض';
    let potentialPercent = '0-30%';
    let confidence = 'منخفضة';
    const reasons = [];
    const warnings = [];
    
    if (totalScore >= 80) {
      potential = 'مرتفع جداً - احتمال 100%+';
      potentialPercent = '100-300%';
      confidence = 'عالية جداً';
      reasons.push('جميع المؤشرات تشير إلى فرصة Pump قوية');
    } else if (totalScore >= 70) {
      potential = 'مرتفع - احتمال 100%+';
      potentialPercent = '100-200%';
      confidence = 'عالية';
      reasons.push('معظم المؤشرات إيجابية لفرصة Pump');
    } else if (totalScore >= 60) {
      potential = 'متوسط إلى مرتفع';
      potentialPercent = '50-100%';
      confidence = 'متوسطة';
      reasons.push('بعض المؤشرات تشير إلى احتمال Pump');
    } else if (totalScore >= 40) {
      potential = 'متوسط';
      potentialPercent = '30-50%';
      confidence = 'منخفضة إلى متوسطة';
      warnings.push('مؤشرات مختلطة - حذر مطلوب');
    } else {
      potential = 'منخفض';
      potentialPercent = '0-30%';
      confidence = 'منخفضة جداً';
      warnings.push('لا توجد إشارات قوية لـ Pump');
    }
    
    if (volumeScore >= 80) {
      reasons.push('🔥 ارتفاع حجم التداول بشكل استثنائي');
    } else if (volumeScore >= 60) {
      reasons.push('📊 حجم تداول أعلى من المتوسط');
    }
    
    if (consolidationScore >= 70) {
      reasons.push('📐 نمط تجميع قوي - احتمال انفجار سعري');
    }
    
    if (momentumScore >= 70) {
      reasons.push('🚀 زخم صعودي قوي');
    }
    
    if (breakoutScore >= 70) {
      reasons.push('💥 كسر مستويات مقاومة مهمة');
    }
    
    if (priceActionScore >= 70) {
      reasons.push('📈 حركة سعرية إيجابية قوية');
    }
    
    const rsi = this.analysis.calculateRSI();
    const macd = this.analysis.calculateMACD();
    const volume = this.analysis.calculateVolumeAnalysis();
    
    const avgVolume = this.volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const currentVolume = this.volumes[this.volumes.length - 1];
    const volumeIncrease = ((currentVolume / avgVolume - 1) * 100).toFixed(2);
    
    const priceChange24h = ((currentPrice / this.closes[this.closes.length - 25] - 1) * 100).toFixed(2);
    const priceChange7d = ((currentPrice / this.closes[this.closes.length - 50] - 1) * 100).toFixed(2);
    
    let recommendation = 'انتظر';
    let action = '⏸️';
    
    if (totalScore >= 70 && parseFloat(rsi.value) < 70) {
      recommendation = 'شراء';
      action = '🟢';
      reasons.push('⭐ فرصة دخول ممتازة الآن');
    } else if (totalScore >= 60) {
      recommendation = 'راقب عن كثب';
      action = '👀';
      reasons.push('💡 راقب للدخول عند أي إشارة إضافية');
    } else if (parseFloat(rsi.value) > 75) {
      recommendation = 'انتظر تصحيح';
      action = '⚠️';
      warnings.push('السعر في منطقة تشبع شرائي');
    }
    
    const supportResistance = this.analysis.advancedAnalysis.calculateSupportResistance();
    const nearestResistance = supportResistance.resistance;
    const nearestSupport = supportResistance.support;
    
    const potentialTarget = currentPrice * (1 + (totalScore / 50));
    let stopLoss = nearestSupport || currentPrice * 0.90;
    
    // التأكد من أن stopLoss رقم صحيح
    if (isNaN(stopLoss) || stopLoss === null || stopLoss === undefined) {
      stopLoss = currentPrice * 0.90;
    }
    
    // التأكد من أن potentialTarget رقم صحيح
    const validTarget = (isNaN(potentialTarget) || potentialTarget === null) ? currentPrice * 1.1 : potentialTarget;
    
    // حساب نسبة المخاطرة إلى العائد بشكل آمن
    const riskReward = (currentPrice > stopLoss) 
      ? ((validTarget - currentPrice) / (currentPrice - stopLoss))
      : 0;
    
    return {
      symbol: this.symbol,
      pump_potential: potential,
      potential_gain: potentialPercent,
      confidence_level: confidence,
      total_score: totalScore.toFixed(2),
      recommendation: recommendation,
      action_emoji: action,
      current_price: currentPrice.toFixed(8),
      target_price: validTarget.toFixed(8),
      stop_loss: stopLoss.toFixed(8),
      risk_reward_ratio: riskReward.toFixed(2),
      
      scores: {
        volume: volumeScore.toFixed(2),
        consolidation: consolidationScore.toFixed(2),
        momentum: momentumScore.toFixed(2),
        breakout: breakoutScore.toFixed(2),
        price_action: priceActionScore.toFixed(2)
      },
      
      indicators: {
        RSI: rsi,
        MACD: macd,
        VOLUME: volume,
        volume_increase: volumeIncrease + '%',
        price_change_24h: priceChange24h + '%',
        price_change_7d: priceChange7d + '%'
      },
      
      support_resistance: {
        support: nearestSupport?.toFixed(8) || 'N/A',
        resistance: nearestResistance?.toFixed(8) || 'N/A'
      },
      
      reasons: reasons.length > 0 ? reasons : ['تحليل معتدل - لا توجد إشارات قوية'],
      warnings: warnings,
      
      timeframe: '1h',
      timestamp: new Date().toISOString()
    };
  }

  analyzeVolumeSpike() {
    const recentVolumes = this.volumes.slice(-30);
    const olderVolumes = this.volumes.slice(-100, -30);
    
    const recentAvg = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const olderAvg = olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length;
    
    const currentVolume = this.volumes[this.volumes.length - 1];
    
    const volumeIncrease = (recentAvg / olderAvg);
    const currentVsAvg = (currentVolume / recentAvg);
    
    let score = 0;
    
    if (volumeIncrease > 3) {
      score += 50;
    } else if (volumeIncrease > 2) {
      score += 35;
    } else if (volumeIncrease > 1.5) {
      score += 20;
    }
    
    if (currentVsAvg > 2) {
      score += 50;
    } else if (currentVsAvg > 1.5) {
      score += 30;
    } else if (currentVsAvg > 1.2) {
      score += 15;
    }
    
    return Math.min(100, score);
  }

  analyzeConsolidation() {
    const recentPrices = this.closes.slice(-50);
    const high = Math.max(...recentPrices);
    const low = Math.min(...recentPrices);
    const range = ((high - low) / low) * 100;
    
    let score = 0;
    
    if (range < 15) {
      score += 80;
    } else if (range < 25) {
      score += 60;
    } else if (range < 35) {
      score += 40;
    } else {
      score += 20;
    }
    
    const last10 = this.closes.slice(-10);
    const last10Range = ((Math.max(...last10) - Math.min(...last10)) / Math.min(...last10)) * 100;
    
    if (last10Range < 5) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  analyzeMomentum() {
    const rsi = parseFloat(this.analysis.calculateRSI().value);
    const macd = this.analysis.calculateMACD();
    
    let score = 0;
    
    if (rsi > 50 && rsi < 70) {
      score += 40;
    } else if (rsi >= 40 && rsi <= 50) {
      score += 30;
    }
    
    if (macd.signal && macd.signal.includes('صاعد')) {
      score += 40;
    } else if (macd.signal && macd.signal.includes('بداية صعود')) {
      score += 30;
    }
    
    const ema20 = parseFloat(this.analysis.calculateEMA(20).value);
    const ema50 = parseFloat(this.analysis.calculateEMA(50).value);
    const currentPrice = this.closes[this.closes.length - 1];
    
    if (currentPrice > ema20 && ema20 > ema50) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  analyzeBreakout() {
    const recentPrices = this.closes.slice(-100);
    const last50High = Math.max(...recentPrices.slice(-50));
    const currentPrice = this.closes[this.closes.length - 1];
    
    let score = 0;
    
    if (currentPrice > last50High) {
      score += 60;
      
      const previousHigh = Math.max(...recentPrices.slice(-100, -50));
      if (currentPrice > previousHigh) {
        score += 40;
      }
    } else if (currentPrice > last50High * 0.98) {
      score += 40;
    } else if (currentPrice > last50High * 0.95) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  analyzePriceAction() {
    const last10Candles = this.candles.slice(-10);
    let bullishCandles = 0;
    let score = 0;
    
    for (const candle of last10Candles) {
      if (parseFloat(candle.close) > parseFloat(candle.open)) {
        bullishCandles++;
      }
    }
    
    if (bullishCandles >= 7) {
      score += 50;
    } else if (bullishCandles >= 6) {
      score += 35;
    } else if (bullishCandles >= 5) {
      score += 20;
    }
    
    const priceChange = ((this.closes[this.closes.length - 1] / this.closes[this.closes.length - 30] - 1) * 100);
    
    if (priceChange > 20) {
      score += 50;
    } else if (priceChange > 10) {
      score += 30;
    } else if (priceChange > 5) {
      score += 20;
    }
    
    return Math.min(100, score);
  }
}

module.exports = PumpAnalysis;
