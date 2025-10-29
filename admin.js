
const db = require('./database');
const config = require('./config');
const okx = require('./okx');
const { addWithdrawalToQueue } = require('./withdrawal-queue');
const { notifyUserSuccess, notifyOwnerSuccess } = require('./withdrawal-notifier');
const { safeSendMessage, safeSendPhoto, safeEditMessageText, safeAnswerCallbackQuery } = require('./safe-message');
const { t } = require('./languages');

async function initAdminCommands(bot) {
  
  // لوحة التحكم الرئيسية
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== config.OWNER_ID) {
      const user = await db.getUser(userId);
      const lang = user ? user.language : 'ar';
      return safeSendMessage(bot, chatId, `❌ ${t(lang, 'admin_unauthorized')}`);
    }
    
    const user = await db.getUser(userId);
    const lang = user ? user.language : 'ar';
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📊 ${t(lang, 'admin_stats')}`, callback_data: 'admin_stats' },
            { text: `👥 ${t(lang, 'admin_users')}`, callback_data: 'admin_users' }
          ],
          [
            { text: `💸 ${t(lang, 'admin_withdrawals')}`, callback_data: 'admin_withdrawals' },
            { text: `💰 ${t(lang, 'admin_transactions')}`, callback_data: 'admin_transactions' }
          ],
          [
            { text: `👨‍💼 ${t(lang, 'admin_analysts')}`, callback_data: 'admin_analysts' },
            { text: `🎁 ${t(lang, 'admin_referrals')}`, callback_data: 'admin_referrals' }
          ],
          [
            { text: `📢 ${t(lang, 'admin_broadcast')}`, callback_data: 'admin_broadcast' }
          ],
          [
            { text: `🤖 ${lang === 'ar' ? 'مساعدي الذكي' : 'My AI Assistant'}`, callback_data: 'admin_open_ai' }
          ],
          [
            { text: `🔄 ${t(lang, 'admin_refresh')}`, callback_data: 'admin_refresh' }
          ]
        ]
      }
    };
    
    await safeSendMessage(bot, chatId, `
🎛️ <b>${t(lang, 'admin_panel_title')}</b>

${t(lang, 'admin_welcome')} ${msg.from.first_name}!
${t(lang, 'admin_choose_operation')}
`, { parse_mode: 'HTML', ...keyboard });
  });
  
  // معالج callbacks للوحة التحكم
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    // تحقق من جميع الـ callbacks الخاصة بالإدارة
    const adminCallbacks = [
      'admin_stats', 'admin_users', 'admin_withdrawals', 'admin_transactions',
      'admin_analysts', 'admin_referrals', 'admin_broadcast', 'admin_refresh',
      'admin_back', 'admin_search_user', 'admin_open_ai'
    ];
    
    const isAdminCallback = adminCallbacks.some(cb => data.startsWith(cb)) || 
                           data.startsWith('approve_withdrawal_') || 
                           data.startsWith('reject_withdrawal_') ||
                           data.startsWith('ban_user_') ||
                           data.startsWith('ban_duration_') ||
                           data.startsWith('unban_user_') ||
                           data.startsWith('restrict_user_') ||
                           data.startsWith('restrict_action_') ||
                           data.startsWith('delete_user_');
    
    if (isAdminCallback && userId !== config.OWNER_ID) {
      console.warn(`⚠️ Unauthorized access attempt from ${userId} to ${data}`);
      const user = await db.getUser(userId);
      const lang = user ? user.language : 'ar';
      return safeAnswerCallbackQuery(bot, query.id, { text: `❌ ${t(lang, 'admin_unauthorized_short')}`, show_alert: true });
    }
    
    if (!isAdminCallback) return;
    
    const user = await db.getUser(userId);
    const lang = user ? user.language : 'ar';
    
    try {
      // الإحصائيات العامة
      if (data === 'admin_stats') {
        await safeAnswerCallbackQuery(bot, query.id);
        const users = await db.getAllUsers();
        const activeSubscriptions = users.filter(u => {
          if (!u.subscription_expires) return false;
          return new Date(u.subscription_expires) > new Date();
        });
        
        const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
        const totalReferralEarnings = users.reduce((sum, u) => sum + (u.referral_earnings || 0), 0);
        
        const analysts = await db.getAllAnalysts();
        const totalAnalystSubscribers = analysts.reduce((sum, a) => sum + a.total_subscribers, 0);
        
        const today = new Date();
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const newUsersToday = users.filter(u => new Date(u.created_at) > new Date().setHours(0,0,0,0)).length;
        const newUsersLast7Days = users.filter(u => new Date(u.created_at) > last7Days).length;
        const newUsersLast30Days = users.filter(u => new Date(u.created_at) > last30Days).length;
        
        const usersWithBalance = users.filter(u => u.balance > 0).length;
        const avgBalance = usersWithBalance > 0 ? totalBalance / usersWithBalance : 0;
        
        const expiringSoon = users.filter(u => {
          if (!u.subscription_expires) return false;
          const expiryDate = new Date(u.subscription_expires);
          const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
          return daysLeft > 0 && daysLeft <= 7;
        }).length;
        
        const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
        
        const message = `
