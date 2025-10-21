/**
 * Feature Flags Middleware
 * Middleware للتحكم في الوصول للـ routes بناءً على Feature Flags
 * 
 * Features:
 * - requireFeature(flagKey, options) - حماية routes
 * - Returns 403 when feature disabled
 * - Attaches evaluation result to request
 */

const featureFlagService = require('../services/feature-flags');
const { createLogger } = require('../centralized-logger');

const logger = createLogger('feature-flags-middleware');

function requireFeature(flagKey, options = {}) {
  return async (req, res, next) => {
    try {
      const userId = req.body?.user_id || req.query?.user_id || req.headers['x-user-id'];
      const tier = req.body?.tier || req.query?.tier || req.rateLimitInfo?.tier || 'free';

      const userContext = {
        userId: userId ? parseInt(userId) : null,
        tier
      };

      const evaluation = await featureFlagService.evaluateFlag(flagKey, userContext);

      req.featureFlag = {
        key: flagKey,
        evaluation
      };

      if (!evaluation.enabled) {
        logger.warn({ 
          flagKey, 
          userId, 
          tier, 
          reason: evaluation.reason 
        }, '⚠️ Feature access denied');

        const responseMessage = options.customMessage || 'هذه الميزة غير متاحة حالياً';
        const responseCode = options.statusCode || 403;

        return res.status(responseCode).json({
          success: false,
          error: 'feature_disabled',
          message: responseMessage,
          feature_key: flagKey,
          reason: evaluation.reason,
          details: options.includeDetails ? evaluation : undefined
        });
      }

      logger.debug({ 
        flagKey, 
        userId, 
        tier, 
        source: evaluation.source 
      }, '✅ Feature access granted');

      next();
    } catch (error) {
      logger.error({ err: error, flagKey }, '❌ Error in feature flag middleware');
      
      if (options.failOpen) {
        logger.warn({ flagKey }, '⚠️ Failing open - allowing access despite error');
        next();
      } else {
        res.status(500).json({
          success: false,
          error: 'feature_check_failed',
          message: 'خطأ في التحقق من الميزة'
        });
      }
    }
  };
}

function attachFeatureContext(req, res, next) {
  const userId = req.body?.user_id || req.query?.user_id || req.headers['x-user-id'];
  const tier = req.body?.tier || req.query?.tier || req.rateLimitInfo?.tier || 'free';

  req.featureContext = {
    userId: userId ? parseInt(userId) : null,
    tier,
    checkFeature: async (flagKey) => {
      return await featureFlagService.evaluateFlag(flagKey, {
        userId: userId ? parseInt(userId) : null,
        tier
      });
    }
  };

  next();
}

module.exports = {
  requireFeature,
  attachFeatureContext
};
