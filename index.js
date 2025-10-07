
const express = require('express');
const db = require('./database');
const bot = require('./bot');
const notifications = require('./notifications');
const tron = require('./tron');
const config = require('./config');
const admin = require('./admin');
const rateLimiter = require('./rate-limiter');
const marketData = require('./market-data');
const forexService = require('./forex-service');
const TechnicalAnalysis = require('./analysis');
const rankingScheduler = require('./ranking-scheduler');
const { authenticateAPI, apiRateLimit, validateRequestSize } = require('./api-security');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline';");
  next();
});

// الحد الأقصى لحجم الطلب
app.use(express.json({ limit: '10mb' }));
app.use(validateRequestSize);

// تطبيق Rate Limiting على جميع API endpoints
app.use('/api', apiRateLimit);

// معالج الملفات الثابتة
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

async function main() {
  try {
    console.log('🚀 Starting OBENTCHI Bot...');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 HTTP Server is running on port ${PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${PORT}/`);
      console.log(`🔗 Public URL will be available at your Replit domain`);
    });
    
    await db.initDatabase();
    
    notifications.initNotifications(bot);
    admin.initAdminCommands(bot);
    rankingScheduler.start();
    
    bot.startBot();
    
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      
      // تجاهل المالك من Rate Limiting
      if (userId !== config.OWNER_ID) {
        const limitCheck = rateLimiter.checkLimit(userId);
        if (!limitCheck.allowed) {
          return bot.sendMessage(chatId, limitCheck.message);
        }
      }
      
      // السماح بأوامر الإدارة (مثل /admin) للمرور
      if (!text || (text.startsWith('/') && text !== '/admin') || text.startsWith('📊') || text.startsWith('⏰') || 
          text.startsWith('📈') || text.startsWith('💹') || text.startsWith('🎯') || 
          text.startsWith('🔥') || text.startsWith('💰') || text.startsWith('📜') || 
          text.startsWith('👤') || text.startsWith('🔄') || text.startsWith('👥') || text.startsWith('🎁')) {
        return;
      }
      
      const user = await db.getUser(userId);
      if (!user) return;
      
      if (user.temp_withdrawal_address === 'analyst_registration') {
        const lines = text.trim().split('\n').filter(line => line.trim());
        
        if (lines.length !== 3) {
          return bot.sendMessage(chatId, `
❌ <b>خطأ في البيانات!</b>

يرجى إرسال البيانات بالترتيب الصحيح:
1️⃣ الاسم
2️⃣ الوصف
3️⃣ السعر الشهري

<b>مثال:</b>
أحمد المحلل
محلل فني بخبرة 5 سنوات
20
`, { parse_mode: 'HTML' });
        }
        
        const name = lines[0].trim();
        const description = lines[1].trim();
        const price = parseFloat(lines[2].trim());
        
        if (!name || !description || isNaN(price) || price < 1) {
          return bot.sendMessage(chatId, `
❌ <b>بيانات غير صحيحة!</b>

تأكد من:
• الاسم غير فارغ
• الوصف غير فارغ
• السعر رقم صحيح (أكثر من 1 USDT)
`, { parse_mode: 'HTML' });
        }
        
        await db.createAnalyst(userId, name, description, price);
        await db.updateUser(userId, { temp_withdrawal_address: null });
        
        await bot.sendMessage(chatId, `
✅ <b>تم تسجيلك كمحلل بنجاح!</b>

📝 الاسم: ${name}
💰 السعر: ${price} USDT/شهر

<b>ملاحظات مهمة:</b>
• ستحصل على 50% من كل اشتراك
• 50% للمالك
• إذا كان المشترك مُحالاً، 10% عمولة للمُحيل

يمكن للمستخدمين الآن الاشتراك في خدماتك! 🎉
`, { parse_mode: 'HTML' });
        
        await bot.sendMessage(config.OWNER_ID, `
📢 <b>محلل جديد!</b>

👤 ${user.first_name} (${userId})
📝 ${name}
💰 ${price} USDT/شهر

${description}
`, { parse_mode: 'HTML' });
        
        return;
      }
      
      if (text.match(/^T[A-Za-z1-9]{33}$/)) {
        await bot.sendMessage(chatId, `
💸 <b>لإجراء عمليات السحب</b>

يرجى استخدام تطبيق الويب:
1. اضغط على زر "🚀 فتح التطبيق"
2. اختر "💰 المحفظة"
3. اختر "📤 سحب"
4. أدخل عنوان المحفظة والمبلغ

📝 ملاحظة: جميع عمليات السحب تتم عبر تطبيق الويب لضمان الأمان
`, { parse_mode: 'HTML' });
        return;
      }
      
      if (!isNaN(text) && parseFloat(text) > 0) {
        await bot.sendMessage(chatId, `
⏳ <b>لإجراء المعاملات المالية</b>

يرجى استخدام تطبيق الويب:
1. اضغط على زر "🚀 فتح التطبيق"
2. اختر "💰 المحفظة"
3. اختر "📥 إيداع" أو "📤 سحب"

📝 ملاحظة: جميع المعاملات المالية تتم عبر تطبيق الويب لضمان الأمان
`, { parse_mode: 'HTML' });
        return;
      }
      
      if (text.length === 64 && /^[a-fA-F0-9]{64}$/.test(text)) {
        const txId = text;
        
        // التحقق من عدم استخدام المعاملة سابقاً
        const existingTx = await db.getTransactionByTxId(txId);
        if (existingTx) {
          return bot.sendMessage(chatId, `
❌ <b>معاملة مكررة!</b>

هذه المعاملة تم استخدامها من قبل.
معرف المعاملة: <code>${txId}</code>

⚠️ كل معاملة يمكن استخدامها مرة واحدة فقط.
`, { parse_mode: 'HTML' });
        }
        
        const waitMsg = await bot.sendMessage(chatId, '⏳ جاري التحقق من المعاملة على شبكة TRON...');
        
        try {
          // التحقق من المعاملة على البلوكشين
          const verification = await tron.verifyUSDTTransaction(txId, config.BOT_WALLET_ADDRESS, null);
          
          if (!verification.success) {
            await bot.deleteMessage(chatId, waitMsg.message_id);
            return bot.sendMessage(chatId, `
❌ <b>فشل التحقق من المعاملة</b>

السبب: ${verification.error}

تأكد من:
• استخدام شبكة TRC20
• إرسال USDT إلى العنوان الصحيح
• اكتمال المعاملة على البلوكشين

معرف المعاملة: <code>${txId}</code>
`, { parse_mode: 'HTML' });
          }
          
          const amount = verification.data.amount;
          const fromAddress = verification.data.from;
          
          // التحقق من الحد الأدنى للإيداع
          if (amount < config.MIN_DEPOSIT_AMOUNT) {
            await bot.deleteMessage(chatId, waitMsg.message_id);
            return bot.sendMessage(chatId, `
❌ <b>المبلغ أقل من الحد الأدنى!</b>

الحد الأدنى للإيداع: ${config.MIN_DEPOSIT_AMOUNT} USDT
المبلغ المرسل: ${amount} USDT

يرجى إرسال ${config.MIN_DEPOSIT_AMOUNT} USDT على الأقل.
`, { parse_mode: 'HTML' });
          }
          
          // حساب الرصيد الجديد
          const oldBalance = parseFloat(user.balance);
          const newBalance = oldBalance + amount;
          
          // تحديث الرصيد في قاعدة البيانات
          await db.updateUser(userId, { balance: newBalance });
          
          // إنشاء سجل المعاملة
          await db.createTransaction(userId, 'deposit', amount, txId, fromAddress, 'completed');
          
          await bot.deleteMessage(chatId, waitMsg.message_id);
          
          // إرسال إشعار للمستخدم
          await notifications.notifyDeposit(userId, amount, txId);
          
          // إرسال إشعار للمالك
          await bot.sendMessage(config.OWNER_ID, `
💰 <b>إيداع جديد!</b>

👤 المستخدم: ${user.first_name} (${userId})
💵 المبلغ: ${amount} USDT
🔗 TxID: <code>${txId}</code>
📍 من: <code>${fromAddress}</code>

💰 الرصيد: ${oldBalance} → ${newBalance.toFixed(2)} USDT
`, { parse_mode: 'HTML' });
          
          // إرسال رسالة تأكيد للمستخدم
          await bot.sendMessage(chatId, `
✅ <b>تم الإيداع بنجاح!</b>

💵 المبلغ المضاف: ${amount} USDT
💰 الرصيد السابق: ${oldBalance.toFixed(2)} USDT
💰 الرصيد الجديد: ${newBalance.toFixed(2)} USDT

🔗 معرف المعاملة: <code>${txId}</code>
📍 من العنوان: <code>${fromAddress}</code>
⏰ الوقت: ${new Date().toLocaleString('ar')}

يمكنك الآن استخدام رصيدك للاشتراك أو طلب التوصيات! 🎉
`, { parse_mode: 'HTML' });
          
        } catch (error) {
          await bot.deleteMessage(chatId, waitMsg.message_id);
          console.error('خطأ في معالجة الإيداع:', error);
          await bot.sendMessage(chatId, `
❌ <b>حدث خطأ في معالجة الإيداع</b>

الخطأ: ${error.message}

يرجى المحاولة مرة أخرى أو التواصل مع الدعم.
معرف المعاملة: <code>${txId}</code>
`, { parse_mode: 'HTML' });
        }
        
        return;
      }
    });
    
    console.log('✅ OBENTCHI Bot is now running!');
    console.log('📊 Bot ready to analyze crypto markets');
    
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

function verifyTelegramWebAppData(initData) {
  try {
    if (!initData) return false;
    
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;
    
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const crypto = require('crypto');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Telegram verification error:', error);
    return false;
  }
}

app.post('/api/user', authenticateAPI, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.json({ success: false, error: 'معرف المستخدم مطلوب' });
    }
    
    let user = await db.getUser(user_id);
    if (!user) {
      user = { balance: 0, subscription_end: null };
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/price', async (req, res) => {
  try {
    const { symbol, market_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    let price;
    if (market_type === 'forex') {
      price = await forexService.getCurrentPrice(symbol);
    } else {
      price = await marketData.getCurrentPrice(symbol);
    }
    
    res.json({ success: true, price });
  } catch (error) {
    console.error('Price API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, indicators, market_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const candles = market_type === 'forex' 
      ? await forexService.getCandles(symbol, timeframe, 100)
      : await marketData.getCandles(symbol, timeframe, 100, market_type);
    
    const analysis = new TechnicalAnalysis(candles);
    const recommendation = analysis.getTradeRecommendation();
    
    const result = {
      recommendation: recommendation.action,
      confidence: recommendation.confidence,
      indicators: {}
    };
    
    if (indicators.includes('RSI')) {
      result.indicators.RSI = recommendation.indicators.RSI;
    }
    if (indicators.includes('MACD')) {
      result.indicators.MACD = recommendation.indicators.MACD;
    }
    
    res.json({ success: true, analysis: result });
  } catch (error) {
    console.error('Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const transactions = await db.getUserTransactions(user_id);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Transactions API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/subscription', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    let subscription = { active: false };
    
    if (user.free_trial_used === false) {
      const trialEnd = new Date(user.free_trial_start);
      trialEnd.setDate(trialEnd.getDate() + config.FREE_TRIAL_DAYS);
      
      if (new Date() <= trialEnd) {
        subscription = {
          active: true,
          type: 'trial',
          daysLeft: Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))
        };
      }
    }
    
    if (!subscription.active && user.subscription_end && new Date(user.subscription_end) > new Date()) {
      subscription = {
        active: true,
        type: 'paid',
        expiresAt: user.subscription_end
      };
    }
    
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Subscription API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/referral-stats', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const referrals = await db.getReferralsByUserId(user_id);
    const earnings = await db.getReferralEarnings(user_id);
    
    const stats = {
      total_referrals: referrals.length,
      total_earnings: earnings.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Referral Stats API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-full', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, indicators, market_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const candles = market_type === 'forex' 
      ? await forexService.getCandles(symbol, timeframe, 100)
      : await marketData.getCandles(symbol, timeframe, 100, market_type);
    
    const analysis = new TechnicalAnalysis(candles);
    const recommendation = analysis.getTradeRecommendation();
    
    const currentPrice = candles && candles.length > 0 ? parseFloat(candles[candles.length - 1].close) : null;
    
    const result = {
      recommendation: recommendation.recommendation || recommendation.action,
      confidence: recommendation.confidence,
      currentPrice: currentPrice,
      entryPrice: recommendation.entryPrice,
      stopLoss: recommendation.stopLoss,
      takeProfit: recommendation.takeProfit,
      riskRewardRatio: recommendation.riskRewardRatio,
      buySignals: recommendation.buySignals,
      sellSignals: recommendation.sellSignals,
      trendStrength: recommendation.trendStrength,
      indicators: {}
    };
    
    indicators.forEach(ind => {
      if (recommendation.indicators[ind]) {
        result.indicators[ind] = recommendation.indicators[ind];
      }
    });
    
    res.json({ success: true, analysis: result });
  } catch (error) {
    console.error('Analysis Full API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/top-movers', async (req, res) => {
  try {
    const { type, market_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    let movers = [];
    
    if (market_type === 'forex') {
      const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD'];
      
      for (const pair of forexPairs) {
        try {
          const stats = await forexService.get24hrStats(pair);
          movers.push({
            symbol: pair,
            price: parseFloat(stats.lastPrice),
            change: parseFloat(stats.priceChangePercent)
          });
        } catch (err) {
          console.error(`Error fetching ${pair}:`, err.message);
        }
      }
      
      movers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
      movers = movers.slice(0, 10);
      
    } else if (market_type === 'stocks') {
      const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'BABA', 'TSM', 'V', 'JPM', 'WMT', 'JNJ'];
      
      for (const stock of stocks) {
        try {
          const candles = await marketData.getStockCandles(stock, '1d', 2);
          if (candles && candles.length >= 2) {
            const current = parseFloat(candles[candles.length - 1].close);
            const previous = parseFloat(candles[candles.length - 2].close);
            const change = ((current - previous) / previous) * 100;
            
            movers.push({ 
              symbol: stock, 
              price: current.toFixed(2), 
              change: change.toFixed(2) 
            });
          }
        } catch (err) {
          console.error(`Error fetching stock ${stock}:`, err.message);
        }
      }
      
      movers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
      movers = movers.slice(0, 10);
      
    } else if (market_type === 'commodities') {
      const commodities = ['XAUUSD', 'XAGUSD', 'WTIUSD', 'BCOUSD', 'XPTUSD', 'COPPER'];
      
      for (const commodity of commodities) {
        try {
          const candles = await marketData.getCommodityCandles(commodity, '1d', 2);
          if (candles && candles.length >= 2) {
            const current = parseFloat(candles[candles.length - 1].close);
            const previous = parseFloat(candles[candles.length - 2].close);
            const change = ((current - previous) / previous) * 100;
            
            movers.push({ 
              symbol: commodity,
              price: current.toFixed(2), 
              change: change.toFixed(2) 
            });
          }
        } catch (err) {
          console.error(`Error fetching commodity ${commodity}:`, err.message);
        }
      }
      
      movers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
      
    } else if (market_type === 'indices') {
      const indices = ['US30', 'SPX500', 'NAS100', 'UK100', 'GER40', 'JPN225', 'FRA40', 'HK50'];
      
      for (const index of indices) {
        try {
          const candles = await marketData.getIndicesCandles(index, '1d', 2);
          if (candles && candles.length >= 2) {
            const current = parseFloat(candles[candles.length - 1].close);
            const previous = parseFloat(candles[candles.length - 2].close);
            const change = ((current - previous) / previous) * 100;
            
            movers.push({ 
              symbol: index,
              price: current.toFixed(2), 
              change: change.toFixed(2) 
            });
          }
        } catch (err) {
          console.error(`Error fetching index ${index}:`, err.message);
        }
      }
      
      movers.sort((a, b) => type === 'gainers' ? b.change - a.change : a.change - b.change);
      
    } else {
      // للعملات الرقمية
      movers = await marketData.getTopMovers(type);
    }
    
    res.json({ success: true, movers });
  } catch (error) {
    console.error('Top Movers API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analysts', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analysts = await db.getAllAnalysts();
    const activeSubscriptions = await db.getActiveAnalystSubscriptions(user_id);
    
    const analystsWithStatus = analysts.map(analyst => ({
      ...analyst,
      id: analyst._id.toString(),
      is_subscribed: activeSubscriptions.some(sub => sub.analyst_id.toString() === analyst._id.toString())
    }));
    
    const subscriptionsWithIds = activeSubscriptions.map(sub => ({
      ...sub,
      analyst_id: sub.analyst_id.toString()
    }));
    
    res.json({ 
      success: true, 
      analysts: analystsWithStatus,
      active_subscriptions: subscriptionsWithIds
    });
  } catch (error) {
    console.error('Analysts API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/top-analysts', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const topAnalysts = await db.getTop100Analysts();
    
    const analystsWithRank = await Promise.all(topAnalysts.map(async (analyst, index) => {
      const stats = await db.getAnalystStats(analyst._id);
      return {
        ...analyst,
        rank: index + 1,
        ...stats
      };
    }));
    
    res.json({ 
      success: true, 
      analysts: analystsWithRank
    });
  } catch (error) {
    console.error('Top Analysts API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-stats', async (req, res) => {
  try {
    const { analyst_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const stats = await db.getAnalystStats(analyst_id);
    
    res.json({ 
      success: true, 
      stats
    });
  } catch (error) {
    console.error('Analyst Stats API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-signals', async (req, res) => {
  try {
    const { analyst_id, user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من اشتراك المستخدم
    const subscription = await db.getUserAnalystSubscription(user_id, analyst_id);
    if (!subscription) {
      return res.json({ success: false, error: 'يجب الاشتراك لعرض الإشارات' });
    }
    
    const signals = await db.getAnalystSignals(analyst_id);
    
    res.json({ 
      success: true, 
      signals
    });
  } catch (error) {
    console.error('Analyst Signals API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/rate-analyst', async (req, res) => {
  try {
    const { analyst_id, rating, comment, user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من اشتراك المستخدم
    const subscription = await db.getUserAnalystSubscription(user_id, analyst_id);
    if (!subscription) {
      return res.json({ success: false, error: 'يجب الاشتراك لتقييم المحلل' });
    }
    
    await db.createAnalystReview(user_id, analyst_id, rating, comment);
    
    // إعادة حساب متوسط التقييم
    const reviews = await db.getAnalystReviews(analyst_id);
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await db.updateAnalyst(analyst_id, { rating: avgRating.toFixed(2) });
    
    res.json({ 
      success: true, 
      message: 'تم إضافة التقييم بنجاح'
    });
  } catch (error) {
    console.error('Rate Analyst API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/create-analyst-signal', async (req, res) => {
  try {
    const { analyst_id, signal_data, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analystSignals = require('./analyst-signals');
    const signal = await analystSignals.createSignal(analyst_id, signal_data);
    
    // إرسال إشعار للمشتركين
    await analystSignals.notifySubscribers(analyst_id, signal);
    
    res.json({ 
      success: true, 
      signal
    });
  } catch (error) {
    console.error('Create Signal API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/subscribe-analyst', async (req, res) => {
  try {
    const { analyst_id, user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const { ObjectId } = require('mongodb');
    const user = await db.getUser(user_id);
    const analyst = await db.getAnalyst(new ObjectId(analyst_id));
    
    if (!analyst) {
      return res.json({ success: false, error: 'المحلل غير موجود' });
    }
    
    const existingSubscription = await db.getUserAnalystSubscription(user_id, analyst_id);
    if (existingSubscription) {
      return res.json({ success: false, error: 'أنت مشترك بالفعل مع هذا المحلل' });
    }
    
    if (user.balance < analyst.monthly_price) {
      return res.json({ success: false, error: 'رصيدك غير كافٍ' });
    }
    
    const price = parseFloat(analyst.monthly_price);
    const analystShare = price / 2;
    const referralCommission = user.referred_by ? price * 0.1 : 0;
    const ownerShare = user.referred_by ? (price / 2) - referralCommission : price / 2;
    
    const newBalance = user.balance - price;
    await db.updateUser(user_id, { balance: newBalance });
    await db.updateUserBalance(analyst.user_id, analystShare);
    await db.updateUserBalance(config.OWNER_ID, ownerShare);
    
    if (user.referred_by) {
      await db.addReferralEarning(user.referred_by, user_id, 'analyst_subscription', price, referralCommission);
      await db.updateUserBalance(user.referred_by, referralCommission);
    }
    
    await db.subscribeToAnalyst(user_id, analyst_id, price);
    await db.updateAnalystSubscriberCount(analyst_id, 1);
    
    bot.sendMessage(analyst.user_id, `
🎉 <b>مشترك جديد!</b>

لديك مشترك جديد في خدمة التحليل
👤 المستخدم: @${user.username || user.first_name}
💵 المبلغ: ${price} USDT
💰 حصتك: ${analystShare.toFixed(2)} USDT

📊 إجمالي المشتركين: ${analyst.total_subscribers + 1}
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying analyst:', err));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Subscribe Analyst API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/register-analyst', async (req, res) => {
  try {
    const { user_id, name, description, monthly_price, markets, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!name || !description || !monthly_price) {
      return res.json({ success: false, error: 'جميع الحقول مطلوبة' });
    }
    
    const price = parseFloat(monthly_price);
    if (isNaN(price) || price < 1) {
      return res.json({ success: false, error: 'السعر يجب أن يكون 1 USDT على الأقل' });
    }
    
    const existingAnalyst = await db.getAnalystByUserId(user_id);
    if (existingAnalyst) {
      return res.json({ success: false, error: 'أنت مسجل كمحلل بالفعل' });
    }
    
    const duplicateName = await db.getAnalystByName(name);
    if (duplicateName) {
      return res.json({ success: false, error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر' });
    }
    
    console.log(`📝 تسجيل محلل جديد - المستخدم: ${user_id}, الاسم: ${name}`);
    
    const analystMarkets = markets || [];
    const analyst = await db.createAnalyst(user_id, name, description, price, analystMarkets);
    
    const user = await db.getUser(user_id);
    
    bot.sendMessage(config.OWNER_ID, `
📝 <b>محلل جديد</b>

الاسم: ${name}
المستخدم: @${user.username || 'لا يوجد'}
ID: ${user_id}
السعر: ${price} USDT/شهر
الأسواق: ${analystMarkets.length > 0 ? analystMarkets.join(', ') : 'لم يحدد'}
الوصف: ${description}
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying owner:', err));
    
    res.json({ success: true, analyst });
  } catch (error) {
    console.error('Register Analyst API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/my-analyst-profile', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    res.json({ success: true, analyst });
  } catch (error) {
    console.error('My Analyst Profile API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/update-analyst', async (req, res) => {
  try {
    const { user_id, name, description, monthly_price, markets, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!name || !description || !monthly_price) {
      return res.json({ success: false, error: 'جميع الحقول مطلوبة' });
    }
    
    const price = parseFloat(monthly_price);
    if (isNaN(price) || price < 1) {
      return res.json({ success: false, error: 'السعر يجب أن يكون 1 USDT على الأقل' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'لم يتم العثور على حسابك كمحلل' });
    }
    
    if (name !== analyst.name) {
      const duplicateName = await db.getAnalystByName(name);
      if (duplicateName && duplicateName._id.toString() !== analyst._id.toString()) {
        return res.json({ success: false, error: 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر' });
      }
    }
    
    console.log(`✏️ تحديث بيانات محلل - المستخدم: ${user_id}, الاسم: ${name}`);
    
    const updateData = {
      name,
      description,
      monthly_price: price
    };
    
    if (markets) {
      updateData.markets = markets;
    }
    
    await db.updateAnalyst(analyst._id, updateData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update Analyst API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/toggle-analyst-status', async (req, res) => {
  try {
    const { user_id, is_active, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'لم يتم العثور على حسابك كمحلل' });
    }
    
    console.log(`${is_active ? '▶️' : '⏸️'} تغيير حالة محلل - المستخدم: ${user_id}, الحالة: ${is_active ? 'نشط' : 'متوقف'}`);
    
    await db.updateAnalyst(analyst._id, { is_active });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle Analyst Status API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/delete-analyst', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'لم يتم العثور على حسابك كمحلل' });
    }
    
    console.log(`🗑️ حذف حساب محلل - المستخدم: ${user_id}`);
    
    await db.updateAnalyst(analyst._id, { is_active: false });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Analyst API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analysts-by-status', async (req, res) => {
  try {
    const { is_active, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const { MongoClient, ObjectId } = require('mongodb');
    const analysts = await db.getDB().collection('analysts')
      .find({ is_active })
      .sort({ total_subscribers: -1, created_at: -1 })
      .toArray();
    
    res.json({ success: true, analysts });
  } catch (error) {
    console.error('Analysts By Status API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-subscribers', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'لم يتم العثور على حسابك كمحلل' });
    }
    
    const subscribers = await db.getAnalystSubscribers(analyst._id);
    const count = await db.getSubscriberCount(analyst._id);
    
    res.json({ 
      success: true, 
      subscribers,
      total_count: count
    });
  } catch (error) {
    console.error('Analyst Subscribers API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/create-room-post', async (req, res) => {
  try {
    const { user_id, post_data, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'يجب أن تكون محللاً لنشر الصفقات' });
    }
    
    if (!post_data.symbol || !post_data.type || !post_data.entry_price) {
      return res.json({ success: false, error: 'يجب تحديد الرمز والنوع وسعر الدخول على الأقل' });
    }
    
    const forbiddenWords = ['قناة', 'channel', 'telegram', 'واتساب', 'whatsapp', 'انستقرام', 'instagram', 'تواصل معي', 'contact me', 'خارج', 'outside'];
    const analysisText = (post_data.analysis || '').toLowerCase();
    
    for (const word of forbiddenWords) {
      if (analysisText.includes(word)) {
        return res.json({ 
          success: false, 
          error: 'غير مسموح بالترويج لقنوات أو منتجات خارجية. يرجى التركيز على التحليل فقط' 
        });
      }
    }
    
    const post = await db.createAnalystRoomPost(analyst._id, user_id, post_data);
    
    const subscribers = await db.getAnalystSubscribers(analyst._id);
    for (const subscriber of subscribers) {
      const message = `
📊 <b>صفقة جديدة من ${analyst.name}</b>

💱 الرمز: ${post_data.symbol}
📈 النوع: ${post_data.type === 'buy' ? 'شراء' : 'بيع'}
💵 سعر الدخول: ${post_data.entry_price}
🎯 الهدف: ${post_data.target_price || 'لم يحدد'}
🛑 وقف الخسارة: ${post_data.stop_loss || 'لم يحدد'}
⏰ الإطار الزمني: ${post_data.timeframe || 'لم يحدد'}
📍 السوق: ${post_data.market_type || 'لم يحدد'}

${post_data.analysis ? '📝 التحليل:\n' + post_data.analysis : ''}
`;
      
      try {
        await bot.sendMessage(subscriber.user_id, message, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Failed to notify subscriber ${subscriber.user_id}:`, error.message);
      }
    }
    
    res.json({ success: true, post });
  } catch (error) {
    console.error('Create Room Post API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-room-posts', async (req, res) => {
  try {
    const { analyst_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const { ObjectId } = require('mongodb');
    const posts = await db.getAnalystRoomPosts(new ObjectId(analyst_id));
    
    res.json({ success: true, posts });
  } catch (error) {
    console.error('Analyst Room Posts API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/delete-room-post', async (req, res) => {
  try {
    const { user_id, post_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'غير مصرح لك بحذف هذا المنشور' });
    }
    
    await db.deleteAnalystRoomPost(post_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete Room Post API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-advanced', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, analysis_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    let candles;
    
    if (market_type === 'forex') {
      candles = await forexService.getCandles(symbol, timeframe, 100);
    } else {
      candles = await marketData.getCandles(symbol, timeframe, 100, market_type);
    }
    
    if (!candles || candles.length < 50) {
      return res.json({ success: false, error: 'بيانات غير كافية للتحليل' });
    }
    
    const TechnicalAnalysis = require('./analysis');
    const analysis = new TechnicalAnalysis(candles);
    
    // تحديد نوع التحليل المطلوب
    let indicators = [];
    let analysisResult = {};
    
    switch(analysis_type) {
      case 'complete':
        // تحليل شامل - جميع المؤشرات
        indicators = [
          'RSI', 'MACD', 'EMA', 'SMA', 'BBANDS', 'ATR', 'STOCH', 'ADX', 'VOLUME',
          'FIBONACCI', 'CANDLE_PATTERNS', 'HEAD_SHOULDERS', 'SUPPORT_RESISTANCE'
        ];
        break;
      case 'fibonacci':
        // تحليل فيبوناتشي فقط
        indicators = ['FIBONACCI', 'SUPPORT_RESISTANCE'];
        break;
      case 'patterns':
        // أنماط الشموع فقط
        indicators = ['CANDLE_PATTERNS', 'HEAD_SHOULDERS'];
        break;
      case 'indicators':
        // المؤشرات الفنية الأساسية
        indicators = ['RSI', 'MACD', 'EMA', 'SMA', 'BBANDS', 'ATR', 'STOCH', 'ADX', 'VOLUME'];
        break;
      default:
        // افتراضي - تحليل شامل
        indicators = [
          'RSI', 'MACD', 'EMA', 'SMA', 'BBANDS', 'ATR', 'STOCH', 'ADX', 'VOLUME',
          'FIBONACCI', 'CANDLE_PATTERNS', 'SUPPORT_RESISTANCE'
        ];
    }
    
    const recommendation = analysis.getTradeRecommendationWithMarketType(market_type, trading_type || 'spot');
    const allIndicators = analysis.getAnalysis(indicators);
    
    res.json({
      success: true,
      analysis: {
        ...recommendation,
        allIndicators,
        currentPrice: candles[candles.length - 1].close,
        analysisType: analysis_type || 'complete'
      }
    });
  } catch (error) {
    console.error('Advanced Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// SPA fallback - يخدم index.html لجميع المسارات غير API
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/health') && !req.path.startsWith('/ping')) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    next();
  }
});

main();
