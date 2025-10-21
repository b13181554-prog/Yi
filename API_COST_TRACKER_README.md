# 📊 API Cost Tracker - نظام تتبع وتحسين تكاليف API

نظام شامل لمراقبة وتحليل وتحسين تكاليف استدعاءات API الخارجية في مشروع OBENTCHI Trading Bot.

## 🎯 الأهداف

- مراقبة جميع استدعاءات API الخارجية في الوقت الفعلي
- حساب التكاليف بدقة لكل API
- تقديم توصيات ذكية لتحسين التكاليف
- تتبع معدلات الاستخدام والأخطاء
- توفير dashboard شامل للإدارة

## 🏗️ البنية المعمارية

### Multi-Layer Storage
- **In-Memory Storage**: للبيانات الحية (Real-time)
- **Redis**: للإحصائيات المجمعة (Hourly/Daily/Monthly)
- **MongoDB** (اختياري): للبيانات التاريخية

### Components
- **API Registry**: قاعدة بيانات شاملة لـ 27 API مع pricing models
- **Tracking System**: نظام تتبع آلي لكل API call
- **Analytics Engine**: محرك تحليل متقدم
- **Optimization Engine**: محرك توصيات ذكي
- **Dashboard API**: 6 endpoints للإدارة

## 📋 API Registry

النظام يتتبع 27 API موزعة على الفئات التالية:

### Cryptocurrency APIs (11)
- CoinGecko, CoinPaprika
- OKX, Binance, Bybit
- Gate.io, Kraken, Coinbase
- Huobi, Crypto.com, Bitfinex

### DEX APIs (3)
- DexScreener
- GeckoTerminal
- Birdeye

### Forex/Stock APIs (7)
- TwelveData, Yahoo Finance, Alpha Vantage
- ExchangeRate-API, Frankfurter
- FloatRates, VATComply, CurrencyFreaks

### Blockchain APIs (3)
- TRON Network
- Etherscan
- BscScan

### Other Services (3)
- Groq API (AI)
- Telegram Bot API
- CryptAPI (Payment)
- Whale Alert

## 🚀 Usage

### 1. Manual Tracking

```javascript
const { trackAPICall } = require('./api-cost-tracker');

const startTime = Date.now();
try {
  const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: { ids: 'bitcoin', vs_currencies: 'usd' }
  });
  
  await trackAPICall('CoinGecko', '/api/v3/simple/price', {
    status: 'success',
    responseTime: Date.now() - startTime,
    userId: 12345,
    cacheHit: false,
    dataSize: JSON.stringify(response.data).length
  });
} catch (error) {
  await trackAPICall('CoinGecko', '/api/v3/simple/price', {
    status: 'error',
    responseTime: Date.now() - startTime,
    userId: 12345
  });
}
```

### 2. Wrapped Function (موصى به)

```javascript
const { wrapAPICall } = require('./api-cost-tracker');

async function getCoinPrice(coinId) {
  return wrapAPICall('CoinGecko', '/api/v3/simple/price', async () => {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: coinId, vs_currencies: 'usd' }
    });
    return response.data;
  }, { userId: 12345 });
}
```

### 3. Get Statistics

```javascript
const { getCostStats, getAPIBreakdown, getOptimizationSuggestions } = require('./api-cost-tracker');

// إحصائيات اليوم
const todayStats = await getCostStats('today');
console.log('Total Cost:', todayStats.totalCost);
console.log('Cache Hit Rate:', todayStats.cacheHitRate);

// تحليل حسب API
const breakdown = await getAPIBreakdown();
console.log('Top 5 Expensive APIs:', breakdown.slice(0, 5));

// توصيات التحسين
const suggestions = await getOptimizationSuggestions();
console.log('Optimization Suggestions:', suggestions);
```

## 🌐 Dashboard API Endpoints

### 1. Complete Dashboard
```bash
GET /api/admin/costs
```
Returns: Complete dashboard with all metrics, trends, and suggestions

### 2. Period Statistics
```bash
GET /api/admin/costs/stats/:period
# period: hour | today | week | month
```
Returns: Detailed stats for specified period

### 3. API Breakdown
```bash
GET /api/admin/costs/breakdown
```
Returns: Cost breakdown by API with error rates and cache metrics

### 4. Optimization Suggestions
```bash
GET /api/admin/costs/suggestions
```
Returns: Smart optimization recommendations

### 5. Export Report
```bash
GET /api/admin/costs/export/:format/:period
# format: json | csv
# period: hour | today | week | month
```
Returns: Exportable report in JSON or CSV format

### 6. Configure Alerts
```bash
POST /api/admin/costs/alerts
Body: {
  "hourlyBudget": 10,
  "dailyBudget": 100,
  "monthlyBudget": 1000,
  "perAPILimit": 50,
  "enabled": true
}
```
Returns: Updated alert configuration

## 📊 Dashboard Data Structure

```json
{
  "timestamp": 1234567890,
  "periods": {
    "hour": { "totalCalls": 150, "totalCost": 0.015, ... },
    "today": { "totalCalls": 2500, "totalCost": 0.25, ... },
    "week": { ... },
    "month": { ... }
  },
  "breakdown": {
    "byAPI": [...],
    "byCategory": {...},
    "topCalls": [...]
  },
  "trends": {
    "hourly": [...]
  },
  "optimization": {
    "suggestions": [...],
    "potentialSavings": 15.50,
    "cacheSavings": 5.25
  },
  "alerts": {...},
  "registry": {
    "totalAPIs": 27,
    "byCategory": {...}
  }
}
```

