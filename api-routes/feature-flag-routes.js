/**
 * Feature Flags API Routes
 * واجهات API لإدارة Feature Flags
 * 
 * Endpoints:
 * - GET  /api/feature-flags - List all flags (admin)
 * - POST /api/feature-flags - Create new flag (admin)
 * - PUT  /api/feature-flags/:key - Update flag (admin)
 * - DELETE /api/feature-flags/:key - Delete flag (admin)
 * - POST /api/feature-flags/evaluate - Evaluate flag for user
 * - POST /api/feature-flags/rollout - Update rollout percentage (admin)
 * - POST /api/feature-flags/invalidate - Invalidate cache (admin)
 * - GET  /api/feature-flags/stats - Get statistics (admin)
 * - GET  /api/feature-flags/tier/:tier - Get flags by tier (admin)
 */

const express = require('express');
const featureFlagService = require('../services/feature-flags');
const accessControl = require('../user-access-control');
const { authenticateAPI } = require('../api-security');
const { createLogger } = require('../centralized-logger');

const logger = createLogger('feature-flag-routes');
const router = express.Router();

router.get('/', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { page, limit, scope, enabled, key } = req.query;

    const result = await featureFlagService.listFlags({
      page,
      limit,
      scope,
      enabled: enabled !== undefined ? enabled === 'true' : null,
      key
    });

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error listing feature flags');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل Feature Flags'
    });
  }
});

router.post('/', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { key, scope, target, enabled, rollout, metadata } = req.body;
    const adminId = req.body.user_id || req.query.user_id;

    if (!key || !scope) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'key و scope مطلوبان'
      });
    }

    const validScopes = ['global', 'tier', 'user'];
    if (!validScopes.includes(scope)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_scope',
        message: 'scope يجب أن يكون global أو tier أو user'
      });
    }

    if ((scope === 'tier' || scope === 'user') && !target) {
      return res.status(400).json({
        success: false,
        error: 'missing_target',
        message: `target مطلوب عند استخدام scope=${scope}`
      });
    }

    const result = await featureFlagService.setFlag(key, scope, {
      target,
      enabled: enabled !== undefined ? enabled : true,
      rollout,
      metadata: {
        ...metadata,
        created_by_admin: adminId
      },
      updated_by: adminId
    });

    logger.info({ key, scope, target, adminId }, '✅ Feature flag created/updated');

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error creating feature flag');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في إنشاء Feature Flag'
    });
  }
});

router.put('/:key', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { scope, target, enabled, rollout, metadata } = req.body;
    const adminId = req.body.user_id || req.query.user_id;

    if (!scope) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'scope مطلوب'
      });
    }

    const result = await featureFlagService.setFlag(key, scope, {
      target,
      enabled,
      rollout,
      metadata,
      updated_by: adminId
    });

    logger.info({ key, scope, target, adminId }, '✅ Feature flag updated');

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error updating feature flag');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحديث Feature Flag'
    });
  }
});

router.delete('/:key', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { scope, target } = req.query;
    const adminId = req.body.user_id || req.query.user_id;

    if (!scope) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'scope مطلوب'
      });
    }

    const result = await featureFlagService.deleteFlag(key, scope, target);

    logger.info({ key, scope, target, adminId }, '🗑️ Feature flag deleted');

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error deleting feature flag');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في حذف Feature Flag'
    });
  }
});

router.post('/evaluate', authenticateAPI, async (req, res) => {
  try {
    const { key, user_id, tier } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'key مطلوب'
      });
    }

    const userContext = {
      userId: user_id ? parseInt(user_id) : null,
      tier: tier || 'free'
    };

    const evaluation = await featureFlagService.evaluateFlag(key, userContext);

    res.json({
      success: true,
      key,
      evaluation
    });
  } catch (error) {
    logger.error({ err: error }, 'Error evaluating feature flag');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تقييم Feature Flag'
    });
  }
});

router.post('/rollout', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { key, scope, target, percentage } = req.body;
    const adminId = req.body.user_id || req.query.user_id;

    if (!key || !scope || percentage === undefined) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'key و scope و percentage مطلوبان'
      });
    }

    const result = await featureFlagService.updateRolloutPercentage(
      key,
      scope,
      target || null,
      percentage
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    logger.info({ key, scope, target, percentage, adminId }, '✅ Rollout percentage updated');

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error updating rollout percentage');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحديث نسبة الطرح'
    });
  }
});

router.post('/invalidate', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { key, scope, target } = req.body;
    const adminId = req.body.user_id || req.query.user_id;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'key مطلوب'
      });
    }

    await featureFlagService.invalidateCache(key, scope, target);

    logger.info({ key, scope, target, adminId }, '🗑️ Cache invalidated');

    res.json({
      success: true,
      message: 'تم مسح الـ cache بنجاح'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error invalidating cache');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في مسح الـ cache'
    });
  }
});

router.get('/stats', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const stats = await featureFlagService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Error getting feature flags stats');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل الإحصائيات'
    });
  }
});

router.get('/tier/:tier', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { tier } = req.params;

    const validTiers = ['free', 'basic', 'vip', 'analyst', 'admin'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_tier',
        message: 'tier غير صحيح'
      });
    }

    const result = await featureFlagService.getFlagsByTier(tier);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error getting flags by tier');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل Flags حسب الـ tier'
    });
  }
});

module.exports = router;
