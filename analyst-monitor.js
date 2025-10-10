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

      if (daysDiff === 2) {
        try {
          await botInstance.sendMessage(analyst.user_id, `
🚨🚨🚨 <b>تحذير عاجل</b> 🚨🚨🚨

━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>إنذار نهائي للمحلل</b> ⚠️
━━━━━━━━━━━━━━━━━━━━━━

عزيزي المحلل: <b>${analyst.name}</b>

🔴 <b>لم تنشر أي صفقات منذ يومين!</b>

⏰ <b>لديك 24 ساعة فقط</b>

❌ <b>ما سيحدث إذا لم تنشر صفقة:</b>
▪️ إيقاف حسابك كمحلل تلقائياً
▪️ إلغاء جميع الاشتراكات
▪️ إرجاع المبالغ للمشتركين
▪️ فقدان جميع أرباحك المحجوزة

👥 <b>المشتركون الحاليون:</b> ${analyst.total_subscribers || 0}
💰 <b>الأرباح المعرضة للخطر:</b> ${analyst.escrow_balance || 0} USDT

✅ <b>الحل:</b> انشر صفقة الآن للحفاظ على حسابك!

━━━━━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });
          
          console.log(`⚠️ تم إرسال تحذير اليوم الثاني للمحلل ${analyst.name}`);
        } catch (error) {
          console.error(`Error sending day 2 warning to analyst ${analyst.user_id}:`, error.message);
        }
      } else if (daysDiff >= 3) {
        await db.suspendAnalyst(analyst._id, "عدم نشر صفقات لمدة 3 أيام");

        const subscriptions = await db.getUsersSubscribedToAnalyst(analyst._id);

        let totalRefunded = 0;
        let subscriberCount = 0;

        for (const subscription of subscriptions) {
          const now = new Date();
          const startDate = new Date(subscription.start_date);
          const endDate = new Date(subscription.end_date);
          
          const totalDuration = endDate - startDate;
          const remainingDuration = Math.max(0, endDate - now);
          
          let refundAmount = subscription.amount;
          if (totalDuration > 0 && remainingDuration > 0) {
            const clampedRemainingDuration = Math.min(totalDuration, remainingDuration);
            refundAmount = (clampedRemainingDuration / totalDuration) * subscription.amount;
          } else if (remainingDuration <= 0) {
            refundAmount = 0;
          }
          
          refundAmount = Math.min(subscription.amount, Math.max(0, Math.round(refundAmount * 100) / 100));
          
          if (refundAmount > 0) {
            await db.updateUserBalance(subscription.user_id, refundAmount);
            
            const refundPercentage = refundAmount / subscription.amount;
            const distribution = subscription.payment_distribution || {};
            
            const analystRefund = parseFloat((distribution.analyst_share * refundPercentage).toFixed(2));
            const ownerRefund = parseFloat((distribution.owner_share * refundPercentage).toFixed(2));
            const referralRefund = parseFloat((distribution.referral_commission * refundPercentage).toFixed(2));
            
            if (analystRefund > 0) {
              await db.deductFromAnalystEscrow(analyst._id, analystRefund);
            }
            
            const config = require('./config');
            if (ownerRefund > 0) {
              await db.updateUserBalance(config.OWNER_ID, -ownerRefund);
            }
            
            if (referralRefund > 0 && distribution.referrer_id) {
              await db.updateUserBalance(distribution.referrer_id, -referralRefund);
            }
          }
          
          await db.cancelSubscription(subscription._id);

          totalRefunded += refundAmount;
          subscriberCount++;

          try {
            await botInstance.sendMessage(subscription.user_id, `
⚠️ <b>إشعار إلغاء اشتراك</b>

تم إلغاء اشتراكك في المحلل: <b>${analyst.name}</b>

السبب: المحلل لم ينشر صفقات لمدة 3 أيام

💰 تم إرجاع المبلغ: ${refundAmount.toFixed(2)} USDT
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

async function processDailyEscrowRelease() {
  try {
    const results = await db.processDailyEscrowRelease();

    if (results && results.length > 0) {
      const analystAmounts = {};
      
      for (const result of results) {
        const analystIdStr = result.analyst_id.toString();
        if (!analystAmounts[analystIdStr]) {
          analystAmounts[analystIdStr] = 0;
        }
        analystAmounts[analystIdStr] += result.amount;
      }

      for (const [analystIdStr, totalAmount] of Object.entries(analystAmounts)) {
        const { ObjectId } = require('mongodb');
        const analyst = await db.getDB().collection('analysts').findOne({ _id: new ObjectId(analystIdStr) });
        
        if (analyst && totalAmount > 0.01) {
          console.log(`✅ تم تحرير رصيد يومي للمحلل ${analyst.name}: ${totalAmount.toFixed(2)} USDT`);

          try {
            await botInstance.sendMessage(analyst.user_id, `
💰 <b>تحرير رصيد يومي</b>

تم تحرير جزء من رصيد الضمان اليومي وإضافته لرصيدك المتاح!

💵 المبلغ المُحرر اليوم: ${totalAmount.toFixed(2)} USDT
💰 الرصيد المتاح: ${analyst.available_balance.toFixed(2)} USDT

✅ يمكنك سحب رصيدك المتاح في أي وقت
`, { parse_mode: 'HTML' });
          } catch (error) {
            console.error(`Error sending daily escrow release notification to analyst ${analyst.user_id}:`, error.message);
          }
        }
      }
      
      console.log(`✅ تم معالجة ${results.length} إطلاق يومي للأموال`);
    }
  } catch (error) {
    console.error('❌ خطأ في processDailyEscrowRelease:', error);
  }
}

function initAnalystMonitor(botRef) {
  botInstance = botRef;

  cron.schedule('0 0 * * *', async () => {
    console.log('🔍 Running daily analyst monitoring...');
    await checkAnalystActivity();
    await processDailyEscrowRelease();
  });

  console.log('✅ Analyst monitoring system initialized');
}

module.exports = { initAnalystMonitor };
