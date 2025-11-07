#!/usr/bin/env node

/**
 * Process Manager - Simplified for Webhook Only
 * يدير الخادم الموحد فقط (Webhook Mode)
 */

require('dotenv').config();

const { spawn } = require('child_process');
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

let serverProcess = null;
const RESTART_DELAY = 5000;

function startUnifiedServer() {
  logger.info('🚀 Starting Unified Webhook Server...');
  
  const child = spawn('node', ['services/unified-webhook-server.js'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      console.log(`\x1b[36m[Webhook Server]\x1b[0m ${line}`);
    });
  });
  
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      console.error(`\x1b[36m[Webhook Server]\x1b[0m \x1b[31m${line}\x1b[0m`);
    });
  });
  
  child.on('exit', (code, signal) => {
    logger.error(`❌ Webhook Server exited with code ${code}, signal ${signal}`);
    serverProcess = null;
    
    if (code !== 0) {
      logger.warn(`🔄 Restarting Webhook Server in ${RESTART_DELAY / 1000}s...`);
      setTimeout(() => {
        if (!serverProcess) {
          startUnifiedServer();
        }
      }, RESTART_DELAY);
    }
  });
  
  serverProcess = child;
  logger.info(`✅ Webhook Server started (PID: ${child.pid})`);
  
  return child;
}

async function stopServer() {
  if (!serverProcess) return;
  
  logger.info(`⏹️ Stopping Webhook Server...`);
  
  return new Promise((resolve) => {
    serverProcess.on('exit', () => {
      serverProcess = null;
      logger.info(`✅ Webhook Server stopped`);
      resolve();
    });
    
    serverProcess.kill('SIGTERM');
    
    setTimeout(() => {
      if (serverProcess) {
        logger.warn(`⚠️ Force killing Webhook Server`);
        serverProcess.kill('SIGKILL');
      }
    }, 10000);
  });
}

logger.info('🚀 OBENTCHI Trading Bot - Webhook Mode');
logger.info('==========================================');
logger.info('📡 Starting unified webhook server...');
logger.info('');

startUnifiedServer();

let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('');
  logger.info('⚠️ Shutdown signal received...');
  await stopServer();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

module.exports = { startUnifiedServer, stopServer };
