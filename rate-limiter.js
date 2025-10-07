
const config = require('./config');

class RateLimiter {
  constructor() {
    this.userRequests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // تنظيف كل دقيقة
  }
  
  checkLimit(userId) {
    const now = Date.now();
    const userRecord = this.userRequests.get(userId);
    
    if (!userRecord) {
      this.userRequests.set(userId, {
        requests: 1,
        firstRequest: now
      });
      return { allowed: true, remaining: config.MAX_REQUESTS_PER_MINUTE - 1 };
    }
    
    const timePassed = now - userRecord.firstRequest;
    
    // إعادة تعيين إذا مر أكثر من دقيقة
    if (timePassed > 60000) {
      this.userRequests.set(userId, {
        requests: 1,
        firstRequest: now
      });
      return { allowed: true, remaining: config.MAX_REQUESTS_PER_MINUTE - 1 };
    }
    
    // التحقق من تجاوز الحد
    if (userRecord.requests >= config.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = Math.ceil((60000 - timePassed) / 1000);
      return { 
        allowed: false, 
        remaining: 0,
        waitTime: waitTime,
        message: `⏳ لقد تجاوزت الحد المسموح (${config.MAX_REQUESTS_PER_MINUTE} طلب/دقيقة). انتظر ${waitTime} ثانية.`
      };
    }
    
    userRecord.requests++;
    return { 
      allowed: true, 
      remaining: config.MAX_REQUESTS_PER_MINUTE - userRecord.requests 
    };
  }
  
  cleanup() {
    const now = Date.now();
    for (const [userId, record] of this.userRequests.entries()) {
      if (now - record.firstRequest > 120000) { // حذف السجلات الأقدم من دقيقتين
        this.userRequests.delete(userId);
      }
    }
  }
  
  reset(userId) {
    this.userRequests.delete(userId);
  }
  
  stop() {
    clearInterval(this.cleanupInterval);
  }
}

module.exports = new RateLimiter();
