const cron = require('node-cron');
const db = require('./database');
const marketData = require('./market-data');
const TechnicalAnalysis = require('./analysis');
const UltraAnalysis = require('./ultra-analysis');
const config = require('./config');
const assetsManager = require('./assets-manager');

let botInstance = null;
let isMonitoring = false;

function initTradeSignalsMonitor(bot) {
  botInstance = bot;
  console.log('🔍 Trade Signals Monitor initialized');
  
  // البحث المباشر: لا نحتاج لتحميل جميع الأصول عند البداية
  // سيتم جلب الأصول عند الحاجة فقط لتوفير الذاكرة وتحسين الأداء
  console.log('✅ البحث المباشر مُفعّل - الأصول تُجلب عند الطلب');
  
  cron.schedule('*/15 * * * *', async () => {
    if (!isMonitoring) {
      isMonitoring = true;
      try {
        await scanAllMarkets();
      } catch (error) {
        console.error('❌ Error in trade signals monitor:', error);
      } finally {
        isMonitoring = false;
      }
    }
  });
  
  console.log('✅ Trade Signals Monitor scheduled to run every 15 minutes');
}

async function scanAllMarkets() {
  console.log('🔍 Scanning all markets for strong signals...');
  
  const signals = [];
  
  // تحميل الأصول فقط إذا كانت فارغة (عند أول مرة)
  if (!assetsManager.lastUpdate || assetsManager.forexPairs.length === 0) {
    console.log('📦 تحميل الأصول للمرة الأولى...');
    await assetsManager.updateAllAssets();
  }
  
  // جلب العملات الرقمية بناءً على معايير ذكية (حجم تداول، تقلب، زخم)
  const allCryptoStats = await marketData.getAllCryptoStats();
  const cryptoSample = marketData.getSmartCryptoSelection(allCryptoStats, 50);
  
  // الأسواق الأخرى تبقى بعينة عشوائية (أقل أهمية)
  const forexSample = getRandomSample(assetsManager.forexPairs.map(a => a.value), 30);
  const stocksSample = getRandomSample(assetsManager.stocks.map(a => a.value), 40);
  const commoditiesSample = getRandomSample(assetsManager.commodities.map(a => a.value), 20);
  const indicesSample = getRandomSample(assetsManager.indices.map(a => a.value), 20);
  
  await Promise.all([
    scanCryptoMarket(signals, cryptoSample),
    scanForexMarket(signals, forexSample),
    scanStocksMarket(signals, stocksSample),
    scanCommoditiesMarket(signals, commoditiesSample),
    scanIndicesMarket(signals, indicesSample)
  ]);
  
  if (signals.length > 0) {
    console.log(`✅ Found ${signals.length} strong signals`);
    await notifyUsers(signals);
  } else {
    console.log('ℹ️ No strong signals found in this scan');
  }
}

