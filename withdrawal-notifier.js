const bot = require('./bot');
const config = require('./config');
const pino = require('pino');
const { safeSendMessage } = require('./safe-message');
const { t } = require('./languages');
const db = require('./database');

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
 * إرسال إشعار للمالك عند نجاح السحب
 */
async function notifyOwnerSuccess(userId, userName, amount, address, withdrawId) {
  try {
    const lang = 'ar';
    const message = `
✅ <b>${t(lang, 'withdrawal_owner_success_title')}</b>

👤 <b>${t(lang, 'user_label')}</b> ${userName} (<code>${userId}</code>)
💰 <b>${t(lang, 'amount_label')}</b> ${amount} USDT
📍 <b>${t(lang, 'label_address')}</b> <code>${address}</code>
🆔 <b>${t(lang, 'label_withdrawal_id')}</b> <code>${withdrawId}</code>

⏰ <b>${t(lang, 'withdrawal_owner_success_time')}</b> ${new Date().toLocaleString('ar-SA')}
`;

    await safeSendMessage(bot, config.OWNER_ID, message, { parse_mode: 'HTML' });
    logger.info(`✅ Success notification sent to owner for withdrawal ${withdrawId}`);
  } catch (error) {
    logger.error(`Failed to send success notification to owner: ${error.message}`);
  }
}

/**
 * إرسال إشعار للمستخدم عند نجاح السحب
 */
async function notifyUserSuccess(userId, amount, address, withdrawId) {
  try {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    
    const message = `
✅ <b>${t(lang, 'withdrawal_user_success_title')}</b>

💰 <b>${t(lang, 'amount_label')}</b> ${amount} USDT
📍 <b>${t(lang, 'label_address')}</b> <code>${address}</code>
🆔 <b>${t(lang, 'withdrawal_user_transaction_id')}</b> <code>${withdrawId}</code>

⏰ ${t(lang, 'withdrawal_user_arrival_message')}
`;

    await safeSendMessage(bot, userId, message, { parse_mode: 'HTML' });
    logger.info(`✅ Success notification sent to user ${userId}`);
  } catch (error) {
    logger.error(`Failed to send success notification to user ${userId}: ${error.message}`);
  }
}

/**
 * إرسال إشعار للمالك عن سحب فاشل يحتاج تدخل يدوي
 */
