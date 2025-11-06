/**
 * Environment Detector
 * يكتشف البيئة الحالية ويوفر إعدادات موحدة
 */

class EnvironmentDetector {
  constructor() {
    this.isReplit = this._detectReplit();
    this.isAWS = this._detectAWS();
    this.isDevelopment = this._detectDevelopment();
    this.isProduction = this._detectProduction();
  }

  _detectReplit() {
    return !!(
      process.env.REPLIT_DB_URL ||
      process.env.REPLIT_DOMAINS ||
      process.env.REPL_ID
    );
  }

  _detectAWS() {
    return !!(
      process.env.AWS_REGION ||
      process.env.AWS_EXECUTION_ENV ||
      (!this.isReplit && process.env.PUBLIC_URL)
    );
  }

  _detectDevelopment() {
    return (
      process.env.NODE_ENV === 'development' ||
      this.isReplit
    );
  }

  _detectProduction() {
    return process.env.NODE_ENV === 'production' && !this.isReplit;
  }

  getWebhookConfig() {
    if (this.isReplit) {
      return {
        mode: 'webhook',
        port: 5000,
        handler: 'http-server',
        publicUrl: process.env.WEBAPP_URL || 
                   (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}` : null),
        webhookPath: '/webhook',
        setupWebhook: true
      };
    }

    if (this.isAWS || this.isProduction) {
      return {
        mode: 'webhook',
        port: parseInt(process.env.BOT_WEBHOOK_PORT) || 8443,
        handler: 'bot-webhook-worker',
        publicUrl: process.env.PUBLIC_URL || process.env.WEBAPP_URL,
        webhookPath: '/webhook',
        setupWebhook: true
      };
    }

    return {
      mode: 'polling',
      handler: 'bot',
      setupWebhook: false
    };
  }

  getRedisConfig() {
    if (this.isReplit) {
      return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 50, 2000)
      };
    }

    return {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    };
  }

  getHttpServerPort() {
    if (this.isReplit) {
      return 5000;
    }
    return parseInt(process.env.PORT) || 5000;
  }

  getEnvironmentInfo() {
    return {
      environment: this.isProduction ? 'production' : 'development',
      platform: this.isReplit ? 'replit' : this.isAWS ? 'aws' : 'unknown',
      isReplit: this.isReplit,
      isAWS: this.isAWS,
      isDevelopment: this.isDevelopment,
      isProduction: this.isProduction,
      webhookConfig: this.getWebhookConfig()
    };
  }

  shouldUseWebhook() {
    return this.getWebhookConfig().mode === 'webhook';
  }

  shouldUsePolling() {
    return this.getWebhookConfig().mode === 'polling';
  }
}

const envDetector = new EnvironmentDetector();

module.exports = {
  EnvironmentDetector,
  envDetector,
  isReplit: envDetector.isReplit,
  isAWS: envDetector.isAWS,
  isDevelopment: envDetector.isDevelopment,
  isProduction: envDetector.isProduction,
  getWebhookConfig: () => envDetector.getWebhookConfig(),
  getRedisConfig: () => envDetector.getRedisConfig(),
  getHttpServerPort: () => envDetector.getHttpServerPort(),
  getEnvironmentInfo: () => envDetector.getEnvironmentInfo()
};
