/**
 * User Access Control System
 * نظام متكامل للتحكم في صلاحيات المستخدمين
 * 
 * Features:
 * - Integration with Advanced Rate Limiter
 * - User Dashboard API
 * - Admin Management API
 * - Real-time Limit Status
 * - Access Control Middleware
 */

const { advancedRateLimiter } = require('./advanced-rate-limiter');
const { createLogger } = require('./centralized-logger');
const db = require('./database');
const config = require('./config');

const logger = createLogger('user-access-control');

class UserAccessControl {
  constructor() {
    this.rateLimiter = advancedRateLimiter;
    logger.info('🔐 User Access Control System initialized (using shared singleton)');
  }

  // ===== MIDDLEWARE =====

  /**
   * Middleware للتحقق من صلاحيات المستخدم قبل الوصول للـ resource
   */
  createAccessMiddleware(resource, options = {}) {
    return async (req, res, next) => {
      try {
        const userId = req.body?.user_id || req.query?.user_id || req.headers['x-user-id'];
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'user_id_required',
            message: 'معرف المستخدم مطلوب'
          });
        }

        const cost = options.cost || 1;
        const result = await this.rateLimiter.consumeRateLimit(userId, resource, { cost });

        if (!result.allowed) {
          logger.warn({ userId, resource, tier: result.tier }, '⚠️ Access denied - rate limit exceeded');
          
          return res.status(429).json({
            success: false,
            error: 'rate_limit_exceeded',
            message: result.message,
            tier: result.tier,
            limit: result.limit,
            retryAfter: result.retryAfter,
            resetTime: result.resetTime,
            upgrade_suggestion: result.upgrade_suggestion
          });
        }

        if (result.softLimitWarning) {
          logger.info({ userId, resource, percentUsed: result.percentUsed }, 'ℹ️ Soft limit warning');
        }

        req.rateLimitInfo = {
          tier: result.tier,
          remaining: result.remaining,
          limit: result.limit,
          resource
        };

