const cron = require('node-cron');
const db = require('./database');
const config = require('./config');

let bot = null;

function initNotifications(botInstance) {
  bot = botInstance;
  
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily subscription check...');
    await checkExpiringSubscriptions();
  });
  
  cron.schedule('*/30 * * * *', async () => {
    console.log('Running trial expiry check...');
    await checkExpiringTrials();
  });
  
  console.log('✅ Notification system initialized');
}

async function checkExpiringSubscriptions() {
  try {
    const users = await db.getAllUsers();
    
    for (const user of users) {
      if (user.subscription_expires) {
        const expiryDate = new Date(user.subscription_expires);
        const now = new Date();
        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysLeft === 3) {
          await bot.sendMessage(user.user_id, `
⚠️ <b>تنبيه اشتراك</b>

اشتراكك سينتهي خلال 3 أيام!

📅 تاريخ الانتهاء: ${expiryDate.toLocaleDateString('ar')}

جدد اشتراكك الآن لتستمر في الحصول على التحليلات والتوصيات.
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 1) {
          await bot.sendMessage(user.user_id, `
⏰ <b>تذكير عاجل!</b>

اشتراكك سينتهي غداً!

📅 تاريخ الانتهاء: ${expiryDate.toLocaleDateString('ar')}

جدد الآن لعدم فقدان الوصول للخدمات.
💰 السعر: ${config.SUBSCRIPTION_PRICE} USDT
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 0) {
          await bot.sendMessage(user.user_id, `
❌ <b>انتهى الاشتراك</b>

انتهى اشتراكك اليوم.

للاستمرار في استخدام البوت، يرجى تجديد الاشتراك:
💰 السعر: ${config.SUBSCRIPTION_PRICE} USDT

اضغط على "💰 المحفظة" للتجديد
`, { parse_mode: 'HTML' });
        }
      }
    }
  } catch (error) {
    console.error('Error checking expiring subscriptions:', error);
  }
}

async function checkExpiringTrials() {
  try {
    const users = await db.getAllUsers();
    
    for (const user of users) {
      if (user.free_trial_used === false && user.free_trial_start) {
        const trialEnd = new Date(user.free_trial_start);
        trialEnd.setDate(trialEnd.getDate() + config.FREE_TRIAL_DAYS);
        
        const now = new Date();
        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        
        if (daysLeft === 2) {
          await bot.sendMessage(user.user_id, `
🎁 <b>تنبيه الفترة التجريبية</b>

فترتك التجريبية المجانية ستنتهي خلال يومين!

📅 تاريخ الانتهاء: ${trialEnd.toLocaleDateString('ar')}

للاستمرار في استخدام البوت بعد انتهاء الفترة التجريبية:
💰 اشترك مقابل ${config.SUBSCRIPTION_PRICE} USDT شهرياً

استمتع بآخر أيام التجربة! 🚀
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 0) {
          await bot.sendMessage(user.user_id, `
⏰ <b>آخر يوم في الفترة التجريبية!</b>

فترتك التجريبية المجانية تنتهي اليوم.

للاستمرار غداً، جدد اشتراكك الآن:
💰 السعر: ${config.SUBSCRIPTION_PRICE} USDT شهرياً

اضغط على "💰 المحفظة" للتجديد
`, { parse_mode: 'HTML' });
        }
      }
    }
  } catch (error) {
    console.error('Error checking expiring trials:', error);
  }
}

async function notifyDeposit(userId, amount, txId) {
  try {
    await bot.sendMessage(userId, `
✅ <b>تم الإيداع بنجاح!</b>

💵 المبلغ: ${amount} USDT
🔗 معرف المعاملة: <code>${txId}</code>

تم إضافة الرصيد إلى حسابك.
`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error notifying deposit:', error);
  }
}

async function notifyWithdrawal(userId, amount, address) {
  try {
    await bot.sendMessage(userId, `
✅ <b>تم السحب بنجاح!</b>

💸 المبلغ: ${amount} USDT
📍 العنوان: <code>${address}</code>

تم إرسال المبلغ إلى محفظتك.
`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error notifying withdrawal:', error);
  }
}

module.exports = {
  initNotifications,
  notifyDeposit,
  notifyWithdrawal
};
