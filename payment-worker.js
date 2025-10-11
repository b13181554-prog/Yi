const { paymentQueue, withdrawalQueue } = require('./payment-queue');
const tronEnhanced = require('./tron-enhanced');
const db = require('./database');
const config = require('./config');
const okx = require('./okx');
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

let bot = null;

function initWorker(telegramBot) {
  bot = telegramBot;
  logger.info('🚀 Payment worker initialized');
}

paymentQueue.process('verify-payment', 10, async (job) => {
  const { txId, userId, expectedAmount } = job.data;
  
  try {
    logger.info(`🔍 Processing payment verification: ${txId}`);
    
    const existingTx = await db.getTransactionByTxId(txId);
    if (existingTx) {
      logger.warn(`⚠️ Transaction ${txId} already processed`);
      return { success: false, error: 'Transaction already processed' };
    }

    const result = await tronEnhanced.verifyUSDTTransaction(
      txId,
      config.BOT_WALLET_ADDRESS,
      expectedAmount
    );
    
    if (!result.success) {
      logger.warn(`❌ Payment verification failed for ${txId}: ${result.error}`);
      
      if (result.status === 'pending') {
        throw new Error('Transaction still pending');
      }
      
      return result;
    }

    await db.createTransaction(
      userId,
      'deposit',
      result.data.amount,
      txId,
      result.data.from,
      'completed'
    );
    
    await db.updateUserBalance(userId, result.data.amount);
    
    const user = await db.getUser(userId);
    
    if (bot) {
      try {
        await bot.sendMessage(userId, `
✅ <b>تم تأكيد الإيداع!</b>

المبلغ: ${result.data.amount} USDT
تم إضافته لرصيدك بنجاح 🎉
        `, { parse_mode: 'HTML' });
        
        await bot.sendMessage(config.OWNER_ID, `
💵 <b>إيداع جديد</b>

المستخدم: ${user.first_name} (@${user.username})
ID: ${userId}
المبلغ: ${result.data.amount} USDT
TxID: <code>${txId}</code>
        `, { parse_mode: 'HTML' });
      } catch (msgError) {
        logger.error(`❌ Failed to send notification: ${msgError.message}`);
      }
    }
    
    logger.info(`✅ Payment processed successfully: ${txId} - ${result.data.amount} USDT`);
    
    return {
      success: true,
      amount: result.data.amount,
      userId: userId
    };
    
  } catch (error) {
    logger.error(`❌ Payment processing error: ${error.message}`);
    throw error;
  }
});

withdrawalQueue.process('process-withdrawal', 3, async (job) => {
  const { userId, address, amount } = job.data;
  
  try {
    logger.info(`💸 Processing withdrawal for user ${userId}: ${amount} USDT`);
    
    if (!okx.isConfigured()) {
      logger.warn('⚠️ OKX not configured, creating manual withdrawal request');
      
      await db.createWithdrawalRequest(userId, amount, address);
      
      const user = await db.getUser(userId);
      
      if (bot) {
        try {
          await bot.sendMessage(userId, `
⚠️ <b>السحب التلقائي غير متاح حالياً</b>

تم إنشاء طلب السحب وسيتم معالجته يدوياً خلال 24 ساعة.

المبلغ المحجوز: ${amount} USDT
الرسوم: ${config.WITHDRAWAL_FEE} USDT
العنوان: <code>${address}</code>

سيتم إعلامك فور المعالجة 📬
          `, { parse_mode: 'HTML' });
          
          await bot.sendMessage(config.OWNER_ID, `
💸 <b>طلب سحب جديد (يدوي)</b>

المستخدم: ${user.first_name} (@${user.username})
ID: ${userId}
المبلغ: ${amount} USDT
العنوان: <code>${address}</code>

⚠️ الأموال محجوزة - يجب المعالجة يدوياً
          `, { parse_mode: 'HTML' });
        } catch (msgError) {
          logger.error(`❌ Failed to send notification: ${msgError.message}`);
        }
      }
      
      return { success: true, manual: true };
    }

    const withdrawResult = await okx.withdrawUSDT(address, amount);
    
    if (!withdrawResult.success) {
      logger.error(`❌ OKX withdrawal failed: ${withdrawResult.error}`);
      
      const user = await db.getUser(userId);
      await db.updateUserBalance(userId, amount + config.WITHDRAWAL_FEE);
      
      if (bot) {
        try {
          await bot.sendMessage(userId, `
❌ <b>فشل السحب</b>

${withdrawResult.error}

تم إرجاع المبلغ لرصيدك.
يرجى المحاولة لاحقاً أو التواصل مع الدعم.
          `, { parse_mode: 'HTML' });
        } catch (msgError) {
          logger.error(`❌ Failed to send notification: ${msgError.message}`);
        }
      }
      
      throw new Error(withdrawResult.error);
    }

    await db.createTransaction(
      userId,
      'withdrawal',
      amount,
      withdrawResult.data.withdrawId,
      address,
      'completed'
    );
    
    const user = await db.getUser(userId);
    
    if (bot) {
      try {
        await bot.sendMessage(userId, `
✅ <b>تم السحب بنجاح!</b>

المبلغ: ${amount} USDT
الرسوم: ${config.WITHDRAWAL_FEE} USDT
العنوان: <code>${address}</code>

معرف السحب: <code>${withdrawResult.data.withdrawId}</code>

سيصل المبلغ خلال دقائق 🎉
        `, { parse_mode: 'HTML' });
        
        await bot.sendMessage(config.OWNER_ID, `
💸 <b>سحب ناجح</b>

المستخدم: ${user.first_name} (@${user.username})
المبلغ: ${amount} USDT
WD ID: <code>${withdrawResult.data.withdrawId}</code>
        `, { parse_mode: 'HTML' });
      } catch (msgError) {
        logger.error(`❌ Failed to send notification: ${msgError.message}`);
      }
    }
    
    logger.info(`✅ Withdrawal processed successfully for user ${userId}`);
    
    return {
      success: true,
      withdrawId: withdrawResult.data.withdrawId
    };
    
  } catch (error) {
    logger.error(`❌ Withdrawal processing error: ${error.message}`);
    throw error;
  }
});

paymentQueue.on('error', (error) => {
  logger.error(`❌ Payment queue error: ${error.message}`);
});

withdrawalQueue.on('error', (error) => {
  logger.error(`❌ Withdrawal queue error: ${error.message}`);
});

logger.info('✅ Payment workers registered successfully');

module.exports = { initWorker };
