const TelegramBot = require('node-telegram-bot-api');
const { LRUCache } = require('lru-cache');
const config = require('./config');
const db = require('./database');
const { t, matchesButtonKey, getLanguageKeyboard } = require('./languages');
const { safeSendMessage, safeSendPhoto, safeEditMessageText, safeAnswerCallbackQuery } = require('./safe-message');
const { BatchLoader } = require('./utils/batch-loader');
const geminiService = require('./gemini-service');
const { getSystemPrompt } = require('./ai-system-prompts');

// دالة مساعدة لتنظيف HTML من النصوص قبل إرسالها
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// تحديد الوضع: webhook أو polling
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true';

const bot = new TelegramBot(config.BOT_TOKEN, { 
  polling: USE_WEBHOOK ? false : {
    interval: 1000,
    autoStart: false,
    params: {
      timeout: 10
    }
  },
  webHook: false // سنفعله يدوياً في index.js
});

let batchLoader;
db.initDatabase().then(() => {
  batchLoader = new BatchLoader(db.getDB());
}).catch(err => {
  console.error('Error initializing batch loader:', err);
});

// معالجة أخطاء Polling فقط في وضع Polling
if (!USE_WEBHOOK) {
  bot.on('polling_error', (error) => {
    if (error.message.includes('409') || error.message.includes('ETELEGRAM: 409')) {
      console.log('⚠️ هناك نسخة أخرى من البوت تعمل. يرجى إيقاف النسخ الأخرى.');
      process.exit(1); // إيقاف هذه النسخة
    } else if (error.message.includes('query is too old')) {
      console.log('⚠️ تجاهل التحديثات القديمة...');
      // استمر في العمل - هذا خطأ عادي بعد إعادة التشغيل
    } else {
      console.error('Polling error:', error.message);
    }
  });
}

// ✅ استخدام LRU Cache مع حد أقصى لمنع memory leak عند ملايين المستخدمين
const membershipCache = new LRUCache({
  max: 10000,           // حد أقصى 10,000 مستخدم (~1-2 MB)
  ttl: 60 * 1000,       // تنظيف تلقائي بعد دقيقة
  updateAgeOnGet: true, // تحديث العمر عند الاستخدام
  allowStale: false
});

// Cache for owner language preference
let ownerLangCache = null;

async function getOwnerLang() {
  if (ownerLangCache) {
    return ownerLangCache;
  }
  try {
    const ownerUser = await db.getUser(config.OWNER_ID);
    ownerLangCache = ownerUser ? (ownerUser.language || 'ar') : 'ar';
    // Reset cache after 5 minutes
    setTimeout(() => { ownerLangCache = null; }, 5 * 60 * 1000);
    return ownerLangCache;
  } catch (error) {
    return 'ar'; // Default to Arabic
  }
}

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
    console.error('Error checking channel membership:', error.message);
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

bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name;
  const params = match[1].trim();

  try {
    if (!(await requireChannelMembership(userId, chatId, msg))) return;

    let user = await db.getUser(userId);
    let referrerId = null;
    let analystReferrerId = null;
    let promoterAnalystId = null;
    let promoterReferrerId = null;

    if (params && params.startsWith('ref_')) {
      referrerId = parseInt(params.replace('ref_', ''));
      if (referrerId === userId) {
        referrerId = null;
      }
    } else if (params && params.startsWith('analyst_') && params.includes('_ref_')) {
      // Format: analyst_{analyst_id}_ref_{promoter_user_id}
      const parts = params.split('_');
      if (parts.length >= 4) {
        promoterAnalystId = parts[1]; // analyst_id (can be ObjectId string)
        promoterReferrerId = parseInt(parts[3]); // promoter user_id
        if (promoterReferrerId === userId) {
          promoterReferrerId = null;
          promoterAnalystId = null;
        }
      }
    } else if (params && params.startsWith('analyst_ref_')) {
      analystReferrerId = parseInt(params.replace('analyst_ref_', ''));
      if (analystReferrerId === userId) {
        analystReferrerId = null;
      }
    }

    if (!user) {
      const detectedLang = msg.from.language_code || 'ar';
      const supportedLangs = ['ar', 'en', 'fr', 'es', 'de', 'ru', 'zh'];
      const initialLang = supportedLangs.includes(detectedLang) ? detectedLang : 'ar';

      await db.createUser(userId, username, firstName, lastName, referrerId, analystReferrerId);
      await db.updateUser(userId, { language: initialLang });
      user = await db.getUser(userId);

      // حفظ معلومات الإحالة الخاصة بمحلل معين
      if (promoterAnalystId && promoterReferrerId) {
        await db.updateUser(userId, { 
          promoter_analyst_id: promoterAnalystId,
          promoter_referrer_id: promoterReferrerId
        });
      }

      // ✅ استخدام Batch Loading لتحميل جميع المستخدمين دفعة واحدة (تحسين 66%+)
      const userIdsToFetch = [];
      if (referrerId) userIdsToFetch.push(referrerId);
      if (analystReferrerId) userIdsToFetch.push(analystReferrerId);
      if (promoterReferrerId) userIdsToFetch.push(promoterReferrerId);

      // تحميل جميع المستخدمين في query واحد
      const referrerUsers = userIdsToFetch.length > 0 && batchLoader 
        ? await batchLoader.loadUsers(userIdsToFetch)
        : [];

      // إنشاء map للوصول السريع
      const userMap = new Map(referrerUsers.map(u => [u.user_id, u]));

      // إرسال الرسائل باستخدام البيانات المحملة
      if (referrerId) {
        const referrerUser = userMap.get(referrerId);
        const referrerLang = referrerUser ? (referrerUser.language || 'ar') : 'ar';

        await safeSendMessage(bot, referrerId, `
<b>${t(referrerLang, 'new_referral')}</b>

${t(referrerLang, 'friend_joined')}
${t(referrerLang, 'you_will_get_commission')}
        `, { parse_mode: 'HTML' });
      }

      if (analystReferrerId) {
        const analystReferrerUser = userMap.get(analystReferrerId);
        const analystReferrerLang = analystReferrerUser ? (analystReferrerUser.language || 'ar') : 'ar';

        await safeSendMessage(bot, analystReferrerId, `
<b>${t(analystReferrerLang, 'new_analyst_referral')}</b>

${t(analystReferrerLang, 'friend_joined')}
${t(analystReferrerLang, 'analyst_commission')}
        `, { parse_mode: 'HTML' });
      }

      if (promoterReferrerId) {
        const promoterReferrerUser = userMap.get(promoterReferrerId);
        const promoterReferrerLang = promoterReferrerUser ? (promoterReferrerUser.language || 'ar') : 'ar';

        await safeSendMessage(bot, promoterReferrerId, `
<b>${t(promoterReferrerLang, 'new_analyst_specific_referral')}</b>

${t(promoterReferrerLang, 'friend_joined')}
${t(promoterReferrerLang, 'analyst_specific_commission')}
        `, { parse_mode: 'HTML' });
      }

      const userLang = user ? (user.language || 'ar') : 'ar';

      const welcomeMessage = `
<b>${t(userLang, 'welcome_to_obentchi')}</b>

${t(userLang, 'welcome_back')} ${firstName}! ${t(userLang, 'account_created')}.

<b>${t(userLang, 'joining_gift')}</b>
${t(userLang, 'free_trial_received')} <b>${config.FREE_TRIAL_DAYS} ${t(userLang, 'free_trial_days')}</b>!

<b>${t(userLang, 'what_you_can_do')}</b>
${t(userLang, 'feature_technical_analysis')}
${t(userLang, 'feature_recommendations')}
${t(userLang, 'feature_top_movers')}
${t(userLang, 'feature_wallet')}
${t(userLang, 'feature_analysts')}
${t(userLang, 'feature_referrals')}
`;

      await safeSendMessage(bot, chatId, welcomeMessage, {
        parse_mode: 'HTML'
      });
    } else {
      const subscription = await db.checkSubscription(userId);
      const userLang = user.language || 'ar';
      let statusMessage = '';

      if (subscription.active) {
        if (subscription.type === 'trial') {
          statusMessage = `🎁 ${t(userLang, 'trial_period')}: ${subscription.daysLeft} ${t(userLang, 'days_remaining')}`;
        } else {
          statusMessage = `✅ ${t(userLang, 'subscription_active_until')}: ${new Date(subscription.expiresAt).toLocaleDateString(userLang === 'ar' ? 'ar' : 'en')}`;
        }
      } else {
        statusMessage = `❌ ${t(userLang, 'no_active_subscription')}`;
      }

      await safeSendMessage(bot, chatId, `
👋 <b>${t(userLang, 'welcome_back')} ${firstName}!</b>

${statusMessage}
💰 <b>${t(userLang, 'your_balance')}</b> ${user.balance} USDT
`, {
        parse_mode: 'HTML'
      });
    }
  } catch (error) {
    console.error('Error in /start:', error);
    const errorLang = msg.from.language_code || 'ar';
    const supportedLangs = ['ar', 'en', 'fr', 'es', 'de', 'ru', 'zh'];
    const lang = supportedLangs.includes(errorLang) ? errorLang : 'ar';
    await safeSendMessage(bot, chatId, t(lang, 'error_occurred'));
  }
});

