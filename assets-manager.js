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
    // حذف العملات النادرة جداً التي لا تعمل بشكل جيد (HUF, CZK)
    const minorCurrencies = ['NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR', 'MXN', 'SGD', 'HKD', 'THB', 'INR', 'CNY', 'KRW', 'BRL', 'RUB'];
    const allCurrencies = [...majorCurrencies, ...minorCurrencies];
    
    const pairs = [];
    const flags = {
      'EUR': '🇪🇺', 'GBP': '🇬🇧', 'USD': '🇺🇸', 'JPY': '🇯🇵',
      'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CHF': '🇨🇭',
      'NOK': '🇳🇴', 'SEK': '🇸🇪', 'DKK': '🇩🇰', 'PLN': '🇵🇱',
      'TRY': '🇹🇷', 'ZAR': '🇿🇦',
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
      { value: 'STLA', label: '🚗 Stellantis', market: 'US Auto' },
      { value: 'HMC', label: '🚗 Honda', market: 'Japan Auto' },
      
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
      { value: 'UBER', label: '🚕 Uber', market: 'US Tech' },
      { value: 'LYFT', label: '🚗 Lyft', market: 'US Tech' },
      { value: 'DASH', label: '🍔 DoorDash', market: 'US Tech' },
      { value: 'DKNG', label: '🎰 DraftKings', market: 'US Tech' },
      { value: 'RBLX', label: '🎮 Roblox', market: 'US Tech' },
      { value: 'U', label: '☁️ Unity Software', market: 'US Tech' },
      { value: 'NET', label: '☁️ Cloudflare', market: 'US Tech' },
      { value: 'SNOW', label: '❄️ Snowflake', market: 'US Tech' },
      { value: 'MDB', label: '🗄️ MongoDB', market: 'US Tech' },
      { value: 'DDOG', label: '🐕 Datadog', market: 'US Tech' },
      { value: 'CRWD', label: '🛡️ CrowdStrike', market: 'US Tech' },
      { value: 'ZS', label: '🔒 Zscaler', market: 'US Tech' },
      { value: 'OKTA', label: '🔐 Okta', market: 'US Tech' },
      { value: 'PLTR', label: '🔍 Palantir', market: 'US Tech' },
      { value: 'SOFI', label: '💰 SoFi', market: 'US Fintech' },
      { value: 'AFRM', label: '💳 Affirm', market: 'US Fintech' },
      { value: 'HOOD', label: '🏹 Robinhood', market: 'US Fintech' },
      { value: 'PATH', label: '💼 UiPath', market: 'US Tech' },
      { value: 'RIVN', label: '🚙 Rivian', market: 'US Auto' },
      { value: 'LCID', label: '🚗 Lucid Motors', market: 'US Auto' },
      
      // المزيد من الأسهم التقنية والناشئة
      { value: 'TWLO', label: '📞 Twilio', market: 'US Tech' },
      { value: 'GTLB', label: '🦊 GitLab', market: 'US Tech' },
      { value: 'MNDY', label: '📋 Monday.com', market: 'US Tech' },
      { value: 'FROG', label: '🐸 JFrog', market: 'US Tech' },
      { value: 'S', label: '📱 SentinelOne', market: 'US Tech' },
      { value: 'ESTC', label: '🔍 Elastic', market: 'US Tech' },
      { value: 'CFLT', label: '🌊 Confluent', market: 'US Tech' },
      { value: 'AI', label: '🤖 C3.ai', market: 'US Tech' },
      { value: 'BBAI', label: '🧠 BigBear.ai', market: 'US Tech' },
      { value: 'SOUN', label: '🎤 SoundHound AI', market: 'US Tech' },
      { value: 'SMCI', label: '💻 Super Micro', market: 'US Tech' },
      { value: 'DELL', label: '💻 Dell Technologies', market: 'US Tech' },
      { value: 'HPQ', label: '🖨️ HP Inc.', market: 'US Tech' },
      { value: 'HPE', label: '🖥️ HPE', market: 'US Tech' },
      { value: 'NTAP', label: '💾 NetApp', market: 'US Tech' },
      { value: 'STX', label: '💿 Seagate', market: 'US Tech' },
      { value: 'WDC', label: '💾 Western Digital', market: 'US Tech' },
      { value: 'PSTG', label: '📦 Pure Storage', market: 'US Tech' },
      { value: 'PANW', label: '🛡️ Palo Alto Networks', market: 'US Tech' },
      { value: 'FTNT', label: '🔒 Fortinet', market: 'US Tech' },
      { value: 'CYBR', label: '🔐 CyberArk', market: 'US Tech' },
      { value: 'TENB', label: '🔍 Tenable', market: 'US Tech' },
      { value: 'RPD', label: '🖥️ Rapid7', market: 'US Tech' },
      { value: 'VUZI', label: '🥽 Vuzix', market: 'US Tech' },
      { value: 'MVIS', label: '📽️ MicroVision', market: 'US Tech' },
      { value: 'LAZR', label: '🔦 Luminar', market: 'US Tech' },
      { value: 'LIDR', label: '📡 AEye', market: 'US Tech' },
      { value: 'OUST', label: '🎯 Ouster', market: 'US Tech' },
      { value: 'VLDR', label: '🌐 Velodyne Lidar', market: 'US Tech' },
      { value: 'IONQ', label: '⚛️ IonQ', market: 'US Tech' },
      { value: 'RGTI', label: '🔬 Rigetti Computing', market: 'US Tech' },
      { value: 'QBTS', label: '💫 D-Wave Quantum', market: 'US Tech' },
      { value: 'ARQQ', label: '⚡ Arqit Quantum', market: 'US Tech' },
      
      // أسهم الطاقة المتجددة
      { value: 'ENPH', label: '☀️ Enphase Energy', market: 'US Clean Energy' },
      { value: 'SEDG', label: '🔆 SolarEdge', market: 'US Clean Energy' },
      { value: 'RUN', label: '🌞 Sunrun', market: 'US Clean Energy' },
      { value: 'FSLR', label: '☀️ First Solar', market: 'US Clean Energy' },
      { value: 'PLUG', label: '💧 Plug Power', market: 'US Clean Energy' },
      { value: 'BE', label: '⚡ Bloom Energy', market: 'US Clean Energy' },
      { value: 'BLDP', label: '🔋 Ballard Power', market: 'US Clean Energy' },
      { value: 'FCEL', label: '🔌 FuelCell Energy', market: 'US Clean Energy' },
      { value: 'NEE', label: '💨 NextEra Energy', market: 'US Clean Energy' },
      { value: 'VWDRY', label: '💨 Vestas Wind', market: 'Europe Energy' },
      
      // أسهم التكنولوجيا الحيوية
      { value: 'MRNA', label: '💉 Moderna', market: 'US Biotech' },
      { value: 'BNTX', label: '💉 BioNTech', market: 'US Biotech' },
      { value: 'NVAX', label: '💉 Novavax', market: 'US Biotech' },
      { value: 'REGN', label: '🧬 Regeneron', market: 'US Biotech' },
      { value: 'GILD', label: '💊 Gilead Sciences', market: 'US Biotech' },
      { value: 'BIIB', label: '🧠 Biogen', market: 'US Biotech' },
      { value: 'VRTX', label: '🧬 Vertex Pharma', market: 'US Biotech' },
      { value: 'ILMN', label: '🧬 Illumina', market: 'US Biotech' },
      { value: 'EXAS', label: '🔬 Exact Sciences', market: 'US Biotech' },
      { value: 'CRSP', label: '✂️ CRISPR Therapeutics', market: 'US Biotech' },
      { value: 'EDIT', label: '🧬 Editas Medicine', market: 'US Biotech' },
      { value: 'NTLA', label: '🧬 Intellia Therapeutics', market: 'US Biotech' },
      { value: 'BEAM', label: '💫 Beam Therapeutics', market: 'US Biotech' },
      { value: 'PACB', label: '🧬 Pacific Biosciences', market: 'US Biotech' },
      { value: 'IONS', label: '🧬 Ionis Pharmaceuticals', market: 'US Biotech' },
      
      // أسهم الترفيه والألعاب
      { value: 'EA', label: '🎮 Electronic Arts', market: 'US Gaming' },
      { value: 'ATVI', label: '🎮 Activision Blizzard', market: 'US Gaming' },
      { value: 'TTWO', label: '🎮 Take-Two Interactive', market: 'US Gaming' },
      { value: 'ZNGA', label: '🎲 Zynga', market: 'US Gaming' },
      { value: 'U', label: '🎮 Unity Software', market: 'US Gaming' },
      { value: 'RBLX', label: '🎮 Roblox', market: 'US Gaming' },
      { value: 'DKNG', label: '🎰 DraftKings', market: 'US Gaming' },
      { value: 'PENN', label: '🎰 Penn Entertainment', market: 'US Gaming' },
      { value: 'LVS', label: '🎰 Las Vegas Sands', market: 'US Gaming' },
      { value: 'WYNN', label: '🎰 Wynn Resorts', market: 'US Gaming' },
      { value: 'MGM', label: '🎰 MGM Resorts', market: 'US Gaming' },
      
      // أسهم السفر والضيافة
      { value: 'BKNG', label: '✈️ Booking Holdings', market: 'US Travel' },
      { value: 'EXPE', label: '🗺️ Expedia', market: 'US Travel' },
      { value: 'TRIP', label: '🧳 TripAdvisor', market: 'US Travel' },
      { value: 'MAR', label: '🏨 Marriott', market: 'US Travel' },
      { value: 'HLT', label: '🏨 Hilton', market: 'US Travel' },
      { value: 'IHG', label: '🏨 IHG Hotels', market: 'US Travel' },
      { value: 'AAL', label: '✈️ American Airlines', market: 'US Travel' },
      { value: 'DAL', label: '✈️ Delta Airlines', market: 'US Travel' },
      { value: 'UAL', label: '✈️ United Airlines', market: 'US Travel' },
      { value: 'LUV', label: '✈️ Southwest Airlines', market: 'US Travel' },
      { value: 'JBLU', label: '✈️ JetBlue', market: 'US Travel' },
      { value: 'ALK', label: '✈️ Alaska Air', market: 'US Travel' },
      { value: 'CCL', label: '🚢 Carnival Cruise', market: 'US Travel' },
      { value: 'RCL', label: '🚢 Royal Caribbean', market: 'US Travel' },
      { value: 'NCLH', label: '🚢 Norwegian Cruise', market: 'US Travel' },
      
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
      { value: 'SE', label: '🎮 Sea Limited', market: 'Singapore' },
      { value: 'GRAB', label: '🚗 Grab Holdings', market: 'Singapore' },
      { value: 'BEKE', label: '🏠 KE Holdings', market: 'China' },
      { value: 'TME', label: '🎵 Tencent Music', market: 'China' },
      { value: 'BILI', label: '📺 Bilibili', market: 'China' },
      { value: 'IQ', label: '📺 iQIYI', market: 'China' },
      { value: 'FUTU', label: '📈 Futu Holdings', market: 'China' },
      { value: 'TIGR', label: '🐯 UP Fintech', market: 'China' },
      { value: 'VIPS', label: '🛍️ Vipshop', market: 'China' },
      { value: 'WB', label: '🔍 Weibo', market: 'China' },
      { value: 'MOMO', label: '💬 Hello Group', market: 'China' },
      { value: 'YY', label: '📹 JOYY Inc', market: 'China' },
      { value: 'DOYU', label: '🎮 DouYu', market: 'China' },
      { value: 'HUYA', label: '🎮 Huya Inc', market: 'China' },
      { value: 'ATHM', label: '🏠 Autohome', market: 'China' },
      { value: 'TOUR', label: '✈️ Tuniu', market: 'China' },
      { value: 'HTHT', label: '🏨 Huazhu Group', market: 'China' },
      { value: 'EDU', label: '📚 New Oriental', market: 'China' },
      { value: 'TAL', label: '📖 TAL Education', market: 'China' },
      { value: 'GOTU', label: '📚 Gaotu Techedu', market: 'China' },
      { value: 'RLX', label: '🚬 RLX Technology', market: 'China' },
      { value: 'YUMC', label: '🍔 Yum China', market: 'China' },
      { value: 'MNSO', label: '🛍️ Miniso Group', market: 'China' },
      { value: 'CPNG', label: '📦 Coupang', market: 'Korea' },
      { value: 'KB', label: '🏦 KB Financial', market: 'Korea' },
      { value: 'SHG', label: '🏦 Shinhan Financial', market: 'Korea' },
      { value: 'PKX', label: '⚙️ POSCO', market: 'Korea' },
      { value: 'LPL', label: '⚡ LG Chem', market: 'Korea' },
      { value: 'SKM', label: '📱 SK Telecom', market: 'Korea' },
      { value: 'KEP', label: '⚡ Korea Electric', market: 'Korea' },
      
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
      { value: 'AZN', label: '💊 AstraZeneca', market: 'UK' },
      { value: 'GSK', label: '💊 GSK', market: 'UK' },
      { value: 'DGE', label: '🍺 Diageo', market: 'UK' },
      { value: 'RIO', label: '⛏️ Rio Tinto', market: 'UK' },
      { value: 'BHP', label: '⛏️ BHP Group', market: 'UK' },
      { value: 'AAL.L', label: '⛏️ Anglo American', market: 'UK' },
      { value: 'GLEN', label: '⛏️ Glencore', market: 'UK' },
      { value: 'BARC', label: '🏦 Barclays', market: 'UK' },
      { value: 'LLOY', label: '🏦 Lloyds Banking', market: 'UK' },
      { value: 'NWG', label: '🏦 NatWest Group', market: 'UK' },
      { value: 'PRU', label: '💼 Prudential', market: 'UK' },
      { value: 'LSEG', label: '📈 London Stock Exchange', market: 'UK' },
      { value: 'RR', label: '✈️ Rolls-Royce', market: 'UK' },
      { value: 'BAE', label: '🛡️ BAE Systems', market: 'UK' },
      { value: 'VOD', label: '📱 Vodafone', market: 'UK' },
      { value: 'BT.A', label: '📞 BT Group', market: 'UK' },
      { value: 'ADS.DE', label: '👟 Adidas', market: 'Germany' },
      { value: 'BMW.DE', label: '🚗 BMW', market: 'Germany' },
      { value: 'DAI.DE', label: '🚗 Daimler', market: 'Germany' },
      { value: 'MBG.DE', label: '🚗 Mercedes-Benz', market: 'Germany' },
      { value: 'PAH3.DE', label: '🚗 Porsche', market: 'Germany' },
      { value: 'ALV.DE', label: '🏛️ Allianz', market: 'Germany' },
      { value: 'MUV2.DE', label: '🏛️ Munich Re', market: 'Germany' },
      { value: 'DB1.DE', label: '🏦 Deutsche Bank', market: 'Germany' },
      { value: 'CBK.DE', label: '🏦 Commerzbank', market: 'Germany' },
      { value: 'BAS.DE', label: '🧪 BASF', market: 'Germany' },
      { value: 'BAYN.DE', label: '💊 Bayer', market: 'Germany' },
      { value: 'LIN.DE', label: '🧪 Linde', market: 'Germany' },
      { value: 'AIR.PA', label: '✈️ Airbus', market: 'France' },
      { value: 'BN.PA', label: '🍽️ Danone', market: 'France' },
      { value: 'SU.PA', label: '🛢️ Schneider Electric', market: 'France' },
      { value: 'CA.PA', label: '🏦 Carrefour', market: 'France' },
      { value: 'BNP.PA', label: '🏦 BNP Paribas', market: 'France' },
      { value: 'ACA.PA', label: '🏦 Credit Agricole', market: 'France' },
      { value: 'GLE.PA', label: '🏦 Societe Generale', market: 'France' },
      { value: 'CS.PA', label: '💳 AXA', market: 'France' },
      { value: 'VIV.PA', label: '📱 Vivendi', market: 'France' },
      { value: 'ORA.PA', label: '📞 Orange', market: 'France' },
      { value: 'STLA', label: '🚗 Stellantis', market: 'Europe' },
      { value: 'RACE', label: '🏎️ Ferrari', market: 'Italy' },
      { value: 'STMMI', label: '💻 STMicroelectronics', market: 'Italy' },
      { value: 'UNA.AS', label: '🧴 Unilever NV', market: 'Netherlands' },
      { value: 'INGA.AS', label: '🏦 ING Group', market: 'Netherlands' },
      { value: 'PHIA.AS', label: '💡 Philips', market: 'Netherlands' },
      { value: 'ABN.AS', label: '🏦 ABN AMRO', market: 'Netherlands' },
      { value: 'NOVO-B.CO', label: '💉 Novo Nordisk', market: 'Denmark' },
      { value: 'DSV.CO', label: '📦 DSV', market: 'Denmark' },
      { value: 'CARL-B.CO', label: '🍺 Carlsberg', market: 'Denmark' },
      { value: 'MAERSK-B.CO', label: '🚢 Maersk', market: 'Denmark' },
      { value: 'ERIC-B.ST', label: '📱 Ericsson', market: 'Sweden' },
      { value: 'VOLV-B.ST', label: '🚗 Volvo', market: 'Sweden' },
      { value: 'HM-B.ST', label: '👕 H&M', market: 'Sweden' },
      { value: 'ABB.ST', label: '⚡ ABB', market: 'Sweden' },
      { value: 'SEB-A.ST', label: '🏦 SEB', market: 'Sweden' },
      { value: 'SWED-A.ST', label: '🏦 Swedbank', market: 'Sweden' },
      { value: 'NOD.OL', label: '📱 Nordic Semiconductor', market: 'Norway' },
      { value: 'DNB.OL', label: '🏦 DNB', market: 'Norway' },
      { value: 'EQNR.OL', label: '🛢️ Equinor', market: 'Norway' },
      { value: 'YAR.OL', label: '🛢️ Yara', market: 'Norway' },
      { value: 'TEL.OL', label: '📞 Telenor', market: 'Norway' },
      
      // الأسهم الخليجية والعربية
      { value: '2222.SR', label: '🛢️ أرامكو السعودية', market: 'Saudi' },
      { value: '1120.SR', label: '🏦 الراجحي', market: 'Saudi' },
      { value: '1180.SR', label: '📞 STC السعودية', market: 'Saudi' },
      { value: '2010.SR', label: '🏭 سابك', market: 'Saudi' },
      { value: '4001.SR', label: '🏦 البنك الأهلي السعودي', market: 'Saudi' },
      { value: '1010.SR', label: '🏦 بنك الرياض', market: 'Saudi' },
      { value: '1050.SR', label: '🏦 بنك الجزيرة', market: 'Saudi' },
      { value: '1111.SR', label: '💊 الدواء', market: 'Saudi' },
      { value: '2030.SR', label: '🏭 سابك للمغذيات', market: 'Saudi' },
      { value: '2380.SR', label: '🏭 بتروكيماويات', market: 'Saudi' },
      { value: 'ADNOCDIST.AD', label: '🛢️ أدنوك للتوزيع', market: 'UAE' },
      { value: 'FAB.AD', label: '🏦 بنك أبوظبي الأول', market: 'UAE' },
      { value: 'ADIB.AD', label: '🏦 أبوظبي الإسلامي', market: 'UAE' },
      { value: 'DIB.DU', label: '🏦 دبي الإسلامي', market: 'UAE' },
      { value: 'EMAAR.DU', label: '🏗️ إعمار', market: 'UAE' },
      { value: 'DFM.DU', label: '📈 سوق دبي المالي', market: 'UAE' },
      { value: 'ADNOC.AD', label: '🛢️ أدنوك', market: 'UAE' },
      { value: 'COMI.QA', label: '🏦 QNB قطر', market: 'Qatar' },
      { value: 'ERES.QA', label: '🏗️ Ezdan قطر', market: 'Qatar' },
      { value: 'MARK.QA', label: '🏪 Mannai قطر', market: 'Qatar' },
      { value: 'QEWS.QA', label: '📺 الجزيرة قطر', market: 'Qatar' },
      
      // المزيد من الأسهم العالمية
      { value: 'SHOP.TO', label: '🛒 Shopify (Canada)', market: 'Canada' },
      { value: 'RY.TO', label: '🏦 Royal Bank (Canada)', market: 'Canada' },
      { value: 'TD.TO', label: '🏦 TD Bank (Canada)', market: 'Canada' },
      { value: 'BMO.TO', label: '🏦 Bank of Montreal', market: 'Canada' },
      { value: 'BNS.TO', label: '🏦 Scotiabank', market: 'Canada' },
      { value: 'CNQ.TO', label: '🛢️ Canadian Natural', market: 'Canada' },
      { value: 'SU.TO', label: '🛢️ Suncor Energy', market: 'Canada' },
      { value: 'ENB.TO', label: '⚡ Enbridge', market: 'Canada' },
      { value: 'CP.TO', label: '🚂 Canadian Pacific', market: 'Canada' },
      { value: 'CNR.TO', label: '🚂 Canadian National', market: 'Canada' },
      { value: 'BCE.TO', label: '📞 BCE Inc', market: 'Canada' },
      { value: 'T.TO', label: '📱 Telus', market: 'Canada' },
      { value: 'RCI-B.TO', label: '📱 Rogers', market: 'Canada' },
      { value: 'MFC.TO', label: '💼 Manulife', market: 'Canada' },
      { value: 'SLF.TO', label: '💼 Sun Life', market: 'Canada' },
      { value: 'WCN.TO', label: '♻️ Waste Connections', market: 'Canada' },
      { value: 'WPM.TO', label: '🥇 Wheaton Precious', market: 'Canada' },
      { value: 'ABX.TO', label: '🥇 Barrick Gold', market: 'Canada' },
      { value: 'FNV.TO', label: '🥇 Franco-Nevada', market: 'Canada' },
      { value: 'NTR.TO', label: '🌾 Nutrien', market: 'Canada' },
      { value: 'CSU.TO', label: '💻 Constellation Software', market: 'Canada' },
      { value: 'WDAY', label: '💼 Workday', market: 'US Tech' },
      { value: 'NOW', label: '☁️ ServiceNow', market: 'US Tech' },
      { value: 'TEAM', label: '👥 Atlassian', market: 'US Tech' },
      { value: 'VEEV', label: '☁️ Veeva Systems', market: 'US Tech' },
      { value: 'COUP', label: '💼 Coupa Software', market: 'US Tech' },
      { value: 'ZI', label: '☁️ ZoomInfo', market: 'US Tech' },
      { value: 'BILL', label: '💳 Bill.com', market: 'US Tech' },
      { value: 'PAYC', label: '💰 Paycom', market: 'US Tech' },
      { value: 'PAYX', label: '💰 Paychex', market: 'US Tech' },
      { value: 'ADP', label: '💼 ADP', market: 'US Tech' },
      { value: 'INTU', label: '💰 Intuit', market: 'US Tech' },
      { value: 'ADSK', label: '📐 Autodesk', market: 'US Tech' },
      { value: 'ANSS', label: '🔬 Ansys', market: 'US Tech' },
      { value: 'CDNS', label: '💻 Cadence Design', market: 'US Tech' },
      { value: 'SNPS', label: '💻 Synopsys', market: 'US Tech' },
      { value: 'KLAC', label: '🔬 KLA Corp', market: 'US Tech' },
      { value: 'LRCX', label: '🔬 Lam Research', market: 'US Tech' },
      { value: 'AMAT', label: '🔬 Applied Materials', market: 'US Tech' },
      { value: 'ASML', label: '🔬 ASML Holding', market: 'Europe Tech' },
      { value: 'MCHP', label: '💻 Microchip Tech', market: 'US Tech' },
      { value: 'MRVL', label: '💻 Marvell Tech', market: 'US Tech' },
      { value: 'NXPI', label: '💻 NXP Semi', market: 'US Tech' },
      { value: 'ON', label: '💻 ON Semi', market: 'US Tech' },
      { value: 'ADI', label: '💻 Analog Devices', market: 'US Tech' },
      { value: 'MU', label: '💾 Micron Tech', market: 'US Tech' },
      { value: 'WDC', label: '💾 Western Digital', market: 'US Tech' },
      { value: 'SWKS', label: '📡 Skyworks', market: 'US Tech' },
      { value: 'QRVO', label: '📡 Qorvo', market: 'US Tech' }
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
      
      // المعادن الصناعية
      { value: 'COPPER', label: '🟤 Copper (النحاس)', category: 'Industrial Metals' },
      { value: 'LEAD', label: '⚫ Lead (الرصاص)', category: 'Industrial Metals' },
      { value: 'TIN', label: '⚪ Tin (القصدير)', category: 'Industrial Metals' },
      { value: 'IRON', label: '🔴 Iron Ore (خام الحديد)', category: 'Industrial Metals' },
      { value: 'STEEL', label: '🔩 Steel (الصلب)', category: 'Industrial Metals' },
      
      // المحاصيل الزراعية - الحبوب
      { value: 'WHEAT', label: '🌾 Wheat (القمح)', category: 'Grains' },
      { value: 'CORN', label: '🌽 Corn (الذرة)', category: 'Grains' },
      { value: 'OATS', label: '🌾 Oats (الشوفان)', category: 'Grains' },
      { value: 'SOYMEAL', label: '🍽️ Soybean Meal', category: 'Grains' },
      { value: 'SOYOIL', label: '🛢️ Soybean Oil', category: 'Grains' },
      
      // المنتجات الغذائية الأخرى
      { value: 'SUGAR', label: '🍬 Sugar (السكر)', category: 'Soft Commodities' },
      { value: 'COFFEE', label: '☕ Coffee (القهوة)', category: 'Soft Commodities' },
      { value: 'COCOA', label: '🍫 Cocoa (الكاكاو)', category: 'Soft Commodities' },
      { value: 'ORANGE', label: '🍊 Orange Juice (عصير البرتقال)', category: 'Soft Commodities' },
      { value: 'LUMBER', label: '🪵 Lumber (الأخشاب)', category: 'Soft Commodities' },
      
      // الماشية
      { value: 'CATTLE', label: '🐄 Live Cattle (الماشية الحية)', category: 'Livestock' },
      { value: 'HOGS', label: '🐷 Lean Hogs (الخنازير)', category: 'Livestock' },
      
      // أخرى
      { value: 'RUBBER', label: '⚫ Rubber (المطاط)', category: 'Other' },
      { value: 'PALM', label: '🌴 Palm Oil (زيت النخيل)', category: 'Other' },
      { value: 'WOOL', label: '🐑 Wool (الصوف)', category: 'Other' },
      { value: 'ETHANOL', label: '⚗️ Ethanol (الإيثانول)', category: 'Energy' },
      { value: 'URANIUM', label: '☢️ Uranium (اليورانيوم)', category: 'Energy' },
      { value: 'COAL', label: '⚫ Coal (الفحم)', category: 'Energy' },
      { value: 'LITHIUM', label: '⚡ Lithium (الليثيوم)', category: 'Industrial Metals' },
      { value: 'COBALT', label: '🔵 Cobalt (الكوبالت)', category: 'Industrial Metals' },
      { value: 'MOLYBDENUM', label: '⚪ Molybdenum (الموليبدينوم)', category: 'Industrial Metals' },
      
      // المزيد من السلع النادرة (المدعومة فقط)
      { value: 'GRAPHITE', label: '⚫ Graphite (الجرافيت)', category: 'Industrial Metals' },
      { value: 'VANADIUM', label: '⚪ Vanadium (الفاناديوم)', category: 'Industrial Metals' },
      { value: 'TITANIUM', label: '⚪ Titanium (التيتانيوم)', category: 'Industrial Metals' },
      { value: 'CHROMIUM', label: '⚪ Chromium (الكروم)', category: 'Industrial Metals' },
      { value: 'TUNGSTEN', label: '⚪ Tungsten (التنغستن)', category: 'Industrial Metals' },
      { value: 'ANTIMONY', label: '⚪ Antimony (الأنتيمون)', category: 'Industrial Metals' },
      { value: 'BISMUTH', label: '🟣 Bismuth (البزموت)', category: 'Industrial Metals' },
      { value: 'RARE_EARTH', label: '🌟 Rare Earth Metals (المعادن النادرة)', category: 'Industrial Metals' },
      { value: 'NEODYMIUM', label: '🧲 Neodymium (النيوديميوم)', category: 'Rare Metals' },
      { value: 'PRASEODYMIUM', label: '🟢 Praseodymium', category: 'Rare Metals' },
      { value: 'DYSPROSIUM', label: '⚪ Dysprosium', category: 'Rare Metals' },
      { value: 'EUROPIUM', label: '🔴 Europium', category: 'Rare Metals' },
      { value: 'YTTRIUM', label: '⚪ Yttrium', category: 'Rare Metals' },
      { value: 'SCANDIUM', label: '⚪ Scandium', category: 'Rare Metals' },
      { value: 'INDIUM', label: '⚪ Indium (الإنديوم)', category: 'Rare Metals' },
      { value: 'TELLURIUM', label: '⚪ Tellurium', category: 'Rare Metals' },
      { value: 'SELENIUM', label: '⚪ Selenium (السيلينيوم)', category: 'Rare Metals' },
      { value: 'CADMIUM', label: '⚪ Cadmium (الكادميوم)', category: 'Industrial Metals' },
      
      // المزيد من منتجات الطاقة (المدعومة فقط)
      { value: 'PROPANE', label: '⚗️ Propane (البروبان)', category: 'Energy' },
      { value: 'BUTANE', label: '⚗️ Butane (البيوتان)', category: 'Energy' },
      { value: 'METHANOL', label: '🧪 Methanol (الميثانول)', category: 'Energy' },
      { value: 'NAPHTHA', label: '🛢️ Naphtha (النافثا)', category: 'Energy' },
      { value: 'JET_FUEL', label: '✈️ Jet Fuel (وقود الطائرات)', category: 'Energy' },
      { value: 'DIESEL', label: '🚛 Diesel (الديزل)', category: 'Energy' },
      { value: 'LPG', label: '🔥 LPG (غاز البترول المسال)', category: 'Energy' },
      { value: 'LNG', label: '💧 LNG (الغاز الطبيعي المسال)', category: 'Energy' },
      { value: 'BIODIESEL', label: '🌱 Biodiesel', category: 'Energy' },
      
      // منتجات زراعية إضافية (المدعومة فقط)
      { value: 'SUNFLOWER', label: '🌻 Sunflower (دوار الشمس)', category: 'Grains' },
      { value: 'PALM_KERNEL', label: '🌴 Palm Kernel (نواة النخيل)', category: 'Grains' },
      { value: 'LINSEED', label: '🌾 Linseed (بذر الكتان)', category: 'Grains' },
      { value: 'RUBBER_NR', label: '⚫ Natural Rubber (المطاط الطبيعي)', category: 'Soft Commodities' },
      { value: 'JUTE', label: '🧵 Jute (الجوت)', category: 'Soft Commodities' },
      { value: 'SISAL', label: '🌿 Sisal (السيزال)', category: 'Soft Commodities' },
      { value: 'HEMP', label: '🌿 Hemp (القنب)', category: 'Soft Commodities' },
      { value: 'FLAX', label: '🌾 Flax (الكتان)', category: 'Soft Commodities' },
      { value: 'SILK', label: '🐛 Silk (الحرير)', category: 'Soft Commodities' },
      { value: 'CASHMERE', label: '🐐 Cashmere', category: 'Soft Commodities' },
      { value: 'FEATHERS', label: '🪶 Feathers (الريش)', category: 'Soft Commodities' },
      { value: 'HIDES', label: '🐄 Hides (الجلود)', category: 'Livestock' },
      { value: 'LEATHER', label: '👜 Leather (الجلد)', category: 'Livestock' },
      { value: 'MILK', label: '🥛 Milk (الحليب)', category: 'Livestock' },
      { value: 'BUTTER', label: '🧈 Butter (الزبدة)', category: 'Livestock' },
      { value: 'CHEESE', label: '🧀 Cheese (الجبن)', category: 'Livestock' },
      { value: 'EGGS', label: '🥚 Eggs (البيض)', category: 'Livestock' },
      { value: 'HONEY', label: '🍯 Honey (العسل)', category: 'Soft Commodities' },
      { value: 'PEPPER', label: '🌶️ Pepper (الفلفل)', category: 'Soft Commodities' },
      { value: 'CARDAMOM', label: '🌰 Cardamom (الهيل)', category: 'Soft Commodities' },
      { value: 'CLOVES', label: '🌰 Cloves (القرنفل)', category: 'Soft Commodities' },
      { value: 'CINNAMON', label: '🌰 Cinnamon (القرفة)', category: 'Soft Commodities' },
      { value: 'NUTMEG', label: '🌰 Nutmeg (جوزة الطيب)', category: 'Soft Commodities' },
      { value: 'SAFFRON', label: '🌼 Saffron (الزعفران)', category: 'Soft Commodities' },
      { value: 'TURMERIC', label: '🟡 Turmeric (الكركم)', category: 'Soft Commodities' },
      { value: 'GINGER', label: '🫚 Ginger (الزنجبيل)', category: 'Soft Commodities' },
      { value: 'GARLIC', label: '🧄 Garlic (الثوم)', category: 'Soft Commodities' },
      { value: 'TOMATO', label: '🍅 Tomato (الطماطم)', category: 'Soft Commodities' },
      { value: 'BANANA', label: '🍌 Banana (الموز)', category: 'Soft Commodities' },
      { value: 'APPLE', label: '🍎 Apple (التفاح)', category: 'Soft Commodities' },
      { value: 'GRAPE', label: '🍇 Grape (العنب)', category: 'Soft Commodities' },
      { value: 'WINE', label: '🍷 Wine (النبيذ)', category: 'Soft Commodities' }
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
      { value: 'ITA40', label: '🇮🇹 FTSE MIB (Italy)', region: 'Italy' },
      { value: 'SWI20', label: '🇨🇭 SMI 20 (Switzerland)', region: 'Switzerland' },
      { value: 'NLD25', label: '🇳🇱 AEX 25 (Netherlands)', region: 'Netherlands' },
      { value: 'STOXX50', label: '🇪🇺 Euro Stoxx 50', region: 'Europe' },
      { value: 'BEL20', label: '🇧🇪 BEL 20 (Belgium)', region: 'Belgium' },
      { value: 'AUT20', label: '🇦🇹 ATX (Austria)', region: 'Austria' },
      { value: 'POR20', label: '🇵🇹 PSI 20 (Portugal)', region: 'Portugal' },
      
      // المؤشرات الآسيوية
      { value: 'HK50', label: '🇭🇰 Hang Seng (Hong Kong)', region: 'Hong Kong' },
      { value: 'CHN50', label: '🇨🇳 China A50', region: 'China' },
      { value: 'KOR200', label: '🇰🇷 KOSPI 200 (Korea)', region: 'Korea' },
      { value: 'TWN', label: '🇹🇼 TAIEX (Taiwan)', region: 'Taiwan' },
      { value: 'THA50', label: '🇹🇭 SET 50 (Thailand)', region: 'Thailand' },
      { value: 'IDN', label: '🇮🇩 IDX (Indonesia)', region: 'Indonesia' },
      { value: 'MYS', label: '🇲🇾 KLCI (Malaysia)', region: 'Malaysia' },
      { value: 'PHL', label: '🇵🇭 PSEi (Philippines)', region: 'Philippines' },
      
      // المؤشرات الأفريقية والشرق الأوسط
      { value: 'EGY30', label: '🇪🇬 EGX 30 (Egypt)', region: 'Egypt' },
      { value: 'ISR35', label: '🇮🇱 TA-35 (Israel)', region: 'Israel' },
      { value: 'SAU', label: '🇸🇦 TASI (Saudi Arabia)', region: 'Saudi Arabia' },
      { value: 'UAE', label: '🇦🇪 ADX (UAE)', region: 'UAE' },
      { value: 'QAT', label: '🇶🇦 QE Index (Qatar)', region: 'Qatar' },
      { value: 'KWT', label: '🇰🇼 Kuwait (Kuwait)', region: 'Kuwait' },
      
      // المؤشرات الأمريكية اللاتينية
      { value: 'MEX35', label: '🇲🇽 IPC Mexico', region: 'Mexico' },
      
      // المؤشرات الأخرى
      { value: 'RUS50', label: '🇷🇺 MOEX Russia', region: 'Russia' },
      { value: 'TUR30', label: '🇹🇷 BIST 30 (Turkey)', region: 'Turkey' },
      { value: 'NOR25', label: '🇳🇴 OBX (Norway)', region: 'Norway' },
      { value: 'FIN25', label: '🇫🇮 OMX Helsinki', region: 'Finland' },
      { value: 'POL20', label: '🇵🇱 WIG20 (Poland)', region: 'Poland' },
      { value: 'HUN', label: '🇭🇺 BUX (Hungary)', region: 'Hungary' },
      { value: 'CZE', label: '🇨🇿 PX (Czech)', region: 'Czech Republic' },
      { value: 'ROM', label: '🇷🇴 BET (Romania)', region: 'Romania' },
      { value: 'VNM', label: '🇻🇳 VN-Index (Vietnam)', region: 'Vietnam' },
      { value: 'BGD', label: '🇧🇩 DSEX (Bangladesh)', region: 'Bangladesh' },
      { value: 'KEN', label: '🇰🇪 NSE 20 (Kenya)', region: 'Kenya' },
      { value: 'MAR', label: '🇲🇦 MASI (Morocco)', region: 'Morocco' },
      { value: 'JOR', label: '🇯🇴 Amman SE (Jordan)', region: 'Jordan' },
      { value: 'LEB', label: '🇱🇧 BLOM (Lebanon)', region: 'Lebanon' },
      { value: 'BHR', label: '🇧🇭 Bahrain (Bahrain)', region: 'Bahrain' },
      { value: 'IRQ', label: '🇮🇶 ISX (Iraq)', region: 'Iraq' }
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
