#!/usr/bin/env node

/**
 * Bot Webhook Worker Process
 * معالج Webhook للبوت - يمكن تشغيل عدة نسخ متوازية
 * بديل لـ bot-worker.js (polling) - أكثر كفاءة لملايين المستخدمين
 */

const express = require('express');
const pino = require('pino');
const config = require('../config');
const { bot, processUpdate, initializeBot, setupWebhook } = require('../bot-webhook');
const { validateRequestSize } = require('../api-security');
const { createMetricsEndpoint, httpMetricsMiddleware, trackBotUpdate } = require('../metrics-exporter');
const { envDetector } = require('../environment-detector');
const { webhookHandler } = require('../webhook-handler');

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
const PORT = config.WEBHOOK_CONFIG.port || 8443;

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
    instance: process.env.INSTANCE_ID || 'default',
    environment: config.ENVIRONMENT.platform
  });
});

// Prometheus metrics endpoint
createMetricsEndpoint(app);

webhookHandler.setProcessUpdateFunction(processUpdate);
webhookHandler.setTrackBotUpdateFunction(trackBotUpdate);

app.post('/webhook', webhookHandler.getExpressMiddleware());

// بدء الخادم
const startBotWebhookWorker = async () => {
  try {
    logger.info('🤖 Starting Telegram Bot Webhook Worker...');
    logger.info(`🌍 Environment: ${config.ENVIRONMENT.platform}`);
    
    await initializeBot();
    
    const webhookUrl = config.WEBHOOK_CONFIG.publicUrl 
      ? `${config.WEBHOOK_CONFIG.publicUrl}${config.WEBHOOK_CONFIG.webhookPath}`
      : process.env.WEBHOOK_URL || `${process.env.PUBLIC_URL}/webhook`;
    
    if (!webhookUrl || webhookUrl.includes('undefined')) {
      throw new Error('WEBHOOK_URL or PUBLIC_URL environment variable is required');
    }
    
    if (!envDetector.isReplit) {
      try {
        await setupWebhook(webhookUrl, webhookHandler.getWebhookSecret());
        logger.info(`✅ Webhook configured successfully (${config.ENVIRONMENT.platform} mode)`);
      } catch (error) {
        logger.error(`⚠️ Failed to setup webhook: ${error.message}`);
      }
    } else {
      logger.info(`ℹ️ Replit mode: webhook managed by http-server on port 5000`);
      logger.info(`ℹ️ This worker listens on port ${PORT} but won't receive direct traffic`);
    }
    
    if (!process.env.WEBHOOK_SECRET && !envDetector.isReplit) {
      logger.warn('⚠️ WARNING: WEBHOOK_SECRET not set! Using auto-generated secret.');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      webhookHandler.logWebhookInfo(config.ENVIRONMENT.platform, PORT, webhookUrl);
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
