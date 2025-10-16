const marketData = require('./market-data');
const forexService = require('./forex-service');
const TechnicalAnalysis = require('./analysis');
const UltraAnalysis = require('./ultra-analysis');
const ZeroReversalAnalysis = require('./zero-reversal-analysis');
const V1ProAnalysis = require('./v1-pro-analysis');

class SignalScanner {
  constructor() {
    // أفضل العملات للفحص
    this.topCryptoSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
      'DOGEUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT',
      'AVAXUSDT', 'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'UNIUSDT',
      'SHIBUSDT', 'TRXUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT',
      'SUIUSDT', 'INJUSDT', 'PEPEUSDT', 'WLDUSDT', 'TONUSDT'
    ];

    this.topForexPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'NZDUSD', 'USDCHF', 'EURGBP', 'EURJPY', 'GBPJPY'
    ];

    this.topStocks = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
      'META', 'NVDA', 'NFLX', 'AMD', 'BABA'
    ];
  }

  async scanBestSignals(marketType = 'crypto', analysisType = 'zero-reversal', timeframe = '1h', maxResults = 10) {
    console.log(`🔍 بدء فحص أفضل الصفقات - ${marketType} - ${analysisType} - ${timeframe}`);
    
    let symbols = [];
    switch (marketType) {
      case 'crypto':
        symbols = this.topCryptoSymbols;
        break;
      case 'forex':
        symbols = this.topForexPairs;
        break;
      case 'stocks':
        symbols = this.topStocks;
        break;
      default:
        symbols = this.topCryptoSymbols;
    }

    const results = [];
    let scannedCount = 0;
    let errorCount = 0;

    for (const symbol of symbols) {
      try {
        scannedCount++;
        console.log(`📊 [${scannedCount}/${symbols.length}] فحص ${symbol}...`);

        // جلب البيانات
        let candles;
        if (marketType === 'forex') {
          candles = await forexService.getCandles(symbol, timeframe, 100);
        } else {
          candles = await marketData.getCandles(symbol, timeframe, 100, marketType);
        }

        if (!candles || candles.length < 50) {
          console.log(`⚠️ بيانات غير كافية لـ ${symbol}`);
          continue;
        }

        // تحليل حسب النوع
        let analysis;
        let recommendation;
        
        switch (analysisType) {
          case 'ultra':
            analysis = new UltraAnalysis(candles);
            recommendation = analysis.getUltraRecommendation(marketType, 'spot', timeframe);
            break;
          case 'zero-reversal':
            analysis = new ZeroReversalAnalysis(candles);
            recommendation = analysis.getZeroReversalRecommendation(marketType, 'spot', timeframe);
            break;
          case 'v1-pro':
            analysis = new V1ProAnalysis(candles);
            recommendation = await analysis.getCompleteAnalysis(marketType, 'spot', timeframe);
            break;
          default:
            analysis = new TechnicalAnalysis(candles);
            recommendation = analysis.getTradeRecommendationWithMarketType(marketType, 'spot');
        }

        // التحقق من قوة الإشارة
        const isStrongSignal = this.isStrongSignal(recommendation, analysisType);
        
        if (isStrongSignal && (recommendation.action === 'شراء' || recommendation.action === 'بيع' || recommendation.finalSignal === 'BUY' || recommendation.finalSignal === 'SELL')) {
          const currentPrice = candles[candles.length - 1].close;
          
          // تنسيق الثقة بشكل آمن
          let confidenceText = recommendation.confidence;
          if (!confidenceText && typeof recommendation.confidenceScore === 'number' && isFinite(recommendation.confidenceScore)) {
            confidenceText = `${(recommendation.confidenceScore * 100).toFixed(0)}%`;
          }
          
          // تنسيق نسبة الاتفاق بشكل آمن
          let agreementValue = 0;
          if (typeof recommendation.agreementPercentage === 'number') {
            agreementValue = recommendation.agreementPercentage;
          } else if (typeof recommendation.confidenceScore === 'number' && isFinite(recommendation.confidenceScore)) {
            agreementValue = recommendation.confidenceScore * 100;
          }
          
          results.push({
            symbol,
            marketType,
            action: recommendation.action || recommendation.finalSignal,
            confidence: confidenceText,
            confidenceScore: recommendation.confidenceScore,
            agreementPercentage: agreementValue,
            entryPrice: recommendation.entryPrice || currentPrice,
            stopLoss: recommendation.stopLoss,
            takeProfit: recommendation.takeProfit,
            riskReward: recommendation.riskRewardRatio || recommendation.riskReward,
            reasons: recommendation.reasons?.slice(0, 3) || [],
            timeframe,
            analysisType,
            score: this.calculateScore(recommendation)
          });

          console.log(`✅ ${symbol}: ${recommendation.action || recommendation.finalSignal} - ${recommendation.confidence || recommendation.confidenceScore}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ خطأ في تحليل ${symbol}:`, error.message);
      }
    }

    // ترتيب النتائج حسب القوة
    results.sort((a, b) => b.score - a.score);

    console.log(`\n📈 النتائج النهائية:`);
    console.log(`   - تم فحص: ${scannedCount} أصل`);
    console.log(`   - صفقات قوية: ${results.length}`);
    console.log(`   - أخطاء: ${errorCount}`);

    return results.slice(0, maxResults);
  }

  isStrongSignal(recommendation, analysisType) {
    switch (analysisType) {
      case 'ultra':
        // Ultra: يجب أن تكون الثقة عالية جداً أو عالية
        return recommendation.confidence === 'عالية جداً - يمكن التداول' || 
               recommendation.confidence === 'عالية - يمكن التداول';
      
      case 'zero-reversal':
        // Zero Reversal: يجب أن تكون الثقة عالية جداً
        return recommendation.confidence === 'عالية جداً - صفقة آمنة' ||
               recommendation.confidence === 'عالية - صفقة جيدة';
      
      case 'v1-pro':
        // V1 Pro: يجب أن تكون الثقة أعلى من 70%
        return recommendation.confidenceScore >= 0.7;
      
      default:
        // Regular: يجب أن تكون الثقة عالية أو مضمونة
        return recommendation.confidence === 'عالية - يمكن التداول' || 
               recommendation.confidence === 'مضمونة - يمكن التداول';
    }
  }

  calculateScore(recommendation) {
    // حساب نقاط القوة
    let score = 0;

    // نقاط من نسبة الاتفاق
    let agreement = 0;
    if (typeof recommendation.agreementPercentage === 'number') {
      agreement = recommendation.agreementPercentage;
    } else if (typeof recommendation.agreementPercentage === 'string') {
      // إزالة علامة % إذا كانت موجودة
      agreement = parseFloat(recommendation.agreementPercentage.replace('%', '')) || 0;
    } else if (typeof recommendation.confidenceScore === 'number') {
      agreement = recommendation.confidenceScore * 100;
    }
    score += agreement;

    // نقاط من Risk/Reward
    let rr = 0;
    if (recommendation.riskRewardRatio) {
      rr = parseFloat(recommendation.riskRewardRatio);
    } else if (recommendation.riskReward) {
      rr = parseFloat(recommendation.riskReward);
    }
    // التحقق من أن القيمة صالحة
    if (!isNaN(rr) && isFinite(rr)) {
      score += rr * 10;
    }

    // نقاط من مستوى الثقة
    const confidence = recommendation.confidence || '';
    if (confidence.includes('عالية جداً') || confidence.includes('مضمونة')) {
      score += 20;
    } else if (confidence.includes('عالية')) {
      score += 10;
    }

    // نقاط من V1 Pro confidence
    const confScore = recommendation.confidenceScore;
    if (typeof confScore === 'number' && isFinite(confScore)) {
      if (confScore >= 0.8) {
        score += 20;
      } else if (confScore >= 0.7) {
        score += 10;
      }
    }

    // التأكد من أن النتيجة النهائية رقم صالح
    return isFinite(score) ? score : 0;
  }
}

module.exports = SignalScanner;
