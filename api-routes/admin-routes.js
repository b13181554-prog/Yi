/**
 * Admin API Routes
 * واجهات API للإدارة
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const accessControl = require('../user-access-control');
const { authenticateAPI } = require('../api-security');
const { createLogger } = require('../centralized-logger');

const logger = createLogger('admin-routes');

// Middleware to check admin access
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.body.user_id || req.query.user_id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }
    
    const tier = await accessControl.getUserTier(userId);
    
    if (tier !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden - Admin access required' 
      });
    }
    
    next();
  } catch (error) {
    logger.error(`Error checking admin access: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get All Users
router.post('/users', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.body;
    
    const users = await db.getAllUsersForAdmin({ page, limit, paginated: true });
    
    res.json({ success: true, users });
  } catch (error) {
    logger.error(`Error getting users: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Banned Users
router.post('/banned-users', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const users = await db.getBannedUsers();
    
    res.json({ success: true, users });
  } catch (error) {
    logger.error(`Error getting banned users: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ban User
router.post('/ban-user', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { target_user_id, reason } = req.body;
    
    if (!target_user_id) {
      return res.json({ success: false, error: 'User ID is required' });
    }
    
    await db.banUser(target_user_id, reason);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error banning user: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unban User
router.post('/unban-user', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { target_user_id } = req.body;
    
    if (!target_user_id) {
      return res.json({ success: false, error: 'User ID is required' });
    }
    
    await db.unbanUser(target_user_id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error unbanning user: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete User
router.post('/delete-user', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { target_user_id } = req.body;
    
    if (!target_user_id) {
      return res.json({ success: false, error: 'User ID is required' });
    }
    
    await db.deleteUserAccount(target_user_id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Stats
router.post('/stats', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const stats = {
      total_users: await db.getUserCount(),
      active_subscriptions: await db.getActiveSubscriptionsCount(),
      pending_withdrawals: await db.getPendingWithdrawalsCount(),
      recent_transactions: await db.getRecentTransactionsCount(24),
      total_analysts: await db.getAnalystsCount()
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Error getting stats: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Advanced Stats
router.post('/advanced-stats', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const transactionStats = await db.getTransactionStats();
    const referralStats = await db.getTotalReferralEarnings();
    
    const stats = {
      transactions: transactionStats,
      referrals: referralStats,
      recent_errors: await db.getRecentUserErrors(100),
      failed_payments: await db.getFailedPayments(50),
      failed_withdrawals: await db.getFailedWithdrawals(50)
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    logger.error(`Error getting advanced stats: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Analysts
router.post('/analysts', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const analysts = await db.getAllAnalysts();
    
    res.json({ success: true, analysts });
  } catch (error) {
    logger.error(`Error getting analysts: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Pending Withdrawals
router.post('/withdrawals', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const withdrawals = await db.getPendingWithdrawals();
    
    res.json({ success: true, withdrawals });
  } catch (error) {
    logger.error(`Error getting withdrawals: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve Withdrawal
router.post('/approve-withdrawal', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    
    if (!withdrawal_id) {
      return res.json({ success: false, error: 'Withdrawal ID is required' });
    }
    
    await db.approveWithdrawal(withdrawal_id);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error approving withdrawal: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject Withdrawal
router.post('/reject-withdrawal', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { withdrawal_id, reason } = req.body;
    
    if (!withdrawal_id) {
      return res.json({ success: false, error: 'Withdrawal ID is required' });
    }
    
    await db.rejectWithdrawal(withdrawal_id, reason);
    
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error rejecting withdrawal: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get All Transactions
router.post('/transactions', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.body;
    
    const transactions = await db.getAllTransactions({ page, limit, paginated: true });
    
    res.json({ success: true, transactions });
  } catch (error) {
    logger.error(`Error getting transactions: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Top Referrers
router.post('/top-referrers', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    const users = await db.getAllUsers({ limit });
    const topReferrers = users
      .filter(u => u.referral_count > 0)
      .sort((a, b) => b.referral_count - a.referral_count)
      .slice(0, limit);
    
    res.json({ success: true, referrers: topReferrers });
  } catch (error) {
    logger.error(`Error getting top referrers: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Broadcast Message
router.post('/broadcast', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.json({ success: false, error: 'Message is required' });
    }
    
    const bot = require('../bot');
    const users = await db.getAllUsers();
    
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        await bot.sendMessage(user.user_id, message);
        sent++;
      } catch (error) {
        failed++;
        logger.error(`Failed to send broadcast to ${user.user_id}: ${error.message}`);
      }
    }
    
    res.json({ success: true, sent, failed });
  } catch (error) {
    logger.error(`Error broadcasting message: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search Users
router.post('/search', authenticateAPI, requireAdmin, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.json({ success: false, error: 'Query is required' });
    }
    
    const users = await db.getAllUsers();
    const results = users.filter(u => 
      u.user_id.toString().includes(query) ||
      u.username?.toLowerCase().includes(query.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json({ success: true, results });
  } catch (error) {
    logger.error(`Error searching users: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
