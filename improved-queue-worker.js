#!/usr/bin/env node

/**
 * Improved Queue Worker with Dynamic Auto-Scaling
 * معالج طوابير محسّن مع توسيع تلقائي ديناميكي
 * يدعم ملايين العمليات في الدقيقة
 */

const pino = require('pino');
const db = require('./database');
const { withdrawalQueue, startWithdrawalProcessor } = require('./withdrawal-queue');
const { paymentCallbackQueue, startPaymentProcessor } = require('./payment-callback-queue');

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

// إعدادات التوسع الديناميكي
const SCALING_CONFIG = {
  withdrawal: {
    minWorkers: parseInt(process.env.MIN_WITHDRAWAL_WORKERS) || 5,
    maxWorkers: parseInt(process.env.MAX_WITHDRAWAL_WORKERS) || 100,
    scaleUpThreshold: 100,    // توسيع عند 100+ عملية معلقة
    scaleDownThreshold: 20,   // تقليص عند أقل من 20 عملية
    scaleUpIncrement: 10,     // زيادة 10 workers في كل مرة
    scaleDownIncrement: 5,    // تقليل 5 workers في كل مرة
    checkInterval: 30000      // فحص كل 30 ثانية
  },
  payment: {
    minWorkers: parseInt(process.env.MIN_PAYMENT_WORKERS) || 3,
    maxWorkers: parseInt(process.env.MAX_PAYMENT_WORKERS) || 50,
    scaleUpThreshold: 50,
    scaleDownThreshold: 10,
    scaleUpIncrement: 5,
    scaleDownIncrement: 2,
    checkInterval: 30000
  }
};

class DynamicQueueScaler {
  constructor(queueName, queue, config) {
    this.queueName = queueName;
    this.queue = queue;
    this.config = config;
    this.currentWorkers = config.minWorkers;
    this.scalingInterval = null;
    this.metrics = {
      scaleUps: 0,
      scaleDowns: 0,
      totalProcessed: 0,
      lastScaleTime: Date.now()
    };
  }

  async checkAndScale() {
    try {
      const waiting = await this.queue.getWaitingCount();
      const active = await this.queue.getActiveCount();
      const total = waiting + active;

      logger.info(`📊 ${this.queueName} Queue Stats:`, {
        waiting,
        active,
        total,
        currentWorkers: this.currentWorkers
      });

      // قرار التوسيع للأعلى
      if (total >= this.config.scaleUpThreshold && this.currentWorkers < this.config.maxWorkers) {
        const newWorkers = Math.min(
          this.currentWorkers + this.config.scaleUpIncrement,
          this.config.maxWorkers
        );
        
        const increment = newWorkers - this.currentWorkers;
        if (increment > 0) {
          await this.scaleUp(increment);
        }
      }
      // قرار التقليص للأسفل
      else if (total <= this.config.scaleDownThreshold && this.currentWorkers > this.config.minWorkers) {
        const newWorkers = Math.max(
          this.currentWorkers - this.config.scaleDownIncrement,
          this.config.minWorkers
        );
        
        const decrement = this.currentWorkers - newWorkers;
        if (decrement > 0) {
          await this.scaleDown(decrement);
        }
      }

      // تسجيل المقاييس
      const completed = await this.queue.getCompletedCount();
      const failed = await this.queue.getFailedCount();
      
      logger.info(`📈 ${this.queueName} Metrics:`, {
        completed,
        failed,
        scaleUps: this.metrics.scaleUps,
        scaleDowns: this.metrics.scaleDowns,
        workers: this.currentWorkers
      });

    } catch (error) {
      logger.error(`Error in auto-scaling ${this.queueName}:`, error);
    }
  }

  async scaleUp(increment) {
    logger.info(`📈 Scaling UP ${this.queueName}: +${increment} workers (${this.currentWorkers} → ${this.currentWorkers + increment})`);
    
    // ملاحظة: Bull لا يدعم تغيير الـ concurrency dynamically
    // يجب إعادة تشغيل الـ processor مع العدد الجديد
    // في بيئة production، يمكن استخدام Kubernetes HPA
    
    this.currentWorkers += increment;
    this.metrics.scaleUps++;
    this.metrics.lastScaleTime = Date.now();

    // في بيئة containerized، يمكن إرسال signal للـ orchestrator
    logger.warn(`⚠️ To apply scaling, restart queue worker with CONCURRENCY=${this.currentWorkers}`);
  }