📊 <b>${t(lang, 'admin_system_stats')}</b>

━━━━━━━━━━━━━━━━━━━━
👥 <b>${t(lang, 'admin_users_section')}:</b>
• ${t(lang, 'admin_total_users')}: <b>${users.length}</b>
• ${t(lang, 'admin_new_users_today')}: <b>${newUsersToday}</b>
• ${t(lang, 'admin_new_users_7days')}: <b>${newUsersLast7Days}</b>
• ${t(lang, 'admin_new_users_30days')}: <b>${newUsersLast30Days}</b>

━━━━━━━━━━━━━━━━━━━━
📈 <b>${t(lang, 'admin_subscriptions_section')}:</b>
• ${t(lang, 'admin_active_subscriptions')}: <b>${activeSubscriptions.length}</b>
• ${t(lang, 'admin_in_trial')}: <b>${users.filter(u => !u.free_trial_used).length}</b>
• ${t(lang, 'admin_expires_soon')}: <b>${expiringSoon}</b>
• ${t(lang, 'admin_conversion_rate')}: <b>${users.length > 0 ? ((activeSubscriptions.length / users.length) * 100).toFixed(1) : 0}%</b>

━━━━━━━━━━━━━━━━━━━━
💰 <b>${t(lang, 'admin_balances_section')}:</b>
• ${t(lang, 'admin_total_balance')}: <b>${totalBalance.toFixed(2)} USDT</b>
• ${t(lang, 'admin_users_with_balance')}: <b>${usersWithBalance}</b>
• ${t(lang, 'admin_avg_balance')}: <b>${avgBalance.toFixed(2)} USDT</b>
• ${t(lang, 'admin_total_referral_earnings')}: <b>${totalReferralEarnings.toFixed(2)} USDT</b>

━━━━━━━━━━━━━━━━━━━━
👨‍💼 <b>${t(lang, 'admin_analysts_section')}:</b>
• ${t(lang, 'admin_total_analysts')}: <b>${analysts.length}</b>
• ${t(lang, 'admin_total_subscribers')}: <b>${totalAnalystSubscribers}</b>
• ${t(lang, 'admin_avg_subscribers')}: <b>${analysts.length > 0 ? (totalAnalystSubscribers / analysts.length).toFixed(1) : 0}</b>

━━━━━━━━━━━━━━━━━━━━
📅 <b>${t(lang, 'admin_last_update')}:</b> ${new Date().toLocaleString(localeStr, { 
  dateStyle: 'full', 
  timeStyle: 'short' 
})}

🤖 <b>${t(lang, 'admin_bot_status')}:</b> 🟢 ${t(lang, 'admin_bot_running')}
`;
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // إدارة المستخدمين
      else if (data === 'admin_users') {
        await safeAnswerCallbackQuery(bot, query.id);
        const users = await db.getAllUsers();
        const recentUsers = users.slice(0, 10);
        
        let message = `👥 <b>${t(lang, 'admin_last_10_users')}</b>\n\n`;
        
        recentUsers.forEach((user, index) => {
          const status = user.subscription_expires && new Date(user.subscription_expires) > new Date() ? '✅' : '❌';
          message += `${index + 1}. ${status} ${user.first_name} (@${user.username || 'N/A'})\n`;
          message += `   ID: <code>${user.user_id}</code>\n`;
          message += `   ${t(lang, 'admin_balance')}: ${user.balance} USDT\n\n`;
        });
        
        const keyboard = {
          inline_keyboard: [
            [{ text: `🔍 ${t(lang, 'admin_search_user_button')}`, callback_data: 'admin_search_user' }],
            [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
          ]
        };
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
      
      // المعاملات
      else if (data === 'admin_transactions') {
        await safeAnswerCallbackQuery(bot, query.id);
        const transactions = await db.getAllTransactions();
        const recentTransactions = transactions.slice(0, 15);
        
        const totalDeposits = transactions
          .filter(t => t.type === 'deposit')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const totalWithdrawals = transactions
          .filter(t => t.type === 'withdrawal' && t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const pendingWithdrawals = transactions
          .filter(t => t.type === 'withdrawal' && t.status === 'pending')
          .reduce((sum, t) => sum + t.amount, 0);
        
        const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
        
        let message = `
💰 <b>${t(lang, 'admin_transactions_log')}</b>

━━━━━━━━━━━━━━━━━━━━
📊 <b>${t(lang, 'admin_stats_section')}:</b>
• ${t(lang, 'admin_total_deposits')}: <b>${totalDeposits.toFixed(2)} USDT</b>
• ${t(lang, 'admin_total_withdrawals')}: <b>${totalWithdrawals.toFixed(2)} USDT</b>
• ${t(lang, 'admin_pending_withdrawals_amount')}: <b>${pendingWithdrawals.toFixed(2)} USDT</b>
• ${t(lang, 'admin_difference')}: <b>${(totalDeposits - totalWithdrawals).toFixed(2)} USDT</b>

