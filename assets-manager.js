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


  // دمج جميع العملات الرقمية من جميع المصادر
  async getAllCryptoAssets() {
    try {
      const okxAssets = await this.fetchAllCryptoFromOKX();

      // استخدام أصول OKX فقط
      const allAssets = [...okxAssets];
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
    const minorCurrencies = ['NOK', 'SEK', 'DKK', 'PLN', 'TRY', 'ZAR', 'MXN', 'SGD', 'HKD', 'THB', 'INR', 'CNY', 'KRW', 'BRL', 'RUB'];
    const allCurrencies = [...majorCurrencies, ...minorCurrencies];
    
    // أزواج محظورة (لا تعمل في Yahoo Finance أو TwelveData)
    const blockedPairs = new Set([
      'PLNBRL', 'BRLPLN',  // PLN-BRL
      'TRYBRL', 'BRLTRY',  // TRY-BRL
      'INRTRY', 'TRYINR',  // INR-TRY
      'NOKKRW', 'KRWNOK',  // NOK-KRW
      'RUBINR', 'INRRUB',  // RUB-INR
      'PLNINR', 'INRPLN',  // PLN-INR
      'TRYSGD', 'SGDTRY',  // TRY-SGD
      'INRZAR', 'ZARINR',  // INR-ZAR
      'TRYTHB', 'THBTRY',  // TRY-THB
      'RUBZAR', 'ZARRUB'   // RUB-ZAR
    ]);
    
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
          
          // تخطي الأزواج المحظورة
          if (blockedPairs.has(pair)) {
            continue;
          }
          
          pairs.push({
            value: pair,
            label: `${flags[base] || '🌐'} ${base}/${quote} ${flags[quote] || '🌐'}`
          });
        }
      }
    }

    this.forexPairs = pairs;
    console.log(`✅ تم إنشاء ${this.forexPairs.length} زوج فوركس (تم استبعاد ${blockedPairs.size} زوج محظور)`);
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
      { value: 'SHEL.L', label: '🛢️ Shell', market: 'UK' },
      { value: 'BP.L', label: '🛢️ BP', market: 'UK' },
      { value: 'HSBA.L', label: '🏦 HSBC', market: 'UK' },
      { value: 'ULVR.L', label: '🧴 Unilever', market: 'UK' },
      { value: 'AZN.L', label: '💊 AstraZeneca', market: 'UK' },
      { value: 'GSK.L', label: '💊 GSK', market: 'UK' },
      { value: 'DGE.L', label: '🍺 Diageo', market: 'UK' },
      { value: 'RIO.L', label: '⛏️ Rio Tinto', market: 'UK' },
      { value: 'BHP.L', label: '⛏️ BHP Group', market: 'UK' },
      { value: 'AAL.L', label: '⛏️ Anglo American', market: 'UK' },
      { value: 'GLEN.L', label: '⛏️ Glencore', market: 'UK' },
      { value: 'BARC.L', label: '🏦 Barclays', market: 'UK' },
      { value: 'LLOY.L', label: '🏦 Lloyds Banking', market: 'UK' },
      { value: 'NWG.L', label: '🏦 NatWest Group', market: 'UK' },
      { value: 'PRU.L', label: '💼 Prudential', market: 'UK' },
      { value: 'LSEG.L', label: '📈 London Stock Exchange', market: 'UK' },
      { value: 'RR.L', label: '✈️ Rolls-Royce', market: 'UK' },
      { value: 'BAE.L', label: '🛡️ BAE Systems', market: 'UK' },
      { value: 'VOD.L', label: '📱 Vodafone', market: 'UK' },
      { value: 'BT-A.L', label: '📞 BT Group', market: 'UK' },
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
      { value: 'FAB.AD', label: '🏦 بنك أبوظبي الأول', market: 'UAE' },
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
      { value: 'GC=F', label: '🥇 Gold Futures (الذهب)', category: 'Precious Metals' },
      { value: 'SI=F', label: '🥈 Silver Futures (الفضة)', category: 'Precious Metals' },
      { value: 'PL=F', label: '⚪ Platinum Futures (البلاتين)', category: 'Precious Metals' },
      { value: 'PA=F', label: '⚫ Palladium Futures (البلاديوم)', category: 'Precious Metals' },
      
      // الطاقة
      { value: 'CL=F', label: '🛢️ WTI Crude Oil Futures (نفط خام WTI)', category: 'Energy' },
      { value: 'BZ=F', label: '🛢️ Brent Crude Futures (نفط برنت)', category: 'Energy' },
      { value: 'NG=F', label: '🔥 Natural Gas Futures (الغاز الطبيعي)', category: 'Energy' },
      { value: 'HO=F', label: '⛽ Heating Oil Futures (زيت التدفئة)', category: 'Energy' },
      { value: 'RB=F', label: '⛽ Gasoline Futures (البنزين)', category: 'Energy' },
      
      // الحبوب والمحاصيل الزراعية
      { value: 'ZC=F', label: '🌽 Corn Futures (الذرة)', category: 'Grains' },
      { value: 'ZW=F', label: '🌾 Wheat Futures (القمح)', category: 'Grains' },
      { value: 'ZS=F', label: '🌱 Soybean Futures (فول الصويا)', category: 'Grains' },
      { value: 'ZO=F', label: '🌾 Oat Futures (الشوفان)', category: 'Grains' },
      { value: 'ZR=F', label: '🌾 Rice Futures (الأرز)', category: 'Grains' },
      
      // المنتجات الغذائية
      { value: 'KC=F', label: '☕ Coffee Futures (القهوة)', category: 'Soft Commodities' },
      { value: 'SB=F', label: '🍬 Sugar Futures (السكر)', category: 'Soft Commodities' },
      { value: 'CC=F', label: '🍫 Cocoa Futures (الكاكاو)', category: 'Soft Commodities' },
      { value: 'CT=F', label: '🧵 Cotton Futures (القطن)', category: 'Soft Commodities' },
      { value: 'OJ=F', label: '🍊 Orange Juice Futures (عصير البرتقال)', category: 'Soft Commodities' },
      
      // المعادن الصناعية
      { value: 'HG=F', label: '🟤 Copper Futures (النحاس)', category: 'Industrial Metals' },
      
      // الماشية
      { value: 'LE=F', label: '🐄 Live Cattle Futures (الماشية الحية)', category: 'Livestock' },
      { value: 'HE=F', label: '🐷 Lean Hogs Futures (الخنازير)', category: 'Livestock' }
    ];

    console.log(`✅ قائمة السلع: ${this.commodities.length} سلعة`);
    return this.commodities;
  }

  // قائمة موسعة للمؤشرات
  getAllIndices() {
    this.indices = [
      // المؤشرات الأمريكية
      { value: '^DJI', label: '🇺🇸 Dow Jones Industrial Average', region: 'USA' },
      { value: '^GSPC', label: '🇺🇸 S&P 500', region: 'USA' },
      { value: '^IXIC', label: '🇺🇸 NASDAQ Composite', region: 'USA' },
      { value: '^NDX', label: '🇺🇸 NASDAQ 100', region: 'USA' },
      { value: '^RUT', label: '🇺🇸 Russell 2000', region: 'USA' },
      { value: '^VIX', label: '🇺🇸 VIX (مؤشر الخوف)', region: 'USA' },
      
      // المؤشرات الأوروبية
      { value: '^FTSE', label: '🇬🇧 FTSE 100', region: 'UK' },
      { value: '^GDAXI', label: '🇩🇪 DAX (Germany)', region: 'Germany' },
      { value: '^FCHI', label: '🇫🇷 CAC 40 (France)', region: 'France' },
      { value: '^STOXX50E', label: '🇪🇺 Euro Stoxx 50', region: 'Europe' },
      { value: '^SSMI', label: '🇨🇭 Swiss Market Index (SMI)', region: 'Switzerland' },
      { value: '^AEX', label: '🇳🇱 AEX (Netherlands)', region: 'Netherlands' },
      { value: '^FTMIB', label: '🇮🇹 FTSE MIB (Italy)', region: 'Italy' },
      { value: '^IBEX', label: '🇪🇸 IBEX 35 (Spain)', region: 'Spain' },
      { value: '^OSEAX', label: '🇳🇴 Oslo Stock Exchange', region: 'Norway' },
      { value: '^OMXS30', label: '🇸🇪 OMX Stockholm 30', region: 'Sweden' },
      { value: '^OMXC25', label: '🇩🇰 OMX Copenhagen 25', region: 'Denmark' },
      
      // المؤشرات الآسيوية
      { value: '^N225', label: '🇯🇵 Nikkei 225', region: 'Japan' },
      { value: '^HSI', label: '🇭🇰 Hang Seng (Hong Kong)', region: 'Hong Kong' },
      { value: '000001.SS', label: '🇨🇳 Shanghai Composite', region: 'China' },
      { value: '^AXJO', label: '🇦🇺 ASX 200 (Australia)', region: 'Australia' },
      { value: '^KOSPI', label: '🇰🇷 KOSPI (Korea)', region: 'Korea' },
      { value: '^TWII', label: '🇹🇼 TWSE (Taiwan)', region: 'Taiwan' },
      { value: '^STI', label: '🇸🇬 Straits Times Index (Singapore)', region: 'Singapore' },
      { value: '^JKSE', label: '🇮🇩 Jakarta Composite (Indonesia)', region: 'Indonesia' },
      { value: '^KLSE', label: '🇲🇾 FTSE Bursa Malaysia KLCI', region: 'Malaysia' },
      { value: '^BSESN', label: '🇮🇳 BSE Sensex (India)', region: 'India' },
      { value: '^NSEI', label: '🇮🇳 Nifty 50 (India)', region: 'India' },
      
      // المؤشرات الأخرى
      { value: '^MXX', label: '🇲🇽 IPC Mexico', region: 'Mexico' },
      { value: '^BVSP', label: '🇧🇷 Bovespa (Brazil)', region: 'Brazil' },
      { value: '^MERV', label: '🇦🇷 MERVAL (Argentina)', region: 'Argentina' },
      { value: '^TA125.TA', label: '🇮🇱 TA-125 (Israel)', region: 'Israel' },
      { value: '^XU100', label: '🇹🇷 BIST 100 (Turkey)', region: 'Turkey' }
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
