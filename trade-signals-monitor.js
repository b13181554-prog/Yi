const cron = require('node-cron');
const db = require('./database');
const marketData = require('./market-data');
const TechnicalAnalysis = require('./analysis');
const UltraAnalysis = require('./ultra-analysis');
const config = require('./config');

let botInstance = null;
let isMonitoring = false;

const CRYPTO_SIGNALS_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
  'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'INJUSDT', 'SEIUSDT',
  'TIAUSDT', 'JUPUSDT', 'WIFUSDT', 'BONKUSDT', 'PEPEUSDT'
];

const FOREX_SIGNALS_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
  'NZDUSD', 'USDCHF', 'EURJPY', 'GBPJPY', 'EURGBP'
];

const STOCKS_SIGNALS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
  'META', 'NVDA', 'AMD', 'NFLX'
];

const COMMODITIES_SIGNALS = [
  'XAUUSD', 'XAGUSD', 'WTIUSD', 'BCOUSD'
];

const INDICES_SIGNALS = [
  'US30', 'SPX500', 'NAS100', 'UK100', 'GER40'
];

function initTradeSignalsMonitor(bot) {
  botInstance = bot;
  console.log('🔍 Trade Signals Monitor initialized');
  
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
  
  await Promise.all([
    scanCryptoMarket(signals),
    scanForexMarket(signals),
    scanStocksMarket(signals),
    scanCommoditiesMarket(signals),
    scanIndicesMarket(signals)
  ]);
  
  if (signals.length > 0) {
    console.log(`✅ Found ${signals.length} strong signals`);
    await notifyUsers(signals);
  } else {
    console.log('ℹ️ No strong signals found in this scan');
  }
}

async function scanCryptoMarket(signals) {
  for (const symbol of CRYPTO_SIGNALS_SYMBOLS) {
    try {
      const candles = await marketData.getCryptoCandles(symbol, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const analysis = new TechnicalAnalysis(candles);
      const ultraAnalysis = new UltraAnalysis(analysis, candles);
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

async function scanForexMarket(signals) {
  for (const pair of FOREX_SIGNALS_PAIRS) {
    try {
      const candles = await marketData.getForexCandles(pair, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const analysis = new TechnicalAnalysis(candles);
      const ultraAnalysis = new UltraAnalysis(analysis, candles);
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

async function scanStocksMarket(signals) {
  for (const stock of STOCKS_SIGNALS) {
    try {
      const candles = await marketData.getStockCandles(stock, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const analysis = new TechnicalAnalysis(candles);
      const ultraAnalysis = new UltraAnalysis(analysis, candles);
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

async function scanCommoditiesMarket(signals) {
  for (const commodity of COMMODITIES_SIGNALS) {
    try {
      const candles = await marketData.getCommodityCandles(commodity, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const analysis = new TechnicalAnalysis(candles);
      const ultraAnalysis = new UltraAnalysis(analysis, candles);
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

async function scanIndicesMarket(signals) {
  for (const index of INDICES_SIGNALS) {
    try {
      const candles = await marketData.getIndexCandles(index, '1h', 100);
      if (!candles || candles.length < 50) continue;
      
      const analysis = new TechnicalAnalysis(candles);
      const ultraAnalysis = new UltraAnalysis(analysis, candles);
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
