const TechnicalAnalysis = require('./analysis');
const Groq = require('groq-sdk');
const axios = require('axios');

class OBENTCHIV1ProAnalysis {
  constructor(candles, balance = 10000, symbol = 'BTCUSDT') {
    this.candles = candles;
    this.balance = balance;
    this.symbol = symbol;
    this.analysis = new TechnicalAnalysis(candles);
    
    // تهيئة Groq للتحليل الذكي
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    
    // الأوزان الافتراضية لكل مؤشر (قابلة للتعديل بالتعلم الذاتي)
    this.indicatorWeights = {
      rsi: 1.0,
      macd: 1.2,
      ema: 1.5,
      stochastic: 0.8,
      bollingerBands: 1.0,
      adx: 1.3,
      volume: 0.9,
      sentiment: 1.1
    };
    
    // معاملات إدارة المخاطر
    this.riskManagement = {
      riskPercentage: 0.02, // 2% مخاطرة من الرصيد
      stopLossATRMultiplier: 1.5, // 1.5x ATR لوقف الخسارة
      takeProfitATRMultiplier: 3.0 // 3x ATR لجني الأرباح
    };
  }

  // ==================== محرك التحليل الفني الكامل ====================
  
  async analyzeTechnicalIndicators() {
    const currentPrice = parseFloat(this.candles[this.candles.length - 1].close);
    const candlesCount = this.candles.length;
    
    // حساب جميع المؤشرات
    const rsi = this.analysis.calculateRSI(14);
    const macd = this.analysis.calculateMACD();
    const stochastic = this.analysis.calculateStochastic();
    const bb = this.analysis.calculateBollingerBands();
    const atr = this.analysis.calculateATR(14);
    const adx = this.analysis.calculateADX(14);
    const volume = this.analysis.calculateVolumeAnalysis();
    
    const ema20 = this.analysis.calculateEMA(20);
    const ema50 = this.analysis.calculateEMA(50);
    
    // استخدام EMA200 إذا كان لدينا شموع كافية
    let ema200;
    if (candlesCount >= 200) {
      ema200 = this.analysis.calculateEMA(200);
    } else if (candlesCount >= 100) {
      ema200 = this.analysis.calculateEMA(100);
    } else {
      ema200 = this.analysis.calculateEMA(Math.floor(candlesCount * 0.8));
    }
    
    return {
      rsi,
      macd,
      stochastic,
      bb,
      atr,
      adx,
      volume,
      ema20,
      ema50,
      ema200,
      currentPrice
    };
  }

  // ==================== تحديد الاتجاه عبر EMA ====================
  
  determineTrend(indicators) {
    const { currentPrice, ema20, ema50, ema200 } = indicators;
    
    const price = parseFloat(currentPrice);
    const ema20Value = parseFloat(ema20.value);
    const ema50Value = parseFloat(ema50.value);
    const ema200Value = parseFloat(ema200.value);
    
    let trend = 'محايد';
    let trendScore = 0;
    let trendStrength = 'ضعيف';
    
    // اتجاه صعودي قوي جداً
    if (price > ema20Value && ema20Value > ema50Value && ema50Value > ema200Value) {
      trend = 'صعودي قوي';
      trendScore = 3;
      trendStrength = 'قوي جداً';
    }
    // اتجاه صعودي متوسط
    else if (price > ema20Value && ema20Value > ema50Value) {
      trend = 'صعودي';
      trendScore = 2;
      trendStrength = 'متوسط';
    }
    // اتجاه صعودي ضعيف
    else if (price > ema50Value) {
      trend = 'صعودي ضعيف';
      trendScore = 1;
      trendStrength = 'ضعيف';
    }
    // اتجاه هبوطي قوي جداً
    else if (price < ema20Value && ema20Value < ema50Value && ema50Value < ema200Value) {
      trend = 'هبوطي قوي';
      trendScore = -3;
      trendStrength = 'قوي جداً';
    }
    // اتجاه هبوطي متوسط
    else if (price < ema20Value && ema20Value < ema50Value) {
      trend = 'هبوطي';
      trendScore = -2;
      trendStrength = 'متوسط';
    }
    // اتجاه هبوطي ضعيف
    else if (price < ema50Value) {
      trend = 'هبوطي ضعيف';
      trendScore = -1;
      trendStrength = 'ضعيف';
    }
    
    return {
      trend,
      trendScore,
      trendStrength,
      emoji: trendScore > 0 ? '📈' : trendScore < 0 ? '📉' : '➡️'
    };
  }