━━━━━━━━━━━━━━━━━━━━
📜 <b>${t(lang, 'admin_last_15_transactions')}:</b>

`;
        
        if (recentTransactions.length === 0) {
          message += t(lang, 'admin_no_transactions');
        } else {
          recentTransactions.forEach((transaction, index) => {
            const typeEmoji = transaction.type === 'deposit' ? '📥' : '📤';
            const statusEmoji = transaction.status === 'completed' ? '✅' : 
                              transaction.status === 'pending' ? '⏳' : '❌';
            const transactionType = transaction.type === 'deposit' ? 'admin_deposit' : 'admin_withdrawal';
            message += `${index + 1}. ${typeEmoji} <b>${t(lang, transactionType)}</b> ${statusEmoji}\n`;
            message += `   ${t(lang, 'notif_amount')}: ${transaction.amount} USDT\n`;
            message += `   ${t(lang, 'admin_date')}: ${new Date(transaction.created_at).toLocaleString(localeStr)}\n\n`;
          });
        }
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // طلبات السحب
      else if (data === 'admin_withdrawals') {
        await safeAnswerCallbackQuery(bot, query.id);
        const withdrawals = await db.getPendingWithdrawals();
        
        if (withdrawals.length === 0) {
          await safeEditMessageText(bot, `💸 <b>${t(lang, 'admin_no_pending_withdrawals')}</b>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
        
        let message = `💸 <b>${t(lang, 'admin_pending_withdrawals_title')} (${withdrawals.length})</b>\n\n`;
        
        const keyboard = [];
        
        withdrawals.forEach((w, index) => {
          message += `${index + 1}. ${w.first_name} (@${w.username || 'N/A'})\n`;
          message += `   ${t(lang, 'notif_amount')}: ${w.amount} USDT\n`;
          message += `   ${t(lang, 'notif_address')}: <code>${w.wallet_address}</code>\n`;
          message += `   ${t(lang, 'admin_date')}: ${new Date(w.created_at).toLocaleString(localeStr)}\n\n`;
          
          keyboard.push([
            { text: `✅ ${t(lang, 'admin_approve')} #${index + 1}`, callback_data: `approve_withdrawal_${w._id}` },
            { text: `❌ ${t(lang, 'admin_reject')} #${index + 1}`, callback_data: `reject_withdrawal_${w._id}` }
          ]);
        });
        
        keyboard.push([{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]);
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // المحللين
      else if (data === 'admin_analysts') {
        await safeAnswerCallbackQuery(bot, query.id);
        const analysts = await db.getAllAnalysts();
        
        if (analysts.length === 0) {
          await safeEditMessageText(bot, `👨‍💼 <b>${t(lang, 'admin_no_analysts')}</b>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        let message = `👨‍💼 <b>${t(lang, 'admin_registered_analysts')} (${analysts.length})</b>\n\n`;
        
        analysts.forEach((analyst, index) => {
          message += `${index + 1}. <b>${analyst.name}</b>\n`;
          message += `   ${t(lang, 'admin_price')}: ${analyst.monthly_price} USDT\n`;
          message += `   ${t(lang, 'admin_subscribers')}: ${analyst.total_subscribers}\n`;
          message += `   ${t(lang, 'admin_rating')}: ${analyst.rating}/5\n\n`;
        });
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // الإحالات
      else if (data === 'admin_referrals') {
        await safeAnswerCallbackQuery(bot, query.id);
        const users = await db.getAllUsers();
        const topReferrers = users
          .filter(u => u.referral_earnings > 0)
          .sort((a, b) => b.referral_earnings - a.referral_earnings)
          .slice(0, 10);
        
        if (topReferrers.length === 0) {
          await safeEditMessageText(bot, `🎁 <b>${t(lang, 'admin_no_referrals_yet')}</b>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        let message = `🎁 <b>${t(lang, 'admin_top_10_referrers')}</b>\n\n`;
        
        for (const user of topReferrers) {
          const stats = await db.getReferralStats(user.user_id);
          message += `• ${user.first_name} (@${user.username || 'N/A'})\n`;
          message += `  💰 ${t(lang, 'admin_earnings_colon')} ${user.referral_earnings.toFixed(2)} USDT\n`;
          message += `  👥 ${t(lang, 'admin_referrals_colon')} ${stats.total_referrals}\n\n`;
        }
        
        await safeEditMessageText(bot, message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // فتح المساعد الذكي
      else if (data === 'admin_open_ai') {
        await safeAnswerCallbackQuery(bot, query.id);
        await safeSendMessage(bot, chatId, `
🤖 <b>${lang === 'ar' ? 'مساعدك الذكي الخاص' : 'Your Personal AI Assistant'}</b>

${lang === 'ar' ? '✨ للبدء، استخدم الأمر:' : '✨ To start, use the command:'}

/ai

${lang === 'ar' ? '📝 أو اكتب أي سؤال مباشرة بعد /ai' : '📝 Or type any question directly after /ai'}

<b>${lang === 'ar' ? 'مثال:' : 'Example:'}</b>
/ai ${lang === 'ar' ? 'اقرأ ملف bot.js واشرحه' : 'read bot.js and explain it'}

${lang === 'ar' ? '💡 المساعد الذكي يستطيع:' : '💡 The AI assistant can:'}
• ${lang === 'ar' ? 'قراءة وتحليل ملفات المشروع' : 'Read and analyze project files'}
• ${lang === 'ar' ? 'إيجاد الأخطاء والمشاكل' : 'Find bugs and issues'}
• ${lang === 'ar' ? 'اقتراح حلول وتحسينات' : 'Suggest solutions and improvements'}
• ${lang === 'ar' ? 'البحث في الكود' : 'Search through code'}
• ${lang === 'ar' ? 'الإجابة على أسئلتك التقنية' : 'Answer your technical questions'}
        `, { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // إرسال رسالة جماعية
      else if (data === 'admin_broadcast') {
        await safeAnswerCallbackQuery(bot, query.id);
        await safeEditMessageText(bot, `
📢 <b>${t(lang, 'admin_broadcast_title')}</b>

${t(lang, 'admin_broadcast_send_message')}

<i>${t(lang, 'admin_broadcast_html_note')}</i>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `❌ ${t(lang, 'admin_cancel')}`, callback_data: 'admin_back' }]
            ]
          }
        });
        
        // حفظ حالة البث
        await db.updateUser(userId, { temp_withdrawal_address: 'admin_broadcast' });
      }
      
      // الموافقة على السحب (يضيف للـ Queue للمعالجة التلقائية)
      else if (data.startsWith('approve_withdrawal_')) {
        const withdrawalId = data.replace('approve_withdrawal_', '');
        
        const withdrawals = await db.getPendingWithdrawals();
        const withdrawal = withdrawals.find(w => w._id.toString() === withdrawalId);
        
        if (!withdrawal) {
          return safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_withdrawal_not_found')}`, 
            show_alert: true 
          });
        }
        
        const analyst = await db.getAnalystByUserId(withdrawal.user_id);
        
        if (analyst) {
          const balance = await db.getAnalystBalance(analyst._id);
          const totalWithFee = withdrawal.amount + config.WITHDRAWAL_FEE;
          
          if (balance.available_balance < totalWithFee) {
            return safeAnswerCallbackQuery(bot, query.id, { 
              text: `❌ ${t(lang, 'admin_insufficient_withdrawal_balance_available')} ${balance.available_balance.toFixed(2)} USDT`, 
              show_alert: true 
            });
          }
        }
        
        try {
          // إضافة السحب إلى Queue للمعالجة التلقائية
          await addWithdrawalToQueue(
            withdrawalId,
            withdrawal.user_id,
            withdrawal.amount,
            withdrawal.wallet_address,
            withdrawal.first_name || withdrawal.username || 'Unknown'
          );
          
          await safeSendMessage(bot, chatId, `
✅ <b>${t(lang, 'admin_withdrawal_added_to_queue_title')}</b>

${t(lang, 'admin_user_colon')} ${withdrawal.first_name || withdrawal.username}
${t(lang, 'notif_amount')}: ${withdrawal.amount} USDT
${t(lang, 'notif_address')}: <code>${withdrawal.wallet_address}</code>

🔄 ${t(lang, 'admin_withdrawal_auto_process_minutes')}
📨 ${t(lang, 'admin_withdrawal_notify_on_result')}
♻️ ${t(lang, 'admin_withdrawal_retry_attempts')}
`, { parse_mode: 'HTML' });
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_withdrawal_queue_success_alert')}`, 
            show_alert: true 
          });
          
        } catch (error) {
          console.error('Error adding withdrawal to queue:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_occurred')} ` + error.message, 
            show_alert: true 
          });
        }
        
        // إعادة تحميل قائمة السحوبات
        bot.emit('callback_query', { ...query, data: 'admin_withdrawals' });
      }
      
      // معالجة يدوية للسحب الفاشل
      else if (data.startsWith('manual_approve_')) {
        const withdrawalId = data.replace('manual_approve_', '');
        
        try {
          const withdrawal = await db.getWithdrawalRequest(withdrawalId);
          
          if (!withdrawal) {
            return safeAnswerCallbackQuery(bot, query.id, { 
              text: `❌ ${t(lang, 'admin_withdrawal_not_found')}`, 
              show_alert: true 
            });
          }
          
          // تحديث الحالة إلى approved
          await db.approveWithdrawal(withdrawalId);
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_manual_approval_confirmed')}`, 
            show_alert: true 
          });
          
          await safeSendMessage(bot, withdrawal.user_id, `
✅ <b>${t(lang, 'admin_withdrawal_completed_successfully_title')}</b>

💸 ${t(lang, 'notif_amount')}: ${withdrawal.amount} USDT
📍 ${t(lang, 'notif_address')}: <code>${withdrawal.wallet_address}</code>

${t(lang, 'admin_manual_processed_by_admin')}
`, { parse_mode: 'HTML' });
          
        } catch (error) {
          console.error('Error manual approving withdrawal:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_occurred')} ` + error.message, 
            show_alert: true 
          });
        }
      }
      
      // إعادة محاولة السحب الفاشل
      else if (data.startsWith('retry_withdrawal_')) {
        const withdrawalId = data.replace('retry_withdrawal_', '');
        
        try {
          const withdrawal = await db.getWithdrawalRequest(withdrawalId);
          
          if (!withdrawal) {
            return safeAnswerCallbackQuery(bot, query.id, { 
              text: `❌ ${t(lang, 'admin_withdrawal_not_found')}`, 
              show_alert: true 
            });
          }
          
          // إعادة إضافة للـ Queue
          await addWithdrawalToQueue(
            withdrawalId,
            withdrawal.user_id,
            withdrawal.amount,
            withdrawal.wallet_address,
            'Retry'
          );
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `♻️ ${t(lang, 'admin_retry_success')}`, 
            show_alert: true 
          });
          
        } catch (error) {
          console.error('Error retrying withdrawal:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_occurred')} ` + error.message, 
            show_alert: true 
          });
        }
      }
      
      // رفض السحب
      else if (data.startsWith('reject_withdrawal_')) {
        const withdrawalId = data.replace('reject_withdrawal_', '');
        
        try {
          const withdrawal = await db.rejectWithdrawal(withdrawalId);
          
          const totalWithFee = withdrawal.amount + config.WITHDRAWAL_FEE;
          
          await safeSendMessage(bot, withdrawal.user_id, `
❌ <b>${t(lang, 'admin_withdrawal_rejected_title')}</b>

${t(lang, 'notif_amount')}: ${withdrawal.amount} USDT
${t(lang, 'notif_address')}: <code>${withdrawal.wallet_address}</code>

${t(lang, 'admin_amount_refunded_to_balance_colon')} ${totalWithFee} USDT
`, { parse_mode: 'HTML' });
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_rejection_refund_user_success')}`, 
            show_alert: true 
          });
          
        } catch (error) {
          console.error('Error rejecting withdrawal:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_occurred')} ` + error.message, 
            show_alert: true 
          });
        }
        
        bot.emit('callback_query', { ...query, data: 'admin_withdrawals' });
      }
      
      // البحث عن مستخدم
      else if (data === 'admin_search_user') {
        await safeAnswerCallbackQuery(bot, query.id);
        await safeEditMessageText(bot, `