async function notifyOwnerFailedWithdrawal(requestId, userId, userName, amount, address, errorMessage, attemptsMade) {
  try {
    const lang = 'ar';
    const message = `
🚨 <b>${t(lang, 'withdrawal_owner_failed_alert')}</b>

❌ <b>${t(lang, 'withdrawal_owner_failed_after_attempts').replace('{attempts}', attemptsMade)}</b>

━━━━━━━━━━━━━━━━━━━━
📋 <b>${t(lang, 'withdrawal_owner_request_details')}</b>
• <b>${t(lang, 'withdrawal_owner_request_id')}</b> <code>${requestId}</code>
• <b>${t(lang, 'user_label')}</b> ${userName} (<code>${userId}</code>)
• <b>${t(lang, 'amount_label')}</b> ${amount} USDT
• <b>${t(lang, 'label_address')}</b> <code>${address}</code>

━━━━━━━━━━━━━━━━━━━━
⚠️ <b>${t(lang, 'withdrawal_owner_failed_reason')}</b>
<code>${errorMessage || t(lang, 'withdrawal_owner_unknown_reason')}</code>

━━━━━━━━━━━━━━━━━━━━
📌 <b>${t(lang, 'withdrawal_owner_required_actions')}</b>
1️⃣ ${t(lang, 'withdrawal_owner_action_1')}
2️⃣ ${t(lang, 'withdrawal_owner_action_2')}
3️⃣ ${t(lang, 'withdrawal_owner_action_3')}
4️⃣ ${t(lang, 'withdrawal_owner_action_4')}

⏰ <b>${t(lang, 'withdrawal_owner_success_time')}</b> ${new Date().toLocaleString('ar-SA')}
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: t(lang, 'button_manual_approve'), callback_data: `manual_approve_${requestId}` },
          { text: t(lang, 'button_retry'), callback_data: `retry_withdrawal_${requestId}` }
        ],
        [
          { text: t(lang, 'button_reject'), callback_data: `reject_withdrawal_${requestId}` }
        ],
        [
          { text: t(lang, 'button_dashboard'), callback_data: 'admin_withdrawals' }
        ]
      ]
    };

    await safeSendMessage(bot, config.OWNER_ID, message, { 
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    logger.info(`🚨 Failure notification sent to owner for withdrawal ${requestId}`);
  } catch (error) {
    logger.error(`Failed to send failure notification to owner: ${error.message}`);
  }
}

/**
 * إرسال إشعار للمستخدم عن تأخير السحب
 */
async function notifyUserDelayedWithdrawal(userId, amount) {
  try {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    
    const message = `
⏳ <b>${t(lang, 'withdrawal_user_delayed_title')}</b>

💰 <b>${t(lang, 'amount_label')}</b> ${amount} USDT

${t(lang, 'withdrawal_user_delayed_message_1')}
${t(lang, 'withdrawal_user_delayed_message_2')}

⚠️ ${t(lang, 'withdrawal_user_delayed_warning')}

${t(lang, 'withdrawal_user_apology')}
`;

    await safeSendMessage(bot, userId, message, { parse_mode: 'HTML' });
    logger.info(`⏳ Delay notification sent to user ${userId}`);
  } catch (error) {
    logger.error(`Failed to send delay notification to user ${userId}: ${error.message}`);
  }
}

/**
 * فحص السحوبات الفاشلة وإرسال إشعارات دورية
 */
async function checkAndNotifyFailedWithdrawals() {
  try {
    const { getFailedWithdrawals } = require('./withdrawal-queue');
    const failedWithdrawals = await getFailedWithdrawals();
    
    if (failedWithdrawals.length === 0) {
      return { success: true, count: 0 };
    }

    logger.warn(`⚠️ Found ${failedWithdrawals.length} failed withdrawals that need manual intervention`);

    for (const failed of failedWithdrawals) {
      const { requestId, userId, amount, walletAddress, userName } = failed.data;
      
      await notifyOwnerFailedWithdrawal(
        requestId,
        userId,
        userName || 'Unknown',
        amount,
        walletAddress,
        failed.failedReason,
        failed.attemptsMade
      );
      
      await notifyUserDelayedWithdrawal(userId, amount);
      
      // تأخير صغير بين الإشعارات لتجنب rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { success: true, count: failedWithdrawals.length };
  } catch (error) {
    logger.error(`Error checking failed withdrawals: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * إرسال تقرير يومي للمالك عن السحوبات
 */
async function sendDailyWithdrawalReport(stats) {
  try {
    const lang = 'ar';
    const message = `
📊 <b>${t(lang, 'withdrawal_daily_report_title')}</b>

━━━━━━━━━━━━━━━━━━━━
📈 <b>${t(lang, 'withdrawal_daily_report_stats')}</b>
• ✅ ${t(lang, 'withdrawal_daily_report_completed')} ${stats.completed || 0}
• ⏳ ${t(lang, 'withdrawal_daily_report_active')} ${stats.active || 0}
• ⏰ ${t(lang, 'withdrawal_daily_report_waiting')} ${stats.waiting || 0}
• ❌ ${t(lang, 'withdrawal_daily_report_failed')} ${stats.failed || 0}

━━━━━━━━━━━━━━━━━━━━
⏰ <b>${t(lang, 'withdrawal_daily_report_date')}</b> ${new Date().toLocaleString('ar-SA', { dateStyle: 'full' })}
`;

    const keyboard = stats.failed > 0 ? {
      inline_keyboard: [
        [{ text: t(lang, 'button_view_failed_withdrawals'), callback_data: 'admin_failed_withdrawals' }],
        [{ text: t(lang, 'button_dashboard'), callback_data: 'admin_withdrawals' }]
      ]
    } : {
      inline_keyboard: [
        [{ text: t(lang, 'button_dashboard'), callback_data: 'admin_withdrawals' }]
      ]
    };

    await safeSendMessage(bot, config.OWNER_ID, message, { 
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    logger.info(`📊 Daily withdrawal report sent to owner`);
  } catch (error) {
    logger.error(`Failed to send daily report: ${error.message}`);
  }
}

module.exports = {
  notifyOwnerSuccess,
  notifyUserSuccess,
  notifyOwnerFailedWithdrawal,
  notifyUserDelayedWithdrawal,
  checkAndNotifyFailedWithdrawals,
  sendDailyWithdrawalReport
};
