const Queue = require('bull');
const pino = require('pino');
const db = require('./database');
const bot = require('./bot');
const config = require('./config');
const { safeSendMessage } = require('./safe-message');

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

const paymentCallbackQueue = new Queue('payment-callbacks', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 86400,
      count: 1000
    },
    removeOnFail: {
      age: 172800
    }
  }
});

paymentCallbackQueue.on('error', (error) => {
  logger.error(`❌ Payment Queue Error: ${error.message}`);
});

paymentCallbackQueue.on('waiting', (jobId) => {
  logger.info(`⏳ Job ${jobId} is waiting`);
});

paymentCallbackQueue.on('active', (job) => {
  logger.info(`▶️ Processing payment callback job ${job.id}`);
});

paymentCallbackQueue.on('completed', (job, result) => {
  logger.info(`✅ Job ${job.id} completed: ${JSON.stringify(result)}`);
});

paymentCallbackQueue.on('failed', (job, err) => {
  logger.error(`❌ Job ${job.id} failed: ${err.message}`);
});

paymentCallbackQueue.on('stalled', (job) => {
  logger.warn(`⚠️ Job ${job.id} stalled`);
});

// معالج callbacks - سيتم تسجيله فقط من queue-worker.js
const paymentProcessor = async (job) => {
  const { callbackData, idempotencyKey } = job.data;
  
  logger.info(`🔄 Processing payment for address: ${callbackData.address_in}`);
  
  try {
    const paymentAddress = callbackData.address_in;
    const payment = await db.getCryptAPIPayment(paymentAddress);
    
    if (!payment) {
      throw new Error(`Payment not found for address: ${paymentAddress}`);
    }

    if (payment.idempotency_key && payment.idempotency_key === idempotencyKey && payment.status === 'completed') {
      logger.info(`ℹ️ Payment already processed with this idempotency key: ${idempotencyKey}`);
      return { success: true, message: 'Already processed', duplicate: true };
    }

    if (payment.status === 'completed' && !payment.idempotency_key) {
      logger.info(`ℹ️ Payment already completed: ${paymentAddress}`);
      return { success: true, message: 'Already completed', duplicate: true };
    }

    const confirmations = parseInt(callbackData.confirmations);
    const valueCoin = parseFloat(callbackData.value_coin);
    const txId = callbackData.txid_in;
    
    const isConfirmed = callbackData.pending === '0' && confirmations >= 1;

    await db.updateCryptAPIPayment(paymentAddress, {
      tx_id: txId,
      confirmations: confirmations,
      status: isConfirmed ? 'completed' : 'confirmed',
      idempotency_key: idempotencyKey
    });

    if (isConfirmed) {
      const user = await db.getUser(payment.user_id);
      
      if (!user) {
        throw new Error(`User ${payment.user_id} not found`);
      }

      const currentBalance = user.balance || 0;
      const newBalance = currentBalance + payment.amount;

      await db.updateUserBalance(payment.user_id, newBalance);

      await db.addTransaction({
        user_id: payment.user_id,
        type: 'deposit',
        amount: payment.amount,
        status: 'completed',
        tx_id: txId,
        payment_method: 'cryptapi_usdt_trc20',
        created_at: new Date()
      });

      logger.info(`✅ Payment completed for user ${payment.user_id}: ${payment.amount} USDT`);

      try {
        await safeSendMessage(bot, 
          payment.user_id,
          `✅ تم استلام إيداعك بنجاح!\n\n💰 المبلغ: ${payment.amount} USDT\n📊 رصيدك الجديد: ${newBalance} USDT\n🔗 TX: ${txId}`
        );
      } catch (botError) {
        logger.error(`Failed to send notification to user: ${botError.message}`);
      }

      try {
        await safeSendMessage(bot, 
          config.OWNER_ID,
          `🔔 إيداع جديد\n\n👤 المستخدم: ${payment.user_id}\n💰 المبلغ: ${payment.amount} USDT\n📊 الرصيد الجديد: ${newBalance} USDT\n🔗 TX: ${txId}`
        );
      } catch (ownerError) {
        logger.error(`Failed to send notification to owner: ${ownerError.message}`);
      }

      return {
        success: true,
        message: 'Payment processed successfully',
        user_id: payment.user_id,
        amount: payment.amount,
        new_balance: newBalance
      };
    } else {
      logger.info(`⏳ Payment confirmed but waiting for more confirmations: ${confirmations}/1`);
      return {
        success: true,
        message: 'Payment confirmed, waiting for more confirmations',
        confirmations: confirmations
      };
    }

  } catch (error) {
    logger.error(`❌ Payment processing error: ${error.message}`);
    throw error;
  }
};

/**
 * تسجيل معالج المدفوعات
 * يجب استدعاؤها فقط من queue-worker.js
 */
function startPaymentProcessor(concurrency = 3) {
  logger.info(`🔄 Starting payment processor with ${concurrency} workers...`);
  paymentCallbackQueue.process(concurrency, paymentProcessor);
  logger.info('✅ Payment processor started');
}

async function addPaymentCallback(callbackData, idempotencyKey) {
  const jobId = `payment-${callbackData.address_in}-${idempotencyKey}`;
  
  const existingJob = await paymentCallbackQueue.getJob(jobId);
  if (existingJob) {
    logger.info(`Job ${jobId} already exists, skipping duplicate`);
    return existingJob;
  }

  const job = await paymentCallbackQueue.add(
    { callbackData, idempotencyKey },
    {
      jobId,
      priority: 1,
      timeout: 30000
    }
  );
  
  logger.info(`📥 Payment callback queued: ${job.id}`);
  return job;
}

async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    paymentCallbackQueue.getWaitingCount(),
    paymentCallbackQueue.getActiveCount(),
    paymentCallbackQueue.getCompletedCount(),
    paymentCallbackQueue.getFailedCount(),
    paymentCallbackQueue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed
  };
}

async function retryFailed() {
  const failedJobs = await paymentCallbackQueue.getFailed();
  let retriedCount = 0;
  
  for (const job of failedJobs) {
    if (job.attemptsMade < 5) {
      await job.retry();
      retriedCount++;
    }
  }
  
  logger.info(`🔄 Retried ${retriedCount} failed jobs`);
  return retriedCount;
}

async function cleanQueue() {
  await paymentCallbackQueue.clean(86400000, 'completed');
  await paymentCallbackQueue.clean(172800000, 'failed');
  logger.info(`🧹 Queue cleaned`);
}

module.exports = {
  paymentCallbackQueue,
  addPaymentCallback,
  getQueueStats,
  retryFailed,
  cleanQueue,
  startPaymentProcessor // دالة جديدة لتسجيل المعالج
};
