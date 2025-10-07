const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const db = require('./database');

const bot = new TelegramBot(config.BOT_TOKEN, { 
  polling: {
    interval: 1000,
    autoStart: false,
    params: {
      timeout: 10
    }
  }
});

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

const membershipCache = new Map();
const CACHE_DURATION = 1 * 1000;

async function checkChannelMembership(userId) {
  try {
    const cached = membershipCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.isMember;
    }
    
    const member = await bot.getChatMember(config.CHANNEL_ID, userId);
    const isMember = ['member', 'administrator', 'creator'].includes(member.status);
    
    membershipCache.set(userId, {
      isMember,
      timestamp: Date.now()
    });
    
    return isMember;
  } catch (error) {
    console.error('Error checking channel membership:', error.message);
    return false;
  }
}

async function requireChannelMembership(userId, chatId) {
  const isMember = await checkChannelMembership(userId);
  if (!isMember) {
    await bot.sendMessage(chatId, `
❌ <b>يجب الاشتراك في القناة أولاً!</b>

للاستمرار في استخدام البوت، اشترك في قناتنا:
👉 ${config.CHANNEL_USERNAME}

بعد الاشتراك، اضغط /start للبدء
`, {
      parse_mode: 'HTML'
    });
    return false;
  }
  return true;
}

async function checkSubscription(userId) {
  const user = await db.getUser(userId);
  
  if (!user) return { active: false, reason: 'not_registered' };
  
  if (user.free_trial_used === false) {
    const trialEnd = new Date(user.free_trial_start);
    trialEnd.setDate(trialEnd.getDate() + config.FREE_TRIAL_DAYS);
    
    if (new Date() <= trialEnd) {
      return { active: true, type: 'trial', daysLeft: Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24)) };
    } else {
      await db.updateUser(userId, { free_trial_used: true });
      return { active: false, reason: 'trial_expired' };
    }
  }
  
  if (user.subscription_expires && new Date(user.subscription_expires) > new Date()) {
    return { active: true, type: 'paid', expiresAt: user.subscription_expires };
  }
  
  return { active: false, reason: 'no_subscription' };
}

bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name;
  const lastName = msg.from.last_name;
  const params = match[1].trim();
  
  try {
    if (!(await requireChannelMembership(userId, chatId))) return;
    
    let user = await db.getUser(userId);
    let referrerId = null;
    
    if (params && params.startsWith('ref_')) {
      referrerId = parseInt(params.replace('ref_', ''));
      if (referrerId === userId) {
        referrerId = null;
      }
    }
    
    if (!user) {
      await db.createUser(userId, username, firstName, lastName, referrerId);
      
      if (referrerId) {
        await bot.sendMessage(referrerId, `
🎉 <b>إحالة جديدة!</b>

أحد أصدقائك انضم عبر رابط الإحالة الخاص بك!
ستحصل على 10% من جميع مدفوعاته 💰
        `, { parse_mode: 'HTML' });
      }
      
      const welcomeMessage = `
🎉 <b>مرحباً بك في OBENTCHI 🚀</b>

أهلاً ${firstName}! تم إنشاء حسابك بنجاح.

🎁 <b>هدية الانضمام:</b>
لقد حصلت على <b>${config.FREE_TRIAL_DAYS} أيام تجريبية مجانية</b>!

<b>✨ ما يمكنك فعله:</b>
📊 تحليل فني شامل للعملات الرقمية والفوركس
🎯 توصيات دقيقة مع نقاط الدخول والخروج
🔥 متابعة أكثر العملات حركة
💰 محفظة داخلية لإدارة رصيدك
👨‍💼 الاشتراك مع محللين محترفين
🎁 نظام إحالات بعمولة 10%

<b>📱 افتح التطبيق الآن:</b>
اضغط على الزر أدناه للوصول إلى جميع الميزات 👇
`;
      
      await bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '🚀 فتح التطبيق', web_app: { url: config.WEBAPP_URL } }]
          ],
          resize_keyboard: true
        }
      });
    } else {
      const subscription = await checkSubscription(userId);
      let statusMessage = '';
      
      if (subscription.active) {
        if (subscription.type === 'trial') {
          statusMessage = `🎁 الفترة التجريبية: ${subscription.daysLeft} يوم متبقي`;
        } else {
          statusMessage = `✅ الاشتراك نشط حتى: ${new Date(subscription.expiresAt).toLocaleDateString('ar')}`;
        }
      } else {
        statusMessage = `❌ لا يوجد اشتراك نشط`;
      }
      
      await bot.sendMessage(chatId, `
👋 <b>مرحباً بعودتك ${firstName}!</b>

${statusMessage}
💰 <b>رصيدك:</b> ${user.balance} USDT

اضغط على الزر لفتح التطبيق 👇
`, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '🚀 فتح التطبيق', web_app: { url: config.WEBAPP_URL } }]
          ],
          resize_keyboard: true
        }
      });
    }
  } catch (error) {
    console.error('Error in /start:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى.');
  }
});

bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const data = JSON.parse(msg.web_app_data.data);
  
  try {
    const user = await db.getUser(userId);
    if (!user) {
      return bot.sendMessage(chatId, 'يرجى البدء بالضغط على /start');
    }

    if (data.action === 'deposit') {
      await db.updateUser(userId, { temp_withdrawal_address: 'deposit_pending' });
      await bot.sendMessage(chatId, `
📥 <b>طلب إيداع</b>

تم استلام طلبك لتأكيد الإيداع.
معرف المعاملة: <code>${data.tx_id}</code>

⏳ جاري التحقق من المعاملة...
سيتم إضافة الرصيد تلقائياً عند تأكيد المعاملة.
`, { parse_mode: 'HTML' });
      
      const tron = require('./tron');
      const result = await tron.verifyUSDTTransaction(data.tx_id, config.BOT_WALLET_ADDRESS);
      
      if (result.success) {
        const existingTx = await db.getTransactionByTxId(data.tx_id);
        
        if (!existingTx) {
          await db.createTransaction({
            user_id: userId,
            type: 'deposit',
            amount: result.data.amount,
            status: 'completed',
            tx_id: data.tx_id,
            address: result.data.from
          });
          
          await db.updateUserBalance(userId, result.data.amount);
          
          await bot.sendMessage(chatId, `
✅ <b>تم تأكيد الإيداع!</b>

المبلغ: ${result.data.amount} USDT
تم إضافته لرصيدك بنجاح 🎉
`, { parse_mode: 'HTML' });
          
          await bot.sendMessage(config.OWNER_ID, `
💵 <b>إيداع جديد</b>

المستخدم: ${user.first_name} (@${user.username})
ID: ${userId}
المبلغ: ${result.data.amount} USDT
TxID: <code>${data.tx_id}</code>
`, { parse_mode: 'HTML' });
        } else {
          await bot.sendMessage(chatId, '⚠️ هذه المعاملة مسجلة مسبقاً!');
        }
      } else {
        await bot.sendMessage(chatId, `❌ فشل التحقق: ${result.error}`);
      }
      
      await db.updateUser(userId, { temp_withdrawal_address: null });
    }
    
    else if (data.action === 'withdraw') {
      const amount = parseFloat(data.amount);
      const address = data.address;
      const totalWithFee = amount + config.WITHDRAWAL_FEE;
      
      if (user.balance < totalWithFee) {
        return bot.sendMessage(chatId, '❌ رصيدك غير كافٍ!');
      }
      
      await db.createWithdrawalRequest({
        user_id: userId,
        amount: amount,
        address: address,
        status: 'pending'
      });
      
      await db.updateUserBalance(userId, -totalWithFee);
      
      await bot.sendMessage(chatId, `
📤 <b>طلب سحب</b>

تم استلام طلبك للسحب.
المبلغ: ${amount} USDT
الرسوم: ${config.WITHDRAWAL_FEE} USDT
الإجمالي: ${totalWithFee} USDT

⏳ سيتم معالجة الطلب خلال 24 ساعة
`, { parse_mode: 'HTML' });
      
      await bot.sendMessage(config.OWNER_ID, `
💸 <b>طلب سحب جديد</b>

المستخدم: ${user.first_name} (@${user.username})
ID: ${userId}
المبلغ: ${amount} USDT
العنوان: <code>${address}</code>

/approve_withdrawal أو /reject_withdrawal
`, { parse_mode: 'HTML' });
    }
    
    else if (data.action === 'subscribe') {
      if (user.balance < config.SUBSCRIPTION_PRICE) {
        return bot.sendMessage(chatId, '❌ رصيدك غير كافٍ للاشتراك!');
      }
      
      await db.updateUserBalance(userId, -config.SUBSCRIPTION_PRICE);
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      await db.updateUser(userId, { 
        subscription_expires: expiryDate,
        free_trial_used: true 
      });
      
      await db.createTransaction({
        user_id: userId,
        type: 'subscription',
        amount: config.SUBSCRIPTION_PRICE,
        status: 'completed'
      });
      
      if (user.referred_by) {
        const commission = config.SUBSCRIPTION_PRICE * 0.1;
        await db.updateUserBalance(user.referred_by, commission);
        await db.createReferralEarning({
          referrer_id: user.referred_by,
          referred_user_id: userId,
          amount: commission,
          type: 'subscription'
        });
      }
      
      await bot.sendMessage(chatId, `
✅ <b>تم تفعيل الاشتراك!</b>

صالح حتى: ${expiryDate.toLocaleDateString('ar')}
استمتع بجميع الميزات! 🎉
`, { parse_mode: 'HTML' });
    }
    
    else if (data.action === 'subscribe_analyst') {
      const analystId = data.analyst_id;
      const analyst = await db.getAnalystById(analystId);
      
      if (!analyst) {
        return bot.sendMessage(chatId, '❌ المحلل غير موجود!');
      }
      
      if (user.balance < analyst.monthly_price) {
        return bot.sendMessage(chatId, '❌ رصيدك غير كافٍ!');
      }
      
      await db.updateUserBalance(userId, -analyst.monthly_price);
      
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      await db.subscribeToAnalyst(userId, analystId, expiryDate);
      
      await bot.sendMessage(chatId, `
✅ <b>تم الاشتراك بنجاح!</b>

المحلل: ${analyst.name}
صالح حتى: ${expiryDate.toLocaleDateString('ar')}
`, { parse_mode: 'HTML' });
    }
    
    else if (data.action === 'register_analyst') {
      await db.updateUser(userId, { temp_withdrawal_address: 'analyst_registration' });
      await bot.sendMessage(chatId, `
📝 <b>التسجيل كمحلل</b>

أرسل البيانات التالية (كل في سطر منفصل):

1️⃣ الاسم
2️⃣ الوصف
3️⃣ السعر الشهري (USDT)

مثال:
أحمد المحلل
خبرة 5 سنوات في التحليل الفني
20
`, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Error handling web_app_data:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ في معالجة الطلب');
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
      const lines = text.trim().split('\n').filter(line => line.trim());
      
      if (lines.length !== 3) {
        return bot.sendMessage(chatId, `
❌ <b>بيانات غير صحيحة!</b>

يجب إرسال 3 أسطر فقط:
1️⃣ الاسم
2️⃣ الوصف
3️⃣ السعر الشهري (USDT)
`, { parse_mode: 'HTML' });
      }
      
      const [name, description, priceStr] = lines;
      const price = parseFloat(priceStr);
      
      if (isNaN(price) || price < 1) {
        return bot.sendMessage(chatId, '❌ السعر يجب أن يكون رقم صحيح (1 USDT على الأقل)');
      }
      
      await db.createAnalyst({
        user_id: userId,
        name: name,
        description: description,
        monthly_price: price
      });
      
      await db.updateUser(userId, { temp_withdrawal_address: null });
      
      await bot.sendMessage(chatId, `
✅ <b>تم التسجيل كمحلل بنجاح!</b>

الاسم: ${name}
السعر: ${price} USDT/شهر

يمكن للمستخدمين الآن الاشتراك في خدماتك!
`, { parse_mode: 'HTML' });
      
      await bot.sendMessage(config.OWNER_ID, `
📝 <b>محلل جديد</b>

الاسم: ${name}
المستخدم: @${user.username}
ID: ${userId}
السعر: ${price} USDT/شهر
الوصف: ${description}
`, { parse_mode: 'HTML' });
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
