/**
 * Enhanced Earning System
 * نظام أرباح محسّن مع ميزات متقدمة
 * 
 * Features:
 * - Multi-level referral system (3 levels)
 * - Dynamic commission rates
 * - Bonus milestones
 * - Leaderboard rewards
 * - Analyst performance bonuses
 * - Withdrawal tracking
 * - Real-time earnings dashboard
 */

const { createLogger } = require('./centralized-logger');
const db = require('./database');

const logger = createLogger('earning-system');

class EnhancedEarningSystem {
  constructor() {
    this.commissionRates = {
      level1: 10,
      level2: 5, 
      level3: 2.5 
    };
    
    this.bonusMilestones = [
      { referrals: 10, bonus: 50, label: 'المبتدئ' },
      { referrals: 25, bonus: 150, label: 'المحترف' },
      { referrals: 50, bonus: 500, label: 'الخبير' },
      { referrals: 100, bonus: 1500, label: 'الأسطورة' },
      { referrals: 250, bonus: 5000, label: 'الملك' }
    ];
    
    this.analystBonuses = {
      winRate: {
        threshold: 0.70,
        bonus: 100,
        label: 'معدل ربح عالي'
      },
      signals: {
        threshold: 100,
        bonus: 200,
        label: 'محلل نشط'
      },
      topRank: {
        ranks: [1, 2, 3],
        bonuses: [1000, 500, 250],
        label: 'محلل متميز'
      }
    };
  }

