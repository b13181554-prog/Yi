// Fix MaxListenersExceededWarning
require('events').EventEmitter.defaultMaxListeners = 20;

const express = require('express');
const { ObjectId } = require('mongodb');
const db = require('./database');
const bot = require('./bot');
const notifications = require('./notifications');
const cryptapi = require('./cryptapi');
const config = require('./config');
const admin = require('./admin');
const rateLimiter = require('./rate-limiter');
const marketData = require('./market-data');
const forexService = require('./forex-service');
const TechnicalAnalysis = require('./analysis');
const rankingScheduler = require('./ranking-scheduler');
const { authenticateAPI, apiRateLimit, validateRequestSize } = require('./api-security');
const { initAnalystMonitor } = require('./analyst-monitor');
const { getTelegramProfilePhoto } = require('./telegram-helpers');
const { initTradeSignalsMonitor } = require('./trade-signals-monitor');
const monitor = require('./monitoring');
const Groq = require('groq-sdk');
const { addPaymentCallback, getQueueStats, startPaymentProcessor } = require('./payment-callback-queue');
const { startWithdrawalProcessor } = require('./withdrawal-queue');
const monitoringService = require('./monitoring-service');
const { startWithdrawalScheduler } = require('./withdrawal-scheduler');
const { safeSendMessage, safeSendPhoto, safeEditMessageText } = require('./safe-message');
const { getDashboardData, exportReport, getCostStats, getAPIBreakdown, getOptimizationSuggestions, setAlerts } = require('./api-cost-tracker');
const aiMonitor = require('./ai-monitor');

// Groq AI - Free and fast alternative to OpenAI
let groq = null;
if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('✅ Groq client initialized successfully');
} else {
  console.warn('⚠️  GROQ_API_KEY not found. Customer support feature will not work until API key is added.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://telegram.org; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.telegram.org https://telegram.org; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "upgrade-insecure-requests;"
  );
  next();
});

