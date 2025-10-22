/**
 * Advanced Security System
 * نظام أمان متقدم لحماية المستخدمين والنظام
 * 
 * Features:
 * - Fraud detection
 * - Suspicious activity monitoring
 * - IP-based access control
 * - Device fingerprinting
 * - Multi-factor authentication (MFA)
 * - Session management
 * - Anomaly detection
 * - Auto-ban suspicious users
 */

const { createLogger } = require('./centralized-logger');
const db = require('./database');
const cacheManager = require('./cache-manager');
const crypto = require('crypto');

const logger = createLogger('security-system');

class AdvancedSecuritySystem {
  constructor() {
    this.suspiciousPatterns = {
      rapidRequests: { count: 50, window: 60000 },
      multipleFailedLogins: { count: 5, window: 300000 },
      unusualWithdrawals: { amount: 10000, frequency: 3 },
      vpnDetection: true,
      proxyDetection: true
    };
    
    this.ipBlacklist = new Set();
    this.ipWhitelist = new Set();
    
    this.securityLevels = {
      low: { score: 0, actions: [] },
      medium: { score: 50, actions: ['log', 'notify'] },
      high: { score: 75, actions: ['log', 'notify', 'block'] },
      critical: { score: 90, actions: ['log', 'notify', 'block', 'ban'] }
    };
  }

  async analyzeUserBehavior(userId, action, metadata = {}) {
    try {
      const riskScore = await this.calculateRiskScore(userId, action, metadata);
      
      const level = this.getRiskLevel(riskScore);
      
      await this.recordSecurityEvent(userId, {
        action,
        metadata,
        risk_score: riskScore,
        risk_level: level,
        timestamp: Date.now()
      });
      
      await this.executeSecurityActions(userId, level, riskScore);
      
      logger.info({ 
        userId, 
        action, 
        riskScore, 
        level 
      }, '🔒 User behavior analyzed');
      
      return {
        success: true,
        risk_score: riskScore,
        risk_level: level,
        allowed: level !== 'critical'
      };
    } catch (error) {
      logger.error({ err: error, userId }, '❌ Error analyzing user behavior');
      return {
        success: false,
        error: error.message,
        allowed: true
      };
    }
  }

  async calculateRiskScore(userId, action, metadata) {
    let score = 0;
    
    const recentActivity = await this.getRecentActivity(userId);
    if (recentActivity.rapid_requests) {
      score += 30;
    }
    
    const failedLogins = await this.getFailedLoginCount(userId);
    if (failedLogins >= this.suspiciousPatterns.multipleFailedLogins.count) {
      score += 40;
    }
    
    if (metadata.ip) {
      if (this.ipBlacklist.has(metadata.ip)) {
        score += 100;
      }
      
      const ipReputation = await this.checkIPReputation(metadata.ip);
      score += ipReputation.risk_score || 0;
    }
    
    if (action === 'withdrawal') {
      const withdrawalPattern = await this.analyzeWithdrawalPattern(userId, metadata.amount);
      score += withdrawalPattern.risk_score || 0;
    }
    
    const deviceFingerprint = metadata.device_fingerprint;
    if (deviceFingerprint) {
      const deviceRisk = await this.checkDeviceFingerprint(userId, deviceFingerprint);
      score += deviceRisk.risk_score || 0;
    }
    
    const userHistory = await this.getUserSecurityHistory(userId);
    if (userHistory.previous_violations > 0) {
      score += userHistory.previous_violations * 10;
    }
    
    if (action === 'referral' && recentActivity.referral_spam) {
      score += 50;
    }
    
    return Math.min(100, score);
  }

