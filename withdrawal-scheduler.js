const cron = require('node-cron');
const pino = require('pino');
const { 
  getWithdrawalQueueStats, 
  retryFailedWithdrawals, 
  cleanWithdrawalQueue 
} = require('./withdrawal-queue');
const { 
  checkAndNotifyFailedWithdrawals, 
  sendDailyWithdrawalReport 
} = require('./withdrawal-notifier');

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

/**
 * التحقق من السحوبات الفاشلة وإرسال إشعارات - كل 15 دقيقة
 */
const failedWithdrawalsCheck = cron.schedule('*/15 * * * *', async () => {
  try {
    logger.info('🔍 Checking for failed withdrawals...');
    const result = await checkAndNotifyFailedWithdrawals();
    
    if (result.success && result.count > 0) {
      logger.warn(`⚠️ Found and notified ${result.count} failed withdrawals`);
    } else {
      logger.info('✅ No failed withdrawals found');
    }
  } catch (error) {
    logger.error(`❌ Error in failed withdrawals check: ${error.message}`);
  }
}, {
  scheduled: false
});

/**
 * إعادة محاولة السحوبات الفاشلة - كل 30 دقيقة
 */
const retryFailedJob = cron.schedule('*/30 * * * *', async () => {
  try {
    logger.info('🔄 Retrying failed withdrawals...');
    const retriedCount = await retryFailedWithdrawals();
    
    if (retriedCount > 0) {
      logger.info(`♻️ Retried ${retriedCount} failed withdrawals`);
    } else {
      logger.info('✅ No failed withdrawals to retry');
    }
  } catch (error) {
    logger.error(`❌ Error in retry failed job: ${error.message}`);
  }
}, {
  scheduled: false
});

/**
 * تنظيف الـ Queue - كل 6 ساعات
 */
const cleanupJob = cron.schedule('0 */6 * * *', async () => {
  try {
    logger.info('🧹 Cleaning withdrawal queue...');
    const result = await cleanWithdrawalQueue();
    logger.info(`🧹 Queue cleaned: ${result.completedCleaned} completed, ${result.failedCleaned} failed jobs removed`);
  } catch (error) {
    logger.error(`❌ Error in cleanup job: ${error.message}`);
  }
}, {
  scheduled: false
});

/**
 * تقرير يومي - كل يوم الساعة 9 صباحاً
 */
const dailyReportJob = cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('📊 Generating daily withdrawal report...');
    const stats = await getWithdrawalQueueStats();
    await sendDailyWithdrawalReport(stats);
    logger.info('📊 Daily report sent successfully');
  } catch (error) {
    logger.error(`❌ Error in daily report job: ${error.message}`);
  }
}, {
  scheduled: false
});

/**
 * بدء جميع المهام المجدولة
 */
function startWithdrawalScheduler() {
  failedWithdrawalsCheck.start();
  retryFailedJob.start();
  cleanupJob.start();
  dailyReportJob.start();
  
  logger.info('✅ Withdrawal scheduler started');
  logger.info('   📋 Failed withdrawals check: Every 15 minutes');
  logger.info('   🔄 Retry failed withdrawals: Every 30 minutes');
  logger.info('   🧹 Queue cleanup: Every 6 hours');
  logger.info('   📊 Daily report: Every day at 9 AM');
}

/**
 * إيقاف جميع المهام المجدولة
 */
function stopWithdrawalScheduler() {
  failedWithdrawalsCheck.stop();
  retryFailedJob.stop();
  cleanupJob.stop();
  dailyReportJob.stop();
  
  logger.info('🔴 Withdrawal scheduler stopped');
}

/**
 * الحصول على حالة المهام المجدولة
 */
function getSchedulerStatus() {
  return {
    failedCheck: failedWithdrawalsCheck.getStatus ? failedWithdrawalsCheck.getStatus() : 'running',
    retryFailed: retryFailedJob.getStatus ? retryFailedJob.getStatus() : 'running',
    cleanup: cleanupJob.getStatus ? cleanupJob.getStatus() : 'running',
    dailyReport: dailyReportJob.getStatus ? dailyReportJob.getStatus() : 'running'
  };
}

module.exports = {
  startWithdrawalScheduler,
  stopWithdrawalScheduler,
  getSchedulerStatus
};
