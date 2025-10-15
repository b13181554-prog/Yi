const TechnicalAnalysis = require('./analysis');
const marketData = require('./market-data');
const forexService = require('./forex-service');

/**
 * 🎯 OBENTCHI MASTER ANALYSIS
 * نظام التحليل الأسطوري الشامل
 * 
 * يجمع كل أنواع التحليل في نظام واحد متكامل:
 * - تحليل متعدد الإطارات الزمنية
 * - تصنيف الفرص (S+, A+, A, B, C, D, F)
 * - خريطة حرارية للمؤشرات
 * - توقعات ذكية للسعر
 * - نقاط دخول/خروج مثالية
 * - احتمالية النجاح
 */

class MasterAnalysis {
  constructor(candles, symbol, timeframe, marketType = 'crypto') {
    this.candles = candles;
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.marketType = marketType;
    this.analysis = new TechnicalAnalysis(candles);
    this.currentPrice = parseFloat(candles[candles.length - 1].close);
  }

  /**
   * 🔥 التحليل الرئيسي الشامل
   */
  async getMasterAnalysis(tradingType = 'spot') {
    try {
      // 1. تحليل الإطار الزمني الحالي
      const currentTimeframeAnalysis = await this.analyzeCurrentTimeframe(tradingType);
      
      // 2. تحليل متعدد الإطارات الزمنية
      const multiTimeframeAnalysis = await this.analyzeMultipleTimeframes();
      
      // 3. حساب النقاط الشاملة والتصنيف
      const scoreAndGrade = this.calculateMasterScore(currentTimeframeAnalysis, multiTimeframeAnalysis);
      
      // 4. تحديد نقاط الدخول والخروج المثالية
      const entryExitPoints = this.calculateOptimalEntryExit(currentTimeframeAnalysis);
      
      // 5. توقعات السعر الذكية
      const pricePredictions = this.predictPriceMovement(currentTimeframeAnalysis, multiTimeframeAnalysis);
      
      // 6. احتمالية النجاح
      const successProbability = this.calculateSuccessProbability(scoreAndGrade, multiTimeframeAnalysis);
      
      // 7. خريطة حرارية للمؤشرات
      const heatmap = this.generateIndicatorsHeatmap(currentTimeframeAnalysis);
      
      // 8. التوصية النهائية
      const finalRecommendation = this.generateFinalRecommendation(
        scoreAndGrade,
        entryExitPoints,
        pricePredictions,
        successProbability,
        currentTimeframeAnalysis
      );

      return {
        // معلومات أساسية
        symbol: this.symbol,
        currentPrice: this.currentPrice,
        timeframe: this.timeframe,
        marketType: this.marketType,
        tradingType,
        analysisTime: new Date().toLocaleString('ar-SA'),
        
        // النتائج الرئيسية
        masterScore: scoreAndGrade.score,
        grade: scoreAndGrade.grade,
        gradeEmoji: scoreAndGrade.emoji,
        recommendation: finalRecommendation.action,
        confidence: finalRecommendation.confidence,
        
        // التحليل التفصيلي
        currentTimeframe: currentTimeframeAnalysis,
        multiTimeframe: multiTimeframeAnalysis,
        entryExitPoints,
        pricePredictions,
        successProbability,
        heatmap,
        
        // التوصية النهائية مع التفاصيل
        finalRecommendation,
        
        // رسائل وتحذيرات
        reasons: finalRecommendation.reasons,
        warnings: finalRecommendation.warnings,
        tips: this.generateSmartTips(finalRecommendation, scoreAndGrade)
      };
    } catch (error) {
      console.error('❌ Master Analysis Error:', error);
      throw error;
    }
  }