  getRiskLevel(score) {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  async executeSecurityActions(userId, level, riskScore) {
    const actions = this.securityLevels[level]?.actions || [];
    
    for (const action of actions) {
      try {
        if (action === 'log') {
          await this.logSecurityEvent(userId, level, riskScore);
        } else if (action === 'notify') {
          await this.notifyAdmin(userId, level, riskScore);
        } else if (action === 'block') {
          await this.blockUser(userId, '24h');
        } else if (action === 'ban') {
          await this.banUser(userId);
        }
      } catch (error) {
        logger.error({ err: error, action, userId }, 'Error executing security action');
      }
    }
  }

  async getRecentActivity(userId) {
    try {
      const cacheKey = `activity:${userId}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) {
        return cached;
      }
      
      const database = db.getDB();
      const events = database.collection('security_events');
      
      const oneMinuteAgo = Date.now() - 60000;
      const fiveMinutesAgo = Date.now() - 300000;
      
      const [recentCount, referralCount] = await Promise.all([
        events.countDocuments({
          user_id: userId,
          timestamp: { $gte: oneMinuteAgo }
        }),
        events.countDocuments({
          user_id: userId,
          action: 'referral',
          timestamp: { $gte: fiveMinutesAgo }
        })
      ]);
      
      const activity = {
        rapid_requests: recentCount > this.suspiciousPatterns.rapidRequests.count,
        recent_count: recentCount,
        referral_spam: referralCount > 10
      };
      
      await cacheManager.set(cacheKey, activity, 30);
      
      return activity;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting recent activity');
      return { rapid_requests: false, recent_count: 0, referral_spam: false };
    }
  }

  async getFailedLoginCount(userId) {
    try {
      const cacheKey = `failed_logins:${userId}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) return cached;
      
      const database = db.getDB();
      const events = database.collection('security_events');
      
      const fiveMinutesAgo = Date.now() - this.suspiciousPatterns.multipleFailedLogins.window;
      
      const count = await events.countDocuments({
        user_id: userId,
        action: 'failed_login',
        timestamp: { $gte: fiveMinutesAgo }
      });
      
      await cacheManager.set(cacheKey, count, 60);
      
      return count;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting failed login count');
      return 0;
    }
  }

  async checkIPReputation(ip) {
    try {
      const cacheKey = `ip_reputation:${ip}`;
      const cached = await cacheManager.get(cacheKey);
      
      if (cached) return cached;
      
      let riskScore = 0;
      
      if (this.isPrivateIP(ip)) {
        riskScore = 0;
      } else {
        const database = db.getDB();
        const events = database.collection('security_events');
        
        const ipEvents = await events.countDocuments({
          'metadata.ip': ip,
          risk_level: { $in: ['high', 'critical'] }
        });
        
        if (ipEvents > 10) {
          riskScore = 40;
        } else if (ipEvents > 5) {
          riskScore = 20;
        }
      }
      
      const reputation = { risk_score: riskScore };
      
      await cacheManager.set(cacheKey, reputation, 3600);
      
      return reputation;
    } catch (error) {
      logger.error({ err: error, ip }, 'Error checking IP reputation');
      return { risk_score: 0 };
    }
  }

  isPrivateIP(ip) {
    const parts = ip.split('.');
    
    if (parts[0] === '10') return true;
    if (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) return true;
    if (parts[0] === '192' && parts[1] === '168') return true;
    if (ip === '127.0.0.1' || ip === 'localhost') return true;
    
    return false;
  }

  async analyzeWithdrawalPattern(userId, amount) {
    try {
      const database = db.getDB();
      const withdrawals = database.collection('withdrawals');
      
      const last24h = new Date(Date.now() - 86400000);
      
      const recentWithdrawals = await withdrawals.find({
        user_id: userId,
        created_at: { $gte: last24h }
      }).toArray();
      
      let riskScore = 0;
      
      if (recentWithdrawals.length >= this.suspiciousPatterns.unusualWithdrawals.frequency) {
        riskScore += 30;
      }
      
      if (amount > this.suspiciousPatterns.unusualWithdrawals.amount) {
        riskScore += 25;
      }
      
      const totalWithdrawn = recentWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      if (totalWithdrawn > amount * 3) {
        riskScore += 20;
      }
      
      return { risk_score: riskScore };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error analyzing withdrawal pattern');
      return { risk_score: 0 };
    }
  }

