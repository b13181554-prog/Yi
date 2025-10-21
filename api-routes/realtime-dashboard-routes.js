/**
 * Real-time Dashboard API Routes
 * واجهات API للوحة التحكم في الوقت الفعلي
 * 
 * Features:
 * - Server-Sent Events (SSE) for live updates
 * - Real-time user statistics
 * - System monitoring
 * - Live usage tracking
 */

const express = require('express');
const accessControl = require('../user-access-control');
const db = require('../database');
const { authenticateAPI, authenticateSSE } = require('../api-security');
const { createLogger } = require('../centralized-logger');

const logger = createLogger('realtime-dashboard');
const router = express.Router();

// Store active SSE connections
const sseClients = new Map();

/**
 * SSE endpoint for real-time dashboard updates
 * GET /api/realtime/dashboard/:userId?init_data=xxx
 */
router.get('/dashboard/:userId', authenticateSSE, async (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.auth.user_id;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'user_id_required'
    });
  }

  if (authenticatedUserId !== userId) {
    const tier = await accessControl.getUserTier(authenticatedUserId);
    if (tier !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'غير مصرح لك بعرض بيانات مستخدم آخر'
      });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `${userId}-${Date.now()}`;
  sseClients.set(clientId, { userId, res });

  logger.info({ userId, clientId }, 'SSE client connected');

  const sendUpdate = async () => {
    try {
      const dashboard = await accessControl.getUserDashboard(userId);
      
      if (dashboard.success) {
        res.write(`data: ${JSON.stringify({
          type: 'dashboard_update',
          timestamp: new Date().toISOString(),
          data: dashboard
        })}\n\n`);
      }
    } catch (error) {
      logger.error({ err: error, userId }, 'Error sending SSE update');
    }
  };

  await sendUpdate();
  const updateInterval = setInterval(sendUpdate, 10000);

  req.on('close', () => {
    clearInterval(updateInterval);
    sseClients.delete(clientId);
    logger.info({ userId, clientId }, 'SSE client disconnected');
  });
});

/**
 * SSE endpoint for admin system monitoring
 * GET /api/realtime/admin/system?init_data=xxx
 */
router.get('/admin/system', authenticateSSE, async (req, res) => {
  const adminId = req.auth.user_id;

  const tier = await accessControl.getUserTier(adminId);
  if (tier !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'forbidden',
      message: 'غير مصرح - Admin فقط'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `admin-${adminId}-${Date.now()}`;
  sseClients.set(clientId, { adminId, res, isAdmin: true });

  logger.info({ adminId, clientId }, 'Admin SSE client connected');

  const sendUpdate = async () => {
    try {
      const [overview, stats] = await Promise.all([
        accessControl.getSystemOverview(adminId),
        getSystemStats()
      ]);

      if (overview.success) {
        res.write(`data: ${JSON.stringify({
          type: 'system_update',
          timestamp: new Date().toISOString(),
          data: {
            overview,
            stats
          }
        })}\n\n`);
      }
    } catch (error) {
      logger.error({ err: error, adminId }, 'Error sending admin SSE update');
    }
  };

  await sendUpdate();
  const updateInterval = setInterval(sendUpdate, 5000);

  req.on('close', () => {
    clearInterval(updateInterval);
    sseClients.delete(clientId);
    logger.info({ adminId, clientId }, 'Admin SSE client disconnected');
  });
});

/**
 * Get current connected clients count
 * GET /api/realtime/stats
 */
router.get('/stats', (req, res) => {
  const stats = {
    total_connections: sseClients.size,
    user_connections: Array.from(sseClients.values()).filter(c => !c.isAdmin).length,
    admin_connections: Array.from(sseClients.values()).filter(c => c.isAdmin).length,
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    stats
  });
});

/**
 * Broadcast message to all connected clients (admin only)
 * POST /api/realtime/broadcast
 * Body: { message, target }
 */
router.post('/broadcast', authenticateAPI, async (req, res) => {
  try {
    const adminId = req.auth?.user_id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'التوثيق غير صحيح - لا يوجد معرف مستخدم'
      });
    }

    const { message, target } = req.body;

    const tier = await accessControl.getUserTier(adminId);
    if (tier !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'غير مصرح - Admin فقط'
      });
    }

    let count = 0;
    for (const [clientId, client] of sseClients.entries()) {
      if (target === 'all' || (target === 'users' && !client.isAdmin) || (target === 'admins' && client.isAdmin)) {
        try {
          client.res.write(`data: ${JSON.stringify({
            type: 'broadcast',
            timestamp: new Date().toISOString(),
            message
          })}\n\n`);
          count++;
        } catch (error) {
          logger.error({ err: error, clientId }, 'Error broadcasting to client');
        }
      }
    }

    res.json({
      success: true,
      message: `تم إرسال الرسالة إلى ${count} عميل`,
      count
    });
  } catch (error) {
    logger.error({ err: error }, 'Error broadcasting message');
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'خطأ في إرسال الرسالة'
    });
  }
});

/**
 * Get system statistics
 */
async function getSystemStats() {
  try {
    const db_instance = db.getDB();
    
    if (!db_instance) {
      return {
        error: 'database_not_connected'
      };
    }

    const [
      totalUsers,
      activeSubscriptions,
      totalAnalysts,
      recentTransactions
    ] = await Promise.all([
      db_instance.collection('users').countDocuments(),
      db_instance.collection('users').countDocuments({
        subscription_expires: { $gt: new Date() }
      }),
      db_instance.collection('analysts').countDocuments({ is_active: true }),
      db_instance.collection('transactions').countDocuments({
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    return {
      total_users: totalUsers,
      active_subscriptions: activeSubscriptions,
      total_analysts: totalAnalysts,
      recent_transactions_24h: recentTransactions,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error({ err: error }, 'Error getting system stats');
    return {
      error: 'failed_to_get_stats'
    };
  }
}

module.exports = router;
