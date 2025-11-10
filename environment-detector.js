/**
 * Webhook Configuration - Simplified
 * بيئة Webhook فقط
 * نظام اكتشاف تلقائي للبيئة (Replit vs AWS/Production)
 */

/**
 * اكتشاف المنصة (Platform Detection)
 * يتحقق من متغيرات البيئة لتحديد المنصة
 */
function detectPlatform() {
  if (process.env.REPLIT_DB_URL || process.env.REPL_ID || process.env.REPL_OWNER) {
    return 'replit';
  }
  return 'aws';
}

/**
 * الحصول على PUBLIC_URL التلقائي
 * في Replit: استخدام REPLIT_DOMAINS (JSON array)
 * في AWS: استخدام PUBLIC_URL
 */
function getPublicUrl() {
  const isReplit = detectPlatform() === 'replit';
  
  if (isReplit && process.env.REPLIT_DOMAINS) {
    try {
      const domains = JSON.parse(process.env.REPLIT_DOMAINS);
      if (Array.isArray(domains) && domains.length > 0 && domains[0]) {
        const url = `https://${domains[0]}`;
        new URL(url);
        return url;
      }
    } catch (error) {
    }
  }
  
  const publicUrl = process.env.PUBLIC_URL || process.env.WEBAPP_URL || null;
  
  if (publicUrl) {
    try {
      new URL(publicUrl);
      return publicUrl;
    } catch (error) {
    }
  }
  
  return null;
}

function getWebhookConfig() {
  return {
    mode: 'webhook',
    port: parseInt(process.env.PORT) || parseInt(process.env.BOT_WEBHOOK_PORT) || 8443,
    handler: 'unified-webhook-server',
    publicUrl: getPublicUrl(),
    webhookPath: '/webhook',
    setupWebhook: true
  };
}

function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  };
}

function getHttpServerPort() {
  return parseInt(process.env.PORT) || 8443;
}

function getEnvironmentInfo() {
  const platform = detectPlatform();
  const environment = process.env.NODE_ENV || 'production';
  
  return {
    platform: platform,
    environment: environment,
    isReplit: platform === 'replit',
    isProduction: environment === 'production',
    mode: 'webhook',
    webhookConfig: getWebhookConfig()
  };
}

const envDetector = {
  getWebhookConfig,
  getRedisConfig,
  getHttpServerPort,
  getEnvironmentInfo
};

module.exports = {
  envDetector,
  getWebhookConfig,
  getRedisConfig,
  getHttpServerPort,
  getEnvironmentInfo
};
