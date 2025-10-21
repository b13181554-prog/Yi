#!/usr/bin/env node

/**
 * Process Manager
 * يدير جميع الخدمات المنفصلة
 * يمكن تشغيل خدمة واحدة أو الكل معاً
 */

const { spawn } = require('child_process');
const pino = require('pino');
const path = require('path');

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

// تعريف الخدمات
const SERVICES = {
  'http': {
    name: 'HTTP Server',
    script: 'services/http-server.js',
    color: '\x1b[36m', // Cyan
    required: true
  },
  'bot': {
    name: 'Bot Worker',
    script: 'services/bot-worker.js',
    color: '\x1b[35m', // Magenta
    required: true
  },
  'queue': {
    name: 'Queue Worker',
    script: 'services/queue-worker.js',
    color: '\x1b[33m', // Yellow
    required: true
  },
  'scheduler': {
    name: 'Scheduler',
    script: 'services/scheduler.js',
    color: '\x1b[32m', // Green
    required: false
  }
};

const processes = new Map();
const RESTART_DELAY = 5000; // 5 ثوانٍ قبل إعادة التشغيل

/**
 * بدء خدمة واحدة
 */
function startService(serviceKey, service) {
  const { name, script, color } = service;
  
  logger.info(`🚀 Starting ${name}...`);
  
  const child = spawn('node', [script], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, SERVICE_NAME: name }
  });
  
  // تلوين وطباعة المخرجات
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      console.log(`${color}[${name}]\x1b[0m ${line}`);
    });
  });
  
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      console.error(`${color}[${name}]\x1b[0m \x1b[31m${line}\x1b[0m`);
    });
  });
  
  child.on('exit', (code, signal) => {
    logger.error(`❌ ${name} exited with code ${code}, signal ${signal}`);
    processes.delete(serviceKey);
    
    // إعادة التشغيل التلقائية
    if (code !== 0 && service.required) {
      logger.warn(`🔄 Restarting ${name} in ${RESTART_DELAY / 1000}s...`);
      setTimeout(() => {
        if (!processes.has(serviceKey)) {
          startService(serviceKey, service);
        }
      }, RESTART_DELAY);
    }
  });
  
  processes.set(serviceKey, child);
  logger.info(`✅ ${name} started (PID: ${child.pid})`);
  
  return child;
}

/**
 * إيقاف خدمة
 */
async function stopService(serviceKey) {
  const child = processes.get(serviceKey);
  if (!child) return;
  
  const service = SERVICES[serviceKey];
  logger.info(`⏹️ Stopping ${service.name}...`);
  
  return new Promise((resolve) => {
    child.on('exit', () => {
      processes.delete(serviceKey);
      logger.info(`✅ ${service.name} stopped`);
      resolve();
    });
    
    // محاولة إيقاف سلس
    child.kill('SIGTERM');
    
    // إجبار الإيقاف بعد 10 ثوانٍ
    setTimeout(() => {
      if (processes.has(serviceKey)) {
        logger.warn(`⚠️ Force killing ${service.name}`);
        child.kill('SIGKILL');
      }
    }, 10000);
  });
}

/**
 * إيقاف جميع الخدمات
 */
async function stopAllServices() {
  logger.info('🛑 Stopping all services...');
  
  const stopPromises = Array.from(processes.keys()).map(key => stopService(key));
  await Promise.all(stopPromises);
  
  logger.info('✅ All services stopped');
}

/**
 * بدء جميع الخدمات أو خدمات محددة
 */
function startServices(servicesToStart = null) {
  const services = servicesToStart || Object.keys(SERVICES);
  
  logger.info('🚀 OBENTCHI Trading Bot - Process Manager');
  logger.info('==========================================');
  logger.info('');
  
  // بدء Redis أولاً
  logger.info('📡 Ensuring Redis is running...');
  const redis = spawn('./start-redis.sh', [], { stdio: 'inherit' });
  
  setTimeout(() => {
    logger.info('');
    logger.info('Starting services...');
    logger.info('');
    
    // بدء الخدمات بالترتيب
    services.forEach(key => {
      if (SERVICES[key]) {
        startService(key, SERVICES[key]);
      } else {
        logger.warn(`⚠️ Unknown service: ${key}`);
      }
    });
    
    logger.info('');
    logger.info('✅ All services started successfully!');
    logger.info('');
    logger.info('📊 Status:');
    Object.entries(SERVICES).forEach(([key, service]) => {
      const status = processes.has(key) ? '✅ Running' : '⏸️ Not started';
      logger.info(`  ${service.name}: ${status}`);
    });
    logger.info('');
    logger.info('Press Ctrl+C to stop all services');
    logger.info('');
  }, 2000);
}

// معالجة الإيقاف السلس
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('');
  logger.info('⚠️ Shutdown signal received...');
  await stopAllServices();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

// تحليل الأوامر
const args = process.argv.slice(2);

if (args.length === 0) {
  // تشغيل جميع الخدمات
  startServices();
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
OBENTCHI Process Manager

Usage:
  node process-manager.js [service...]

Services:
  http       - HTTP Server (API endpoints)
  bot        - Telegram Bot Worker
  queue      - Queue Worker (withdrawals, payments)
  scheduler  - Scheduled Jobs (monitoring, rankings)

Examples:
  node process-manager.js              # Start all services
  node process-manager.js http bot     # Start only HTTP and Bot
  node process-manager.js queue        # Start only Queue Worker

Options:
  --help, -h  Show this help message
  `);
} else {
  // تشغيل خدمات محددة
  startServices(args);
}

module.exports = { startServices, stopAllServices };