  // ==================== تأكيد الزخم عبر MACD ====================
  
  confirmMomentum(indicators, trendInfo) {
    const { macd, adx } = indicators;
    
    let momentumScore = 0;
    const reasons = [];
    
    // تحليل MACD
    if (trendInfo.trendScore > 0) {
      // اتجاه صعودي
      if (macd.signal.includes('صاعد قوي')) {
        momentumScore += 2;
        reasons.push('MACD يؤكد الزخم الصعودي القوي');
      } else if (macd.signal.includes('صاعد')) {
        momentumScore += 1;
        reasons.push('MACD يؤكد الزخم الصعودي');
      } else if (macd.signal.includes('هابط')) {
        momentumScore -= 1;
        reasons.push('⚠️ MACD يعارض الاتجاه الصعودي');
      }
    } else if (trendInfo.trendScore < 0) {
      // اتجاه هبوطي
      if (macd.signal.includes('هابط قوي')) {
        momentumScore -= 2;
        reasons.push('MACD يؤكد الزخم الهبوطي القوي');
      } else if (macd.signal.includes('هابط')) {
        momentumScore -= 1;
        reasons.push('MACD يؤكد الزخم الهبوطي');
      } else if (macd.signal.includes('صاعد')) {
        momentumScore += 1;
        reasons.push('⚠️ MACD يعارض الاتجاه الهبوطي');
      }
    }
    
    // تحليل قوة ADX
    const adxValue = parseFloat(adx.value);
    if (adxValue >= 30) {
      momentumScore *= 1.5;
      reasons.push(`ADX قوي (${adxValue.toFixed(0)}) - اتجاه قوي ومستمر`);
    } else if (adxValue >= 25) {
      momentumScore *= 1.2;
      reasons.push(`ADX متوسط (${adxValue.toFixed(0)}) - اتجاه متوسط القوة`);
    } else {
      reasons.push(`⚠️ ADX ضعيف (${adxValue.toFixed(0)}) - اتجاه غير واضح`);
    }
    
    return {
      momentumScore,
      momentumReasons: reasons,
      isConfirmed: Math.abs(momentumScore) >= 1.5
    };
  }

  // ==================== محرك تحليل المشاعر باستخدام Groq ====================
  
  async analyzeSentiment() {
    try {
      // جلب آخر الأخبار عن الرمز
      const news = await this.fetchLatestNews();
      
      if (!news || news.length === 0) {
        return {
          score: 0,
          sentiment: 'محايد',
          confidence: 0.3,
          summary: 'لا توجد أخبار حديثة للتحليل',
          newsCount: 0
        };
      }
      
      // تحليل المشاعر باستخدام Groq
      const sentimentAnalysis = await this.analyzeSentimentWithGroq(news);
      
      return sentimentAnalysis;
    } catch (error) {
      console.error('❌ خطأ في تحليل المشاعر:', error.message);
      return {
        score: 0,
        sentiment: 'محايد',
        confidence: 0.3,
        summary: 'فشل تحليل المشاعر',
        newsCount: 0
      };
    }
  }

  async fetchLatestNews() {
    try {
      // استخدام CryptoPanic API للحصول على الأخبار
      const cryptoSymbol = this.symbol.replace('USDT', '').toLowerCase();
      
      const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
        params: {
          auth_token: 'free',
          currencies: cryptoSymbol,
          kind: 'news',
          public: 'true'
        },
        timeout: 10000
      });
      
      if (response.data && response.data.results) {
        // أخذ آخر 10 أخبار
        const latestNews = response.data.results.slice(0, 10).map(item => ({
          title: item.title,
          published_at: item.published_at,
          source: item.source?.title || 'Unknown',
          url: item.url
        }));
        
        return latestNews;
      }
      
