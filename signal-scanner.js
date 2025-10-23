const marketData = require('./market-data');
const forexService = require('./forex-service');
const TechnicalAnalysis = require('./analysis');
const UltraAnalysis = require('./ultra-analysis');
const ZeroReversalAnalysis = require('./zero-reversal-analysis');
const V1ProAnalysis = require('./v1-pro-analysis');
const assetsManager = require('./assets-manager');

class SignalScanner {
  constructor() {
    // أفضل العملات للفحص (للتوافقية مع الكود القديم)
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
    
    this.COMMODITIES = [
      'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL', 'COPPER', 'NATGAS'
    ];
    
    this.INDICES = [
      'US30', 'SPX500', 'NAS100', 'US500', 'DJ30'
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
          case 'master':
            const MasterAnalysis = require('./master-analysis');
            analysis = new MasterAnalysis(candles, symbol, timeframe, marketType);
            recommendation = await analysis.getMasterAnalysis('spot');
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
    // معايير مرنة لإعطاء نتائج أفضل
    if (!recommendation) return false;
    
    const action = recommendation.action || recommendation.finalSignal;
    if (!action || (action !== 'شراء' && action !== 'بيع' && action !== 'BUY' && action !== 'SELL')) {
      return false;
    }
    
    switch (analysisType) {
      case 'ultra':
        // Ultra: أي إشارة بثقة متوسطة أو أعلى
        if (recommendation.confidence) {
          return recommendation.confidence.includes('عالية') || 
                 recommendation.confidence.includes('متوسطة') ||
                 recommendation.confidence.includes('مضمونة');
        }
        return recommendation.agreementPercentage >= 50;
      
      case 'zero-reversal':
        // Zero Reversal: أي إشارة بثقة متوسطة أو أعلى
        if (recommendation.confidence) {
          return recommendation.confidence.includes('عالية') || 
                 recommendation.confidence.includes('متوسطة') ||
                 recommendation.confidence.includes('جيدة') ||
                 recommendation.confidence.includes('آمنة');
        }
        return true; // Zero Reversal يعطي فقط إشارات قوية
      
      case 'v1-pro':
        // V1 Pro: ثقة أعلى من 40%
        return recommendation.confidenceScore >= 0.4;
      
      case 'master':
        // Master: أي إشارة بثقة متوسطة أو أعلى
        if (recommendation.confidence) {
          return recommendation.confidence.includes('عالية') || 
                 recommendation.confidence.includes('متوسطة') ||
                 recommendation.confidence.includes('مضمونة');
        }
        return recommendation.agreementPercentage >= 50;
      
      default:
        // Regular: اتفاق 50% أو أعلى
        if (recommendation.confidence) {
          return recommendation.confidence.includes('عالية') || 
                 recommendation.confidence.includes('متوسطة') ||
                 recommendation.confidence.includes('مضمونة');
        }
        return recommendation.agreementPercentage >= 50;
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

  // المسح الذكي - يعمل على جميع العملات المتاحة
  async smartScan(marketType = 'all', analysisType = 'zero-reversal', timeframe = '1h', progressCallback = null) {
    console.log(`🚀 بدء المسح الذكي - ${marketType} - ${analysisType} - ${timeframe}`);
    
    let allSymbols = [];
    
    // جلب جميع الرموز حسب نوع السوق
    if (marketType === 'all') {
      // مسح جميع الأسواق
      console.log('📊 جلب جميع العملات من جميع الأسواق...');
      
      // العملات الرقمية
      try {
        const cryptoAssets = await assetsManager.getAllCryptoAssets();
        const cryptoSymbols = cryptoAssets.map(asset => ({ 
          symbol: asset.symbol, 
          marketType: 'crypto' 
        }));
        allSymbols.push(...cryptoSymbols);
        console.log(`✅ تم جلب ${cryptoSymbols.length} عملة رقمية`);
      } catch (error) {
        console.error('❌ خطأ في جلب العملات الرقمية:', error.message);
      }
      
      // الفوركس
      try {
        const forexPairs = assetsManager.generateAllForexPairs();
        const forexSymbols = forexPairs.map(pair => ({ 
          symbol: pair.value, 
          marketType: 'forex' 
        }));
        allSymbols.push(...forexSymbols);
        console.log(`✅ تم إضافة ${forexSymbols.length} زوج فوركس`);
      } catch (error) {
        console.error('❌ خطأ في جلب أزواج الفوركس:', error.message);
      }
      
      // الأسهم
      try {
        const stocks = assetsManager.getAllStocks();
        const stockSymbols = stocks.map(stock => ({ 
          symbol: stock.value, 
          marketType: 'stocks' 
        }));
        allSymbols.push(...stockSymbols);
        console.log(`✅ تم إضافة ${stockSymbols.length} سهم`);
      } catch (error) {
        console.error('❌ خطأ في جلب الأسهم:', error.message);
      }
      
    } else if (marketType === 'crypto') {
      const cryptoAssets = await assetsManager.getAllCryptoAssets();
      allSymbols = cryptoAssets.map(asset => ({ 
        symbol: asset.symbol, 
        marketType: 'crypto' 
      }));
      console.log(`✅ تم جلب ${allSymbols.length} عملة رقمية`);
      
    } else if (marketType === 'forex') {
      const forexPairs = assetsManager.generateAllForexPairs();
      allSymbols = forexPairs.map(pair => ({ 
        symbol: pair.value, 
        marketType: 'forex' 
      }));
      console.log(`✅ تم جلب ${allSymbols.length} زوج فوركس`);
      
    } else if (marketType === 'stocks') {
      const stocks = assetsManager.getAllStocks();
      allSymbols = stocks.map(stock => ({ 
        symbol: stock.value, 
        marketType: 'stocks' 
      }));
      console.log(`✅ تم جلب ${allSymbols.length} سهم`);
      
    } else if (marketType === 'commodities') {
      allSymbols = this.COMMODITIES.map(symbol => ({ 
        symbol, 
        marketType: 'commodities' 
      }));
      console.log(`✅ تم إضافة ${allSymbols.length} سلعة`);
      
    } else if (marketType === 'indices') {
      allSymbols = this.INDICES.map(symbol => ({ 
        symbol, 
        marketType: 'indices' 
      }));
      console.log(`✅ تم إضافة ${allSymbols.length} مؤشر`);
    }
    
    console.log(`📊 إجمالي الرموز للفحص: ${allSymbols.length}`);
    
    const results = [];
    let scannedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    for (const { symbol, marketType: mType } of allSymbols) {
      try {
        scannedCount++;
        const currentMarketType = mType;
        
        // تحديث التقدم
        if (progressCallback) {
          const elapsedTime = (Date.now() - startTime) / 1000;
          const avgTimePerSymbol = elapsedTime / scannedCount;
          const remainingSymbols = allSymbols.length - scannedCount;
          const estimatedTimeRemaining = Math.ceil(avgTimePerSymbol * remainingSymbols);
          
          progressCallback({
            type: 'progress',
            scanned: scannedCount,
            total: allSymbols.length,
            currentSymbol: symbol,
            signalsFound: results.length,
            timeRemaining: estimatedTimeRemaining
          });
        }
        
        console.log(`📊 [${scannedCount}/${allSymbols.length}] فحص ${symbol} (${currentMarketType})...`);
        
        // جلب البيانات
        let candles;
        if (currentMarketType === 'forex') {
          candles = await forexService.getCandles(symbol, timeframe, 100);
        } else {
          candles = await marketData.getCandles(symbol, timeframe, 100, currentMarketType);
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
            recommendation = analysis.getUltraRecommendation(currentMarketType, 'spot', timeframe);
            break;
          case 'zero-reversal':
            analysis = new ZeroReversalAnalysis(candles);
            recommendation = analysis.getZeroReversalRecommendation(currentMarketType, 'spot', timeframe);
            break;
          case 'v1-pro':
            analysis = new V1ProAnalysis(candles);
            recommendation = await analysis.getCompleteAnalysis(currentMarketType, 'spot', timeframe);
            break;
          case 'master':
            const MasterAnalysis = require('./master-analysis');
            analysis = new MasterAnalysis(candles, symbol, timeframe, currentMarketType);
            recommendation = await analysis.getMasterAnalysis('spot');
            break;
          default:
            analysis = new TechnicalAnalysis(candles);
            recommendation = analysis.getTradeRecommendationWithMarketType(currentMarketType, 'spot');
        }
        
        // التحقق من قوة الإشارة
        const isStrongSignal = this.isStrongSignal(recommendation, analysisType);
        
        if (isStrongSignal && (recommendation.action === 'شراء' || recommendation.action === 'بيع' || recommendation.finalSignal === 'BUY' || recommendation.finalSignal === 'SELL')) {
          const currentPrice = candles[candles.length - 1].close;
          
          let confidenceText = recommendation.confidence;
          if (!confidenceText && typeof recommendation.confidenceScore === 'number' && isFinite(recommendation.confidenceScore)) {
            confidenceText = `${(recommendation.confidenceScore * 100).toFixed(0)}%`;
          }
          
          let agreementValue = 0;
          if (typeof recommendation.agreementPercentage === 'number') {
            agreementValue = recommendation.agreementPercentage;
          } else if (typeof recommendation.confidenceScore === 'number' && isFinite(recommendation.confidenceScore)) {
            agreementValue = recommendation.confidenceScore * 100;
          }
          
          const signal = {
            symbol,
            marketType: currentMarketType,
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
          };
          
          results.push(signal);
          
          // إرسال الإشارة فوراً عبر callback
          if (progressCallback) {
            progressCallback({
              type: 'signal',
              signal: signal
            });
          }
          
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
    
    if (progressCallback) {
      progressCallback({
        type: 'complete',
        totalScanned: scannedCount,
        totalSignals: results.length,
        totalErrors: errorCount
      });
    }
    
    return results;
  }
}

module.exports = SignalScanner;