  async calculateReferralEarnings(userId, referredUserId, amount) {
    try {
      const referrer = await db.getUser(userId);
      
      if (!referrer) {
        return {
          success: false,
          error: 'referrer_not_found'
        };
      }

      const level = await this.getReferralLevel(userId, referredUserId);
      
      let commissionRate = 0;
      if (level === 1) commissionRate = this.commissionRates.level1;
      else if (level === 2) commissionRate = this.commissionRates.level2;
      else if (level === 3) commissionRate = this.commissionRates.level3;
      
      const commission = (amount * commissionRate) / 100;
      
      const tier = await this.getUserTier(userId);
      let bonus = 0;
      
      if (tier === 'vip') {
        bonus = commission * 0.2;
      } else if (tier === 'analyst') {
        bonus = commission * 0.3;
      }
      
      const totalEarning = commission + bonus;
      
      await this.recordEarning(userId, {
        type: 'referral_commission',
        amount: totalEarning,
        commission,
        bonus,
        level,
        referred_user: referredUserId,
        source_amount: amount
      });
      
      await db.updateUserBalance(userId, totalEarning);
      
      logger.info({ 
        userId, 
        referredUserId, 
        level, 
        commission, 
        bonus, 
        totalEarning 
      }, '💰 Referral earnings calculated');
      
      return {
        success: true,
        commission,
        bonus,
        total: totalEarning,
        level,
        rate: commissionRate
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error calculating referral earnings');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReferralLevel(referrerId, userId) {
    try {
      const user = await db.getUser(userId);
      
      if (!user) {
        logger.warn({ userId, referrerId }, 'User not found in getReferralLevel');
        return 0;
      }
      
      if (user.referred_by === referrerId) {
        return 1;
      }
      
      if (user.referred_by) {
        const level1Referrer = await db.getUser(user.referred_by);
        if (level1Referrer && level1Referrer.referred_by === referrerId) {
          return 2;
        }
        
        if (level1Referrer && level1Referrer.referred_by) {
          const level2Referrer = await db.getUser(level1Referrer.referred_by);
          if (level2Referrer && level2Referrer.referred_by === referrerId) {
            return 3;
          }
        }
      }
      
      return 0;
    } catch (error) {
      logger.error({ err: error }, 'Error getting referral level');
      return 0;
    }
  }

  async checkMilestones(userId) {
    try {
      const referralStats = await this.getReferralStats(userId);
      const totalReferrals = referralStats.total || 0;
      
      const user = await db.getUser(userId);
      
      if (!user) {
        logger.warn({ userId }, 'User not found in checkMilestones');
        return {
          success: false,
          error: 'user_not_found'
        };
      }
      
      const earnedMilestones = user.earned_milestones || [];
      
      const newMilestones = [];
      
      for (const milestone of this.bonusMilestones) {
        const milestoneId = `referral_${milestone.referrals}`;
        
        if (totalReferrals >= milestone.referrals && !earnedMilestones.includes(milestoneId)) {
          await db.updateUserBalance(userId, milestone.bonus);
          
          await this.recordEarning(userId, {
            type: 'milestone_bonus',
            amount: milestone.bonus,
            milestone: milestone.label,
            referrals: milestone.referrals
          });
          
          earnedMilestones.push(milestoneId);
          newMilestones.push(milestone);
          
          logger.info({ 
            userId, 
            milestone: milestone.label, 
            bonus: milestone.bonus 
          }, '🎉 Milestone achieved');
        }
      }
      
      if (newMilestones.length > 0) {
        await db.updateUser(userId, { 
          earned_milestones: earnedMilestones 
        });
      }
      
      return {
        success: true,
        new_milestones: newMilestones,
        total_referrals: totalReferrals,
        next_milestone: this.getNextMilestone(totalReferrals)
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error checking milestones');
      return {
        success: false,
        error: error.message
      };
    }
  }

  getNextMilestone(currentReferrals) {
    for (const milestone of this.bonusMilestones) {
      if (currentReferrals < milestone.referrals) {
        return {
          referrals: milestone.referrals,
          bonus: milestone.bonus,
          label: milestone.label,
          remaining: milestone.referrals - currentReferrals
        };
      }
    }
    return null;
  }

  async checkAnalystBonuses(userId) {
    try {
      const analystPerformance = require('./analyst-performance');
      const stats = await analystPerformance.getAnalystStats(userId);
      
      if (!stats || !stats.success) {
        return {
          success: false,
          error: 'not_an_analyst'
        };
      }
      
      const bonuses = [];
      
      if (stats.win_rate >= this.analystBonuses.winRate.threshold) {
        const bonus = this.analystBonuses.winRate.bonus;
        bonuses.push({
          type: 'win_rate',
          amount: bonus,
          label: this.analystBonuses.winRate.label
        });
      }
      
      if (stats.total_signals >= this.analystBonuses.signals.threshold) {
        const bonus = this.analystBonuses.signals.bonus;
        bonuses.push({
          type: 'active_analyst',
          amount: bonus,
          label: this.analystBonuses.signals.label
        });
      }
      
      if (bonuses.length > 0) {
        const totalBonus = bonuses.reduce((sum, b) => sum + b.amount, 0);
        
        await db.updateUserBalance(userId, totalBonus);
        
        for (const bonus of bonuses) {
          await this.recordEarning(userId, {
            type: 'analyst_bonus',
            amount: bonus.amount,
            bonus_type: bonus.type,
            label: bonus.label
          });
        }
        
        logger.info({ userId, bonuses, totalBonus }, '🏆 Analyst bonuses awarded');
      }
      
      return {
        success: true,
        bonuses,
        total_bonus: bonuses.reduce((sum, b) => sum + b.amount, 0)
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error checking analyst bonuses');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async recordEarning(userId, earningData) {
    try {
      const database = db.getDB();
      const earnings = database.collection('earnings');
      
      const earning = {
        user_id: userId,
        ...earningData,
        created_at: new Date(),
        timestamp: Date.now()
      };
      
      await earnings.insertOne(earning);
      
      return { success: true };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error recording earning');
      throw error;
    }
  }

  async getEarningsDashboard(userId) {
    try {
      const database = db.getDB();
      const earnings = database.collection('earnings');
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const [
        totalEarnings,
        monthlyEarnings,
        weeklyEarnings,
        referralStats,
        earningsByType
      ] = await Promise.all([
        earnings.aggregate([
          { $match: { user_id: userId } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray(),
        
        earnings.aggregate([
          { $match: { user_id: userId, created_at: { $gte: startOfMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray(),
        
        earnings.aggregate([
          { $match: { user_id: userId, created_at: { $gte: startOfWeek } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray(),
        
        this.getReferralStats(userId),
        
        earnings.aggregate([
          { $match: { user_id: userId } },
          { 
            $group: { 
              _id: '$type', 
              total: { $sum: '$amount' },
              count: { $sum: 1 }
            } 
          }
        ]).toArray()
      ]);
      
      const user = await db.getUser(userId);
      const milestoneProgress = await this.checkMilestones(userId);
      
      return {
        success: true,
        summary: {
          total: totalEarnings[0]?.total || 0,
          monthly: monthlyEarnings[0]?.total || 0,
          weekly: weeklyEarnings[0]?.total || 0,
          current_balance: user.balance || 0
        },
        referrals: referralStats,
        by_type: earningsByType.reduce((acc, item) => {
          acc[item._id] = {
            total: item.total,
            count: item.count
          };
          return acc;
        }, {}),
        milestones: {
          next: milestoneProgress.next_milestone,
          earned: user.earned_milestones || []
        }
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error getting earnings dashboard');
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReferralStats(userId) {
    try {
      const database = db.getDB();
      const users = database.collection('users');
      
      const [level1, level2, level3] = await Promise.all([
        users.countDocuments({ referred_by: userId }),
        users.aggregate([
          { $match: { referred_by: { $ne: null } } },
          {
            $lookup: {
              from: 'users',
              localField: 'referred_by',
              foreignField: 'user_id',
              as: 'referrer'
            }
          },
          { $unwind: '$referrer' },
          { $match: { 'referrer.referred_by': userId } },
          { $count: 'count' }
        ]).toArray(),
        users.aggregate([
          { $match: { referred_by: { $ne: null } } },
          {
            $lookup: {
              from: 'users',
              localField: 'referred_by',
              foreignField: 'user_id',
              as: 'level1_referrer'
            }
          },
          { $unwind: '$level1_referrer' },
          { $match: { 'level1_referrer.referred_by': { $ne: null } } },
          {
            $lookup: {
              from: 'users',
              localField: 'level1_referrer.referred_by',
              foreignField: 'user_id',
              as: 'level2_referrer'
            }
          },
          { $unwind: '$level2_referrer' },
          { $match: { 'level2_referrer.referred_by': userId } },
          { $count: 'count' }
        ]).toArray()
      ]);
      
      const level2Count = level2[0]?.count || 0;
      const level3Count = level3[0]?.count || 0;
      const total = level1 + level2Count + level3Count;
      
      return {
        total,
        level1,
        level2: level2Count,
        level3: level3Count,
        breakdown: {
          direct: level1,
          indirect: level2Count + level3Count
        }
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error getting referral stats');
      return {
        total: 0,
        level1: 0,
        level2: 0,
        level3: 0
      };
    }
  }

  async getUserTier(userId) {
    try {
      const user = await db.getUser(userId);
      
      if (!user) return 'free';
      
      if (user.is_analyst) return 'analyst';
      
      if (user.subscription_expires && new Date(user.subscription_expires) > new Date()) {
        return 'vip';
      }
      
      if (user.balance >= 100) {
        return 'basic';
      }
      
      return 'free';
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting user tier');
      return 'free';
    }
  }

  async getLeaderboard(type = 'referrals', limit = 10) {
    try {
      const database = db.getDB();
      
      if (type === 'referrals') {
        const users = database.collection('users');
        const topReferrers = await users.aggregate([
          {
            $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: 'referred_by',
              as: 'referrals'
            }
          },
          {
            $project: {
              user_id: 1,
              username: 1,
              referral_count: { $size: '$referrals' }
            }
          },
          { $match: { referral_count: { $gt: 0 } } },
          { $sort: { referral_count: -1 } },
          { $limit: limit }
        ]).toArray();
        
        return {
          success: true,
          type,
          leaderboard: topReferrers
        };
      } else if (type === 'earnings') {
        const earnings = database.collection('earnings');
        const topEarners = await earnings.aggregate([
          {
            $group: {
              _id: '$user_id',
              total_earnings: { $sum: '$amount' }
            }
          },
          { $sort: { total_earnings: -1 } },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: 'user_id',
              as: 'user'
            }
          },
          { $unwind: '$user' },
          {
            $project: {
              user_id: '$_id',
              username: '$user.username',
              total_earnings: 1
            }
          }
        ]).toArray();
        
        return {
          success: true,
          type,
          leaderboard: topEarners
        };
      }
      
      return {
        success: false,
        error: 'invalid_type'
      };
    } catch (error) {
      logger.error({ err: error, type }, '❌ Error getting leaderboard');
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const earningSystem = new EnhancedEarningSystem();

module.exports = earningSystem;
