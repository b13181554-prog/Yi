#!/usr/bin/env node

/**
 * Bot Worker Process
 * يدير فقط Telegram Bot polling والتفاعل مع المستخدمين
 * منفصل عن HTTP Server والـ Workers الأخرى
 */

const pino = require('pino');
const db = require('../database');
const bot = require('../bot');

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

const startBotWorker = async () => {
  try {
    logger.info('🤖 Starting Telegram Bot Worker...');
    
    // Initialize database
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    
    // Start bot polling
    logger.info('📡 Starting bot polling...');
    bot.startPolling();
    
    logger.info('✅ Telegram Bot Worker is running');
    logger.info('👂 Listening for Telegram updates...');
    
  } catch (error) {
    logger.error(`❌ Failed to start Bot Worker: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('⚠️ SIGTERM received, shutting down Bot Worker...');
  await bot.stopPolling();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('⚠️ SIGINT received, shutting down Bot Worker...');
  await bot.stopPolling();
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

// Start the bot worker
if (require.main === module) {
  startBotWorker();
}

module.exports = { startBotWorker };
