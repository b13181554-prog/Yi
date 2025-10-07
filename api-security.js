
const crypto = require('crypto');
const config = require('./config');

// التحقق من صحة بيانات Telegram WebApp
function verifyTelegramWebAppData(initData) {
  try {
    if (!initData) return false;
    
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;
    
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(config.BOT_TOKEN)
      .digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Telegram verification error:', error);
    return false;
  }
}

// Middleware للتحقق من الطلبات
function authenticateAPI(req, res, next) {
  const { init_data } = req.body;
  
  if (!verifyTelegramWebAppData(init_data)) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid Telegram data' 
    });
  }
  
  next();
}

// Middleware لتحديد معدل الطلبات (Rate Limiting)
const requestCounts = new Map();

function apiRateLimit(req, res, next) {
  const { user_id } = req.body;
  const now = Date.now();
  const userKey = `api_${user_id}`;
  
  if (!requestCounts.has(userKey)) {
    requestCounts.set(userKey, { count: 1, resetTime: now + 60000 });
  } else {
    const userLimit = requestCounts.get(userKey);
    
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + 60000;
    } else {
      userLimit.count++;
      
      if (userLimit.count > 60) { // 60 طلب في الدقيقة
        return res.status(429).json({ 
          success: false, 
          error: 'Too many requests. Please try again later.' 
        });
      }
    }
  }
  
  next();
}

// تنظيف الذاكرة كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime + 300000) {
      requestCounts.delete(key);
    }
  }
}, 300000);

// حماية ضد SQL/NoSQL Injection
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input.replace(/[<>'"]/g, '');
  }
  return input;
}

// Middleware للتحقق من حجم البيانات
function validateRequestSize(req, res, next) {
  const contentLength = req.headers['content-length'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request too large'
    });
  }
  
  next();
}

module.exports = {
  verifyTelegramWebAppData,
  authenticateAPI,
  apiRateLimit,
  sanitizeInput,
  validateRequestSize
};
