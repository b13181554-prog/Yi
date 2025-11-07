/**
 * Webhook Configuration - Simplified
 * بيئة Webhook فقط
 */

function getWebhookConfig() {
  return {
    mode: 'webhook',
    port: parseInt(process.env.PORT) || parseInt(process.env.BOT_WEBHOOK_PORT) || 8443,
    handler: 'unified-webhook-server',
    publicUrl: process.env.PUBLIC_URL || process.env.WEBAPP_URL,
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
  return {
    environment: process.env.NODE_ENV || 'production',
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
