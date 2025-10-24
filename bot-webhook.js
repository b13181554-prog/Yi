/**
 * Telegram Bot - Webhook Mode
 * دعم Webhooks بدلاً من Polling لملايين المستخدمين
 * يمكن تشغيل عدة نسخ متوازية بدون 409 conflict
 */

const TelegramBot = require('node-telegram-bot-api');
const { LRUCache } = require('lru-cache');
const config = require('./config');
const db = require('./database');
const { t, getLanguageKeyboard } = require('./languages');
const { safeSendMessage, safeSendPhoto, safeEditMessageText, safeAnswerCallbackQuery } = require('./safe-message');
const { BatchLoader } = require('./utils/batch-loader');
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

// إنشاء البوت بدون polling (webhook mode فقط)
const bot = new TelegramBot(config.BOT_TOKEN, { 
  polling: false,
  webHook: false // سيتم تفعيله يدوياً
});

let batchLoader;

// ✅ استخدام LRU Cache مع حد أقصى لمنع memory leak
const membershipCache = new LRUCache({
  max: 50000,           // زيادة الحد للـ webhooks (أكثر كفاءة)
  ttl: 60 * 1000,       
  updateAgeOnGet: true,
  allowStale: false
});

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
    
    // تعيين webhook جديد مع Secret Token
    const webhookOptions = {
      drop_pending_updates: false,
      max_connections: 100, // زيادة عدد الاتصالات المتزامنة
      allowed_updates: ['message', 'callback_query', 'inline_query']
    };
    
    // إضافة Secret Token إذا كان متاحاً
    if (secretToken) {
      webhookOptions.secret_token = secretToken;
      logger.info('🔒 Using secret token for webhook security');
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
    // معالجة الرسائل
    if (update.message) {
      await bot.processUpdate(update);
    }
    // معالجة الـ callback queries
    else if (update.callback_query) {
      await bot.processUpdate(update);
    }
    // معالجة الـ inline queries
    else if (update.inline_query) {
      await bot.processUpdate(update);
    }
  } catch (error) {
    logger.error(`Error processing update ${update.update_id}:`, error);
  }
}

/**
 * التحقق من عضوية القناة
 */
async function checkChannelMembership(userId) {
  try {
    const cached = membershipCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }
    
    const member = await bot.getChatMember(config.CHANNEL_ID, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    
    membershipCache.set(userId, isMember);
    
    return isMember;
  } catch (error) {
    logger.error('Error checking channel membership:', error.message);
    return false;
  }
}

async function requireChannelMembership(userId, chatId, msg) {
  const isMember = await checkChannelMembership(userId);
  if (!isMember) {
    const detectedLang = msg.from.language_code || 'ar';
    const supportedLangs = ['ar', 'en', 'fr', 'es', 'de', 'ru', 'zh'];
    const lang = supportedLangs.includes(detectedLang) ? detectedLang : 'ar';
    
    await safeSendMessage(bot, chatId, `
❌ <b>${t(lang, 'subscription_required')}</b>

${t(lang, 'subscribe_channel')}
👉 ${config.CHANNEL_USERNAME}

${t(lang, 'after_subscribe')} /start
`, {
      parse_mode: 'HTML'
    });
    return false;
  }
  return true;
}

// تحميل جميع الـ handlers من bot.js الأصلي
// سيتم استيراد الـ handlers مركزياً
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
  initializeBot,
  checkChannelMembership,
  requireChannelMembership
};