## 🎨 Optimization Suggestions Types

النظام يقدم 5 أنواع من التوصيات:

### 1. Caching
- اكتشاف APIs ذات cache hit rate منخفض
- اقتراح زيادة TTL
- حساب التوفير المتوقع

### 2. Alternative APIs
- اقتراح APIs بديلة أرخص
- مقارنة التكاليف
- قائمة بالبدائل المتاحة

### 3. Reliability
- اكتشاف APIs ذات error rate عالي
- اقتراح circuit breaker
- اقتراح fallback strategies

### 4. Performance
- اكتشاف APIs بطيئة
- اقتراح timeouts مناسبة
- اقتراح بدائل أسرع

### 5. Batching
- اكتشاف طلبات متكررة يمكن دمجها
- اقتراح batch requests
- حساب التوفير المتوقع

## 🔔 Alert System

النظام يراقب ويرسل تنبيهات عند:
- تجاوز الميزانية الساعية
- تجاوز الميزانية اليومية
- تجاوز حد التكلفة لكل API
- معدل أخطاء عالي
- استجابة بطيئة

## 📈 Metrics Tracked

لكل API call، النظام يتتبع:
- **Basic Metrics**: API name, endpoint, timestamp
- **Performance**: Response time, status (success/error)
- **Cost**: Estimated cost based on pricing model
- **User**: User ID (if applicable)
- **Cache**: Cache hit/miss status
- **Data**: Response data size

## 🛠️ Technical Details

### Storage Strategy
- **Hourly data**: Kept for 48 hours
- **Daily data**: Kept for 30 days
- **Monthly data**: Kept for 90 days
- **In-memory cleanup**: Every hour

### Redis Keys Structure
```
api_costs:hour:{timestamp}
api_costs:day:{timestamp}
api_costs:month:{timestamp}
api_costs:api:{apiName}
api_costs:endpoint:{apiName}:{endpoint}
api_costs:user:{userId}
```

### Performance
- **Thread-safe**: Using Redis pipelines
- **Memory efficient**: Rolling windows with automatic cleanup
- **Fast queries**: In-memory cache for hot data
- **Scalable**: Redis-based distributed storage

## 📝 Example Integration

```javascript
// في market-data.js

const { wrapAPICall } = require('./api-cost-tracker');

class MarketDataService {
  async getPriceFromCoinGecko(symbol) {
    return wrapAPICall('CoinGecko', '/api/v3/simple/price', async () => {
      const coinId = this.symbolToCoinId(symbol);
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: coinId, vs_currencies: 'usd' }
      });
      return response.data[coinId]?.usd;
    });
  }
}
```

## 🎯 Benefits

1. **Cost Visibility**: معرفة دقيقة بتكاليف كل API
2. **Optimization**: توصيات ذكية لتقليل التكاليف
3. **Reliability**: مراقبة معدلات الأخطاء
4. **Performance**: تحديد APIs البطيئة
5. **Cache Efficiency**: تحسين استخدام الـ cache
6. **Budget Control**: تنبيهات عند تجاوز الميزانية
7. **Data-Driven Decisions**: قرارات مبنية على بيانات حقيقية

## 🚦 Quick Start

1. النظام يبدأ تلقائياً مع المشروع
2. لا حاجة لإعدادات إضافية
3. استخدم `wrapAPICall` لتتبع الاستدعاءات
4. افتح `/api/admin/costs` لرؤية Dashboard
5. راجع التوصيات بشكل دوري

## 📊 Example Dashboard Request

```bash
curl http://localhost:5000/api/admin/costs | jq

# Get today's stats
curl http://localhost:5000/api/admin/costs/stats/today

# Export as CSV
curl http://localhost:5000/api/admin/costs/export/csv/week > report.csv

# Set alerts
curl -X POST http://localhost:5000/api/admin/costs/alerts \
  -H "Content-Type: application/json" \
  -d '{"hourlyBudget": 5, "dailyBudget": 50, "enabled": true}'
```

## 🔧 Advanced Features

### Custom Pricing Models
يمكن تعديل pricing models في `apiRegistry` داخل `api-cost-tracker.js`

### MongoDB Integration (Optional)
لحفظ البيانات التاريخية لفترات طويلة، يمكن إضافة MongoDB integration

### Custom Alerts
يمكن توسيع نظام التنبيهات لإرسال notifications عبر Telegram أو Email

## 📚 Files

- **api-cost-tracker.js**: الملف الرئيسي للنظام
- **api-cost-tracker-example.js**: أمثلة استخدام عملية
- **API_COST_TRACKER_README.md**: هذا الملف

## ✅ Success Metrics

النظام تم بناؤه بنجاح مع:
- ✅ 27 API مع pricing models كاملة
- ✅ نظام tracking شامل
- ✅ 6 dashboard endpoints
- ✅ 5 أنواع من optimization suggestions
- ✅ Multi-layer storage (Memory + Redis)
- ✅ Alert system قابل للتخصيص
- ✅ Export reports (JSON/CSV)
- ✅ Integration examples واضحة

---

**Built with ❤️ for OBENTCHI Trading Bot**
