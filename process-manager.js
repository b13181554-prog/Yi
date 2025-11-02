#!/usr/bin/env node

/**
 * Process Manager
 * يدير جميع الخدمات المنفصلة
 * يمكن تشغيل خدمة واحدة أو الكل معاً
 */

// تحميل المتغيرات البيئية من Replit Secrets
require('dotenv').config();

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

// تحديد الخدمات المتاحة
const SERVICES = {
  'http': {
    name: 'HTTP Server',
    script: 'services/http-server.js',
    color: '\x1b[36m', // Cyan
    required: true,
    modes: ['all', 'standalone', 'docker']
  },
  'bot': {
    name: 'Bot Worker (Polling)',
    script: 'services/bot-worker.js',
    color: '\x1b[35m', // Magenta
    required: true,
    modes: ['all', 'standalone', 'polling'],
    conflictsWith: ['bot-webhook']
  },
  'bot-webhook': {
    name: 'Bot Webhook Worker',
    script: 'services/bot-webhook-worker.js',
    color: '\x1b[95m', // Bright Magenta
    required: false,
    modes: ['webhook', 'docker'],
    conflictsWith: ['bot']
  },
  'queue': {
    name: 'Queue Worker',
    script: 'services/queue-worker.js',
    color: '\x1b[33m', // Yellow
    required: true,
    modes: ['all', 'standalone', 'docker']
  },
  'queue-improved': {
    name: 'Queue Worker (Improved)',
    script: 'improved-queue-worker.js',
    color: '\x1b[93m', // Bright Yellow
    required: false,
    modes: ['production'],
    conflictsWith: ['queue']
  },
  'scheduler': {
    name: 'Scheduler',
    script: 'services/scheduler.js',
    color: '\x1b[32m', // Green
    required: false,
    modes: ['all', 'standalone', 'docker']
  }
};

// تحديد الوضع التلقائي
function determineMode() {
  // webhook mode إذا كان PUBLIC_URL موجود
  if (process.env.PUBLIC_URL || process.env.WEBHOOK_URL) {
    return 'webhook';
  }
  
  // production mode إذا كان في بيئة production
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // docker mode إذا كان يعمل في container
  if (process.env.DEPLOYMENT_MODE === 'docker') {
    return 'docker';
  }
  
  // الوضع الافتراضي
  return 'standalone';
}

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
function startServices(servicesToStart = null, mode = null) {
  const deployMode = mode || determineMode();
  let services = servicesToStart || getServicesForMode(deployMode);
  
  logger.info('🚀 OBENTCHI Trading Bot - Process Manager');
  logger.info('==========================================');
  logger.info(`🌍 Mode: ${deployMode}`);
  logger.info('');
  
  // التحقق من التعارضات
  validateServices(services);
  
  // ملاحظة: Redis يعمل في workflow منفصل في Replit
  logger.info('📡 Assuming Redis is running (managed by separate workflow)');
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
  services.forEach(key => {
    const service = SERVICES[key];
    if (service) {
      const status = processes.has(key) ? '✅ Running' : '⏸️ Not started';
      logger.info(`  ${service.name}: ${status}`);
    }
  });
  logger.info('');
  logger.info('Press Ctrl+C to stop all services');
  logger.info('');
}

/**
 * الحصول على الخدمات المناسبة للوضع
 */
function getServicesForMode(mode) {
  const services = [];
  
  switch (mode) {
    case 'webhook':
      services.push('http', 'bot-webhook', 'queue', 'scheduler');
      break;
    case 'polling':
      services.push('http', 'bot', 'queue', 'scheduler');
      break;
    case 'production':
      services.push('http', 'bot-webhook', 'queue-improved', 'scheduler');
      break;
    case 'docker':
      // في Docker، كل خدمة تعمل في container منفصل
      // لذا نختار بناءً على SERVICE_NAME
      const serviceName = process.env.SERVICE_NAME;
      if (serviceName) {
        services.push(serviceName);
      }
      break;
    default: // standalone
      services.push('http', 'bot', 'queue', 'scheduler');
  }
  
  return services;
}

/**
 * التحقق من عدم وجود تعارضات بين الخدمات
 */
function validateServices(services) {
  const conflicts = [];
  
  services.forEach(serviceKey => {
    const service = SERVICES[serviceKey];
    if (service && service.conflictsWith) {
      service.conflictsWith.forEach(conflictKey => {
        if (services.includes(conflictKey)) {
          conflicts.push(`${serviceKey} conflicts with ${conflictKey}`);
        }
      });
    }
  });
  
  if (conflicts.length > 0) {
    logger.error('❌ Service conflicts detected:');
    conflicts.forEach(conflict => logger.error(`  - ${conflict}`));
    throw new Error('Cannot start services with conflicts');
  }
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
  // تشغيل جميع الخدمات بالوضع التلقائي
  startServices();
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
OBENTCHI Process Manager - Enhanced Edition

Usage:
  node process-manager.js [options] [services...]

Options:
  --mode <mode>     Deployment mode: standalone | webhook | polling | production | docker
  --help, -h        Show this help message

Modes:
  standalone        Default mode with polling bot (للتطوير المحلي)
  webhook           Webhook mode for production (يتطلب PUBLIC_URL)
  polling           Force polling mode
  production        Production mode with webhooks + improved queue workers
  docker            Auto-detect service from SERVICE_NAME env variable

Services:
  http              HTTP Server
  bot               Bot Worker (Polling mode)
  bot-webhook       Bot Webhook Worker (Webhook mode)
  queue             Queue Worker
  queue-improved    Improved Queue Worker with auto-scaling
  scheduler         Scheduler Service

Examples:
  node process-manager.js                    # Start all in auto mode
  node process-manager.js --mode webhook     # Start in webhook mode
  node process-manager.js http bot queue     # Start specific services
  node process-manager.js --mode production  # Start in production mode

Environment Variables:
  PUBLIC_URL        URL for webhooks (auto-enables webhook mode)
  NODE_ENV          Environment (development | production)
  DEPLOYMENT_MODE   Deployment mode override
  SERVICE_NAME      Service name for docker mode

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
