/**
 * Automated Safety System
 * نظام أمان تلقائي لحماية المستخدمين والنظام
 * 
 * Features:
 * - Auto-detect and block suspicious activities
 * - Automated backup and recovery
 * - Health monitoring and auto-healing
 * - Fraud prevention
 * - Auto-escalation of critical issues
 * - Periodic security audits
 */

const { createLogger } = require('./centralized-logger');
const cron = require('node-cron');

const logger = createLogger('automated-safety');

class AutomatedSafetySystem {
  constructor() {
    this.monitors = new Map();
    this.alerts = [];
    this.maxAlerts = 500;
    
    this.thresholds = {
      failedWithdrawals: { count: 3, window: 3600000 },
      suspiciousLogins: { count: 5, window: 1800000 },
      rapidBalanceChanges: { amount: 5000, window: 300000 },
      databaseErrors: { count: 10, window: 600000 },
      apiErrors: { count: 50, window: 300000 }
    };
    
    this.autoActions = {
      suspicious_user: 'block_temporarily',
      critical_error: 'notify_admin_urgent',
      fraud_detected: 'freeze_account',
      system_overload: 'enable_rate_limiting'
    };
  }

  initialize() {
    this.db = require('./database');
    this.securitySystem = require('./advanced-security-system');
    this.actionSystem = require('./flexible-action-system');
    
    this.actionSystem.initialize();
    
    this.startMonitoring();
    this.scheduleAutomatedTasks();
    logger.info('✅ Automated Safety System initialized');
  }

  startMonitoring() {
    this.monitors.set('withdrawal_monitor', setInterval(() => {
      this.monitorWithdrawals();
    }, 60000));

    this.monitors.set('login_monitor', setInterval(() => {
      this.monitorLogins();
    }, 30000));

    this.monitors.set('balance_monitor', setInterval(() => {
      this.monitorBalanceChanges();
    }, 120000));

    this.monitors.set('system_health', setInterval(() => {
      this.checkSystemHealth();
    }, 300000));

    logger.info('✅ All monitors started');
  }

  scheduleAutomatedTasks() {
    cron.schedule('0 2 * * *', () => {
      this.performDailySecurityAudit();
    });

    cron.schedule('*/15 * * * *', () => {
      this.cleanupOldData();
    });

    cron.schedule('0 */6 * * *', () => {
      this.checkUserAccounts();
    });

    cron.schedule('*/5 * * * *', () => {
      this.detectAnomalies();
    });

    logger.info('✅ Automated tasks scheduled');
  }

  async monitorWithdrawals() {
    try {
      if (!this.db) return;
      
      const database = this.db.getDB();
      const withdrawals = database.collection('withdrawals');

      const window = Date.now() - this.thresholds.failedWithdrawals.window;

      const suspiciousUsers = await withdrawals.aggregate([
        {
          $match: {
            status: 'failed',
            created_at: { $gte: new Date(window) }
          }
        },
        {
          $group: {
            _id: '$user_id',
            failed_count: { $sum: 1 },
            total_amount: { $sum: '$amount' }
          }
        },
        {
          $match: {
            failed_count: { $gte: this.thresholds.failedWithdrawals.count }
          }
        }
      ]).toArray();

      for (const user of suspiciousUsers) {
        await this.handleSuspiciousActivity(user._id, {
          type: 'multiple_failed_withdrawals',
          count: user.failed_count,
          amount: user.total_amount
        });
      }

      if (suspiciousUsers.length > 0) {
        logger.warn({ count: suspiciousUsers.length }, '⚠️ Suspicious withdrawal activity detected');
      }
    } catch (error) {
      logger.error({ err: error }, '❌ Error monitoring withdrawals');
    }
  }

  async monitorLogins() {
    try {
      if (!this.db) return;
      
      const database = this.db.getDB();
      const events = database.collection('security_events');

      const window = Date.now() - this.thresholds.suspiciousLogins.window;

      const suspiciousUsers = await events.aggregate([
        {
          $match: {
            action: 'failed_login',
            timestamp: { $gte: window }
          }
        },
        {
          $group: {
            _id: '$user_id',
            failed_count: { $sum: 1 }
          }
        },
        {
          $match: {
            failed_count: { $gte: this.thresholds.suspiciousLogins.count }
          }
        }
      ]).toArray();

      for (const user of suspiciousUsers) {
        await this.handleSuspiciousActivity(user._id, {
          type: 'multiple_failed_logins',
          count: user.failed_count
        });
      }
    } catch (error) {
      logger.error({ err: error }, '❌ Error monitoring logins');
    }
  }