        next();
      } catch (error) {
        logger.error({ err: error }, 'Error in access middleware');
        next();
      }
    };
  }

  /**
   * Middleware للتحقق من أن المستخدم Admin
   */
  requireAdmin(req, res, next) {
    const userId = req.body?.user_id || req.query?.user_id || req.headers['x-user-id'];
    
    if (!userId || userId !== config.OWNER_ID) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'غير مصرح لك بالوصول لهذه الصفحة'
      });
    }
    
    next();
  }

  // ===== USER DASHBOARD API =====

  /**
   * الحصول على معلومات tier المستخدم وحالة الحدود
   */
  async getUserDashboard(userId) {
    try {
      const [user, tierStatus, tier] = await Promise.all([
        db.getUser(userId),
        this.rateLimiter.getRateLimitStatus(userId),
        this.rateLimiter.getUserTier(userId)
      ]);

      if (!user) {
        return {
          success: false,
          error: 'user_not_found',
          message: 'المستخدم غير موجود'
        };
      }

      const dashboard = {
        success: true,
        user: {
          user_id: user.user_id,
          username: user.username,
          balance: user.balance,
          subscription_expires: user.subscription_expires,
          created_at: user.created_at
        },
        access_control: {
          tier: tierStatus.tier,
          tier_name: tierStatus.tierName,
          priority: tierStatus.priority,
          resources: tierStatus.resources.map(r => ({
            resource: r.resource,
            limit: r.limit,
            remaining: r.remaining,
            count: r.count,
            percent_used: r.percentUsed,
            reset_time: r.resetTime,
            unlimited: r.unlimited || false,
            warning: r.softLimitWarning ? r.warning : null
          }))
        },
        recommendations: this.generateUserRecommendations(tier, tierStatus)
      };

      return dashboard;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting user dashboard');
      return {
        success: false,
        error: 'internal_error',
        message: 'خطأ في تحميل لوحة التحكم'
      };
    }
  }

  /**
   * توليد توصيات للمستخدم بناءً على استخدامه
   */
  generateUserRecommendations(tier, tierStatus) {
    const recommendations = [];

    if (tier === 'free') {
      recommendations.push({
        type: 'upgrade',
        priority: 'high',
        message: 'قم بالترقية إلى Basic للحصول على حدود أعلى وميزات إضافية',
        action: 'subscribe'
      });
    }

    const resources = tierStatus.resources || [];
    const highUsageResources = resources.filter(r => r.percentUsed >= 80);

    if (highUsageResources.length > 0) {
      recommendations.push({
        type: 'usage_warning',
        priority: 'medium',
        message: `أنت قريب من الحد الأقصى في ${highUsageResources.length} موارد`,
        resources: highUsageResources.map(r => r.resource),
        action: 'upgrade_or_wait'
      });
    }

    if (tier === 'basic' || tier === 'vip') {
      const analystUpgrade = resources.find(r => r.resource === 'analysis' && r.percentUsed >= 70);
      if (analystUpgrade) {
        recommendations.push({
          type: 'tier_upgrade',
          priority: 'low',
          message: 'أصبح محللاً للحصول على حدود غير محدودة',
          action: 'become_analyst'
        });
      }
    }

    return recommendations;
  }

  // ===== ADMIN API =====

  /**
   * الحصول على نظرة عامة على جميع المستخدمين
   */
  async getSystemOverview(adminId) {
    try {
      if (adminId !== config.OWNER_ID) {
        return {
          success: false,
          error: 'unauthorized',
          message: 'غير مصرح'
        };
      }

      const [tierDistribution, resourceUsage, mostLimitedUsers] = await Promise.all([
        this.rateLimiter.getTierDistribution(),
        this.rateLimiter.getResourceUsagePatterns(),
        this.rateLimiter.getMostLimitedUsers(20)
      ]);

      return {
        success: true,
        tier_distribution: tierDistribution,
        resource_usage: resourceUsage,
        most_limited_users: mostLimitedUsers,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error({ err: error }, 'Error getting system overview');
      return {
        success: false,
        error: 'internal_error',
        message: 'خطأ في تحميل النظرة العامة'
      };
    }
  }

  /**
   * تعيين حد ديناميكي (admin only)
   */
  async setDynamicLimit(adminId, tier, resource, newLimit) {
    if (adminId !== config.OWNER_ID) {
      return {
        success: false,
        error: 'unauthorized',
        message: 'غير مصرح'
      };
    }

    const result = this.rateLimiter.setDynamicLimit(tier, resource, newLimit);
    
    if (result.success) {
      logger.info({ adminId, tier, resource, newLimit }, 'Dynamic limit set');
    }

    return result;
  }

  /**
   * إدارة Whitelist
   */
  async manageWhitelist(adminId, userId, action) {
    if (adminId !== config.OWNER_ID) {
      return {
        success: false,
        error: 'unauthorized',
        message: 'غير مصرح'
      };
    }

    if (action === 'add') {
      return this.rateLimiter.addToWhitelist(userId, adminId);
    } else if (action === 'remove') {
      return this.rateLimiter.removeFromWhitelist(userId, adminId);
    }

    return {
      success: false,
      error: 'invalid_action',
      message: 'إجراء غير صحيح'
    };
  }

  /**
   * إدارة Blacklist
   */
  async manageBlacklist(adminId, userId, action, reason = '') {
    if (adminId !== config.OWNER_ID) {
      return {
        success: false,
        error: 'unauthorized',
        message: 'غير مصرح'
      };
    }

    if (action === 'add') {
      return this.rateLimiter.addToBlacklist(userId, adminId, reason);
    } else if (action === 'remove') {
      return this.rateLimiter.removeFromBlacklist(userId, adminId);
    }

    return {
      success: false,
      error: 'invalid_action',
      message: 'إجراء غير صحيح'
    };
  }

  /**
   * إعادة تعيين حدود المستخدم
   */
  async resetUserLimits(adminId, userId, resource = null) {
    if (adminId !== config.OWNER_ID) {
      return {
        success: false,
        error: 'unauthorized',
        message: 'غير مصرح'
      };
    }

    return await this.rateLimiter.resetRateLimit(userId, resource, adminId);
  }

  /**
   * البحث عن مستخدم والحصول على معلوماته
   */
  async searchUser(adminId, userId) {
    if (adminId !== config.OWNER_ID) {
      return {
        success: false,
        error: 'unauthorized',
        message: 'غير مصرح'
      };
    }

    try {
      const [user, tierStatus] = await Promise.all([
        db.getUser(userId),
        this.rateLimiter.getRateLimitStatus(userId)
      ]);

      if (!user) {
        return {
          success: false,
          error: 'user_not_found',
          message: 'المستخدم غير موجود'
        };
      }

      return {
        success: true,
        user,
        access_control: tierStatus
      };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error searching user');
      return {
        success: false,
        error: 'internal_error',
        message: 'خطأ في البحث'
      };
    }
  }

  // ===== UTILITY =====

  /**
   * التحقق من صلاحية الوصول دون استهلاك
   */
  async checkAccess(userId, resource, options = {}) {
    return await this.rateLimiter.checkRateLimit(userId, resource, options);
  }

  /**
   * الحصول على tier المستخدم
   */
  async getUserTier(userId) {
    return await this.rateLimiter.getUserTier(userId);
  }
}

// Singleton instance
const accessControl = new UserAccessControl();

module.exports = accessControl;
module.exports.UserAccessControl = UserAccessControl;
