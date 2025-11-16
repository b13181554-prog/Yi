const cron = require('node-cron');
const db = require('./database');
const bot = require('./bot');

let botInstance = null;

async function checkAnalystActivity() {
  try {
    const { t } = require('./languages');
    
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
          const analystUser = await db.getUser(analyst.user_id);
          const lang = analystUser ? (analystUser.language || 'ar') : 'ar';
          
          await botInstance.sendMessage(analyst.user_id, `
🚨🚨🚨 <b>${t(lang, 'analyst_urgent_warning')}</b> 🚨🚨🚨

━━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>${t(lang, 'analyst_final_warning')}</b> ⚠️
━━━━━━━━━━━━━━━━━━━━━━

${t(lang, 'dear_analyst')}: <b>${analyst.name}</b>

🔴 <b>${t(lang, 'no_posts_2_days')}</b>

⏰ <b>${t(lang, 'you_have_24_hours')}</b>

❌ <b>${t(lang, 'what_will_happen')}:</b>
▪️ ${t(lang, 'account_suspended_auto')}
▪️ ${t(lang, 'all_subscriptions_cancelled')}
▪️ ${t(lang, 'refunds_to_subscribers')}
▪️ ${t(lang, 'loss_of_escrow')}

👥 <b>${t(lang, 'current_subscribers')}:</b> ${analyst.total_subscribers || 0}
💰 <b>${t(lang, 'earnings_at_risk')}:</b> ${analyst.escrow_balance || 0} USDT

✅ <b>${t(lang, 'solution')}:</b> ${t(lang, 'post_now_to_save_account')}

━━━━━━━━━━━━━━━━━━━━━━
`, { parse_mode: 'HTML' });
          
          console.log(`⚠️ تم إرسال تحذير اليوم الثاني للمحلل ${analyst.name}`);
        } catch (error) {
          console.error(`Error sending day 2 warning to analyst ${analyst.user_id}:`, error.message);
        }
      } else if (daysDiff >= 3) {
        if (analyst.suspension_processed) {
          console.log(`ℹ️ المحلل ${analyst.name} تم معالجة إيقافه مسبقاً - تخطي`);
          continue;
        }
        
        console.log(`🔄 بدء معالجة إيقاف المحلل ${analyst.name} (عدم النشر لـ ${daysDiff} أيام)...`);
        
        try {
          await db.suspendAnalyst(analyst._id, "عدم نشر صفقات لمدة 3 أيام");

        const subscriptions = await db.getUsersSubscribedToAnalyst(analyst._id);

        let totalRefunded = 0;
        let subscriberCount = 0;
        const refundAudit = {
          analyst_id: analyst._id,
          analyst_name: analyst.name,
          reason: 'Analyst suspended for inactivity',
          processed_at: new Date(),
          refunds: []
        };

        for (const subscription of subscriptions) {
          if (subscription.refund_processed) {
            console.log(`ℹ️ اشتراك ${subscription._id} تم معالجة إرجاع أمواله مسبقاً - تخطي`);
            continue;
          }
          
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
            
            refundAudit.refunds.push({
              subscription_id: subscription._id,
              user_id: subscription.user_id,
              amount: refundAmount,
              analyst_share: analystRefund,
              owner_share: ownerRefund,
              referral_share: referralRefund
            });
          }
          
          await db.getDB().collection('analyst_subscriptions').updateOne(
            { _id: subscription._id },
            { 
              $set: { 
                refund_processed: true,
                refund_amount: refundAmount,
                refunded_at: new Date()
              }
            }
          );
          
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
        
        refundAudit.total_refunded = totalRefunded;
        refundAudit.subscriber_count = subscriberCount;
        await db.getDB().collection('refund_audit').insertOne(refundAudit);

        await db.getDB().collection('analysts').updateOne(
          { _id: analyst._id },
          { 
            $set: { 
              suspension_processed: true,
              suspension_completed_at: new Date()
            }
          }
        );

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
        
        } catch (suspensionError) {
          console.error(`❌ خطأ في معالجة إيقاف المحلل ${analyst.name}:`, suspensionError.message);
          
          await db.getDB().collection('analysts').updateOne(
            { _id: analyst._id },
            { 
              $set: { 
                suspension_error: suspensionError.message,
                suspension_error_at: new Date()
              },
              $unset: { suspension_processed: "" }
            }
          );
        }
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
