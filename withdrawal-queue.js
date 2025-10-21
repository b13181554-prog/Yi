const Queue = require('bull');
const pino = require('pino');
const db = require('./database');
const okx = require('./okx');
const config = require('./config');
const bot = require('./bot');
const { notifyUserSuccess, notifyOwnerSuccess, notifyOwnerFailedWithdrawal } = require('./withdrawal-notifier');

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

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

// Queue للسحوبات مع 10 محاولات
const withdrawalQueue = new Queue('withdrawals', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 10, // 10 محاولات
    backoff: {
      type: 'exponential',
      delay: 5000 // البداية 5 ثواني
    },
    removeOnComplete: {
      age: 86400 * 7, // أسبوع
      count: 5000
    },
    removeOnFail: {
      age: 86400 * 30 // شهر (للمراجعة)
    },
    timeout: 60000 // دقيقة واحدة max
  }
});

// Events للـ monitoring
withdrawalQueue.on('error', (error) => {
  logger.error(`❌ Withdrawal Queue Error: ${error.message}`);
});

withdrawalQueue.on('waiting', (jobId) => {
  logger.info(`⏳ Withdrawal job ${jobId} is waiting`);
});

withdrawalQueue.on('active', (job) => {
  logger.info(`▶️ Processing withdrawal job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
});

withdrawalQueue.on('completed', (job, result) => {
  logger.info(`✅ Withdrawal job ${job.id} completed successfully`);
});

withdrawalQueue.on('failed', (job, err) => {
  logger.error(`❌ Withdrawal job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
});

withdrawalQueue.on('stalled', (job) => {
  logger.warn(`⚠️ Withdrawal job ${job.id} stalled`);
});

// معالج السحوبات - سيتم تسجيله فقط من queue-worker.js
const withdrawalProcessor = async (job) => {
  const { requestId, userId, amount, walletAddress, userName } = job.data;
  
  logger.info(`🔄 Processing withdrawal for user ${userId}: ${amount} USDT to ${walletAddress}`);
  
  try {
    // التحقق من أن الطلب لا يزال معلقاً
    const request = await db.getWithdrawalRequest(requestId);
    
    if (!request) {
      throw new Error(`Withdrawal request ${requestId} not found`);
    }
    
    if (request.status !== 'pending') {
      logger.info(`ℹ️ Withdrawal ${requestId} already processed with status: ${request.status}`);
      return { 
        success: true, 
        message: 'Already processed', 
        status: request.status 
      };
    }

    // محاولة السحب عبر OKX
    if (!okx.isConfigured()) {
      throw new Error('OKX API is not configured');
    }

    const withdrawalResult = await okx.withdrawUSDT(walletAddress, amount, 'USDT-TRC20');
    
    if (!withdrawalResult.success) {
      throw new Error(withdrawalResult.error || 'OKX withdrawal failed');
    }

    // تحديث حالة الطلب في قاعدة البيانات (مع حماية من السحب المزدوج)
    try {
      await db.approveWithdrawal(requestId);
    } catch (approvalError) {
      // إذا فشلت الموافقة (مثلاً السحب تمت معالجته مسبقاً)
      if (approvalError.message.includes('تم معالجته مسبقاً')) {
        logger.warn(`⚠️ Withdrawal ${requestId} was already processed - skipping duplicate`);
        return { 
          success: true, 
          message: 'Already processed by another worker', 
          duplicate_prevented: true 
        };
      }
      throw approvalError;
    }

    // إضافة معاملة في السجل
    await db.createTransaction(
      userId,
      'withdrawal',
      amount,
      withdrawalResult.data.withdrawId,
      walletAddress,
      'completed'
    );

    logger.info(`✅ Withdrawal completed successfully for user ${userId}: ${amount} USDT`);

    // إرسال إشعار للمستخدم والمالك
    try {
      await notifyUserSuccess(userId, amount, walletAddress, withdrawalResult.data.withdrawId);
      await notifyOwnerSuccess(userId, userName, amount, walletAddress, withdrawalResult.data.withdrawId);
    } catch (notifError) {
      logger.error(`Failed to send notifications: ${notifError.message}`);
    }

    return {
      success: true,
      withdrawId: withdrawalResult.data.withdrawId,
      user_id: userId,
      amount: amount,
      address: walletAddress
    };

  } catch (error) {
    logger.error(`❌ Withdrawal processing error: ${error.message}`);
    
    // إذا وصلنا للمحاولة الأخيرة، نحتاج إشعار المالك
    if (job.attemptsMade >= job.opts.attempts - 1) {
      logger.error(`🚨 FINAL ATTEMPT FAILED for withdrawal ${requestId}. Needs manual intervention.`);
      
      // إرسال إشعار للمالك
      try {
        await notifyOwnerFailedWithdrawal(
          requestId,
          userId,
          userName,
          amount,
          walletAddress,
          error.message,
          job.attemptsMade + 1
        );
      } catch (notifError) {
        logger.error(`Failed to send failure notification: ${notifError.message}`);
      }
    }
    
    throw error; // للـ retry
  }
};

/**
 * تسجيل معالج السحوبات
 * يجب استدعاؤها فقط من queue-worker.js
 */
function startWithdrawalProcessor(concurrency = 5) {
  logger.info(`🔄 Starting withdrawal processor with ${concurrency} workers...`);
  withdrawalQueue.process(concurrency, withdrawalProcessor);
  logger.info('✅ Withdrawal processor started');
}

/**
 * إضافة طلب سحب للـ Queue
 */
async function addWithdrawalToQueue(requestId, userId, amount, walletAddress, userName = 'Unknown') {
  const jobId = `withdrawal-${requestId}`;
  
  // التحقق من عدم وجود job مكرر
  const existingJob = await withdrawalQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    logger.info(`Withdrawal job ${jobId} already exists with state: ${state}`);
    
    // إذا كان failed، نعيد المحاولة
    if (state === 'failed') {
      await existingJob.retry();
      logger.info(`♻️ Retrying failed withdrawal job ${jobId}`);
    }
    
    return existingJob;
  }

  const job = await withdrawalQueue.add(
    {
      requestId,
      userId,
      amount,
      walletAddress,
      userName
    },
    {
      jobId,
      priority: amount > 100 ? 1 : 2, // أولوية أعلى للمبالغ الكبيرة
      timeout: 60000
    }
  );
  
  logger.info(`📥 Withdrawal queued: ${job.id} for user ${userId}`);
  return job;
}

