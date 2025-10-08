
const db = require('./database');
const config = require('./config');
const okx = require('./okx');

async function initAdminCommands(bot) {
  
  // لوحة التحكم الرئيسية
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== config.OWNER_ID) {
      return bot.sendMessage(chatId, '❌ غير مصرح لك بالوصول لهذا الأمر');
    }
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 الإحصائيات', callback_data: 'admin_stats' },
            { text: '👥 المستخدمين', callback_data: 'admin_users' }
          ],
          [
            { text: '💸 طلبات السحب', callback_data: 'admin_withdrawals' },
            { text: '💰 المعاملات', callback_data: 'admin_transactions' }
          ],
          [
            { text: '👨‍💼 المحللين', callback_data: 'admin_analysts' },
            { text: '🎁 الإحالات', callback_data: 'admin_referrals' }
          ],
          [
            { text: '📢 إرسال رسالة جماعية', callback_data: 'admin_broadcast' }
          ],
          [
            { text: '🔄 تحديث البيانات', callback_data: 'admin_refresh' }
          ]
        ]
      }
    };
    
    await bot.sendMessage(chatId, `
🎛️ <b>لوحة تحكم المالك</b>

مرحباً ${msg.from.first_name}!
اختر العملية المطلوبة:
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
      'admin_back', 'admin_search_user'
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
      console.warn(`⚠️ محاولة وصول غير مصرح من ${userId} إلى ${data}`);
      return bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك', show_alert: true });
    }
    
    if (!isAdminCallback) return;
    
    try {
      await bot.answerCallbackQuery(query.id);
      
      // الإحصائيات العامة
      if (data === 'admin_stats') {
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
        
        const message = `
📊 <b>إحصائيات النظام الشاملة</b>

━━━━━━━━━━━━━━━━━━━━
👥 <b>المستخدمين:</b>
• إجمالي المستخدمين: <b>${users.length}</b>
• مستخدمين جدد اليوم: <b>${newUsersToday}</b>
• مستخدمين جدد آخر 7 أيام: <b>${newUsersLast7Days}</b>
• مستخدمين جدد آخر 30 يوم: <b>${newUsersLast30Days}</b>

━━━━━━━━━━━━━━━━━━━━
📈 <b>الاشتراكات:</b>
• اشتراكات نشطة: <b>${activeSubscriptions.length}</b>
• في الفترة التجريبية: <b>${users.filter(u => !u.free_trial_used).length}</b>
• تنتهي خلال 7 أيام: <b>${expiringSoon}</b>
• معدل التحويل: <b>${users.length > 0 ? ((activeSubscriptions.length / users.length) * 100).toFixed(1) : 0}%</b>

━━━━━━━━━━━━━━━━━━━━
💰 <b>الأرصدة والمعاملات:</b>
• إجمالي الأرصدة: <b>${totalBalance.toFixed(2)} USDT</b>
• عدد المستخدمين برصيد: <b>${usersWithBalance}</b>
• متوسط الرصيد: <b>${avgBalance.toFixed(2)} USDT</b>
• إجمالي أرباح الإحالات: <b>${totalReferralEarnings.toFixed(2)} USDT</b>

━━━━━━━━━━━━━━━━━━━━
👨‍💼 <b>المحللين:</b>
• عدد المحللين: <b>${analysts.length}</b>
• إجمالي المشتركين: <b>${totalAnalystSubscribers}</b>
• متوسط المشتركين لكل محلل: <b>${analysts.length > 0 ? (totalAnalystSubscribers / analysts.length).toFixed(1) : 0}</b>

━━━━━━━━━━━━━━━━━━━━
📅 <b>آخر تحديث:</b> ${new Date().toLocaleString('ar-SA', { 
  dateStyle: 'full', 
  timeStyle: 'short' 
})}

🤖 <b>حالة البوت:</b> 🟢 يعمل بشكل طبيعي
`;
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // إدارة المستخدمين
      else if (data === 'admin_users') {
        const users = await db.getAllUsers();
        const recentUsers = users.slice(0, 10);
        
        let message = `👥 <b>آخر 10 مستخدمين</b>\n\n`;
        
        recentUsers.forEach((user, index) => {
          const status = user.subscription_expires && new Date(user.subscription_expires) > new Date() ? '✅' : '❌';
          message += `${index + 1}. ${status} ${user.first_name} (@${user.username || 'N/A'})\n`;
          message += `   ID: <code>${user.user_id}</code>\n`;
          message += `   الرصيد: ${user.balance} USDT\n\n`;
        });
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '🔍 بحث عن مستخدم', callback_data: 'admin_search_user' }],
            [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
          ]
        };
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
      
      // المعاملات
      else if (data === 'admin_transactions') {
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
        
        let message = `
💰 <b>سجل المعاملات</b>

━━━━━━━━━━━━━━━━━━━━
📊 <b>الإحصائيات:</b>
• إجمالي الإيداعات: <b>${totalDeposits.toFixed(2)} USDT</b>
• إجمالي السحوبات: <b>${totalWithdrawals.toFixed(2)} USDT</b>
• سحوبات معلقة: <b>${pendingWithdrawals.toFixed(2)} USDT</b>
• الفرق: <b>${(totalDeposits - totalWithdrawals).toFixed(2)} USDT</b>

━━━━━━━━━━━━━━━━━━━━
📜 <b>آخر 15 معاملة:</b>

`;
        
        if (recentTransactions.length === 0) {
          message += 'لا توجد معاملات بعد';
        } else {
          recentTransactions.forEach((t, index) => {
            const typeEmoji = t.type === 'deposit' ? '📥' : '📤';
            const statusEmoji = t.status === 'completed' ? '✅' : 
                              t.status === 'pending' ? '⏳' : '❌';
            message += `${index + 1}. ${typeEmoji} <b>${t.type === 'deposit' ? 'إيداع' : 'سحب'}</b> ${statusEmoji}\n`;
            message += `   المبلغ: ${t.amount} USDT\n`;
            message += `   التاريخ: ${new Date(t.created_at).toLocaleString('ar')}\n\n`;
          });
        }
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // طلبات السحب
      else if (data === 'admin_withdrawals') {
        const withdrawals = await db.getPendingWithdrawals();
        
        if (withdrawals.length === 0) {
          await bot.editMessageText('💸 <b>لا توجد طلبات سحب معلقة</b>', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        let message = `💸 <b>طلبات السحب المعلقة (${withdrawals.length})</b>\n\n`;
        
        const keyboard = [];
        
        withdrawals.forEach((w, index) => {
          message += `${index + 1}. ${w.first_name} (@${w.username || 'N/A'})\n`;
          message += `   المبلغ: ${w.amount} USDT\n`;
          message += `   العنوان: <code>${w.wallet_address}</code>\n`;
          message += `   التاريخ: ${new Date(w.created_at).toLocaleString('ar')}\n\n`;
          
          keyboard.push([
            { text: `✅ موافقة #${index + 1}`, callback_data: `approve_withdrawal_${w._id}` },
            { text: `❌ رفض #${index + 1}`, callback_data: `reject_withdrawal_${w._id}` }
          ]);
        });
        
        keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_back' }]);
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // المحللين
      else if (data === 'admin_analysts') {
        const analysts = await db.getAllAnalysts();
        
        if (analysts.length === 0) {
          await bot.editMessageText('👨‍💼 <b>لا يوجد محللين مسجلين</b>', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        let message = `👨‍💼 <b>المحللين المسجلين (${analysts.length})</b>\n\n`;
        
        analysts.forEach((analyst, index) => {
          message += `${index + 1}. <b>${analyst.name}</b>\n`;
          message += `   السعر: ${analyst.monthly_price} USDT\n`;
          message += `   المشتركين: ${analyst.total_subscribers}\n`;
          message += `   التقييم: ${analyst.rating}/5\n\n`;
        });
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // الإحالات
      else if (data === 'admin_referrals') {
        const users = await db.getAllUsers();
        const topReferrers = users
          .filter(u => u.referral_earnings > 0)
          .sort((a, b) => b.referral_earnings - a.referral_earnings)
          .slice(0, 10);
        
        if (topReferrers.length === 0) {
          await bot.editMessageText('🎁 <b>لا توجد إحالات بعد</b>', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
              ]
            }
          });
          return;
        }
        
        let message = `🎁 <b>أفضل 10 مُحيلين</b>\n\n`;
        
        for (const user of topReferrers) {
          const stats = await db.getReferralStats(user.user_id);
          message += `• ${user.first_name} (@${user.username || 'N/A'})\n`;
          message += `  💰 الأرباح: ${user.referral_earnings.toFixed(2)} USDT\n`;
          message += `  👥 الإحالات: ${stats.total_referrals}\n\n`;
        }
        
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 رجوع', callback_data: 'admin_back' }]
            ]
          }
        });
      }
      
      // إرسال رسالة جماعية
      else if (data === 'admin_broadcast') {
        await bot.editMessageText(`
📢 <b>إرسال رسالة جماعية</b>

أرسل الرسالة التي تريد إرسالها لجميع المستخدمين:

<i>ملاحظة: يمكنك استخدام HTML في الرسالة</i>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ إلغاء', callback_data: 'admin_back' }]
            ]
          }
        });
        
        // حفظ حالة البث
        await db.updateUser(userId, { temp_withdrawal_address: 'admin_broadcast' });
      }
      
      // الموافقة على السحب
      else if (data.startsWith('approve_withdrawal_')) {
        const withdrawalId = data.replace('approve_withdrawal_', '');
        
        const withdrawals = await db.getPendingWithdrawals();
        const withdrawal = withdrawals.find(w => w._id.toString() === withdrawalId);
        
        if (!withdrawal) {
          return bot.answerCallbackQuery(query.id, { 
            text: '❌ طلب السحب غير موجود', 
            show_alert: true 
          });
        }
        
        const processingMsg = await bot.sendMessage(chatId, '⏳ جاري معالجة السحب عبر OKX...');
        
        if (okx.isConfigured()) {
          const result = await okx.withdrawUSDT(withdrawal.wallet_address, withdrawal.amount);
          
          if (result.success) {
            await db.approveWithdrawal(withdrawalId);
            await db.createTransaction(
              withdrawal.user_id, 
              'withdrawal', 
              withdrawal.amount, 
              result.data.withdrawId, 
              withdrawal.wallet_address, 
              'completed'
            );
            
            await bot.deleteMessage(chatId, processingMsg.message_id);
            
            await bot.sendMessage(withdrawal.user_id, `
✅ <b>تم إتمام السحب بنجاح!</b>

💸 المبلغ: ${withdrawal.amount} USDT
📍 العنوان: <code>${withdrawal.wallet_address}</code>
🆔 معرف السحب: <code>${result.data.withdrawId}</code>

تم تحويل المبلغ عبر OKX
`, { parse_mode: 'HTML' });
            
            await bot.answerCallbackQuery(query.id, { 
              text: '✅ تم السحب بنجاح عبر OKX', 
              show_alert: true 
            });
          } else {
            await bot.deleteMessage(chatId, processingMsg.message_id);
            await bot.sendMessage(chatId, `
❌ <b>فشل السحب عبر OKX</b>

السبب: ${result.error}

المستخدم: ${withdrawal.first_name}
المبلغ: ${withdrawal.amount} USDT
العنوان: <code>${withdrawal.wallet_address}</code>

يرجى المعالجة يدوياً أو التحقق من إعدادات OKX
`, { parse_mode: 'HTML' });
            
            return bot.answerCallbackQuery(query.id, { 
              text: '❌ فشل السحب: ' + result.error, 
              show_alert: true 
            });
          }
        } else {
          await db.approveWithdrawal(withdrawalId);
          await bot.deleteMessage(chatId, processingMsg.message_id);
          
          await bot.sendMessage(chatId, `
⚠️ <b>OKX API غير مكوّن</b>

تمت الموافقة على الطلب ولكن يجب المعالجة يدوياً:

المستخدم: ${withdrawal.first_name}
المبلغ: ${withdrawal.amount} USDT
العنوان: <code>${withdrawal.wallet_address}</code>
`, { parse_mode: 'HTML' });
          
          await bot.answerCallbackQuery(query.id, { 
            text: '✅ تمت الموافقة - يرجى المعالجة يدوياً', 
            show_alert: true 
          });
        }
        
        // إعادة تحميل قائمة السحوبات
        bot.emit('callback_query', { ...query, data: 'admin_withdrawals' });
      }
      
      // رفض السحب
      else if (data.startsWith('reject_withdrawal_')) {
        const withdrawalId = data.replace('reject_withdrawal_', '');
        
        // يمكنك إضافة دالة رفض في database.js إذا لزم الأمر
        await bot.answerCallbackQuery(query.id, { 
          text: '❌ تم رفض طلب السحب', 
          show_alert: true 
        });
        
        bot.emit('callback_query', { ...query, data: 'admin_withdrawals' });
      }
      
      // البحث عن مستخدم
      else if (data === 'admin_search_user') {
        await bot.editMessageText(`
🔍 <b>البحث عن مستخدم</b>

أرسل معرف المستخدم (User ID) الذي تريد البحث عنه:

<i>مثال: 123456789</i>
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ إلغاء', callback_data: 'admin_back' }]
            ]
          }
        });
        
        // حفظ حالة البحث
        await db.updateUser(userId, { temp_withdrawal_address: 'admin_search_user' });
      }
      
      // حظر مستخدم
      else if (data.startsWith('ban_user_')) {
        const targetUserId = parseInt(data.replace('ban_user_', ''));
        const keyboard = [
          [
            { text: '🕐 1 ساعة', callback_data: `ban_duration_${targetUserId}_1` },
            { text: '📅 24 ساعة', callback_data: `ban_duration_${targetUserId}_24` }
          ],
          [
            { text: '🗓️ 7 أيام', callback_data: `ban_duration_${targetUserId}_168` },
            { text: '⛔ دائم', callback_data: `ban_duration_${targetUserId}_permanent` }
          ],
          [{ text: '🔙 رجوع', callback_data: 'admin_users' }]
        ];
        
        await bot.editMessageText(`
⛔ <b>حظر المستخدم</b>

اختر مدة الحظر للمستخدم ID: <code>${targetUserId}</code>
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
          await db.banUser(targetUserId, 'تم الحظر من لوحة الإدارة', userId, durationHours);
          
          const durationText = duration === 'permanent' ? 'بشكل دائم' : `لمدة ${duration} ساعة`;
          
          await bot.answerCallbackQuery(query.id, { 
            text: `✅ تم حظر المستخدم ${durationText}`, 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم المحظور
          try {
            await bot.sendMessage(targetUserId, `
⛔ <b>تم حظرك من استخدام البوت</b>

السبب: تم الحظر من لوحة الإدارة
المدة: ${durationText}
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('لم يتم إرسال إشعار الحظر للمستخدم');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error banning user:', error);
          await bot.answerCallbackQuery(query.id, { 
            text: '❌ حدث خطأ في حظر المستخدم', 
            show_alert: true 
          });
        }
      }
      
      // إلغاء حظر المستخدم
      else if (data.startsWith('unban_user_')) {
        const targetUserId = parseInt(data.replace('unban_user_', ''));
        
        try {
          await db.unbanUser(targetUserId);
          
          await bot.answerCallbackQuery(query.id, { 
            text: '✅ تم إلغاء حظر المستخدم', 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم
          try {
            await bot.sendMessage(targetUserId, `
✅ <b>تم إلغاء حظرك</b>

يمكنك الآن استخدام البوت بشكل طبيعي!
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('لم يتم إرسال إشعار إلغاء الحظر للمستخدم');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error unbanning user:', error);
          await bot.answerCallbackQuery(query.id, { 
            text: '❌ حدث خطأ في إلغاء الحظر', 
            show_alert: true 
          });
        }
      }
      
      // تقييد مستخدم
      else if (data.startsWith('restrict_user_')) {
        const targetUserId = parseInt(data.replace('restrict_user_', ''));
        const keyboard = [
          [
            { text: '🚫 منع التداول', callback_data: `restrict_action_${targetUserId}_no_trading` },
            { text: '🚫 منع الإيداع', callback_data: `restrict_action_${targetUserId}_no_deposit` }
          ],
          [
            { text: '🚫 منع السحب', callback_data: `restrict_action_${targetUserId}_no_withdraw` },
            { text: '🚫 منع الإحالة', callback_data: `restrict_action_${targetUserId}_no_referral` }
          ],
          [{ text: '🔙 رجوع', callback_data: 'admin_users' }]
        ];
        
        await bot.editMessageText(`
🚫 <b>تقييد المستخدم</b>

اختر نوع التقييد للمستخدم ID: <code>${targetUserId}</code>
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
          await db.restrictUser(targetUserId, restrictions, 168); // 7 أيام
          
          const restrictionNames = {
            'no_trading': 'منع التداول',
            'no_deposit': 'منع الإيداع',
            'no_withdraw': 'منع السحب',
            'no_referral': 'منع الإحالة'
          };
          
          await bot.answerCallbackQuery(query.id, { 
            text: `✅ تم تطبيق: ${restrictionNames[restrictionType]}`, 
            show_alert: true 
          });
          
          // إرسال إشعار للمستخدم
          try {
            await bot.sendMessage(targetUserId, `
⚠️ <b>تم تقييد حسابك</b>

التقييد: ${restrictionNames[restrictionType]}
المدة: 7 أيام
`, { parse_mode: 'HTML' });
          } catch (e) {
            console.log('لم يتم إرسال إشعار التقييد للمستخدم');
          }
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error restricting user:', error);
          await bot.answerCallbackQuery(query.id, { 
            text: '❌ حدث خطأ في تقييد المستخدم', 
            show_alert: true 
          });
        }
      }
      
      // حذف حساب المستخدم
      else if (data.startsWith('delete_user_confirm_')) {
        const targetUserId = parseInt(data.replace('delete_user_confirm_', ''));
        
        try {
          await db.deleteUserAccount(targetUserId);
          
          await bot.answerCallbackQuery(query.id, { 
            text: '✅ تم حذف حساب المستخدم نهائياً', 
            show_alert: true 
          });
          
          // العودة لقائمة المستخدمين
          bot.emit('callback_query', { ...query, data: 'admin_users' });
        } catch (error) {
          console.error('Error deleting user:', error);
          await bot.answerCallbackQuery(query.id, { 
            text: '❌ حدث خطأ في حذف المستخدم', 
            show_alert: true 
          });
        }
      }
      
      // تأكيد حذف المستخدم
      else if (data.startsWith('delete_user_')) {
        const targetUserId = parseInt(data.replace('delete_user_', ''));
        
        const keyboard = [
          [
            { text: '✅ نعم، احذف الحساب', callback_data: `delete_user_confirm_${targetUserId}` }
          ],
          [
            { text: '❌ إلغاء', callback_data: 'admin_users' }
          ]
        ];
        
        await bot.editMessageText(`
⚠️ <b>تحذير: حذف حساب مستخدم</b>

هل أنت متأكد من حذف حساب المستخدم ID: <code>${targetUserId}</code>؟

⚠️ <b>تحذير:</b> هذا الإجراء لا يمكن التراجع عنه!
سيتم حذف:
• بيانات المستخدم
• جميع المعاملات
• اشتراكات المحللين
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
      
      // الرجوع للقائمة الرئيسية
      else if (data === 'admin_back' || data === 'admin_refresh') {
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📊 الإحصائيات', callback_data: 'admin_stats' },
              { text: '👥 المستخدمين', callback_data: 'admin_users' }
            ],
            [
              { text: '💸 طلبات السحب', callback_data: 'admin_withdrawals' },
              { text: '💰 المعاملات', callback_data: 'admin_transactions' }
            ],
            [
              { text: '👨‍💼 المحللين', callback_data: 'admin_analysts' },
              { text: '🎁 الإحالات', callback_data: 'admin_referrals' }
            ],
            [
              { text: '📢 إرسال رسالة جماعية', callback_data: 'admin_broadcast' }
            ],
            [
              { text: '🔄 تحديث البيانات', callback_data: 'admin_refresh' }
            ]
          ]
        };
        
        await bot.editMessageText(`
🎛️ <b>لوحة تحكم المالك</b>

مرحباً ${query.from.first_name}!
اختر العملية المطلوبة:
`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
      
    } catch (error) {
      console.error('Admin callback error:', error);
      await bot.answerCallbackQuery(query.id, { 
        text: '❌ حدث خطأ!', 
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
        return bot.sendMessage(chatId, '❌ معرف المستخدم يجب أن يكون رقماً');
      }
      
      const targetUser = await db.getUser(searchUserId);
      
      if (!targetUser) {
        await db.updateUser(userId, { temp_withdrawal_address: null });
        return bot.sendMessage(chatId, '❌ لم يتم العثور على مستخدم بهذا المعرف');
      }
      
      const banStatus = await db.checkUserBanStatus(searchUserId);
      const subscriptionActive = await db.isSubscriptionActive(searchUserId);
      const referralStats = await db.getReferralStats(searchUserId);
      
      let statusEmoji = '✅';
      let statusText = 'نشط';
      
      if (banStatus.banned) {
        statusEmoji = '⛔';
        statusText = 'محظور';
        if (banStatus.expires) {
          statusText += ` حتى ${new Date(banStatus.expires).toLocaleString('ar')}`;
        } else {
          statusText += ' بشكل دائم';
        }
      }
      
      const message = `
👤 <b>معلومات المستخدم</b>

━━━━━━━━━━━━━━━━━━━━
📋 <b>البيانات الأساسية:</b>
• الاسم: ${targetUser.first_name} ${targetUser.last_name || ''}
• المعرف: @${targetUser.username || 'لا يوجد'}
• User ID: <code>${targetUser.user_id}</code>
• تاريخ التسجيل: ${new Date(targetUser.created_at).toLocaleDateString('ar')}

━━━━━━━━━━━━━━━━━━━━
💰 <b>المالية:</b>
• الرصيد: ${targetUser.balance || 0} USDT
• أرباح الإحالات: ${targetUser.referral_earnings || 0} USDT

━━━━━━━━━━━━━━━━━━━━
📊 <b>الحالة:</b>
• الحالة: ${statusEmoji} ${statusText}
• الاشتراك: ${subscriptionActive ? '✅ نشط' : '❌ منتهي'}
${banStatus.banned && banStatus.reason ? `• سبب الحظر: ${banStatus.reason}` : ''}

━━━━━━━━━━━━━━━━━━━━
🎁 <b>الإحالات:</b>
• عدد الإحالات: ${referralStats.total_referrals}
• إجمالي الأرباح: ${referralStats.total_earnings.toFixed(2)} USDT

━━━━━━━━━━━━━━━━━━━━
⚙️ <b>إعدادات:</b>
• اللغة: ${targetUser.language || 'ar'}
• الإشعارات: ${targetUser.notifications_enabled ? '✅ مفعلة' : '❌ معطلة'}
`;
      
      const keyboard = [];
      
      if (banStatus.banned) {
        keyboard.push([{ text: '✅ إلغاء الحظر', callback_data: `unban_user_${searchUserId}` }]);
      } else {
        keyboard.push([{ text: '⛔ حظر المستخدم', callback_data: `ban_user_${searchUserId}` }]);
      }
      
      keyboard.push([{ text: '🚫 تقييد المستخدم', callback_data: `restrict_user_${searchUserId}` }]);
      keyboard.push([{ text: '🗑️ حذف الحساب', callback_data: `delete_user_${searchUserId}` }]);
      keyboard.push([{ text: '🔙 رجوع', callback_data: 'admin_users' }]);
      
      await bot.sendMessage(chatId, message, {
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
      
      const statusMsg = await bot.sendMessage(chatId, '📤 جاري إرسال الرسالة...\n\n0/' + users.length);
      
      for (let i = 0; i < users.length; i++) {
        try {
          await bot.sendMessage(users[i].user_id, text, { parse_mode: 'HTML' });
          successCount++;
        } catch (error) {
          failCount++;
        }
        
        // تحديث كل 10 مستخدمين
        if ((i + 1) % 10 === 0 || i === users.length - 1) {
          await bot.editMessageText(
            `📤 جاري إرسال الرسالة...\n\n${i + 1}/${users.length}\n✅ نجح: ${successCount}\n❌ فشل: ${failCount}`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id
            }
          );
        }
      }
      
      await db.updateUser(userId, { temp_withdrawal_address: null });
      
      await bot.sendMessage(chatId, `
✅ <b>تم إرسال الرسالة الجماعية!</b>

📊 الإحصائيات:
• إجمالي المستخدمين: ${users.length}
• نجح: ${successCount}
• فشل: ${failCount}
`, { parse_mode: 'HTML' });
    }
  });
}

module.exports = { initAdminCommands };
