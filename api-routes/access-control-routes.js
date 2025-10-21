/**
 * User Access Control API Routes
 * واجهات API لإدارة صلاحيات المستخدمين
 * 
 * Endpoints:
 * - GET  /api/access/dashboard - User dashboard
 * - GET  /api/access/status - Current limit status
 * - POST /api/access/admin/overview - System overview (admin)
 * - POST /api/access/admin/limits - Set dynamic limits (admin)
 * - POST /api/access/admin/whitelist - Manage whitelist (admin)
 * - POST /api/access/admin/blacklist - Manage blacklist (admin)
 * - POST /api/access/admin/reset - Reset user limits (admin)
 * - POST /api/access/admin/search - Search user (admin)
 */

const express = require('express');
const accessControl = require('../user-access-control');
const { authenticateAPI } = require('../api-security');
const { createLogger } = require('../centralized-logger');

const logger = createLogger('access-control-routes');
const router = express.Router();

// ===== USER ENDPOINTS =====

/**
 * الحصول على لوحة تحكم المستخدم
 * GET /api/access/dashboard?user_id=123
 */
router.get('/dashboard', authenticateAPI, async (req, res) => {
  try {
    const userId = req.query.user_id || req.body?.user_id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'user_id_required',
        message: 'معرف المستخدم مطلوب'
      });
    }

    const dashboard = await accessControl.getUserDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    logger.error({ err: error }, 'Error getting user dashboard');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل لوحة التحكم'
    });
  }
});

/**
 * الحصول على حالة الحدود الحالية
 * GET /api/access/status?user_id=123&resource=analysis
 */
router.get('/status', authenticateAPI, async (req, res) => {
  try {
    const { user_id, resource } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id_required',
        message: 'معرف المستخدم مطلوب'
      });
    }

    const tier = await accessControl.getUserTier(user_id);
    const status = await accessControl.checkAccess(user_id, resource || null);

    res.json({
      success: true,
      tier,
      status
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting limit status');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل الحالة'
    });
  }
});

// ===== ADMIN ENDPOINTS =====

/**
 * الحصول على نظرة عامة على النظام
 * POST /api/access/admin/overview
 */
router.post('/admin/overview', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    const overview = await accessControl.getSystemOverview(user_id);
    res.json(overview);
  } catch (error) {
    logger.error({ err: error }, 'Error getting system overview');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تحميل النظرة العامة'
    });
  }
});

/**
 * تعيين حدود ديناميكية
 * POST /api/access/admin/limits
 * Body: { user_id: admin_id, tier: 'free', resource: 'analysis', limit: { count: 20, window: 3600, cost: 1 } }
 */
router.post('/admin/limits', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id, tier, resource, limit } = req.body;

    if (!tier || !resource || !limit) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'tier و resource و limit مطلوبة'
      });
    }

    const result = await accessControl.setDynamicLimit(user_id, tier, resource, limit);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error setting dynamic limit');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في تعيين الحد'
    });
  }
});

/**
 * إدارة القائمة البيضاء
 * POST /api/access/admin/whitelist
 * Body: { user_id: admin_id, target_user_id: 123, action: 'add'|'remove' }
 */
router.post('/admin/whitelist', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id, target_user_id, action } = req.body;

    if (!target_user_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'target_user_id و action مطلوبة'
      });
    }

    const result = await accessControl.manageWhitelist(user_id, target_user_id, action);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error managing whitelist');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في إدارة القائمة البيضاء'
    });
  }
});

/**
 * إدارة القائمة السوداء
 * POST /api/access/admin/blacklist
 * Body: { user_id: admin_id, target_user_id: 123, action: 'add'|'remove', reason: 'abuse' }
 */
router.post('/admin/blacklist', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id, target_user_id, action, reason } = req.body;

    if (!target_user_id || !action) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'target_user_id و action مطلوبة'
      });
    }

    const result = await accessControl.manageBlacklist(user_id, target_user_id, action, reason);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error managing blacklist');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في إدارة القائمة السوداء'
    });
  }
});

/**
 * إعادة تعيين حدود المستخدم
 * POST /api/access/admin/reset
 * Body: { user_id: admin_id, target_user_id: 123, resource: 'analysis' (optional) }
 */
router.post('/admin/reset', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id, target_user_id, resource } = req.body;

    if (!target_user_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'target_user_id مطلوب'
      });
    }

    const result = await accessControl.resetUserLimits(user_id, target_user_id, resource);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error resetting user limits');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في إعادة تعيين الحدود'
    });
  }
});

/**
 * البحث عن مستخدم
 * POST /api/access/admin/search
 * Body: { user_id: admin_id, target_user_id: 123 }
 */
router.post('/admin/search', authenticateAPI, accessControl.requireAdmin, async (req, res) => {
  try {
    const { user_id, target_user_id } = req.body;

    if (!target_user_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'target_user_id مطلوب'
      });
    }

    const result = await accessControl.searchUser(user_id, target_user_id);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error searching user');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في البحث'
    });
  }
});

module.exports = router;