      return [];
    } catch (error) {
      console.log('⚠️ لم نتمكن من جلب الأخبار من CryptoPanic، سنحاول مصدر بديل');
      
      // مصدر بديل: CoinGecko News
      try {
        const coinId = this.symbolToCoinGeckoId(this.symbol);
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
          params: {
            localization: false,
            tickers: false,
            market_data: false,
            community_data: false,
            developer_data: false
          },
          timeout: 10000
        });
        
        if (response.data && response.data.description) {
          return [{
            title: `${this.symbol} Market Overview`,
            published_at: new Date().toISOString(),
            source: 'CoinGecko',
            description: response.data.description.en?.substring(0, 500)
          }];
        }
      } catch (err) {
        console.log('⚠️ فشل المصدر البديل أيضاً');
      }
      
      return [];
    }
  }

  symbolToCoinGeckoId(symbol) {
    const symbolMap = {
      'BTCUSDT': 'bitcoin',
      'ETHUSDT': 'ethereum',
      'BNBUSDT': 'binancecoin',
      'XRPUSDT': 'ripple',
      'ADAUSDT': 'cardano',
      'DOGEUSDT': 'dogecoin',
      'SOLUSDT': 'solana',
      'DOTUSDT': 'polkadot',
      'MATICUSDT': 'matic-network',
      'LTCUSDT': 'litecoin'
    };
    return symbolMap[symbol] || 'bitcoin';
  }

  async analyzeSentimentWithGroq(news) {
    try {
      // إعداد النص للتحليل
      const newsText = news.map((item, index) => 
        `${index + 1}. ${item.title} (${item.source})`
      ).join('\n');
      
      // طلب تحليل المشاعر من Groq
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `أنت محلل خبير للمشاعر في أسواق العملات الرقمية. قم بتحليل الأخبار التالية وأعطني:
1. درجة المشاعر من -1 (سلبي جداً) إلى +1 (إيجابي جداً)
2. تصنيف المشاعر (إيجابي قوي، إيجابي، محايد، سلبي، سلبي قوي)
3. درجة الثقة من 0 إلى 1
4. ملخص قصير بالعربية (جملة واحدة)

أجب فقط بصيغة JSON:
{
  "score": رقم من -1 إلى 1,
  "sentiment": "النوع",
  "confidence": رقم من 0 إلى 1,
  "summary": "الملخص بالعربية"
}`
          },
          {
            role: 'user',
            content: `حلل المشاعر للأخبار التالية عن ${this.symbol}:\n\n${newsText}`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(completion.choices[0].message.content);
      
      // تطبيق وزن أعلى للأخبار الأحدث
      const weightedScore = this.applyNewsWeighting(result.score, news);
      
      return {
        score: weightedScore,
        sentiment: result.sentiment || 'محايد',
        confidence: result.confidence || 0.5,
        summary: result.summary || 'تحليل المشاعر متاح',
        newsCount: news.length,
        rawScore: result.score
      };
    } catch (error) {
      console.error('❌ خطأ في Groq API:', error.message);
      return {
        score: 0,
        sentiment: 'محايد',
        confidence: 0.3,
        summary: 'فشل تحليل المشاعر عبر AI',
        newsCount: news.length
      };
    }
  }

  applyNewsWeighting(baseScore, news) {
    if (news.length === 0) return baseScore;
    
    // الأخبار الأحدث لها وزن أعلى
    const now = new Date();
    const weights = news.map(item => {
      const publishedDate = new Date(item.published_at);
      const hoursDiff = (now - publishedDate) / (1000 * 60 * 60);
      
      // وزن أعلى للأخبار الأحدث (تناقص أسي)
      return Math.exp(-hoursDiff / 24); // تناقص خلال 24 ساعة
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const avgWeight = totalWeight / weights.length;
    
    // تطبيق الوزن على النتيجة (الأخبار الأحدث تزيد التأثير)
    const weightedScore = baseScore * (0.7 + avgWeight * 0.3);
    
    return Math.max(-1, Math.min(1, weightedScore));
  }

  // ==================== نظام إدارة المخاطر ====================
  
  calculateRiskManagement(indicators) {
    const { currentPrice, atr } = indicators;
    const price = parseFloat(currentPrice);
    const atrValue = parseFloat(atr.value);
    
    // حساب وقف الخسارة وجني الأرباح
    const stopLossDistance = atrValue * this.riskManagement.stopLossATRMultiplier;
    const takeProfitDistance = atrValue * this.riskManagement.takeProfitATRMultiplier;
    
    // حساب حجم المركز بناءً على المخاطرة 2%
    const riskAmount = this.balance * this.riskManagement.riskPercentage;
    const positionSize = riskAmount / stopLossDistance;
    const positionValue = positionSize * price;
    
    return {
      stopLossDistance,
      takeProfitDistance,
      positionSize: positionSize.toFixed(8),
      positionValue: positionValue.toFixed(2),
      riskAmount: riskAmount.toFixed(2),
      riskRewardRatio: (takeProfitDistance / stopLossDistance).toFixed(2)
    };
  }

  // ==================== قواعد القرار والدخول/الخروج ====================
  
  generateTradingSignal(indicators, trendInfo, momentumInfo, sentimentInfo) {
    const { rsi, stochastic, bb, volume } = indicators;
    
    let signal = 'WAIT';
    let signalStrength = 0;
    const entryReasons = [];
    const warnings = [];
    
    const rsiValue = parseFloat(rsi.value);
    const stochK = parseFloat(stochastic.value.split('/')[0].replace('K: ', ''));
    
    // قواعد الدخول للشراء
    if (trendInfo.trendScore > 0 && momentumInfo.isConfirmed) {
      // اتجاه صاعد + زخم مؤكد
      
      // شرط 1: RSI منخفض (فرصة شراء)
      if (rsiValue < 50) {
        signalStrength += 1.5 * this.indicatorWeights.rsi;
        entryReasons.push(`RSI منخفض (${rsiValue.toFixed(0)}) - فرصة دخول جيدة`);
      }
      
      // شرط 2: Stochastic في منطقة تشبع بيعي
      if (stochK < 30) {
        signalStrength += 1.2 * this.indicatorWeights.stochastic;
        entryReasons.push(`Stochastic تشبع بيعي - فرصة شراء`);
      }
      
      // شرط 3: السعر قرب Bollinger Bands السفلي
      if (bb.signal.includes('تشبع بيعي') || bb.signal.includes('هابط')) {
        signalStrength += 1.0 * this.indicatorWeights.bollingerBands;
        entryReasons.push('السعر قرب حد Bollinger السفلي');
      }
      
      // شرط 4: حجم تداول قوي
      if (volume.signal.includes('ضخم') || volume.signal.includes('عالي')) {
        signalStrength += 0.8 * this.indicatorWeights.volume;
        entryReasons.push('حجم تداول قوي يدعم الحركة');
      }
      
      // إضافة نقاط الاتجاه والزخم
      signalStrength += Math.abs(trendInfo.trendScore) * this.indicatorWeights.ema;
      signalStrength += Math.abs(momentumInfo.momentumScore) * this.indicatorWeights.macd;
      
      if (signalStrength >= 5) {
        signal = 'BUY';
      }
    }
    // قواعد الدخول للبيع
    else if (trendInfo.trendScore < 0 && momentumInfo.isConfirmed) {
      // اتجاه هابط + زخم مؤكد
      
      // شرط 1: RSI مرتفع (فرصة بيع)
      if (rsiValue > 50) {
        signalStrength += 1.5 * this.indicatorWeights.rsi;
        entryReasons.push(`RSI مرتفع (${rsiValue.toFixed(0)}) - فرصة بيع جيدة`);
      }
      
      // شرط 2: Stochastic في منطقة تشبع شرائي
      if (stochK > 70) {
        signalStrength += 1.2 * this.indicatorWeights.stochastic;
        entryReasons.push(`Stochastic تشبع شرائي - فرصة بيع`);
      }
      
      // شرط 3: السعر قرب Bollinger Bands العلوي
      if (bb.signal.includes('تشبع شرائي') || bb.signal.includes('صاعد')) {
        signalStrength += 1.0 * this.indicatorWeights.bollingerBands;
        entryReasons.push('السعر قرب حد Bollinger العلوي');
      }
      
      // شرط 4: حجم تداول قوي
      if (volume.signal.includes('ضخم') || volume.signal.includes('عالي')) {
        signalStrength += 0.8 * this.indicatorWeights.volume;
        entryReasons.push('حجم تداول قوي يدعم الحركة');
      }
      
      // إضافة نقاط الاتجاه والزخم
      signalStrength += Math.abs(trendInfo.trendScore) * this.indicatorWeights.ema;
      signalStrength += Math.abs(momentumInfo.momentumScore) * this.indicatorWeights.macd;
      
      if (signalStrength >= 5) {
        signal = 'SELL';
      }
    }
    
    // قواعد الخروج
    const exitConditions = this.checkExitConditions(indicators, trendInfo);
    if (exitConditions.shouldExit) {
      warnings.push(...exitConditions.reasons);
    }
    
    return {
      signal,
      signalStrength,
      entryReasons,
      warnings,
      exitConditions
    };
  }

  checkExitConditions(indicators, trendInfo) {
    const { rsi } = indicators;
    const rsiValue = parseFloat(rsi.value);
    
    const reasons = [];
    let shouldExit = false;
    
    // انعكاس الاتجاه
    if (trendInfo.trend.includes('هابط') && trendInfo.trendScore < -1) {
      shouldExit = true;
      reasons.push('🚨 انعكاس اتجاه هبوطي - يُنصح بالخروج');
    } else if (trendInfo.trend.includes('صعودي') && trendInfo.trendScore > 1) {
      shouldExit = true;
      reasons.push('🚨 انعكاس اتجاه صعودي - يُنصح بالخروج');
    }
    
    // تشبع RSI
    if (rsiValue > 75) {
      shouldExit = true;
      reasons.push(`🚨 RSI تشبع شرائي شديد (${rsiValue.toFixed(0)}) - احتمال تصحيح`);
    } else if (rsiValue < 25) {
      shouldExit = true;
      reasons.push(`🚨 RSI تشبع بيعي شديد (${rsiValue.toFixed(0)}) - احتمال ارتداد`);
    }
    
    return {
      shouldExit,
      reasons
    };
  }

  // ==================== دمج الإشارات (فني + مشاعر) ====================
  
  combineSignals(technicalSignal, sentimentInfo) {
    let finalSignal = technicalSignal.signal;
    let confidence = technicalSignal.signalStrength / 10; // تحويل إلى 0-1
    const reasons = [...technicalSignal.entryReasons];
    
    // تأثير المشاعر على الإشارة النهائية
    const sentimentScore = sentimentInfo.score * this.indicatorWeights.sentiment;
    
    if (technicalSignal.signal === 'BUY') {
      if (sentimentInfo.score > 0.3) {
        // مشاعر إيجابية تعزز إشارة الشراء
        confidence += sentimentInfo.score * 0.2;
        reasons.push(`✅ المشاعر إيجابية (${sentimentInfo.sentiment}) - تعزيز إشارة الشراء`);
      } else if (sentimentInfo.score < -0.3) {
        // مشاعر سلبية تضعف إشارة الشراء
        confidence -= Math.abs(sentimentInfo.score) * 0.15;
        reasons.push(`⚠️ المشاعر سلبية (${sentimentInfo.sentiment}) - تحذير`);
        
        if (confidence < 0.4) {
          finalSignal = 'WAIT';
          reasons.push('🚫 تم إلغاء إشارة الشراء بسبب المشاعر السلبية');
        }
      }
    } else if (technicalSignal.signal === 'SELL') {
      if (sentimentInfo.score < -0.3) {
        // مشاعر سلبية تعزز إشارة البيع
        confidence += Math.abs(sentimentInfo.score) * 0.2;
        reasons.push(`✅ المشاعر سلبية (${sentimentInfo.sentiment}) - تعزيز إشارة البيع`);
      } else if (sentimentInfo.score > 0.3) {
        // مشاعر إيجابية تضعف إشارة البيع
        confidence -= sentimentInfo.score * 0.15;
        reasons.push(`⚠️ المشاعر إيجابية (${sentimentInfo.sentiment}) - تحذير`);
        
        if (confidence < 0.4) {
          finalSignal = 'WAIT';
          reasons.push('🚫 تم إلغاء إشارة البيع بسبب المشاعر الإيجابية');
        }
      }
    } else {
      // WAIT - لا يوجد إشارة فنية واضحة
      if (Math.abs(sentimentInfo.score) > 0.6) {
        reasons.push(`ℹ️ المشاعر ${sentimentInfo.sentiment} لكن لا يوجد إشارة فنية واضحة`);
      }
    }
    
    // تحديد الثقة النهائية (0-1)
    confidence = Math.max(0, Math.min(1, confidence));
    
    return {
      finalSignal,
      confidence,
      reasons,
      sentimentImpact: sentimentScore
    };
  }

  // ==================== نظام التعلم الذاتي ====================
  
  async loadIndicatorWeights() {
    try {
      const { getDatabase } = require('./database');
      const db = getDatabase();
      
      if (!db) {
        console.log('ℹ️ قاعدة البيانات غير متصلة - استخدام الأوزان الافتراضية');
        return;
      }
      
      const weights = await db.collection('v1_pro_weights').findOne({
        symbol: this.symbol
      });
      
      if (weights && weights.weights) {
        this.indicatorWeights = { ...this.indicatorWeights, ...weights.weights };
        console.log('✅ تم تحميل الأوزان المخصصة من قاعدة البيانات');
      }
    } catch (error) {
      console.log('ℹ️ استخدام الأوزان الافتراضية');
    }
  }

  async updateIndicatorWeights(tradeResult) {
    try {
      const { getDB } = require('./database');
      const db = getDB();
      
      if (!db) {
        console.log('⚠️ قاعدة البيانات غير متصلة - لا يمكن حفظ الأوزان');
        return;
      }
      
      // جلب السجل الحالي
      const record = await db.collection('v1_pro_performance').findOne({
        symbol: this.symbol
      });
      
      const performance = record?.performance || {
        rsi: { wins: 0, losses: 0, consecutive: 0 },
        macd: { wins: 0, losses: 0, consecutive: 0 },
        ema: { wins: 0, losses: 0, consecutive: 0 },
        stochastic: { wins: 0, losses: 0, consecutive: 0 },
        bollingerBands: { wins: 0, losses: 0, consecutive: 0 },
        adx: { wins: 0, losses: 0, consecutive: 0 },
        volume: { wins: 0, losses: 0, consecutive: 0 },
        sentiment: { wins: 0, losses: 0, consecutive: 0 }
      };
      
      // تحديث الأداء بناءً على النتيجة
      const isWin = tradeResult === 'win';
      
      for (const indicator in performance) {
        if (isWin) {
          performance[indicator].wins++;
          performance[indicator].consecutive = Math.max(0, performance[indicator].consecutive + 1);
        } else {
          performance[indicator].losses++;
          performance[indicator].consecutive = Math.min(0, performance[indicator].consecutive - 1);
        }
        
        // تعديل الأوزان بناءً على الأداء
        
        // 3 خسائر متتالية = تقليل الوزن
        if (performance[indicator].consecutive <= -3) {
          this.indicatorWeights[indicator] *= 0.9; // تقليل 10%
          console.log(`⬇️ تقليل وزن ${indicator} بسبب 3 خسائر متتالية`);
        }
        
        // 3 أرباح متتالية = زيادة الوزن
        if (performance[indicator].consecutive >= 3) {
          this.indicatorWeights[indicator] *= 1.1; // زيادة 10%
          console.log(`⬆️ زيادة وزن ${indicator} بسبب 3 أرباح متتالية`);
        }
        
        // التأكد من بقاء الأوزان في نطاق معقول (0.5 - 2.0)
        this.indicatorWeights[indicator] = Math.max(0.5, Math.min(2.0, this.indicatorWeights[indicator]));
      }
      
      // حفظ الأوزان المحدثة
      await db.collection('v1_pro_weights').updateOne(
        { symbol: this.symbol },
        { 
          $set: { 
            weights: this.indicatorWeights,
            updated_at: new Date()
          } 
        },
        { upsert: true }
      );
      
      // حفظ سجل الأداء
      await db.collection('v1_pro_performance').updateOne(
        { symbol: this.symbol },
        { 
          $set: { 
            performance,
            updated_at: new Date()
          } 
        },
        { upsert: true }
      );
      
      console.log('✅ تم تحديث أوزان المؤشرات بنجاح');
    } catch (error) {
      console.error('❌ خطأ في تحديث الأوزان:', error.message);
    }
  }

  // ==================== التحليل الكامل والمخرج النهائي ====================
  
  async getCompleteAnalysis() {
    try {
      // تحميل الأوزان المخصصة
      await this.loadIndicatorWeights();
      
      // 1. التحليل الفني
      const indicators = await this.analyzeTechnicalIndicators();
      
      // 2. تحديد الاتجاه
      const trendInfo = this.determineTrend(indicators);
      
      // 3. تأكيد الزخم
      const momentumInfo = this.confirmMomentum(indicators, trendInfo);
      
      // 4. تحليل المشاعر
      const sentimentInfo = await this.analyzeSentiment();
      
      // 5. توليد الإشارة الفنية
      const technicalSignal = this.generateTradingSignal(
        indicators,
        trendInfo,
        momentumInfo,
        sentimentInfo
      );
      
      // 6. دمج الإشارات (فني + مشاعر)
      const combinedSignal = this.combineSignals(technicalSignal, sentimentInfo);
      
      // 7. حساب إدارة المخاطر
      const riskManagement = this.calculateRiskManagement(indicators);
      
      // 8. حساب مستويات الدخول والخروج
      const currentPrice = parseFloat(indicators.currentPrice);
      const stopLoss = combinedSignal.finalSignal === 'BUY' 
        ? currentPrice - riskManagement.stopLossDistance
        : combinedSignal.finalSignal === 'SELL'
        ? currentPrice + riskManagement.stopLossDistance
        : 0;
        
      const takeProfit = combinedSignal.finalSignal === 'BUY'
        ? currentPrice + riskManagement.takeProfitDistance
        : combinedSignal.finalSignal === 'SELL'
        ? currentPrice - riskManagement.takeProfitDistance
        : 0;
      
      // المخرج النهائي
      return {
        // معلومات عامة
        symbol: this.symbol,
        timestamp: new Date().toISOString(),
        currentPrice: currentPrice.toFixed(8),
        
        // الاتجاه العام
        trend: {
          direction: trendInfo.trend,
          strength: trendInfo.trendStrength,
          score: trendInfo.trendScore,
          emoji: trendInfo.emoji
        },
        
        // الزخم
        momentum: {
          isConfirmed: momentumInfo.isConfirmed,
          score: momentumInfo.momentumScore.toFixed(2),
          reasons: momentumInfo.momentumReasons
        },
        
        // الإشارة الفنية الأولية
        technicalSignal: {
          signal: technicalSignal.signal,
          strength: technicalSignal.signalStrength.toFixed(2),
          reasons: technicalSignal.entryReasons,
          warnings: technicalSignal.warnings
        },
        
        // نتيجة تحليل المشاعر
        sentiment: {
          score: sentimentInfo.score.toFixed(2),
          classification: sentimentInfo.sentiment,
          confidence: sentimentInfo.confidence.toFixed(2),
          summary: sentimentInfo.summary,
          newsCount: sentimentInfo.newsCount,
          impact: combinedSignal.sentimentImpact?.toFixed(2) || '0.00'
        },
        
        // الإشارة النهائية
        finalSignal: {
          action: combinedSignal.finalSignal,
          confidence: combinedSignal.confidence.toFixed(2),
          emoji: combinedSignal.finalSignal === 'BUY' ? '🟢' : 
                 combinedSignal.finalSignal === 'SELL' ? '🔴' : '🟡',
          reasons: combinedSignal.reasons
        },
        
        // إدارة المخاطر
        riskManagement: {
          stopLoss: stopLoss.toFixed(8),
          takeProfit: takeProfit.toFixed(8),
          positionSize: riskManagement.positionSize,
          positionValue: riskManagement.positionValue,
          riskAmount: riskManagement.riskAmount,
          riskRewardRatio: riskManagement.riskRewardRatio
        },
        
        // المؤشرات المستخدمة
        indicators: {
          rsi: `${indicators.rsi.value} (${indicators.rsi.signal})`,
          macd: `${indicators.macd.value} (${indicators.macd.signal})`,
          adx: `${indicators.adx.value} (${indicators.adx.signal})`,
          atr: indicators.atr.value,
          volume: indicators.volume.signal
        },
        
        // أوزان المؤشرات الحالية
        weights: this.indicatorWeights
      };
    } catch (error) {
      console.error('❌ خطأ في التحليل الكامل:', error);
      throw error;
    }
  }

  // ==================== دالة مساعدة لطباعة النتائج ====================
  
  static formatAnalysisReport(analysis) {
    let report = `
╔═══════════════════════════════════════════════════════════════╗
║          🤖 OBENTCHI V1 PRO - تحليل ذكي متقدم              ║
╚═══════════════════════════════════════════════════════════════╝

📊 الرمز: ${analysis.symbol}
💰 السعر الحالي: $${analysis.currentPrice}
🕐 الوقت: ${new Date(analysis.timestamp).toLocaleString('ar-EG')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 الاتجاه العام:
   ${analysis.trend.emoji} ${analysis.trend.direction} (قوة: ${analysis.trend.strength})
   نقاط: ${analysis.trend.score}

⚡ الزخم:
   ${analysis.momentum.isConfirmed ? '✅' : '❌'} ${analysis.momentum.isConfirmed ? 'مؤكد' : 'غير مؤكد'}
   نقاط: ${analysis.momentum.score}
   ${analysis.momentum.reasons.map(r => `   • ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 الإشارة الفنية الأولية:
   ${analysis.technicalSignal.signal} (قوة: ${analysis.technicalSignal.strength})
   
   أسباب الدخول:
   ${analysis.technicalSignal.reasons.map(r => `   ✓ ${r}`).join('\n')}
   ${analysis.technicalSignal.warnings.length > 0 ? `
   تحذيرات:
   ${analysis.technicalSignal.warnings.map(w => `   ${w}`).join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💭 تحليل المشاعر:
   📊 النتيجة: ${analysis.sentiment.score} (${analysis.sentiment.classification})
   🎯 الثقة: ${(parseFloat(analysis.sentiment.confidence) * 100).toFixed(0)}%
   📰 عدد الأخبار: ${analysis.sentiment.newsCount}
   📝 الملخص: ${analysis.sentiment.summary}
   💥 التأثير: ${analysis.sentiment.impact}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.finalSignal.emoji} الإشارة النهائية: ${analysis.finalSignal.action}
   🎯 درجة الثقة: ${(parseFloat(analysis.finalSignal.confidence) * 100).toFixed(0)}%
   
   الأسباب:
   ${analysis.finalSignal.reasons.map(r => `   ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💼 إدارة المخاطر:
   🛑 وقف الخسارة: $${analysis.riskManagement.stopLoss}
   🎯 جني الأرباح: $${analysis.riskManagement.takeProfit}
   📊 حجم المركز: ${analysis.riskManagement.positionSize} وحدة
   💵 قيمة المركز: $${analysis.riskManagement.positionValue}
   ⚠️ مبلغ المخاطرة: $${analysis.riskManagement.riskAmount}
   📈 نسبة المخاطرة/العائد: 1:${analysis.riskManagement.riskRewardRatio}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 المؤشرات الفنية:
   • RSI: ${analysis.indicators.rsi}
   • MACD: ${analysis.indicators.macd}
   • ADX: ${analysis.indicators.adx}
   • ATR: ${analysis.indicators.atr}
   • Volume: ${analysis.indicators.volume}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 أوزان المؤشرات (التعلم الذاتي):
   ${Object.entries(analysis.weights).map(([k, v]) => `• ${k}: ${v.toFixed(2)}`).join('\n   ')}

╚═══════════════════════════════════════════════════════════════╝
`;
    
    return report;
  }
}

module.exports = OBENTCHIV1ProAnalysis;
