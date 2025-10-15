const db = require('./database');

class AnalystPerformanceAnalyzer {
  async calculateAdvancedMetrics(analystId) {
    const signals = await db.getAnalystSignals(analystId);
    
    if (!signals || signals.length === 0) {
      return this.getEmptyMetrics();
    }

    const closedSignals = signals.filter(s => s.status !== 'active');
    const successfulSignals = closedSignals.filter(s => s.status === 'success');
    const failedSignals = closedSignals.filter(s => s.status === 'failed');

    const winRate = closedSignals.length > 0 
      ? (successfulSignals.length / closedSignals.length) * 100 
      : 0;

    const profitFactor = this.calculateProfitFactor(successfulSignals, failedSignals);
    const avgRR = this.calculateAverageRR(signals);
    const sharpeRatio = this.calculateSharpeRatio(closedSignals);
    const maxDrawdown = this.calculateMaxDrawdown(closedSignals);
    const avgWin = this.calculateAverageWin(successfulSignals);
    const avgLoss = this.calculateAverageLoss(failedSignals);
    const expectancy = this.calculateExpectancy(successfulSignals, failedSignals);
    const consistency = this.calculateConsistency(closedSignals);
    const monthlyPerformance = this.calculateMonthlyPerformance(closedSignals);

    const metrics = {
      total_signals: signals.length,
      active_signals: signals.filter(s => s.status === 'active').length,
      closed_signals: closedSignals.length,
      successful_signals: successfulSignals.length,
      failed_signals: failedSignals.length,
      win_rate: parseFloat(winRate.toFixed(2)),
      profit_factor: parseFloat(profitFactor.toFixed(2)),
      average_rr: parseFloat(avgRR.toFixed(2)),
      sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
      max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
      average_win: parseFloat(avgWin.toFixed(2)),
      average_loss: parseFloat(avgLoss.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      consistency_score: parseFloat(consistency.toFixed(2)),
      monthly_performance: monthlyPerformance,
      last_updated: new Date()
    };

    await db.updateAnalystPerformance(analystId, metrics);
    
    return metrics;
  }

  calculateProfitFactor(successSignals, failedSignals) {
    const totalProfit = successSignals.reduce((sum, signal) => {
      const profit = this.calculateSignalProfit(signal);
      return sum + profit;
    }, 0);

    const totalLoss = failedSignals.reduce((sum, signal) => {
      const loss = Math.abs(this.calculateSignalProfit(signal));
      return sum + loss;
    }, 0);

    return totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
  }

  calculateSignalProfit(signal) {
    if (!signal.entry_price || !signal.closed_price) return 0;
    
    const entry = parseFloat(signal.entry_price);
    const exit = parseFloat(signal.closed_price);
    
    if (signal.type === 'buy') {
      return ((exit - entry) / entry) * 100;
    } else {
      return ((entry - exit) / entry) * 100;
    }
  }

  calculateAverageRR(signals) {
    const validRR = signals
      .filter(s => s.entry_price && s.target_price && s.stop_loss)
      .map(signal => {
        const entry = parseFloat(signal.entry_price);
        const target = parseFloat(signal.target_price);
        const sl = parseFloat(signal.stop_loss);
        
        const risk = Math.abs(entry - sl);
        const reward = Math.abs(target - entry);
        
        return risk > 0 ? reward / risk : 0;
      });

    return validRR.length > 0 
      ? validRR.reduce((a, b) => a + b, 0) / validRR.length 
      : 0;
  }

  calculateSharpeRatio(closedSignals) {
    const returns = closedSignals.map(s => this.calculateSignalProfit(s));
    
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (avgReturn / stdDev) : 0;
  }

  calculateMaxDrawdown(closedSignals) {
    if (closedSignals.length === 0) return 0;

    const sortedSignals = [...closedSignals].sort((a, b) => 
      new Date(a.closed_at) - new Date(b.closed_at)
    );

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const signal of sortedSignals) {
      const profit = this.calculateSignalProfit(signal);
      cumulative += profit;
      
      if (cumulative > peak) {
        peak = cumulative;
      }
      
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  calculateAverageWin(successSignals) {
    if (successSignals.length === 0) return 0;
    
    const wins = successSignals.map(s => this.calculateSignalProfit(s));
    return wins.reduce((a, b) => a + b, 0) / wins.length;
  }

  calculateAverageLoss(failedSignals) {
    if (failedSignals.length === 0) return 0;
    
    const losses = failedSignals.map(s => Math.abs(this.calculateSignalProfit(s)));
    return losses.reduce((a, b) => a + b, 0) / losses.length;
  }

  calculateExpectancy(successSignals, failedSignals) {
    const totalSignals = successSignals.length + failedSignals.length;
    if (totalSignals === 0) return 0;

    const winRate = successSignals.length / totalSignals;
    const avgWin = this.calculateAverageWin(successSignals);
    const avgLoss = this.calculateAverageLoss(failedSignals);

    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  calculateConsistency(closedSignals) {
    if (closedSignals.length < 5) return 0;

    const sortedSignals = [...closedSignals].sort((a, b) => 
      new Date(a.closed_at) - new Date(b.closed_at)
    );

    const batches = [];
    const batchSize = 5;
    
    for (let i = 0; i <= sortedSignals.length - batchSize; i++) {
      const batch = sortedSignals.slice(i, i + batchSize);
      const winRate = batch.filter(s => s.status === 'success').length / batchSize;
      batches.push(winRate);
    }

    if (batches.length === 0) return 0;

    const avgWinRate = batches.reduce((a, b) => a + b, 0) / batches.length;
    const variance = batches.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / batches.length;
    const consistency = 100 - (Math.sqrt(variance) * 100);

    return Math.max(0, Math.min(100, consistency));
  }

  calculateMonthlyPerformance(closedSignals) {
    const monthlyData = {};

    for (const signal of closedSignals) {
      const date = new Date(signal.closed_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          total: 0,
          wins: 0,
          losses: 0,
          profit: 0
        };
      }

      monthlyData[monthKey].total++;
      
      if (signal.status === 'success') {
        monthlyData[monthKey].wins++;
        monthlyData[monthKey].profit += this.calculateSignalProfit(signal);
      } else {
        monthlyData[monthKey].losses++;
        monthlyData[monthKey].profit += this.calculateSignalProfit(signal);
      }
    }

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
      win_rate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      profit: parseFloat(data.profit.toFixed(2))
    })).sort((a, b) => b.month.localeCompare(a.month));
  }

  async calculateTierAndBadges(analystId) {
    const metrics = await this.calculateAdvancedMetrics(analystId);
    const analyst = await db.getAnalyst(analystId);

    const tier = this.determineTier(metrics, analyst);
    const badges = await this.determineBadges(metrics, analyst);
    const achievements = this.checkAchievements(metrics, analyst);

    await db.updateAnalystTierAndBadges(analystId, {
      tier,
      badges,
      achievements,
      last_tier_update: new Date()
    });

    return { tier, badges, achievements };
  }

  determineTier(metrics, analyst) {
    const score = this.calculateTierScore(metrics, analyst);

    if (score >= 90) return 'DIAMOND';
    if (score >= 75) return 'PLATINUM';
    if (score >= 60) return 'GOLD';
    if (score >= 40) return 'SILVER';
    return 'BRONZE';
  }

  calculateTierScore(metrics, analyst) {
    let score = 0;

    if (metrics.win_rate >= 70) score += 25;
    else if (metrics.win_rate >= 60) score += 20;
    else if (metrics.win_rate >= 50) score += 15;
    else if (metrics.win_rate >= 40) score += 10;

    if (metrics.profit_factor >= 2.5) score += 20;
    else if (metrics.profit_factor >= 2.0) score += 15;
    else if (metrics.profit_factor >= 1.5) score += 10;
    else if (metrics.profit_factor >= 1.0) score += 5;

    if (metrics.average_rr >= 3.0) score += 15;
    else if (metrics.average_rr >= 2.5) score += 12;
    else if (metrics.average_rr >= 2.0) score += 10;
    else if (metrics.average_rr >= 1.5) score += 5;

    if (metrics.consistency_score >= 80) score += 15;
    else if (metrics.consistency_score >= 70) score += 12;
    else if (metrics.consistency_score >= 60) score += 10;
    else if (metrics.consistency_score >= 50) score += 5;

    if (analyst.total_subscribers >= 100) score += 10;
    else if (analyst.total_subscribers >= 50) score += 8;
    else if (analyst.total_subscribers >= 25) score += 5;
    else if (analyst.total_subscribers >= 10) score += 3;

    if (metrics.closed_signals >= 100) score += 10;
    else if (metrics.closed_signals >= 50) score += 7;
    else if (metrics.closed_signals >= 25) score += 5;
    else if (metrics.closed_signals >= 10) score += 3;

    if (metrics.max_drawdown <= 10) score += 5;
    else if (metrics.max_drawdown <= 15) score += 3;
    else if (metrics.max_drawdown <= 20) score += 1;

    return Math.min(100, score);
  }

  async determineBadges(metrics, analyst) {
    const badges = [];

    if (metrics.win_rate >= 80) badges.push('EXPERT_TRADER');
    if (metrics.win_rate >= 90) badges.push('MASTER_TRADER');
    
    if (metrics.profit_factor >= 3.0) badges.push('PROFIT_MACHINE');
    
    if (metrics.consistency_score >= 85) badges.push('CONSISTENT_PERFORMER');
    
    if (analyst.total_subscribers >= 100) badges.push('POPULAR_ANALYST');
    if (analyst.total_subscribers >= 500) badges.push('CELEBRITY_ANALYST');
    
    if (metrics.closed_signals >= 100) badges.push('EXPERIENCED');
    if (metrics.closed_signals >= 500) badges.push('VETERAN');
    
    if (metrics.average_rr >= 3.5) badges.push('RISK_MASTER');
    
    if (metrics.max_drawdown <= 5) badges.push('LOW_RISK');
    
    if (metrics.sharpe_ratio >= 2.0) badges.push('HIGH_SHARPE');

    const recentSignals = await db.getAnalystSignals(analyst._id.toString(), 10);
    const recentWins = recentSignals.filter(s => s.status === 'success').length;
    if (recentWins >= 9) badges.push('HOT_STREAK');

    return badges;
  }

  checkAchievements(metrics, analyst) {
    const achievements = [];
    const now = new Date();

    if (metrics.win_rate >= 70 && metrics.closed_signals >= 20) {
      achievements.push({
        type: 'WIN_RATE_70',
        title: 'نسبة نجاح 70%+',
        description: 'حقق نسبة نجاح 70% أو أكثر في 20 صفقة على الأقل',
        earned_at: now,
        icon: '🎯'
      });
    }

    if (analyst.total_subscribers >= 50) {
      achievements.push({
        type: 'SUBSCRIBERS_50',
        title: '50 مشترك',
        description: 'وصل عدد المشتركين إلى 50 أو أكثر',
        earned_at: now,
        icon: '👥'
      });
    }

    if (metrics.closed_signals >= 100) {
      achievements.push({
        type: 'SIGNALS_100',
        title: '100 صفقة',
        description: 'أكمل 100 صفقة بنجاح',
        earned_at: now,
        icon: '📊'
      });
    }

    if (metrics.profit_factor >= 2.5 && metrics.closed_signals >= 30) {
      achievements.push({
        type: 'PROFIT_FACTOR_25',
        title: 'عامل ربح 2.5+',
        description: 'حقق عامل ربح 2.5 أو أكثر في 30 صفقة على الأقل',
        earned_at: now,
        icon: '💰'
      });
    }

    if (metrics.consistency_score >= 80) {
      achievements.push({
        type: 'CONSISTENCY_80',
        title: 'أداء ثابت',
        description: 'حافظ على درجة ثبات 80% أو أكثر',
        earned_at: now,
        icon: '⭐'
      });
    }

    return achievements;
  }

  getEmptyMetrics() {
    return {
      total_signals: 0,
      active_signals: 0,
      closed_signals: 0,
      successful_signals: 0,
      failed_signals: 0,
      win_rate: 0,
      profit_factor: 0,
      average_rr: 0,
      sharpe_ratio: 0,
      max_drawdown: 0,
      average_win: 0,
      average_loss: 0,
      expectancy: 0,
      consistency_score: 0,
      monthly_performance: [],
      last_updated: new Date()
    };
  }

  async getAnalystRanking() {
    const analysts = await db.getAllAnalysts();
    const rankings = [];

    for (const analyst of analysts) {
      const metrics = await this.calculateAdvancedMetrics(analyst._id);
      const tierData = await this.calculateTierAndBadges(analyst._id);
      
      rankings.push({
        analyst_id: analyst._id,
        name: analyst.name,
        metrics,
        tier: tierData.tier,
        badges: tierData.badges,
        score: this.calculateTierScore(metrics, analyst)
      });
    }

    rankings.sort((a, b) => b.score - a.score);

    return rankings;
  }

  async getTopPerformers(limit = 10, metric = 'score') {
    const rankings = await this.getAnalystRanking();
    
    if (metric !== 'score') {
      rankings.sort((a, b) => b.metrics[metric] - a.metrics[metric]);
    }

    return rankings.slice(0, limit);
  }

  async compareAnalysts(analystIds) {
    const comparisons = [];

    for (const id of analystIds) {
      const analyst = await db.getAnalyst(id);
      const metrics = await this.calculateAdvancedMetrics(id);
      const tierData = await this.calculateTierAndBadges(id);

      comparisons.push({
        analyst,
        metrics,
        tier: tierData.tier,
        badges: tierData.badges
      });
    }

    return comparisons;
  }
}

module.exports = new AnalystPerformanceAnalyzer();
