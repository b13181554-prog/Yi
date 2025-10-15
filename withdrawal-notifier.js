const bot = require('./bot');
const config = require('./config');
const pino = require('pino');
const { getFailedWithdrawals } = require('./withdrawal-queue');
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

/**
 * إرسال إشعار للمالك عند نجاح السحب
 */
async function notifyOwnerSuccess(userId, userName, amount, address, withdrawId) {
  try {
    const message = `
✅ <b>سحب ناجح تلقائياً</b>

👤 <b>المستخدم:</b> ${userName} (<code>${userId}</code>)
💰 <b>المبلغ:</b> ${amount} USDT
📍 <b>العنوان:</b> <code>${address}</code>
🆔 <b>معرف السحب:</b> <code>${withdrawId}</code>

⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
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
    const message = `
✅ <b>تم إتمام السحب بنجاح!</b>

💰 <b>المبلغ:</b> ${amount} USDT
📍 <b>العنوان:</b> <code>${address}</code>
🆔 <b>معرف المعاملة:</b> <code>${withdrawId}</code>

⏰ سيصل المبلغ خلال دقائق قليلة
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
    const message = `
🚨 <b>تنبيه: سحب فاشل - يحتاج تدخل يدوي!</b>

❌ <b>فشل بعد ${attemptsMade} محاولات</b>

━━━━━━━━━━━━━━━━━━━━
📋 <b>تفاصيل الطلب:</b>
• <b>معرف الطلب:</b> <code>${requestId}</code>
• <b>المستخدم:</b> ${userName} (<code>${userId}</code>)
• <b>المبلغ:</b> ${amount} USDT
• <b>العنوان:</b> <code>${address}</code>

━━━━━━━━━━━━━━━━━━━━
⚠️ <b>سبب الفشل:</b>
<code>${errorMessage || 'غير محدد'}</code>

━━━━━━━━━━━━━━━━━━━━
📌 <b>الإجراءات المطلوبة:</b>
1️⃣ تحقق من رصيد OKX
2️⃣ تحقق من صحة العنوان
3️⃣ قم بالسحب يدوياً من OKX
4️⃣ قم بتأكيد الطلب في لوحة التحكم

⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ تم السحب يدوياً', callback_data: `manual_approve_${requestId}` },
          { text: '🔄 إعادة المحاولة', callback_data: `retry_withdrawal_${requestId}` }
        ],
        [
          { text: '❌ رفض الطلب', callback_data: `reject_withdrawal_${requestId}` }
        ],
        [
          { text: '📊 لوحة التحكم', callback_data: 'admin_withdrawals' }
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
    const message = `
⏳ <b>طلب السحب قيد المعالجة</b>

💰 <b>المبلغ:</b> ${amount} USDT

نواجه تأخيراً مؤقتاً في معالجة طلب السحب الخاص بك.
سيتم إتمام العملية قريباً، وسنرسل لك إشعاراً فور الانتهاء.

⚠️ إذا استمر التأخير، سيتم معالجة الطلب يدوياً من قبل الإدارة.

نعتذر عن الإزعاج! 🙏
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
    const message = `
📊 <b>تقرير السحوبات اليومي</b>

━━━━━━━━━━━━━━━━━━━━
📈 <b>الإحصائيات:</b>
• ✅ سحوبات ناجحة: ${stats.completed || 0}
• ⏳ قيد المعالجة: ${stats.active || 0}
• ⏰ في الانتظار: ${stats.waiting || 0}
• ❌ فاشلة (تحتاج تدخل): ${stats.failed || 0}

━━━━━━━━━━━━━━━━━━━━
⏰ <b>التاريخ:</b> ${new Date().toLocaleString('ar-SA', { dateStyle: 'full' })}
`;

    const keyboard = stats.failed > 0 ? {
      inline_keyboard: [
        [{ text: '🚨 عرض السحوبات الفاشلة', callback_data: 'admin_failed_withdrawals' }],
        [{ text: '📊 لوحة التحكم', callback_data: 'admin_withdrawals' }]
      ]
    } : {
      inline_keyboard: [
        [{ text: '📊 لوحة التحكم', callback_data: 'admin_withdrawals' }]
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
