const Queue = require('bull');
const Redis = require('ioredis');
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

const redisClient = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('❌ Redis connection failed after 10 retries');
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
});

redisClient.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  logger.error(`❌ Redis error: ${err.message}`);
});

const paymentQueue = new Queue('payment-verification', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  },
  limiter: {
    max: 100,
    duration: 1000
  }
});

const withdrawalQueue = new Queue('withdrawal-processing', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: 50,
    removeOnFail: 100
  }
});

async function addPaymentVerification(txId, userId, expectedAmount) {
  try {
    const job = await paymentQueue.add('verify-payment', {
      txId,
      userId,
      expectedAmount,
      timestamp: Date.now()
    }, {
      jobId: `payment-${txId}`,
      priority: 1
    });
    
    logger.info(`➕ Payment verification job added: ${txId}`);
    return job;
  } catch (error) {
    logger.error(`❌ Failed to add payment job: ${error.message}`);
    throw error;
  }
}

async function addWithdrawal(userId, address, amount) {
  try {
    const job = await withdrawalQueue.add('process-withdrawal', {
      userId,
      address,
      amount,
      timestamp: Date.now()
    }, {
      jobId: `withdrawal-${userId}-${Date.now()}`,
      priority: 2
    });
    
    logger.info(`➕ Withdrawal job added for user ${userId}`);
    return job;
  } catch (error) {
    logger.error(`❌ Failed to add withdrawal job: ${error.message}`);
    throw error;
  }
}

async function getJobStatus(jobId) {
  try {
    const job = await paymentQueue.getJob(jobId);
    if (!job) {
      const withdrawalJob = await withdrawalQueue.getJob(jobId);
      return withdrawalJob ? withdrawalJob.getState() : null;
    }
    return job.getState();
  } catch (error) {
    logger.error(`❌ Failed to get job status: ${error.message}`);
    return null;
  }
}

async function getQueueStats() {
  try {
    const [
      paymentWaiting,
      paymentActive,
      paymentCompleted,
      paymentFailed,
      withdrawalWaiting,
      withdrawalActive
    ] = await Promise.all([
      paymentQueue.getWaitingCount(),
      paymentQueue.getActiveCount(),
      paymentQueue.getCompletedCount(),
      paymentQueue.getFailedCount(),
      withdrawalQueue.getWaitingCount(),
      withdrawalQueue.getActiveCount()
    ]);
    
    return {
      payment: {
        waiting: paymentWaiting,
        active: paymentActive,
        completed: paymentCompleted,
        failed: paymentFailed
      },
      withdrawal: {
        waiting: withdrawalWaiting,
        active: withdrawalActive
      },
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error(`❌ Failed to get queue stats: ${error.message}`);
    return null;
  }
}

paymentQueue.on('completed', (job, result) => {
  logger.info(`✅ Payment job completed: ${job.id}`);
});

paymentQueue.on('failed', (job, err) => {
  logger.error(`❌ Payment job failed: ${job.id} - ${err.message}`);
});

withdrawalQueue.on('completed', (job, result) => {
  logger.info(`✅ Withdrawal job completed: ${job.id}`);
});

withdrawalQueue.on('failed', (job, err) => {
  logger.error(`❌ Withdrawal job failed: ${job.id} - ${err.message}`);
});

module.exports = {
  paymentQueue,
  withdrawalQueue,
  addPaymentVerification,
  addWithdrawal,
  getJobStatus,
  getQueueStats,
  redisClient
};