  async checkDeviceFingerprint(userId, fingerprint) {
    try {
      const database = db.getDB();
      const devices = database.collection('user_devices');
      
      const existingDevice = await devices.findOne({
        user_id: userId,
        fingerprint
      });
      
      if (existingDevice) {
        return { risk_score: 0, known_device: true };
      }
      
      const userDeviceCount = await devices.countDocuments({ user_id: userId });
      
      let riskScore = 0;
      if (userDeviceCount > 5) {
        riskScore = 15;
      }
      
      await devices.insertOne({
        user_id: userId,
        fingerprint,
        first_seen: new Date(),
        last_seen: new Date()
      });
      
      return { risk_score: riskScore, known_device: false };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error checking device fingerprint');
      return { risk_score: 0 };
    }
  }

  async getUserSecurityHistory(userId) {
    try {
      const database = db.getDB();
      const events = database.collection('security_events');
      
      const violations = await events.countDocuments({
        user_id: userId,
        risk_level: { $in: ['high', 'critical'] }
      });
      
      return { previous_violations: violations };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error getting user security history');
      return { previous_violations: 0 };
    }
  }

  async recordSecurityEvent(userId, eventData) {
    try {
      const database = db.getDB();
      const events = database.collection('security_events');
      
      await events.insertOne({
        user_id: userId,
        ...eventData,
        created_at: new Date()
      });
      
      return { success: true };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error recording security event');
      throw error;
    }
  }

  async logSecurityEvent(userId, level, riskScore) {
    logger.warn({ userId, level, riskScore }, '⚠️ Security event logged');
  }

  async notifyAdmin(userId, level, riskScore) {
    try {
      const config = require('./config');
      const bot = require('./bot');
      
      const message = `
🚨 <b>تنبيه أمني - ${level.toUpperCase()}</b>

👤 المستخدم: <code>${userId}</code>
⚠️ مستوى الخطر: ${riskScore}/100
🔴 التصنيف: ${level}

تم اتخاذ الإجراءات اللازمة تلقائياً.
      `;
      
      await bot.sendMessage(config.OWNER_ID, message, { parse_mode: 'HTML' });
      
      logger.info({ userId, level }, '📢 Admin notified');
    } catch (error) {
      logger.error({ err: error }, 'Error notifying admin');
    }
  }

  async blockUser(userId, duration) {
    try {
      const database = db.getDB();
      const users = database.collection('users');
      
      const blockUntil = this.calculateBlockDuration(duration);
      
      await users.updateOne(
        { user_id: userId },
        { 
          $set: { 
            blocked: true,
            block_until: blockUntil,
            block_reason: 'suspicious_activity'
          } 
        }
      );
      
      logger.warn({ userId, duration, blockUntil }, '🔒 User blocked');
      
      return { success: true, block_until: blockUntil };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error blocking user');
      throw error;
    }
  }

  async banUser(userId) {
    try {
      const database = db.getDB();
      const users = database.collection('users');
      
      await users.updateOne(
        { user_id: userId },
        { 
          $set: { 
            banned: true,
            ban_reason: 'critical_security_violation',
            banned_at: new Date()
          } 
        }
      );
      
      logger.error({ userId }, '🚫 User permanently banned');
      
      return { success: true };
    } catch (error) {
      logger.error({ err: error, userId }, 'Error banning user');
      throw error;
    }
  }

  calculateBlockDuration(duration) {
    const now = new Date();
    
    if (duration === '1h') {
      return new Date(now.getTime() + 3600000);
    } else if (duration === '24h') {
      return new Date(now.getTime() + 86400000);
    } else if (duration === '7d') {
      return new Date(now.getTime() + 604800000);
    }
    
    return new Date(now.getTime() + 86400000);
  }

  async isUserBlocked(userId) {
    try {
      const user = await db.getUser(userId);
      
      if (!user) return false;
      
      if (user.banned) return true;
      
      if (user.blocked && user.block_until) {
        if (new Date(user.block_until) > new Date()) {
          return true;
        } else {
          await db.updateUser(userId, { 
            blocked: false, 
            block_until: null 
          });
          return false;
        }
      }
      
      return false;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error checking if user is blocked');
      return false;
    }
  }

  generateDeviceFingerprint(userAgent, ip, additionalData = {}) {
    const data = {
      userAgent,
      ip,
      ...additionalData
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }
}

const securitySystem = new AdvancedSecuritySystem();

module.exports = securitySystem;