  async scaleDown(decrement) {
    logger.info(`📉 Scaling DOWN ${this.queueName}: -${decrement} workers (${this.currentWorkers} → ${this.currentWorkers - decrement})`);
    
    this.currentWorkers -= decrement;
    this.metrics.scaleDowns++;
    this.metrics.lastScaleTime = Date.now();

    logger.warn(`⚠️ To apply scaling, restart queue worker with CONCURRENCY=${this.currentWorkers}`);
  }

  start() {
    logger.info(`🚀 Starting auto-scaler for ${this.queueName} queue`);
    logger.info(`📊 Config:`, this.config);
    
    // فحص فوري
    this.checkAndScale();
    
    // فحص دوري
    this.scalingInterval = setInterval(
      () => this.checkAndScale(),
      this.config.checkInterval
    );
  }

  stop() {
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
      this.scalingInterval = null;
      logger.info(`⏹️ Stopped auto-scaler for ${this.queueName} queue`);
    }
  }

  getMetrics() {
    return {
      queueName: this.queueName,
      currentWorkers: this.currentWorkers,
      ...this.metrics
    };
  }
}

// Auto-scalers
let withdrawalScaler;
let paymentScaler;

const startImprovedQueueWorker = async () => {
  try {
    logger.info('⚙️ Starting Improved Queue Worker with Auto-Scaling...');
    
    // تهيئة قاعدة البيانات
    logger.info('📊 Initializing database...');
    await db.initDatabase();
    logger.info('✅ Database initialized');
    
    // الحصول على الـ concurrency من المتغيرات البيئية
    const withdrawalConcurrency = parseInt(process.env.WITHDRAWAL_CONCURRENCY) || SCALING_CONFIG.withdrawal.minWorkers;
    const paymentConcurrency = parseInt(process.env.PAYMENT_CONCURRENCY) || SCALING_CONFIG.payment.minWorkers;
    
    // بدء Queue processors
    logger.info('🚀 Starting queue processors...');
    startWithdrawalProcessor(withdrawalConcurrency);
    startPaymentProcessor(paymentConcurrency);
    
    logger.info('✅ Queue processors started');
    logger.info(`📥 Withdrawal queue: ${withdrawalConcurrency} concurrent workers`);
    logger.info(`💳 Payment callback queue: ${paymentConcurrency} concurrent workers`);
    
    // بدء Auto-scaling (إذا كان مفعّلاً)
    const autoScalingEnabled = process.env.AUTO_SCALING_ENABLED !== 'false';
    
    if (autoScalingEnabled) {
      logger.info('🤖 Starting auto-scaling monitors...');
      
      withdrawalScaler = new DynamicQueueScaler(
        'Withdrawal',
        withdrawalQueue,
        SCALING_CONFIG.withdrawal
      );
      withdrawalScaler.start();
      
      paymentScaler = new DynamicQueueScaler(
        'Payment',
        paymentCallbackQueue,
        SCALING_CONFIG.payment
      );
      paymentScaler.start();
      
      logger.info('✅ Auto-scaling enabled');
      
      // تقرير دوري عن المقاييس
      setInterval(() => {
        logger.info('📊 Auto-Scaling Metrics:', {
          withdrawal: withdrawalScaler.getMetrics(),
          payment: paymentScaler.getMetrics()
        });
      }, 60000); // كل دقيقة
    } else {
      logger.info('ℹ️ Auto-scaling disabled');
    }
    
    logger.info('✅ Improved Queue Worker is running');
    logger.info('♻️ Auto-retry enabled with exponential backoff');
    logger.info('📊 Dynamic scaling: ' + (autoScalingEnabled ? 'ENABLED' : 'DISABLED'));
    
  } catch (error) {
    logger.error(`❌ Failed to start Improved Queue Worker: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('⚠️ Shutting down Improved Queue Worker gracefully...');
  
  try {
    // إيقاف auto-scalers
    if (withdrawalScaler) withdrawalScaler.stop();
    if (paymentScaler) paymentScaler.stop();
    
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
    
    logger.info('✅ Improved Queue Worker shut down successfully');
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

// Start the worker
if (require.main === module) {
  startImprovedQueueWorker();
}

module.exports = { 
  startImprovedQueueWorker,
  DynamicQueueScaler,
  SCALING_CONFIG
};
