const axios = require('axios');

class WhaleTracker {
  constructor() {
    this.whaleThreshold = 100000; // $100k+ transactions
  }

  // تتبع تحركات الحيتان من Whale Alert (Free API)
  async getWhaleTransactions(symbol) {
    try {
      // استخدام blockchain explorers مجانية
      const transactions = await this.getRecentLargeTransactions(symbol);
      return this.analyzeWhaleActivity(transactions);
    } catch (error) {
      console.error('Whale tracking error:', error.message);
      return { whale_activity: 'غير متاح', whale_score: 0 };
    }
  }

  // الحصول على المعاملات الكبيرة من blockchain
  async getRecentLargeTransactions(symbol) {
    const transactions = [];
    
    try {
      // محاولة الحصول على بيانات من مصادر مختلفة
      const sources = [
        this.getFromWhaleAlert(symbol),
        this.getFromBlockchainExplorer(symbol),
        this.getFromDexScreener(symbol)
      ];

      const results = await Promise.allSettled(sources);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          transactions.push(...result.value);
        }
      });

      return transactions;
    } catch (error) {
      console.log(`⚠️ Could not fetch whale data for ${symbol}`);
      return [];
    }
  }

  // Whale Alert API (محدود مجاناً)
  async getFromWhaleAlert(symbol) {
    try {
      const baseCurrency = symbol.replace('USDT', '').replace('BUSD', '');
      const url = `https://api.whale-alert.io/v1/transactions`;
      
      // ملاحظة: يحتاج API key للإنتاج
      // const response = await axios.get(url, {
      //   params: { currency: baseCurrency.toLowerCase(), min_value: this.whaleThreshold }
      // });
      
      // بدلاً من ذلك، سنستخدم بيانات عامة
      return [];
    } catch (error) {
      return [];
    }
  }

  // الحصول من blockchain explorers (Etherscan, BSCScan)
  async getFromBlockchainExplorer(symbol) {
    try {
      // استخدام APIs مجانية من explorers
      const baseCurrency = symbol.replace('USDT', '');
      
      // يمكن إضافة استدعاءات لـ Etherscan أو BSCScan هنا
      return [];
    } catch (error) {
      return [];
    }
  }

  // الحصول من DexScreener (مجاني تماماً)
  async getFromDexScreener(symbol) {
    try {
      const baseCurrency = symbol.replace('USDT', '');
      const url = `https://api.dexscreener.com/latest/dex/search?q=${baseCurrency}`;
      
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0];
        
        // تحليل حجم التداول والسيولة كمؤشر على نشاط الحيتان
        const volume24h = parseFloat(pair.volume?.h24 || 0);
        const liquidity = parseFloat(pair.liquidity?.usd || 0);
        const priceChange = parseFloat(pair.priceChange?.h24 || 0);
        
        return [{
          volume: volume24h,
          liquidity: liquidity,
          priceChange: priceChange,
          source: 'dexscreener'
        }];
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  // تحليل نشاط الحيتان
  analyzeWhaleActivity(transactions) {
    if (!transactions || transactions.length === 0) {
      return {
        whale_activity: 'منخفض',
        whale_score: 0,
        whale_signals: []
      };
    }

    let whaleScore = 0;
    const signals = [];

    transactions.forEach(tx => {
      // تحليل حجم التداول
      if (tx.volume > 1000000) {
        whaleScore += 30;
        signals.push('🐋 حجم تداول ضخم يشير لنشاط الحيتان');
      } else if (tx.volume > 500000) {
        whaleScore += 20;
        signals.push('🐳 حجم تداول كبير');
      }

      // تحليل السيولة
      if (tx.liquidity > 1000000) {
        whaleScore += 25;
        signals.push('💰 سيولة عالية جداً');
      } else if (tx.liquidity > 500000) {
        whaleScore += 15;
        signals.push('💵 سيولة جيدة');
      }

      // تحليل تغير السعر
      if (Math.abs(tx.priceChange) > 20) {
        whaleScore += 25;
        signals.push('📈 حركة سعرية قوية في 24 ساعة');
      } else if (Math.abs(tx.priceChange) > 10) {
        whaleScore += 15;
        signals.push('📊 تحرك سعري ملحوظ');
      }
    });

    // تحديد مستوى النشاط
    let activity = 'منخفض';
    if (whaleScore >= 80) {
      activity = 'مرتفع جداً';
    } else if (whaleScore >= 60) {
      activity = 'مرتفع';
    } else if (whaleScore >= 40) {
      activity = 'متوسط';
    } else if (whaleScore >= 20) {
      activity = 'منخفض إلى متوسط';
    }

    return {
      whale_activity: activity,
      whale_score: Math.min(100, whaleScore),
      whale_signals: signals.length > 0 ? signals : ['لا توجد إشارات حيتان قوية']
    };
  }

  // تحليل شامل لنشاط الحيتان مع البيانات الفنية
  async getComprehensiveWhaleAnalysis(symbol, technicalScore) {
    const whaleData = await this.getWhaleTransactions(symbol);
    
    // دمج تحليل الحيتان مع التحليل الفني
    const combinedScore = (whaleData.whale_score * 0.4) + (technicalScore * 0.6);
    
    let confidence = 'منخفضة';
    if (combinedScore >= 80) {
      confidence = 'عالية جداً - دعم قوي من الحيتان';
    } else if (combinedScore >= 70) {
      confidence = 'عالية - نشاط حيتان إيجابي';
    } else if (combinedScore >= 60) {
      confidence = 'متوسطة إلى عالية';
    } else if (combinedScore >= 50) {
      confidence = 'متوسطة';
    }

    return {
      ...whaleData,
      combined_score: combinedScore.toFixed(2),
      confidence: confidence,
      recommendation: this.getWhaleRecommendation(combinedScore, whaleData)
    };
  }

  getWhaleRecommendation(score, whaleData) {
    if (score >= 80 && whaleData.whale_score >= 60) {
      return {
        action: '🚀 دخول قوي',
        reason: 'نشاط حيتان مكثف + تحليل فني إيجابي'
      };
    } else if (score >= 70) {
      return {
        action: '✅ دخول',
        reason: 'إشارات إيجابية من الحيتان'
      };
    } else if (score >= 60) {
      return {
        action: '👀 راقب',
        reason: 'نشاط حيتان معتدل'
      };
    } else {
      return {
        action: '⏸️ انتظر',
        reason: 'لا يوجد نشاط حيتان كافٍ'
      };
    }
  }
}

module.exports = WhaleTracker;
