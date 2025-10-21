/**
 * Feature Flags Service
 * نظام متكامل للتحكم الديناميكي في الميزات بدون إعادة نشر
 * 
 * Features:
 * - MongoDB + Redis caching
 * - Global, per-tier, per-user flags
 * - Percentage-based rollout with deterministic hashing
 * - Priority: user override > tier > global
 * - Cache invalidation
 */

const { createLogger } = require('../centralized-logger');
const cacheManager = require('../cache-manager');
const crypto = require('crypto');

const logger = createLogger('feature-flags');

class FeatureFlagService {
  constructor() {
    this.db = null;
    this.collection = null;
    this.initialized = false;
    this.CACHE_PREFIX = 'feature_flag:';
    this.CACHE_TTL = 300; // 5 minutes
  }

  async initialize(db) {
    if (this.initialized) return;
    
    try {
      this.db = db;
      this.collection = db.collection('feature_flags');
      
      await this.createIndexes();
      this.initialized = true;
      logger.info('✅ Feature Flags Service initialized');
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to initialize Feature Flags Service');
      throw error;
    }
  }

  async createIndexes() {
    try {
      await this.collection.createIndex({ key: 1, scope: 1 }, { unique: true });
      await this.collection.createIndex({ key: 1 });
      await this.collection.createIndex({ scope: 1 });
      await this.collection.createIndex({ updated_at: -1 });
      await this.collection.createIndex({ enabled: 1 });
      logger.info('✅ Feature flags indexes created');
    } catch (error) {
      if (error.code === 85 || error.code === 86) {
        logger.info('ℹ️ Feature flags indexes already exist');
      } else {
        throw error;
      }
    }
  }

  getCacheKey(key, scope, target = null) {
    if (target) {
      return `${this.CACHE_PREFIX}${key}:${scope}:${target}`;
    }
    return `${this.CACHE_PREFIX}${key}:${scope}`;
  }

  async getFlag(key, scope = 'global', target = null) {
    try {
      const cacheKey = this.getCacheKey(key, scope, target);
      const cached = await cacheManager.get(cacheKey);
      
      if (cached !== null) {
        logger.debug({ key, scope, target }, '📦 Feature flag cache hit');
        return cached;
      }

      const query = { key, scope };
      if (target) {
        query.target = target;
      }

      const flag = await this.collection.findOne(query);
      
      if (flag) {
        await cacheManager.set(cacheKey, flag, this.CACHE_TTL);
      }
      
      return flag;
    } catch (error) {
      logger.error({ err: error, key, scope }, '❌ Error getting feature flag');
      return null;
    }
  }

  hashUserId(userId, key) {
    const hash = crypto.createHash('md5').update(`${userId}:${key}`).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % 100;
  }

  async evaluateFlag(key, userContext = {}) {
    try {
      const { userId, tier = 'free' } = userContext;

      let userFlag = null;
      if (userId) {
        userFlag = await this.getFlag(key, 'user', userId.toString());
      }

      const tierFlag = await this.getFlag(key, 'tier', tier);
      const globalFlag = await this.getFlag(key, 'global');

      const effectiveFlag = userFlag || tierFlag || globalFlag;

      if (!effectiveFlag) {
        logger.debug({ key, userId, tier }, '🚫 Feature flag not found - defaulting to disabled');
        return {
          enabled: false,
          reason: 'flag_not_found',
          source: 'default'
        };
      }

      if (!effectiveFlag.enabled) {
        return {
          enabled: false,
          reason: 'flag_disabled',
          source: userFlag ? 'user' : tierFlag ? 'tier' : 'global',
          flag: effectiveFlag
        };
      }

      if (effectiveFlag.rollout && effectiveFlag.rollout.percentage < 100) {
        if (!userId) {
          return {
            enabled: false,
            reason: 'rollout_requires_user_id',
            source: userFlag ? 'user' : tierFlag ? 'tier' : 'global',
            flag: effectiveFlag
          };
        }

        const userHash = this.hashUserId(userId, key);
        const inRollout = userHash < effectiveFlag.rollout.percentage;

        if (!inRollout) {
          logger.debug({ key, userId, userHash, percentage: effectiveFlag.rollout.percentage }, 
            '🎲 User not in rollout percentage');
          return {
            enabled: false,
            reason: 'not_in_rollout',
            source: userFlag ? 'user' : tierFlag ? 'tier' : 'global',
            flag: effectiveFlag,
            rollout: {
              percentage: effectiveFlag.rollout.percentage,
              userHash
            }
          };
        }

        logger.debug({ key, userId, userHash, percentage: effectiveFlag.rollout.percentage }, 
          '✅ User in rollout percentage');
      }

      logger.info({ key, userId, tier, source: userFlag ? 'user' : tierFlag ? 'tier' : 'global' }, 
        '✅ Feature flag enabled');

      return {
        enabled: true,
        reason: 'enabled',
        source: userFlag ? 'user' : tierFlag ? 'tier' : 'global',
        flag: effectiveFlag
      };
    } catch (error) {
      logger.error({ err: error, key, userContext }, '❌ Error evaluating feature flag');
      return {
        enabled: false,
        reason: 'evaluation_error',
        error: error.message
      };
    }
  }

