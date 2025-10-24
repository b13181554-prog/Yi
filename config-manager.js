/**
 * Centralized Configuration Manager
 * إدارة مركزية للإعدادات لدعم Distributed Deployment
 */

const fs = require('fs');
const path = require('path');
const pino = require('pino');

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

class ConfigManager {
  constructor() {
    this.config = {};
    this.environment = process.env.NODE_ENV || 'development';
    this.loadConfig();
  }

  loadConfig() {
    // تحميل الإعدادات الأساسية
    this.config = {
      // Environment
      environment: this.environment,
      isProduction: this.environment === 'production',
      isDevelopment: this.environment === 'development',

      // Deployment Mode
      deploymentMode: process.env.DEPLOYMENT_MODE || 'standalone', // standalone | docker | kubernetes
      instanceId: process.env.INSTANCE_ID || '1',
      serviceName: process.env.SERVICE_NAME || 'obentchi-bot',

      // Bot Configuration
      bot: {
        token: process.env.BOT_TOKEN,
        ownerId: parseInt(process.env.OWNER_ID),
        channelId: parseInt(process.env.CHANNEL_ID),
        channelUsername: process.env.CHANNEL_USERNAME,
        mode: process.env.BOT_MODE || 'auto', // polling | webhook | auto
      },

      // Webhook Configuration
      webhook: {
        enabled: process.env.WEBHOOK_ENABLED === 'true' || process.env.PUBLIC_URL ? true : false,
        publicUrl: process.env.PUBLIC_URL,
        webhookUrl: process.env.WEBHOOK_URL,
        port: parseInt(process.env.BOT_WEBHOOK_PORT) || 8443,
        maxConnections: parseInt(process.env.WEBHOOK_MAX_CONNECTIONS) || 100,
      },

      // Database Configuration
      database: {
        uri: process.env.MONGODB_URI || `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/obentchi_bot?retryWrites=true&w=majority`,
        name: process.env.MONGODB_DB_NAME || 'obentchi_bot',
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 100,
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 10,
      },

      // Redis Configuration
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        cluster: {
          enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
          nodes: process.env.REDIS_CLUSTER_NODES 
            ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
                const [host, port] = node.split(':');
                return { host, port: parseInt(port) };
              })
            : [],
        },
      },

      // Queue Configuration
      queue: {
        autoScaling: {
          enabled: process.env.AUTO_SCALING_ENABLED !== 'false',
          withdrawal: {
            min: parseInt(process.env.MIN_WITHDRAWAL_WORKERS) || 5,
            max: parseInt(process.env.MAX_WITHDRAWAL_WORKERS) || 100,
            concurrency: parseInt(process.env.WITHDRAWAL_CONCURRENCY) || 50,
          },
          payment: {
            min: parseInt(process.env.MIN_PAYMENT_WORKERS) || 3,
            max: parseInt(process.env.MAX_PAYMENT_WORKERS) || 50,
            concurrency: parseInt(process.env.PAYMENT_CONCURRENCY) || 30,
          },
        },
      },

      // HTTP Server Configuration
      http: {
        port: parseInt(process.env.PORT) || 5000,
        host: process.env.HOST || '0.0.0.0',
        trustProxy: process.env.TRUST_PROXY === 'true',
      },

      // API Keys
      apiKeys: {
        okx: {
          apiKey: process.env.OKX_API_KEY,
          secretKey: process.env.OKX_SECRET_KEY,
          passphrase: process.env.OKX_PASSPHRASE,
        },
        coingecko: process.env.COINGECKO_API_KEY,
        forex: process.env.FOREX_API_KEY,
        whaleAlert: process.env.WHALE_ALERT_API_KEY,
      },

      // Monitoring
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metricsPort: parseInt(process.env.METRICS_PORT) || 9100,
        sentry: {
          enabled: !!process.env.SENTRY_DSN,
          dsn: process.env.SENTRY_DSN,
        },
      },

      // Logging
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.LOG_PRETTY_PRINT !== 'false',
      },

      // Feature Flags
      features: {
        webhooksEnabled: this.isWebhookModeAvailable(),
        autoScalingEnabled: process.env.AUTO_SCALING_ENABLED !== 'false',
        monitoringEnabled: process.env.MONITORING_ENABLED !== 'false',
      },
    };

    this.validateConfig();
    this.logConfiguration();
  }

  isWebhookModeAvailable() {
    return !!(process.env.PUBLIC_URL || process.env.WEBHOOK_URL);
  }

  shouldUseWebhooks() {
    const mode = this.config.bot.mode;
    
    if (mode === 'webhook') return true;
    if (mode === 'polling') return false;
    
    // auto mode: استخدم webhooks إذا كان متاحاً
    return this.isWebhookModeAvailable();
  }

  validateConfig() {
    const errors = [];

    // التحقق من المتغيرات الضرورية
    if (!this.config.bot.token) {
      errors.push('BOT_TOKEN is required');
    }

    if (!this.config.bot.ownerId) {
      errors.push('OWNER_ID is required');
    }

    if (!process.env.MONGODB_USER || !process.env.MONGODB_PASSWORD) {
      errors.push('MONGODB_USER and MONGODB_PASSWORD are required');
    }

    // webhook validations
    if (this.shouldUseWebhooks()) {
      if (!this.config.webhook.publicUrl && !this.config.webhook.webhookUrl) {
        errors.push('PUBLIC_URL or WEBHOOK_URL is required for webhook mode');
      }
    }

    if (errors.length > 0) {
      logger.error('❌ Configuration validation failed:');
      errors.forEach(error => logger.error(`  - ${error}`));
      throw new Error('Invalid configuration');
    }
  }

  logConfiguration() {
    logger.info('📋 Configuration loaded successfully');
    logger.info('🌍 Environment:', this.environment);
    logger.info('🚀 Deployment Mode:', this.config.deploymentMode);
    logger.info('🔢 Instance ID:', this.config.instanceId);
    logger.info('🤖 Bot Mode:', this.shouldUseWebhooks() ? 'Webhook' : 'Polling');
    
    if (this.config.redis.cluster.enabled) {
      logger.info('📡 Redis Cluster:', this.config.redis.cluster.nodes.length, 'nodes');
    } else {
      logger.info('📡 Redis:', `${this.config.redis.host}:${this.config.redis.port}`);
    }
    
    logger.info('⚙️ Auto-scaling:', this.config.queue.autoScaling.enabled ? 'ENABLED' : 'DISABLED');
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
    target[lastKey] = value;
  }

  getAll() {
    return this.config;
  }

  // دوال مساعدة
  isKubernetes() {
    return this.config.deploymentMode === 'kubernetes';
  }

  isDocker() {
    return this.config.deploymentMode === 'docker';
  }

  isStandalone() {
    return this.config.deploymentMode === 'standalone';
  }
}

// Singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
module.exports.ConfigManager = ConfigManager;
