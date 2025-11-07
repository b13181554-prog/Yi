/**
 * Telegram Bot - Webhook Mode
 * دعم Webhooks بدلاً من Polling لملايين المستخدمين
 * يمكن تشغيل عدة نسخ متوازية بدون 409 conflict
 */

const pino = require('pino');
const db = require('./database');
const { BatchLoader } = require('./utils/batch-loader');

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

const bot = require('./bot');

let batchLoader;

/**
 * تهيئة الـ webhook مع Secret Token للأمان
 * @param {string} webhookUrl - URL الكامل للـ webhook
 * @param {string} secretToken - Secret token للتحقق (اختياري)
 */
async function setupWebhook(webhookUrl, secretToken = null) {
  try {
    // حذف أي webhook سابق
    await bot.deleteWebHook();
    logger.info('🗑️ Deleted old webhook');
    
    // تعيين webhook جديد
    const webhookOptions = {
      drop_pending_updates: false,
      max_connections: 100, // زيادة عدد الاتصالات المتزامنة
      allowed_updates: ['message', 'callback_query', 'inline_query']
    };
    
    // إضافة Secret Token فقط في AWS/Production
    if (secretToken) {
      webhookOptions.secret_token = secretToken;
      logger.info('🔒 Using secret token for webhook security');
    } else {
      logger.info('ℹ️ No secret token (running in development/Replit)');
    }
    
    const result = await bot.setWebHook(webhookUrl, webhookOptions);
    
    if (result) {
      logger.info(`✅ Webhook set successfully: ${webhookUrl}`);
      
      // التحقق من الإعداد
      const webhookInfo = await bot.getWebHookInfo();
      logger.info('📡 Webhook Info:', {
        url: webhookInfo.url,
        has_custom_certificate: webhookInfo.has_custom_certificate,
        pending_update_count: webhookInfo.pending_update_count,
        max_connections: webhookInfo.max_connections,
        allowed_updates: webhookInfo.allowed_updates
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`❌ Failed to setup webhook: ${error.message}`);
    throw error;
  }
}

/**
 * معالجة التحديثات الواردة من Telegram
 * @param {Object} update - التحديث من Telegram
 */
async function processUpdate(update) {
  try {
    await bot.processUpdate(update);
  } catch (error) {
    logger.error(`Error processing update ${update.update_id}:`, error);
  }
}

async function initializeBot() {
  try {
    logger.info('🤖 Initializing Telegram Bot (Webhook Mode)...');
    
    // تهيئة قاعدة البيانات
    await db.initDatabase();
    batchLoader = new BatchLoader(db.getDB());
    
    logger.info('✅ Database initialized');
    logger.info('✅ Bot ready for webhook updates');
    
    return true;
  } catch (error) {
    logger.error(`❌ Failed to initialize bot: ${error.message}`);
    throw error;
  }
}

// تصدير الدوال الضرورية
module.exports = {
  bot,
  setupWebhook,
  processUpdate,
  initializeBot
};
