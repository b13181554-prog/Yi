const geminiService = require('./gemini-service');
const db = require('./database');
const config = require('./config');

class AnalystAIAdvisor {
  async analyzePerformanceAndAdvise(analystId) {
    try {
      const analyst = await db.getAnalyst(analystId);
      const signals = await db.getAnalystSignals(analystId);
      const performance = await db.getAnalystPerformance(analystId);

      if (!signals || signals.length < 5) {
        return {
          success: false,
          message: 'يحتاج المحلل إلى 5 صفقات على الأقل للحصول على تحليل AI'
        };
      }

      const closedSignals = signals.filter(s => s.status !== 'active');
      const successfulSignals = closedSignals.filter(s => s.status === 'success');
      const failedSignals = closedSignals.filter(s => s.status === 'failed');

      const analysisPrompt = this.buildAnalysisPrompt(analyst, performance, closedSignals, successfulSignals, failedSignals);

      const completion = await geminiService.chat([
        {
          role: 'system',
          content: 'أنت محلل مالي خبير متخصص في تحليل أداء محللي التداول وتقديم نصائح احترافية لتحسين الأداء. قدم تحليلاً دقيقاً ونصائح عملية قابلة للتطبيق.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ], {
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        maxOutputTokens: 2000
      });

      const aiAdvice = completion.content;

      const patterns = this.detectPatterns(closedSignals);
      const strengths = this.identifyStrengths(performance, patterns);
      const weaknesses = this.identifyWeaknesses(performance, patterns);
      const recommendations = this.generateRecommendations(performance, patterns, strengths, weaknesses);

      const result = {
        success: true,
        ai_analysis: aiAdvice,
        patterns_detected: patterns,
        strengths: strengths,
        weaknesses: weaknesses,
        recommendations: recommendations,
        performance_score: this.calculateOverallScore(performance),
        generated_at: new Date()
      };

      await db.getDB().collection('analyst_ai_insights').insertOne({
        analyst_id: analystId,
        ...result,
        created_at: new Date()
      });

      return result;
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  buildAnalysisPrompt(analyst, performance, closedSignals, successfulSignals, failedSignals) {
    return `
قم بتحليل أداء المحلل التالي وتقديم نصائح لتحسين الأداء:

**معلومات المحلل:**
- الاسم: ${analyst.name}
- عدد المشتركين: ${analyst.total_subscribers || 0}
- السوق: ${analyst.markets?.join(', ') || 'غير محدد'}

**إحصائيات الأداء:**
- إجمالي الصفقات المغلقة: ${closedSignals.length}
- صفقات ناجحة: ${successfulSignals.length}
- صفقات فاشلة: ${failedSignals.length}
- نسبة النجاح: ${performance?.win_rate || 0}%
- عامل الربح: ${performance?.profit_factor || 0}
- متوسط R/R: ${performance?.average_rr || 0}
- نسبة شارب: ${performance?.sharpe_ratio || 0}
- أقصى تراجع: ${performance?.max_drawdown || 0}%
- متوسط الربح: ${performance?.average_win || 0}%
- متوسط الخسارة: ${performance?.average_loss || 0}%
- درجة الاتساق: ${performance?.consistency_score || 0}

**آخر 10 صفقات:**
${closedSignals.slice(0, 10).map((s, i) => `
${i + 1}. ${s.symbol} - ${s.type === 'buy' ? 'شراء' : 'بيع'} - ${s.status === 'success' ? '✅ نجاح' : '❌ فشل'}
   الدخول: ${s.entry_price} | الهدف: ${s.target_price} | SL: ${s.stop_loss}
`).join('\n')}

قدم تحليلاً شاملاً يتضمن:
1. تقييم الأداء العام
2. نقاط القوة الرئيسية
3. نقاط الضعف والتحديات
4. أنماط ملحوظة في التداول
5. توصيات محددة للتحسين
6. استراتيجيات مقترحة لزيادة نسبة النجاح

الرجاء تقديم الإجابة بشكل منظم ومفصل باللغة العربية.
`;
  }

  detectPatterns(closedSignals) {
    const patterns = {
      win_streak: 0,
      loss_streak: 0,
      current_streak: 0,
      best_performing_symbol: null,
      worst_performing_symbol: null,
      best_timeframe: null,
      market_type_performance: {}
    };

    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    const sortedSignals = [...closedSignals].sort((a, b) => 
      new Date(a.closed_at) - new Date(b.closed_at)
    );

    for (let i = 0; i < sortedSignals.length; i++) {
      const signal = sortedSignals[i];
      
      if (signal.status === 'success') {
        tempWinStreak++;
        tempLossStreak = 0;
        currentStreak = i === sortedSignals.length - 1 ? tempWinStreak : currentStreak;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        currentStreak = i === sortedSignals.length - 1 ? -tempLossStreak : currentStreak;
        maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
      }
    }

    patterns.win_streak = maxWinStreak;
    patterns.loss_streak = maxLossStreak;
    patterns.current_streak = currentStreak;

    const symbolPerformance = {};
    const timeframePerformance = {};
    const marketTypePerformance = {};

    for (const signal of closedSignals) {
      if (!symbolPerformance[signal.symbol]) {
        symbolPerformance[signal.symbol] = { wins: 0, total: 0 };
      }
      symbolPerformance[signal.symbol].total++;
      if (signal.status === 'success') {
        symbolPerformance[signal.symbol].wins++;
      }

      if (signal.timeframe) {
        if (!timeframePerformance[signal.timeframe]) {
          timeframePerformance[signal.timeframe] = { wins: 0, total: 0 };
        }
        timeframePerformance[signal.timeframe].total++;
        if (signal.status === 'success') {
          timeframePerformance[signal.timeframe].wins++;
        }
      }

      if (signal.market_type) {
        if (!marketTypePerformance[signal.market_type]) {
          marketTypePerformance[signal.market_type] = { wins: 0, total: 0 };
        }
        marketTypePerformance[signal.market_type].total++;
        if (signal.status === 'success') {
          marketTypePerformance[signal.market_type].wins++;
        }
      }
    }

    let bestSymbol = null;
    let bestSymbolRate = 0;
    let worstSymbol = null;
    let worstSymbolRate = 100;

    for (const [symbol, data] of Object.entries(symbolPerformance)) {
      if (data.total >= 3) {
        const rate = (data.wins / data.total) * 100;
        if (rate > bestSymbolRate) {
          bestSymbolRate = rate;
          bestSymbol = { symbol, win_rate: rate, total: data.total };
        }
        if (rate < worstSymbolRate) {
          worstSymbolRate = rate;
          worstSymbol = { symbol, win_rate: rate, total: data.total };
        }
      }
    }

    patterns.best_performing_symbol = bestSymbol;
    patterns.worst_performing_symbol = worstSymbol;

    let bestTimeframe = null;
    let bestTimeframeRate = 0;

    for (const [timeframe, data] of Object.entries(timeframePerformance)) {
      if (data.total >= 3) {
        const rate = (data.wins / data.total) * 100;
        if (rate > bestTimeframeRate) {
          bestTimeframeRate = rate;
          bestTimeframe = { timeframe, win_rate: rate, total: data.total };
        }
      }
    }

    patterns.best_timeframe = bestTimeframe;
    patterns.market_type_performance = Object.fromEntries(
      Object.entries(marketTypePerformance).map(([type, data]) => [
        type,
        {
          win_rate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
          total: data.total
        }
      ])
    );

    return patterns;
  }

  identifyStrengths(performance, patterns) {
    const strengths = [];

    if (performance?.win_rate >= 70) {
      strengths.push({
        title: 'نسبة نجاح عالية',
        description: `نسبة نجاح ممتازة ${performance.win_rate}%`,
        impact: 'high'
      });
    }

    if (performance?.profit_factor >= 2.0) {
      strengths.push({
        title: 'عامل ربح قوي',
        description: `عامل ربح ${performance.profit_factor} يدل على إدارة ممتازة`,
        impact: 'high'
      });
    }

    if (performance?.consistency_score >= 75) {
      strengths.push({
        title: 'أداء ثابت',
        description: `درجة ثبات ${performance.consistency_score} تدل على استقرار الأداء`,
        impact: 'medium'
      });
    }

    if (patterns.win_streak >= 5) {
      strengths.push({
        title: 'سلسلة انتصارات',
        description: `أفضل سلسلة انتصارات: ${patterns.win_streak} صفقات`,
        impact: 'medium'
      });
    }

    if (patterns.best_performing_symbol) {
      strengths.push({
        title: 'تخصص في رمز معين',
        description: `أداء ممتاز في ${patterns.best_performing_symbol.symbol} بنسبة ${patterns.best_performing_symbol.win_rate.toFixed(1)}%`,
        impact: 'medium'
      });
    }

    if (performance?.average_rr >= 2.5) {
      strengths.push({
        title: 'إدارة مخاطر ممتازة',
        description: `متوسط R/R ${performance.average_rr} يدل على إدارة مخاطر جيدة`,
        impact: 'high'
      });
    }

    return strengths;
  }

  identifyWeaknesses(performance, patterns) {
    const weaknesses = [];

    if (performance?.win_rate < 50) {
      weaknesses.push({
        title: 'نسبة نجاح منخفضة',
        description: `نسبة النجاح ${performance.win_rate}% تحتاج لتحسين`,
        severity: 'high'
      });
    }

    if (performance?.max_drawdown > 20) {
      weaknesses.push({
        title: 'تراجع كبير',
        description: `أقصى تراجع ${performance.max_drawdown}% مرتفع جداً`,
        severity: 'high'
      });
    }

    if (performance?.profit_factor < 1.5) {
      weaknesses.push({
        title: 'عامل ربح ضعيف',
        description: `عامل الربح ${performance.profit_factor} يحتاج لتحسين`,
        severity: 'medium'
      });
    }

    if (patterns.loss_streak >= 4) {
      weaknesses.push({
        title: 'سلسلة خسائر',
        description: `أطول سلسلة خسائر: ${patterns.loss_streak} صفقات`,
        severity: 'medium'
      });
    }

    if (performance?.consistency_score < 50) {
      weaknesses.push({
        title: 'عدم استقرار الأداء',
        description: `درجة الثبات ${performance.consistency_score} منخفضة جداً`,
        severity: 'high'
      });
    }

    if (performance?.average_rr < 1.5) {
      weaknesses.push({
        title: 'R/R منخفض',
        description: `متوسط R/R ${performance.average_rr} غير كافٍ`,
        severity: 'medium'
      });
    }

    if (patterns.worst_performing_symbol && patterns.worst_performing_symbol.win_rate < 30) {
      weaknesses.push({
        title: 'أداء ضعيف في رمز معين',
        description: `أداء ضعيف في ${patterns.worst_performing_symbol.symbol} بنسبة ${patterns.worst_performing_symbol.win_rate.toFixed(1)}%`,
        severity: 'low'
      });
    }

    return weaknesses;
  }

  generateRecommendations(performance, patterns, strengths, weaknesses) {
    const recommendations = [];

    if (performance?.win_rate < 60) {
      recommendations.push({
        priority: 'high',
        category: 'استراتيجية',
        title: 'تحسين نسبة النجاح',
        action: 'راجع شروط الدخول وتأكد من تحليل أفضل قبل إرسال الإشارة',
        expected_impact: 'زيادة نسبة النجاح بنسبة 10-15%'
      });
    }

    if (performance?.average_rr < 2.0) {
      recommendations.push({
        priority: 'high',
        category: 'إدارة المخاطر',
        title: 'تحسين نسبة المخاطرة/العائد',
        action: 'استهدف R/R لا يقل عن 2:1 في كل صفقة',
        expected_impact: 'تحسين الربحية الإجمالية'
      });
    }

    if (performance?.max_drawdown > 15) {
      recommendations.push({
        priority: 'critical',
        category: 'إدارة المخاطر',
        title: 'تقليل التراجع',
        action: 'قلل حجم المخاطرة في كل صفقة إلى 1-2% فقط',
        expected_impact: 'تقليل التراجع إلى أقل من 15%'
      });
    }

    if (patterns.best_performing_symbol) {
      recommendations.push({
        priority: 'medium',
        category: 'التخصص',
        title: 'التركيز على الرموز الناجحة',
        action: `ركز أكثر على ${patterns.best_performing_symbol.symbol} حيث لديك أداء ممتاز فيه`,
        expected_impact: 'زيادة نسبة النجاح الإجمالية'
      });
    }

    if (patterns.worst_performing_symbol && patterns.worst_performing_symbol.win_rate < 40) {
      recommendations.push({
        priority: 'medium',
        category: 'التخصص',
        title: 'تجنب الرموز الضعيفة',
        action: `تجنب ${patterns.worst_performing_symbol.symbol} أو احصل على تدريب إضافي عليه`,
        expected_impact: 'تحسين النتائج الإجمالية'
      });
    }

    if (performance?.consistency_score < 60) {
      recommendations.push({
        priority: 'high',
        category: 'استراتيجية',
        title: 'تحسين الاتساق',
        action: 'التزم باستراتيجية واحدة ثابتة بدلاً من التنقل بين استراتيجيات مختلفة',
        expected_impact: 'زيادة درجة الثبات'
      });
    }

    if (patterns.best_timeframe) {
      recommendations.push({
        priority: 'low',
        category: 'التخصص',
        title: 'التركيز على الإطار الزمني الأفضل',
        action: `ركز على إطار ${patterns.best_timeframe.timeframe} حيث تحقق أفضل النتائج`,
        expected_impact: 'تحسين الأداء العام'
      });
    }

    recommendations.push({
      priority: 'medium',
      category: 'التطوير',
      title: 'التعلم المستمر',
      action: 'راجع كل صفقة فاشلة وتعلم منها، واحتفظ بمذكرة تداول',
      expected_impact: 'تطوير مستمر في الأداء'
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  calculateOverallScore(performance) {
    if (!performance) return 0;

    let score = 0;

    score += Math.min(performance.win_rate || 0, 100) * 0.3;
    score += Math.min((performance.profit_factor || 0) * 20, 100) * 0.25;
    score += Math.min((performance.average_rr || 0) * 30, 100) * 0.15;
    score += Math.min(performance.consistency_score || 0, 100) * 0.15;
    score += Math.min(performance.sharpe_ratio * 50, 100) * 0.1;
    score += Math.max(0, 100 - (performance.max_drawdown || 0) * 3) * 0.05;

    return Math.round(Math.min(score, 100));
  }

  async getLatestInsights(analystId) {
    const insights = await db.getDB().collection('analyst_ai_insights')
      .find({ analyst_id: analystId })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();

    return insights[0] || null;
  }

  async getAllInsights(analystId) {
    return await db.getDB().collection('analyst_ai_insights')
      .find({ analyst_id: analystId })
      .sort({ created_at: -1 })
      .toArray();
  }
}

module.exports = new AnalystAIAdvisor();
