const cron = require('node-cron');
const db = require('./database');
const bot = require('./bot');

let botInstance = null;

async function checkAnalystActivity() {
  try {
    const analysts = await db.getDB().collection('analysts').find({
      is_active: true,
      is_suspended: false
    }).toArray();

    for (const analyst of analysts) {
      const lastPostDate = analyst.last_post_date ? new Date(analyst.last_post_date) : new Date(analyst.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now - lastPostDate) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 3) {
        await db.suspendAnalyst(analyst._id, "عدم نشر صفقات لمدة 3 أيام");

        const subscriptions = await db.getUsersSubscribedToAnalyst(analyst._id);

        let totalRefunded = 0;
        let subscriberCount = 0;

        for (const subscription of subscriptions) {
          await db.updateUserBalance(subscription.user_id, subscription.amount);
          await db.cancelSubscription(subscription._id);

          totalRefunded += subscription.amount;
          subscriberCount++;

          try {
            await botInstance.sendMessage(subscription.user_id, `
⚠️ <b>إشعار إلغاء اشتراك</b>

تم إلغاء اشتراكك في المحلل: <b>${analyst.name}</b>

السبب: المحلل لم ينشر صفقات لمدة 3 أيام

💰 تم إرجاع المبلغ: ${subscription.amount} USDT
✅ الرصيد المُرجع متاح في محفظتك

نأسف للإزعاج ونتمنى أن تجد محلل آخر مناسب 🙏
`, { parse_mode: 'HTML' });
          } catch (error) {
            console.error(`Error sending refund notification to user ${subscription.user_id}:`, error.message);
          }
        }

        try {
          await botInstance.sendMessage(analyst.user_id, `
🚫 <b>تم إيقاف حسابك كمحلل</b>

السبب: عدم نشر صفقات لمدة 3 أيام

تم إلغاء جميع الاشتراكات وإرجاع المبالغ للمشتركين.

📊 عدد المشتركين المتأثرين: ${subscriberCount}
💰 إجمالي المبالغ المُرجعة: ${totalRefunded.toFixed(2)} USDT

للعودة كمحلل، يرجى التواصل مع الإدارة.
`, { parse_mode: 'HTML' });
        } catch (error) {
          console.error(`Error sending suspension notification to analyst ${analyst.user_id}:`, error.message);
        }

        console.log(`✅ تم إيقاف المحلل ${analyst.name} وإرجاع ${totalRefunded.toFixed(2)} USDT لـ ${subscriberCount} مشتركين`);
      }
    }
  } catch (error) {
    console.error('❌ خطأ في checkAnalystActivity:', error);
  }
}

async function processMonthlyEscrow() {
  try {
    const analysts = await db.getDB().collection('analysts').find({}).toArray();

    for (const analyst of analysts) {
      const monthStart = analyst.current_month_start ? new Date(analyst.current_month_start) : new Date(analyst.created_at);
      const now = new Date();
      const nextMonthStart = new Date(monthStart);
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

      if (now >= nextMonthStart) {
        const result = await db.moveEscrowToAvailable(analyst._id);

        if (result && result.moved_amount > 0) {
          console.log(`✅ تم تحرير رصيد الضمان للمحلل ${analyst.name}: ${result.moved_amount.toFixed(2)} USDT`);

          try {
            await botInstance.sendMessage(analyst.user_id, `
💰 <b>تحرير رصيد الضمان</b>

تم تحرير رصيد الضمان الشهري وإضافته لرصيدك المتاح!

💵 المبلغ المُحرر: ${result.moved_amount.toFixed(2)} USDT
💰 الرصيد المتاح الجديد: ${result.new_available_balance.toFixed(2)} USDT

يمكنك الآن سحب هذا المبلغ 🎉
`, { parse_mode: 'HTML' });
          } catch (error) {
            console.error(`Error sending escrow release notification to analyst ${analyst.user_id}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ خطأ في processMonthlyEscrow:', error);
  }
}

function initAnalystMonitor(botRef) {
  botInstance = botRef;

  cron.schedule('0 0 * * *', async () => {
    console.log('🔍 Running daily analyst monitoring...');
    await checkAnalystActivity();
    await processMonthlyEscrow();
  });

  console.log('✅ Analyst monitoring system initialized');
}

module.exports = { initAnalystMonitor };
