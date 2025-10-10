const axios = require('axios');

class AssetsManager {
  constructor() {
    this.cryptoAssets = [];
    this.forexPairs = [];
    this.stocks = [];
    this.commodities = [];
    this.indices = [];
    this.lastUpdate = null;
  }

  // جلب جميع العملات الرقمية من OKX
  async fetchAllCryptoFromOKX() {
    try {
      console.log('🔄 جلب جميع العملات الرقمية من OKX...');
      const response = await axios.get('https://www.okx.com/api/v5/public/instruments', {
        params: { instType: 'SPOT' },
        timeout: 15000
      });

      if (response.data && response.data.data) {
        const instruments = response.data.data;
        
        // فلترة العملات التي تنتهي بـ USDT
        const usdtPairs = instruments
          .filter(inst => inst.instId && inst.instId.endsWith('-USDT'))
          .map(inst => ({
            symbol: inst.instId.replace('-', ''),
            baseCcy: inst.baseCcy,
            quoteCcy: inst.quoteCcy,
            label: `${this.getCryptoEmoji(inst.baseCcy)} ${inst.baseCcy}`
          }));

        console.log(`✅ تم جلب ${usdtPairs.length} عملة رقمية من OKX`);
        return usdtPairs;
      }
      
      return [];
    } catch (error) {
      console.error('❌ خطأ في جلب العملات من OKX:', error.message);
      return [];
    }
  }

  // جلب جميع العملات الرقمية من Binance كبديل
  async fetchAllCryptoFromBinance() {
    try {
      console.log('🔄 جلب جميع العملات الرقمية من Binance...');
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo', {
        timeout: 15000
      });

      if (response.data && response.data.symbols) {
        const symbols = response.data.symbols;
        
        // فلترة العملات التي تنتهي بـ USDT وحالتها TRADING
        const usdtPairs = symbols
          .filter(sym => sym.symbol.endsWith('USDT') && sym.status === 'TRADING')
          .map(sym => ({
            symbol: sym.symbol,
            baseCcy: sym.baseAsset,
            quoteCcy: sym.quoteAsset,
            label: `${this.getCryptoEmoji(sym.baseAsset)} ${sym.baseAsset}`
          }));

        console.log(`✅ تم جلب ${usdtPairs.length} عملة رقمية من Binance`);
        return usdtPairs;
      }
      
