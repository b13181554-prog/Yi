const cron = require('node-cron');
const db = require('./database');
const config = require('./config');
const blockchainPumpScanner = require('./blockchain-pump-scanner');
const { safeSendMessage } = require('./safe-message');

let bot = null;
const sentPumpAlerts = new Map();

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
  
  cron.schedule('0 */4 * * *', async () => {
    console.log('Running blockchain pump scan...');
    await scanAndNotifyPumpOpportunities();
  });
  
  // فحص دوري كل 15 دقيقة لفرص التداول القوية
  cron.schedule('*/15 * * * *', async () => {
    console.log('🔍 Running market opportunities scan...');
    await scanAndNotifyMarketOpportunities();
  });
  
  console.log('✅ Notification system initialized');
}

// فحص ومعالجة فرص التداول القوية في جميع الأسواق
async function scanAndNotifyMarketOpportunities() {
  try {
    const users = await db.getAllUsers();
    const TechnicalAnalysis = require('./analysis');
    const marketData = require('./market-data');
    const forexService = require('./forex-service');
    
    const notifiedUsers = new Map();
    
    for (const user of users) {
      try {
        const settings = await db.getNotificationSettings(user.user_id);
        
        if (!settings.enabled || !settings.markets || settings.markets.length === 0) {
          continue;
        }
        
        const opportunities = [];
        
        // فحص الأسواق حسب تفضيلات المستخدم
        for (const market of settings.markets) {
          let symbols = [];
          
          if (market === 'crypto') {
            symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT'];
          } else if (market === 'forex') {
            symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
          } else if (market === 'stocks') {
            symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
          } else if (market === 'commodities') {
            symbols = ['XAUUSD', 'XAGUSD', 'WTIUSD'];
          } else if (market === 'indices') {
            symbols = ['US30', 'SPX500', 'NAS100'];
          }
          
          for (const symbol of symbols) {
            try {
              let candles;
              
              if (market === 'forex') {
                candles = await forexService.getCandles(symbol, '1h', 100);
              } else {
                candles = await marketData.getCandles(symbol, '1h', 100, market);
              }
              
              if (!candles || candles.length < 50) continue;
              
              const analysis = new TechnicalAnalysis(candles);
              const recommendation = analysis.getTradeRecommendation();
              
              // فقط الفرص القوية (70%+)
              if (recommendation.confidence >= 70) {
                opportunities.push({
                  symbol,
                  market,
                  recommendation: recommendation.action,
                  confidence: recommendation.confidence,
                  price: candles[candles.length - 1].close,
                  stopLoss: recommendation.stopLoss,
                  takeProfit: recommendation.takeProfit
                });
              }
            } catch (error) {
              console.error(`Error analyzing ${symbol}:`, error.message);
            }
          }
        }
        
        // إرسال التنبيهات
        if (opportunities.length > 0) {
          let message = '🔔 <b>فرص تداول قوية جديدة!</b>\n\n';
          
          for (const opp of opportunities.slice(0, 5)) {
            const action = opp.recommendation === 'buy' ? '🟢 شراء' : opp.recommendation === 'sell' ? '🔴 بيع' : '⚪ محايد';
            message += `${action} <b>${opp.symbol}</b> (${opp.market})\n`;
            message += `💪 الثقة: ${opp.confidence}%\n`;
            message += `💵 السعر: ${opp.price}\n`;
            if (opp.stopLoss) message += `🛑 وقف الخسارة: ${opp.stopLoss}\n`;
            if (opp.takeProfit) message += `🎯 جني الأرباح: ${opp.takeProfit}\n`;
            message += '\n';
          }
          
          message += '💡 افتح البوت للمزيد من التفاصيل';
          
          await safeSendMessage(bot, user.user_id, message, { parse_mode: 'HTML' });
          notifiedUsers.set(user.user_id, opportunities.length);
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error notifying user ${user.user_id}:`, error.message);
      }
    }
    
    if (notifiedUsers.size > 0) {
      console.log(`✅ Notified ${notifiedUsers.size} users about market opportunities`);
    }
  } catch (error) {
    console.error('Error in scanAndNotifyMarketOpportunities:', error);
  }
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
          await safeSendMessage(bot, user.user_id, `
⚠️ <b>تنبيه اشتراك</b>

اشتراكك سينتهي خلال 3 أيام!

📅 تاريخ الانتهاء: ${expiryDate.toLocaleDateString('ar')}

جدد اشتراكك الآن لتستمر في الحصول على التحليلات والتوصيات.
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 1) {
          await safeSendMessage(bot, user.user_id, `
⏰ <b>تذكير عاجل!</b>

اشتراكك سينتهي غداً!

📅 تاريخ الانتهاء: ${expiryDate.toLocaleDateString('ar')}

جدد الآن لعدم فقدان الوصول للخدمات.
💰 السعر: ${config.SUBSCRIPTION_PRICE} USDT
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 0) {
          await safeSendMessage(bot, user.user_id, `
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
          await safeSendMessage(bot, user.user_id, `
🎁 <b>تنبيه الفترة التجريبية</b>

فترتك التجريبية المجانية ستنتهي خلال يومين!

📅 تاريخ الانتهاء: ${trialEnd.toLocaleDateString('ar')}

للاستمرار في استخدام البوت بعد انتهاء الفترة التجريبية:
💰 اشترك مقابل ${config.SUBSCRIPTION_PRICE} USDT شهرياً

استمتع بآخر أيام التجربة! 🚀
`, { parse_mode: 'HTML' });
        } else if (daysLeft === 0) {
          await safeSendMessage(bot, user.user_id, `
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
    await safeSendMessage(bot, userId, `
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
    await safeSendMessage(bot, userId, `
✅ <b>تم السحب بنجاح!</b>

💸 المبلغ: ${amount} USDT
📍 العنوان: <code>${address}</code>

تم إرسال المبلغ إلى محفظتك.
`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error notifying withdrawal:', error);
  }
}

async function scanAndNotifyPumpOpportunities() {
  try {
    const opportunities = await blockchainPumpScanner.getTopPumpOpportunities(5);
    
    if (opportunities.length === 0) {
      console.log('No pump opportunities found');
      return;
    }
    
    const newOpportunities = opportunities.filter(opp => {
      const key = `${opp.address}_${opp.symbol}`;
      const lastSent = sentPumpAlerts.get(key);
      
      if (!lastSent || Date.now() - lastSent > 24 * 60 * 60 * 1000) {
        return true;
      }
      return false;
    });
    
    if (newOpportunities.length === 0) {
      console.log('No new pump opportunities (all were sent recently)');
      return;
    }
    
    const users = await db.getAllUsers();
    const notifiedUsers = [];
    
    for (const user of users) {
      try {
        const settings = await db.getNotificationSettings(user.user_id);
        
        if (!settings.enabled) continue;
        if (!settings.markets || !settings.markets.includes('crypto')) continue;
        
        for (const opportunity of newOpportunities) {
          const message = blockchainPumpScanner.formatPumpAlert(opportunity);
          
          await safeSendMessage(bot, user.user_id, message, { parse_mode: 'HTML' });
          
          const key = `${opportunity.address}_${opportunity.symbol}`;
          sentPumpAlerts.set(key, Date.now());
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        notifiedUsers.push(user.user_id);
      } catch (error) {
        console.error(`Error notifying user ${user.user_id}:`, error.message);
      }
    }
    
    if (sentPumpAlerts.size > 1000) {
      const entries = Array.from(sentPumpAlerts.entries());
      entries.sort((a, b) => b[1] - a[1]);
      sentPumpAlerts.clear();
      entries.slice(0, 500).forEach(([key, time]) => sentPumpAlerts.set(key, time));
    }
    
    console.log(`✅ Notified ${notifiedUsers.length} users about ${newOpportunities.length} new pump opportunities`);
  } catch (error) {
    console.error('Error in scanAndNotifyPumpOpportunities:', error);
  }
}

module.exports = {
  initNotifications,
  notifyDeposit,
  notifyWithdrawal
};