  async setFlag(key, scope, config) {
    try {
      const {
        target = null,
        enabled = true,
        rollout = null,
        metadata = {}
      } = config;

      const now = new Date();
      const flagData = {
        key,
        scope,
        enabled,
        rollout: rollout ? {
          percentage: Math.max(0, Math.min(100, rollout.percentage || 100)),
          strategy: rollout.strategy || 'percentage'
        } : null,
        metadata: {
          ...metadata,
          updated_at: now,
          updated_by: config.updated_by || 'system'
        },
        created_at: now,
        updated_at: now
      };

      if (target) {
        flagData.target = target;
      }

      const query = { key, scope };
      if (target) {
        query.target = target;
      }

      const result = await this.collection.updateOne(
        query,
        { 
          $set: flagData,
          $setOnInsert: { created_at: now }
        },
        { upsert: true }
      );

      await this.invalidateCache(key, scope, target);

      logger.info({ key, scope, target, enabled }, '✅ Feature flag set');

      return {
        success: true,
        flag: flagData,
        upserted: result.upsertedCount > 0,
        modified: result.modifiedCount > 0
      };
    } catch (error) {
      logger.error({ err: error, key, scope }, '❌ Error setting feature flag');
      throw error;
    }
  }

  async deleteFlag(key, scope, target = null) {
    try {
      const query = { key, scope };
      if (target) {
        query.target = target;
      }

      const result = await this.collection.deleteOne(query);
      await this.invalidateCache(key, scope, target);

      logger.info({ key, scope, target, deleted: result.deletedCount }, '🗑️ Feature flag deleted');

      return {
        success: true,
        deleted: result.deletedCount > 0
      };
    } catch (error) {
      logger.error({ err: error, key, scope }, '❌ Error deleting feature flag');
      throw error;
    }
  }

  async invalidateCache(key, scope = null, target = null) {
    try {
      if (scope && target) {
        const cacheKey = this.getCacheKey(key, scope, target);
        await cacheManager.del(cacheKey);
      } else if (scope) {
        await cacheManager.clearPattern(`${this.CACHE_PREFIX}${key}:${scope}:*`);
      } else {
        await cacheManager.clearPattern(`${this.CACHE_PREFIX}${key}:*`);
      }
      
      logger.debug({ key, scope, target }, '🗑️ Feature flag cache invalidated');
    } catch (error) {
      logger.error({ err: error, key }, '❌ Error invalidating cache');
    }
  }

  async listFlags(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        scope = null,
        enabled = null,
        key = null
      } = options;

      const query = {};
      if (scope) query.scope = scope;
      if (enabled !== null) query.enabled = enabled;
      if (key) query.key = new RegExp(key, 'i');

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [totalCount, flags] = await Promise.all([
        this.collection.countDocuments(query),
        this.collection
          .find(query)
          .sort({ updated_at: -1 })
          .skip(skip)
          .limit(limitNum)
          .toArray()
      ]);

      return {
        success: true,
        data: flags,
        pagination: {
          current_page: pageNum,
          page_size: limitNum,
          total_items: totalCount,
          total_pages: Math.ceil(totalCount / limitNum),
          has_next: pageNum < Math.ceil(totalCount / limitNum),
          has_prev: pageNum > 1
        }
      };
    } catch (error) {
      logger.error({ err: error }, '❌ Error listing feature flags');
      throw error;
    }
  }

  async updateRolloutPercentage(key, scope, target, percentage) {
    try {
      const query = { key, scope };
      if (target) {
        query.target = target;
      }

      const validPercentage = Math.max(0, Math.min(100, percentage));

      const result = await this.collection.updateOne(
        query,
        {
          $set: {
            'rollout.percentage': validPercentage,
            updated_at: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'flag_not_found'
        };
      }

      await this.invalidateCache(key, scope, target);

      logger.info({ key, scope, target, percentage: validPercentage }, 
        '✅ Rollout percentage updated');

      return {
        success: true,
        percentage: validPercentage
      };
    } catch (error) {
      logger.error({ err: error, key, scope }, '❌ Error updating rollout percentage');
      throw error;
    }
  }

  async getFlagsByTier(tier) {
    try {
      const [tierFlags, globalFlags] = await Promise.all([
        this.collection.find({ scope: 'tier', target: tier }).toArray(),
        this.collection.find({ scope: 'global' }).toArray()
      ]);

      return {
        success: true,
        tier_flags: tierFlags,
        global_flags: globalFlags,
        effective_flags: this.mergeFlags(globalFlags, tierFlags)
      };
    } catch (error) {
      logger.error({ err: error, tier }, '❌ Error getting flags by tier');
      throw error;
    }
  }

  mergeFlags(globalFlags, tierFlags) {
    const flagMap = new Map();
    
    globalFlags.forEach(flag => {
      flagMap.set(flag.key, { ...flag, source: 'global' });
    });
    
    tierFlags.forEach(flag => {
      flagMap.set(flag.key, { ...flag, source: 'tier' });
    });
    
    return Array.from(flagMap.values());
  }

  async getStats() {
    try {
      const [total, enabled, disabled, byScope] = await Promise.all([
        this.collection.countDocuments({}),
        this.collection.countDocuments({ enabled: true }),
        this.collection.countDocuments({ enabled: false }),
        this.collection.aggregate([
          {
            $group: {
              _id: '$scope',
              count: { $sum: 1 },
              enabled: {
                $sum: { $cond: [{ $eq: ['$enabled', true] }, 1, 0] }
              }
            }
          }
        ]).toArray()
      ]);

      return {
        success: true,
        stats: {
          total,
          enabled,
          disabled,
          by_scope: byScope.reduce((acc, item) => {
            acc[item._id] = {
              total: item.count,
              enabled: item.enabled,
              disabled: item.count - item.enabled
            };
            return acc;
          }, {})
        }
      };
    } catch (error) {
      logger.error({ err: error }, '❌ Error getting feature flags stats');
      throw error;
    }
  }
}

const featureFlagService = new FeatureFlagService();

module.exports = featureFlagService;
