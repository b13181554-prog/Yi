#!/usr/bin/env node

/**
 * Queue Worker Process
 * يدير معالجة Bull Queues (السحوبات والمدفوعات)
 * منفصل عن HTTP Server والـ Bot
 */

const pino = require('pino');
const db = require('../database');
const { withdrawalQueue } = require('../withdrawal-queue');
const { paymentCallbackQueue } = require('../payment-callback-queue');

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

const startQueueWorker = async () => {
  try {
    logger.info('⚙️ Starting Queue Worker...');
    
    // Initialize database
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    
    logger.info('✅ Queue Worker is running');
    logger.info('📥 Processing withdrawal queue (5 concurrent workers)');
    logger.info('💳 Processing payment callback queue (3 concurrent workers)');
    logger.info('♻️ Auto-retry enabled with exponential backoff');
    
    // Queues are already processing from their modules
    // This process just keeps them alive
    
  } catch (error) {
    logger.error(`❌ Failed to start Queue Worker: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('⚠️ Shutting down Queue Worker gracefully...');
  
  try {
    logger.info('⏸️ Pausing queues...');
    await withdrawalQueue.pause();
    await paymentCallbackQueue.pause();
    
    logger.info('⏳ Waiting for active jobs to complete (max 30s)...');
    await Promise.race([
      Promise.all([
        withdrawalQueue.whenCurrentJobsFinished(),
        paymentCallbackQueue.whenCurrentJobsFinished()
      ]),
      new Promise(resolve => setTimeout(resolve, 30000))
    ]);
    
    logger.info('🔴 Closing queues...');
    await withdrawalQueue.close();
    await paymentCallbackQueue.close();
    
    logger.info('✅ Queue Worker shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

// Start the queue worker
if (require.main === module) {
  startQueueWorker();
}

module.exports = { startQueueWorker };