  async monitorBalanceChanges() {
    try {
      if (!this.db) return;
      
      const database = this.db.getDB();
      const earnings = database.collection('earnings');

      const window = Date.now() - this.thresholds.rapidBalanceChanges.window;

      const rapidChanges = await earnings.aggregate([
        {
          $match: {
            timestamp: { $gte: window }
          }
        },
        {
          $group: {
            _id: '$user_id',
            total_change: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            total_change: { $gte: this.thresholds.rapidBalanceChanges.amount }
          }
        }
      ]).toArray();

      for (const user of rapidChanges) {
        await this.handleSuspiciousActivity(user._id, {
          type: 'rapid_balance_changes',
          amount: user.total_change,
          count: user.count
        });
      }
    } catch (error) {
      logger.error({ err: error }, '❌ Error monitoring balance changes');
    }
  }

  async checkSystemHealth() {
    try {
      logger.debug('🏥 System health check - monitoring basic metrics');
    } catch (error) {
      logger.error({ err: error }, '❌ Error checking system health');
    }
  }

  async handleSuspiciousActivity(userId, activity) {
    try {
      if (!this.securitySystem || !this.actionSystem) return { success: false, error: 'not_initialized' };
      
      const riskAnalysis = await this.securitySystem.analyzeUserBehavior(
        userId,
        activity.type,
        activity
      );

      if (riskAnalysis.risk_level === 'high' || riskAnalysis.risk_level === 'critical') {
        await this.securitySystem.blockUser(userId, '24h');

        await this.createAlert({
          level: 'high',
          type: 'user_blocked',
          user_id: userId,
          message: `تم حظر المستخدم ${userId} بسبب نشاط مشبوه`,
          details: { activity, riskAnalysis }
        });

        await this.actionSystem.executeAction('send_notification', {
          user_id: userId,
          message: '⚠️ تم حظر حسابك مؤقتاً بسبب نشاط مشبوه. يرجى التواصل مع الدعم.'
        });

        logger.warn({ userId, activity, riskAnalysis }, '🚨 Suspicious activity handled');
      }

      return { success: true, action_taken: riskAnalysis.risk_level };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error handling suspicious activity');
      return { success: false, error: error.message };
    }
  }