  /**
   * 📊 تحليل الإطار الزمني الحالي
   */
  async analyzeCurrentTimeframe(tradingType) {
    const rsi = this.analysis.calculateRSI(14);
    const macd = this.analysis.calculateMACD();
    const bb = this.analysis.calculateBollingerBands();
    const atr = this.analysis.calculateATR(14);
    const stoch = this.analysis.calculateStochastic();
    const adx = this.analysis.calculateADX(14);
    const volume = this.analysis.calculateVolumeAnalysis();
    const ema20 = this.analysis.calculateEMA(20);
    const ema50 = this.analysis.calculateEMA(50);
    const ema200 = this.analysis.calculateEMA(200);
    const sma20 = this.analysis.calculateSMA(20);
    const sma50 = this.analysis.calculateSMA(50);
    
    const fibonacci = this.analysis.advancedAnalysis.calculateFibonacci();
    const candlePatterns = this.analysis.advancedAnalysis.detectCandlePatterns();
    const supportResistance = this.analysis.advancedAnalysis.calculateSupportResistance();

    return {
      indicators: {
        rsi,
        macd,
        bb,
        atr,
        stoch,
        adx,
        volume,
        ema20,
        ema50,
        ema200,
        sma20,
        sma50
      },
      patterns: {
        fibonacci,
        candles: candlePatterns,
        supportResistance
      }
    };
  }

  /**
   * 🌍 تحليل متعدد الإطارات الزمنية
   */
  async analyzeMultipleTimeframes() {
    const timeframes = this.getRelevantTimeframes();
    const results = {};

    for (const tf of timeframes) {
      try {
        let candles;
        if (this.marketType === 'forex') {
          candles = await forexService.getCandles(this.symbol, tf, 100);
        } else {
          candles = await marketData.getCandles(this.symbol, tf, 100, this.marketType);
        }

        if (candles && candles.length >= 50) {
          const analysis = new TechnicalAnalysis(candles);
          const rsi = analysis.calculateRSI(14);
          const macd = analysis.calculateMACD();
          const adx = analysis.calculateADX(14);
          const ema50 = analysis.calculateEMA(50);

          results[tf] = {
            trend: this.determineTrend(analysis, candles),
            strength: this.calculateTrendStrength(rsi, macd, adx),
            rsi: parseFloat(rsi.value),
            macdSignal: macd.signal,
            adxStrength: parseFloat(adx.value) || 0
          };
        }
      } catch (error) {
        console.log(`⚠️ لم يتم تحليل ${tf}:`, error.message);
      }
    }

    return results;
  }

  /**
   * 🎯 الأطر الزمنية المناسبة للتحليل
   */
  getRelevantTimeframes() {
    const tfMap = {
      '1m': ['5m', '15m', '1h'],
      '5m': ['15m', '1h', '4h'],
      '15m': ['1h', '4h', '1d'],
      '30m': ['1h', '4h', '1d'],
      '1h': ['4h', '1d', '1w'],
      '4h': ['1d', '1w'],
      '1d': ['1w'],
      '1w': []
    };

    return tfMap[this.timeframe] || ['1h', '4h', '1d'];
  }

  /**
   * 📈 تحديد الاتجاه
   */
  determineTrend(analysis, candles) {
    const ema20 = analysis.calculateEMA(20);
    const ema50 = analysis.calculateEMA(50);
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);

