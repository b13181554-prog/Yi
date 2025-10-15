
const config = require('./config');
const { safeSendMessage } = require('./safe-message');

class SecurityLogger {
  static async logSuspiciousActivity(userId, activity, details) {
    const timestamp = new Date().toISOString();
    console.warn(`
⚠️ نشاط مشبوه تم رصده:
- الوقت: ${timestamp}
- المستخدم: ${userId}
- النشاط: ${activity}
- التفاصيل: ${JSON.stringify(details)}
`);
    
    // يمكن إرسال إشعار للمالك
    try {
      const bot = require('./bot');
      await safeSendMessage(bot, config.OWNER_ID, `
🚨 <b>تنبيه أمني</b>

⏰ ${timestamp}
👤 المستخدم: ${userId}
⚠️ النشاط: ${activity}
📝 التفاصيل: ${JSON.stringify(details, null, 2)}
`, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('فشل في إرسال التنبيه الأمني:', error.message);
    }
  }
  
  static async logFailedLogin(userId, reason) {
    await this.logSuspiciousActivity(userId, 'محاولة دخول فاشلة', { reason });
  }
  
  static async logExcessiveRequests(userId, requestCount) {
    await this.logSuspiciousActivity(userId, 'طلبات متكررة مشبوهة', { requestCount });
  }
  
  static async logInvalidWithdrawal(userId, amount, address) {
    await this.logSuspiciousActivity(userId, 'محاولة سحب مشبوهة', { amount, address });
  }
}

module.exports = SecurityLogger;
