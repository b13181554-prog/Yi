#!/usr/bin/env node

/**
 * Scheduler Process
 * يدير المهام المجدولة (cron jobs)
 * منفصل عن HTTP Server، Bot، والـ Workers
 */

const pino = require('pino');
const db = require('../database');
const { startWithdrawalScheduler, stopWithdrawalScheduler } = require('../withdrawal-scheduler');
const rankingScheduler = require('../ranking-scheduler');
const { initAnalystMonitor } = require('../analyst-monitor');
const { initTradeSignalsMonitor } = require('../trade-signals-monitor');
const featureFlagService = require('./feature-flags');
const automatedSafety = require('../automated-safety-system');

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

const startScheduler = async () => {
  try {
    logger.info('📅 Starting Scheduler Process...');
    
    // Initialize database
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    
    // Initialize feature flags
    logger.info('⚙️ Initializing feature flags...');
    await featureFlagService.initialize(db.getDB());
    logger.info('  ✅ Feature flags initialized');
    
    // Initialize automated safety system
    logger.info('🛡️ Initializing automated safety system...');
    automatedSafety.initialize();
    logger.info('  ✅ Automated safety system initialized');
    
    // Start all schedulers
    logger.info('🔄 Starting scheduled jobs...');
    
    // Withdrawal monitoring and retry
    startWithdrawalScheduler();
    logger.info('  ✅ Withdrawal scheduler started');
    
    // Analyst ranking updates
    rankingScheduler.start();
    logger.info('  ✅ Ranking scheduler started');
    
    // Analyst activity monitoring
    initAnalystMonitor();
    logger.info('  ✅ Analyst monitor started');
    
    // Trade signals monitoring
    initTradeSignalsMonitor();
    logger.info('  ✅ Trade signals monitor started');
    
    // Note: notifications.js المسح الدوري سيتم تحسينه بشكل منفصل
    
    logger.info('✅ All schedulers are running');
    logger.info('⏰ Scheduled tasks active and monitoring...');
    
  } catch (error) {
    logger.error(`❌ Failed to start Scheduler: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('⚠️ Shutting down Scheduler gracefully...');
  
  try {
    logger.info('⏹️ Stopping all scheduled jobs...');
    
    stopWithdrawalScheduler();
    rankingScheduler.stop();
    automatedSafety.stop();
    
    logger.info('✅ Scheduler shut down successfully');
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
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

// Start the scheduler
if (require.main === module) {
  startScheduler();
}

module.exports = { startScheduler };