bot.onText(/\/notifications/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    const settings = await db.getNotificationSettings(userId);
    const isEnabled = settings.enabled || false;
    const markets = settings.markets || ['crypto', 'forex', 'stocks', 'commodities', 'indices'];

    const marketEmojis = {
      'crypto': '💎',
      'forex': '💱',
      'stocks': '📈',
      'commodities': '🥇',
      'indices': '📊'
    };

    const getMarketName = (market) => {
      return t(lang, `market_${market}`);
    };

    let marketsText = markets.map(m => `${marketEmojis[m]} ${getMarketName(m)}`).join('\n');

    await safeSendMessage(bot, chatId, `
🔔 <b>${t(lang, 'notifications_settings')}</b>

📊 <b>${t(lang, 'status_label')}</b> ${isEnabled ? `✅ ${t(lang, 'enabled_label')}` : `❌ ${t(lang, 'disabled_label')}`}

${isEnabled ? `<b>${t(lang, 'selected_markets')}</b>\n${marketsText}` : ''}

💡 <b>${t(lang, 'notification_note')}</b>
    `, {
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Error in /notifications:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, t(lang, 'error_occurred'));
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  try {
    const user = await db.getUser(userId);
    if (!user) return;

    const lang = user.language || 'ar';

    if (matchesButtonKey(text, 'settings_menu')) {
      await safeSendMessage(bot, chatId, `
<b>${t(lang, 'settings_menu')}</b>

${t(lang, 'choose_from_menu')}
      `, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: t(lang, 'language_settings_btn') }],
            [{ text: t(lang, 'customer_service_btn') }],
            [{ text: t(lang, 'notifications_btn') }],
            [{ text: t(lang, 'back_to_main') }]
          ],
          resize_keyboard: true
        }
      });
    } else if (matchesButtonKey(text, 'back_to_main')) {
      const firstName = msg.from.first_name;
      const subscription = await db.checkSubscription(userId);
      let statusMessage = '';

      if (subscription.active) {
        if (subscription.type === 'trial') {
          statusMessage = `🎁 ${t(lang, 'trial_period')}: ${subscription.daysLeft} ${t(lang, 'days_remaining')}`;
        } else {
          statusMessage = `✅ ${t(lang, 'subscription_active_until')}: ${new Date(subscription.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en')}`;
        }
      } else {
        statusMessage = `❌ ${t(lang, 'no_active_subscription')}`;
      }

      await safeSendMessage(bot, chatId, `
👋 <b>${t(lang, 'welcome_back')} ${firstName}!</b>

${statusMessage}
💰 <b>${t(lang, 'your_balance')}</b> ${user.balance} USDT
      `, {
        parse_mode: 'HTML'
      });
    } else if (matchesButtonKey(text, 'language_settings_btn')) {
      await safeSendMessage(bot, chatId, `
<b>${t(lang, 'language_settings')}</b>

${t(lang, 'select_language')}
      `, {
        parse_mode: 'HTML',
        reply_markup: getLanguageKeyboard()
      });
    } else if (matchesButtonKey(text, 'customer_service_btn')) {
      await safeSendMessage(bot, chatId, t(lang, 'customer_service_msg'), {
        parse_mode: 'HTML',
        reply_markup: {
          force_reply: true
        }
      });

      user.awaitingCustomerServiceMessage = true;
      await db.updateUser(userId, { awaitingCustomerServiceMessage: true });
    } else if (matchesButtonKey(text, 'notifications_btn')) {
      const settings = await db.getNotificationSettings(userId);
      const isEnabled = settings.enabled || false;
      const markets = settings.markets || ['crypto', 'forex', 'stocks', 'commodities', 'indices'];

      const marketEmojis = {
        'crypto': '💎',
        'forex': '💱',
        'stocks': '📈',
        'commodities': '🥇',
        'indices': '📊'
      };

      const getMarketName = (market) => {
        return t(lang, `market_${market}`);
      };

      let marketsText = markets.map(m => `${marketEmojis[m]} ${getMarketName(m)}`).join('\n');

      await safeSendMessage(bot, chatId, `
🔔 <b>${t(lang, 'notifications_settings')}</b>

📊 <b>${t(lang, 'status_label')}</b> ${isEnabled ? t(lang, 'notifications_enabled') : t(lang, 'notifications_disabled')}

${isEnabled ? `<b>${t(lang, 'selected_markets')}</b>\n${marketsText}` : ''}

💡 <b>${t(lang, 'notification_note')}</b>
      `, {
        parse_mode: 'HTML'
      });
    } else if (user.awaitingCustomerServiceMessage) {
      const config = require('./config');
      // إرسال للمالك بالعربية + لغة المستخدم للسياق
      const getLanguageName = (langCode) => {
        const languageNames = {
          'ar': t('ar', 'language_name_arabic'),
          'en': 'English',
          'fr': 'Français',
          'es': 'Español',
          'de': 'Deutsch',
          'ru': 'Русский',
          'zh': '中文'
        };
        return languageNames[langCode] || langCode;
      };

      // Get owner language preference
      const ownerLang = await getOwnerLang();
      
      await safeSendMessage(bot, config.OWNER_ID, `
📞 <b>${t(ownerLang, 'customer_service_new_message')}</b>

👤 <b>${t(ownerLang, 'user_label')}</b> ${msg.from.first_name} ${msg.from.last_name || ''}
🆔 <b>${t(ownerLang, 'id_label')}</b> <code>${userId}</code>
🌐 <b>${t(ownerLang, 'label_user_language')}</b> ${getLanguageName(lang)}
📝 <b>${t(ownerLang, 'message_label')}</b>

${text}
      `, { parse_mode: 'HTML' });

      // استخدام الذكاء الاصطناعي للرد على المستخدم بلغته
      try {
        if (geminiService.enabled) {
          const typingInterval = setInterval(() => {
            bot.sendChatAction(chatId, 'typing').catch(() => {});
          }, 3000);

          const systemPrompt = getSystemPrompt(lang);
          const aiResponse = await geminiService.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ], {
            model: 'gemini-2.0-flash-exp',
            maxOutputTokens: 500,
            temperature: 0.7
          });

          clearInterval(typingInterval);

          const reply = aiResponse.content;
          await safeSendMessage(bot, chatId, reply, { parse_mode: 'HTML' });
        } else {
          await safeSendMessage(bot, chatId, t(lang, 'message_sent'), { parse_mode: 'HTML' });
        }
      } catch (error) {
        console.error('Error in AI customer service:', error);
        await safeSendMessage(bot, chatId, t(lang, 'message_sent'), { parse_mode: 'HTML' });
      }

      await db.updateUser(userId, { awaitingCustomerServiceMessage: false });
    } else if (text.match(/^T[A-Za-z1-9]{33}$/)) {
        const lang = user.language || 'ar';
        await safeSendMessage(bot, chatId, t(lang, 'withdrawal_webapp_instruction'), { parse_mode: 'HTML' });
        return;
      }

      if (!isNaN(text) && parseFloat(text) > 0) {
        const lang = user.language || 'ar';
        await safeSendMessage(bot, chatId, t(lang, 'transaction_webapp_instruction'), { parse_mode: 'HTML' });
        return;
      }

      if (text.length === 64 && /^[a-fA-F0-9]{64}$/.test(text)) {
        const lang = user.language || 'ar';
        await safeSendMessage(bot, chatId, t(lang, 'deposit_webapp_instruction'), { parse_mode: 'HTML' });
        return;
      }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (data.startsWith('lang_')) {
    const selectedLang = data.split('_')[1];

    try {
      await db.updateUser(userId, { language: selectedLang });

      await safeAnswerCallbackQuery(bot, query.id, {
        text: t(selectedLang, 'language_changed'),
        show_alert: true
      });

      const user = await db.getUser(userId);
      const firstName = query.from.first_name;
      const subscription = await db.checkSubscription(userId);
      let statusMessage = '';

      if (subscription.active) {
        if (subscription.type === 'trial') {
          statusMessage = `🎁 ${t(selectedLang, 'trial_period')}: ${subscription.daysLeft} ${t(selectedLang, 'days_remaining')}`;
        } else {
          statusMessage = `✅ ${t(selectedLang, 'subscription_active_until')}: ${new Date(subscription.expiresAt).toLocaleDateString(selectedLang === 'ar' ? 'ar' : 'en')}`;
        }
      } else {
        statusMessage = `❌ ${t(selectedLang, 'no_active_subscription')}`;
      }

      await safeSendMessage(bot, chatId, `
👋 <b>${t(selectedLang, 'welcome_back')} ${firstName}!</b>

${statusMessage}
💰 <b>${t(selectedLang, 'your_balance')}</b> ${user.balance} USDT
      `, {
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error changing language:', error);
      const userLang = selectedLang || 'ar';
      await safeAnswerCallbackQuery(bot, query.id, {
        text: t(userLang, 'generic_error'),
        show_alert: true
      });
    }
  } else if (data === 'start_action') {
    try {
      await safeAnswerCallbackQuery(bot, query.id);

      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';
      const firstName = query.from.first_name;
      const subscription = await db.checkSubscription(userId);
      let statusMessage = '';

      if (subscription.active) {
        if (subscription.type === 'trial') {
          statusMessage = `🎁 ${t(lang, 'trial_period')}: ${subscription.daysLeft} ${t(lang, 'days_remaining')}`;
        } else {
          statusMessage = `✅ ${t(lang, 'subscription_active_until')}: ${new Date(subscription.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en')}`;
        }
      } else {
        statusMessage = `❌ ${t(lang, 'no_active_subscription')}`;
      }

      await safeSendMessage(bot, chatId, `
👋 <b>${t(lang, 'welcome_back')} ${firstName}!</b>

${statusMessage}
💰 <b>${t(lang, 'your_balance')}</b> ${user.balance} USDT
      `, {
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error in start_action:', error);
      const user = await db.getUser(userId);
      const userLang = user ? (user.language || 'ar') : 'ar';
      await safeAnswerCallbackQuery(bot, query.id, {
        text: t(userLang, 'generic_error'),
        show_alert: true
      });
    }
  } else if (data.startsWith('toggle_notif_')) {
    const enabled = data.split('_')[2] === 'true';

    try {
      await db.toggleNotifications(userId, enabled);

      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';

      await safeAnswerCallbackQuery(bot, query.id, {
        text: enabled ? t(lang, 'notifications_toggled_on') : t(lang, 'notifications_toggled_off'),
        show_alert: true
      });

      const settings = await db.getNotificationSettings(userId);
      const markets = settings.markets || ['crypto', 'forex', 'stocks', 'commodities', 'indices'];

      const marketEmojis = {
        'crypto': '💎',
        'forex': '💱',
        'stocks': '📈',
        'commodities': '🥇',
        'indices': '📊'
      };

      const getMarketName = (market) => {
        return t(lang, `market_${market}`);
      };

      let marketsText = markets.map(m => `${marketEmojis[m]} ${getMarketName(m)}`).join('\n');

      await safeEditMessageText(bot, `
🔔 <b>${t(lang, 'notifications_settings')}</b>

📊 <b>${t(lang, 'status_label')}</b> ${enabled ? t(lang, 'notifications_enabled') : t(lang, 'notifications_disabled')}

${enabled ? `<b>${t(lang, 'selected_markets')}</b>\n${marketsText}` : ''}

💡 <b>${t(lang, 'notification_note')}</b>
      `, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
    } catch (error) {
      console.error('Error toggling notifications:', error);
      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';
      await safeAnswerCallbackQuery(bot, query.id, {
        text: t(lang, 'error_generic'),
        show_alert: true
      });
    }
  }
  
  else if (data.startsWith('ai_')) {
    if (userId !== config.OWNER_ID) {
      return safeAnswerCallbackQuery(bot, query.id, {
        text: 'Unauthorized',
        show_alert: true
      });
    }

    try {
      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';
      const aiCodeAgent = require('./ai-code-agent');

      await safeAnswerCallbackQuery(bot, query.id);

      if (data === 'ai_list_files') {
        await safeSendMessage(bot, chatId, lang === 'ar' ? '⏳ جاري عرض ملفات المشروع...' : '⏳ Loading project files...', { parse_mode: 'HTML' });
        
        const result = await aiCodeAgent.processUserRequest(userId, lang === 'ar' ? 'اعرض لي قائمة بجميع ملفات المشروع الرئيسية مع شرح مختصر لكل ملف' : 'Show me a list of all main project files with brief explanation of each', lang);
        
        if (result.success) {
          const responseMessage = `
🤖 <b>${lang === 'ar' ? 'ملفات المشروع' : 'Project Files'}</b>

${escapeHtml(result.response)}

<i>📊 ${lang === 'ar' ? 'استخدام' : 'Usage'}: ${result.usage.total_tokens} ${lang === 'ar' ? 'رمز' : 'tokens'}</i>
          `;

          if (responseMessage.length > 4096) {
            const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
            for (const chunk of chunks) {
              await safeSendMessage(bot, chatId, chunk);
            }
          } else {
            await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
          }
        } else {
          await safeSendMessage(bot, chatId, `❌ ${result.fallback || result.error}`, { parse_mode: 'HTML' });
        }
      }
      
      else if (data === 'ai_analyze_project') {
        await safeSendMessage(bot, chatId, lang === 'ar' ? '⏳ جاري فحص المشروع بالكامل... قد يستغرق هذا بعض الوقت' : '⏳ Analyzing full project... This may take a while', { parse_mode: 'HTML' });
        
        const result = await aiCodeAgent.processUserRequest(userId, lang === 'ar' ? 'قم بفحص شامل للمشروع وأخبرني: 1) البنية العامة للمشروع 2) الميزات الرئيسية 3) التقنيات المستخدمة 4) أي ملاحظات أو تحسينات مقترحة' : 'Perform a full project analysis and tell me: 1) Overall project structure 2) Main features 3) Technologies used 4) Any notes or suggested improvements', lang);
        
        if (result.success) {
          const responseMessage = `
🤖 <b>${lang === 'ar' ? 'تحليل شامل للمشروع' : 'Full Project Analysis'}</b>

${escapeHtml(result.response)}

<i>📊 ${lang === 'ar' ? 'استخدام' : 'Usage'}: ${result.usage.total_tokens} ${lang === 'ar' ? 'رمز' : 'tokens'}</i>
          `;

          if (responseMessage.length > 4096) {
            const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
            for (const chunk of chunks) {
              await safeSendMessage(bot, chatId, chunk);
            }
          } else {
            await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
          }
        } else {
          await safeSendMessage(bot, chatId, `❌ ${result.fallback || result.error}`, { parse_mode: 'HTML' });
        }
      }
      
      else if (data === 'ai_find_bugs') {
        await safeSendMessage(bot, chatId, lang === 'ar' ? '⏳ جاري البحث عن الأخطاء والمشاكل...' : '⏳ Searching for bugs and issues...', { parse_mode: 'HTML' });
        
        const result = await aiCodeAgent.processUserRequest(userId, lang === 'ar' ? 'افحص الملفات الرئيسية في المشروع (bot.js, database.js, groq-service.js) وابحث عن: 1) أخطاء برمجية محتملة 2) مشاكل في الأداء 3) ثغرات أمنية 4) أكواد غير محسنة. اعطني تقرير مفصل' : 'Check main files in the project (bot.js, database.js, groq-service.js) and find: 1) Potential bugs 2) Performance issues 3) Security vulnerabilities 4) Non-optimized code. Give me detailed report', lang);
        
        if (result.success) {
          const responseMessage = `
🤖 <b>${lang === 'ar' ? 'تقرير الأخطاء والمشاكل' : 'Bugs & Issues Report'}</b>

${escapeHtml(result.response)}

<i>📊 ${lang === 'ar' ? 'استخدام' : 'Usage'}: ${result.usage.total_tokens} ${lang === 'ar' ? 'رمز' : 'tokens'}</i>
          `;

          if (responseMessage.length > 4096) {
            const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
            for (const chunk of chunks) {
              await safeSendMessage(bot, chatId, chunk);
            }
          } else {
            await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
          }
        } else {
          await safeSendMessage(bot, chatId, `❌ ${result.fallback || result.error}`, { parse_mode: 'HTML' });
        }
      }
      
      else if (data === 'ai_chat_mode') {
        const isEnabled = aiChatMode.get(userId);
        
        if (isEnabled) {
          aiChatMode.delete(userId);
          await safeSendMessage(bot, chatId, `
🔴 <b>${lang === 'ar' ? 'تم إيقاف وضع المحادثة المستمرة' : 'Chat Mode Disabled'}</b>

${lang === 'ar' ? 'الآن يجب عليك استخدام /ai قبل كل رسالة' : 'Now you need to use /ai before each message'}
          `, { parse_mode: 'HTML' });
        } else {
          aiChatMode.set(userId, true);
          await safeSendMessage(bot, chatId, `
🟢 <b>${lang === 'ar' ? 'تم تفعيل وضع المحادثة المستمرة' : 'Chat Mode Enabled'}</b>

${lang === 'ar' ? 'الآن يمكنك إرسال رسائلك مباشرة بدون /ai' : 'Now you can send messages directly without /ai'}
${lang === 'ar' ? 'لإيقاف وضع المحادثة، اضغط على الزر مرة أخرى' : 'To disable chat mode, click the button again'}

${lang === 'ar' ? '💡 اسألني أي شيء عن المشروع!' : '💡 Ask me anything about the project!'}
          `, { parse_mode: 'HTML' });
        }
      }
      
      else if (data === 'ai_clear_history') {
        aiCodeAgent.clearHistory(userId);
        await safeSendMessage(bot, chatId, `
🗑️ <b>${lang === 'ar' ? 'تم مسح سجل المحادثة' : 'Chat History Cleared'}</b>

${lang === 'ar' ? 'تم بدء محادثة جديدة' : 'New conversation started'}
        `, { parse_mode: 'HTML' });
      }

    } catch (error) {
      console.error('Error handling AI callback:', error);
      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';
      await safeSendMessage(bot, chatId, `❌ ${t(lang, 'request_processing_error')}`);
    }
  }
});

bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const data = JSON.parse(msg.web_app_data.data);

  try {
    const user = await db.getUser(userId);
    if (!user) {
      return safeSendMessage(bot, chatId, t('ar', 'prompt_please_start'));
    }

    const lang = user.language || 'ar';

    if (data.action === 'withdraw') {
      const okx = require('./okx');
      const amount = parseFloat(data.amount);
      const address = data.address;
      const totalWithFee = amount + config.WITHDRAWAL_FEE;

      const analyst = await db.getAnalystByUserId(userId);

      if (analyst) {
        const balance = await db.getAnalystBalance(analyst._id);

        if (balance.available_balance < totalWithFee) {
          return safeSendMessage(bot, chatId, `
❌ <b>${t(lang, 'error_insufficient_withdrawal_balance')}</b>

${t(lang, 'wallet_available_withdrawal_balance').replace('{balance}', balance.available_balance.toFixed(2))}
${t(lang, 'wallet_escrow_balance_info').replace('{balance}', balance.escrow_balance.toFixed(2))}

${t(lang, 'wallet_required_amount_with_fees').replace('{amount}', totalWithFee.toFixed(2))}
`, { parse_mode: 'HTML' });
        }

        await db.deductFromAnalystAvailableBalance(analyst._id, totalWithFee);
      } else {
        if (user.balance < totalWithFee) {
          return safeSendMessage(bot, chatId, t(lang, 'error_insufficient_balance'));
        }

        await db.updateUserBalance(userId, -totalWithFee);
      }

      const processingMsg = await safeSendMessage(bot, chatId, `
⏳ <b>${t(lang, 'withdrawal_processing')}</b>

${t(lang, 'amount_label')} ${amount} USDT
${t(lang, 'label_fees')} ${config.WITHDRAWAL_FEE} USDT
${t(lang, 'label_address')} <code>${address}</code>

${t(lang, 'please_wait')}
`, { parse_mode: 'HTML' });

      if (!okx.isConfigured()) {
        await db.createWithdrawalRequest({
          user_id: userId,
          amount: amount,
          address: address,
          status: 'pending'
        });

        await safeEditMessageText(bot, `
⚠️ <b>${t(lang, 'withdrawal_auto_unavailable')}</b>

${t(lang, 'withdrawal_manual_request_created')}

${t(lang, 'withdrawal_reserved_amount').replace('{amount}', amount)}
${t(lang, 'label_fees')} ${config.WITHDRAWAL_FEE} USDT
${t(lang, 'label_address')} <code>${address}</code>

${t(lang, 'withdrawal_will_notify')}
`, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });

        const ownerLang = await getOwnerLang();
        await safeSendMessage(bot, config.OWNER_ID, `
💸 <b>${t(ownerLang, 'admin_new_manual_withdrawal')}</b>

${t(ownerLang, 'user_label')} ${user.first_name} (@${user.username})
${t(ownerLang, 'id_label')} ${userId}
${t(ownerLang, 'amount_label')} ${amount} USDT
${t(ownerLang, 'label_address')} <code>${address}</code>

⚠️ ${t(ownerLang, 'admin_funds_reserved')}
`, { parse_mode: 'HTML' });

        return;
      }

      try {
        const result = await okx.withdrawUSDT(address, amount);

        if (result.success) {
          await db.createWithdrawalRequest({
            user_id: userId,
            amount: amount,
            address: address,
            status: 'approved'
          });

          await db.createTransaction(
            userId, 
            'withdrawal', 
            amount, 
            result.data.withdrawId, 
            address, 
            'completed'
          );

          await safeEditMessageText(bot, `
✅ <b>${t(lang, 'withdrawal_success')}</b>

${t(lang, 'success_amount_display').replace('{amount}', amount)}
${t(lang, 'withdrawal_address_display').replace('{address}', address)}
🆔 ${t(lang, 'label_withdrawal_id')} <code>${result.data.withdrawId}</code>
⚡ ${t(lang, 'label_network')} TRC20

${t(lang, 'withdrawal_will_arrive_soon')}
`, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });

          const ownerLang = await getOwnerLang();
          await safeSendMessage(bot, config.OWNER_ID, `
✅ <b>${t(ownerLang, 'admin_auto_withdrawal_success')}</b>

${t(ownerLang, 'user_label')} ${user.first_name} (@${user.username})
${t(ownerLang, 'id_label')} ${userId}
${t(ownerLang, 'amount_label')} ${amount} USDT
${t(ownerLang, 'label_address')} <code>${address}</code>
${t(ownerLang, 'label_withdrawal_id')} <code>${result.data.withdrawId}</code>
`, { parse_mode: 'HTML' });

        } else {
          if (analyst) {
            await db.deductFromAnalystAvailableBalance(analyst._id, -totalWithFee);
          } else {
            await db.updateUserBalance(userId, totalWithFee);
          }

          await db.createWithdrawalRequest({
            user_id: userId,
            amount: amount,
            address: address,
            status: 'failed'
          });

          await safeEditMessageText(bot, `
❌ <b>${t(lang, 'error_withdrawal_failed')}</b>

${t(lang, 'label_reason')} ${result.error}

${t(lang, 'notification_amount_refunded').replace('{amount}', totalWithFee)}
${t(lang, 'try_again_or_contact')}
`, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: 'HTML'
          });

          const ownerLang = await getOwnerLang();
          await safeSendMessage(bot, config.OWNER_ID, `
❌ <b>${t(ownerLang, 'admin_auto_withdrawal_failed')}</b>

${t(ownerLang, 'user_label')} ${user.first_name} (@${user.username})
${t(ownerLang, 'id_label')} ${userId}
${t(ownerLang, 'amount_label')} ${amount} USDT
${t(ownerLang, 'label_address')} <code>${address}</code>
${t(ownerLang, 'label_reason')} ${result.error}

${t(ownerLang, 'notification_amount_refunded_to_user')}
`, { parse_mode: 'HTML' });
        }

      } catch (error) {
        console.error('❌ خطأ في معالجة السحب:', error);

        if (analyst) {
          await db.deductFromAnalystAvailableBalance(analyst._id, -totalWithFee);
        } else {
          await db.updateUserBalance(userId, totalWithFee);
        }

        await safeEditMessageText(bot, `
❌ <b>${t(lang, 'error_processing_withdrawal')}</b>

${t(lang, 'notification_unexpected_error_refunded')}
${t(lang, 'notification_try_again_later')}

${t(lang, 'label_refunded_balance')} ${totalWithFee} USDT
`, {
          chat_id: chatId,
          message_id: processingMsg.message_id,
          parse_mode: 'HTML'
        });

        const ownerLang = await getOwnerLang();
        await safeSendMessage(bot, config.OWNER_ID, `
⚠️ <b>${t(ownerLang, 'admin_withdrawal_system_error')}</b>

${t(ownerLang, 'user_label')} ${user.first_name}
${t(ownerLang, 'amount_label')} ${amount} USDT
${t(ownerLang, 'label_error')} ${error.message}

${t(ownerLang, 'notification_amount_refunded_to_user')}
`, { parse_mode: 'HTML' });
      }
    }

    else if (data.action === 'subscribe') {
      console.log(`📝 محاولة اشتراك للمستخدم ${userId} - الرصيد: ${user.balance} USDT`);

      if (user.balance < config.SUBSCRIPTION_PRICE) {
        console.log(`❌ رصيد غير كافٍ للمستخدم ${userId}`);
        return safeSendMessage(bot, chatId, t(lang, 'error_insufficient_balance_subscription'));
      }

      try {
        console.log(`⏳ بدء عملية الاشتراك للمستخدم ${userId}`);

        let referralCommission = 0;
        let referrerId = null;
        let referralType = '';

        if (user.referred_by_analyst) {
          referralCommission = config.SUBSCRIPTION_PRICE * 0.2;
          referrerId = user.referred_by_analyst;
          referralType = 'analyst_referral';
        } else if (user.referred_by) {
          referralCommission = config.SUBSCRIPTION_PRICE * 0.1;
          referrerId = user.referred_by;
          referralType = 'subscription';
        }

        const result = await db.processSubscriptionPayment(userId, {
          amount: config.SUBSCRIPTION_PRICE,
          referrerId: referrerId,
          referralType: referralType,
          referralCommission: referralCommission,
          ownerId: config.OWNER_ID
        });

        if (!result.success) {
          throw new Error(t(lang, 'error_subscription_processing_failed'));
        }

        const expiryDate = result.expiryDate;
        const userLang = user.language || 'ar';
        console.log(`✅ اشتراك ناجح للمستخدم ${userId} - صالح حتى ${expiryDate.toLocaleDateString('ar')}`);

        await safeSendMessage(bot, chatId, `
✅ <b>${t(userLang, 'subscription_activated')}</b>

💳 <b>${t(userLang, 'amount_deducted')}</b> ${config.SUBSCRIPTION_PRICE} USDT
📅 <b>${t(userLang, 'valid_until')}</b> ${expiryDate.toLocaleDateString(userLang === 'ar' ? 'ar' : 'en')}
💰 <b>${t(userLang, 'current_balance')}</b> ${(user.balance - config.SUBSCRIPTION_PRICE).toFixed(2)} USDT

🎉 ${t(userLang, 'enjoy_features')}
`, { parse_mode: 'HTML' });

        const getLanguageName = (langCode) => {
          const languageNames = {
            'ar': t('ar', 'language_name_arabic'),
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'de': 'Deutsch',
            'ru': 'Русский',
            'zh': '中文'
          };
          return languageNames[langCode] || langCode;
        };

        // إرسال للمالك بلغته المفضلة
        const ownerLang = await getOwnerLang();
        await safeSendMessage(bot, config.OWNER_ID, `
💰 <b>${t(ownerLang, 'new_subscription')}</b>

👤 ${t(ownerLang, 'user_label')} ${user.first_name} (@${user.username || t(ownerLang, 'no_username')})
🆔 ${t(ownerLang, 'id_label')} ${userId}
🌐 <b>${t(ownerLang, 'label_language')}</b> ${getLanguageName(userLang)}
💵 ${t(ownerLang, 'amount_label')} ${config.SUBSCRIPTION_PRICE} USDT
📅 ${t(ownerLang, 'valid_until')} ${expiryDate.toLocaleDateString(ownerLang === 'ar' ? 'ar' : 'en')}
${referrerId ? `🎁 ${t(ownerLang, 'referral_commission_label')} ${referralCommission} USDT` : ''}
`, { parse_mode: 'HTML' });

      } catch (error) {
        console.error(`❌ خطأ في عملية الاشتراك للمستخدم ${userId}:`, error);
        const userLang = user.language || 'ar';

        await safeSendMessage(bot, chatId, `
❌ <b>${t(userLang, 'subscription_error')}</b>

${error.message || t(userLang, 'error_occurred')}

${t(userLang, 'try_again_or_contact')}
💰 ${t(userLang, 'refund_notice')}
`, { parse_mode: 'HTML' });

        const getLanguageName = (langCode) => {
          const languageNames = {
            'ar': t('ar', 'language_name_arabic'),
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'de': 'Deutsch',
            'ru': 'Русский',
            'zh': '中文'
          };
          return languageNames[langCode] || langCode;
        };

        // إرسال للمالك بلغته المفضلة
        const ownerLang = await getOwnerLang();
        await safeSendMessage(bot, config.OWNER_ID, `
⚠️ <b>${t(ownerLang, 'subscription_failed')}</b>

${t(ownerLang, 'user_label')} ${user.first_name} (@${user.username || t(ownerLang, 'no_username')})
${t(ownerLang, 'id_label')} ${userId}
🌐 <b>${t(ownerLang, 'label_language')}</b> ${getLanguageName(userLang)}
${t(ownerLang, 'error_label')} ${error.message}
`, { parse_mode: 'HTML' });
      }
    }

    else if (data.action === 'register_analyst') {
      const user = await db.getUser(userId);
      const lang = user ? (user.language || 'ar') : 'ar';

      await db.updateUser(userId, { temp_withdrawal_address: 'analyst_registration' });
      await safeSendMessage(bot, chatId, `
📝 <b>${t(lang, 'analyst_registration')}</b>

${t(lang, 'send_following_data')}

1️⃣ ${t(lang, 'name_field')}
2️⃣ ${t(lang, 'description_field')}
3️⃣ ${t(lang, 'monthly_price')}

${t(lang, 'example_label')}
${t(lang, 'analyst_example_name')}
${t(lang, 'analyst_example_description')}
${t(lang, 'analyst_example_price')}
`, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Error handling web_app_data:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, t(lang, 'request_processing_error'));
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  try {
    const user = await db.getUser(userId);
    if (!user) return;

    // تحديد لغة المستخدم
    const lang = user.language || 'ar';

    // دعم الرد في المجموعات - للجميع
    const chatType = msg.chat.type;
    const isGroup = chatType === 'group' || chatType === 'supergroup';
    
    if (isGroup) {
      console.log(`📱 [GROUP] Message received in group: ${msg.chat.title || chatId}`);
      
      const botInfo = await bot.getMe();
      const botUsername = botInfo.username;
      const botId = botInfo.id;
      
      // كلمات مفتاحية للبوت بعدة لغات
      const botKeywords = [
        'بوت', 'bot', 'бот', '机器人', 'robot', 'robô', 'roboto'
      ];
      
      // التحقق من المنشن أو الرد أو كتابة كلمة "بوت"
      const isMentioned = text.includes(`@${botUsername}`);
      const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from.id === botId;
      const containsBotKeyword = botKeywords.some(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      );
      
      console.log(`🔍 [GROUP] Bot triggered check:`, {
        isMentioned,
        isReplyToBot,
        containsBotKeyword,
        textPreview: text.substring(0, 50)
      });
      
      if (isMentioned || isReplyToBot || containsBotKeyword) {
        console.log(`✅ [GROUP] Bot triggered! Processing message...`);
        
        // إزالة المنشن والكلمات المفتاحية من النص
        let cleanText = text.replace(new RegExp(`@${botUsername}`, 'g'), '').trim();
        
        // إزالة كلمة "بوت" وما شابهها من بداية النص
        botKeywords.forEach(keyword => {
          const regex = new RegExp(`^${keyword}[,،\\s]*`, 'gi');
          cleanText = cleanText.replace(regex, '').trim();
        });
        
        if (!cleanText) {
          console.log(`⚠️ [GROUP] Empty message after cleaning, ignoring...`);
          return;
        }
        
        console.log(`📝 [GROUP] Clean text: "${cleanText}"`);
        
        // استخدام المساعد الذكي المتقدم للرد
        const advancedAIService = require('./advanced-ai-service');
        
        // إرسال إشارة كتابة
        bot.sendChatAction(chatId, 'typing').catch(() => {});
        
        console.log(`🤖 [GROUP] Calling Gemini AI via advanced-ai-service...`);
        
        // ردود مباشرة بدون حفظ في المجموعات
        const result = await advancedAIService.processRequest(userId, cleanText, { 
          lang,
          saveHistory: false  // لا يتم حفظ المحادثات في المجموعات
        });
        
        console.log(`📤 [GROUP] AI Response received:`, {
          success: result.success,
          contentLength: result.content?.length || 0,
          type: result.type
        });
        
        if (result.success) {
          const responseMessage = `🤖 ${result.content}`;
          
          if (responseMessage.length > 4096) {
            const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
            for (const chunk of chunks) {
              await safeSendMessage(bot, chatId, chunk, { 
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id 
              });
            }
          } else {
            await safeSendMessage(bot, chatId, responseMessage, { 
              parse_mode: 'HTML',
              reply_to_message_id: msg.message_id 
            });
          }
          console.log(`✅ [GROUP] Response sent successfully!`);
        } else {
          await safeSendMessage(bot, chatId, `❌ ${result.content}`, { 
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id 
          });
          console.log(`❌ [GROUP] Error response sent to user`);
        }
        
        return;
      } else {
        console.log(`ℹ️ [GROUP] Bot not triggered, ignoring message`);
      }
    }

    // دردشة المالك الخاصة مع AI Code Agent
    if (userId === config.OWNER_ID && aiChatMode.get(userId)) {
      const aiCodeAgent = require('./ai-code-agent');
      
      await safeSendMessage(bot, chatId, '⏳', { parse_mode: 'HTML' });
      
      const result = await aiCodeAgent.processUserRequest(userId, text, lang);
      
      if (result.success) {
        const responseMessage = `🤖 ${escapeHtml(result.response)}`;

        if (responseMessage.length > 4096) {
          const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
          for (const chunk of chunks) {
            await safeSendMessage(bot, chatId, chunk);
          }
        } else {
          await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
        }
      } else {
        await safeSendMessage(bot, chatId, `❌ ${result.fallback || result.error}`, { parse_mode: 'HTML' });
      }
      
      return;
    }

    if (user.temp_withdrawal_address === 'analyst_registration') {
      const lang = user.language || 'ar';
      const lines = text.trim().split('\n').filter(line => line.trim());

      if (lines.length !== 3) {
        return safeSendMessage(bot, chatId, `
❌ <b>${t(lang, 'invalid_data')}</b>

${t(lang, 'must_send_three_lines')}
1️⃣ ${t(lang, 'name_field')}
2️⃣ ${t(lang, 'description_field')}
3️⃣ ${t(lang, 'monthly_price')}
`, { parse_mode: 'HTML' });
      }

      const [name, description, priceStr] = lines;
      const price = parseFloat(priceStr);

      if (isNaN(price) || price < 1) {
        return safeSendMessage(bot, chatId, `❌ ${t(lang, 'price_must_be_number')}`);
      }

      try {
        const analyst = await db.createAnalyst(userId, name, description, price);

        await db.updateUser(userId, { temp_withdrawal_address: null });

        await safeSendMessage(bot, chatId, `
✅ <b>${t(lang, 'analyst_registered')}</b>

${t(lang, 'name_label')} ${analyst.name}
${t(lang, 'price_label')} ${price} USDT${t(lang, 'per_month')}

${t(lang, 'users_can_subscribe')}
`, { parse_mode: 'HTML' });

        const getLanguageName = (langCode) => {
          const languageNames = {
            'ar': t('ar', 'language_name_arabic'),
            'en': 'English',
            'fr': 'Français',
            'es': 'Español',
            'de': 'Deutsch',
            'ru': 'Русский',
            'zh': '中文'
          };
          return languageNames[langCode] || langCode;
        };

        // إرسال للمالك بلغته المفضلة
        const ownerLang = await getOwnerLang();
        await safeSendMessage(bot, config.OWNER_ID, `
📝 <b>${t(ownerLang, 'new_analyst')}</b>

${t(ownerLang, 'name_label')} ${analyst.name}
${t(ownerLang, 'user_label')} @${user.username}
${t(ownerLang, 'id_label')} ${userId}
🌐 <b>${t(ownerLang, 'label_language')}</b> ${getLanguageName(lang)}
${t(ownerLang, 'price_label')} ${price} USDT${t(ownerLang, 'per_month')}
${t(ownerLang, 'description_label')} ${analyst.description}
`, { parse_mode: 'HTML' });
      } catch (createError) {
        return safeSendMessage(bot, chatId, `❌ ${createError.message}`);
      }
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

// وضع المحادثة مع AI - للمالك فقط (يتم تفعيله تلقائياً)
const aiChatMode = new Map();

// أمر /ai للمالك - دردشة مباشرة مبسطة
bot.onText(/\/ai(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = match[1].trim();

  if (userId !== config.OWNER_ID) {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    return safeSendMessage(bot, chatId, `❌ ${t(lang, 'admin_unauthorized')}`);
  }

  try {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    const aiCodeAgent = require('./ai-code-agent');

    // إذا لم يكن هناك رسالة، عرض رسالة الترحيب وتفعيل الدردشة
    if (!userMessage) {
      const stats = aiCodeAgent.getStats();
      
      // تفعيل وضع المحادثة تلقائياً
      aiChatMode.set(userId, true);
      
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: lang === 'ar' ? '💬 بدء الدردشة مع المساعد' : '💬 Start Chat with Assistant', callback_data: 'ai_start_chat' },
            ],
            [
              { text: lang === 'ar' ? '🗑️ مسح السجل' : '🗑️ Clear History', callback_data: 'ai_clear_history' },
              { text: lang === 'ar' ? '🔴 إيقاف الدردشة' : '🔴 Stop Chat', callback_data: 'ai_stop_chat' },
            ]
          ]
        }
      };

      const helpMessage = lang === 'ar' ? `
🤖 <b>مساعدك الذكي الخاص</b>

مرحباً ${user.first_name}! أنا مساعدك البرمجي الشخصي 🚀

<b>✨ ماذا أستطيع أن أفعل؟</b>

• 📂 قراءة وتحليل ملفات المشروع
• 🐛 إيجاد الأخطاء والمشاكل
• 💡 اقتراح حلول وتحسينات
• 🔍 البحث في الكود
• 💬 الإجابة على أسئلتك

<b>📊 الحالة:</b>
• المحادثات النشطة: ${stats.activeConversations}
• النموذج: ${stats.model}

<b>💡 كيف تستخدمني؟</b>

فقط ابدأ بالكتابة! أي رسالة ترسلها الآن ستصلني مباشرة 💬

<b>🎯 أمثلة:</b>
• اقرأ ملف bot.js واشرحه
• هل يوجد أخطاء في الكود؟
• كيف أحسن الأداء؟
• ابحث عن استخدامات Redis

<b>✅ وضع الدردشة: مُفعّل الآن</b>
اكتب أي شيء وسأرد عليك مباشرة!
      ` : `
🤖 <b>Your Personal AI Assistant</b>

Hello ${user.first_name}! I'm your personal programming assistant 🚀

<b>✨ What can I do?</b>

• 📂 Read and analyze project files
• 🐛 Find bugs and issues
• 💡 Suggest solutions and improvements
• 🔍 Search through code
• 💬 Answer your questions

<b>📊 Status:</b>
• Active Conversations: ${stats.activeConversations}
• Model: ${stats.model}

<b>💡 How to use me?</b>

Just start typing! Any message you send now will reach me directly 💬

<b>🎯 Examples:</b>
• Read bot.js and explain it
• Are there any bugs in the code?
• How to improve performance?
• Search for Redis usage

<b>✅ Chat Mode: Active Now</b>
Type anything and I'll respond directly!
      `;

      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML', ...keyboard });
    }

    // معالجة الرسالة مباشرة
    await safeSendMessage(bot, chatId, '⏳', { parse_mode: 'HTML' });

    const result = await aiCodeAgent.processUserRequest(userId, userMessage, lang);

    if (result.success) {
      const responseMessage = `🤖 ${escapeHtml(result.response)}`;

      if (responseMessage.length > 4096) {
        const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
        for (const chunk of chunks) {
          await safeSendMessage(bot, chatId, chunk);
        }
      } else {
        await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
      }
    } else {
      await safeSendMessage(bot, chatId, `❌ ${result.fallback || result.error}`, { parse_mode: 'HTML' });
    }

  } catch (error) {
    console.error('Error in /ai command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'request_processing_error')}`);
  }
});