// الحد الأقصى لحجم الطلب
app.use((req, res, next) => {
  if (req.path === '/api/cryptapi/callback') {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(validateRequestSize);

// Health and monitoring endpoints (no rate limiting)
app.get('/api/health', async (req, res) => {
  try {
    const health = await monitoringService.checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 207 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.collectMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({
      success: true,
      queue: stats,
      cryptapi: cryptapi.getCircuitBreakerStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/ai-monitor/status', async (req, res) => {
  try {
    const status = aiMonitor.getStatus();
    res.json({
      success: true,
      aiMonitor: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/groq/status', async (req, res) => {
  try {
    const groqService = require('./groq-service');
    const status = groqService.getStatus();
    res.json({
      success: true,
      groq: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/system/status', async (req, res) => {
  try {
    const status = await monitoringService.getSystemStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/costs', async (req, res) => {
  try {
    const dashboardData = await getDashboardData();
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/costs/stats/:period', async (req, res) => {
  try {
    const { period } = req.params;
    const stats = await getCostStats(period);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/costs/breakdown', async (req, res) => {
  try {
    const breakdown = await getAPIBreakdown();
    res.json({
      success: true,
      breakdown
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/costs/suggestions', async (req, res) => {
  try {
    const suggestions = await getOptimizationSuggestions();
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/admin/costs/export/:format/:period', async (req, res) => {
  try {
    const { format, period } = req.params;
    const report = await exportReport(format, period);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=api-costs-${period}-${Date.now()}.csv`);
      res.send(report);
    } else {
      res.json({
        success: true,
        report
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/admin/costs/alerts', async (req, res) => {
  try {
    const thresholds = req.body;
    const alerts = await setAlerts(thresholds);
    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
      console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`📊 Metrics endpoint: http://localhost:${PORT}/api/metrics`);
      console.log(`📈 Queue stats: http://localhost:${PORT}/api/queue/stats`);
      console.log(`🔗 Public URL will be available at your Replit domain`);
    });
    
    await db.initDatabase();
    
    monitoringService.startMonitoring(60000);
    console.log('📊 Monitoring service started');
    
    // Start Queue Processors for withdrawal and payment processing
    startWithdrawalProcessor(5); // 5 concurrent workers
    startPaymentProcessor(3); // 3 concurrent workers
    console.log('✅ Queue processors started (Withdrawals: 5 workers, Payments: 3 workers)');
    
    notifications.initNotifications(bot);
    initAnalystMonitor(bot);
    initTradeSignalsMonitor(bot);
    admin.initAdminCommands(bot);
    rankingScheduler.start();
    startWithdrawalScheduler();
    console.log('✅ Withdrawal scheduler started');
    
    bot.startBot();
    
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const text = msg.text;
      
      // تجاهل المالك من Rate Limiting
      if (userId !== config.OWNER_ID) {
        const limitCheck = rateLimiter.checkLimit(userId);
        if (!limitCheck.allowed) {
          return safeSendMessage(bot, chatId, limitCheck.message);
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
          return safeSendMessage(bot, chatId, `
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
          return safeSendMessage(bot, chatId, `
❌ <b>بيانات غير صحيحة!</b>

تأكد من:
• الاسم غير فارغ
• الوصف غير فارغ
• السعر رقم صحيح (أكثر من 1 USDT)
`, { parse_mode: 'HTML' });
        }
        
        try {
          await db.createAnalyst(userId, name, description, price);
          await db.updateUser(userId, { temp_withdrawal_address: null });
        } catch (createError) {
          await db.updateUser(userId, { temp_withdrawal_address: null });
          
          if (createError.message.includes('مستخدم بالفعل') || createError.message.includes('duplicate')) {
            return safeSendMessage(bot, chatId, `
❌ <b>الاسم مستخدم بالفعل!</b>

هذا الاسم مستخدم من قبل محلل آخر.

💡 <b>الحل:</b>
• اختر اسماً مختلفاً
• أو قم بتعيين username في حساب تلجرام وحاول مرة أخرى

يرجى المحاولة مرة أخرى بإرسال البيانات:
`, { parse_mode: 'HTML' });
          }
          
          return safeSendMessage(bot, chatId, `
❌ <b>حدث خطأ أثناء التسجيل</b>

${createError.message}

يرجى المحاولة مرة أخرى أو التواصل مع الدعم.
`, { parse_mode: 'HTML' });
        }
        
        await safeSendMessage(bot, chatId, `
✅ <b>تم تسجيلك كمحلل بنجاح!</b>

📝 الاسم: ${name}
💰 السعر: ${price} USDT/شهر

<b>ملاحظات مهمة:</b>
• ستحصل على 50% من كل اشتراك
• 50% للمالك
• إذا كان المشترك مُحالاً، 10% عمولة للمُحيل

يمكن للمستخدمين الآن الاشتراك في خدماتك! 🎉
`, { parse_mode: 'HTML' });
        
        await safeSendMessage(bot, config.OWNER_ID, `
📢 <b>محلل جديد!</b>

👤 ${user.first_name} (${userId})
📝 ${name}
💰 ${price} USDT/شهر

${description}
`, { parse_mode: 'HTML' });
        
        return;
      }
      
      if (text.match(/^T[A-Za-z1-9]{33}$/)) {
        await safeSendMessage(bot, chatId, `
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
        await safeSendMessage(bot, chatId, `
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
        await safeSendMessage(bot, chatId, `
⏳ <b>لإجراء عمليات الإيداع</b>

يرجى استخدام نظام الدفع الآلي الجديد عبر تطبيق الويب:
1. اضغط على زر "🚀 فتح التطبيق"
2. اختر "💰 المحفظة"
3. اختر "📥 إيداع"
4. سيتم إنشاء عنوان دفع خاص بك تلقائياً
5. أرسل USDT إلى العنوان المُنشأ

✨ <b>المميزات الجديدة:</b>
• عنوان دفع فريد لكل عملية
• تأكيد فوري وتلقائي عند استلام الدفع
• لا حاجة لإرسال TxID يدوياً
• رسوم منخفضة جداً (1%)

📝 ملاحظة: نظام الدفع اليدوي تم استبداله بنظام CryptAPI الآلي الأكثر أماناً وسرعة
`, { parse_mode: 'HTML' });
        return;
      }
    });
    
    console.log('✅ OBENTCHI Bot is now running!');
    console.log('📊 Bot ready to analyze crypto markets');
    
    aiMonitor.start();
    console.log('🤖 AI Monitor started - checking every 5 minutes');
    
  } catch (error) {
    console.error('❌ Error starting bot:', error);
    process.exit(1);
  }
}

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

function getUserIdFromInitData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');
    if (!userParam) return null;
    const userData = JSON.parse(userParam);
    return userData.id;
  } catch (error) {
    return null;
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
      user = { balance: 0, subscription_expires: null };
    }
    
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;
    
    res.json({ success: true, user, botUsername });
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
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
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
    
    if (!subscription.active && user.subscription_expires && new Date(user.subscription_expires) > new Date()) {
      subscription = {
        active: true,
        type: 'paid',
        expiresAt: user.subscription_expires
      };
    }
    
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Subscription API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'المستخدم غير موجود' });
    }
    
    if (user.subscription_expires && new Date(user.subscription_expires) > new Date()) {
      return res.json({ success: false, error: 'لديك اشتراك نشط بالفعل' });
    }
    
    if (user.balance < config.SUBSCRIPTION_PRICE) {
      return res.json({ success: false, error: 'رصيدك غير كافٍ للاشتراك' });
    }
    
    let referralCommission = 0;
    let referrerId = null;
    let referralType = '';
    
    if (user.referred_by) {
      referralCommission = config.SUBSCRIPTION_PRICE * 0.1;
      referrerId = user.referred_by;
      referralType = 'subscription';
    }
    
    const result = await db.processSubscriptionPayment(user_id, {
      amount: config.SUBSCRIPTION_PRICE,
      referrerId: referrerId,
      referralType: referralType,
      referralCommission: referralCommission,
      ownerId: config.OWNER_ID
    });
    
    if (!result.success) {
      throw new Error('فشل في معالجة الاشتراك');
    }
    
    const expiryDate = result.expiryDate;
    const updatedUser = await db.getUser(user_id);
    
    safeSendMessage(bot, config.OWNER_ID, `
🎉 <b>اشتراك جديد!</b>

👤 المستخدم: ${user.first_name} ${user.username ? `(@${user.username})` : ''}
💵 المبلغ: ${config.SUBSCRIPTION_PRICE} USDT
📅 صالح حتى: ${expiryDate.toLocaleDateString('ar')}
${referrerId ? `\n🔗 عبر إحالة: نعم (${referralCommission} USDT)` : ''}
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying owner:', err));
    
    res.json({ 
      success: true,
      expiry_date: expiryDate,
      subscription: {
        expiresAt: expiryDate,
        newBalance: updatedUser.balance,
        amountPaid: config.SUBSCRIPTION_PRICE
      },
      message: 'تم الاشتراك بنجاح! اشتراكك نشط الآن لمدة 30 يوم' 
    });
  } catch (error) {
    console.error('Subscribe API Error:', error);
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
      total_earnings: earnings.reduce((sum, e) => sum + parseFloat(e.commission || 0), 0)
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Referral Stats API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/cryptapi/create-payment', async (req, res) => {
  try {
    const { user_id, amount, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }

    if (!amount || amount < config.MIN_DEPOSIT_AMOUNT) {
      return res.json({ 
        success: false, 
        error: `الحد الأدنى للإيداع هو ${config.MIN_DEPOSIT_AMOUNT} USDT` 
      });
    }

    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }

    const existingPayment = await db.getCryptAPIPaymentByUser(user_id, 'pending');
    if (existingPayment) {
      return res.json({
        success: true,
        payment: {
          payment_address: existingPayment.payment_address,
          qr_code_url: existingPayment.qr_code_url,
          amount: existingPayment.amount,
          created_at: existingPayment.created_at
        }
      });
    }

    const paymentResult = await cryptapi.createPaymentAddress(user_id, amount);
    
    if (!paymentResult.success) {
      return res.json({ success: false, error: paymentResult.error });
    }

    await db.createCryptAPIPayment(
      user_id,
      paymentResult.data.payment_address,
      amount,
      paymentResult.data.qr_code_url,
      paymentResult.data.callback_url
    );

    res.json({
      success: true,
      payment: {
        payment_address: paymentResult.data.payment_address,
        qr_code_url: paymentResult.data.qr_code_url,
        amount: amount,
        coin: paymentResult.data.coin
      }
    });
  } catch (error) {
    console.error('Create Payment API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/wallet/payment-status', async (req, res) => {
  try {
    const { paymentAddress, userId, initData } = req.query;
    
    if (!verifyTelegramWebAppData(initData)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }

    if (!paymentAddress || !userId) {
      return res.json({ success: false, error: 'Missing required parameters' });
    }

    const payment = await db.getCryptAPIPayment(paymentAddress);
    
    if (!payment) {
      return res.json({ success: false, error: 'Payment not found' });
    }

    if (payment.user_id !== parseInt(userId)) {
      return res.json({ success: false, error: 'Unauthorized: Payment does not belong to user' });
    }

    const user = await db.getUser(parseInt(userId));
    
    res.json({
      success: true,
      status: payment.status,
      balance: user?.balance || 0,
      confirmations: payment.confirmations || 0
    });
  } catch (error) {
    console.error('Payment Status API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/cryptapi/callback', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-ca-signature'];
    const rawBody = req.body;
    
    if (!signature) {
      console.error('❌ Missing x-ca-signature header');
      return res.status(401).send('*ok*');
    }

    const isValidSignature = await cryptapi.verifySignature(rawBody, signature);
    
    if (!isValidSignature) {
      console.error('❌ Invalid CryptAPI signature - possible attack attempt');
      return res.status(403).send('*ok*');
    }

    const callbackData = JSON.parse(rawBody.toString());
    console.log('🔔 CryptAPI Callback received (signature verified):', JSON.stringify(callbackData, null, 2));
    
    const validation = cryptapi.validateCallback(callbackData);
    if (!validation.valid) {
      console.error('❌ Invalid callback data:', validation.error);
      return res.status(400).send('*ok*');
    }

    const paymentAddress = callbackData.address_in;
    const payment = await db.getCryptAPIPayment(paymentAddress);
    
    if (!payment) {
      console.error('❌ Payment not found for address:', paymentAddress);
      return res.status(404).send('*ok*');
    }

    const idempotencyKey = `${callbackData.txid_in}-${callbackData.confirmations}-${Date.now()}`;
    
    await addPaymentCallback(callbackData, idempotencyKey);
    
    console.log(`✅ Payment callback queued for processing: ${paymentAddress}`);
    
    res.send('*ok*');
  } catch (error) {
    console.error('❌ CryptAPI Callback Error:', error);
    res.status(500).send('*ok*');
  }
});

app.post('/api/analyze-full', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, indicators, market_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
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
      movers = movers.slice(0, 50);
      
    } else if (market_type === 'stocks') {
      const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'AMD', 'BABA', 'TSM', 'V', 'JPM', 'WMT', 'JNJ'];
      
      for (const stock of stocks) {
        try {
          const candles = await marketData.getCandles(stock, '1d', 2, 'stocks');
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
      movers = movers.slice(0, 50);
      
    } else if (market_type === 'commodities') {
      const commodities = ['XAUUSD', 'XAGUSD', 'WTIUSD', 'BCOUSD', 'XPTUSD', 'COPPER'];
      
      for (const commodity of commodities) {
        try {
          const candles = await marketData.getCandles(commodity, '1d', 2, 'commodities');
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
          const candles = await marketData.getCandles(index, '1d', 2, 'indices');
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
    
    const analystsWithStatus = analysts.map(analyst => {
      const subscription = activeSubscriptions.find(sub => sub.analyst_id.toString() === analyst._id.toString());
      return {
        ...analyst,
        id: analyst._id.toString(),
        is_subscribed: !!subscription,
        subscription_id: subscription?._id?.toString(),
        subscription_amount: subscription?.amount,
        subscription_start_date: subscription?.start_date,
        subscription_end_date: subscription?.end_date
      };
    });
    
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
    const { init_data, market_type } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const topAnalysts = market_type 
      ? await db.getTop100AnalystsByMarket(market_type)
      : await db.getTop100Analysts();
    
    const analystsWithRank = await Promise.all(topAnalysts.map(async (analyst, index) => {
      const stats = await db.getAnalystStats(analyst._id);
      return {
        ...analyst,
        id: analyst._id.toString(),
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
    
    const database = db.getDB();
    
    // التحقق من أن المستخدم لم يقيم المحلل من قبل
    const existingReview = await database.collection('analyst_reviews').findOne({
      user_id: user_id,
      analyst_id: new ObjectId(analyst_id)
    });
    
    if (existingReview) {
      // تحديث التقييم الموجود
      await database.collection('analyst_reviews').updateOne(
        { user_id: user_id, analyst_id: new ObjectId(analyst_id) },
        { $set: { rating: rating, comment: comment || '', updated_at: new Date() } }
      );
    } else {
      // إضافة تقييم جديد
      await db.createAnalystReview(user_id, analyst_id, rating, comment);
    }
    
    // حساب عدد اللايكات والديس لايك بشكل منفصل
    const reviews = await db.getAnalystReviews(analyst_id);
    const likes = reviews.filter(r => r.rating === 1).length;
    const dislikes = reviews.filter(r => r.rating === 0).length;
    
    // تحديث بيانات المحلل مع عدد اللايكات والديس لايك
    await db.updateAnalyst(analyst_id, { 
      likes: likes,
      dislikes: dislikes,
      rating: likes  // التقييم الإجمالي يعتمد فقط على اللايكات
    });
    
    res.json({ 
      success: true, 
      message: 'تم إضافة التقييم بنجاح',
      likes: likes,
      dislikes: dislikes
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
    
    // تحديث تاريخ آخر نشر للمحلل
    try {
      await db.updateAnalystLastPost(analyst_id);
    } catch (error) {
      console.error('خطأ في تحديث تاريخ آخر نشر للمحلل:', error);
    }
    
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
    
    const activeSubscription = await db.getUserAnalystSubscription(user_id, analyst_id);
    if (activeSubscription) {
      return res.json({ success: false, error: 'لديك اشتراك نشط بالفعل مع هذا المحلل' });
    }
    
    const recentSubscription = await db.getRecentAnalystSubscription(user_id, analyst_id);
    if (recentSubscription) {
      const daysSinceEnd = Math.ceil((new Date() - new Date(recentSubscription.end_date)) / (1000 * 60 * 60 * 24));
      if (daysSinceEnd < 7) {
        return res.json({ 
          success: false, 
          error: `اشتراكك السابق انتهى منذ ${daysSinceEnd} يوم. يمكنك الاشتراك مجدداً بعد 7 أيام من انتهاء الاشتراك السابق.` 
        });
      }
    }
    
    if (user.balance < analyst.monthly_price) {
      return res.json({ success: false, error: 'رصيدك غير كافٍ' });
    }
    
    const price = parseFloat(analyst.monthly_price);
    const analystShare = price / 2;
    
    let referralCommission = 0;
    let referrerId = null;
    let referralType = '';
    
    // التحقق من الإحالة الخاصة بمحلل معين (أولوية)
    if (user.promoter_analyst_id && user.promoter_referrer_id) {
      // التحقق إذا كان الاشتراك في نفس المحلل الذي تم الإحالة له
      if (user.promoter_analyst_id === analyst_id.toString()) {
        referralCommission = price * 0.15;
        referrerId = user.promoter_referrer_id;
        referralType = 'analyst_promoter_referral';
      }
    }
    
    // الإحالة العامة للمحللين (20%)
    if (!referrerId && user.referred_by_analyst) {
      referralCommission = price * 0.2;
      referrerId = user.referred_by_analyst;
      referralType = 'analyst_referral';
    } 
    
    // الإحالة العامة للمستخدمين (10%)
    if (!referrerId && user.referred_by) {
      referralCommission = price * 0.1;
      referrerId = user.referred_by;
      referralType = 'analyst_subscription';
    }
    
    const ownerShare = (price / 2) - referralCommission;
    
    const newBalance = user.balance - price;
    await db.updateUser(user_id, { balance: newBalance });
    
    // إضافة نصيب المحلل إلى الضمان (escrow) بدلاً من الرصيد المتاح مباشرة
    // المبلغ سيبقى في الضمان حتى يتم تحريره من قبل المالك
    await db.addToAnalystEscrow(new ObjectId(analyst_id), analystShare);
    
    await db.updateUserBalance(config.OWNER_ID, ownerShare);
    
    if (referrerId) {
      await db.addReferralEarning(referrerId, user_id, referralType, price, referralCommission);
      await db.updateUserBalance(referrerId, referralCommission);
    }
    
    await db.subscribeToAnalyst(user_id, analyst_id, price, {
      analyst_share: analystShare,
      owner_share: ownerShare,
      referral_commission: referralCommission,
      referrer_id: referrerId,
      referral_type: referralType
    });
    await db.updateAnalystSubscriberCount(analyst_id, 1);
    
    safeSendMessage(bot, analyst.user_id, `
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

app.post('/api/get-analyst-referral-link', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'أنت لست محلل مسجل' });
    }
    
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;
    const referralLink = `https://t.me/${botUsername}?start=analyst_ref_${user_id}`;
    
    res.json({ 
      success: true, 
      referral_link: referralLink,
      commission_rate: 20
    });
  } catch (error) {
    console.error('Get Analyst Referral Link API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/get-analyst-promoter-link', async (req, res) => {
  try {
    const { user_id, analyst_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const analyst = await db.getAnalyst(analyst_id);
    if (!analyst) {
      return res.json({ success: false, error: 'المحلل غير موجود' });
    }
    
    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;
    const referralLink = `https://t.me/${botUsername}?start=analyst_${analyst_id}_ref_${user_id}`;
    
    res.json({ 
      success: true, 
      referral_link: referralLink,
      analyst_name: analyst.name,
      commission_rate: 15
    });
  } catch (error) {
    console.error('Get Analyst Promoter Link API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/register-analyst', async (req, res) => {
  try {
    const { user_id, description, monthly_price, markets, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // فحص حالة الحظر
    const banStatus = await db.checkUserBanStatus(user_id);
    if (banStatus.banned) {
      return res.json({ 
        success: false, 
        error: `حسابك محظور. السبب: ${banStatus.reason}` 
      });
    }
    
    if (!description || !monthly_price) {
      return res.json({ success: false, error: 'جميع الحقول مطلوبة' });
    }
    
    // فلتر المحتوى للوصف
    const descCheck = db.containsProhibitedContent(description);
    if (descCheck.prohibited) {
      return res.json({ success: false, error: descCheck.reason });
    }
    
    const price = parseFloat(monthly_price);
    if (isNaN(price) || price < 1) {
      return res.json({ success: false, error: 'السعر يجب أن يكون 1 USDT على الأقل' });
    }
    
    const existingAnalyst = await db.getAnalystByUserId(user_id);
    if (existingAnalyst) {
      return res.json({ success: false, error: 'أنت مسجل كمحلل بالفعل' });
    }
    
    // الحصول على بيانات المستخدم من قاعدة البيانات
    const user = await db.getUser(user_id);
    if (!user) {
      return res.json({ success: false, error: 'المستخدم غير موجود' });
    }
    
    // إنشاء اسم المحلل - استخدام username إن وُجد لضمان التفرد
    let name;
    if (user.username) {
      name = user.username;
    } else {
      const fullName = `${user.first_name || ''}${user.last_name ? ' ' + user.last_name : ''}`.trim();
      if (!fullName) {
        return res.json({ success: false, error: 'يجب أن يكون لديك اسم في حساب تلجرام الخاص بك' });
      }
      name = `${fullName} (${user_id})`;
    }
    
    if (!name || name.length < 2) {
      return res.json({ success: false, error: 'يجب أن يكون لديك اسم في حساب تلجرام الخاص بك' });
    }
    
    // الحصول على صورة البروفايل من تلجرام
    let profilePicture = null;
    try {
      profilePicture = await getTelegramProfilePhoto(bot, user_id);
      if (!profilePicture) {
        console.log(`⚠️ No profile photo found for user ${user_id}`);
      }
    } catch (photoError) {
      console.error('❌ Error getting profile photo:', photoError);
      profilePicture = null;
    }
    
    const analystMarkets = markets || [];
    
    try {
      const analyst = await db.createAnalyst(user_id, name, description, price, analystMarkets, profilePicture);
    
    safeSendMessage(bot, config.OWNER_ID, `
📝 <b>محلل جديد</b>

الاسم: ${name}
المستخدم: @${user.username || 'لا يوجد'}
ID: ${user_id}
السعر: ${price} USDT/شهر
الأسواق: ${analystMarkets.length > 0 ? analystMarkets.join(', ') : 'لم يحدد'}
الوصف: ${description}
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying owner:', err));
    
      res.json({ success: true, analyst });
    } catch (createError) {
      if (createError.message.includes('مستخدم بالفعل') || createError.message.includes('duplicate')) {
        const errorMessage = user.username 
          ? 'هذا الاسم مستخدم بالفعل، يرجى اختيار اسم آخر'
          : `⚠️ هذا الاسم مستخدم بالفعل من قبل محلل آخر.\n\n💡 للحل:\n• قم بتعيين username في حساب تلجرام الخاص بك\n• ثم حاول التسجيل مرة أخرى\n\nهذا سيضمن تفرد اسمك كمحلل.`;
        
        return res.json({ success: false, error: errorMessage });
      }
      return res.json({ success: false, error: createError.message });
    }
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
    const { user_id, description, monthly_price, markets, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!description || !monthly_price) {
      return res.json({ success: false, error: 'جميع الحقول مطلوبة' });
    }
    
    const analystMarkets = markets || [];
    if (analystMarkets.length === 0) {
      return res.json({ success: false, error: 'يرجى اختيار سوق واحد على الأقل' });
    }
    
    const price = parseFloat(monthly_price);
    if (isNaN(price) || price < 1) {
      return res.json({ success: false, error: 'السعر يجب أن يكون 1 USDT على الأقل' });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'لم يتم العثور على حسابك كمحلل' });
    }
    
    const sanitizedDescription = description.trim().slice(0, 500);
    
    if (!sanitizedDescription || sanitizedDescription.length < 10) {
      return res.json({ success: false, error: 'الوصف يجب أن يحتوي على 10 أحرف على الأقل' });
    }
    
    console.log(`✏️ تحديث بيانات محلل - المستخدم: ${user_id}`);
    
    const updateData = {
      description: sanitizedDescription,
      monthly_price: price,
      markets: analystMarkets
    };
    
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
        await safeSendMessage(bot, subscription.user_id, `
⚠️ <b>إشعار إلغاء اشتراك</b>

تم إلغاء اشتراكك في المحلل: <b>${analyst.name}</b>

السبب: المحلل قام بحذف حسابه

💰 تم إرجاع المبلغ: ${refundAmount.toFixed(2)} USDT
✅ الرصيد المُرجع متاح في محفظتك

نأسف للإزعاج ونتمنى أن تجد محلل آخر مناسب 🙏
`, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Error sending refund notification to user ${subscription.user_id}:`, error.message);
      }
    }
    
    const deleteResult = await db.getDB().collection('analysts').deleteOne({ _id: analyst._id });
    console.log(`🗑️ نتيجة حذف المحلل: ${deleteResult.deletedCount} سجل تم حذفه`);
    
    if (deleteResult.deletedCount === 0) {
      console.error(`❌ فشل حذف المحلل ${analyst.name} - لم يتم حذف أي سجل`);
      return res.json({ success: false, error: 'فشل حذف الحساب، يرجى المحاولة مرة أخرى' });
    }
    
    if (subscriberCount > 0) {
      console.log(`✅ تم حذف المحلل ${analyst.name} وإرجاع ${totalRefunded.toFixed(2)} USDT لـ ${subscriberCount} مشتركين`);
      
      try {
        await safeSendMessage(bot, user_id, `
✅ <b>تم حذف حسابك كمحلل بنجاح</b>

تم إلغاء جميع الاشتراكات وإرجاع المبالغ للمشتركين.

📊 عدد المشتركين المتأثرين: ${subscriberCount}
💰 إجمالي المبالغ المُرجعة: ${totalRefunded.toFixed(2)} USDT

✅ يمكنك إنشاء حساب محلل جديد في أي وقت.
`, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Error sending deletion notification to analyst ${user_id}:`, error.message);
      }
    } else {
      console.log(`✅ تم حذف المحلل ${analyst.name} بنجاح (بدون مشتركين)`);
      
      try {
        await safeSendMessage(bot, user_id, `
✅ <b>تم حذف حسابك كمحلل بنجاح</b>

يمكنك إنشاء حساب محلل جديد في أي وقت.
`, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Error sending deletion notification to analyst ${user_id}:`, error.message);
      }
    }
    
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
    
    const analysts = await db.getDB().collection('analysts').aggregate([
      { $match: { is_active } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          username: '$user.username'
        }
      },
      { $sort: { total_subscribers: -1, created_at: -1 } }
    ]).toArray();
    
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
    
    // فحص حالة الحظر
    const banStatus = await db.checkUserBanStatus(user_id);
    if (banStatus.banned) {
      return res.json({ 
        success: false, 
        error: `حسابك محظور. السبب: ${banStatus.reason}` 
      });
    }
    
    const analyst = await db.getAnalystByUserId(user_id);
    if (!analyst) {
      return res.json({ success: false, error: 'يجب أن تكون محللاً لنشر الصفقات' });
    }
    
    if (!post_data.symbol || !post_data.type || !post_data.entry_price) {
      return res.json({ success: false, error: 'يجب تحديد الرمز والنوع وسعر الدخول على الأقل' });
    }
    
    // فلتر المحتوى للتحليل
    const contentCheck = db.containsProhibitedContent(post_data.analysis);
    if (contentCheck.prohibited) {
      return res.json({ 
        success: false, 
        error: contentCheck.reason 
      });
    }
    
    const post = await db.createAnalystRoomPost(analyst._id, user_id, post_data);
    
    const subscribers = await db.getAnalystSubscribers(analyst._id);
    for (const subscriber of subscribers) {
      const tradingTypeText = post_data.trading_type === 'futures' ? 'Futures ⚡' : 'Spot 📊';
      const leverageText = post_data.trading_type === 'futures' && post_data.leverage 
        ? `\n🔥 الرافعة: ${post_data.leverage}x` 
        : '';
      
      const message = `
📊 <b>صفقة جديدة من ${analyst.name}</b>

💱 الرمز: ${post_data.symbol}
📍 السوق: ${post_data.market_type || 'لم يحدد'}
📌 نوع التداول: ${tradingTypeText}${leverageText}
📈 النوع: ${post_data.type === 'buy' ? 'شراء 🟢 (Long)' : 'بيع 🔴 (Short)'}
💵 سعر الدخول: ${post_data.entry_price}
🎯 الهدف: ${post_data.target_price || 'لم يحدد'}
🛑 وقف الخسارة: ${post_data.stop_loss || 'لم يحدد'}
⏰ الإطار الزمني: ${post_data.timeframe || 'لم يحدد'}

${post_data.analysis ? '📝 التحليل:\n' + post_data.analysis : ''}
`;
      
      try {
        await safeSendMessage(bot, subscriber.user_id, message, { parse_mode: 'HTML' });
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

app.post('/api/analyst-performance', async (req, res) => {
  try {
    const { analyst_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const performanceAnalyzer = require('./analyst-performance');
    
    const metrics = await performanceAnalyzer.calculateAdvancedMetrics(analyst_id);
    const tierData = await performanceAnalyzer.calculateTierAndBadges(analyst_id);
    
    res.json({ 
      success: true, 
      metrics,
      tier: tierData.tier,
      badges: tierData.badges,
      achievements: tierData.achievements
    });
  } catch (error) {
    console.error('Analyst Performance API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-ai-insights', async (req, res) => {
  try {
    const { analyst_id, init_data, generate_new } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const aiAdvisor = require('./analyst-ai-advisor');
    
    let insights;
    
    if (generate_new) {
      insights = await aiAdvisor.analyzePerformanceAndAdvise(analyst_id);
    } else {
      insights = await aiAdvisor.getLatestInsights(analyst_id);
      
      if (!insights) {
        insights = await aiAdvisor.analyzePerformanceAndAdvise(analyst_id);
      }
    }
    
    res.json({ success: true, insights });
  } catch (error) {
    console.error('Analyst AI Insights API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyst-ranking', async (req, res) => {
  try {
    const { init_data, limit, metric } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const performanceAnalyzer = require('./analyst-performance');
    
    let rankings;
    
    if (limit && metric) {
      rankings = await performanceAnalyzer.getTopPerformers(limit, metric);
    } else {
      rankings = await performanceAnalyzer.getAnalystRanking();
    }
    
    res.json({ success: true, rankings });
  } catch (error) {
    console.error('Analyst Ranking API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/compare-analysts', async (req, res) => {
  try {
    const { analyst_ids, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!analyst_ids || analyst_ids.length < 2) {
      return res.json({ success: false, error: 'يجب اختيار محللين على الأقل للمقارنة' });
    }
    
    const performanceAnalyzer = require('./analyst-performance');
    
    const comparison = await performanceAnalyzer.compareAnalysts(analyst_ids);
    
    res.json({ success: true, comparison });
  } catch (error) {
    console.error('Compare Analysts API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-advanced', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, analysis_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
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

app.post('/api/analyze-ultra', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
    }
    
    let candles;
    
    if (market_type === 'forex') {
      candles = await forexService.getCandles(symbol, timeframe, 100);
    } else {
      candles = await marketData.getCandles(symbol, timeframe, 100, market_type);
    }
    
    if (!candles || candles.length < 50) {
      return res.json({ success: false, error: 'بيانات غير كافية للتحليل المتقدم - يجب توفر 50 شمعة على الأقل' });
    }
    
    const UltraAnalysis = require('./ultra-analysis');
    const ultraAnalysis = new UltraAnalysis(candles);
    
    const ultraRecommendation = ultraAnalysis.getUltraRecommendation(market_type, trading_type || 'spot', timeframe);
    
    res.json({
      success: true,
      analysis: ultraRecommendation
    });
  } catch (error) {
    console.error('Ultra Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-zero-reversal', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
    }
    
    let candles;
    
    if (market_type === 'forex') {
      candles = await forexService.getCandles(symbol, timeframe, 100);
    } else {
      candles = await marketData.getCandles(symbol, timeframe, 100, market_type);
    }
    
    // للسلع والأسهم، نقبل 80 شمعة كحد أدنى بسبب محدودية البيانات التاريخية
    const minCandles = (market_type === 'commodities' || market_type === 'stocks') ? 80 : 100;
    
    if (!candles || candles.length < minCandles) {
      let errorMessage = `بيانات غير كافية لنظام Zero Reversal - متوفر ${candles?.length || 0} شمعة فقط`;
      
      if (market_type === 'commodities' || market_type === 'stocks') {
        errorMessage += `\n💡 نصيحة: استخدم إطار زمني أطول (4h أو 1d) للحصول على بيانات أكثر`;
      } else {
        errorMessage += `\nيجب توفر ${minCandles} شمعة على الأقل`;
      }
      
      return res.json({ success: false, error: errorMessage });
    }
    
    const ZeroReversalAnalysis = require('./zero-reversal-analysis');
    const zeroReversalAnalysis = new ZeroReversalAnalysis(candles);
    
    const zeroReversalRecommendation = zeroReversalAnalysis.getZeroReversalRecommendation(market_type, trading_type || 'spot', timeframe);
    
    res.json({
      success: true,
      analysis: zeroReversalRecommendation
    });
  } catch (error) {
    console.error('Zero Reversal Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-v1-pro', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, balance, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
    }
    
    let candles;
    
    if (market_type === 'forex') {
      candles = await forexService.getCandles(symbol, timeframe, 100);
    } else {
      candles = await marketData.getCandles(symbol, timeframe, 100, market_type);
    }
    
    // V1 PRO يحتاج 100 شمعة على الأقل للتحليل الدقيق
    const minCandles = 100;
    
    if (!candles || candles.length < minCandles) {
      let errorMessage = `بيانات غير كافية لنظام V1 PRO - متوفر ${candles?.length || 0} شمعة فقط`;
      errorMessage += `\nيجب توفر ${minCandles} شمعة على الأقل`;
      
      if (market_type === 'commodities' || market_type === 'stocks') {
        errorMessage += `\n💡 نصيحة: استخدم إطار زمني أطول (4h أو 1d) للحصول على بيانات أكثر`;
      }
      
      return res.json({ success: false, error: errorMessage });
    }
    
    // الحصول على رصيد المستخدم أو استخدام القيمة الافتراضية
    let userBalance = balance || 10000;
    
    if (user_id) {
      try {
        const user = await db.getUser(user_id);
        if (user && user.balance) {
          userBalance = user.balance;
        }
      } catch (err) {
        console.log('⚠️ لم يتم جلب رصيد المستخدم، استخدام القيمة الافتراضية');
      }
    }
    
    const OBENTCHIV1ProAnalysis = require('./v1-pro-analysis');
    const v1ProAnalysis = new OBENTCHIV1ProAnalysis(candles, userBalance, symbol);
    
    // استخدام await لأن getCompleteAnalysis أصبح async
    const v1ProResult = await v1ProAnalysis.getCompleteAnalysis();
    
    // إضافة معلومات إضافية
    v1ProResult.tradingType = trading_type || 'spot';
    v1ProResult.marketType = market_type;
    v1ProResult.timeframe = timeframe;
    
    res.json({
      success: true,
      analysis: v1ProResult
    });
  } catch (error) {
    console.error('V1 PRO Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-pump', async (req, res) => {
  try {
    const { symbol, market_type, timeframe, trading_type, init_data, user_id } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
    }
    
    if (market_type !== 'crypto') {
      return res.json({ success: false, error: 'تحليل Pump متاح للعملات الرقمية فقط' });
    }
    
    const candles = await marketData.getCandles(symbol, timeframe || '1h', 100, market_type);
    
    if (!candles || candles.length < 100) {
      return res.json({ success: false, error: `بيانات غير كافية لتحليل Pump - متوفر ${candles?.length || 0} شمعة فقط` });
    }
    
    const PumpAnalysis = require('./pump-analysis');
    const pumpAnalysis = new PumpAnalysis(candles, symbol);
    
    // استخدام await لأن getPumpPotential أصبح async
    const pumpPotential = await pumpAnalysis.getPumpPotential();
    pumpPotential.tradingType = trading_type || 'spot';
    pumpPotential.marketType = market_type;
    
    res.json({
      success: true,
      analysis: pumpPotential
    });
  } catch (error) {
    console.error('Pump Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/analyze-master', async (req, res) => {
  try {
    const { user_id, symbol, timeframe, market_type, trading_type, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    // التحقق من حالة الاشتراك
    const subscription = await db.checkSubscription(user_id);
    if (!subscription.active) {
      let errorMessage = 'يجب الاشتراك للوصول إلى ميزات التحليل';
      
      if (subscription.reason === 'trial_expired') {
        errorMessage = 'انتهت الفترة التجريبية! يرجى الاشتراك للاستمرار في استخدام ميزات التحليل';
      } else if (subscription.reason === 'no_subscription') {
        errorMessage = 'لا يوجد اشتراك نشط! يرجى الاشتراك للوصول إلى ميزات التحليل';
      }
      
      return res.json({ 
        success: false, 
        error: errorMessage,
        requires_subscription: true 
      });
    }
    
    let candles;
    
    if (market_type === 'forex') {
      candles = await forexService.getCandles(symbol, timeframe, 100);
    } else {
      candles = await marketData.getCandles(symbol, timeframe, 100, market_type);
    }
    
    const minCandles = (market_type === 'commodities' || market_type === 'stocks') ? 50 : 100;
    
    if (!candles || candles.length < minCandles) {
      let errorMessage = `بيانات غير كافية للتحليل الشامل - متوفر ${candles?.length || 0} شمعة فقط`;
      
      if (market_type === 'commodities' || market_type === 'stocks') {
        errorMessage += `\n💡 نصيحة: استخدم إطار زمني أطول (4h أو 1d) للحصول على بيانات أكثر`;
      } else {
        errorMessage += `\nيجب توفر ${minCandles} شمعة على الأقل`;
      }
      
      return res.json({ success: false, error: errorMessage });
    }
    
    const MasterAnalysis = require('./master-analysis');
    const masterAnalysis = new MasterAnalysis(candles, symbol, timeframe, market_type);
    
    const masterResult = await masterAnalysis.getMasterAnalysis(trading_type || 'spot');
    
    res.json({
      success: true,
      analysis: masterResult
    });
  } catch (error) {
    console.error('Master Analysis API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/scan-best-signals', async (req, res) => {
  try {
    const { market_type, analysis_type, timeframe, max_results, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const SignalScanner = require('./signal-scanner');
    const scanner = new SignalScanner();
    
    const bestSignals = await scanner.scanBestSignals(
      market_type || 'crypto',
      analysis_type || 'zero-reversal',
      timeframe || '1h',
      max_results || 10
    );
    
    res.json({
      success: true,
      signals: bestSignals,
      scanned_market: market_type || 'crypto',
      analysis_type: analysis_type || 'zero-reversal',
      timeframe: timeframe || '1h'
    });
  } catch (error) {
    console.error('Signal Scanner API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/smart-scanner', async (req, res) => {
  try {
    const { market_type, analysis_type, timeframe, init_data, user_id } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!user_id) {
      return res.json({ success: false, error: 'User ID is required' });
    }
    
    // إعداد SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const SignalScanner = require('./signal-scanner');
    const scanner = new SignalScanner();
    
    // دالة لإرسال البيانات عبر SSE
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // بدء المسح الذكي
    try {
      await scanner.smartScan(
        market_type || 'all',
        analysis_type || 'zero-reversal',
        timeframe || '1h',
        sendEvent
      );
      
      res.end();
    } catch (scanError) {
      sendEvent({
        type: 'error',
        message: scanError.message
      });
      res.end();
    }
  } catch (error) {
    console.error('Smart Scanner API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/all-assets', async (req, res) => {
  try {
    const { init_data, force_update } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const assetsManager = require('./assets-manager');
    
    // تحديث الأصول إذا كانت فارغة أو إذا طلب المستخدم التحديث
    if (force_update || !assetsManager.lastUpdate || assetsManager.cryptoAssets.length === 0) {
      await assetsManager.updateAllAssets();
    }
    
    res.json({
      success: true,
      assets: {
        crypto: assetsManager.cryptoAssets,
        forex: assetsManager.forexPairs,
        stocks: assetsManager.stocks,
        commodities: assetsManager.commodities,
        indices: assetsManager.indices
      },
      last_update: assetsManager.lastUpdate,
      stats: {
        crypto_count: assetsManager.cryptoAssets.length,
        forex_count: assetsManager.forexPairs.length,
        stocks_count: assetsManager.stocks.length,
        commodities_count: assetsManager.commodities.length,
        indices_count: assetsManager.indices.length,
        total_count: assetsManager.cryptoAssets.length + assetsManager.forexPairs.length + 
                     assetsManager.stocks.length + assetsManager.commodities.length + 
                     assetsManager.indices.length
      }
    });
  } catch (error) {
    console.error('All Assets API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/search-assets', async (req, res) => {
  try {
    const { query, market_type, init_data, user_id, limit = 20 } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!query || query.trim().length === 0) {
      return res.json({ success: false, error: 'Query is required' });
    }
    
    const directSearch = require('./direct-search');
    
    const results = await directSearch.search(query.trim(), market_type, false);
    
    const limitedResults = results.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      results: limitedResults,
      total_found: results.length,
      returned: limitedResults.length,
      query: query,
      search_type: 'direct',
      is_vip: false
    });
  } catch (error) {
    console.error('Search Assets API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/change-language', async (req, res) => {
  try {
    const { user_id, language, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const validLanguages = ['ar', 'en', 'fr', 'es', 'de', 'ru', 'zh'];
    
    if (!validLanguages.includes(language)) {
      return res.json({ success: false, error: 'Invalid language' });
    }
    
    await db.updateUser(user_id, { language });
    
    res.json({ success: true, message: 'Language updated successfully' });
  } catch (error) {
    console.error('Change Language API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/notification-settings', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const settings = await db.getNotificationSettings(user_id);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get Notification Settings API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/toggle-notifications', async (req, res) => {
  try {
    const { user_id, enabled, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    await db.toggleNotifications(user_id, enabled);
    res.json({ success: true, message: enabled ? 'تم تفعيل الإشعارات' : 'تم إيقاف الإشعارات' });
  } catch (error) {
    console.error('Toggle Notifications API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/update-notification-markets', async (req, res) => {
  try {
    const { user_id, markets, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const validMarkets = ['crypto', 'forex', 'stocks', 'commodities', 'indices'];
    const filteredMarkets = markets.filter(m => validMarkets.includes(m));
    
    await db.updateNotificationMarkets(user_id, filteredMarkets);
    res.json({ success: true, message: 'تم تحديث تفضيلات الإشعارات' });
  } catch (error) {
    console.error('Update Notification Markets API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/pump-subscription', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const subscription = await db.getPumpSubscription(user_id);
    res.json({ 
      success: true, 
      has_subscription: !!subscription,
      subscription: subscription,
      price: config.PUMP_SUBSCRIPTION_PRICE
    });
  } catch (error) {
    console.error('Get Pump Subscription API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/subscribe-pump', async (req, res) => {
  try {
    const { user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const existingSub = await db.getPumpSubscription(user_id);
    if (existingSub) {
      return res.json({ success: false, error: 'لديك اشتراك نشط بالفعل في نظام Pump' });
    }
    
    const user = await db.getUser(user_id);
    if (user.balance < config.PUMP_SUBSCRIPTION_PRICE) {
      return res.json({ success: false, error: 'رصيدك غير كافٍ' });
    }
    
    await db.updateUser(user_id, { balance: user.balance - config.PUMP_SUBSCRIPTION_PRICE });
    await db.subscribeToPumpAnalysis(user_id, config.PUMP_SUBSCRIPTION_PRICE);
    
    const ownerShare = config.PUMP_SUBSCRIPTION_PRICE;
    await db.updateUserBalance(config.OWNER_ID, ownerShare);
    
    res.json({ success: true, message: 'تم الاشتراك في نظام Pump بنجاح' });
  } catch (error) {
    console.error('Subscribe Pump API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Enhanced Pump Scanner APIs
app.post('/api/enhanced-pump-scan', async (req, res) => {
  try {
    const { init_data, limit } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const enhancedPumpScanner = require('./enhanced-pump-scanner');
    const opportunities = await enhancedPumpScanner.getTopPumpOpportunities(limit || 20);
    
    res.json({
      success: true,
      opportunities,
      count: opportunities.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Enhanced Pump Scan API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/search-pump-token', async (req, res) => {
  try {
    const { query, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    if (!query || query.trim().length === 0) {
      return res.json({ success: false, error: 'يرجى إدخال اسم أو رمز العملة' });
    }
    
    const enhancedPumpScanner = require('./enhanced-pump-scanner');
    const results = await enhancedPumpScanner.searchToken(query);
    
    res.json({
      success: true,
      results,
      count: results.length,
      query: query
    });
  } catch (error) {
    console.error('Search Pump Token API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Admin Endpoints (Owner Only)
app.post('/api/admin/users', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const users = await db.getAllUsersForAdmin();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin Users API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/admin/ban-user', async (req, res) => {
  try {
    const { target_user_id, reason, duration, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    await db.banUser(target_user_id, reason, authenticatedUserId, duration);
    res.json({ success: true, message: 'تم حظر المستخدم بنجاح' });
  } catch (error) {
    console.error('Ban User API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/admin/unban-user', async (req, res) => {
  try {
    const { target_user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    await db.unbanUser(target_user_id);
    res.json({ success: true, message: 'تم إلغاء حظر المستخدم بنجاح' });
  } catch (error) {
    console.error('Unban User API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const { target_user_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    await db.deleteUserAccount(target_user_id);
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('Delete User API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/admin/restrict-user', async (req, res) => {
  try {
    const { target_user_id, restrictions, duration, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    await db.restrictUser(target_user_id, restrictions, duration);
    res.json({ success: true, message: 'تم تقييد المستخدم بنجاح' });
  } catch (error) {
    console.error('Restrict User API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/admin/banned-users', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const bannedUsers = await db.getBannedUsers();
    res.json({ success: true, users: bannedUsers });
  } catch (error) {
    console.error('Banned Users API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// الإحصائيات الشاملة للإدارة
app.post('/api/admin/stats', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const users = await db.getAllUsers();
    const analysts = await db.getAllAnalysts();
    const transactions = await db.getAllTransactions(1000);
    const pendingWithdrawals = await db.getPendingWithdrawals();
    
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const activeUsersToday = users.filter(u => {
      return u.last_active && new Date(u.last_active) >= today;
    }).length;
    
    const activeUsersWeek = users.filter(u => {
      return u.last_active && new Date(u.last_active) >= weekAgo;
    }).length;
    
    const totalBalance = users.reduce((sum, u) => sum + (parseFloat(u.balance) || 0), 0);
    
    const activeSubscriptions = users.filter(u => {
      return u.subscription_expires && new Date(u.subscription_expires) > new Date();
    }).length;
    
    const totalReferralEarnings = users.reduce((sum, u) => sum + (parseFloat(u.referral_earnings) || 0), 0);
    
    const stats = {
      total_users: users.length,
      active_users_today: activeUsersToday,
      active_users_week: activeUsersWeek,
      total_balance: totalBalance.toFixed(2),
      total_subscriptions: activeSubscriptions,
      total_analysts: analysts.length,
      total_transactions: transactions.length,
      total_withdrawals_pending: pendingWithdrawals.length,
      total_referral_earnings: totalReferralEarnings.toFixed(2)
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Admin Stats API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// إحصائيات متقدمة شاملة للإدارة
app.post('/api/admin/advanced-stats', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const users = await db.getAllUsers();
    const analysts = await db.getAllAnalysts();
    const allTransactions = await db.getAllTransactions(10000);
    const allWithdrawals = await db.getDB().collection('withdrawal_requests').find({}).toArray();
    const analystSubscriptions = await db.getDB().collection('analyst_subscriptions').find({}).toArray();
    
    // حساب الأرباح من اشتراكات البوت
    const botSubscriptionRevenue = allTransactions
      .filter(t => t.type === 'subscription' && t.status === 'completed')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    // حساب الأرباح من المحللين (نسبة المالك من اشتراكات المحللين)
    const analystRevenue = analystSubscriptions
      .filter(s => s.payment_distribution && s.payment_distribution.owner_share)
      .reduce((sum, s) => sum + (parseFloat(s.payment_distribution.owner_share) || 0), 0);
    
    // إجمالي الإيداعات
    const totalDeposits = allTransactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    // طلبات السحب بحسب الحالة
    const withdrawalStats = {
      pending: allWithdrawals.filter(w => w.status === 'pending').length,
      approved: allWithdrawals.filter(w => w.status === 'approved').length,
      completed: allWithdrawals.filter(w => w.status === 'completed').length,
      rejected: allWithdrawals.filter(w => w.status === 'rejected').length,
      failed: allWithdrawals.filter(w => w.status === 'failed').length,
      total_pending_amount: allWithdrawals
        .filter(w => w.status === 'pending')
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0),
      total_completed_amount: allWithdrawals
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)
    };
    
    // حالة قاعدة البيانات
    const dbStats = {
      total_users: users.length,
      total_analysts: analysts.length,
      total_transactions: allTransactions.length,
      total_withdrawals: allWithdrawals.length,
      total_analyst_subscriptions: analystSubscriptions.length,
      active_analyst_subscriptions: analystSubscriptions.filter(s => 
        s.status === 'active' && new Date(s.end_date) > new Date()
      ).length
    };
    
    // معلومات النظام
    const systemInfo = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
      platform: process.platform
    };
    
    // المحللين الأكثر ربحية
    const analystEarnings = await db.getDB().collection('analyst_subscriptions').aggregate([
      {
        $match: {
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$analyst_id',
          total_revenue: { $sum: '$amount' },
          total_subscribers: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'analysts',
          localField: '_id',
          foreignField: '_id',
          as: 'analyst'
        }
      },
      { $unwind: '$analyst' },
      {
        $project: {
          analyst_name: '$analyst.name',
          total_revenue: 1,
          total_subscribers: 1
        }
      },
      { $sort: { total_revenue: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    // إحصائيات الإحالات
    const referralStats = {
      total_referral_earnings: users.reduce((sum, u) => sum + (parseFloat(u.referral_earnings) || 0), 0),
      total_users_with_referrals: users.filter(u => u.referred_by).length,
      top_referrers: users
        .map(u => ({
          user_id: u.user_id,
          name: u.first_name,
          earnings: u.referral_earnings || 0,
          referrals_count: users.filter(r => r.referred_by === u.user_id).length
        }))
        .filter(u => u.referrals_count > 0)
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 10)
    };
    
    const advancedStats = {
      revenue: {
        bot_subscriptions: botSubscriptionRevenue.toFixed(2),
        analyst_commissions: analystRevenue.toFixed(2),
        total_revenue: (botSubscriptionRevenue + analystRevenue).toFixed(2),
        total_deposits: totalDeposits.toFixed(2)
      },
      withdrawals: withdrawalStats,
      database: dbStats,
      system: systemInfo,
      top_analysts: analystEarnings,
      referrals: referralStats
    };
    
    res.json({ success: true, stats: advancedStats });
  } catch (error) {
    console.error('Advanced Admin Stats API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// تنظيف قاعدة البيانات
app.post('/api/admin/db-cleanup', async (req, res) => {
  try {
    const { init_data, action } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const database = db.getDB();
    const results = {};
    
    if (action === 'stats') {
      // عرض إحصائيات قاعدة البيانات
      const collections = ['users', 'transactions', 'withdrawal_requests', 'analysts', 'analyst_subscriptions', 'referrals'];
      const stats = {};
      
      for (const collName of collections) {
        const count = await database.collection(collName).countDocuments();
        const collStats = await database.collection(collName).stats();
        stats[collName] = {
          count,
          size: (collStats.size / 1024 / 1024).toFixed(2) + ' MB'
        };
      }
      
      // تفاصيل إضافية
      const testUsers = await database.collection('users').countDocuments({ 
        balance: 0, 
        $or: [
          { premium_until: { $exists: false } },
          { premium_until: null },
          { premium_until: { $lt: new Date() } }
        ]
      });
      
      const oldTransactions = await database.collection('transactions').countDocuments({ 
        created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      });
      
      const oldCompletedWithdrawals = await database.collection('withdrawal_requests').countDocuments({ 
        status: 'completed',
        updated_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      
      results.stats = stats;
      results.details = {
        test_users: testUsers,
        old_transactions: oldTransactions,
        old_completed_withdrawals: oldCompletedWithdrawals
      };
    }
    
    if (action === 'delete_test_data') {
      // حذف المستخدمين الفارغين (اختبار)
      const deleteUsers = await database.collection('users').deleteMany({ 
        balance: 0,
        $or: [
          { premium_until: { $exists: false } },
          { premium_until: null },
          { premium_until: { $lt: new Date() } }
        ]
      });
      
      // حذف المعاملات القديمة (+30 يوم)
      const deleteTransactions = await database.collection('transactions').deleteMany({ 
        created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      });
      
      results.deleted = {
        users: deleteUsers.deletedCount,
        transactions: deleteTransactions.deletedCount
      };
    }
    
    if (action === 'delete_old_withdrawals') {
      // حذف السحوبات المكتملة القديمة (+30 يوم)
      const deleteWithdrawals = await database.collection('withdrawal_requests').deleteMany({ 
        status: 'completed',
        updated_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
      
      results.deleted_withdrawals = deleteWithdrawals.deletedCount;
    }
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('DB Cleanup Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// إدارة المحللين
app.post('/api/admin/analysts', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const analysts = await db.getDB().collection('analysts').aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          user_id: 1,
          name: 1,
          description: 1,
          monthly_price: 1,
          total_subscribers: 1,
          is_active: 1,
          created_at: 1,
          username: '$user.username',
          first_name: '$user.first_name',
          balance: '$user.balance'
        }
      },
      { $sort: { total_subscribers: -1 } }
    ]).toArray();
    
    res.json({ success: true, analysts });
  } catch (error) {
    console.error('Admin Analysts API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// طلبات السحب
app.post('/api/admin/withdrawals', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const withdrawals = await db.getPendingWithdrawals();
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('Admin Withdrawals API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// الموافقة على طلب السحب
app.post('/api/admin/approve-withdrawal', async (req, res) => {
  try {
    const { withdrawal_id, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const { ObjectId } = require('mongodb');
    const withdrawal = await db.getDB().collection('withdrawal_requests').findOne({
      _id: new ObjectId(withdrawal_id)
    });
    
    if (!withdrawal) {
      return res.json({ success: false, error: 'طلب السحب غير موجود' });
    }
    
    await db.approveWithdrawal(withdrawal_id);
    await db.createTransaction(
      withdrawal.user_id,
      'withdrawal',
      withdrawal.amount,
      null,
      withdrawal.wallet_address,
      'completed'
    );
    
    safeSendMessage(bot, withdrawal.user_id, `
✅ <b>تم الموافقة على طلب السحب!</b>

💸 المبلغ: ${withdrawal.amount} USDT
📍 العنوان: <code>${withdrawal.wallet_address}</code>

سيتم تحويل المبلغ خلال 24 ساعة
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying user:', err));
    
    res.json({ success: true, message: 'تم الموافقة على طلب السحب' });
  } catch (error) {
    console.error('Approve Withdrawal API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// رفض طلب السحب
app.post('/api/admin/reject-withdrawal', async (req, res) => {
  try {
    const { withdrawal_id, reason, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const { ObjectId } = require('mongodb');
    const withdrawal = await db.getDB().collection('withdrawal_requests').findOne({
      _id: new ObjectId(withdrawal_id)
    });
    
    if (!withdrawal) {
      return res.json({ success: false, error: 'طلب السحب غير موجود' });
    }
    
    await db.getDB().collection('withdrawal_requests').updateOne(
      { _id: new ObjectId(withdrawal_id) },
      { $set: { status: 'rejected', processed_at: new Date(), rejection_reason: reason || 'تم الرفض' } }
    );
    
    await db.updateUserBalance(withdrawal.user_id, withdrawal.amount);
    
    safeSendMessage(bot, withdrawal.user_id, `
❌ <b>تم رفض طلب السحب</b>

💸 المبلغ: ${withdrawal.amount} USDT
السبب: ${reason || 'لم يتم تحديد السبب'}

تم إرجاع المبلغ إلى محفظتك
`, { parse_mode: 'HTML' }).catch(err => console.error('Error notifying user:', err));
    
    res.json({ success: true, message: 'تم رفض طلب السحب' });
  } catch (error) {
    console.error('Reject Withdrawal API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// المعاملات
app.post('/api/admin/transactions', async (req, res) => {
  try {
    const { type_filter, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    let transactions = await db.getAllTransactions(100);
    
    if (type_filter && type_filter !== 'all') {
      transactions = transactions.filter(t => t.type === type_filter);
    }
    
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Admin Transactions API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// أفضل المحيلين
app.post('/api/admin/top-referrers', async (req, res) => {
  try {
    const { init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    const users = await db.getAllUsers();
    const topReferrers = [];
    
    for (const user of users) {
      const stats = await db.getReferralStats(user.user_id);
      if (stats.total_referrals > 0 || stats.total_earnings > 0) {
        topReferrers.push({
          user_id: user.user_id,
          first_name: user.first_name,
          username: user.username,
          total_referrals: stats.total_referrals,
          total_earnings: stats.total_earnings
        });
      }
    }
    
    topReferrers.sort((a, b) => b.total_earnings - a.total_earnings);
    
    res.json({ success: true, referrers: topReferrers.slice(0, 20) });
  } catch (error) {
    console.error('Admin Top Referrers API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// إرسال رسالة جماعية
app.post('/api/admin/broadcast', async (req, res) => {
  try {
    const { message, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    if (!message || message.trim().length === 0) {
      return res.json({ success: false, error: 'الرسالة فارغة' });
    }
    
    const users = await db.getAllUsers();
    let successCount = 0;
    let failCount = 0;
    
    for (const user of users) {
      try {
        await safeSendMessage(bot, user.user_id, message, { parse_mode: 'HTML' });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to send to ${user.user_id}:`, error.message);
        failCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `تم إرسال الرسالة إلى ${successCount} مستخدم. فشل ${failCount} مستخدم`,
      success_count: successCount,
      fail_count: failCount
    });
  } catch (error) {
    console.error('Admin Broadcast API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// البحث عن مستخدم
app.post('/api/admin/search', async (req, res) => {
  try {
    const { query, init_data } = req.body;
    
    if (!verifyTelegramWebAppData(init_data)) {
      return res.json({ success: false, error: 'Unauthorized: Invalid Telegram data' });
    }
    
    const authenticatedUserId = getUserIdFromInitData(init_data);
    if (!authenticatedUserId || authenticatedUserId !== config.OWNER_ID) {
      return res.json({ success: false, error: 'Unauthorized: Admin only' });
    }
    
    if (!query || query.trim().length === 0) {
      return res.json({ success: false, error: 'يرجى إدخال معرف المستخدم أو الاسم' });
    }
    
    let user = null;
    
    if (!isNaN(query)) {
      user = await db.getUser(parseInt(query));
    } else {
      const users = await db.getAllUsers();
      user = users.find(u => 
        u.username && u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.first_name && u.first_name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    if (!user) {
      return res.json({ success: false, error: 'المستخدم غير موجود' });
    }
    
    const transactions = await db.getUserTransactions(user.user_id);
    const referralStats = await db.getReferralStats(user.user_id);
    const analyst = await db.getAnalystByUserId(user.user_id);
    const subscriptions = await db.getAllUserAnalystSubscriptions(user.user_id);
    
    res.json({ 
      success: true, 
      user: {
        ...user,
        transactions,
        referral_stats: referralStats,
        analyst,
        subscriptions
      }
    });
  } catch (error) {
    console.error('Admin Search API Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Customer Support API - Groq Integration (Free AI)
app.post('/api/customer-support', async (req, res) => {
  if (!groq) {
    return res.status(503).json({ 
      error: 'خدمة العملاء غير متاحة حالياً. يرجى المحاولة لاحقاً.',
      error_en: 'Customer support is currently unavailable. Please try again later.' 
    });
  }

  try {
    const { message, language = 'ar' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `أنت مساعد خدمة العملاء الذكي لمشروع OBENTCHI Trading Bot. 

مهمتك:
- الرد فقط على الأسئلة عن مشروع OBENTCHI بدقة تامة
- شرح الميزات والخدمات بشكل احترافي وواضح ومفصل
- حل المشاكل التقنية للمستخدمين
- الرد بلغة ${language === 'ar' ? 'عربية' : language === 'en' ? 'English' : language === 'fr' ? 'français' : language === 'es' ? 'español' : language === 'de' ? 'Deutsch' : language === 'ru' ? 'русский' : '中文'}

═══════════════════════════════════════════════════════
📊 OBENTCHI TRADING BOT - معلومات شاملة ودقيقة
═══════════════════════════════════════════════════════

🎯 نظرة عامة:
- بوت تداول احترافي على Telegram مع تطبيق ويب متكامل
- تحليل فني متقدم للعملات الرقمية، الفوركس، الأسهم، السلع، المؤشرات
- نظام ذكاء اصطناعي مجاني (Groq AI) لخدمة العملاء
- دعم 7 لغات: عربي، إنجليزي، فرنسي، إسباني، ألماني، روسي، صيني

📈 تغطية الأصول (1455+ أصل):
- 300+ عملة رقمية (من OKX)
- 400+ زوج فوركس
- 140+ سهم عالمي (أمريكي، أوروبي، آسيوي، شرق أوسطي)
- 40+ سلعة (معادن ثمينة، طاقة، زراعة)
- 50+ مؤشر عالمي

💎 أنواع التحليل:
1. Complete Analysis: تحليل كامل باستخدام جميع المؤشرات الفنية (RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Stochastic, ADX, Volume, Fibonacci, أنماط الشموع)

2. Ultra Analysis: تحليل عالي الدقة
   - يتطلب 75%+ اتفاق بين المؤشرات
   - مع ADX قوي >35 يتطلب 85%+ اتفاق
   - ثقة عالية جداً 85%+
   - حجم تداول كبير
   - حساب دقيق لـ Stop Loss و Take Profit
   - نسبة مخاطرة/مكافأة متوازنة

3. Zero Reversal Analysis: الأكثر صرامة - "100% ضمان"
   - يتطلب 93%+ من المعايير (38/41 نقطة)
   - ADX >= 45 (اتجاه قوي جداً)
   - نسبة مخاطرة/مكافأة >= 1:4
   - حجم تداول ضخم
   - اتجاه واضح 100%
   - تأكيدات متعددة
   - احتمال انعكاس 0%
   - تصنيف المخاطرة: "منخفضة جداً"

4. Fibonacci Analysis: مستويات فيبوناتشي الديناميكية للدعم والمقاومة

5. Pump Analysis: خاص بالعملات الرقمية فقط
   - يحلل احتمالية ارتفاع سريع 100%+
   - يتتبع نشاط الحيتان (Whale Activity)
   - يستخدم بيانات من DexScreener, GeckoTerminal, Birdeye
   - يحلل: ارتفاع الحجم، أنماط التماسك، الزخم، الاختراقات

💰 الأسعار والرسوم الدقيقة:
- الاشتراك الشهري: 10 USDT
- اشتراك Pump Analysis: 5 USDT شهرياً
- اشتراك المحلل: 20 USDT شهرياً (يمكن للمحلل تعديله)
- رسوم السحب: 1 USDT لكل عملية سحب
- الحد الأدنى للإيداع: 1 USDT
- الحد الأقصى للسحب: 1000 USDT لكل عملية
- تجربة مجانية: 7 أيام للمستخدمين الجدد

💳 نظام المحفظة (USDT TRC20):
- عنوان المحفظة: TCZwoWnmi8uBssqjtKGmUwAjToAxcJkjLP
- شبكة TRON (TRC20)
- إيداع تلقائي مع تحقق فوري من المعاملات
- منع المعاملات المكررة
- سحب تلقائي آمن عبر OKX API
- يتطلب موافقة المالك على السحب
- إشعارات فورية للإيداع والسحب

👥 نظام الإحالة:
- إحالة مستخدمين: 10% عمولة على مدفوعاتهم
- إحالة محللين: 20% عمولة على اشتراكات المستخدمين
- مروج المحلل: 15% عمولة عند إحالة مستخدمين لصفحة المحلل

📊 نظام المحللين:
- يمكن لأي مستخدم أن يصبح محلل
- ينشر المحلل إشارات التداول للمشتركين
- نظام أرباح مع Escrow (حساب ضمان)
- الأرباح تُصرف يومياً/شهرياً
- نظام تصنيف وتقييم
- مراقبة النشاط: تعليق تلقائي بعد 3 أيام عدم نشر
- استرجاع نسبي للمشتركين عند الإلغاء

🔔 نظام الإشعارات:
- فحص تلقائي كل 15 دقيقة لجميع الأسواق
- إشعارات فرص التداول القوية (70%+ اتفاق المؤشرات)
- قابل للتخصيص حسب السوق (عملات، فوركس، أسهم، سلع، مؤشرات)
- تذكير انتهاء الاشتراك (3 أيام، يوم واحد، يوم الانتهاء)
- تنبيهات فرص Pump للعملات الرقمية
- إشعارات إدارية للنشاط المشبوه

🛡️ الأمان:
- تشفير HMAC-SHA256 للطلبات
- التحقق من توقيع Telegram WebApp
- تنقية المدخلات لمنع XSS
- تحديد المعدل: 60 طلب/دقيقة/مستخدم
- رؤوس أمان شاملة
- جميع المفاتيح في متغيرات البيئة

🎨 الميزات الإضافية:
- تطبيق ويب Telegram احترافي متجاوب
- لوحة تحكم شاملة للمشرفين
- إرسال رسائل جماعية
- إحصائيات وتحليلات مفصلة
- تتبع المعاملات الكامل
- دعم متعدد اللغات كامل

القواعد المهمة:
- قدم معلومات دقيقة 100% فقط من المعلومات أعلاه
- إذا سُئلت عن شيء خارج OBENTCHI، اعتذر بأدب ووجه للسؤال عن المشروع
- كن مفيداً، مهذباً، ودقيقاً
- أجب بتفاصيل واضحة ومختصرة
- لا تخترع معلومات - استخدم فقط ما هو موجود أعلاه`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('Customer support error:', error);
    res.status(500).json({ error: 'فشل في الحصول على رد' });
  }
});

// ========== Enhanced Monitoring Endpoints ==========
app.get('/health', async (req, res) => {
  try {
    monitor.incrementRequest();
    const health = await monitor.getSystemHealth();
    res.json(health);
  } catch (error) {
    monitor.incrementError();
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    monitor.incrementRequest();
    const metrics = await monitor.getDetailedMetrics();
    res.json(metrics);
  } catch (error) {
    monitor.incrementError();
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// معالج 404 لـ API endpoints - يجب أن يكون قبل SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.error(`❌ API endpoint not found: ${req.method} ${req.path}`);
    return res.status(404).json({ 
      success: false, 
      error: 'endpoint_not_found',
      message: 'API endpoint not found',
      path: req.path,
      method: req.method
    });
  }
  next();
});

// SPA fallback - يخدم index.html لجميع المسارات غير API
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/health') && !req.path.startsWith('/ping') && !req.path.startsWith('/metrics')) {
    res.sendFile(__dirname + '/public/index.html');
  } else {
    next();
  }
});

// معالج أخطاء عام
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // التأكد من إرجاع JSON للـ API requests
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'حدث خطأ داخلي'
    });
  }
  
  // للـ requests الأخرى، إرجاع صفحة خطأ
  res.status(500).send('حدث خطأ في الخادم');
});

main();