  async performDailySecurityAudit() {
    try {
      if (!this.db) return { success: false, error: 'not_initialized' };
      
      logger.info('🔍 Starting daily security audit');

      const database = this.db.getDB();
      const users = database.collection('users');
      const events = database.collection('security_events');

      const yesterday = new Date(Date.now() - 86400000);

      const [
        totalUsers,
        newUsers,
        blockedUsers,
        bannedUsers,
        highRiskEvents
      ] = await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ created_at: { $gte: yesterday } }),
        users.countDocuments({ blocked: true }),
        users.countDocuments({ banned: true }),
        events.countDocuments({
          risk_level: { $in: ['high', 'critical'] },
          created_at: { $gte: yesterday }
        })
      ]);

      const auditReport = {
        date: new Date(),
        total_users: totalUsers,
        new_users_24h: newUsers,
        blocked_users: blockedUsers,
        banned_users: bannedUsers,
        high_risk_events_24h: highRiskEvents
      };

      const audits = database.collection('security_audits');
      await audits.insertOne(auditReport);

      if (highRiskEvents > 10) {
        await this.notifyAdmin('تقرير الأمان اليومي', auditReport);
      }

      logger.info({ auditReport }, '✅ Daily security audit completed');

      return { success: true, report: auditReport };
    } catch (error) {
      logger.error({ err: error }, '❌ Error performing security audit');
      return { success: false, error: error.message };
    }
  }

  async cleanupOldData() {
    try {
      if (!this.db) return { success: false, error: 'not_initialized' };
      
      const database = this.db.getDB();

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

      const [eventsDeleted, logsDeleted] = await Promise.all([
        database.collection('security_events').deleteMany({
          created_at: { $lt: thirtyDaysAgo },
          risk_level: { $nin: ['high', 'critical'] }
        }),
        database.collection('action_executions').deleteMany({
          created_at: { $lt: thirtyDaysAgo }
        })
      ]);

      logger.info({ 
        eventsDeleted: eventsDeleted.deletedCount,
        logsDeleted: logsDeleted.deletedCount
      }, '🗑️ Old data cleaned up');

      return {
        success: true,
        deleted: {
          events: eventsDeleted.deletedCount,
          logs: logsDeleted.deletedCount
        }
      };
    } catch (error) {
      logger.error({ err: error }, '❌ Error cleaning up old data');
      return { success: false, error: error.message };
    }
  }

  async checkUserAccounts() {
    try {
      if (!this.db || !this.actionSystem) return { success: false, error: 'not_initialized' };
      
      const database = this.db.getDB();
      const users = database.collection('users');

      const now = new Date();

      const expiredBlocks = await users.find({
        blocked: true,
        block_until: { $lt: now }
      }).toArray();

      for (const user of expiredBlocks) {
        await users.updateOne(
          { user_id: user.user_id },
          { 
            $set: { blocked: false },
            $unset: { block_until: '', block_reason: '' }
          }
        );

        await this.actionSystem.executeAction('send_notification', {
          user_id: user.user_id,
          message: '✅ تم رفع الحظر عن حسابك. يمكنك الآن استخدام جميع الميزات.'
        });
      }

      if (expiredBlocks.length > 0) {
        logger.info({ count: expiredBlocks.length }, '🔓 Expired blocks removed');
      }

      return {
        success: true,
        unblocked: expiredBlocks.length
      };
    } catch (error) {
      logger.error({ err: error }, '❌ Error checking user accounts');
      return { success: false, error: error.message };
    }
  }

  async detectAnomalies() {
    try {
      if (!this.db) return { success: false, error: 'not_initialized' };
      
      const database = this.db.getDB();

      const fiveMinutesAgo = new Date(Date.now() - 300000);

      const recentWithdrawals = await database.collection('withdrawals')
        .countDocuments({ created_at: { $gte: fiveMinutesAgo } });

      if (recentWithdrawals > 50) {
        await this.createAlert({
          level: 'warning',
          type: 'anomaly_detected',
          message: 'عدد كبير من السحوبات في فترة قصيرة',
          details: { count: recentWithdrawals }
        });
      }

      const recentRegistrations = await database.collection('users')
        .countDocuments({ created_at: { $gte: fiveMinutesAgo } });

      if (recentRegistrations > 20) {
        await this.createAlert({
          level: 'warning',
          type: 'anomaly_detected',
          message: 'عدد كبير من التسجيلات في فترة قصيرة',
          details: { count: recentRegistrations }
        });
      }

      logger.debug('✅ Anomaly detection completed');

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, '❌ Error detecting anomalies');
      return { success: false, error: error.message };
    }
  }

  async createAlert(alertData) {
    try {
      if (!this.db) return { success: false, error: 'not_initialized' };
      
      const crypto = require('crypto');
      
      this.alerts.push({
        ...alertData,
        id: crypto.randomUUID(),
        created_at: new Date(),
        acknowledged: false
      });

      if (this.alerts.length > this.maxAlerts) {
        this.alerts.shift();
      }

      const database = this.db.getDB();
      const alerts = database.collection('safety_alerts');
      await alerts.insertOne(alertData);

      if (alertData.level === 'critical') {
        await this.notifyAdminUrgent(alertData.message, alertData.details);
      } else if (alertData.level === 'high') {
        await this.notifyAdmin(alertData.message, alertData.details);
      }

      logger.info({ alert: alertData }, '🚨 Alert created');

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, '❌ Error creating alert');
      throw error;
    }
  }

  async notifyAdmin(subject, details) {
    try {
      const config = require('./config');
      const bot = require('./bot');

      const message = `
📢 <b>${subject}</b>

${JSON.stringify(details, null, 2)}

⏰ ${new Date().toLocaleString('ar-EG')}
      `;

      await bot.sendMessage(config.OWNER_ID, message, { parse_mode: 'HTML' });

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error notifying admin');
    }
  }

  async notifyAdminUrgent(subject, details) {
    try {
      const config = require('./config');
      const bot = require('./bot');

      const message = `
🚨🚨🚨 <b>تنبيه عاجل!</b> 🚨🚨🚨

<b>${subject}</b>

${JSON.stringify(details, null, 2)}

⏰ ${new Date().toLocaleString('ar-EG')}

يتطلب تدخل فوري!
      `;

      await bot.sendMessage(config.OWNER_ID, message, { parse_mode: 'HTML' });

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error notifying admin urgently');
    }
  }

  getAlerts(filters = {}) {
    let filtered = [...this.alerts];

    if (filters.level) {
      filtered = filtered.filter(a => a.level === filters.level);
    }

    if (filters.type) {
      filtered = filtered.filter(a => a.type === filters.type);
    }

    if (filters.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === filters.acknowledged);
    }

    return {
      success: true,
      alerts: filtered.slice(0, filters.limit || 50),
      total: filtered.length
    };
  }

  stop() {
    for (const [name, monitor] of this.monitors.entries()) {
      clearInterval(monitor);
      logger.info({ name }, '🛑 Monitor stopped');
    }

    this.monitors.clear();
    logger.info('✅ All monitors stopped');
  }
}

const safetySystem = new AutomatedSafetySystem();

module.exports = safetySystem;
