
const crypto = require('crypto');
const config = require('./config');
const DOMPurify = require('isomorphic-dompurify');

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
  const user_id = req.body?.user_id || req.query?.user_id || req.headers['x-user-id'] || 'anonymous';
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
      
      const maxRequests = user_id === 'anonymous' ? 30 : 60;
      
      if (userLimit.count > maxRequests) {
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

// حماية ضد XSS وInjection
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input
      .replace(/[<>'"`;()]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\(/gi, '')
      .replace(/expression\(/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .trim();
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = Array.isArray(input) ? [] : {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

// دالة متقدمة لتنظيف HTML باستخدام DOMPurify
function sanitizeHTML(html) {
  if (typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'span', 'div'],
    ALLOWED_ATTR: ['class', 'style'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  }).trim();
}

// التحقق من الأنماط الخطرة
function containsDangerousPatterns(input) {
  if (typeof input !== 'string') return false;
  
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:text\/html/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
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
  sanitizeHTML,
  containsDangerousPatterns,
  validateRequestSize
};