// الإبقاء على /code_agent للتوافق مع الإصدارات القديمة
bot.onText(/\/code_agent(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = match[1].trim();

  if (userId !== config.OWNER_ID) {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    return safeSendMessage(bot, chatId, `❌ ${t(lang, 'admin_unauthorized')}`);
  }

  try {
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    const aiCodeAgent = require('./ai-code-agent');

    if (!userMessage) {
      const tools = aiCodeAgent.getAvailableTools();
      const stats = aiCodeAgent.getStats();
      
      const toolsList = tools.map(tool => 
        `🔧 <b>${tool.name}</b>\n   ${tool.description}\n`
      ).join('\n');

      const helpMessage = lang === 'ar' ? `
🤖 <b>المساعد البرمجي الذكي</b>

مرحباً بك في نظام المساعد البرمجي المتقدم!

<b>💡 ملاحظة:</b> استخدم الأمر الجديد /ai للحصول على تجربة أفضل!

<b>📚 الأدوات المتاحة:</b>
${toolsList}

<b>💡 أمثلة على الاستخدام:</b>

1️⃣ <b>مراجعة كود:</b>
/code_agent راجع ملف bot.js وأخبرني بالمشاكل

2️⃣ <b>قراءة ملف:</b>
/code_agent اقرأ ملف database.js واشرحه لي

3️⃣ <b>اقتراح تحسين:</b>
/code_agent كيف أحسن أداء نظام الاشتراكات؟

4️⃣ <b>البحث في الملفات:</b>
/code_agent ابحث عن جميع استخدامات groq في المشروع

5️⃣ <b>توليد كود جديد:</b>
/code_agent اكتب لي دالة لحساب الرسوم

<b>📊 الإحصائيات:</b>
• المحادثات النشطة: ${stats.activeConversations}
• النموذج: ${stats.model}

<b>🎯 لبدء محادثة:</b>
فقط اكتب /code_agent متبوعاً بطلبك
      ` : `
🤖 <b>AI Code Agent</b>

Welcome to the Advanced Programming Assistant!

<b>💡 Note:</b> Use the new /ai command for a better experience!

<b>📚 Available Tools:</b>
${toolsList}

<b>💡 Usage Examples:</b>

1️⃣ <b>Code Review:</b>
/code_agent review bot.js and tell me issues

2️⃣ <b>Read File:</b>
/code_agent read database.js and explain it

3️⃣ <b>Suggest Improvement:</b>
/code_agent how to improve subscription system?

4️⃣ <b>Search in Files:</b>
/code_agent search for all groq usage in project

5️⃣ <b>Generate Code:</b>
/code_agent write me a function to calculate fees

<b>📊 Statistics:</b>
• Active Conversations: ${stats.activeConversations}
• Model: ${stats.model}

<b>🎯 To Start:</b>
Just type /code_agent followed by your request
      `;

      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML' });
    }

    await safeSendMessage(bot, chatId, lang === 'ar' ? '⏳ جاري معالجة طلبك...' : '⏳ Processing your request...', { parse_mode: 'HTML' });

    const result = await aiCodeAgent.processUserRequest(userId, userMessage, lang);

    if (result.success) {
      const responseMessage = `
🤖 <b>${lang === 'ar' ? 'المساعد البرمجي' : 'AI Code Agent'}</b>

${escapeHtml(result.response)}

<i>📊 ${lang === 'ar' ? 'استخدام' : 'Usage'}: ${result.usage.total_tokens} ${lang === 'ar' ? 'رمز' : 'tokens'}</i>
      `;

      if (responseMessage.length > 4096) {
        const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
        for (const chunk of chunks) {
          await safeSendMessage(bot, chatId, chunk);
        }
      } else {
        await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
      }
    } else {
      await safeSendMessage(bot, chatId, `
❌ <b>${lang === 'ar' ? 'خطأ' : 'Error'}</b>

${result.fallback || result.error}
      `, { parse_mode: 'HTML' });
    }

  } catch (error) {
    console.error('Error in /code_agent command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'request_processing_error')}`);
  }
});

// ==================== Advanced AI Commands for All Users ====================

// نظام المحادثة الذكية المتقدمة
const advancedAIService = require('./advanced-ai-service');

// /ask - المحادثة الذكية
bot.onText(/\/ask(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userMessage = match[1].trim();

  try {
    if (!(await requireChannelMembership(userId, chatId, msg))) return;

    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    if (!userMessage) {
      const helpMessage = lang === 'ar' ? `
🤖 <b>المحادثة الذكية - Smart Chat</b>

مرحباً! أنا مساعد ذكي متقدم يمكنني:

✨ <b>القدرات:</b>
• 💬 المحادثة الذكية مع سياق كامل
• 🔍 البحث في الإنترنت للحصول على معلومات محدثة
• 📊 تحليل السوق والعملات
• 💡 الإجابة على جميع أسئلتك
• 🌐 معلومات محدثة من الإنترنت

<b>📝 كيفية الاستخدام:</b>

/ask ما هو البيتكوين؟
/ask ابحث عن أحدث أخبار Ethereum
/ask ما هي أفضل استراتيجيات التداول؟

<b>💡 نصيحة:</b>
يمكنك طرح أي سؤال وسأجيبك بدقة واحترافية! 🚀
      ` : `
🤖 <b>Smart Chat</b>

Hello! I'm an advanced AI assistant that can:

✨ <b>Capabilities:</b>
• 💬 Smart conversation with full context
• 🔍 Internet search for updated information
• 📊 Market and crypto analysis
• 💡 Answer all your questions
• 🌐 Updated information from the internet

<b>📝 How to use:</b>

/ask what is Bitcoin?
/ask search for latest Ethereum news
/ask what are the best trading strategies?

<b>💡 Tip:</b>
You can ask any question and I'll answer accurately and professionally! 🚀
      `;
      
      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML' });
    }

    await safeSendMessage(bot, chatId, lang === 'ar' ? '⏳ جاري التفكير...' : '⏳ Thinking...', { parse_mode: 'HTML' });

    const result = await advancedAIService.processRequest(userId, userMessage, { lang });

    if (result.success) {
      const responseMessage = `🤖 ${result.content}`;
      
      if (responseMessage.length > 4096) {
        const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
        for (const chunk of chunks) {
          await safeSendMessage(bot, chatId, chunk, { parse_mode: 'HTML' });
        }
      } else {
        await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
      }
    } else {
      await safeSendMessage(bot, chatId, `❌ ${result.content}`, { parse_mode: 'HTML' });
    }

  } catch (error) {
    console.error('Error in /ask command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// /search - البحث في الإنترنت
bot.onText(/\/search(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const searchQuery = match[1].trim();

  try {
    if (!(await requireChannelMembership(userId, chatId, msg))) return;

    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    if (!searchQuery) {
      const helpMessage = lang === 'ar' ? `
🔍 <b>البحث في الإنترنت - Internet Search</b>

ابحث عن أي معلومة على الإنترنت واحصل على إجابات محدثة ودقيقة!

<b>📝 كيفية الاستخدام:</b>

/search Bitcoin price today
/search أخبار العملات الرقمية
/search latest crypto news
/search تحليل سوق الفوركس

<b>✨ المميزات:</b>
• 🌐 معلومات محدثة من الإنترنت
• 📊 تحليل ذكي للنتائج
• 📚 مصادر موثوقة
• ⚡ نتائج سريعة

<b>💡 نصيحة:</b>
كن محدداً في سؤالك للحصول على أفضل النتائج!
      ` : `
🔍 <b>Internet Search</b>

Search for any information on the internet and get updated, accurate answers!

<b>📝 How to use:</b>

/search Bitcoin price today
/search crypto news
/search latest market analysis
/search forex trading strategies

<b>✨ Features:</b>
• 🌐 Updated information from the internet
• 📊 Smart analysis of results
• 📚 Reliable sources
• ⚡ Fast results

<b>💡 Tip:</b>
Be specific in your question for best results!
      `;
      
      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML' });
    }

    await safeSendMessage(bot, chatId, lang === 'ar' ? '🔍 جاري البحث...' : '🔍 Searching...', { parse_mode: 'HTML' });

    const result = await advancedAIService.searchAndAnalyze(searchQuery, lang);

    if (result.content) {
      const responseMessage = `🔍 <b>${lang === 'ar' ? 'نتائج البحث' : 'Search Results'}</b>\n\n${result.content}`;
      
      if (responseMessage.length > 4096) {
        const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
        for (const chunk of chunks) {
          await safeSendMessage(bot, chatId, chunk, { parse_mode: 'HTML' });
        }
      } else {
        await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
      }
    } else {
      await safeSendMessage(bot, chatId, lang === 'ar' ? '❌ لم أجد نتائج' : '❌ No results found');
    }

  } catch (error) {
    console.error('Error in /search command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// /imagine - إنشاء الصور
bot.onText(/\/imagine(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const imageDescription = match[1].trim();

  try {
    if (!(await requireChannelMembership(userId, chatId, msg))) return;

    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    if (!imageDescription) {
      const helpMessage = lang === 'ar' ? `
🎨 <b>إنشاء الصور - Image Generation</b>

اصنع صوراً احترافية بالذكاء الاصطناعي!

<b>📝 كيفية الاستخدام:</b>

/imagine قط لطيف يلعب بالكرة
/imagine beautiful sunset over ocean
/imagine robot trading cryptocurrency
/imagine منظر طبيعي جميل

<b>✨ المميزات:</b>
• 🎨 صور عالية الجودة
• ⚡ توليد سريع
• 🎯 دقة في التفاصيل
• 🌈 ألوان واقعية

<b>💡 نصيحة:</b>
كن وصفياً ومحدداً للحصول على أفضل النتائج!

<i>⚠️ ملاحظة: هذه الميزة تتطلب Replicate API key</i>
      ` : `
🎨 <b>Image Generation</b>

Create professional images with AI!

<b>📝 How to use:</b>

/imagine cute cat playing with ball
/imagine beautiful sunset over ocean
/imagine robot trading cryptocurrency
/imagine beautiful landscape

<b>✨ Features:</b>
• 🎨 High quality images
• ⚡ Fast generation
• 🎯 Precise details
• 🌈 Realistic colors

<b>💡 Tip:</b>
Be descriptive and specific for best results!

<i>⚠️ Note: This feature requires Replicate API key</i>
      `;
      
      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML' });
    }

    await safeSendMessage(bot, chatId, lang === 'ar' ? '🎨 جاري إنشاء الصورة...' : '🎨 Generating image...', { parse_mode: 'HTML' });

    const result = await advancedAIService.generateImage(imageDescription, lang);

    await safeSendMessage(bot, chatId, result.content, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('Error in /imagine command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// /analyze - تحليل ملف
bot.onText(/\/analyze(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const filePath = match[1].trim();

  try {
    if (!(await requireChannelMembership(userId, chatId, msg))) return;

    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';

    if (!filePath) {
      const helpMessage = lang === 'ar' ? `
📊 <b>تحليل الملفات - File Analysis</b>

قم بتحليل أي ملف برمجي واحصل على تحسينات وملاحظات!

<b>📝 كيفية الاستخدام:</b>

/analyze bot.js
/analyze package.json
/analyze database.js

<b>✨ المميزات:</b>
• 🔍 تحليل شامل للكود
• 🐛 إيجاد الأخطاء
• 💡 اقتراحات للتحسين
• 📈 تقييم الجودة

<b>💡 نصيحة:</b>
استخدم المسار الكامل أو النسبي للملف
      ` : `
📊 <b>File Analysis</b>

Analyze any code file and get improvements and notes!

<b>📝 How to use:</b>

/analyze bot.js
/analyze package.json
/analyze database.js

<b>✨ Features:</b>
• 🔍 Comprehensive code analysis
• 🐛 Find bugs
• 💡 Improvement suggestions
• 📈 Quality rating

<b>💡 Tip:</b>
Use full or relative file path
      `;
      
      return safeSendMessage(bot, chatId, helpMessage, { parse_mode: 'HTML' });
    }

    await safeSendMessage(bot, chatId, lang === 'ar' ? '📊 جاري تحليل الملف...' : '📊 Analyzing file...', { parse_mode: 'HTML' });

    const result = await advancedAIService.analyzeFile(filePath, lang);

    if (result.content) {
      const responseMessage = result.content;
      
      if (responseMessage.length > 4096) {
        const chunks = responseMessage.match(/[\s\S]{1,4096}/g) || [];
        for (const chunk of chunks) {
          await safeSendMessage(bot, chatId, chunk, { parse_mode: 'HTML' });
        }
      } else {
        await safeSendMessage(bot, chatId, responseMessage, { parse_mode: 'HTML' });
      }
    } else {
      await safeSendMessage(bot, chatId, lang === 'ar' ? '❌ فشل التحليل' : '❌ Analysis failed');
    }

  } catch (error) {
    console.error('Error in /analyze command:', error);
    const user = await db.getUser(userId);
    const lang = user ? (user.language || 'ar') : 'ar';
    await safeSendMessage(bot, chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// ==================== End of Advanced AI Commands ====================

function startBot() {
  try {
    bot.startPolling({ restart: true });
    console.log('✅ Bot started successfully');
  } catch (error) {
    console.error('❌ Failed to start bot:', error.message);
    if (error.message.includes('409')) {
      console.log('💡 حل: أوقف جميع النسخ الأخرى من البوت أولاً');
    }
    setTimeout(() => {
      console.log('🔄 إعادة المحاولة...');
      startBot();
    }, 5000);
  }
}

module.exports = bot;
module.exports.startBot = startBot;
module.exports.bot = bot;