🔍 <b>${t(lang, 'admin_search_user_title')}</b>

${t(lang, 'admin_search_user_prompt')}

<i>${t(lang, 'admin_example')} 123456789</i>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `❌ ${t(lang, 'admin_cancel')}`, callback_data: 'admin_back' }]
            ]
          }
        });
        
        // حفظ حالة البحث
        await db.updateUser(userId, { temp_withdrawal_address: 'admin_search_user' });
      }
      
      // حظر مستخدم
      else if (data.startsWith('ban_user_')) {
        await safeAnswerCallbackQuery(bot, query.id);
        const targetUserId = parseInt(data.replace('ban_user_', ''));
        const keyboard = [
          [
            { text: `🕐 ${t(lang, 'admin_1_hour')}`, callback_data: `ban_duration_${targetUserId}_1` },
            { text: `📅 ${t(lang, 'admin_24_hours')}`, callback_data: `ban_duration_${targetUserId}_24` }
          ],
          [
            { text: `🗓️ ${t(lang, 'admin_7_days')}`, callback_data: `ban_duration_${targetUserId}_168` },
            { text: `⛔ ${t(lang, 'admin_permanent')}`, callback_data: `ban_duration_${targetUserId}_permanent` }
          ],
          [{ text: `🔙 ${t(lang, 'admin_back_button')}`, callback_data: 'admin_users' }]
        ];
        
        await safeEditMessageText(bot, `
⛔ <b>${t(lang, 'admin_ban_user_title')}</b>

${t(lang, 'admin_select_ban_duration_user_id')} <code>${targetUserId}</code>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // تنفيذ الحظر بالمدة المحددة
      else if (data.startsWith('ban_duration_')) {
        const parts = data.replace('ban_duration_', '').split('_');
        const targetUserId = parseInt(parts[0]);
        const duration = parts[1];
        
        try {
          const durationHours = duration === 'permanent' ? null : parseInt(duration);
          const targetUser = await db.getUser(targetUserId);
          const targetLang = targetUser ? (targetUser.language || 'ar') : 'ar';
          
          await db.banUser(targetUserId, t(targetLang, 'admin_ban_reason_from_admin'), userId, durationHours);
          
          const durationText = duration === 'permanent' ? t(lang, 'admin_permanently') : `${t(lang, 'admin_for_duration')} ${duration} ${t(lang, 'admin_hour_singular')}`;
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_user_banned_success')} ${durationText}`, 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم المحظور
          try {
            await safeSendMessage(bot, targetUserId, `
⛔ <b>${t(targetLang, 'admin_you_have_been_banned_title')}</b>

${t(targetLang, 'admin_reason_colon')} ${t(targetLang, 'admin_ban_reason_from_admin')}
${t(targetLang, 'admin_duration_colon')} ${duration === 'permanent' ? t(targetLang, 'admin_permanently') : `${duration} ${t(targetLang, 'admin_hour_singular')}`}
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('User ban notification not sent');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error banning user:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_banning_user')}`, 
            show_alert: true 
          });
        }
      }
      
      // إلغاء حظر المستخدم
      else if (data.startsWith('unban_user_')) {
        const targetUserId = parseInt(data.replace('unban_user_', ''));
        
        try {
          await db.unbanUser(targetUserId);
          
          const targetUser = await db.getUser(targetUserId);
          const targetLang = targetUser ? (targetUser.language || 'ar') : 'ar';
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_user_unbanned_success')}`, 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم
          try {
            await safeSendMessage(bot, targetUserId, `
✅ <b>${t(targetLang, 'admin_unban_notification_title')}</b>

${t(targetLang, 'admin_can_use_normally')}
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('User unban notification not sent');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error unbanning user:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_unbanning')}`, 
            show_alert: true 
          });
        }
      }
      
      // تقييد مستخدم
      else if (data.startsWith('restrict_user_')) {
        await safeAnswerCallbackQuery(bot, query.id);
        const targetUserId = parseInt(data.replace('restrict_user_', ''));
        const keyboard = [
          [
            { text: `🚫 ${t(lang, 'admin_restriction_no_trading')}`, callback_data: `restrict_action_${targetUserId}_no_trading` },
            { text: `🚫 ${t(lang, 'admin_restriction_no_deposit')}`, callback_data: `restrict_action_${targetUserId}_no_deposit` }
          ],
          [
            { text: `🚫 ${t(lang, 'admin_restriction_no_withdraw')}`, callback_data: `restrict_action_${targetUserId}_no_withdraw` },
            { text: `🚫 ${t(lang, 'admin_restriction_no_referral')}`, callback_data: `restrict_action_${targetUserId}_no_referral` }
          ],
          [{ text: `🔙 ${t(lang, 'admin_back')}`, callback_data: 'admin_users' }]
        ];
        
        await safeEditMessageText(bot, `
🚫 <b>${t(lang, 'admin_restrict_user_title')}</b>

${t(lang, 'admin_select_restriction_type')} <code>${targetUserId}</code>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // تنفيذ التقييد
      else if (data.startsWith('restrict_action_')) {
        const parts = data.replace('restrict_action_', '').split('_');
        const targetUserId = parseInt(parts[0]);
        const restrictionType = parts.slice(1).join('_');
        
        try {
          const restrictions = { [restrictionType]: true };
          await db.restrictUser(targetUserId, restrictions, 168); // 7 days
          
          const targetUser = await db.getUser(targetUserId);
          const targetLang = targetUser ? (targetUser.language || 'ar') : 'ar';
          
          const restrictionNames = {
            'no_trading': t(lang, 'admin_restriction_no_trading'),
            'no_deposit': t(lang, 'admin_restriction_no_deposit'),
            'no_withdraw': t(lang, 'admin_restriction_no_withdraw'),
            'no_referral': t(lang, 'admin_restriction_no_referral')
          };
          
          const restrictionNamesTarget = {
            'no_trading': t(targetLang, 'admin_restriction_no_trading'),
            'no_deposit': t(targetLang, 'admin_restriction_no_deposit'),
            'no_withdraw': t(targetLang, 'admin_restriction_no_withdraw'),
            'no_referral': t(targetLang, 'admin_restriction_no_referral')
          };
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_restriction_applied')}: ${restrictionNames[restrictionType]}`, 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم
          try {
            await safeSendMessage(bot, targetUserId, `
⚠️ <b>${t(targetLang, 'admin_account_restricted_title')}</b>

${t(targetLang, 'admin_restriction_colon')} ${restrictionNamesTarget[restrictionType]}
${t(targetLang, 'admin_duration_colon')} 7 ${t(targetLang, 'admin_days')}
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('User restriction notification not sent');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error restricting user:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_restricting_user')}`, 
            show_alert: true 
          });
        }
      }
      
      // حذف حساب المستخدم
      else if (data.startsWith('delete_user_confirm_')) {
        const targetUserId = parseInt(data.replace('delete_user_confirm_', ''));
        
        try {
          await db.deleteUserAccount(targetUserId);
          
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `✅ ${t(lang, 'admin_delete_user_permanently')}`, 
            show_alert: true 
          });
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error deleting user:', error);
          await safeAnswerCallbackQuery(bot, query.id, { 
            text: `❌ ${t(lang, 'admin_error_deleting_user')}`, 
            show_alert: true 
          });
        }
      }
      
      // تأكيد حذف المستخدم
      else if (data.startsWith('delete_user_')) {
        await safeAnswerCallbackQuery(bot, query.id);
        const targetUserId = parseInt(data.replace('delete_user_', ''));
        
        const keyboard = [
          [
            { text: `✅ ${t(lang, 'admin_yes_delete_account')}`, callback_data: `delete_user_confirm_${targetUserId}` }
          ],
          [
            { text: `❌ ${t(lang, 'admin_cancel')}`, callback_data: 'admin_users' }
          ]
        ];
        
        await safeEditMessageText(bot, `
⚠️ <b>${t(lang, 'admin_confirm_delete_title')}</b>

${t(lang, 'admin_confirm_delete_question')} <code>${targetUserId}</code>؟

⚠️ <b>${t(lang, 'admin_warning_irreversible')}</b>
${t(lang, 'admin_will_be_deleted')}
• ${t(lang, 'admin_user_data')}
• ${t(lang, 'admin_all_transactions')}
• ${t(lang, 'admin_analyst_subscriptions')}
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // الرجوع للقائمة الرئيسية
      else if (data === 'admin_back' || data === 'admin_refresh') {
        await safeAnswerCallbackQuery(bot, query.id);
        const keyboard = {
          inline_keyboard: [
            [
              { text: `📊 ${t(lang, 'admin_stats')}`, callback_data: 'admin_stats' },
              { text: `👥 ${t(lang, 'admin_users')}`, callback_data: 'admin_users' }
            ],
            [
              { text: `💸 ${t(lang, 'admin_withdrawals')}`, callback_data: 'admin_withdrawals' },
              { text: `💰 ${t(lang, 'admin_transactions')}`, callback_data: 'admin_transactions' }
            ],
            [
              { text: `👨‍💼 ${t(lang, 'admin_analysts')}`, callback_data: 'admin_analysts' },
              { text: `🎁 ${t(lang, 'admin_referrals')}`, callback_data: 'admin_referrals' }
            ],
            [
              { text: `📢 ${t(lang, 'admin_broadcast')}`, callback_data: 'admin_broadcast' }
            ],
            [
              { text: `🤖 ${lang === 'ar' ? 'مساعدي الذكي' : 'My AI Assistant'}`, callback_data: 'admin_open_ai' }
            ],
            [
              { text: `🔄 ${t(lang, 'admin_refresh')}`, callback_data: 'admin_refresh' }
            ]
          ]
        };
        
        await safeEditMessageText(bot, `
🎛️ <b>${t(lang, 'admin_panel_title')}</b>

${t(lang, 'admin_welcome')} ${query.from.first_name}!
${t(lang, 'admin_choose_operation')}
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
      
    } catch (error) {
      console.error('Admin callback error:', error);
      await safeAnswerCallbackQuery(bot, query.id, { 
        text: `❌ ${t(lang, 'admin_error_generic')}`, 
        show_alert: true 
      });
    }
  });
  
  // معالج الرسائل الجماعية والبحث عن المستخدمين
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (userId !== config.OWNER_ID) return;
    
    const user = await db.getUser(userId);
    
    // معالج البحث عن مستخدم
    if (user && user.temp_withdrawal_address === 'admin_search_user') {
      if (!text || text.startsWith('/')) return;
      
      const searchUserId = parseInt(text.trim());
      
      if (isNaN(searchUserId)) {
        const lang = user.language || 'ar';
        return safeSendMessage(bot, chatId, `❌ ${t(lang, 'admin_invalid_user_id_number')}`);
      }
      
      const targetUser = await db.getUser(searchUserId);
      
      if (!targetUser) {
        await db.updateUser(userId, { temp_withdrawal_address: null });
        const lang = user.language || 'ar';
        return safeSendMessage(bot, chatId, `❌ ${t(lang, 'admin_user_not_found_with_id')}`);
      }
      
      const banStatus = await db.checkUserBanStatus(searchUserId);
      const subscriptionActive = await db.isSubscriptionActive(searchUserId);
      const referralStats = await db.getReferralStats(searchUserId);
      const lang = user.language || 'ar';
      const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : lang === 'ru' ? 'ru-RU' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
      
      let statusEmoji = '✅';
      let statusText = t(lang, 'admin_user_status_active');
      
      if (banStatus.banned) {
        statusEmoji = '⛔';
        if (banStatus.expires) {
          statusText = `${t(lang, 'admin_user_status_banned_until')} ${new Date(banStatus.expires).toLocaleString(localeStr)}`;
        } else {
          statusText = t(lang, 'admin_user_status_banned_permanently_text');
        }
      }
      
      const message = `
👤 <b>${t(lang, 'admin_user_info_title')}</b>

━━━━━━━━━━━━━━━━━━━━
📋 <b>${t(lang, 'admin_basic_info_section')}:</b>
• ${t(lang, 'admin_name_with_colon')} ${targetUser.first_name} ${targetUser.last_name || ''}
• ${t(lang, 'admin_username_with_colon')} @${targetUser.username || t(lang, 'admin_no_username_text')}
• ${t(lang, 'admin_user_id_with_colon')} <code>${targetUser.user_id}</code>
• ${t(lang, 'admin_registration_date')}: ${new Date(targetUser.created_at).toLocaleDateString(localeStr)}

━━━━━━━━━━━━━━━━━━━━
💰 <b>${t(lang, 'admin_financial_info_section')}:</b>
• ${t(lang, 'admin_balance_with_colon')} ${targetUser.balance || 0} USDT
• ${t(lang, 'admin_referral_earnings_with_colon')} ${targetUser.referral_earnings || 0} USDT

━━━━━━━━━━━━━━━━━━━━
📊 <b>${t(lang, 'admin_status_section')}:</b>
• ${t(lang, 'admin_status_with_colon')} ${statusEmoji} ${statusText}
• ${t(lang, 'admin_subscription_with_colon')} ${subscriptionActive ? `✅ ${t(lang, 'admin_subscription_active_status')}` : `❌ ${t(lang, 'admin_subscription_expired')}`}
${banStatus.banned && banStatus.reason ? `• ${t(lang, 'admin_ban_reason_with_colon')} ${banStatus.reason}` : ''}

━━━━━━━━━━━━━━━━━━━━
🎁 <b>${t(lang, 'admin_referrals_section')}:</b>
• ${t(lang, 'admin_referral_count_with_colon')} ${referralStats.total_referrals}
• ${t(lang, 'admin_total_earnings_with_colon')} ${referralStats.total_earnings.toFixed(2)} USDT

━━━━━━━━━━━━━━━━━━━━
⚙️ <b>${t(lang, 'admin_settings_section')}:</b>
• ${t(lang, 'admin_language_with_colon')} ${targetUser.language || 'ar'}
• ${t(lang, 'admin_notifications_with_colon')} ${targetUser.notifications_enabled ? `✅ ${t(lang, 'admin_notifications_enabled_status')}` : `❌ ${t(lang, 'admin_notifications_disabled_status')}`}
`;
      
      const keyboard = [];
      
      if (banStatus.banned) {
        keyboard.push([{ text: `✅ ${t(lang, 'admin_unban_user_button')}`, callback_data: `unban_user_${searchUserId}` }]);
      } else {
        keyboard.push([{ text: `⛔ ${t(lang, 'admin_ban_user_button')}`, callback_data: `ban_user_${searchUserId}` }]);
      }
      
      keyboard.push([{ text: `🚫 ${t(lang, 'admin_restrict_user_button')}`, callback_data: `restrict_user_${searchUserId}` }]);
      keyboard.push([{ text: `🗑️ ${t(lang, 'admin_delete_account_button')}`, callback_data: `delete_user_${searchUserId}` }]);
      keyboard.push([{ text: `🔙 ${t(lang, 'admin_back_button')}`, callback_data: 'admin_users' }]);
      
      await safeSendMessage(bot, chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      
      await db.updateUser(userId, { temp_withdrawal_address: null });
      return;
    }
    
    if (user && user.temp_withdrawal_address === 'admin_broadcast') {
      if (!text || text.startsWith('/')) return;
      
      const users = await db.getAllUsers();
      let successCount = 0;
      let failCount = 0;
      const lang = user.language || 'ar';
      
      const statusMsg = await safeSendMessage(bot, chatId, `📤 ${t(lang, 'admin_broadcasting_progress')}\n\n0/${users.length}`);
      
      for (let i = 0; i < users.length; i++) {
        try {
          await safeSendMessage(bot, users[i].user_id, text, { parse_mode: 'HTML' });
          successCount++;
        } catch (error) {
          failCount++;
        }
        
        // تحديث كل 10 مستخدمين
        if ((i + 1) % 10 === 0 || i === users.length - 1) {
          await safeEditMessageText(bot, 
            `📤 ${t(lang, 'admin_broadcasting_progress')}\n\n${i + 1}/${users.length}\n✅ ${t(lang, 'admin_broadcast_success_count')} ${successCount}\n❌ ${t(lang, 'admin_broadcast_failed_count')} ${failCount}`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id
            }
          );
        }
      }
      
      await db.updateUser(userId, { temp_withdrawal_address: null });
      
      await safeSendMessage(bot, chatId, `
✅ <b>${t(lang, 'admin_broadcast_complete')}</b>

📊 ${t(lang, 'admin_broadcast_stats_section')}
• ${t(lang, 'admin_total_users_count')} ${users.length}
• ${t(lang, 'admin_broadcast_success_count')} ${successCount}
• ${t(lang, 'admin_broadcast_failed_count')} ${failCount}
`, { parse_mode: 'HTML' });
    }
  });
}

module.exports = { initAdminCommands };
