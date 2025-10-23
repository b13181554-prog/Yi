/**
 * Groq API Service with Circuit Breaker and Caching
 * خدمة Groq API مع Circuit Breaker ونظام تخزين مؤقت
 * 
 * Features:
 * - Circuit Breaker لمنع الطلبات المتكررة عند الفشل
 * - Intelligent caching للنتائج
 * - Rate limiting tracking
 * - Retry mechanism مع exponential backoff
 * - Detailed error handling
 */

const Groq = require('groq-sdk');
const CircuitBreaker = require('./circuit-breaker');
const pino = require('pino');
const crypto = require('crypto');

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

class GroqService {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      logger.warn('⚠️ GROQ_API_KEY not found. Groq Service will not work.');
      this.enabled = false;
      return;
    }
    
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    
    this.enabled = true;
    
    // Circuit Breaker للحماية من الأخطاء المتكررة
    this.circuitBreaker = new CircuitBreaker({
      name: 'Groq API',
      failureThreshold: 3,      // افتح الدائرة بعد 3 فشل
      successThreshold: 2,       // أغلق الدائرة بعد نجاحين
      timeout: 45000,            // 45 ثانية timeout
      resetTimeout: 120000       // انتظر دقيقتين قبل إعادة المحاولة
    });
    
    // نظام تخزين مؤقت ذكي
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 دقيقة
    this.maxCacheSize = 100;
    
    // تتبع استخدام API
    this.apiUsage = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      rateLimitErrors: 0,
      lastReset: Date.now()
    };
    
    // تنظيف الذاكرة المؤقتة كل ساعة
    setInterval(() => this.cleanCache(), 60 * 60 * 1000);
    
    logger.info('✅ Groq Service initialized with Circuit Breaker and Caching');
  }
  
  /**
   * تنفيذ استدعاء Groq API مع Circuit Breaker والتخزين المؤقت
   */
  async chat(messages, options = {}) {
    if (!this.enabled) {
      logger.error('❌ Groq Service is disabled - no API key');
      throw new Error('Groq Service is not available');
    }
    
    this.apiUsage.totalRequests++;
    
    // إنشاء مفتاح للتخزين المؤقت
    const cacheKey = this.generateCacheKey(messages, options);
    
    // تحقق من الذاكرة المؤقتة
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.apiUsage.cachedRequests++;
      logger.info('✅ Groq: Using cached result');
      return cached;
    }
    
    // تنفيذ الطلب مع Circuit Breaker
    try {
      const result = await this.circuitBreaker.execute(
        async () => {
          return await this.executeWithRetry(messages, options);
        },
        () => {
          // Fallback عند فتح الدائرة
          logger.warn('⚠️ Circuit is OPEN - using fallback response');
          return this.getFallbackResponse(messages, options);
        }
      );
      
      // حفظ في الذاكرة المؤقتة
      if (result && !result.isError) {
        this.saveToCache(cacheKey, result);
      }
      
      this.apiUsage.successfulRequests++;
      return result;
      
    } catch (error) {
      this.apiUsage.failedRequests++;
      
      // تتبع أخطاء Rate Limit
      if (this.isRateLimitError(error)) {
        this.apiUsage.rateLimitErrors++;
        logger.error('🚨 Groq API: Rate limit exceeded');
      }
      
      logger.error({ err: error }, '❌ Groq API Error');
      
      // إرجاع استجابة بديلة
      return this.getFallbackResponse(messages, options);
    }
  }
  
  /**
   * تنفيذ الطلب مع إعادة المحاولة (Retry with Exponential Backoff)
   */
  async executeWithRetry(messages, options, maxRetries = 2) {
    const {
      model = 'llama-3.3-70b-versatile',
      temperature = 0.3,
      max_tokens = 2000,
      response_format = null
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(`⏳ Groq: Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const requestOptions = {
          messages,
          model,
          temperature,
          max_tokens
        };
        
        if (response_format) {
          requestOptions.response_format = response_format;
        }
        
        const completion = await this.groq.chat.completions.create(requestOptions);
        
        return {
          content: completion.choices[0]?.message?.content,
          model: completion.model,
          usage: completion.usage,
          isError: false
        };
        
      } catch (error) {
        lastError = error;
        
        // لا تعيد المحاولة على أخطاء Rate Limit
        if (this.isRateLimitError(error)) {
          throw error;
        }
        
        // لا تعيد المحاولة على أخطاء المصادقة
        if (this.isAuthError(error)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * توليد مفتاح للتخزين المؤقت
   */
  generateCacheKey(messages, options) {
    const key = JSON.stringify({ messages, options });
    return crypto.createHash('md5').update(key).digest('hex');
  }
  
  /**
   * الحصول على نتيجة من الذاكرة المؤقتة
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // تحقق من صلاحية الذاكرة المؤقتة
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * حفظ نتيجة في الذاكرة المؤقتة
   */
  saveToCache(key, data) {
    // تنظيف الذاكرة إذا امتلأت
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * تنظيف الذاكرة المؤقتة من البيانات القديمة
   */
  cleanCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`🧹 Groq Cache: Cleaned ${cleaned} expired entries`);
    }
  }
  
  /**
   * استجابة بديلة عند الفشل
   */
  getFallbackResponse(messages, options) {
    logger.warn('⚠️ Using Groq fallback response');
    
    return {
      content: JSON.stringify({
        score: 0,
        sentiment: 'محايد',
        confidence: 0.3,
        summary: 'فشل تحليل AI - يرجى المحاولة لاحقاً',
        error: 'خدمة التحليل الذكي غير متاحة حالياً'
      }),
      model: 'fallback',
      usage: null,
      isError: true,
      isFallback: true
    };
  }
  
  /**
   * التحقق من خطأ Rate Limit
   */
  isRateLimitError(error) {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorStatus = error?.status || error?.response?.status;
    
    return errorStatus === 429 || 
           errorMessage.includes('rate limit') ||
           errorMessage.includes('quota') ||
           errorMessage.includes('capacity');
  }
  
  /**
   * التحقق من خطأ المصادقة
   */
  isAuthError(error) {
    const errorStatus = error?.status || error?.response?.status;
    return errorStatus === 401 || errorStatus === 403;
  }
  
  /**
   * الحصول على إحصائيات الاستخدام
   */
  getUsageStats() {
    return {
      ...this.apiUsage,
      cacheSize: this.cache.size,
      circuitState: this.circuitBreaker.getState(),
      uptime: Date.now() - this.apiUsage.lastReset,
      successRate: this.apiUsage.totalRequests > 0 
        ? (this.apiUsage.successfulRequests / this.apiUsage.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheHitRate: this.apiUsage.totalRequests > 0
        ? (this.apiUsage.cachedRequests / this.apiUsage.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }
  
  /**
   * إعادة تعيين إحصائيات الاستخدام
   */
  resetStats() {
    this.apiUsage = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      rateLimitErrors: 0,
      lastReset: Date.now()
    };
    logger.info('🔄 Groq Usage stats reset');
  }
  
  /**
   * إعادة تعيين Circuit Breaker
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
    logger.info('🔄 Groq Circuit Breaker reset');
  }
  
  /**
   * مسح الذاكرة المؤقتة بالكامل
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`🧹 Groq Cache cleared (${size} entries)`);
  }
  
  /**
   * الحصول على حالة الخدمة
   */
  getStatus() {
    return {
      enabled: this.enabled,
      stats: this.getUsageStats(),
      healthy: this.circuitBreaker.getState().state !== 'OPEN'
    };
  }
}

// إنشاء instance واحدة فقط (Singleton)
const groqService = new GroqService();

module.exports = groqService;