/**
 * الحصول على إحصائيات الـ Queue
 */
async function getWithdrawalQueueStats() {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    withdrawalQueue.getWaitingCount(),
    withdrawalQueue.getActiveCount(),
    withdrawalQueue.getCompletedCount(),
    withdrawalQueue.getFailedCount(),
    withdrawalQueue.getDelayedCount(),
    withdrawalQueue.getPausedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + delayed
  };
}

/**
 * الحصول على السحوبات الفاشلة التي تحتاج تدخل يدوي
 */
async function getFailedWithdrawals() {
  const failedJobs = await withdrawalQueue.getFailed();
  
  const failedWithdrawals = await Promise.all(
    failedJobs.map(async (job) => {
      const state = await job.getState();
      return {
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        state: state,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    })
  );
  
  // فقط الوظائف التي استنفذت جميع المحاولات
  return failedWithdrawals.filter(w => w.attemptsMade >= 10);
}

/**
 * إعادة محاولة السحوبات الفاشلة
 */
async function retryFailedWithdrawals() {
  const failedJobs = await withdrawalQueue.getFailed();
  let retriedCount = 0;
  
  for (const job of failedJobs) {
    if (job.attemptsMade < 10) {
      await job.retry();
      retriedCount++;
      logger.info(`♻️ Retrying withdrawal job ${job.id} (attempt ${job.attemptsMade + 1}/10)`);
    }
  }
  
  logger.info(`🔄 Retried ${retriedCount} failed withdrawal jobs`);
  return retriedCount;
}

/**
 * تنظيف الـ Queue
 */
async function cleanWithdrawalQueue() {
  const completedCleaned = await withdrawalQueue.clean(86400000 * 7, 'completed'); // أسبوع
  const failedCleaned = await withdrawalQueue.clean(86400000 * 30, 'failed'); // شهر
  logger.info(`🧹 Withdrawal queue cleaned: ${completedCleaned} completed, ${failedCleaned} failed`);
  return { completedCleaned, failedCleaned };
}

/**
 * إيقاف الـ Queue بشكل آمن
 */
async function closeWithdrawalQueue() {
  await withdrawalQueue.close();
  logger.info('🔴 Withdrawal queue closed');
}

module.exports = {
  withdrawalQueue,
  addWithdrawalToQueue,
  getWithdrawalQueueStats,
  getFailedWithdrawals,
  retryFailedWithdrawals,
  cleanWithdrawalQueue,
  closeWithdrawalQueue,
  startWithdrawalProcessor // دالة جديدة لتسجيل المعالج
};
