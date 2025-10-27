const TelegramBot = require('node-telegram-bot-api');
const { LRUCache } = require('lru-cache');
const config = require('./config');
const db = require('./database');
const { t, matchesButtonKey, getLanguageKeyboard } = require('./languages');
const { safeSendMessage, safeSendPhoto, safeEditMessageText, safeAnswerCallbackQuery } = require('./safe-message');
const { BatchLoader } = require('./utils/batch-loader');
const groqService = require('./groq-service');
const { getSystemPrompt } = require('./ai-system-prompts');

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

      await safeSendMessage(bot, config.OWNER_ID, `
📞 <b>${t('ar', 'customer_service_new_message')}</b>

👤 <b>${t('ar', 'user_label')}</b> ${msg.from.first_name} ${msg.from.last_name || ''}
🆔 <b>${t('ar', 'id_label')}</b> <code>${userId}</code>
🌐 <b>${t('ar', 'label_user_language')}</b> ${getLanguageName(lang)}
📝 <b>${t('ar', 'message_label')}</b>

${text}
      `, { parse_mode: 'HTML' });

      // استخدام الذكاء الاصطناعي للرد على المستخدم بلغته
      try {
        if (groqService.enabled) {
          const typingInterval = setInterval(() => {
            bot.sendChatAction(chatId, 'typing').catch(() => {});
          }, 3000);

          const systemPrompt = getSystemPrompt(lang);
          const aiResponse = await groqService.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ], {
            model: 'llama-3.3-70b-versatile',
            max_tokens: 500,
            temperature: 0.7
          });

          clearInterval(typingInterval);

          const reply = aiResponse.choices[0].message.content;
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

        await safeSendMessage(bot, config.OWNER_ID, `
💸 <b>${t('ar', 'admin_new_manual_withdrawal')}</b>

${t('ar', 'user_label')} ${user.first_name} (@${user.username})
${t('ar', 'id_label')} ${userId}
${t('ar', 'amount_label')} ${amount} USDT
${t('ar', 'label_address')} <code>${address}</code>

⚠️ ${t('ar', 'admin_funds_reserved')}
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

          await safeSendMessage(bot, config.OWNER_ID, `
✅ <b>${t('ar', 'admin_auto_withdrawal_success')}</b>

${t('ar', 'user_label')} ${user.first_name} (@${user.username})
${t('ar', 'id_label')} ${userId}
${t('ar', 'amount_label')} ${amount} USDT
${t('ar', 'label_address')} <code>${address}</code>
${t('ar', 'label_withdrawal_id')} <code>${result.data.withdrawId}</code>
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

          await safeSendMessage(bot, config.OWNER_ID, `
❌ <b>${t('ar', 'admin_auto_withdrawal_failed')}</b>

${t('ar', 'user_label')} ${user.first_name} (@${user.username})
${t('ar', 'id_label')} ${userId}
${t('ar', 'amount_label')} ${amount} USDT
${t('ar', 'label_address')} <code>${address}</code>
${t('ar', 'label_reason')} ${result.error}

${t('ar', 'notification_amount_refunded_to_user')}
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

        await safeSendMessage(bot, config.OWNER_ID, `
⚠️ <b>${t('ar', 'admin_withdrawal_system_error')}</b>

${t('ar', 'user_label')} ${user.first_name}
${t('ar', 'amount_label')} ${amount} USDT
${t('ar', 'label_error')} ${error.message}

${t('ar', 'notification_amount_refunded_to_user')}
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

        // إرسال للمالك بالعربية (لغة المالك)
        await safeSendMessage(bot, config.OWNER_ID, `
💰 <b>${t('ar', 'new_subscription')}</b>

👤 ${t('ar', 'user_label')} ${user.first_name} (@${user.username || t('ar', 'no_username')})
🆔 ${t('ar', 'id_label')} ${userId}
🌐 <b>${t('ar', 'label_language')}</b> ${getLanguageName(userLang)}
💵 ${t('ar', 'amount_label')} ${config.SUBSCRIPTION_PRICE} USDT
📅 ${t('ar', 'valid_until')} ${expiryDate.toLocaleDateString('ar')}
${referrerId ? `🎁 ${t('ar', 'referral_commission_label')} ${referralCommission} USDT` : ''}
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

        // إرسال للمالك بالعربية (لغة المالك)
        await safeSendMessage(bot, config.OWNER_ID, `
⚠️ <b>${t('ar', 'subscription_failed')}</b>

${t('ar', 'user_label')} ${user.first_name} (@${user.username || t('ar', 'no_username')})
${t('ar', 'id_label')} ${userId}
🌐 <b>${t('ar', 'label_language')}</b> ${getLanguageName(userLang)}
${t('ar', 'error_label')} ${error.message}
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

        // إرسال للمالك بالعربية (لغة المالك)
        await safeSendMessage(bot, config.OWNER_ID, `
📝 <b>${t('ar', 'new_analyst')}</b>

${t('ar', 'name_label')} ${analyst.name}
${t('ar', 'user_label')} @${user.username}
${t('ar', 'id_label')} ${userId}
🌐 <b>${t('ar', 'label_language')}</b> ${getLanguageName(lang)}
${t('ar', 'price_label')} ${price} USDT${t('ar', 'per_month')}
${t('ar', 'description_label')} ${analyst.description}
`, { parse_mode: 'HTML' });
      } catch (createError) {
        return safeSendMessage(bot, chatId, `❌ ${createError.message}`);
      }
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

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