function getRandomSample(array, size) {
  if (!array || array.length === 0) return [];
  if (array.length <= size) return array;
  
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

async function scanCryptoMarket(signals, symbols) {
  if (!symbols || symbols.length === 0) return;
  
  for (const symbol of symbols) {
    try {
      const candles = await marketData.getCandles(symbol, '1h', 100, 'crypto');
      if (!candles || candles.length < 50) continue;
      
      const ultraAnalysis = new UltraAnalysis(candles);
      const recommendation = ultraAnalysis.getUltraRecommendation('crypto', 'spot', '1h');
      
      if (isStrongSignal(recommendation)) {
        signals.push({
          market: 'crypto',
          symbol: symbol,
          recommendation: recommendation,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error.message);
    }
  }
}

async function scanForexMarket(signals, pairs) {
  if (!pairs || pairs.length === 0) return;
  
  const forexService = require('./forex-service');
  
  for (const pair of pairs) {
    try {
      const candles = await forexService.getCandles(pair, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const ultraAnalysis = new UltraAnalysis(candles);
      const recommendation = ultraAnalysis.getUltraRecommendation('forex', 'spot', '1h');
      
      if (isStrongSignal(recommendation)) {
        signals.push({
          market: 'forex',
          symbol: pair,
          recommendation: recommendation,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${pair}:`, error.message);
    }
  }
}

async function scanStocksMarket(signals, stocks) {
  if (!stocks || stocks.length === 0) return;
  
  for (const stock of stocks) {
    try {
      const candles = await marketData.getCandles(stock, '1h', 100, 'stocks');
      if (!candles || candles.length < 50) continue;
      
      const ultraAnalysis = new UltraAnalysis(candles);
      const recommendation = ultraAnalysis.getUltraRecommendation('stocks', 'spot', '1h');
      
      if (isStrongSignal(recommendation)) {
        signals.push({
          market: 'stocks',
          symbol: stock,
          recommendation: recommendation,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${stock}:`, error.message);
    }
  }
}

async function scanCommoditiesMarket(signals, commodities) {
  if (!commodities || commodities.length === 0) return;
  
  for (const commodity of commodities) {
    try {
      const candles = await marketData.getCandles(commodity, '1h', 100, 'commodities');
      if (!candles || candles.length < 50) continue;
      
      const ultraAnalysis = new UltraAnalysis(candles);
      const recommendation = ultraAnalysis.getUltraRecommendation('commodities', 'spot', '1h');
      
      if (isStrongSignal(recommendation)) {
        signals.push({
          market: 'commodities',
          symbol: commodity,
          recommendation: recommendation,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${commodity}:`, error.message);
    }
  }
}

async function scanIndicesMarket(signals, indices) {
  if (!indices || indices.length === 0) return;
  
  for (const index of indices) {
    try {
      const candles = await marketData.getCandles(index, '1h', 100, 'indices');
      if (!candles || candles.length < 50) continue;
      
      const ultraAnalysis = new UltraAnalysis(candles);
      const recommendation = ultraAnalysis.getUltraRecommendation('indices', 'spot', '1h');
      
      if (isStrongSignal(recommendation)) {
        signals.push({
          market: 'indices',
          symbol: index,
          recommendation: recommendation,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${index}:`, error.message);
    }
  }
}

function isStrongSignal(recommendation) {
  if (!recommendation || !recommendation.recommendation) return false;
  
  const rec = recommendation.recommendation;
  const confidence = recommendation.confidence_level || '';
  
  if (rec === 'WAIT' || rec === 'محايد') return false;
  
  const highConfidence = confidence.includes('Ultra High') || 
                         confidence.includes('عالية جداً') ||
                         confidence.includes('100%') ||
                         confidence.includes('High') ||
                         confidence.includes('عالية');
  
  const strongSignal = (rec === 'BUY' || rec === 'شراء' || rec === 'SELL' || rec === 'بيع');
  
  return highConfidence && strongSignal;
}

async function notifyUsers(signals) {
  try {
    const users = await db.getAllUsers();
    
    for (const user of users) {
      if (!user.notifications_enabled) continue;
      
      const userMarkets = user.notification_markets || ['crypto', 'forex', 'stocks', 'commodities', 'indices'];
      
      for (const signal of signals) {
        if (!userMarkets.includes(signal.market)) continue;
        
        const message = formatSignalMessage(signal);
        
        try {
          await botInstance.sendMessage(user.user_id, message, { parse_mode: 'HTML' });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to notify user ${user.user_id}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying users:', error);
  }
}

function formatSignalMessage(signal) {
  const rec = signal.recommendation;
  const marketEmojis = {
    'crypto': '💰',
    'forex': '💱',
    'stocks': '📈',
    'commodities': '🥇',
    'indices': '📊'
  };
  
  const marketNames = {
    'crypto': 'العملات الرقمية',
    'forex': 'الفوركس',
    'stocks': 'الأسهم',
    'commodities': 'السلع',
    'indices': 'المؤشرات'
  };
  
  const actionEmoji = (rec.recommendation === 'BUY' || rec.recommendation === 'شراء') ? '🟢' : '🔴';
  const action = (rec.recommendation === 'BUY' || rec.recommendation === 'شراء') ? 'شراء' : 'بيع';
  
  return `
🔔 <b>إشعار صفقة قوية!</b>

${marketEmojis[signal.market]} <b>السوق:</b> ${marketNames[signal.market]}
💹 <b>الرمز:</b> ${signal.symbol}

${actionEmoji} <b>التوصية:</b> ${action}
⭐ <b>مستوى الثقة:</b> ${rec.confidence_level || 'عالي'}

📊 <b>تفاصيل الصفقة:</b>
💵 السعر الحالي: ${rec.current_price}
🎯 الهدف: ${rec.target_price || 'N/A'}
🛡️ وقف الخسارة: ${rec.stop_loss || 'N/A'}

📈 <b>الأسباب:</b>
${rec.reasons ? rec.reasons.slice(0, 3).map(r => `• ${r}`).join('\n') : 'إشارة قوية من التحليل الفني'}

⏰ <b>الإطار الزمني:</b> 1 ساعة
🕐 <b>الوقت:</b> ${new Date().toLocaleString('ar')}

⚠️ <b>تنبيه:</b> تداول بمسؤولية وإدارة المخاطر
`;
}

module.exports = {
  initTradeSignalsMonitor,
  scanAllMarkets
};
