#!/usr/bin/env node

/**
 * Bot Webhook Worker Process
 * معالج Webhook للبوت - يمكن تشغيل عدة نسخ متوازية
 * بديل لـ bot-worker.js (polling) - أكثر كفاءة لملايين المستخدمين
 */

const express = require('express');
const pino = require('pino');
const crypto = require('crypto');
const { bot, processUpdate, initializeBot, setupWebhook } = require('../bot-webhook');
const { validateRequestSize } = require('../api-security');
const { createMetricsEndpoint, httpMetricsMiddleware, trackBotUpdate } = require('../metrics-exporter');

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

const app = express();
const PORT = process.env.BOT_WEBHOOK_PORT || 8443;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(validateRequestSize);
app.use(httpMetricsMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'bot-webhook-worker',
    instance: process.env.INSTANCE_ID || 'default'
  });
});

// Prometheus metrics endpoint
createMetricsEndpoint(app);

// ✅ Webhook endpoint مع Secret Token للأمان
// Telegram يرسل X-Telegram-Bot-Api-Secret-Token header للتحقق
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');

// Webhook endpoint - يستقبل التحديثات من Telegram
app.post('/webhook', async (req, res) => {
  try {
    // ✅ التحقق من Secret Token (إذا كان مُعرّف)
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (process.env.WEBHOOK_SECRET && secretToken !== WEBHOOK_SECRET) {
      logger.warn('⚠️ Unauthorized webhook request - invalid secret token');
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const update = req.body;
    
    if (!update || !update.update_id) {
      return res.status(400).json({ error: 'Invalid update' });
    }
    
    // الرد فوراً لـ Telegram (200 OK)
    res.status(200).json({ ok: true });
    
    // معالجة التحديث بشكل غير متزامن
    setImmediate(async () => {
      const start = Date.now();
      try {
        await processUpdate(update);
        const duration = (Date.now() - start) / 1000;
        const updateType = update.message ? 'message' : update.callback_query ? 'callback_query' : 'other';
        trackBotUpdate(updateType, duration);
      } catch (error) {
        logger.error(`Error processing update ${update.update_id}:`, error);
        trackBotUpdate('error', null);
      }
    });
    
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// بدء الخادم
const startBotWebhookWorker = async () => {
  try {
    logger.info('🤖 Starting Telegram Bot Webhook Worker...');
    
    // تهيئة البوت
    await initializeBot();
    
    // تحديد URL الخاص بالـ webhook
    const webhookUrl = process.env.WEBHOOK_URL 
      || `${process.env.PUBLIC_URL}/webhook`;
    
    if (!webhookUrl || webhookUrl.includes('undefined')) {
      throw new Error('WEBHOOK_URL or PUBLIC_URL environment variable is required');
    }
    
    // إعداد webhook مع Telegram
    // في AWS: bot-webhook-worker يعالج webhook (ALB يوجه /webhook إلى port 8443)
    // في Replit: http-server يعالج webhook (port 5000 فقط معروض)
    const IS_REPLIT = !!process.env.REPLIT_DB_URL;
    
    if (!IS_REPLIT) {
      // AWS mode: bot-webhook-worker يقوم بـ setWebHook
      try {
        await setupWebhook(webhookUrl, WEBHOOK_SECRET);
        logger.info(`✅ Webhook configured successfully (AWS mode)`);
        logger.info(`🔒 Webhook secret: ${WEBHOOK_SECRET ? 'ENABLED' : 'DISABLED'}`);
      } catch (error) {
        logger.error(`⚠️ Failed to setup webhook: ${error.message}`);
      }
    } else {
      // Replit mode: http-server يقوم بـ setWebHook
      logger.info(`ℹ️ Replit mode: webhook managed by http-server on port 5000`);
      logger.info(`ℹ️ This worker listens on port ${PORT} but won't receive direct traffic`);
    }
    
    if (!process.env.WEBHOOK_SECRET) {
      logger.error('❌ CRITICAL: WEBHOOK_SECRET not set! This will cause 403 errors!');
      throw new Error('WEBHOOK_SECRET environment variable is required for production');
    }
    
    // بدء الخادم
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Bot Webhook Worker running on port ${PORT}`);
      logger.info(`📡 Webhook URL: ${webhookUrl}`);
      logger.info(`🔢 Instance ID: ${process.env.INSTANCE_ID || 'default'}`);
      logger.info(`👂 Listening for Telegram webhook updates...`);
    });
    
  } catch (error) {
    logger.error(`❌ Failed to start Bot Webhook Worker: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('⚠️ SIGTERM received, shutting down Bot Webhook Worker...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('⚠️ SIGINT received, shutting down Bot Webhook Worker...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

// Start the worker
if (require.main === module) {
  startBotWebhookWorker();
}

module.exports = { startBotWebhookWorker };