      return [];
    } catch (error) {
      console.error('❌ خطأ في جلب العملات من Binance:', error.message);
      return [];
    }
  }

  // جلب جميع العملات الرقمية من Bybit
  async fetchAllCryptoFromBybit() {
    try {
      console.log('🔄 جلب جميع العملات الرقمية من Bybit...');
      const response = await axios.get('https://api.bybit.com/v5/market/instruments-info', {
        params: { category: 'spot' },
        timeout: 15000
      });

      if (response.data && response.data.result && response.data.result.list) {
        const instruments = response.data.result.list;
        
        // فلترة العملات التي تنتهي بـ USDT
        const usdtPairs = instruments
          .filter(inst => inst.symbol && inst.symbol.endsWith('USDT') && inst.status === 'Trading')
          .map(inst => ({
            symbol: inst.symbol,
            baseCcy: inst.baseCoin,
            quoteCcy: inst.quoteCoin,
            label: `${this.getCryptoEmoji(inst.baseCoin)} ${inst.baseCoin}`
          }));

        console.log(`✅ تم جلب ${usdtPairs.length} عملة رقمية من Bybit`);
        return usdtPairs;
      }
      
      return [];
    } catch (error) {
      console.error('❌ خطأ في جلب العملات من Bybit:', error.message);
      return [];
    }
  }

  // دمج جميع العملات الرقمية من جميع المصادر
  async getAllCryptoAssets() {
    try {
      const [okxAssets, binanceAssets, bybitAssets] = await Promise.all([
        this.fetchAllCryptoFromOKX(),
        this.fetchAllCryptoFromBinance(),
        this.fetchAllCryptoFromBybit()
      ]);

      // دمج جميع الأصول وإزالة المكرر
      const allAssets = [...okxAssets, ...binanceAssets, ...bybitAssets];
      const uniqueAssets = new Map();

      for (const asset of allAssets) {
        if (!uniqueAssets.has(asset.symbol)) {
          uniqueAssets.set(asset.symbol, asset);
        }
      }

      this.cryptoAssets = Array.from(uniqueAssets.values())
        .sort((a, b) => a.baseCcy.localeCompare(b.baseCcy));

      console.log(`✅ إجمالي العملات الرقمية الفريدة: ${this.cryptoAssets.length}`);
      return this.cryptoAssets;
    } catch (error) {
      console.error('❌ خطأ في دمج العملات الرقمية:', error.message);
      return [];
    }
  }

  // إنشاء جميع أزواج الفوركس
  generateAllForexPairs() {
    const majorCurrencies = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];
    const minorCurrencies = ['NOK', 'SEK', 'DKK', 'PLN', 'HUF', 'CZK', 'TRY', 'ZAR', 'MXN', 'SGD', 'HKD', 'THB', 'INR', 'CNY', 'KRW', 'BRL', 'RUB'];
    const allCurrencies = [...majorCurrencies, ...minorCurrencies];
    
    const pairs = [];
    const flags = {
      'EUR': '🇪🇺', 'GBP': '🇬🇧', 'USD': '🇺🇸', 'JPY': '🇯🇵',
      'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CHF': '🇨🇭',
      'NOK': '🇳🇴', 'SEK': '🇸🇪', 'DKK': '🇩🇰', 'PLN': '🇵🇱',
      'HUF': '🇭🇺', 'CZK': '🇨🇿', 'TRY': '🇹🇷', 'ZAR': '🇿🇦',
      'MXN': '🇲🇽', 'SGD': '🇸🇬', 'HKD': '🇭🇰', 'THB': '🇹🇭',
      'INR': '🇮🇳', 'CNY': '🇨🇳', 'KRW': '🇰🇷', 'BRL': '🇧🇷', 'RUB': '🇷🇺'
    };

    for (let i = 0; i < allCurrencies.length; i++) {
      for (let j = 0; j < allCurrencies.length; j++) {
        if (i !== j) {
          const base = allCurrencies[i];
          const quote = allCurrencies[j];
          const pair = base + quote;
          
          pairs.push({
            value: pair,
            label: `${flags[base] || '🌐'} ${base}/${quote} ${flags[quote] || '🌐'}`
          });
        }
      }
    }

    this.forexPairs = pairs;
    console.log(`✅ تم إنشاء ${this.forexPairs.length} زوج فوركس`);
    return this.forexPairs;
  }

  // قائمة موسعة للأسهم العالمية
  getAllStocks() {
    this.stocks = [
      // الأسهم الأمريكية - التكنولوجيا
      { value: 'AAPL', label: '🍎 Apple Inc.', market: 'US Tech' },
      { value: 'MSFT', label: '🪟 Microsoft', market: 'US Tech' },
      { value: 'GOOGL', label: '🔍 Google (Alphabet)', market: 'US Tech' },
      { value: 'GOOG', label: '🔍 Google Class C', market: 'US Tech' },
      { value: 'AMZN', label: '📦 Amazon', market: 'US Tech' },
      { value: 'META', label: '📘 Meta (Facebook)', market: 'US Tech' },
      { value: 'NVDA', label: '💚 NVIDIA', market: 'US Tech' },
      { value: 'TSLA', label: '🚗 Tesla', market: 'US Tech' },
      { value: 'AMD', label: '🔴 AMD', market: 'US Tech' },
      { value: 'INTC', label: '💻 Intel', market: 'US Tech' },
      { value: 'NFLX', label: '🎬 Netflix', market: 'US Tech' },
      { value: 'ADBE', label: '📊 Adobe', market: 'US Tech' },
      { value: 'CRM', label: '☁️ Salesforce', market: 'US Tech' },
      { value: 'ORCL', label: '💾 Oracle', market: 'US Tech' },
      { value: 'CSCO', label: '🌐 Cisco', market: 'US Tech' },
      { value: 'AVGO', label: '💡 Broadcom', market: 'US Tech' },
      { value: 'QCOM', label: '📱 Qualcomm', market: 'US Tech' },
      { value: 'TXN', label: '🔌 Texas Instruments', market: 'US Tech' },
      { value: 'IBM', label: '💻 IBM', market: 'US Tech' },
      
      // الأسهم الأمريكية - المالية
      { value: 'JPM', label: '🏦 JPMorgan Chase', market: 'US Finance' },
      { value: 'BAC', label: '🏦 Bank of America', market: 'US Finance' },
      { value: 'WFC', label: '🏦 Wells Fargo', market: 'US Finance' },
      { value: 'C', label: '🏦 Citigroup', market: 'US Finance' },
      { value: 'GS', label: '🏦 Goldman Sachs', market: 'US Finance' },
      { value: 'MS', label: '🏦 Morgan Stanley', market: 'US Finance' },
      { value: 'V', label: '💳 Visa', market: 'US Finance' },
      { value: 'MA', label: '💳 Mastercard', market: 'US Finance' },
      { value: 'PYPL', label: '💰 PayPal', market: 'US Finance' },
      { value: 'BLK', label: '💼 BlackRock', market: 'US Finance' },
      { value: 'SCHW', label: '💹 Charles Schwab', market: 'US Finance' },
      { value: 'AXP', label: '💳 American Express', market: 'US Finance' },
      
      // الأسهم الأمريكية - الصحة والأدوية
      { value: 'JNJ', label: '💊 Johnson & Johnson', market: 'US Healthcare' },
      { value: 'UNH', label: '🏥 UnitedHealth', market: 'US Healthcare' },
      { value: 'PFE', label: '💊 Pfizer', market: 'US Healthcare' },
      { value: 'ABBV', label: '💊 AbbVie', market: 'US Healthcare' },
      { value: 'TMO', label: '🔬 Thermo Fisher', market: 'US Healthcare' },
      { value: 'MRK', label: '💊 Merck', market: 'US Healthcare' },
      { value: 'ABT', label: '💊 Abbott', market: 'US Healthcare' },
      { value: 'LLY', label: '💊 Eli Lilly', market: 'US Healthcare' },
      { value: 'BMY', label: '💊 Bristol Myers', market: 'US Healthcare' },
      { value: 'AMGN', label: '💊 Amgen', market: 'US Healthcare' },
      
      // الأسهم الأمريكية - الاستهلاك
      { value: 'WMT', label: '🛒 Walmart', market: 'US Consumer' },
      { value: 'HD', label: '🔨 Home Depot', market: 'US Consumer' },
      { value: 'MCD', label: '🍔 McDonald\'s', market: 'US Consumer' },
      { value: 'NKE', label: '👟 Nike', market: 'US Consumer' },
      { value: 'SBUX', label: '☕ Starbucks', market: 'US Consumer' },
      { value: 'TGT', label: '🎯 Target', market: 'US Consumer' },
      { value: 'LOW', label: '🏠 Lowe\'s', market: 'US Consumer' },
      { value: 'KO', label: '🥤 Coca-Cola', market: 'US Consumer' },
      { value: 'PEP', label: '🥤 PepsiCo', market: 'US Consumer' },
      { value: 'PG', label: '🧴 Procter & Gamble', market: 'US Consumer' },
      { value: 'DIS', label: '🎬 Disney', market: 'US Consumer' },
      { value: 'CMCSA', label: '📺 Comcast', market: 'US Consumer' },
      
      // الأسهم الأمريكية - الطاقة والصناعة
      { value: 'XOM', label: '🛢️ Exxon Mobil', market: 'US Energy' },
      { value: 'CVX', label: '🛢️ Chevron', market: 'US Energy' },
      { value: 'COP', label: '🛢️ ConocoPhillips', market: 'US Energy' },
      { value: 'SLB', label: '🛢️ Schlumberger', market: 'US Energy' },
      { value: 'BA', label: '✈️ Boeing', market: 'US Industrial' },
      { value: 'CAT', label: '🚜 Caterpillar', market: 'US Industrial' },
      { value: 'GE', label: '⚡ General Electric', market: 'US Industrial' },
      { value: 'MMM', label: '🏭 3M', market: 'US Industrial' },
      { value: 'HON', label: '🏭 Honeywell', market: 'US Industrial' },
      { value: 'UPS', label: '📦 UPS', market: 'US Industrial' },
      { value: 'FDX', label: '📦 FedEx', market: 'US Industrial' },
      
      // الأسهم الأمريكية - السيارات والنقل
      { value: 'F', label: '🚗 Ford', market: 'US Auto' },
      { value: 'GM', label: '🚗 General Motors', market: 'US Auto' },
      { value: 'UBER', label: '🚗 Uber', market: 'US Tech' },
      { value: 'LYFT', label: '🚗 Lyft', market: 'US Tech' },
      
      // الأسهم الأمريكية - العقارات والاتصالات
      { value: 'T', label: '📱 AT&T', market: 'US Telecom' },
      { value: 'VZ', label: '📱 Verizon', market: 'US Telecom' },
      { value: 'TMUS', label: '📱 T-Mobile', market: 'US Telecom' },
      
      // التكنولوجيا الحديثة والتواصل الاجتماعي
      { value: 'COIN', label: '💰 Coinbase', market: 'US Crypto' },
      { value: 'SQ', label: '💳 Block (Square)', market: 'US Fintech' },
      { value: 'SHOP', label: '🛒 Shopify', market: 'US Tech' },
      { value: 'SPOT', label: '🎵 Spotify', market: 'US Tech' },
      { value: 'SNAP', label: '👻 Snap Inc.', market: 'US Tech' },
      { value: 'TWTR', label: '🐦 Twitter (X)', market: 'US Tech' },
      { value: 'PINS', label: '📌 Pinterest', market: 'US Tech' },
      { value: 'ROKU', label: '📺 Roku', market: 'US Tech' },
      { value: 'ZM', label: '📹 Zoom', market: 'US Tech' },
      { value: 'DOCU', label: '📄 DocuSign', market: 'US Tech' },
      { value: 'ABNB', label: '🏠 Airbnb', market: 'US Tech' },
      
      // الأسهم الآسيوية
      { value: 'BABA', label: '🛒 Alibaba (China)', market: 'China' },
      { value: 'TSM', label: '💻 Taiwan Semi', market: 'Taiwan' },
      { value: '9988.HK', label: '🛒 Alibaba HK', market: 'Hong Kong' },
      { value: '0700.HK', label: '🎮 Tencent', market: 'Hong Kong' },
      { value: 'JD', label: '🛒 JD.com', market: 'China' },
      { value: 'BIDU', label: '🔍 Baidu', market: 'China' },
      { value: 'NIO', label: '🚗 NIO', market: 'China' },
      { value: 'XPEV', label: '🚗 XPeng', market: 'China' },
      { value: 'LI', label: '🚗 Li Auto', market: 'China' },
      { value: 'PDD', label: '🛒 Pinduoduo', market: 'China' },
      { value: 'SONY', label: '🎮 Sony', market: 'Japan' },
      { value: '7203.T', label: '🚗 Toyota', market: 'Japan' },
      { value: '9984.T', label: '📱 SoftBank', market: 'Japan' },
      { value: 'SMSN.IL', label: '📱 Samsung', market: 'Korea' },
      
      // الأسهم الأوروبية
      { value: 'ASML', label: '💻 ASML (Netherlands)', market: 'Europe' },
      { value: 'SAP', label: '💻 SAP (Germany)', market: 'Europe' },
      { value: 'NESN.SW', label: '🍫 Nestle (Swiss)', market: 'Europe' },
      { value: 'NOVN.SW', label: '💊 Novartis (Swiss)', market: 'Europe' },
      { value: 'ROG.SW', label: '💊 Roche (Swiss)', market: 'Europe' },
      { value: 'MC.PA', label: '👜 LVMH (France)', market: 'Europe' },
      { value: 'OR.PA', label: '💄 L\'Oreal (France)', market: 'Europe' },
      { value: 'SAN.PA', label: '🍾 Sanofi (France)', market: 'Europe' },
      { value: 'VOW.DE', label: '🚗 Volkswagen', market: 'Germany' },
      { value: 'SIE.DE', label: '⚡ Siemens', market: 'Germany' },
      { value: 'DTE.DE', label: '📱 Deutsche Telekom', market: 'Germany' },
      { value: 'SHEL', label: '🛢️ Shell', market: 'UK' },
      { value: 'BP', label: '🛢️ BP', market: 'UK' },
      { value: 'HSBC', label: '🏦 HSBC', market: 'UK' },
      { value: 'ULVR', label: '🧴 Unilever', market: 'UK' },
      
      // الأسهم الخليجية والعربية
      { value: '2222.SR', label: '🛢️ أرامكو السعودية', market: 'Saudi' },
      { value: '1120.SR', label: '🏦 الراجحي', market: 'Saudi' },
      { value: '1180.SR', label: '📞 STC السعودية', market: 'Saudi' },
      { value: '2010.SR', label: '🏭 سابك', market: 'Saudi' },
      { value: 'ADNOCDIST.AD', label: '🛢️ أدنوك للتوزيع', market: 'UAE' },
      { value: 'FAB.AD', label: '🏦 بنك أبوظبي الأول', market: 'UAE' },
      { value: 'ADIB.AD', label: '🏦 أبوظبي الإسلامي', market: 'UAE' },
      { value: 'DIB.DU', label: '🏦 دبي الإسلامي', market: 'UAE' },
      { value: 'EMAAR.DU', label: '🏗️ إعمار', market: 'UAE' },
      { value: 'COMI.QA', label: '🏦 QNB قطر', market: 'Qatar' },
      { value: 'ERES.QA', label: '🏗️ Ezdan قطر', market: 'Qatar' },
    ];

    console.log(`✅ قائمة الأسهم: ${this.stocks.length} سهم عالمي`);
    return this.stocks;
  }

  // قائمة موسعة للسلع
  getAllCommodities() {
    this.commodities = [
      // المعادن الثمينة
      { value: 'XAUUSD', label: '🥇 Gold (الذهب)', category: 'Precious Metals' },
      { value: 'XAGUSD', label: '🥈 Silver (الفضة)', category: 'Precious Metals' },
      { value: 'XPTUSD', label: '⚪ Platinum (البلاتين)', category: 'Precious Metals' },
      { value: 'XPDUSD', label: '⚫ Palladium (البلاديوم)', category: 'Precious Metals' },
      { value: 'XRHUSD', label: '💎 Rhodium (الروديوم)', category: 'Precious Metals' },
      
      // الطاقة
      { value: 'WTIUSD', label: '🛢️ WTI Crude Oil (النفط الخام)', category: 'Energy' },
      { value: 'BCOUSD', label: '🛢️ Brent Crude Oil (برنت)', category: 'Energy' },
      { value: 'NGAS', label: '🔥 Natural Gas (الغاز الطبيعي)', category: 'Energy' },
      { value: 'USOIL', label: '🛢️ US Oil', category: 'Energy' },
      { value: 'UKOIL', label: '🛢️ UK Oil', category: 'Energy' },
      { value: 'GASOIL', label: '⛽ Heating Oil', category: 'Energy' },
      { value: 'RBOB', label: '⛽ Gasoline RBOB', category: 'Energy' },
      
      // المعادن الصناعية
      { value: 'COPPER', label: '🟤 Copper (النحاس)', category: 'Industrial Metals' },
      { value: 'ZINC', label: '⚪ Zinc (الزنك)', category: 'Industrial Metals' },
      { value: 'NICKEL', label: '⚪ Nickel (النيكل)', category: 'Industrial Metals' },
      { value: 'ALUMINUM', label: '⚪ Aluminum (الألومنيوم)', category: 'Industrial Metals' },
      { value: 'LEAD', label: '⚫ Lead (الرصاص)', category: 'Industrial Metals' },
      { value: 'TIN', label: '⚪ Tin (القصدير)', category: 'Industrial Metals' },
      { value: 'IRON', label: '🔴 Iron Ore (خام الحديد)', category: 'Industrial Metals' },
      { value: 'STEEL', label: '🔩 Steel (الصلب)', category: 'Industrial Metals' },
      
      // المحاصيل الزراعية - الحبوب
      { value: 'WHEAT', label: '🌾 Wheat (القمح)', category: 'Grains' },
      { value: 'CORN', label: '🌽 Corn (الذرة)', category: 'Grains' },
      { value: 'SOYBEAN', label: '🫘 Soybean (فول الصويا)', category: 'Grains' },
      { value: 'RICE', label: '🍚 Rice (الأرز)', category: 'Grains' },
      { value: 'OATS', label: '🌾 Oats (الشوفان)', category: 'Grains' },
      { value: 'BARLEY', label: '🌾 Barley (الشعير)', category: 'Grains' },
      
      // المنتجات الغذائية الأخرى
      { value: 'SUGAR', label: '🍬 Sugar (السكر)', category: 'Soft Commodities' },
      { value: 'COFFEE', label: '☕ Coffee (القهوة)', category: 'Soft Commodities' },
      { value: 'COCOA', label: '🍫 Cocoa (الكاكاو)', category: 'Soft Commodities' },
      { value: 'COTTON', label: '🧵 Cotton (القطن)', category: 'Soft Commodities' },
      { value: 'ORANGE', label: '🍊 Orange Juice (عصير البرتقال)', category: 'Soft Commodities' },
      { value: 'LUMBER', label: '🪵 Lumber (الأخشاب)', category: 'Soft Commodities' },
      
      // الماشية
      { value: 'CATTLE', label: '🐄 Live Cattle (الماشية الحية)', category: 'Livestock' },
      { value: 'HOGS', label: '🐷 Lean Hogs (الخنازير)', category: 'Livestock' },
      
      // أخرى
      { value: 'RUBBER', label: '⚫ Rubber (المطاط)', category: 'Other' },
      { value: 'PALM', label: '🌴 Palm Oil (زيت النخيل)', category: 'Other' },
      { value: 'WOOL', label: '🐑 Wool (الصوف)', category: 'Other' }
    ];

    console.log(`✅ قائمة السلع: ${this.commodities.length} سلعة`);
    return this.commodities;
  }

  // قائمة موسعة للمؤشرات
  getAllIndices() {
    this.indices = [
      // المؤشرات الأمريكية
      { value: 'US30', label: '🇺🇸 Dow Jones Industrial (US30)', region: 'USA' },
      { value: 'SPX500', label: '🇺🇸 S&P 500 (SPX500)', region: 'USA' },
      { value: 'NAS100', label: '🇺🇸 NASDAQ 100 (NAS100)', region: 'USA' },
      { value: 'US500', label: '🇺🇸 S&P 500', region: 'USA' },
      { value: 'DJ30', label: '🇺🇸 Dow Jones 30', region: 'USA' },
      { value: 'RUSSELL', label: '🇺🇸 Russell 2000', region: 'USA' },
      { value: 'VIX', label: '🇺🇸 VIX (مؤشر الخوف)', region: 'USA' },
      
      // المؤشرات الأوروبية
      { value: 'UK100', label: '🇬🇧 FTSE 100', region: 'UK' },
      { value: 'GER40', label: '🇩🇪 DAX 40 (Germany)', region: 'Germany' },
      { value: 'FRA40', label: '🇫🇷 CAC 40 (France)', region: 'France' },
      { value: 'ESP35', label: '🇪🇸 IBEX 35 (Spain)', region: 'Spain' },
      { value: 'ITA40', label: '🇮🇹 FTSE MIB (Italy)', region: 'Italy' },
      { value: 'SWI20', label: '🇨🇭 SMI 20 (Switzerland)', region: 'Switzerland' },
      { value: 'NLD25', label: '🇳🇱 AEX 25 (Netherlands)', region: 'Netherlands' },
      { value: 'STOXX50', label: '🇪🇺 Euro Stoxx 50', region: 'Europe' },
      { value: 'BEL20', label: '🇧🇪 BEL 20 (Belgium)', region: 'Belgium' },
      { value: 'AUT20', label: '🇦🇹 ATX (Austria)', region: 'Austria' },
      { value: 'POR20', label: '🇵🇹 PSI 20 (Portugal)', region: 'Portugal' },
      
      // المؤشرات الآسيوية
      { value: 'JPN225', label: '🇯🇵 Nikkei 225 (Japan)', region: 'Japan' },
      { value: 'HK50', label: '🇭🇰 Hang Seng (Hong Kong)', region: 'Hong Kong' },
      { value: 'CHN50', label: '🇨🇳 China A50', region: 'China' },
      { value: 'AUS200', label: '🇦🇺 ASX 200 (Australia)', region: 'Australia' },
      { value: 'IND50', label: '🇮🇳 Nifty 50 (India)', region: 'India' },
      { value: 'KOR200', label: '🇰🇷 KOSPI 200 (Korea)', region: 'Korea' },
      { value: 'SGP30', label: '🇸🇬 STI (Singapore)', region: 'Singapore' },
      { value: 'TWN', label: '🇹🇼 TAIEX (Taiwan)', region: 'Taiwan' },
      { value: 'THA50', label: '🇹🇭 SET 50 (Thailand)', region: 'Thailand' },
      { value: 'IDN', label: '🇮🇩 IDX (Indonesia)', region: 'Indonesia' },
      { value: 'MYS', label: '🇲🇾 KLCI (Malaysia)', region: 'Malaysia' },
      { value: 'PHL', label: '🇵🇭 PSEi (Philippines)', region: 'Philippines' },
      
      // المؤشرات الأفريقية والشرق الأوسط
      { value: 'SAF40', label: '🇿🇦 FTSE/JSE Top 40 (S. Africa)', region: 'South Africa' },
      { value: 'EGY30', label: '🇪🇬 EGX 30 (Egypt)', region: 'Egypt' },
      { value: 'ISR35', label: '🇮🇱 TA-35 (Israel)', region: 'Israel' },
      { value: 'SAU', label: '🇸🇦 TASI (Saudi Arabia)', region: 'Saudi Arabia' },
      { value: 'UAE', label: '🇦🇪 ADX (UAE)', region: 'UAE' },
      { value: 'QAT', label: '🇶🇦 QE Index (Qatar)', region: 'Qatar' },
      { value: 'KWT', label: '🇰🇼 Kuwait (Kuwait)', region: 'Kuwait' },
      
      // المؤشرات الأمريكية اللاتينية
      { value: 'BRA60', label: '🇧🇷 Bovespa (Brazil)', region: 'Brazil' },
      { value: 'MEX35', label: '🇲🇽 IPC Mexico', region: 'Mexico' },
      { value: 'ARG', label: '🇦🇷 MERVAL (Argentina)', region: 'Argentina' },
      { value: 'CHL', label: '🇨🇱 IPSA (Chile)', region: 'Chile' },
      { value: 'COL', label: '🇨🇴 COLCAP (Colombia)', region: 'Colombia' },
      
      // المؤشرات الأخرى
      { value: 'RUS50', label: '🇷🇺 MOEX Russia', region: 'Russia' },
      { value: 'TUR30', label: '🇹🇷 BIST 30 (Turkey)', region: 'Turkey' },
      { value: 'NOR25', label: '🇳🇴 OBX (Norway)', region: 'Norway' },
      { value: 'SWE30', label: '🇸🇪 OMX 30 (Sweden)', region: 'Sweden' },
      { value: 'DEN25', label: '🇩🇰 OMX Copenhagen', region: 'Denmark' },
      { value: 'FIN25', label: '🇫🇮 OMX Helsinki', region: 'Finland' }
    ];

    console.log(`✅ قائمة المؤشرات: ${this.indices.length} مؤشر عالمي`);
    return this.indices;
  }

  // تحديث جميع الأصول
  async updateAllAssets() {
    console.log('🔄 بدء تحديث جميع الأصول...');
    
    await this.getAllCryptoAssets();
    this.generateAllForexPairs();
    this.getAllStocks();
    this.getAllCommodities();
    this.getAllIndices();
    
    this.lastUpdate = new Date();
    
    console.log('✅ تم تحديث جميع الأصول بنجاح');
    console.log(`📊 الإحصائيات:`);
    console.log(`   - العملات الرقمية: ${this.cryptoAssets.length}`);
    console.log(`   - الفوركس: ${this.forexPairs.length}`);
    console.log(`   - الأسهم: ${this.stocks.length}`);
    console.log(`   - السلع: ${this.commodities.length}`);
    console.log(`   - المؤشرات: ${this.indices.length}`);
    console.log(`   - المجموع: ${this.cryptoAssets.length + this.forexPairs.length + this.stocks.length + this.commodities.length + this.indices.length}`);
    
    return {
      crypto: this.cryptoAssets,
      forex: this.forexPairs,
      stocks: this.stocks,
      commodities: this.commodities,
      indices: this.indices,
      lastUpdate: this.lastUpdate
    };
  }

  // الحصول على Emoji للعملات الرقمية
  getCryptoEmoji(symbol) {
    const emojiMap = {
      'BTC': '💰', 'ETH': '💎', 'BNB': '🟡', 'XRP': '💧', 'ADA': '🔷',
      'DOGE': '🐕', 'SOL': '🟣', 'DOT': '🔴', 'MATIC': '🟪', 'LTC': '🔵',
      'AVAX': '🔺', 'LINK': '🔗', 'UNI': '🦄', 'ATOM': '⚛️', 'XLM': '🌟',
      'SHIB': '🐕', 'TRX': '⭕', 'TON': '💎', 'NEAR': '🌈', 'APT': '🟢',
      'ARB': '🔵', 'OP': '🔴', 'SUI': '💧', 'INJ': '⚡', 'PEPE': '🐸',
      'FLOKI': '🐕', 'WIF': '🐶', 'BONK': '🐕', 'SEI': '🔺', 'TIA': '🌌',
      'JUP': '🪐', 'PYTH': '🔮', 'STRK': '⚡', 'ENA': '🌐', 'NOT': '🎵',
      'KAS': '👻', 'TAO': '🧬', 'BEAM': '💫', 'AI': '🤖'
    };
    
    return emojiMap[symbol] || '💹';
  }
}

module.exports = new AssetsManager();