    if (currentPrice > ema20Value && ema20Value > ema50Value) {
      return { direction: 'صعودي قوي', emoji: '🚀', score: 2 };
    } else if (currentPrice > ema20Value && currentPrice > ema50Value) {
      return { direction: 'صعودي', emoji: '📈', score: 1 };
    } else if (currentPrice < ema20Value && ema20Value < ema50Value) {
      return { direction: 'هبوطي قوي', emoji: '📉', score: -2 };
    } else if (currentPrice < ema20Value && currentPrice < ema50Value) {
      return { direction: 'هبوطي', emoji: '🔻', score: -1 };
    } else {
      return { direction: 'محايد', emoji: '➡️', score: 0 };
    }
  }

  /**
   * 💪 قوة الاتجاه
   */
  calculateTrendStrength(rsi, macd, adx) {
    let strength = 0;
    const rsiValue = parseFloat(rsi.value);
    const adxValue = parseFloat(adx.value) || 0;

    // RSI contribution
    if (rsiValue > 70 || rsiValue < 30) strength += 30;
    else if (rsiValue > 60 || rsiValue < 40) strength += 20;
    else if (rsiValue > 55 || rsiValue < 45) strength += 10;

    // MACD contribution
    if (macd.signal.includes('قوي')) strength += 30;
    else if (macd.signal.includes('صاعد') || macd.signal.includes('هابط')) strength += 15;

    // ADX contribution
    if (adxValue > 40) strength += 40;
    else if (adxValue > 25) strength += 25;
    else if (adxValue > 20) strength += 10;

    return Math.min(100, strength);
  }

  /**
   * 🏆 حساب النقاط الشاملة والتصنيف
   */
  calculateMasterScore(current, multiTF) {
    let totalScore = 0;
    const indicators = current.indicators;

    // RSI (15 نقطة)
    const rsiVal = parseFloat(indicators.rsi.value);
    if (rsiVal > 70) totalScore += 12;
    else if (rsiVal > 60) totalScore += 10;
    else if (rsiVal < 30) totalScore += 12;
    else if (rsiVal < 40) totalScore += 10;
    else if (rsiVal >= 45 && rsiVal <= 55) totalScore += 5;

    // MACD (15 نقطة)
    if (indicators.macd.signal.includes('قوي')) totalScore += 15;
    else if (indicators.macd.signal.includes('صاعد') || indicators.macd.signal.includes('هابط')) totalScore += 10;
    else totalScore += 3;

    // ADX (15 نقطة)
    const adxVal = parseFloat(indicators.adx.value) || 0;
    if (adxVal > 40) totalScore += 15;
    else if (adxVal > 25) totalScore += 12;
    else if (adxVal > 20) totalScore += 8;
    else totalScore += 3;

    // Volume (10 نقطة)
    if (indicators.volume.signal.includes('ضخم')) totalScore += 10;
    else if (indicators.volume.signal.includes('عالي')) totalScore += 8;
    else if (indicators.volume.signal.includes('متوسط')) totalScore += 5;

    // Bollinger Bands (10 نقطة)
    if (indicators.bb.signal.includes('تشبع')) totalScore += 10;
    else if (indicators.bb.signal.includes('خروج')) totalScore += 7;

    // Stochastic (10 نقطة)
    if (indicators.stoch.signal.includes('قوي')) totalScore += 10;
    else if (indicators.stoch.signal.includes('تشبع')) totalScore += 8;

    // Fibonacci (5 نقطة)
    if (current.patterns.fibonacci.signal.includes('قوية')) totalScore += 5;

    // Candle Patterns (10 نقطة)
    if (current.patterns.candles.patterns.length > 0) totalScore += 10;

    // Multi-Timeframe Alignment (10 نقطة)
    const tfAlignment = this.calculateTimeframeAlignment(multiTF);
    totalScore += tfAlignment;

    // Normalize to 100
    const finalScore = Math.min(100, Math.round(totalScore));

    // Determine Grade
    let grade, emoji, description;
    if (finalScore >= 90) {
      grade = 'S+';
      emoji = '👑';
      description = 'فرصة أسطورية نادرة';
    } else if (finalScore >= 85) {
      grade = 'S';
      emoji = '💎';
      description = 'فرصة ممتازة جداً';
    } else if (finalScore >= 80) {
      grade = 'A+';
      emoji = '🏆';
      description = 'فرصة ممتازة';
    } else if (finalScore >= 70) {
      grade = 'A';
      emoji = '⭐';
      description = 'فرصة جيدة جداً';
    } else if (finalScore >= 60) {
      grade = 'B+';
      emoji = '✨';
      description = 'فرصة جيدة';
    } else if (finalScore >= 50) {
      grade = 'B';
      emoji = '💫';
      description = 'فرصة متوسطة إلى جيدة';
    } else if (finalScore >= 40) {
      grade = 'C';
      emoji = '⚡';
      description = 'فرصة متوسطة';
    } else if (finalScore >= 30) {
      grade = 'D';
      emoji = '⚠️';
      description = 'فرصة ضعيفة';
    } else {
      grade = 'F';
      emoji = '❌';
      description = 'لا توجد فرصة واضحة';
    }

    return { score: finalScore, grade, emoji, description };
  }

  /**
   * ⏰ محاذاة الأطر الزمنية
   */
  calculateTimeframeAlignment(multiTF) {
    const timeframes = Object.keys(multiTF);
    if (timeframes.length === 0) return 0;

    let bullishCount = 0;
    let bearishCount = 0;

    for (const tf of timeframes) {
      const trend = multiTF[tf].trend;
      if (trend.score > 0) bullishCount++;
      else if (trend.score < 0) bearishCount++;
    }

    const total = timeframes.length;
    const alignment = Math.max(bullishCount, bearishCount) / total;

    return Math.round(alignment * 10); // max 10 points
  }

  /**
   * 🎯 نقاط الدخول والخروج المثالية
   */
  calculateOptimalEntryExit(current) {
    const indicators = current.indicators;
    const atrValue = parseFloat(indicators.atr.value) || 0;
    const currentPrice = this.currentPrice;

    // Support & Resistance
    const sr = current.patterns.supportResistance;
    const nearestSupport = sr.nearestSupport;
    const nearestResistance = sr.nearestResistance;

    // Fibonacci levels
    const fib = current.patterns.fibonacci;

    // Calculate optimal entry based on trend
    let optimalEntry, stopLoss, takeProfit1, takeProfit2, takeProfit3;

    const rsiVal = parseFloat(indicators.rsi.value);
    const isBullish = rsiVal < 50 || indicators.macd.signal.includes('صاعد');

    if (isBullish) {
      // Buy setup
      optimalEntry = currentPrice;
      stopLoss = nearestSupport ? parseFloat(nearestSupport) : currentPrice - (atrValue * 1.5);
      takeProfit1 = currentPrice + (atrValue * 2);
      takeProfit2 = currentPrice + (atrValue * 3);
      takeProfit3 = nearestResistance ? parseFloat(nearestResistance) : currentPrice + (atrValue * 4);
    } else {
      // Sell setup
      optimalEntry = currentPrice;
      stopLoss = nearestResistance ? parseFloat(nearestResistance) : currentPrice + (atrValue * 1.5);
      takeProfit1 = currentPrice - (atrValue * 2);
      takeProfit2 = currentPrice - (atrValue * 3);
      takeProfit3 = nearestSupport ? parseFloat(nearestSupport) : currentPrice - (atrValue * 4);
    }

    const riskReward1 = Math.abs((takeProfit1 - optimalEntry) / (optimalEntry - stopLoss));
    const riskReward2 = Math.abs((takeProfit2 - optimalEntry) / (optimalEntry - stopLoss));
    const riskReward3 = Math.abs((takeProfit3 - optimalEntry) / (optimalEntry - stopLoss));

    return {
      optimalEntry: this.formatPrice(optimalEntry),
      stopLoss: this.formatPrice(stopLoss),
      targets: [
        { level: 1, price: this.formatPrice(takeProfit1), riskReward: riskReward1.toFixed(2) },
        { level: 2, price: this.formatPrice(takeProfit2), riskReward: riskReward2.toFixed(2) },
        { level: 3, price: this.formatPrice(takeProfit3), riskReward: riskReward3.toFixed(2) }
      ],
      nearestSupport: this.formatPrice(nearestSupport),
      nearestResistance: this.formatPrice(nearestResistance),
      atrValue: this.formatPrice(atrValue)
    };
  }

  /**
   * 🔮 توقعات حركة السعر
   */
  predictPriceMovement(current, multiTF) {
    const indicators = current.indicators;
    const rsiVal = parseFloat(indicators.rsi.value);
    const adxVal = parseFloat(indicators.adx.value) || 0;
    const volumeSignal = indicators.volume.signal;

    // حساب قوة الحركة المتوقعة
    let movementStrength = 0;
    if (adxVal > 30) movementStrength += 40;
    else if (adxVal > 20) movementStrength += 25;
    
    if (volumeSignal.includes('ضخم')) movementStrength += 30;
    else if (volumeSignal.includes('عالي')) movementStrength += 20;

    if (rsiVal > 70 || rsiVal < 30) movementStrength += 30;

    // اتجاه الحركة
    const isBullish = rsiVal < 50 || indicators.macd.signal.includes('صاعد');
    const direction = isBullish ? 'صعودية' : 'هبوطية';
    const directionEmoji = isBullish ? '📈' : '📉';

    // حساب النسب المتوقعة
    const baseMove = movementStrength / 10; // 0-10%
    
    return {
      direction,
      directionEmoji,
      movementStrength,
      predictions: {
        next24h: {
          min: this.formatPrice(this.currentPrice * (1 + (isBullish ? -0.01 : -0.03))),
          max: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove/100 : -baseMove/100))),
          likely: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove/200 : -baseMove/200)))
        },
        next48h: {
          min: this.formatPrice(this.currentPrice * (1 + (isBullish ? -0.02 : -0.05))),
          max: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove*1.5/100 : -baseMove*1.5/100))),
          likely: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove*1.5/200 : -baseMove*1.5/200)))
        },
        next72h: {
          min: this.formatPrice(this.currentPrice * (1 + (isBullish ? -0.03 : -0.07))),
          max: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove*2/100 : -baseMove*2/100))),
          likely: this.formatPrice(this.currentPrice * (1 + (isBullish ? baseMove*2/200 : -baseMove*2/200)))
        }
      }
    };
  }

  /**
   * 🎲 احتمالية النجاح
   */
  calculateSuccessProbability(scoreGrade, multiTF) {
    let probability = scoreGrade.score;

    // Multi-timeframe bonus
    const tfAlignment = this.calculateTimeframeAlignment(multiTF);
    probability += tfAlignment * 2; // max +20

    // Normalize to 100
    probability = Math.min(100, probability);

    let level, emoji, description;
    if (probability >= 85) {
      level = 'عالية جداً';
      emoji = '🎯';
      description = 'احتمالية نجاح ممتازة';
    } else if (probability >= 70) {
      level = 'عالية';
      emoji = '✅';
      description = 'احتمالية نجاح جيدة';
    } else if (probability >= 55) {
      level = 'متوسطة إلى عالية';
      emoji = '👍';
      description = 'احتمالية نجاح متوسطة';
    } else if (probability >= 40) {
      level = 'متوسطة';
      emoji = '⚖️';
      description = 'احتمالية نجاح متوسطة';
    } else {
      level = 'منخفضة';
      emoji = '⚠️';
      description = 'احتمالية نجاح ضعيفة';
    }

    return {
      percentage: probability,
      level,
      emoji,
      description
    };
  }

  /**
   * 🌡️ خريطة حرارية للمؤشرات
   */
  generateIndicatorsHeatmap(current) {
    const indicators = current.indicators;
    const heatmap = [];

    // RSI
    const rsiVal = parseFloat(indicators.rsi.value);
    heatmap.push({
      name: 'RSI',
      value: rsiVal,
      heat: this.calculateHeat(rsiVal, 30, 70, 'rsi'),
      signal: indicators.rsi.signal
    });

    // MACD
    const macdHeat = indicators.macd.signal.includes('قوي') ? 90 : 
                     indicators.macd.signal.includes('صاعد') || indicators.macd.signal.includes('هابط') ? 70 : 40;
    heatmap.push({
      name: 'MACD',
      value: indicators.macd.value,
      heat: macdHeat,
      signal: indicators.macd.signal
    });

    // ADX
    const adxVal = parseFloat(indicators.adx.value) || 0;
    heatmap.push({
      name: 'ADX',
      value: adxVal,
      heat: Math.min(100, adxVal * 2.5),
      signal: indicators.adx.signal
    });

    // Volume
    const volumeHeat = indicators.volume.signal.includes('ضخم') ? 95 :
                       indicators.volume.signal.includes('عالي') ? 75 :
                       indicators.volume.signal.includes('متوسط') ? 50 : 25;
    heatmap.push({
      name: 'الحجم',
      value: indicators.volume.value,
      heat: volumeHeat,
      signal: indicators.volume.signal
    });

    // Stochastic
    const stochHeat = indicators.stoch.signal.includes('قوي') ? 85 :
                      indicators.stoch.signal.includes('تشبع') ? 75 : 40;
    heatmap.push({
      name: 'Stochastic',
      value: indicators.stoch.value,
      heat: stochHeat,
      signal: indicators.stoch.signal
    });

    return heatmap;
  }

  /**
   * 🔥 حساب درجة الحرارة
   */
  calculateHeat(value, low, high, type) {
    if (type === 'rsi') {
      if (value > 70) return 90;
      if (value < 30) return 90;
      if (value >= 60 && value <= 70) return 70;
      if (value >= 30 && value <= 40) return 70;
      return 40;
    }
    
    return Math.min(100, (value / high) * 100);
  }

  /**
   * 🎯 التوصية النهائية
   */
  generateFinalRecommendation(scoreGrade, entryExit, predictions, successProb, current) {
    const indicators = current.indicators;
    const reasons = [];
    const warnings = [];
    let action, confidence;

    const rsiVal = parseFloat(indicators.rsi.value);
    const isBullish = rsiVal < 50 || indicators.macd.signal.includes('صاعد');

    // تحديد التوصية
    if (scoreGrade.score >= 75) {
      action = isBullish ? 'شراء قوي' : 'بيع قوي';
      confidence = 'عالية جداً';
      reasons.push(`🏆 التقييم ${scoreGrade.grade} - ${scoreGrade.description}`);
    } else if (scoreGrade.score >= 60) {
      action = isBullish ? 'شراء' : 'بيع';
      confidence = 'عالية';
      reasons.push(`⭐ التقييم ${scoreGrade.grade} - ${scoreGrade.description}`);
    } else if (scoreGrade.score >= 45) {
      action = isBullish ? 'شراء محتمل' : 'بيع محتمل';
      confidence = 'متوسطة';
      reasons.push(`💫 التقييم ${scoreGrade.grade} - ${scoreGrade.description}`);
    } else {
      action = 'انتظار';
      confidence = 'منخفضة';
      warnings.push(`⚠️ التقييم ${scoreGrade.grade} - لا توجد إشارة قوية`);
    }

    // إضافة الأسباب
    if (indicators.rsi.signal.includes('تشبع')) {
      reasons.push(`📊 ${indicators.rsi.name}: ${indicators.rsi.signal}`);
    }
    if (indicators.macd.signal.includes('قوي')) {
      reasons.push(`📈 ${indicators.macd.name}: ${indicators.macd.signal}`);
    }
    if (parseFloat(indicators.adx.value) > 25) {
      reasons.push(`💪 ADX قوي: ${indicators.adx.value}`);
    }
    if (indicators.volume.signal.includes('عالي') || indicators.volume.signal.includes('ضخم')) {
      reasons.push(`📊 ${indicators.volume.signal}`);
    }

    // إضافة التحذيرات
    if (scoreGrade.score < 50) {
      warnings.push('⚠️ إشارات ضعيفة - توخى الحذر');
    }
    if (successProb.percentage < 55) {
      warnings.push('⚠️ احتمالية نجاح منخفضة');
    }

    return {
      action,
      actionEmoji: isBullish ? '🟢' : '🔴',
      confidence,
      confidenceEmoji: confidence === 'عالية جداً' ? '💎' : confidence === 'عالية' ? '⭐' : '💫',
      reasons,
      warnings,
      entryTiming: this.calculateEntryTiming(current, scoreGrade),
      riskLevel: this.calculateRiskLevel(scoreGrade, successProb)
    };
  }

  /**
   * ⏰ توقيت الدخول المثالي
   */
  calculateEntryTiming(current, scoreGrade) {
    if (scoreGrade.score >= 80) {
      return { timing: 'فوري', emoji: '⚡', description: 'ادخل الآن - الفرصة ممتازة' };
    } else if (scoreGrade.score >= 65) {
      return { timing: 'خلال ساعة', emoji: '⏰', description: 'ادخل قريباً - الفرصة جيدة' };
    } else if (scoreGrade.score >= 50) {
      return { timing: 'خلال 4 ساعات', emoji: '🕐', description: 'راقب السوق ثم ادخل' };
    } else {
      return { timing: 'انتظر', emoji: '⏸️', description: 'انتظر إشارة أفضل' };
    }
  }

  /**
   * 🎲 مستوى المخاطرة
   */
  calculateRiskLevel(scoreGrade, successProb) {
    const avgScore = (scoreGrade.score + successProb.percentage) / 2;
    
    if (avgScore >= 80) {
      return { level: 'منخفض', emoji: '🟢', description: 'مخاطرة منخفضة - فرصة آمنة' };
    } else if (avgScore >= 65) {
      return { level: 'متوسط إلى منخفض', emoji: '💚', description: 'مخاطرة معتدلة' };
    } else if (avgScore >= 50) {
      return { level: 'متوسط', emoji: '🟡', description: 'مخاطرة متوسطة - حذر مطلوب' };
    } else if (avgScore >= 35) {
      return { level: 'متوسط إلى عالي', emoji: '🟠', description: 'مخاطرة عالية نسبياً' };
    } else {
      return { level: 'عالي', emoji: '🔴', description: 'مخاطرة عالية - تجنب' };
    }
  }

  /**
   * 💡 نصائح ذكية
   */
  generateSmartTips(recommendation, scoreGrade) {
    const tips = [];

    if (scoreGrade.score >= 80) {
      tips.push('💎 فرصة ممتازة - استخدم حجم صفقة مناسب');
      tips.push('🎯 اتبع خطة إدارة المخاطر بدقة');
    } else if (scoreGrade.score >= 60) {
      tips.push('⭐ فرصة جيدة - ابدأ بحجم صفقة صغير');
      tips.push('📊 راقب المؤشرات عن كثب');
    } else if (scoreGrade.score >= 40) {
      tips.push('⚠️ استخدم حجم صفقة صغير جداً');
      tips.push('📈 انتظر تأكيد إضافي قبل الدخول');
    } else {
      tips.push('🛑 من الأفضل الانتظار');
      tips.push('👀 راقب السوق حتى تتحسن الإشارات');
    }

    tips.push('📌 دائماً استخدم أمر وقف الخسارة');
    tips.push('💰 لا تخاطر بأكثر من 2% من رأس المال');

    return tips;
  }

  /**
   * 🎨 تنسيق السعر
   */
  formatPrice(price) {
    if (!price || isNaN(price)) return 'N/A';
    price = parseFloat(price);
    
    if (price === 0) return '0';
    
    let str = price.toString();
    if (str.includes('e-')) {
      const parts = str.split('e-');
      const decimals = parseInt(parts[1], 10);
      const precision = Math.min(decimals + (parts[0].replace('.', '').length - 1), 20);
      str = price.toFixed(precision);
    }
    
    return str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  }
}

module.exports = MasterAnalysis;
