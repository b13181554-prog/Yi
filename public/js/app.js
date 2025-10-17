console.log('🚀 app.js loaded');

// التحقق من توفر Telegram WebApp
let tg;
try {
    tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
} catch (e) {
    console.error('Error accessing Telegram WebApp:', e);
    tg = null;
}

console.log('tg =', tg);

if (!tg) {
    console.error('Telegram WebApp not loaded');
    document.getElementById('loading').innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <h2 style="color: #ee0979;">❌ خطأ</h2>
            <p>يجب فتح التطبيق من خلال Telegram</p>
        </div>
    `;
} else {
    try {
        tg.expand();

        // enableClosingConfirmation غير مدعوم في النسخة 6.0
        if (tg.version && parseFloat(tg.version) > 6.1) {
            tg.enableClosingConfirmation();
        }
    } catch (e) {
        console.error('Error expanding WebApp:', e);
    }
}

let userData = null;
let userBalance = 0;
let userId = null;
let botUsername = null;

let currentPaymentAddress = null;
let paymentPollingInterval = null;

function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return 'N/A';
    
    price = parseFloat(price);
    
    if (price === 0) return '0';
    
    let str = price.toString();
    
    if (str.includes('e-')) {
        try {
            const parts = str.split('e-');
            const decimals = parseInt(parts[1], 10);
            const precision = Math.min(decimals + (parts[0].replace('.', '').length - 1), 20);
            str = price.toFixed(precision);
        } catch (e) {
            return str;
        }
    }
    
    str = str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
    
    return str;
}

const CRYPTO_SYMBOLS = [
    { value: 'BTCUSDT', label: '💰 Bitcoin (BTC)' },
    { value: 'ETHUSDT', label: '💎 Ethereum (ETH)' },
    { value: 'BNBUSDT', label: '🟡 Binance Coin (BNB)' },
    { value: 'XRPUSDT', label: '💧 Ripple (XRP)' },
    { value: 'ADAUSDT', label: '🔷 Cardano (ADA)' },
    { value: 'DOGEUSDT', label: '🐕 Dogecoin (DOGE)' },
    { value: 'SOLUSDT', label: '🟣 Solana (SOL)' },
    { value: 'DOTUSDT', label: '🔴 Polkadot (DOT)' },
    { value: 'MATICUSDT', label: '🟪 Polygon (MATIC)' },
    { value: 'LTCUSDT', label: '🔵 Litecoin (LTC)' },
    { value: 'AVAXUSDT', label: '🔺 Avalanche (AVAX)' },
    { value: 'LINKUSDT', label: '🔗 Chainlink (LINK)' },
    { value: 'ATOMUSDT', label: '⚛️ Cosmos (ATOM)' },
    { value: 'NEARUSDT', label: '🌈 NEAR Protocol' },
    { value: 'UNIUSDT', label: '🦄 Uniswap (UNI)' },
    { value: 'SHIBUSDT', label: '🐕 Shiba Inu (SHIB)' },
    { value: 'TRXUSDT', label: '⭕ TRON (TRX)' },
    { value: 'VETUSDT', label: '🔵 VeChain (VET)' },
    { value: 'FTMUSDT', label: '👻 Fantom (FTM)' },
    { value: 'ALGOUSDT', label: '⚫ Algorand (ALGO)' },
    { value: 'XLMUSDT', label: '🌟 Stellar (XLM)' },
    { value: 'ICPUSDT', label: '♾️ Internet Computer (ICP)' },
    { value: 'APTUSDT', label: '🟢 Aptos (APT)' },
    { value: 'ARBUSDT', label: '🔵 Arbitrum (ARB)' },
    { value: 'OPUSDT', label: '🔴 Optimism (OP)' },
    { value: 'SUIUSDT', label: '💧 Sui (SUI)' },
    { value: 'INJUSDT', label: '⚡ Injective (INJ)' },
    { value: 'PEPEUSDT', label: '🐸 Pepe (PEPE)' },
    { value: 'FLOKIUSDT', label: '🐕 Floki (FLOKI)' },
    { value: 'WLDUSDT', label: '🌍 Worldcoin (WLD)' },
    { value: 'LDOUSDT', label: '⚡ Lido DAO (LDO)' },
    { value: 'AAVEUSDT', label: '👻 Aave (AAVE)' },
    { value: 'MKRUSDT', label: '🟢 Maker (MKR)' },
    { value: 'COMPUSDT', label: '🟢 Compound (COMP)' },
    { value: 'SUSHIUSDT', label: '🍣 SushiSwap (SUSHI)' },
    { value: 'CRVUSDT', label: '🔵 Curve DAO (CRV)' },
    { value: 'SNXUSDT', label: '⚫ Synthetix (SNX)' },
    { value: '1INCHUSDT', label: '🦄 1inch (1INCH)' },
    { value: 'GRTUSDT', label: '🟣 The Graph (GRT)' },
    { value: 'SANDUSDT', label: '🏖️ The Sandbox (SAND)' },
    { value: 'MANAUSDT', label: '🎮 Decentraland (MANA)' },
    { value: 'AXSUSDT', label: '🎮 Axie Infinity (AXS)' },
    { value: 'GALAUSDT', label: '🎮 Gala (GALA)' },
    { value: 'APEUSDT', label: '🦧 ApeCoin (APE)' },
    { value: 'CHZUSDT', label: '🌶️ Chiliz (CHZ)' },
    { value: 'ENJUSDT', label: '🎮 Enjin Coin (ENJ)' },
    { value: 'QNTUSDT', label: '⚡ Quant (QNT)' },
    { value: 'TONUSDT', label: '💎 Toncoin (TON)' },
    { value: 'HBARUSDT', label: '🔷 Hedera (HBAR)' },
    { value: 'BCHUSDT', label: '💰 Bitcoin Cash (BCH)' },
    { value: 'ETCUSDT', label: '🟢 Ethereum Classic (ETC)' },
    { value: 'FILUSDT', label: '🗂️ Filecoin (FIL)' },
    { value: 'THETAUSDT', label: '🎬 Theta (THETA)' },
    { value: 'EOSUSDT', label: '⚡ EOS' },
    { value: 'RUNEUSDT', label: '⚔️ THORChain (RUNE)' },
    { value: 'IMXUSDT', label: '🎮 Immutable X (IMX)' },
    { value: 'RENDERUSDT', label: '🎨 Render (RENDER)' },
    { value: 'FETUSDT', label: '🤖 Fetch.ai (FET)' },
    { value: 'AGIXUSDT', label: '🧠 SingularityNET (AGIX)' },
    { value: 'OCEANUSDT', label: '🌊 Ocean Protocol (OCEAN)' },
    { value: 'LRCUSDT', label: '⭕ Loopring (LRC)' },
    { value: 'STXUSDT', label: '📚 Stacks (STX)' },
    { value: 'KAVAUSDT', label: '🔴 Kava (KAVA)' },
    { value: 'BONKUSDT', label: '🐕 Bonk (BONK)' },
    { value: 'WIFUSDT', label: '🐶 dogwifhat (WIF)' },
    { value: 'BRETTUSDT', label: '🎭 Brett (BRETT)' },
    { value: 'BOMEUSDT', label: '📖 BOOK OF MEME (BOME)' },
    { value: 'MEWUSDT', label: '😸 cat in a dogs world (MEW)' },
    { value: 'TURBOUSDT', label: '🌪️ Turbo (TURBO)' },
    { value: 'SEIUSDT', label: '🔺 Sei (SEI)' },
    { value: 'TIAUSDT', label: '🌌 Celestia (TIA)' },
    { value: 'ORDIUSDT', label: '🟠 ORDI' },
    { value: 'JUPUSDT', label: '🪐 Jupiter (JUP)' },
    { value: 'WUSDT', label: '🟣 Wormhole (W)' },
    { value: 'PYTHUSDT', label: '🔮 Pyth Network (PYTH)' },
    { value: 'DYMUSDT', label: '🌀 Dymension (DYM)' },
    { value: 'ONDOUSDT', label: '💧 Ondo (ONDO)' },
    { value: 'STRKUSDT', label: '⚡ Starknet (STRK)' },
    { value: 'ENAUSDT', label: '🌐 Ethena (ENA)' },
    { value: 'NOTUSDT', label: '🎵 Notcoin (NOT)' },
    { value: 'IOTAUSDT', label: '📡 IOTA (IOTA)' },
    { value: 'KASUSDT', label: '👻 Kaspa (KAS)' },
    { value: 'TAOUSDT', label: '🧬 Bittensor (TAO)' },
    { value: 'BEAMUSDT', label: '💫 Beam (BEAM)' },
    { value: 'AIUSDT', label: '🤖 Sleepless AI (AI)' }
];

// جميع أزواج الفوركس الرئيسية والثانوية
const FOREX_MAJOR_CURRENCIES = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'];
const FOREX_PAIRS = [];

function generateAllForexPairs() {
    const pairs = [];

    for (let i = 0; i < FOREX_MAJOR_CURRENCIES.length; i++) {
        for (let j = 0; j < FOREX_MAJOR_CURRENCIES.length; j++) {
            if (i !== j) {
                const base = FOREX_MAJOR_CURRENCIES[i];
                const quote = FOREX_MAJOR_CURRENCIES[j];
                const pair = base + quote;

                const flags = {
                    'EUR': '🇪🇺', 'GBP': '🇬🇧', 'USD': '🇺🇸', 'JPY': '🇯🇵',
                    'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CHF': '🇨🇭'
                };

                pairs.push({
                    value: pair,
                    label: `${flags[base]} ${base}/${quote}`
                });
            }
        }
    }

    FOREX_PAIRS.push(...pairs);
    console.log(`✅ تم إنشاء ${FOREX_PAIRS.length} زوج فوركس`);
    return FOREX_PAIRS;
}

const STOCKS = [
    { value: 'AAPL', label: '🍎 Apple Inc.' },
    { value: 'MSFT', label: '🪟 Microsoft' },
    { value: 'GOOGL', label: '🔍 Google (Alphabet)' },
    { value: 'AMZN', label: '📦 Amazon' },
    { value: 'TSLA', label: '🚗 Tesla' },
    { value: 'META', label: '📘 Meta (Facebook)' },
    { value: 'NVDA', label: '💚 NVIDIA' },
    { value: 'NFLX', label: '🎬 Netflix' },
    { value: 'AMD', label: '🔴 AMD' },
    { value: 'BABA', label: '🛒 Alibaba' },
    { value: 'TSM', label: '💻 Taiwan Semiconductor' },
    { value: 'V', label: '💳 Visa' },
    { value: 'JPM', label: '🏦 JPMorgan Chase' },
    { value: 'WMT', label: '🛒 Walmart' },
    { value: 'JNJ', label: '💊 Johnson & Johnson' },
    { value: 'PG', label: '🧴 Procter & Gamble' },
    { value: 'MA', label: '💳 Mastercard' },
    { value: 'UNH', label: '🏥 UnitedHealth' },
    { value: 'HD', label: '🔨 Home Depot' },
    { value: 'BAC', label: '🏦 Bank of America' },
    { value: 'DIS', label: '🎬 Disney' },
    { value: 'ADBE', label: '📊 Adobe' },
    { value: 'CRM', label: '☁️ Salesforce' },
    { value: 'CSCO', label: '🌐 Cisco' },
    { value: 'PFE', label: '💊 Pfizer' },
    { value: 'INTC', label: '💻 Intel' },
    { value: 'ORCL', label: '💾 Oracle' },
    { value: 'NKE', label: '👟 Nike' },
    { value: 'KO', label: '🥤 Coca-Cola' },
    { value: 'PEP', label: '🥤 PepsiCo' },
    { value: 'MCD', label: '🍔 McDonald\'s' },
    { value: 'IBM', label: '💻 IBM' },
    { value: 'PYPL', label: '💰 PayPal' },
    { value: 'UBER', label: '🚗 Uber' },
    { value: 'COIN', label: '💰 Coinbase' },
    { value: 'SQ', label: '💳 Block (Square)' },
    { value: 'SHOP', label: '🛒 Shopify' },
    { value: 'SPOT', label: '🎵 Spotify' },
    { value: 'SNAP', label: '👻 Snap Inc.' },
    { value: 'TWTR', label: '🐦 Twitter (X)' }
];

const COMMODITIES = [
    { value: 'XAUUSD', label: '🥇 Gold (الذهب)' },
    { value: 'XAGUSD', label: '🥈 Silver (الفضة)' },
    { value: 'XPTUSD', label: '⚪ Platinum (البلاتين)' },
    { value: 'XPDUSD', label: '⚫ Palladium' },
    { value: 'WTIUSD', label: '🛢️ WTI Crude Oil' },
    { value: 'BCOUSD', label: '🛢️ Brent Crude Oil' },
    { value: 'NGAS', label: '🔥 Natural Gas' },
    { value: 'COPPER', label: '🟤 Copper (النحاس)' },
    { value: 'WHEAT', label: '🌾 Wheat (القمح)' },
    { value: 'CORN', label: '🌽 Corn (الذرة)' },
    { value: 'SOYBEAN', label: '🫘 Soybean (فول الصويا)' },
    { value: 'SUGAR', label: '🍬 Sugar (السكر)' },
    { value: 'COFFEE', label: '☕ Coffee (القهوة)' },
    { value: 'COCOA', label: '🍫 Cocoa (الكاكاو)' },
    { value: 'COTTON', label: '🧵 Cotton (القطن)' },
    { value: 'ZINC', label: '⚪ Zinc (الزنك)' },
    { value: 'NICKEL', label: '⚪ Nickel (النيكل)' },
    { value: 'ALUMINUM', label: '⚪ Aluminum (الألومنيوم)' }
];

const INDICES = [
    { value: 'US30', label: '🇺🇸 Dow Jones (US30)' },
    { value: 'SPX500', label: '🇺🇸 S&P 500' },
    { value: 'NAS100', label: '🇺🇸 NASDAQ 100' },
    { value: 'UK100', label: '🇬🇧 FTSE 100' },
    { value: 'GER40', label: '🇩🇪 DAX 40' },
    { value: 'FRA40', label: '🇫🇷 CAC 40' },
    { value: 'JPN225', label: '🇯🇵 Nikkei 225' },
    { value: 'HK50', label: '🇭🇰 Hang Seng' },
    { value: 'AUS200', label: '🇦🇺 ASX 200' },
    { value: 'ESP35', label: '🇪🇸 IBEX 35' },
    { value: 'ITA40', label: '🇮🇹 FTSE MIB' },
    { value: 'CHN50', label: '🇨🇳 China A50' },
    { value: 'IND50', label: '🇮🇳 Nifty 50' },
    { value: 'KOR200', label: '🇰🇷 KOSPI 200' },
    { value: 'SWI20', label: '🇨🇭 SMI 20' },
    { value: 'NLD25', label: '🇳🇱 AEX 25' },
    { value: 'RUS50', label: '🇷🇺 MOEX Russia' },
    { value: 'BRA60', label: '🇧🇷 Bovespa' },
    { value: 'MEX35', label: '🇲🇽 IPC Mexico' },
    { value: 'SAF40', label: '🇿🇦 FTSE/JSE Top 40' }
];

async function loadUserData() {
    try {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData || ''
            })
        });

        const data = await response.json();

        if (data.success) {
            userData = data.user;
            userBalance = parseFloat(userData.balance || 0);
            botUsername = data.botUsername;
            
            // تطبيق لغة المستخدم
            const userLang = userData.language || 'ar';
            const langSelect = document.getElementById('language-select');
            if (langSelect) {
                langSelect.value = userLang;
            }
            
            // تطبيق اتجاه النص حسب اللغة
            const isRTL = userLang === 'ar' || userLang === 'fa' || userLang === 'he';
            document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
            document.documentElement.setAttribute('lang', userLang);
            
            // تطبيق الترجمات
            if (typeof applyTranslations === 'function') {
                applyTranslations();
            }
            
            document.getElementById('loading').style.display = 'none';
            updateUI();
            loadAdminPanel();
        } else {
            throw new Error(data.error || 'فشل تحميل بيانات المستخدم');
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
        console.log('🔍 تفاصيل التشخيص:');
        console.log('- tg object:', tg);
        console.log('- initData:', tg?.initData);
        console.log('- initDataUnsafe:', tg?.initDataUnsafe);
        console.log('- userId:', userId);
        
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <h2 style="color: #ee0979; margin-bottom: 15px;">❌ خطأ في الاتصال</h2>
                <p style="color: #666; margin-bottom: 20px;">${error.message}</p>

                <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: right;">
                    <h3 style="color: #856404; margin-bottom: 10px;">📝 الحلول المقترحة:</h3>
                    <ol style="color: #856404; font-size: 14px; line-height: 2;">
                        <li><strong>تأكد من فتح التطبيق من Telegram:</strong> يجب الضغط على زر "🚀 Open App" في البوت</li>
                        <li><strong>تحديث Telegram:</strong> تأكد من أن لديك أحدث نسخة من Telegram</li>
                        <li><strong>إعادة تشغيل البوت:</strong> أرسل /start للبوت مرة أخرى</li>
                        <li><strong>مسح الكاش:</strong> حاول مسح كاش التطبيق وإعادة المحاولة</li>
                    </ol>
                </div>

                <button onclick="location.reload()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer; margin-top: 20px;">
                    🔄 إعادة المحاولة
                </button>
            </div>
        `;
    }
}

async function init() {
    console.log('🎯 init() called');

    if (!tg) {
        console.error('❌ Telegram WebApp غير متوفر');
        showError('يجب فتح التطبيق من خلال Telegram Bot');
        return;
    }

    try {
        if (!tg.initDataUnsafe?.user?.id) {
            throw new Error('لا يوجد معرف مستخدم من Telegram. يجب فتح التطبيق من خلال البوت.');
        }
        
        userId = tg.initDataUnsafe.user.id;
        console.log('✅ User ID:', userId);

        tg.ready();
        tg.expand();

        // تحميل بيانات المستخدم أولاً
        await loadUserData();
        await loadMyAnalystProfile();
        
        // تحميل لوحة الإدارة للمالك
        await loadAdminPanel();

        // تحميل جميع الأصول بشكل متوازي
        const loadAssetsPromises = [
            loadAllCryptoSymbols().catch(err => {
                console.error('⚠️ Failed to load crypto symbols:', err);
                return CRYPTO_SYMBOLS;
            }),
            (async () => {
                try {
                    generateAllForexPairs();
                    return FOREX_PAIRS;
                } catch (err) {
                    console.error('⚠️ Failed to generate forex pairs:', err);
                    return [];
                }
            })()
        ];

        await Promise.all(loadAssetsPromises);

        console.log('✅ All assets loaded successfully');
        console.log(`📊 Crypto: ${CRYPTO_SYMBOLS.length}, Forex: ${FOREX_PAIRS.length}, Stocks: ${STOCKS.length}`);

        updateUI();
        await updateSymbolsList();
        setupSymbolSearch();
        loadSubscription();
        loadReferralStats();
        loadNotificationSettings();

        document.getElementById('main-content').style.display = 'block';
        document.getElementById('loading').style.display = 'none';

    } catch (error) {
        console.error('❌ خطأ في التهيئة:', error);
        console.error('❌ رسالة الخطأ:', error.message);
        console.error('❌ Stack:', error.stack);
        showError('حدث خطأ في تحميل التطبيق: ' + (error.message || error.toString()));
    }
}

function updateUI() {
    if (!tg.initDataUnsafe?.user) {
        console.error('❌ لا توجد بيانات مستخدم من Telegram');
        return;
    }
    
    const user = tg.initDataUnsafe.user;

    // تحديث الرصيد
    const balanceElements = document.querySelectorAll('#balance, #user-balance');
    balanceElements.forEach(el => {
        if (el) el.textContent = `${userBalance.toFixed(2)} USDT`;
    });

    // تحديث معلومات المستخدم
    const userIdEl = document.getElementById('user-id');
    const userNameEl = document.getElementById('user-name');

    if (userIdEl) userIdEl.textContent = user.id;
    if (userNameEl) userNameEl.textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');

    // تحديث رابط الإحالة
    const refLinkEl = document.getElementById('ref-link');
    if (refLinkEl && botUsername) {
        const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`;
        refLinkEl.textContent = refLink;
    }
}

async function updateSymbolsList() {
    const marketType = document.getElementById('market-type').value;
    const select = document.getElementById('symbol-select');
    const searchInput = document.getElementById('symbol-search');

    let symbols = [];

    try {
        select.innerHTML = '<option>⏳ جاري التحميل...</option>';

        if (marketType === 'crypto') {
            symbols = await loadAllCryptoSymbols();
        } else if (marketType === 'forex') {
            if (FOREX_PAIRS.length === 0) {
                generateAllForexPairs();
            }
            symbols = FOREX_PAIRS;
        } else if (marketType === 'stocks') {
            symbols = await loadAllStocks();
        } else if (marketType === 'commodities') {
            symbols = COMMODITIES;
        } else if (marketType === 'indices') {
            symbols = INDICES;
        }

        if (symbols.length === 0) {
            select.innerHTML = '<option>❌ لا توجد أصول متاحة</option>';
            return;
        }

        select.innerHTML = symbols.map(s => 
            `<option value="${s.value}">${s.label}</option>`
        ).join('');

        // تفعيل البحث
        if (searchInput) {
            searchInput.value = '';
            searchInput.disabled = false;
        }

        console.log(`✅ Loaded ${symbols.length} symbols for ${marketType}`);
    } catch (error) {
        console.error('❌ Error updating symbols list:', error);
        select.innerHTML = '<option>❌ حدث خطأ في التحميل</option>';
    }
}

function showSection(sectionId, event) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }
    
    if (event && event.target) {
        const navBtn = event.target.closest('.nav-btn');
        if (navBtn) {
            navBtn.classList.add('active');
        }
    }

    if (sectionId === 'movers-section') {
        loadMovers();
    }

    if (sectionId === 'analysts-section') {
        loadAnalysts();
    }

    if (sectionId === 'wallet-section') {
        loadTransactions();
    }

    if (sectionId === 'more-section') {
        loadMoreSectionSettings();
    }
}

let searchTimeout = null;
let selectedAssetSymbol = null;

function setupSymbolSearch() {
    const searchInput = document.getElementById('symbol-search');
    const select = document.getElementById('symbol-select');

    if (searchInput) {
        let autocompleteContainer = document.getElementById('autocomplete-results');
        
        if (!autocompleteContainer) {
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.id = 'autocomplete-results';
            autocompleteContainer.className = 'autocomplete-dropdown';
            searchInput.parentElement.style.position = 'relative';
            searchInput.parentElement.appendChild(autocompleteContainer);
        }

        searchInput.addEventListener('input', async function() {
            const searchTerm = this.value.trim();
            const marketType = document.getElementById('market-type').value;

            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            if (searchTerm.length < 1) {
                autocompleteContainer.innerHTML = '';
                autocompleteContainer.style.display = 'none';
                select.innerHTML = '<option>🔍 ابدأ بكتابة اسم الأصل...</option>';
                return;
            }

            autocompleteContainer.innerHTML = '<div class="autocomplete-item loading">⏳ جاري البحث...</div>';
            autocompleteContainer.style.display = 'block';

            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch('/api/search-assets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: searchTerm,
                            market_type: marketType,
                            init_data: tg.initData,
                            limit: 20
                        })
                    });

                    const data = await response.json();

                    if (!data.success) {
                        autocompleteContainer.innerHTML = `<div class="autocomplete-item error">❌ ${data.error}</div>`;
                        return;
                    }

                    if (data.results.length === 0) {
                        autocompleteContainer.innerHTML = '<div class="autocomplete-item no-results">❌ لا توجد نتائج</div>';
                        select.innerHTML = '<option>❌ لا توجد نتائج</option>';
                        return;
                    }

                    autocompleteContainer.innerHTML = data.results.map(asset => {
                        const symbol = asset.symbol || asset.value;
                        const label = asset.label;
                        const marketBadge = getMarketBadge(asset.market_type);
                        
                        return `
                            <div class="autocomplete-item" data-symbol="${symbol}" data-label="${label}">
                                <span class="asset-label">${label}</span>
                                <span class="market-badge">${marketBadge}</span>
                            </div>
                        `;
                    }).join('');

                    select.innerHTML = data.results.map(asset => {
                        const symbol = asset.symbol || asset.value;
                        const label = asset.label;
                        return `<option value="${symbol}">${label}</option>`;
                    }).join('');

                    const autocompleteItems = autocompleteContainer.querySelectorAll('.autocomplete-item');
                    autocompleteItems.forEach(item => {
                        item.addEventListener('click', function() {
                            const symbol = this.getAttribute('data-symbol');
                            const label = this.getAttribute('data-label');
                            
                            searchInput.value = label;
                            selectedAssetSymbol = symbol;
                            
                            select.innerHTML = `<option value="${symbol}" selected>${label}</option>`;
                            
                            autocompleteContainer.innerHTML = '';
                            autocompleteContainer.style.display = 'none';
                        });
                    });

                } catch (error) {
                    console.error('Search error:', error);
                    autocompleteContainer.innerHTML = '<div class="autocomplete-item error">❌ حدث خطأ في البحث</div>';
                }
            }, 300);
        });

        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.style.display = 'none';
            }
        });

        searchInput.addEventListener('focus', function() {
            if (autocompleteContainer.innerHTML && this.value.length >= 1) {
                autocompleteContainer.style.display = 'block';
            }
        });
    }
}

function getMarketBadge(marketType) {
    const badges = {
        'crypto': '💰 كريبتو',
        'forex': '💱 فوركس',
        'stocks': '📈 أسهم',
        'commodities': '🛢️ سلع',
        'indices': '📊 مؤشرات'
    };
    return badges[marketType] || marketType;
}

// استدعاء وظيفة البحث عند تحديث القائمة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSymbolSearch);
} else {
    setupSymbolSearch();
}

async function analyzeMarket() {
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;
    const marketType = document.getElementById('market-type').value;

    const checkboxes = document.querySelectorAll('.indicators-grid input[type="checkbox"]:checked');
    const indicators = Array.from(checkboxes).map(cb => cb.value);

    if (indicators.length === 0) {
        if (tg.showAlert) {
            tg.showAlert('يرجى اختيار مؤشر واحد على الأقل');
        } else {
            alert('يرجى اختيار مؤشر واحد على الأقل');
        }
        return;
    }

    if (tg.MainButton && tg.MainButton.showProgress) {
        tg.MainButton.showProgress();
    }

    try {
        const response = await fetch('/api/analyze-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                symbol,
                timeframe,
                indicators,
                market_type: marketType,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            displayAnalysisResult(data.analysis, symbol, timeframe);
        } else {
            if (tg.showAlert) {
                tg.showAlert(data.error || 'فشل التحليل');
            } else {
                alert(data.error || 'فشل التحليل');
            }
        }
    } catch (error) {
        if (tg.showAlert) {
            tg.showAlert('حدث خطأ في التحليل');
        } else {
            alert('حدث خطأ في التحليل');
        }
    } finally {
        if (tg.MainButton && tg.MainButton.hideProgress) {
            tg.MainButton.hideProgress();
        }
    }
}

function displayAnalysisResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const actionEmoji = analysis.recommendation === 'شراء' || analysis.recommendation === 'BUY' ? '🟢' : 
                       analysis.recommendation === 'بيع' || analysis.recommendation === 'SELL' ? '🔴' : '⚪';
    const actionText = analysis.recommendation === 'شراء' || analysis.recommendation === 'BUY' ? 'شراء' : 
                      analysis.recommendation === 'بيع' || analysis.recommendation === 'SELL' ? 'بيع' : 'انتظار';

    recCard.innerHTML = `
        <div class="rec-header">
            <h2>${actionEmoji} توصية ${actionText}</h2>
            <div class="confidence">قوة الإشارة: ${analysis.confidence || 'متوسطة'}</div>
        </div>
        <div class="rec-details">
            <p><strong>💎 العملة:</strong> ${symbol}</p>
            <p><strong>⏰ الإطار الزمني:</strong> ${timeframe}</p>
            <p><strong>💰 السعر الحالي:</strong> $${analysis.currentPrice || analysis.entryPrice || '-'}</p>
        </div>

        <div class="trade-setup" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px;">📊 إعداد الصفقة</h3>
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <span>🎯 سعر الدخول:</span>
                    <strong>$${analysis.entryPrice || analysis.currentPrice || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,0,0,0.2); border-radius: 8px;">
                    <span>🛑 وقف الخسارة:</span>
                    <strong>$${analysis.stopLoss || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(0,255,0,0.2); border-radius: 8px;">
                    <span>🎁 الهدف:</span>
                    <strong>$${analysis.takeProfit || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <span>📈 نسبة المخاطرة/العائد:</span>
                    <strong>1:${analysis.riskRewardRatio || '-'}</strong>
                </div>
            </div>
        </div>
    `;

    let indicatorsHTML = '<h3 style="margin: 20px 0 15px; color: #fff;">📈 المؤشرات الفنية</h3><div class="indicators-grid">';
    for (const [key, value] of Object.entries(analysis.indicators || {})) {
        let displayValue = '';
        if (typeof value === 'object' && value !== null) {
            if (value.value !== undefined) {
                displayValue = `<div><strong>القيمة:</strong> ${value.value}</div>`;
                displayValue += `<div><strong>الإشارة:</strong> ${value.signal || '-'}</div>`;
                displayValue += `<div><strong>التوصية:</strong> ${value.recommendation || '-'}</div>`;
            } else {
                displayValue = JSON.stringify(value);
            }
        } else {
            displayValue = value;
        }

        indicatorsHTML += `
            <div class="indicator-card">
                <h4>${key}</h4>
                <div class="indicator-value">${displayValue}</div>
            </div>
        `;
    }
    indicatorsHTML += '</div>';
    indDetails.innerHTML = indicatorsHTML;

    resultDiv.style.display = 'block';
}

let currentMoverMarketType = 'crypto';
let currentMoverType = 'gainers';

function setMoverMarketType(marketType, event) {
    currentMoverMarketType = marketType;

    // إزالة active من جميع أزرار نوع السوق
    document.querySelectorAll('.movers-filters:nth-child(3) .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // إضافة active للزر المضغوط
    if (event && event.target) {
        event.target.classList.add('active');
    }

    loadMovers(currentMoverType);
}

async function loadMovers(type, event) {
    currentMoverType = type;

    // تحديث الأزرار النشطة
    document.querySelectorAll('.movers-filters:first-child .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (event && event.target) {
        event.target.classList.add('active');
    }

    const container = document.getElementById('movers-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>جاري التحميل...</p></div>';

    try {
        const response = await fetch('/api/top-movers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                market_type: currentMoverMarketType,
                init_data: tg?.initData
            })
        });

        const data = await response.json();

        if (data.success && data.movers && data.movers.length > 0) {
            container.innerHTML = data.movers.map(coin => {
                const price = typeof coin.price === 'number' ? coin.price : parseFloat(coin.price || 0);
                const change = coin.change || coin.priceChangePercent || 0;
                const priceDisplay = formatPrice(price);

                return `
                <div class="mover-card">
                    <div class="mover-info">
                        <h4>${coin.symbol}${coin.name ? ` - ${coin.name}` : ''}</h4>
                        <p class="mover-price">$${priceDisplay}</p>
                    </div>
                    <div class="mover-change ${change >= 0 ? 'positive' : 'negative'}">
                        ${change >= 0 ? '📈' : '📉'} ${Math.abs(change).toFixed(2)}%
                    </div>
                </div>
            `}).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا توجد بيانات متاحة حالياً</p>';
        }
    } catch (error) {
        console.error('Error loading movers:', error);
        container.innerHTML = '<p class="empty-state">❌ حدث خطأ في تحميل البيانات</p>';
    }
}

async function loadAnalysts() {
    if (!userId) {
        console.warn('⚠️ لا يوجد userId لتحميل المحللين');
        return;
    }

    try {
        const response = await fetch('/api/analysts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('analysts-container');
            if (data.analysts && data.analysts.length > 0) {
                container.innerHTML = data.analysts.map(analyst => {
                    let subscriptionInfo = '';
                    
                    if (analyst.is_subscribed && analyst.subscription_end_date) {
                        const now = new Date();
                        const endDate = new Date(analyst.subscription_end_date);
                        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                        
                        subscriptionInfo = `
                            <div style="margin-top: 10px; padding: 10px; background: #e8f5e9; border-radius: 8px; font-size: 13px;">
                                <div style="color: #2e7d32; margin-bottom: 5px;">⏳ متبقي: ${daysRemaining} يوم</div>
                                <div style="color: #1976d2;">📅 صالح حتى: ${endDate.toLocaleDateString('ar')}</div>
                            </div>
                        `;
                    }
                    
                    return `
                    <div class="analyst-card ${analyst.is_subscribed ? 'subscribed' : ''}">
                        <div class="analyst-header">
                            ${analyst.profile_picture ? `<img src="${analyst.profile_picture}" alt="${analyst.name}" class="analyst-avatar" onerror="this.style.display='none'">` : '<div class="analyst-avatar-placeholder">👤</div>'}
                            <div class="analyst-info">
                                <h4>${analyst.name}</h4>
                                ${analyst.is_subscribed ? '<span class="badge subscribed-badge">✅ مشترك</span>' : ''}
                            </div>
                        </div>
                        <p class="analyst-desc">${analyst.description}</p>
                        <div class="analyst-stats">
                            <span>👥 ${analyst.total_subscribers || 0}</span>
                        </div>
                        <div class="analyst-rating" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                            <button class="rating-btn like-btn" onclick="rateAnalyst('${analyst.id}', true)" style="background: none; border: none; font-size: 32px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">👍</button>
                            <span style="font-size: 18px; font-weight: bold; color: #28a745;">${analyst.likes || 0}</span>
                            <span style="color: #ddd;">|</span>
                            <button class="rating-btn dislike-btn" onclick="rateAnalyst('${analyst.id}', false)" style="background: none; border: none; font-size: 32px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">👎</button>
                            <span style="font-size: 18px; font-weight: bold; color: #dc3545;">${analyst.dislikes || 0}</span>
                        </div>
                        ${subscriptionInfo}
                        <div class="analyst-footer">
                            <span class="price">${analyst.monthly_price} USDT/شهر</span>
                            <button class="subscribe-analyst-btn" onclick="subscribeToAnalyst('${analyst.id}')">
                                ${analyst.is_subscribed ? '🔄 تجديد' : '✅ اشترك'}
                            </button>
                        </div>
                        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                            <button onclick="getAnalystPromoterLink('${analyst.id}', '${analyst.name}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                                🎁 رابط الإحالة (15% عمولة)
                            </button>
                        </div>
                    </div>
                `;
                }).join('');
            } else {
                container.innerHTML = '<p class="empty-state">لا يوجد محللين حالياً</p>';
            }

            // تحميل الاشتراكات النشطة
            if (data.active_subscriptions && data.active_subscriptions.length > 0) {
                const subsContainer = document.getElementById('active-subscriptions');
                subsContainer.innerHTML = data.active_subscriptions.map(sub => {
                    const now = new Date();
                    const endDate = new Date(sub.end_date);
                    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                    
                    return `
                    <div class="subscription-item" style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 15px; margin-bottom: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
                        <div class="sub-info" style="margin-bottom: 12px;">
                            <strong style="font-size: 16px; color: #333;">${sub.analyst_name}</strong>
                            <div style="margin-top: 8px; font-size: 14px; color: #666;">
                                <div>📅 صالح حتى: ${endDate.toLocaleDateString('ar')}</div>
                                <div style="margin-top: 5px;">⏳ الأيام المتبقية: <strong>${daysRemaining}</strong> يوم</div>
                            </div>
                        </div>
                        <button onclick="viewAnalystSignals('${sub.analyst_id}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">📊 عرض الإشارات</button>
                    </div>
                `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading analysts:', error);
    }
}

async function subscribeToAnalyst(analystId) {
    if (!userId) {
        if (tg.showAlert) {
            tg.showAlert('خطأ: لا يمكن تحديد هوية المستخدم');
        }
        return;
    }

    try {
        const response = await fetch('/api/subscribe-analyst', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ تم الاشتراك بنجاح!');
            loadAnalysts();
            loadUserData();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل الاشتراك'));
        }
    } catch (error) {
        tg.showAlert('حدث خطأ في الاشتراك');
    }
}


async function rateAnalyst(analystId, isLike) {
    if (!userId) {
        if (tg.showAlert) {
            tg.showAlert('خطأ: لا يمكن تحديد هوية المستخدم');
        }
        return;
    }

    try {
        const response = await fetch('/api/rate-analyst', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                rating: isLike ? 1 : 0,
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert(isLike ? '✅ شكراً على تقييمك الإيجابي!' : '✅ شكراً على تقييمك!');
            loadAnalysts();
            loadAnalystsByMarket(currentAnalystMarket);
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل التقييم'));
        }
    } catch (error) {
        console.error('Error rating analyst:', error);
        tg.showAlert('حدث خطأ في التقييم');
    }
}

let myAnalystData = null;
let isEditingAnalyst = false;

function showAnalystRegistrationForm() {
    isEditingAnalyst = false;
    document.getElementById('analyst-form-title').textContent = '📝 نموذج التسجيل كمحلل';
    document.getElementById('analyst-submit-btn').textContent = 'تأكيد التسجيل';
    document.getElementById('analyst-registration-form').style.display = 'block';
    document.getElementById('analysts-list').style.display = 'none';
    document.getElementById('my-analyst-profile').style.display = 'none';
    document.getElementById('analyst-register-card').style.display = 'none';
}

function showEditAnalystForm() {
    if (!myAnalystData) return;
    
    isEditingAnalyst = true;
    document.getElementById('analyst-form-title').textContent = '✏️ تعديل بيانات المحلل';
    document.getElementById('analyst-submit-btn').textContent = 'حفظ التعديلات';
    document.getElementById('analyst-description').value = myAnalystData.description;
    document.getElementById('analyst-price').value = myAnalystData.monthly_price;
    
    document.getElementById('market-crypto').checked = myAnalystData.markets && myAnalystData.markets.includes('crypto');
    document.getElementById('market-forex').checked = myAnalystData.markets && myAnalystData.markets.includes('forex');
    document.getElementById('market-stocks').checked = myAnalystData.markets && myAnalystData.markets.includes('stocks');
    document.getElementById('market-commodities').checked = myAnalystData.markets && myAnalystData.markets.includes('commodities');
    document.getElementById('market-indices').checked = myAnalystData.markets && myAnalystData.markets.includes('indices');
    
    document.getElementById('analyst-registration-form').style.display = 'block';
    document.getElementById('analysts-list').style.display = 'none';
    document.getElementById('my-analyst-profile').style.display = 'none';
}

function hideAnalystRegistrationForm() {
    document.getElementById('analyst-registration-form').style.display = 'none';
    document.getElementById('analysts-list').style.display = 'block';
    
    if (myAnalystData) {
        document.getElementById('my-analyst-profile').style.display = 'block';
        document.getElementById('analyst-register-card').style.display = 'none';
    } else {
        document.getElementById('my-analyst-profile').style.display = 'none';
        document.getElementById('analyst-register-card').style.display = 'block';
    }
    
    document.getElementById('analyst-description').value = '';
    document.getElementById('analyst-price').value = '';
    document.getElementById('market-crypto').checked = false;
    document.getElementById('market-forex').checked = false;
    document.getElementById('market-stocks').checked = false;
    document.getElementById('market-commodities').checked = false;
    document.getElementById('market-indices').checked = false;
    isEditingAnalyst = false;
}

async function submitAnalystRegistration() {
    const description = document.getElementById('analyst-description').value.trim();
    const price = parseFloat(document.getElementById('analyst-price').value);
    
    const markets = [];
    if (document.getElementById('market-crypto').checked) markets.push('crypto');
    if (document.getElementById('market-forex').checked) markets.push('forex');
    if (document.getElementById('market-stocks').checked) markets.push('stocks');
    if (document.getElementById('market-commodities').checked) markets.push('commodities');
    if (document.getElementById('market-indices').checked) markets.push('indices');

    if (!description || !price) {
        tg.showAlert('❌ يرجى ملء جميع الحقول');
        return;
    }

    if (markets.length === 0) {
        tg.showAlert('❌ يرجى اختيار سوق واحد على الأقل');
        return;
    }

    if (price < 1) {
        tg.showAlert('❌ السعر يجب أن يكون 1 USDT على الأقل');
        return;
    }

    try {
        const endpoint = isEditingAnalyst ? '/api/update-analyst' : '/api/register-analyst';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                description: description,
                monthly_price: price,
                markets: markets,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert(isEditingAnalyst ? '✅ تم تحديث البيانات بنجاح!' : '✅ تم التسجيل كمحلل بنجاح!');
            hideAnalystRegistrationForm();
            await loadMyAnalystProfile();
            loadAnalysts();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل العملية'));
        }
    } catch (error) {
        console.error('Error with analyst registration:', error);
        tg.showAlert('❌ حدث خطأ في العملية');
    }
}

async function loadMyAnalystProfile() {
    try {
        const response = await fetch('/api/my-analyst-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.analyst) {
            myAnalystData = data.analyst;
            document.getElementById('my-analyst-name').textContent = data.analyst.name;
            
            document.getElementById('my-analyst-desc').textContent = data.analyst.description;
            document.getElementById('my-analyst-price').textContent = data.analyst.monthly_price;
            document.getElementById('my-analyst-subs').textContent = data.analyst.total_subscribers || 0;
            
            const statusEl = document.getElementById('my-analyst-status');
            const toggleBtn = document.getElementById('toggle-analyst-btn');
            
            if (data.analyst.is_active) {
                statusEl.textContent = '✅ نشط';
                statusEl.style.color = '#28a745';
                toggleBtn.innerHTML = '⏸️ إيقاف مؤقت';
                toggleBtn.style.background = '#ffc107';
            } else {
                statusEl.textContent = '⏸️ متوقف';
                statusEl.style.color = '#dc3545';
                toggleBtn.innerHTML = '▶️ تفعيل';
                toggleBtn.style.background = '#28a745';
            }
            
            await loadAnalystReferralLink();
            
            document.getElementById('my-analyst-profile').style.display = 'block';
            document.getElementById('analyst-register-card').style.display = 'none';
        } else {
            myAnalystData = null;
            document.getElementById('my-analyst-profile').style.display = 'none';
            document.getElementById('analyst-register-card').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading analyst profile:', error);
    }
}

async function loadAnalystReferralLink() {
    try {
        const response = await fetch('/api/get-analyst-referral-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.referral_link) {
            document.getElementById('analyst-referral-link').value = data.referral_link;
            document.getElementById('analyst-referral-section').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading analyst referral link:', error);
    }
}

function copyAnalystReferralLink() {
    const linkInput = document.getElementById('analyst-referral-link');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
        tg.showAlert('✅ تم نسخ الرابط! شاركه مع أصدقائك واحصل على 20% عمولة 💰');
    }).catch(() => {
        document.execCommand('copy');
        tg.showAlert('✅ تم نسخ الرابط!');
    });
}

async function getAnalystPromoterLink(analystId, analystName) {
    if (!userId) {
        tg.showAlert('خطأ: لا يمكن تحديد هوية المستخدم');
        return;
    }
    
    try {
        const response = await fetch('/api/get-analyst-promoter-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                analyst_id: analystId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.referral_link) {
            navigator.clipboard.writeText(data.referral_link).then(() => {
                tg.showAlert(`✅ تم نسخ رابط الإحالة للمحلل ${analystName}!\n\nشارك هذا الرابط واحصل على ${data.commission_rate}% عمولة من كل اشتراك! 💰`);
            }).catch(() => {
                tg.showAlert(`رابط الإحالة: ${data.referral_link}\n\nاحصل على ${data.commission_rate}% عمولة!`);
            });
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل الحصول على الرابط'));
        }
    } catch (error) {
        console.error('Error getting analyst promoter link:', error);
        tg.showAlert('❌ حدث خطأ في الحصول على الرابط');
    }
}

async function toggleAnalystStatus() {
    if (!myAnalystData) return;
    
    const newStatus = !myAnalystData.is_active;
    const confirmMsg = newStatus ? 'هل تريد تفعيل حسابك كمحلل؟' : 'هل تريد إيقاف حسابك كمحلل مؤقتاً؟';
    
    tg.showConfirm(confirmMsg, async (confirmed) => {
        if (confirmed) {
            try {
                const response = await fetch('/api/toggle-analyst-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        is_active: newStatus,
                        init_data: tg.initData
                    })
                });

                const data = await response.json();

                if (data.success) {
                    tg.showAlert(newStatus ? '✅ تم تفعيل الحساب!' : '⏸️ تم إيقاف الحساب مؤقتاً!');
                    await loadMyAnalystProfile();
                    loadAnalysts();
                } else {
                    tg.showAlert('❌ ' + (data.error || 'فشل العملية'));
                }
            } catch (error) {
                console.error('Error toggling analyst status:', error);
                tg.showAlert('❌ حدث خطأ');
            }
        }
    });
}

async function deleteAnalystProfile() {
    if (!myAnalystData) return;
    
    tg.showConfirm('⚠️ هل أنت متأكد من حذف حسابك كمحلل؟ لا يمكن التراجع عن هذا الإجراء!', async (confirmed) => {
        if (confirmed) {
            try {
                const response = await fetch('/api/delete-analyst', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        init_data: tg.initData
                    })
                });

                const data = await response.json();

                if (data.success) {
                    tg.showAlert('🗑️ تم حذف حسابك كمحلل');
                    myAnalystData = null;
                    document.getElementById('my-analyst-profile').style.display = 'none';
                    document.getElementById('analyst-register-card').style.display = 'block';
                    loadAnalysts();
                } else {
                    tg.showAlert('❌ ' + (data.error || 'فشل الحذف'));
                }
            } catch (error) {
                console.error('Error deleting analyst:', error);
                tg.showAlert('❌ حدث خطأ في الحذف');
            }
        }
    });
}

function showPostTradeForm() {
    document.getElementById('post-trade-form').style.display = 'block';
    document.getElementById('my-analyst-profile').style.display = 'none';
    document.getElementById('analyst-registration-form').style.display = 'none';
    document.getElementById('analysts-list').style.display = 'none';
}

function hidePostTradeForm() {
    document.getElementById('post-trade-form').style.display = 'none';
    document.getElementById('my-analyst-profile').style.display = 'block';
    document.getElementById('analysts-list').style.display = 'block';
    
    document.getElementById('trade-trading-type').value = 'spot';
    document.getElementById('leverage-field').style.display = 'none';
    document.getElementById('trade-symbol').value = '';
    document.getElementById('trade-entry-price').value = '';
    document.getElementById('trade-target-price').value = '';
    document.getElementById('trade-stop-loss').value = '';
    document.getElementById('trade-analysis').value = '';
}

function toggleLeverage() {
    const tradingType = document.getElementById('trade-trading-type').value;
    const leverageField = document.getElementById('leverage-field');
    
    if (tradingType === 'futures') {
        leverageField.style.display = 'block';
    } else {
        leverageField.style.display = 'none';
    }
}

async function submitTrade() {
    const symbol = document.getElementById('trade-symbol').value.trim();
    const type = document.getElementById('trade-type').value;
    const tradingType = document.getElementById('trade-trading-type').value;
    const leverageValue = document.getElementById('trade-leverage').value;
    const leverage = (tradingType === 'futures' && leverageValue) ? leverageValue : null;
    const entryPrice = parseFloat(document.getElementById('trade-entry-price').value);
    const targetPrice = parseFloat(document.getElementById('trade-target-price').value);
    const stopLoss = parseFloat(document.getElementById('trade-stop-loss').value);
    const timeframe = document.getElementById('trade-timeframe').value;
    const marketType = document.getElementById('trade-market-type').value;
    const analysis = document.getElementById('trade-analysis').value.trim();

    if (!symbol || !entryPrice) {
        tg.showAlert('❌ يرجى تحديد الرمز وسعر الدخول على الأقل');
        return;
    }

    try {
        const response = await fetch('/api/create-room-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData,
                post_data: {
                    symbol: symbol,
                    type: type,
                    trading_type: tradingType,
                    leverage: leverage,
                    entry_price: entryPrice,
                    target_price: targetPrice || null,
                    stop_loss: stopLoss || null,
                    timeframe: timeframe,
                    market_type: marketType,
                    analysis: analysis
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ تم نشر الصفقة بنجاح! تم إرسالها لجميع المشتركين');
            hidePostTradeForm();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل نشر الصفقة'));
        }
    } catch (error) {
        console.error('Error posting trade:', error);
        tg.showAlert('❌ حدث خطأ في نشر الصفقة');
    }
}

function showDeposit() {
    document.getElementById('deposit-form').style.display = 'block';
    document.getElementById('withdraw-form').style.display = 'none';
    
    document.getElementById('deposit-amount-section').style.display = 'block';
    document.getElementById('deposit-loading-section').style.display = 'none';
    document.getElementById('deposit-payment-section').style.display = 'none';
    
    document.getElementById('deposit-amount').value = '10';
}

function hideDeposit() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
    }
    
    currentPaymentAddress = null;
    
    document.getElementById('deposit-form').style.display = 'none';
    document.getElementById('deposit-amount-section').style.display = 'block';
    document.getElementById('deposit-loading-section').style.display = 'none';
    document.getElementById('deposit-payment-section').style.display = 'none';
    document.getElementById('deposit-amount').value = '10';
}

function showWithdraw() {
    document.getElementById('withdraw-form').style.display = 'block';
    document.getElementById('deposit-form').style.display = 'none';
}

function hideWithdraw() {
    document.getElementById('withdraw-form').style.display = 'none';
    document.getElementById('withdraw-address').value = '';
    document.getElementById('withdraw-amount').value = '';
}

async function submitDeposit() {
    const amount = parseFloat(document.getElementById('deposit-amount').value);

    if (!amount || amount < 5) {
        tg.showAlert('الحد الأدنى للإيداع هو 5 USDT');
        return;
    }

    document.getElementById('deposit-amount-section').style.display = 'none';
    document.getElementById('deposit-loading-section').style.display = 'block';

    try {
        const response = await fetch('/api/cryptapi/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                amount: amount,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.payment) {
            currentPaymentAddress = data.payment.payment_address;
            
            document.getElementById('payment-address-text').textContent = data.payment.payment_address;
            document.getElementById('qr-code-image').src = data.payment.qr_code_url;
            
            document.getElementById('deposit-loading-section').style.display = 'none';
            document.getElementById('deposit-payment-section').style.display = 'block';
            
            startPaymentPolling(data.payment.payment_address);
        } else {
            document.getElementById('deposit-loading-section').style.display = 'none';
            document.getElementById('deposit-amount-section').style.display = 'block';
            tg.showAlert('❌ ' + (data.error || 'فشل إنشاء عنوان الدفع'));
        }
    } catch (error) {
        console.error('Error creating payment:', error);
        document.getElementById('deposit-loading-section').style.display = 'none';
        document.getElementById('deposit-amount-section').style.display = 'block';
        tg.showAlert('❌ حدث خطأ في إنشاء عنوان الدفع');
    }
}

async function submitWithdraw() {
    const address = document.getElementById('withdraw-address').value.trim();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    if (!address || !address.match(/^T[A-Za-z1-9]{33}$/)) {
        tg.showAlert('يرجى إدخال عنوان TRC20 صحيح');
        return;
    }

    if (isNaN(amount) || amount < 1) {
        tg.showAlert('يرجى إدخال مبلغ صحيح (1 USDT على الأقل)');
        return;
    }

    const totalWithFee = amount + 1;

    if (totalWithFee > userBalance) {
        tg.showAlert(`رصيدك غير كافٍ! الرصيد الحالي: ${userBalance.toFixed(2)} USDT`);
        return;
    }

    tg.showConfirm(
        `⚡ سحب تلقائي\n\nالمبلغ: ${amount} USDT\nالرسوم: 1 USDT\nالإجمالي: ${totalWithFee} USDT\n\nسيتم معالجة السحب فوراً تلقائياً\nهل أنت متأكد؟`,
        async (confirmed) => {
            if (confirmed) {
                tg.sendData(JSON.stringify({
                    action: 'withdraw',
                    address: address,
                    amount: amount
                }));
                tg.showAlert('⏳ جاري معالجة السحب... سيصلك إشعار بالنتيجة!');
                hideWithdraw();
            }
        }
    );
}

async function subscribe() {
    if (userBalance < 10) {
        tg.showAlert('رصيدك غير كافٍ للاشتراك! الاشتراك يتطلب 10 USDT');
        return;
    }

    tg.showConfirm(
        'هل تريد الاشتراك لمدة شهر مقابل 10 USDT؟',
        async (confirmed) => {
            if (confirmed) {
                tg.sendData(JSON.stringify({
                    action: 'subscribe'
                }));
                tg.showAlert('تم تفعيل الاشتراك بنجاح!');
                setTimeout(() => {
                    loadSubscription();
                    init();
                }, 1000);
            }
        }
    );
}

async function loadTransactions() {
    if (!userId) {
        console.warn('⚠️ لا يوجد userId لتحميل المعاملات');
        return;
    }

    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.transactions && data.transactions.length > 0) {
            const container = document.getElementById('transactions-container');
            container.innerHTML = '';

            data.transactions.slice(0, 5).forEach(tx => {
                const item = document.createElement('div');
                item.className = 'transaction-item';

                const isDeposit = tx.type === 'deposit';
                const icon = isDeposit ? '📥' : '📤';
                const amountClass = isDeposit ? 'positive' : 'negative';
                const sign = isDeposit ? '+' : '-';

                item.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-type">${icon} ${isDeposit ? 'إيداع' : 'سحب'}</div>
                        <div class="transaction-date">${new Date(tx.created_at).toLocaleDateString('ar-SA')}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">${sign}${tx.amount} USDT</div>
                `;

                container.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadSubscription() {
    if (!userId) {
        console.warn('⚠️ لا يوجد userId لتحميل الاشتراك');
        return;
    }

    try {
        const response = await fetch('/api/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            const statusEl = document.getElementById('subscription-status');
            const detailsEl = document.getElementById('sub-details');
            const subscribeBtn = document.getElementById('subscribe-btn');

            if (data.subscription.active) {
                if (data.subscription.type === 'trial') {
                    statusEl.textContent = `🎁 فترة تجريبية (${data.subscription.daysLeft} يوم متبقي)`;
                    detailsEl.innerHTML = `<p>تنتهي الفترة التجريبية قريباً. قم بالاشتراك للاستمرار!</p>`;
                } else {
                    statusEl.textContent = `✅ نشط`;
                    detailsEl.innerHTML = `<p>صالح حتى: ${new Date(data.subscription.expiresAt).toLocaleDateString('ar-SA')}</p>`;
                }
                subscribeBtn.disabled = true;
                subscribeBtn.textContent = 'الاشتراك نشط';
            } else {
                statusEl.textContent = `❌ غير نشط`;
                detailsEl.innerHTML = `<p>قم بتجديد اشتراكك للاستمرار</p>`;
                subscribeBtn.disabled = false;
                subscribeBtn.textContent = 'اشترك الآن';
            }
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

async function loadReferralStats() {
    if (!userId) {
        console.warn('⚠️ لا يوجد userId لتحميل إحصائيات الإحالة');
        return;
    }

    try {
        const response = await fetch('/api/referral-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('referral-count').textContent = data.stats.total_referrals || 0;
            document.getElementById('referral-earnings').textContent = `${(data.stats.total_earnings || 0).toFixed(2)} USDT`;
        }
    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}


async function changeLanguage() {
    const lang = document.getElementById('language-select').value;
    
    if (!userId) {
        tg.showAlert('❌ خطأ: لا يمكن تغيير اللغة');
        return;
    }
    
    try {
        const response = await fetch('/api/change-language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                language: lang,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // حفظ اللغة في localStorage
            localStorage.setItem('user_language', lang);
            
            // تطبيق اتجاه النص حسب اللغة
            const isRTL = lang === 'ar' || lang === 'fa' || lang === 'he';
            document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
            document.documentElement.setAttribute('lang', lang);
            
            // تطبيق الترجمات
            if (typeof applyTranslations === 'function') {
                applyTranslations();
            }
            
            tg.showAlert('✅ تم تغيير اللغة بنجاح!');
            
            // إعادة تحميل الصفحة لتطبيق اللغة الجديدة
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            tg.showAlert('❌ فشل تغيير اللغة: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (error) {
        console.error('Error changing language:', error);
        tg.showAlert('❌ حدث خطأ أثناء تغيير اللغة');
    }
}

function copyPaymentAddress() {
    const address = currentPaymentAddress;
    
    if (!address) {
        tg.showAlert('❌ لا يوجد عنوان للنسخ');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(address).then(() => {
            tg.showAlert('✅ تم نسخ عنوان الدفع!');
        });
    } else {
        const input = document.createElement('input');
        input.value = address;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        tg.showAlert('✅ تم نسخ عنوان الدفع!');
    }
}

function startPaymentPolling(paymentAddress) {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    
    paymentPollingInterval = setInterval(async () => {
        await checkPaymentStatus(paymentAddress);
    }, 12000);
}

async function checkPaymentStatus(paymentAddress) {
    try {
        const response = await fetch(`/api/wallet/payment-status?paymentAddress=${encodeURIComponent(paymentAddress)}&userId=${userId}&initData=${encodeURIComponent(tg.initData)}`);
        const data = await response.json();

        if (data.success) {
            if (data.status === 'completed') {
                if (paymentPollingInterval) {
                    clearInterval(paymentPollingInterval);
                    paymentPollingInterval = null;
                }

                const statusIndicator = document.getElementById('payment-status-indicator');
                statusIndicator.style.background = '#d4edda';
                statusIndicator.style.borderColor = '#28a745';
                statusIndicator.querySelector('p').innerHTML = '✅ <span data-i18n="payment_status_confirmed">تم تأكيد الدفع بنجاح!</span>';
                statusIndicator.querySelector('p').style.color = '#155724';
                
                userBalance = parseFloat(data.balance || userBalance);
                const balanceElements = document.querySelectorAll('#balance, #user-balance');
                balanceElements.forEach(el => {
                    if (el) el.textContent = `${userBalance.toFixed(2)} USDT`;
                });

                tg.showAlert('✅ تم تأكيد الإيداع بنجاح! تم تحديث رصيدك.');
                
                setTimeout(() => {
                    hideDeposit();
                }, 3000);
            }
        }
    } catch (error) {
        console.error('Error checking payment status:', error);
    }
}

function copyReferralLink() {
    const link = document.getElementById('ref-link').textContent;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => {
            tg.showAlert('تم نسخ رابط الإحالة!');
        });
    } else {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        tg.showAlert('تم نسخ رابط الإحالة!');
    }
}

function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <h2 style="color: #ee0979; margin-bottom: 15px;">❌ خطأ</h2>
            <p style="color: #666;">${message}</p>
        </div>
    `;
}

let selectedAnalysisType = 'complete';

function selectAnalysisType(type, event) {
    selectedAnalysisType = type;
    document.querySelectorAll('.analysis-type-card').forEach(card => {
        card.classList.remove('active');
    });
    if (event && event.target) {
        const card = event.target.closest('.analysis-type-card');
        if (card) {
            card.classList.add('active');
        }
    }
}

// Helper function to get current user ID
function getCurrentUserId() {
    if (!userId) {
        throw new Error('User ID is not available. Please open the app from the Telegram bot.');
    }
    return userId;
}

async function loadAllCryptoSymbols() {
    if (CRYPTO_SYMBOLS.length > 100) {
        console.log(`✅ Already loaded ${CRYPTO_SYMBOLS.length} crypto symbols`);
        return CRYPTO_SYMBOLS;
    }

    try {
        console.log('🔍 Fetching ALL crypto symbols from OKX...');
        const response = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT', {
            timeout: 10000
        });
        const data = await response.json();
        
        if (data.data) {
            const usdtPairs = data.data
                .filter(s => s.instId.endsWith('-USDT') && s.state === 'live')
                .map(s => {
                    const symbol = s.instId.replace('-', '');
                    const baseCcy = s.baseCcy;
                    return {
                        value: symbol,
                        label: `💎 ${baseCcy}/USDT`
                    };
                });
            
            CRYPTO_SYMBOLS.length = 0;
            CRYPTO_SYMBOLS.push(...usdtPairs);
            console.log(`✅ Loaded ${CRYPTO_SYMBOLS.length} crypto symbols from OKX (ALL)`);
            return CRYPTO_SYMBOLS;
        }
    } catch (error) {
        console.error('❌ Error loading crypto symbols from OKX:', error);
    }
    
    return CRYPTO_SYMBOLS;
}

async function loadAllStocks() {
    console.log('📊 Loading comprehensive stock list...');
    
    const allStocks = [
        ...STOCKS,
        { value: 'DIS', label: '🎬 Disney' },
        { value: 'PYPL', label: '💳 PayPal' },
        { value: 'INTC', label: '🔷 Intel' },
        { value: 'CSCO', label: '🌐 Cisco' },
        { value: 'CMCSA', label: '📺 Comcast' },
        { value: 'PFE', label: '💊 Pfizer' },
        { value: 'ABBV', label: '💊 AbbVie' },
        { value: 'MRK', label: '💊 Merck' },
        { value: 'T', label: '📱 AT&T' },
        { value: 'VZ', label: '📱 Verizon' },
        { value: 'KO', label: '🥤 Coca-Cola' },
        { value: 'PEP', label: '🥤 PepsiCo' },
        { value: 'MCD', label: '🍔 McDonald\'s' },
        { value: 'NKE', label: '👟 Nike' },
        { value: 'SBUX', label: '☕ Starbucks' },
        { value: 'TGT', label: '🎯 Target' },
        { value: 'COST', label: '🛒 Costco' },
        { value: 'CVX', label: '⛽ Chevron' },
        { value: 'XOM', label: '⛽ ExxonMobil' },
        { value: 'BA', label: '✈️ Boeing' },
        { value: 'CAT', label: '🚜 Caterpillar' },
        { value: 'GE', label: '⚡ General Electric' },
        { value: 'GM', label: '🚗 General Motors' },
        { value: 'F', label: '🚗 Ford' },
        { value: 'UBER', label: '🚕 Uber' },
        { value: 'LYFT', label: '🚕 Lyft' },
        { value: 'ABNB', label: '🏠 Airbnb' },
        { value: 'SPOT', label: '🎵 Spotify' },
        { value: 'TWTR', label: '🐦 Twitter' },
        { value: 'SNAP', label: '👻 Snapchat' },
        { value: 'PINS', label: '📌 Pinterest' },
        { value: 'SQ', label: '💳 Square' },
        { value: 'SHOP', label: '🛍️ Shopify' },
        { value: 'ZM', label: '📹 Zoom' },
        { value: 'DOCU', label: '📄 DocuSign' },
        { value: 'CRM', label: '☁️ Salesforce' },
        { value: 'ORCL', label: '🔷 Oracle' },
        { value: 'IBM', label: '🔷 IBM' },
        { value: 'NOW', label: '☁️ ServiceNow' },
        { value: 'ADBE', label: '🎨 Adobe' },
        { value: 'SONY', label: '🎮 Sony' },
        { value: 'TM', label: '🚗 Toyota' },
        { value: 'HMC', label: '🚗 Honda' },
        { value: 'NIO', label: '🔋 NIO' },
        { value: 'XPEV', label: '🔋 XPeng' },
        { value: 'LI', label: '🔋 Li Auto' },
        { value: 'RIVN', label: '🚙 Rivian' },
        { value: 'LCID', label: '🚗 Lucid' },
        { value: 'PLTR', label: '🔍 Palantir' },
        { value: 'COIN', label: '₿ Coinbase' },
        { value: 'HOOD', label: '📈 Robinhood' },
        { value: 'SoFi', label: '💰 SoFi' }
    ];
    
    STOCKS.length = 0;
    STOCKS.push(...allStocks);
    console.log(`✅ Loaded ${STOCKS.length} stocks`);
    return STOCKS;
}

async function analyzeMarketAdvanced() {
    const symbolSelect = document.getElementById('symbol-select');
    const symbol = symbolSelect ? symbolSelect.value : document.getElementById('symbol')?.value || 'BTCUSDT';
    const timeframe = document.getElementById('timeframe').value;
    const marketType = document.getElementById('market-type').value;
    const tradingType = document.getElementById('trading-type').value;
    const analysisType = selectedAnalysisType;

    const resultDiv = document.getElementById('analysis-result');
    resultDiv.style.display = 'none';

    // عرض رسالة تحميل
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'loading';
    loadingMsg.innerHTML = '<div class="spinner"></div><p>جاري التحليل...</p>';
    document.getElementById('analysis-section').appendChild(loadingMsg);

    try {
        const indicators = ['RSI', 'MACD', 'EMA', 'SMA', 'BBANDS', 'ATR', 'STOCH', 'ADX', 'VOLUME'];
        
        const apiEndpoint = analysisType === 'ultra' ? '/api/analyze-ultra' : 
                            analysisType === 'zero-reversal' ? '/api/analyze-zero-reversal' : 
                            analysisType === 'pump' ? '/api/analyze-pump' :
                            analysisType === 'v1-pro' ? '/api/analyze-v1-pro' :
                            analysisType === 'master' ? '/api/analyze-master' :
                            '/api/analyze-advanced';

        const requestBody = {
            user_id: getCurrentUserId(),
            symbol: symbol,
            timeframe: timeframe,
            market_type: marketType,
            trading_type: tradingType,
            analysis_type: analysisType,
            indicators,
            init_data: tg.initData
        };

        if (analysisType === 'v1-pro') {
            requestBody.balance = userData?.balance || 10000;
        }

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        loadingMsg.remove();

        if (data.success && data.analysis) {
            if (analysisType === 'ultra') {
                displayUltraAnalysisResult(data.analysis, symbol, timeframe);
            } else if (analysisType === 'zero-reversal') {
                displayZeroReversalResult(data.analysis, symbol, timeframe);
            } else if (analysisType === 'pump') {
                displayPumpAnalysisResult(data.analysis, symbol, timeframe);
            } else if (analysisType === 'v1-pro') {
                displayV1ProAnalysisResult(data.analysis, symbol, timeframe);
            } else if (analysisType === 'master') {
                displayMasterAnalysisResult(data.analysis, symbol, timeframe);
            } else {
                displayAdvancedAnalysisResult(data.analysis, symbol, timeframe, analysisType);
            }
        } else {
            alert('❌ خطأ: ' + (data.error || 'فشل التحليل'));
        }
    } catch (error) {
        loadingMsg.remove();
        console.error('Error in analysis:', error);
        alert('❌ حدث خطأ أثناء التحليل: ' + error.message);
    }
}

async function scanBestSignals() {
    const marketType = document.getElementById('market-type').value;
    const timeframe = document.getElementById('timeframe').value;
    const analysisType = selectedAnalysisType;
    
    const resultDiv = document.getElementById('analysis-result');
    resultDiv.style.display = 'none';
    
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'loading';
    loadingMsg.innerHTML = '<div class="spinner"></div><p>🔍 جاري البحث عن أفضل الصفقات...</p>';
    document.getElementById('analysis-section').appendChild(loadingMsg);
    
    try {
        const response = await fetch('/api/scan-best-signals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                market_type: marketType,
                analysis_type: analysisType,
                timeframe: timeframe,
                max_results: 10,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        loadingMsg.remove();
        
        if (data.success && data.signals && data.signals.length > 0) {
            displayBestSignalsResult(data.signals, data.scanned_market, data.analysis_type, data.timeframe);
        } else {
            alert('⚠️ لم يتم العثور على صفقات قوية حالياً\n\nجرب:\n• تغيير نوع السوق\n• تغيير نوع التحليل\n• تغيير الإطار الزمني');
        }
    } catch (error) {
        loadingMsg.remove();
        console.error('Error scanning signals:', error);
        alert('❌ حدث خطأ أثناء البحث: ' + error.message);
    }
}

function displayBestSignalsResult(signals, marketType, analysisType, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    
    const marketEmoji = marketType === 'crypto' ? '💎' : 
                       marketType === 'forex' ? '💱' : 
                       marketType === 'stocks' ? '📈' : 
                       marketType === 'commodities' ? '🛢️' : '📊';
    
    const marketText = marketType === 'crypto' ? 'عملات رقمية' : 
                      marketType === 'forex' ? 'فوركس' : 
                      marketType === 'stocks' ? 'أسهم' : 
                      marketType === 'commodities' ? 'سلع' : 'مؤشرات';
    
    const analysisText = analysisType === 'ultra' ? 'Ultra' : 
                        analysisType === 'zero-reversal' ? 'Zero Reversal' :
                        analysisType === 'v1-pro' ? 'V1 PRO AI' : 
                        analysisType === 'master' ? 'MASTER' : 'Regular';
    
    let html = `
        <div class="rec-header" style="background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
            <h2>🔍 أفضل ${signals.length} صفقات</h2>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
                ${marketEmoji} ${marketText} | ${analysisText} | ⏰ ${timeframe}
            </p>
        </div>
    `;
    
    signals.forEach((signal, index) => {
        const actionEmoji = signal.action === 'شراء' || signal.action === 'BUY' ? '🟢' : '🔴';
        const actionText = signal.action === 'شراء' || signal.action === 'BUY' ? 'شراء' : 'بيع';
        
        // تنسيق الثقة بشكل آمن
        let confidenceText = '';
        if (signal.confidence) {
            confidenceText = signal.confidence;
        } else if (typeof signal.confidenceScore === 'number' && isFinite(signal.confidenceScore)) {
            confidenceText = `${(signal.confidenceScore * 100).toFixed(0)}%`;
        } else {
            confidenceText = 'متوسطة';
        }
        
        // تنسيق نسبة الاتفاق بشكل آمن
        let agreementText = '0%';
        if (typeof signal.agreementPercentage === 'number' && isFinite(signal.agreementPercentage)) {
            agreementText = `${signal.agreementPercentage.toFixed(0)}%`;
        } else if (typeof signal.confidenceScore === 'number' && isFinite(signal.confidenceScore)) {
            agreementText = `${(signal.confidenceScore * 100).toFixed(0)}%`;
        }
        
        html += `
            <div class="signal-card" style="border: 2px solid ${signal.action === 'شراء' || signal.action === 'BUY' ? '#00ff00' : '#ff0000'}; border-radius: 12px; padding: 15px; margin-bottom: 15px; background: linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="margin: 0; font-size: 18px;">${actionEmoji} #${index + 1} - ${signal.symbol}</h3>
                    <div style="background: ${signal.action === 'شراء' || signal.action === 'BUY' ? '#00ff00' : '#ff0000'}; color: black; padding: 5px 12px; border-radius: 8px; font-weight: bold; font-size: 14px;">
                        ${actionText}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                    <div>
                        <strong>💪 الثقة:</strong> ${confidenceText}
                    </div>
                    <div>
                        <strong>📊 الاتفاق:</strong> ${agreementText}
                    </div>
                    <div>
                        <strong>💰 الدخول:</strong> $${parseFloat(signal.entryPrice).toFixed(2)}
                    </div>
                    <div>
                        <strong>🎯 الهدف:</strong> $${parseFloat(signal.takeProfit).toFixed(2)}
                    </div>
                    <div>
                        <strong>🛑 الإيقاف:</strong> $${parseFloat(signal.stopLoss).toFixed(2)}
                    </div>
                    <div>
                        <strong>⚖️ R/R:</strong> ${signal.riskReward || 'N/A'}
                    </div>
                </div>
                
                ${signal.reasons && signal.reasons.length > 0 ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <strong style="font-size: 13px;">📌 أسباب:</strong>
                        <ul style="margin: 5px 0 0 0; padding-right: 20px; font-size: 12px;">
                            ${signal.reasons.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <button onclick="copySignalToClipboard('${signal.symbol}', '${actionText}', '${signal.entryPrice}', '${signal.stopLoss}', '${signal.takeProfit}')" style="margin-top: 10px; width: 100%; padding: 10px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; color: white; cursor: pointer; font-weight: bold;">
                    📋 نسخ الصفقة
                </button>
            </div>
        `;
    });
    
    recCard.innerHTML = html;
    document.getElementById('indicators-details').innerHTML = '';
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function copySignalToClipboard(symbol, action, entry, sl, tp) {
    const text = `
📊 ${symbol}
${action === 'شراء' ? '🟢' : '🔴'} ${action}

💰 الدخول: $${entry}
🛑 الإيقاف: $${sl}
🎯 الهدف: $${tp}
    `.trim();
    
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ تم نسخ الصفقة!');
    }).catch(() => {
        alert('❌ فشل النسخ');
    });
}

function displayAdvancedAnalysisResult(analysis, symbol, timeframe, analysisType) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const actionEmoji = analysis.recommendation === 'شراء' ? '🟢' : 
                       analysis.recommendation === 'بيع' ? '🔴' : '⚪';
    const actionText = analysis.recommendation === 'شراء' ? 'شراء' : 
                      analysis.recommendation === 'بيع' ? 'بيع' : 'انتظار';

    const tradingTypeText = analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊';
    const marketTypeText = analysis.marketType === 'forex' ? 'فوركس 💱' : 'عملات رقمية 💎';

    recCard.innerHTML = `
        <div class="rec-header">
            <h2>${actionEmoji} توصية ${actionText}</h2>
            <div class="confidence">قوة الإشارة: ${analysis.confidence || 'متوسطة'}</div>
            ${analysis.tradingType === 'spot' && analysis.recommendation === 'بيع' ? '<p style="font-size: 12px; margin-top: 8px; color: #ff9800;">ℹ️ البيع في السبوت يتطلب امتلاك العملة</p>' : ''}
        </div>
        <div class="rec-details">
            <p><strong>💎 العملة:</strong> ${symbol}</p>
            <p><strong>📊 النوع:</strong> ${tradingTypeText} | ${marketTypeText}</p>
            <p><strong>⏰ الإطار الزمني:</strong> ${timeframe}</p>
            <p><strong>💰 السعر الحالي:</strong> $${analysis.currentPrice || analysis.entryPrice || '-'}</p>
            <p><strong>🕐 وقت التحليل:</strong> ${analysis.analysisTime || new Date().toLocaleString('ar-SA')}</p>
            ${analysis.leverage && analysis.leverage > 1 ? `<p><strong>⚡ الرافعة المالية:</strong> ${analysis.leverage}x</p>` : ''}
        </div>

        <div class="trade-setup" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px;">📊 إعداد الصفقة</h3>
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <span>🎯 سعر الدخول:</span>
                    <strong>$${analysis.entryPrice || analysis.currentPrice || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,0,0,0.2); border-radius: 8px;">
                    <span>🛑 وقف الخسارة:</span>
                    <strong>$${analysis.stopLoss || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(0,255,0,0.2); border-radius: 8px;">
                    <span>🎁 الهدف:</span>
                    <strong>$${analysis.takeProfit || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                    <span>📈 نسبة المخاطرة/العائد:</span>
                    <strong>1:${analysis.riskRewardRatio || '-'}</strong>
                </div>
            </div>
        </div>
    `;

    let indicatorsHTML = '';

    if (analysisType === 'fibonacci') {
        const fibonacci = analysis.indicators?.FIBONACCI || analysis.allIndicators?.find(i => i.name === 'Fibonacci');
        if (fibonacci) {
            indicatorsHTML = `
                <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 12px; color: #333;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">🎯 تحليل فيبوناتشي</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; color: #333;">
                        <p><strong style="color: #000;">الإشارة:</strong> ${fibonacci.emoji} ${fibonacci.signal}</p>
                        <p><strong style="color: #000;">التوصية:</strong> ${fibonacci.recommendation}</p>
                        <p><strong style="color: #000;">السعر الحالي:</strong> $${fibonacci.currentPrice || '-'}</p>
                    </div>
                    ${fibonacci.levels ? `
                        <div style="display: grid; gap: 8px;">
                            ${Object.entries(fibonacci.levels).map(([level, price]) => `
                                <div style="display: flex; justify-content: space-between; padding: 8px; background: ${fibonacci.currentPrice >= price ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)'}; border-radius: 6px;">
                                    <span>${level}</span>
                                    <strong>$${typeof price === 'number' ? price.toFixed(2) : price}</strong>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    } else if (analysisType === 'patterns') {
        const patterns = analysis.indicators?.CANDLE_PATTERNS || analysis.allIndicators?.find(i => i.name === 'أنماط الشموع');
        if (patterns) {
            indicatorsHTML = `
                <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 12px; color: #333;">
                    <h3 style="color: #667eea; margin-bottom: 15px;">🕯️ أنماط الشموع</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; color: #333;">
                        <p><strong style="color: #000;">الإشارة:</strong> ${patterns.emoji} ${patterns.signal}</p>
                        <p><strong style="color: #000;">التوصية:</strong> ${patterns.recommendation}</p>
                    </div>
                    ${patterns.patterns && patterns.patterns.length > 0 ? `
                        <div style="display: grid; gap: 8px;">
                            ${patterns.patterns.map(pattern => `
                                <div style="padding: 10px; background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); border-radius: 8px; border-right: 4px solid #667eea;">
                                    <strong>${pattern.name}</strong>
                                    <p style="margin: 5px 0; color: #666;">الإشارة: ${pattern.signal}</p>
                                    <p style="margin: 0; color: #888; font-size: 12px;">القوة: ${pattern.strength}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: #888;">لم يتم اكتشاف أنماط واضحة</p>'}
                </div>
            `;
        }
    } else {
        indicatorsHTML = '<h3 style="margin: 20px 0 15px; color: #fff;">📈 المؤشرات الفنية</h3><div class="indicators-grid">';
        const indicators = analysis.indicators || {};
        for (const [key, value] of Object.entries(indicators)) {
            if (key === 'FIBONACCI' || key === 'CANDLE_PATTERNS' || key === 'HEAD_SHOULDERS' || key === 'SUPPORT_RESISTANCE') continue;

            let displayValue = '';
            if (typeof value === 'object' && value !== null) {
                if (value.value !== undefined) {
                    displayValue = `<div><strong>القيمة:</strong> ${value.value}</div>`;
                    displayValue += `<div><strong>الإشارة:</strong> ${value.signal || '-'}</div>`;
                    displayValue += `<div><strong>التوصية:</strong> ${value.recommendation || '-'}</div>`;
                }
            } else {
                displayValue = value;
            }

            indicatorsHTML += `
                <div class="indicator-card">
                    <h4>${key}</h4>
                    <div class="indicator-value">${displayValue}</div>
                </div>
            `;
        }
        indicatorsHTML += '</div>';
    }

    indDetails.innerHTML = indicatorsHTML;
    resultDiv.style.display = 'block';
}

function displayUltraAnalysisResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const actionEmoji = analysis.emoji || (analysis.recommendation === 'شراء' ? '🟢' : 
                       analysis.recommendation === 'بيع' ? '🔴' : '⚪');
    const actionText = analysis.recommendation;

    const tradingTypeText = analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊';
    const marketTypeText = analysis.marketType === 'forex' ? 'فوركس 💱' : 'عملات رقمية 💎';

    recCard.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; margin-bottom: 20px;">
            <h1 style="font-size: 48px; margin: 0;">${actionEmoji}</h1>
            <h2 style="margin: 10px 0;">💎 Ultra Analysis</h2>
            <h3 style="margin: 10px 0; font-size: 24px;">${actionText}</h3>
            <div style="background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 16px;">
                <strong>مستوى الثقة:</strong> ${analysis.confidence}
            </div>
        </div>

        ${analysis.shouldTrade ? `
            <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); padding: 15px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center;">
                <h3 style="margin: 0 0 10px 0;">✅ يفي بجميع المعايير الصارمة</h3>
                <p style="margin: 0; font-size: 14px;">هذه إشارة عالية الجودة - يمكن الاعتماد عليها</p>
            </div>
        ` : ``}

        <div class="rec-details" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <p><strong style="color: #000;">💎 الرمز:</strong> ${symbol}</p>
            <p><strong style="color: #000;">📊 النوع:</strong> ${tradingTypeText} | ${marketTypeText}</p>
            <p><strong style="color: #000;">⏰ الإطار الزمني:</strong> ${timeframe}</p>
            <p><strong style="color: #000;">💰 السعر الحالي:</strong> $${analysis.entryPrice}</p>
            <p><strong style="color: #000;">مستوى المخاطرة:</strong> ${analysis.riskLevel}</p>
            <p><strong style="color: #000;">🕐 وقت التحليل:</strong> ${analysis.analysisTime}</p>
        </div>

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px;">📊 إعداد الصفقة</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                    <span>🎯 سعر الدخول:</span>
                    <strong>$${analysis.entryPrice}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,0,0,0.3); border-radius: 8px;">
                    <span>🛑 وقف الخسارة:</span>
                    <strong>$${analysis.stopLoss} (${analysis.stopLossPercent})</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(0,255,0,0.3); border-radius: 8px;">
                    <span>🎁 الهدف:</span>
                    <strong>$${analysis.takeProfit} (${analysis.takeProfitPercent})</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                    <span>📈 نسبة المخاطرة/العائد:</span>
                    <strong>1:${analysis.riskRewardRatio}</strong>
                </div>
            </div>
        </div>

        ${analysis.scores ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #667eea; margin-bottom: 15px;">📊 نتائج التحليل</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📈 نسبة الشراء:</strong> ${analysis.scores.buyPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📉 نسبة البيع:</strong> ${analysis.scores.sellPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">🎯 نسبة التوافق:</strong> ${analysis.scores.agreementPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">✅ عدد التأكيدات:</strong> ${analysis.scores.confirmations} من ${analysis.scores.totalIndicators}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.conditions ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #667eea; margin-bottom: 15px;">✅ الشروط</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">قوة ADX:</strong> ${analysis.conditions.adxStrength}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">مستوى التوافق:</strong> ${analysis.conditions.agreementLevel}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">تأكيد الحجم:</strong> ${analysis.conditions.volumeConfirmation}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.reasons && analysis.reasons.length > 0 ? `
            <div style="background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #1565c0;">
                <h3 style="color: #1976d2; margin-bottom: 15px;">💡 أسباب التوصية</h3>
                <ul style="margin: 0; padding-right: 20px; color: #1565c0;">
                    ${analysis.reasons.map(r => `<li style="margin-bottom: 8px; color: #1565c0;">${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}


    `;

    indDetails.innerHTML = '';
    resultDiv.style.display = 'block';
}

function displayZeroReversalResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const actionEmoji = analysis.emoji || (analysis.recommendation === 'شراء' ? '💚' : 
                       analysis.recommendation === 'بيع' ? '❤️' : '⚫');
    const actionText = analysis.recommendation;

    const tradingTypeText = analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊';
    const marketTypeText = analysis.marketType === 'forex' ? 'فوركس 💱' : 'عملات رقمية 💎';

    recCard.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%); border-radius: 12px; color: white; margin-bottom: 20px; border: 3px solid #FF0000;">
            <h1 style="font-size: 48px; margin: 0;">${actionEmoji}</h1>
            <h2 style="margin: 10px 0;">⛔ ZERO REVERSAL ANALYSIS</h2>
            <h3 style="margin: 10px 0; font-size: 24px;">${actionText}</h3>
            <div style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 16px;">
                <strong>مستوى الثقة:</strong> ${analysis.confidence}
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 14px; font-weight: bold;">
                احتمال الانعكاس: ${analysis.reversalProbability || '0%'}
            </div>
        </div>

        ${analysis.shouldTrade ? `
            <div style="background: linear-gradient(135deg, #00FF00 0%, #00CC00 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center; border: 3px solid #00FF00;">
                <h2 style="margin: 0 0 10px 0;">✅ صفقة مضمونة 100%</h2>
                <h3 style="margin: 0; font-size: 18px;">جميع الشروط الصارمة متحققة - احتمال انعكاس 0%</h3>
                <p style="margin: 10px 0 0 0; font-size: 14px;">هذه إشارة موثوقة بأعلى معايير الجودة</p>
            </div>
        ` : `
            <div style="background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white; text-align: center;">
                <h2 style="margin: 0 0 10px 0;">⚠️ لا توجد صفقة مضمونة حالياً</h2>
                <p style="margin: 0; font-size: 14px;">السوق لا يحقق المعايير الصارمة جداً المطلوبة للصفقة المضمونة</p>
            </div>
        `}

        <div class="rec-details" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <p><strong style="color: #000;">💎 الرمز:</strong> ${symbol}</p>
            <p><strong style="color: #000;">📊 النوع:</strong> ${tradingTypeText} | ${marketTypeText}</p>
            <p><strong style="color: #000;">⏰ الإطار الزمني:</strong> ${timeframe}</p>
            <p><strong style="color: #000;">💰 السعر الحالي:</strong> $${analysis.entryPrice}</p>
            <p><strong style="color: #000;">مستوى المخاطرة:</strong> ${analysis.riskLevel}</p>
            <p><strong style="color: #000;">🕐 وقت التحليل:</strong> ${analysis.analysisTime}</p>
        </div>

        ${analysis.shouldTrade ? `
            <div style="background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; font-size: 20px;">📊 إعداد الصفقة المضمونة</h3>
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                        <span>🎯 سعر الدخول:</span>
                        <strong>$${analysis.entryPrice}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,0,0,0.3); border-radius: 8px;">
                        <span>🛑 وقف الخسارة:</span>
                        <strong>$${analysis.stopLoss} (${analysis.stopLossPercent})</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(0,255,0,0.3); border-radius: 8px;">
                        <span>🎁 الهدف:</span>
                        <strong>$${analysis.takeProfit} (${analysis.takeProfitPercent})</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                        <span>📈 نسبة المخاطرة/العائد:</span>
                        <strong>1:${analysis.riskRewardRatio}</strong>
                    </div>
                </div>
            </div>
        ` : ''}

        ${analysis.scores ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #FF0000; margin-bottom: 15px;">📊 نتائج التحليل الصارم</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📈 نسبة الشراء:</strong> ${analysis.scores.buyPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📉 نسبة البيع:</strong> ${analysis.scores.sellPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">🎯 نسبة التوافق:</strong> ${analysis.scores.agreementPercentage}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">✅ عدد التأكيدات:</strong> ${analysis.scores.confirmations} من ${analysis.scores.totalIndicators}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.conditions ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #FF0000; margin-bottom: 15px;">✅ معايير Zero Reversal</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">قوة ADX:</strong> ${analysis.conditions.adxStrength}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">مستوى التوافق:</strong> ${analysis.conditions.agreementLevel}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">تأكيد الحجم:</strong> ${analysis.conditions.volumeConfirmation}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.reasons && analysis.reasons.length > 0 ? `
            <div style="background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #1565c0;">
                <h3 style="color: #1976d2; margin-bottom: 15px;">💡 أسباب التوصية</h3>
                <ul style="margin: 0; padding-right: 20px; color: #1565c0;">
                    ${analysis.reasons.map(r => `<li style="margin-bottom: 8px; color: #1565c0;">${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        ${!analysis.shouldTrade && analysis.whyNotTrading && analysis.whyNotTrading.length > 0 ? `
            <div style="background: #ffebee; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #c62828;">
                <h3 style="color: #d32f2f; margin-bottom: 15px;">⚠️ لماذا لا توجد صفقة مضمونة؟</h3>
                <ul style="margin: 0; padding-right: 20px; color: #c62828;">
                    ${analysis.whyNotTrading.map(r => `<li style="margin-bottom: 8px; color: #c62828;">${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;

    indDetails.innerHTML = '';
    resultDiv.style.display = 'block';
}

function displayPumpAnalysisResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const actionEmoji = '🚀';
    const tradingTypeText = analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊';
    const marketTypeText = analysis.marketType === 'forex' ? 'فوركس 💱' : 'عملات رقمية 💎';

    recCard.innerHTML = `
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #FF6B00 0%, #FFA500 100%); border-radius: 12px; color: white; margin-bottom: 20px; border: 3px solid #FF6B00;">
            <h1 style="font-size: 48px; margin: 0;">${actionEmoji}</h1>
            <h2 style="margin: 10px 0;">🚀 PUMP ANALYSIS</h2>
            <h3 style="margin: 10px 0; font-size: 24px;">${analysis.potential || 'تحليل احتمال الارتفاع السريع'}</h3>
            <div style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 8px; margin-top: 15px; font-size: 16px;">
                <strong>احتمال الارتفاع:</strong> ${analysis.potentialPercent || '-'}
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-top: 10px; font-size: 14px; font-weight: bold;">
                مستوى الثقة: ${analysis.confidence || 'متوسط'}
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #FF6B00; margin-bottom: 15px;">📊 معلومات الصفقة</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">💎 العملة:</strong> ${symbol}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📊 النوع:</strong> ${tradingTypeText} | ${marketTypeText}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">⏰ الإطار الزمني:</strong> ${timeframe}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">💰 السعر الحالي:</strong> $${analysis.currentPrice || '-'}
                </div>
            </div>
        </div>

        ${analysis.scores ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #FF6B00; margin-bottom: 15px;">📈 مؤشرات Pump</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📊 نسبة الحجم:</strong> ${analysis.scores.volumeScore || '-'}/100
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">📉 نسبة التجميع:</strong> ${analysis.scores.consolidationScore || '-'}/100
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">🎯 نسبة الزخم:</strong> ${analysis.scores.momentumScore || '-'}/100
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; color: #333;">
                    <strong style="color: #000;">🚀 نسبة الاختراق:</strong> ${analysis.scores.breakoutScore || '-'}/100
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.reasons && analysis.reasons.length > 0 ? `
            <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #2e7d32;">
                <h3 style="color: #388e3c; margin-bottom: 15px;">✅ أسباب احتمال Pump</h3>
                <ul style="margin: 0; padding-right: 20px; color: #2e7d32;">
                    ${analysis.reasons.map(r => `<li style="margin-bottom: 8px; color: #2e7d32;">${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        ${analysis.warnings && analysis.warnings.length > 0 ? `
            <div style="background: #fff3e0; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #e65100;">
                <h3 style="color: #f57c00; margin-bottom: 15px;">⚠️ تحذيرات</h3>
                <ul style="margin: 0; padding-right: 20px; color: #e65100;">
                    ${analysis.warnings.map(w => `<li style="margin-bottom: 8px; color: #e65100;">${w}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;

    indDetails.innerHTML = '';
    resultDiv.style.display = 'block';
}

function displayV1ProAnalysisResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const finalAction = analysis.finalSignal?.action || 'WAIT';
    const actionEmoji = analysis.finalSignal?.emoji || (finalAction === 'BUY' ? '🟢' : finalAction === 'SELL' ? '🔴' : '🟡');
    const actionText = finalAction === 'BUY' ? 'شراء' : finalAction === 'SELL' ? 'بيع' : 'انتظار';
    const confidencePercent = (parseFloat(analysis.finalSignal?.confidence || 0) * 100).toFixed(0);

    const tradingTypeText = analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊';
    const marketTypeText = analysis.marketType === 'forex' ? 'فوركس 💱' : 
                          analysis.marketType === 'stocks' ? 'أسهم 📈' :
                          analysis.marketType === 'commodities' ? 'سلع 🛢️' :
                          analysis.marketType === 'indices' ? 'مؤشرات 📊' : 'عملات رقمية 💎';

    recCard.innerHTML = `
        <div style="text-align: center; padding: 25px; background: linear-gradient(135deg, #00FF00 0%, #00CC00 100%); border-radius: 16px; color: white; margin-bottom: 20px; border: 3px solid #00FF00; box-shadow: 0 8px 24px rgba(0, 255, 0, 0.3);">
            <h1 style="font-size: 56px; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${actionEmoji}</h1>
            <h2 style="margin: 10px 0; font-size: 24px;">🤖 V1 PRO AI ANALYSIS</h2>
            <h3 style="margin: 10px 0; font-size: 28px; font-weight: bold;">${actionText}</h3>
            <div style="background: rgba(255,255,255,0.25); padding: 15px; border-radius: 10px; margin-top: 15px; font-size: 18px;">
                <strong>درجة الثقة:</strong> ${confidencePercent}%
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-top: 10px; font-size: 14px;">
                ذكاء اصطناعي + تحليل مشاعر + إدارة مخاطر
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #00AA00; margin-bottom: 15px;">📊 معلومات الصفقة</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">💎 الرمز:</strong> ${symbol}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">📊 النوع:</strong> ${tradingTypeText} | ${marketTypeText}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">⏰ الإطار الزمني:</strong> ${timeframe}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">💰 السعر الحالي:</strong> $${analysis.currentPrice || '-'}
                </div>
            </div>
        </div>

        ${analysis.trend ? `
        <div style="background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; border: 2px solid #667eea;">
            <h3 style="color: #667eea; margin-bottom: 15px;">📈 تحليل الاتجاه</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">${analysis.trend.emoji} الاتجاه:</strong> ${analysis.trend.direction}
                </div>
                <div style="padding: 10px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">📊 القوة:</strong> ${analysis.trend.strength}
                </div>
                <div style="padding: 10px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">🎯 النقاط:</strong> ${analysis.trend.score}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.sentiment ? `
        <div style="background: linear-gradient(135deg, #FFD70020 0%, #FFA50020 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; border: 2px solid #FFD700;">
            <h3 style="color: #FF8C00; margin-bottom: 15px;">💭 تحليل المشاعر (AI)</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">📊 التصنيف:</strong> ${analysis.sentiment.classification}
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">🎯 درجة الثقة:</strong> ${(parseFloat(analysis.sentiment.confidence) * 100).toFixed(0)}%
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <strong style="color: #000;">📰 عدد الأخبار:</strong> ${analysis.sentiment.newsCount}
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px; color: #666;">
                    <strong style="color: #000;">📝 الملخص:</strong> ${analysis.sentiment.summary}
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.riskManagement ? `
        <div style="background: linear-gradient(135deg, #00FF0020 0%, #00CC0020 100%); padding: 20px; border-radius: 12px; color: #333; margin-bottom: 20px; border: 2px solid #00FF00;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; color: #00AA00;">💼 إدارة المخاطر</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>🎯 سعر الدخول:</strong></span>
                    <strong style="color: #00AA00;">$${analysis.currentPrice || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>🛑 وقف الخسارة:</strong></span>
                    <strong style="color: #FF0000;">$${analysis.riskManagement.stopLoss}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>🎁 جني الأرباح:</strong></span>
                    <strong style="color: #00FF00;">$${analysis.riskManagement.takeProfit}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>📊 حجم المركز:</strong></span>
                    <strong>${analysis.riskManagement.positionSize}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>💵 قيمة المركز:</strong></span>
                    <strong>$${analysis.riskManagement.positionValue}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>⚠️ مبلغ المخاطرة:</strong></span>
                    <strong style="color: #FF6B00;">$${analysis.riskManagement.riskAmount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px;">
                    <span><strong>📈 نسبة R/R:</strong></span>
                    <strong style="color: #667eea;">1:${analysis.riskManagement.riskRewardRatio}</strong>
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.finalSignal?.reasons && analysis.finalSignal.reasons.length > 0 ? `
            <div style="background: #e8f5e9; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #2e7d32;">
                <h3 style="color: #388e3c; margin-bottom: 15px;">✅ أسباب الإشارة</h3>
                <ul style="margin: 0; padding-right: 20px; color: #2e7d32;">
                    ${analysis.finalSignal.reasons.map(r => `<li style="margin-bottom: 8px; color: #2e7d32;">${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        ${analysis.momentum ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #764ba2; margin-bottom: 15px;">⚡ تحليل الزخم</h3>
            <div style="display: grid; gap: 10px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">✅ الحالة:</strong> ${analysis.momentum.isConfirmed ? 'مؤكد' : 'غير مؤكد'}
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <strong style="color: #000;">📊 النقاط:</strong> ${analysis.momentum.score}
                </div>
                ${analysis.momentum.reasons && analysis.momentum.reasons.length > 0 ? `
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <strong style="color: #000;">💡 الأسباب:</strong>
                        <ul style="margin: 5px 0 0 0; padding-right: 20px;">
                            ${analysis.momentum.reasons.map(r => `<li style="font-size: 13px; color: #666;">${r}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        ${analysis.indicators ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333;">
            <h3 style="color: #667eea; margin-bottom: 15px;">📊 المؤشرات الفنية</h3>
            <div style="display: grid; gap: 8px; font-size: 14px;">
                ${analysis.indicators.rsi ? `<div style="padding: 8px; background: #f8f9fa; border-radius: 6px;"><strong>RSI:</strong> ${analysis.indicators.rsi}</div>` : ''}
                ${analysis.indicators.macd ? `<div style="padding: 8px; background: #f8f9fa; border-radius: 6px;"><strong>MACD:</strong> ${analysis.indicators.macd}</div>` : ''}
                ${analysis.indicators.adx ? `<div style="padding: 8px; background: #f8f9fa; border-radius: 6px;"><strong>ADX:</strong> ${analysis.indicators.adx}</div>` : ''}
                ${analysis.indicators.atr ? `<div style="padding: 8px; background: #f8f9fa; border-radius: 6px;"><strong>ATR:</strong> ${analysis.indicators.atr}</div>` : ''}
                ${analysis.indicators.volume ? `<div style="padding: 8px; background: #f8f9fa; border-radius: 6px;"><strong>Volume:</strong> ${analysis.indicators.volume}</div>` : ''}
            </div>
        </div>
        ` : ''}

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 12px; color: white; text-align: center; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">🤖 تحليل V1 PRO يستخدم الذكاء الاصطناعي وتحليل المشاعر وإدارة المخاطر المتقدمة</p>
        </div>
    `;

    indDetails.innerHTML = '';
    resultDiv.style.display = 'block';
}

function displayMasterAnalysisResult(analysis, symbol, timeframe) {
    const resultDiv = document.getElementById('analysis-result');
    const recCard = document.getElementById('recommendation-card');
    const indDetails = document.getElementById('indicators-details');

    const recommendation = analysis.finalRecommendation;
    const scoreGrade = { score: analysis.masterScore, grade: analysis.grade, emoji: analysis.gradeEmoji };

    recCard.innerHTML = `
        <div style="text-align: center; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; color: white; margin-bottom: 20px; box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);">
            <h1 style="font-size: 64px; margin: 0; animation: pulse 2s ease-in-out infinite;">👑</h1>
            <h2 style="margin: 10px 0; font-size: 28px; font-weight: bold;">MASTER ANALYSIS</h2>
            <h3 style="margin: 10px 0; font-size: 32px; font-weight: bold;">${recommendation.actionEmoji} ${recommendation.action}</h3>
            <div style="display: flex; justify-content: center; gap: 15px; margin-top: 20px; flex-wrap: wrap;">
                <div style="background: rgba(255,255,255,0.25); padding: 15px 20px; border-radius: 12px; min-width: 150px;">
                    <div style="font-size: 14px; opacity: 0.9;">التقييم</div>
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">${scoreGrade.emoji} ${scoreGrade.grade}</div>
                </div>
                <div style="background: rgba(255,255,255,0.25); padding: 15px 20px; border-radius: 12px; min-width: 150px;">
                    <div style="font-size: 14px; opacity: 0.9;">النقاط</div>
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">${scoreGrade.score}/100</div>
                </div>
                <div style="background: rgba(255,255,255,0.25); padding: 15px 20px; border-radius: 12px; min-width: 150px;">
                    <div style="font-size: 14px; opacity: 0.9;">الثقة</div>
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">${recommendation.confidenceEmoji} ${recommendation.confidence}</div>
                </div>
            </div>
        </div>

        <div class="rec-details" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
            <p><strong style="color: #000;">💎 الرمز:</strong> ${symbol}</p>
            <p><strong style="color: #000;">💰 السعر الحالي:</strong> $${analysis.currentPrice}</p>
            <p><strong style="color: #000;">⏰ الإطار الزمني:</strong> ${timeframe}</p>
            <p><strong style="color: #000;">📊 نوع السوق:</strong> ${analysis.marketType === 'crypto' ? 'عملات رقمية 💎' : analysis.marketType === 'forex' ? 'فوركس 💱' : analysis.marketType === 'stocks' ? 'أسهم 📈' : analysis.marketType}</p>
            <p><strong style="color: #000;">🔄 نوع التداول:</strong> ${analysis.tradingType === 'futures' ? 'فيوتشر ⚡' : 'سبوت 📊'}</p>
            <p><strong style="color: #000;">🕐 وقت التحليل:</strong> ${analysis.analysisTime}</p>
        </div>

        ${analysis.successProbability ? `
        <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(0,184,148,0.3);">
            <h3 style="margin: 0 0 15px 0; font-size: 22px;">🎲 احتمالية النجاح</h3>
            <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="background: rgba(255,255,255,0.2); border-radius: 20px; height: 40px; position: relative; overflow: hidden;">
                        <div style="background: white; height: 100%; width: ${analysis.successProbability.percentage}%; border-radius: 20px; transition: width 0.8s ease;"></div>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 18px;">${analysis.successProbability.percentage}%</div>
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 36px;">${analysis.successProbability.emoji}</div>
                    <div style="font-size: 16px; margin-top: 5px;">${analysis.successProbability.level}</div>
                </div>
            </div>
        </div>
        ` : ''}

        ${recommendation.entryTiming ? `
        <div style="background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 16px rgba(253,203,110,0.3);">
            <h3 style="margin: 0 0 10px 0; font-size: 22px;">${recommendation.entryTiming.emoji} توقيت الدخول المثالي</h3>
            <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${recommendation.entryTiming.timing}</div>
            <div style="font-size: 14px; opacity: 0.9;">${recommendation.entryTiming.description}</div>
        </div>
        ` : ''}

        ${analysis.entryExitPoints ? `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(102,126,234,0.3);">
            <h3 style="margin: 0 0 15px 0; font-size: 22px;">🎯 نقاط الدخول والخروج</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                    <span><strong>📍 نقطة الدخول المثالية:</strong></span>
                    <span style="font-weight: bold;">${analysis.entryExitPoints.optimalEntry}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                    <span><strong>🛑 وقف الخسارة:</strong></span>
                    <span style="font-weight: bold;">${analysis.entryExitPoints.stopLoss}</span>
                </div>
                ${analysis.entryExitPoints.targets.map((target, index) => `
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                        <span><strong>🎯 الهدف ${target.level}:</strong></span>
                        <span style="font-weight: bold;">${target.price} (R/R: ${target.riskReward})</span>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 8px; margin-top: 5px;">
                    <span><strong>📊 أقرب دعم:</strong></span>
                    <span>${analysis.entryExitPoints.nearestSupport}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                    <span><strong>📊 أقرب مقاومة:</strong></span>
                    <span>${analysis.entryExitPoints.nearestResistance}</span>
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.pricePredictions ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
            <h3 style="color: #667eea; margin-bottom: 15px; font-size: 22px;">🔮 توقعات حركة السعر ${analysis.pricePredictions.directionEmoji}</h3>
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; border-radius: 20px; font-size: 16px;">
                    <strong>الاتجاه المتوقع:</strong> ${analysis.pricePredictions.direction}
                </div>
            </div>
            <div style="display: grid; gap: 12px;">
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                    <div style="font-weight: bold; color: #667eea; margin-bottom: 8px;">📅 خلال 24 ساعة</div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <span>الأدنى: ${analysis.pricePredictions.predictions.next24h.min}</span>
                        <span>المتوقع: <strong>${analysis.pricePredictions.predictions.next24h.likely}</strong></span>
                        <span>الأقصى: ${analysis.pricePredictions.predictions.next24h.max}</span>
                    </div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #764ba2;">
                    <div style="font-weight: bold; color: #764ba2; margin-bottom: 8px;">📅 خلال 48 ساعة</div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <span>الأدنى: ${analysis.pricePredictions.predictions.next48h.min}</span>
                        <span>المتوقع: <strong>${analysis.pricePredictions.predictions.next48h.likely}</strong></span>
                        <span>الأقصى: ${analysis.pricePredictions.predictions.next48h.max}</span>
                    </div>
                </div>
                <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #00b894;">
                    <div style="font-weight: bold; color: #00b894; margin-bottom: 8px;">📅 خلال 72 ساعة</div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <span>الأدنى: ${analysis.pricePredictions.predictions.next72h.min}</span>
                        <span>المتوقع: <strong>${analysis.pricePredictions.predictions.next72h.likely}</strong></span>
                        <span>الأقصى: ${analysis.pricePredictions.predictions.next72h.max}</span>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        ${analysis.heatmap && analysis.heatmap.length > 0 ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
            <h3 style="color: #667eea; margin-bottom: 15px; font-size: 22px;">🌡️ خريطة حرارية للمؤشرات</h3>
            <div style="display: grid; gap: 10px;">
                ${analysis.heatmap.map(indicator => {
                    const heatColor = indicator.heat >= 80 ? '#e74c3c' : 
                                      indicator.heat >= 60 ? '#e67e22' : 
                                      indicator.heat >= 40 ? '#f39c12' : '#2ecc71';
                    return `
                        <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${heatColor};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <strong>${indicator.name}</strong>
                                <span style="background: ${heatColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">${indicator.heat.toFixed(0)}°</span>
                            </div>
                            <div style="font-size: 13px; color: #666; margin-top: 5px;">${indicator.signal}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}

        ${analysis.multiTimeframe && Object.keys(analysis.multiTimeframe).length > 0 ? `
        <div style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; color: #333; box-shadow: 0 4px 16px rgba(0,0,0,0.1);">
            <h3 style="color: #667eea; margin-bottom: 15px; font-size: 22px;">🌍 تحليل متعدد الأطر الزمنية</h3>
            <div style="display: grid; gap: 10px;">
                ${Object.entries(analysis.multiTimeframe).map(([tf, data]) => `
                    <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 16px;">${tf}</strong>
                                <div style="margin-top: 5px; font-size: 13px; color: #666;">
                                    ${data.trend.emoji} ${data.trend.direction} | قوة: ${data.strength}%
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 12px; color: #666;">RSI: ${data.rsi.toFixed(1)}</div>
                                <div style="font-size: 12px; color: #666;">ADX: ${data.adxStrength.toFixed(1)}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${recommendation.riskLevel ? `
        <div style="background: linear-gradient(135deg, ${recommendation.riskLevel.emoji === '🟢' ? '#00b894, #00cec9' : recommendation.riskLevel.emoji === '🟡' ? '#fdcb6e, #e17055' : '#d63031, #e17055'}); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
            <h3 style="margin: 0 0 10px 0; font-size: 22px;">${recommendation.riskLevel.emoji} مستوى المخاطرة</h3>
            <div style="font-size: 24px; font-weight: bold; margin: 10px 0;">${recommendation.riskLevel.level}</div>
            <div style="font-size: 14px; opacity: 0.9;">${recommendation.riskLevel.description}</div>
        </div>
        ` : ''}

        ${recommendation.reasons && recommendation.reasons.length > 0 ? `
        <div style="background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(0,184,148,0.3);">
            <h3 style="margin: 0 0 15px 0; font-size: 22px;">✅ الأسباب الإيجابية</h3>
            <ul style="margin: 0; padding-right: 20px;">
                ${recommendation.reasons.map(reason => `<li style="margin: 8px 0; font-size: 15px;">${reason}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${recommendation.warnings && recommendation.warnings.length > 0 ? `
        <div style="background: linear-gradient(135deg, #e17055 0%, #d63031 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(225,112,85,0.3);">
            <h3 style="margin: 0 0 15px 0; font-size: 22px;">⚠️ التحذيرات</h3>
            <ul style="margin: 0; padding-right: 20px;">
                ${recommendation.warnings.map(warning => `<li style="margin: 8px 0; font-size: 15px;">${warning}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${analysis.tips && analysis.tips.length > 0 ? `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(102,126,234,0.3);">
            <h3 style="margin: 0 0 15px 0; font-size: 22px;">💡 نصائح ذكية</h3>
            <ul style="margin: 0; padding-right: 20px;">
                ${analysis.tips.map(tip => `<li style="margin: 8px 0; font-size: 15px;">${tip}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 12px; color: white; text-align: center; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">👑 MASTER ANALYSIS - التحليل الأسطوري الشامل مع تحليل متعدد الأطر الزمنية وتوقعات ذكية</p>
        </div>
    `;

    indDetails.innerHTML = '';
    resultDiv.style.display = 'block';
}

function switchAnalystTab(tab, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.analysts-tab-content').forEach(content => content.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (tab === 'all') {
        const allTab = document.getElementById('all-analysts-tab');
        if (allTab) allTab.classList.add('active');
    } else if (tab === 'crypto') {
        const cryptoTab = document.getElementById('crypto-analysts-tab');
        if (cryptoTab) cryptoTab.classList.add('active');
        loadAnalystsByMarket('crypto');
    } else if (tab === 'forex') {
        const forexTab = document.getElementById('forex-analysts-tab');
        if (forexTab) forexTab.classList.add('active');
        loadAnalystsByMarket('forex');
    } else if (tab === 'stocks') {
        const stocksTab = document.getElementById('stocks-analysts-tab');
        if (stocksTab) stocksTab.classList.add('active');
        loadAnalystsByMarket('stocks');
    } else if (tab === 'commodities') {
        const commoditiesTab = document.getElementById('commodities-analysts-tab');
        if (commoditiesTab) commoditiesTab.classList.add('active');
        loadAnalystsByMarket('commodities');
    } else if (tab === 'indices') {
        const indicesTab = document.getElementById('indices-analysts-tab');
        if (indicesTab) indicesTab.classList.add('active');
        loadAnalystsByMarket('indices');
    } else if (tab === 'active') {
        const activeTab = document.getElementById('active-analysts-tab');
        if (activeTab) activeTab.classList.add('active');
        loadActiveAnalysts();
    } else if (tab === 'inactive') {
        const inactiveTab = document.getElementById('inactive-analysts-tab');
        if (inactiveTab) inactiveTab.classList.add('active');
        loadInactiveAnalysts();
    } else if (tab === 'top100') {
        const top100Tab = document.getElementById('top100-analysts-tab');
        if (top100Tab) top100Tab.classList.add('active');
        loadTop100Analysts();
    } else if (tab === 'subscriptions') {
        const subsTab = document.getElementById('subscriptions-analysts-tab');
        if (subsTab) subsTab.classList.add('active');
        loadAnalysts();
    }
}

async function loadAnalystsByMarket(marketType) {
    const container = document.getElementById(`${marketType}-analysts-container`);
    if (!container) return;
    
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/analysts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.analysts) {
            const filteredAnalysts = data.analysts.filter(analyst => 
                analyst.markets && analyst.markets.includes(marketType)
            );
            
            if (filteredAnalysts.length === 0) {
                container.innerHTML = '<p class="empty-state">لا يوجد محللين في هذا السوق</p>';
                return;
            }
            
            const marketIcons = {
                'crypto': '💎',
                'forex': '💱',
                'stocks': '📈',
                'commodities': '🛢️',
                'indices': '📊'
            };
            
            container.innerHTML = filteredAnalysts.map(analyst => `
                <div class="analyst-card">
                    <div class="analyst-header">
                        ${analyst.profile_picture ? `<img src="${analyst.profile_picture}" alt="${analyst.name}" class="analyst-avatar" onerror="this.style.display='none'">` : '<div class="analyst-avatar-placeholder">👤</div>'}
                        <div class="analyst-info">
                            <h4>${analyst.name}</h4>
                            ${analyst.is_subscribed ? '<span class="badge subscribed-badge">✅ مشترك</span>' : ''}
                        </div>
                    </div>
                    <p class="analyst-desc">${analyst.description}</p>
                    <div class="analyst-markets" style="margin: 10px 0; display: flex; gap: 5px; flex-wrap: wrap;">
                        ${analyst.markets && analyst.markets.map(m => 
                            `<span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${marketIcons[m] || ''} ${m}</span>`
                        ).join('')}
                    </div>
                    <div class="analyst-stats">
                        <span>👥 ${analyst.total_subscribers || 0}</span>
                    </div>
                    <div class="analyst-rating" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <button class="rating-btn like-btn" onclick="rateAnalyst('${analyst.id}', true)" style="background: none; border: none; font-size: 32px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">👍</button>
                        <span style="font-size: 18px; font-weight: bold; color: #28a745;">${analyst.likes || 0}</span>
                        <span style="color: #ddd;">|</span>
                        <button class="rating-btn dislike-btn" onclick="rateAnalyst('${analyst.id}', false)" style="background: none; border: none; font-size: 32px; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">👎</button>
                        <span style="font-size: 18px; font-weight: bold; color: #dc3545;">${analyst.dislikes || 0}</span>
                    </div>
                    <div class="analyst-footer">
                        <span class="price">${analyst.monthly_price} USDT/شهر</span>
                        <button class="subscribe-analyst-btn" onclick="subscribeToAnalyst('${analyst.id}')">
                            ${analyst.is_subscribed ? '🔄 تجديد' : '✅ اشترك'}
                        </button>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <button onclick="getAnalystPromoterLink('${analyst.id}', '${analyst.name}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                            🎁 رابط الإحالة (15% عمولة)
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">فشل تحميل المحللين</p>';
        }
    } catch (error) {
        console.error('Error loading analysts by market:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function loadActiveAnalysts() {
    const container = document.getElementById('active-analysts-container');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';

    try {
        const response = await fetch('/api/analysts-by-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_active: true,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.analysts && data.analysts.length > 0) {
            container.innerHTML = data.analysts.map(analyst => `
                <div class="analyst-card">
                    <div class="analyst-header">
                        <h4>${analyst.name}</h4>
                        <span class="analyst-price">${analyst.monthly_price} USDT/شهر</span>
                    </div>
                    <p class="analyst-desc">${analyst.description}</p>
                    <div class="analyst-stats">
                        <span>👥 ${analyst.total_subscribers || 0} مشترك</span>
                        <span class="analyst-status active">✅ نشط</span>
                    </div>
                    ${userId !== analyst.user_id ? `<button class="subscribe-btn" onclick="subscribeToAnalyst('${analyst._id}')">اشتراك</button>` : ''}
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <button onclick="getAnalystPromoterLink('${analyst._id}', '${analyst.name}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                            🎁 رابط الإحالة (15% عمولة)
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا يوجد محللين نشطين حالياً</p>';
        }
    } catch (error) {
        console.error('Error loading active analysts:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function loadInactiveAnalysts() {
    const container = document.getElementById('inactive-analysts-container');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';

    try {
        const response = await fetch('/api/analysts-by-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_active: false,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.analysts && data.analysts.length > 0) {
            container.innerHTML = data.analysts.map(analyst => `
                <div class="analyst-card inactive">
                    <div class="analyst-header">
                        ${analyst.profile_picture ? `<img src="${analyst.profile_picture}" alt="${analyst.name}" class="analyst-avatar" onerror="this.style.display='none'">` : '<div class="analyst-avatar-placeholder">👤</div>'}
                        <div class="analyst-info">
                            <h4>${analyst.name}</h4>
                            <span class="analyst-price">${analyst.monthly_price} USDT/شهر</span>
                        </div>
                    </div>
                    <p class="analyst-desc">${analyst.description}</p>
                    <div class="analyst-stats">
                        <span>👥 ${analyst.total_subscribers || 0} مشترك</span>
                        <span class="analyst-status inactive">⏸️ متوقف</span>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا يوجد محللين متوقفين</p>';
        }
    } catch (error) {
        console.error('Error loading inactive analysts:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

let currentTop100Market = 'all';

function switchTop100Market(marketType, event) {
    document.querySelectorAll('.top100-market-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = '#333';
        btn.style.border = '1px solid #ddd';
    });
    
    if (event && event.target) {
        event.target.classList.add('active');
        event.target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        event.target.style.color = 'white';
        event.target.style.border = 'none';
    }
    
    currentTop100Market = marketType;
    loadTop100Analysts(marketType);
}

async function loadTop100Analysts(marketType = 'all') {
    const container = document.getElementById('top100-container');
    container.innerHTML = '<p class="empty-state">جاري تحميل الترتيب...</p>';

    const marketIcons = {
        'crypto': '💎',
        'forex': '💱',
        'stocks': '📈',
        'commodities': '🛢️',
        'indices': '📊'
    };

    try {
        const response = await fetch('/api/top-analysts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                init_data: tg.initData,
                market_type: marketType === 'all' ? null : marketType
            })
        });

        const data = await response.json();

        if (data.success && data.analysts && data.analysts.length > 0) {
            container.innerHTML = data.analysts.map((analyst, index) => `
                <div class="top-analyst-card ${index >= 3 ? 'scrollable' : 'sticky-top'}" style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); color: #333; ${index < 3 ? 'position: sticky; top: ' + (index * 5) + 'px; z-index: ' + (100 - index) + ';' : ''}">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${analyst.rank <= 3 ? '#FFD700' : '#667eea'}; min-width: 40px;">#${analyst.rank}</div>
                        ${analyst.profile_picture ? `<img src="${analyst.profile_picture}" alt="${analyst.analyst_name || analyst.name}" class="analyst-avatar" onerror="this.style.display='none'" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid ${analyst.rank <= 3 ? '#FFD700' : '#667eea'};">` : '<div class="analyst-avatar-placeholder" style="width: 50px; height: 50px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>'}
                        <div style="flex: 1;">
                            <h4 style="margin: 0; color: #333;">${analyst.analyst_name || analyst.name}</h4>
                            <p style="margin: 5px 0; color: #666; font-size: 14px;">
                                ${marketType !== 'all' ? marketIcons[marketType] + ' ' : ''}👍 ${analyst.likes || 0} إعجاب
                            </p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 18px; font-weight: bold; color: #10b981;">${(analyst.success_rate || 0).toFixed(1)}%</div>
                            <div style="font-size: 11px; color: #888;">نسبة النجاح</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                        <div style="text-align: center;">
                            <div style="font-size: 16px; font-weight: bold; color: #10b981;">${analyst.successful_trades || 0}</div>
                            <div style="font-size: 10px; color: #888;">صفقات ناجحة</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 16px; font-weight: bold; color: #ef4444;">${analyst.failed_trades || 0}</div>
                            <div style="font-size: 10px; color: #888;">صفقات فاشلة</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 16px; font-weight: bold; color: #667eea;">${analyst.total_subscribers || 0}</div>
                            <div style="font-size: 10px; color: #888;">مشتركين</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 16px; font-weight: bold; color: #667eea;">${analyst.monthly_price || 0} USDT/شهر</span>
                        <button class="subscribe-analyst-btn" onclick="subscribeToAnalyst('${analyst.analyst_id || analyst._id}')" style="padding: 8px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                            ${analyst.is_subscribed ? '🔄 تجديد' : '✅ اشترك'}
                        </button>
                    </div>
                    <div style="margin-top: 10px;">
                        <button onclick="getAnalystPromoterLink('${analyst.analyst_id || analyst._id}', '${analyst.analyst_name || analyst.name}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
                            🎁 رابط الإحالة (15% عمولة)
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا توجد بيانات كافية للترتيب</p>';
        }
    } catch (error) {
        console.error('Error loading top analysts:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في تحميل الترتيب</p>';
    }
}

// Admin Functions
const OWNER_ID = 7594466342;

async function loadAdminPanel() {
    if (userId !== OWNER_ID) {
        return;
    }
    
    // إظهار زر الإدارة
    document.getElementById('admin-nav-btn').style.display = 'flex';
    
    // تحميل الإحصائيات
    loadAdminStats();
}

function switchAdminTab(tab) {
    const tabs = {
        'stats': { element: 'admin-stats-tab', load: loadAdminStats },
        'revenue': { element: 'admin-revenue-tab', load: loadAdvancedStats },
        'users': { element: 'admin-users-tab', load: loadAllUsers },
        'analysts': { element: 'admin-analysts-tab', load: loadAdminAnalysts },
        'withdrawals': { element: 'admin-withdrawals-tab', load: loadAdminWithdrawals },
        'transactions': { element: 'admin-transactions-tab', load: loadAdminTransactions },
        'system': { element: 'admin-system-tab', load: loadAdvancedStats },
        'broadcast': { element: 'admin-broadcast-tab', load: null }
    };
    
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'white';
        btn.style.color = '#333';
        btn.style.border = '1px solid #ddd';
    });
    
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const activeBtn = event?.target.closest('.admin-tab-btn');
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'linear-gradient(135deg, #00D9FF 0%, #A855F7 100%)';
        activeBtn.style.color = 'white';
        activeBtn.style.border = 'none';
    }
    
    const tabInfo = tabs[tab];
    if (tabInfo) {
        document.getElementById(tabInfo.element).style.display = 'block';
        if (tabInfo.load) {
            tabInfo.load();
        }
    }
}

async function loadAllUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.users) {
            container.innerHTML = data.users.map(user => `
                <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: #333;">${user.first_name || 'مستخدم'} ${user.last_name || ''}</h4>
                            <p style="margin: 0; color: #888; font-size: 12px;">ID: ${user.user_id}</p>
                            <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">@${user.username || 'لا يوجد'}</p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 16px; font-weight: bold; color: #10b981;">${user.balance || 0} USDT</div>
                            ${user.is_banned ? '<span style="color: red; font-size: 12px;">🚫 محظور</span>' : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        <button onclick="banUserPrompt('${user.user_id}')" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #ef4444; color: white; cursor: pointer; font-size: 12px;">🚫 حظر</button>
                        <button onclick="banUserTempPrompt('${user.user_id}')" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #f59e0b; color: white; cursor: pointer; font-size: 12px;">⏰ حظر مؤقت</button>
                        <button onclick="deleteUserPrompt('${user.user_id}')" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #dc2626; color: white; cursor: pointer; font-size: 12px;">🗑️ حذف</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا يوجد مستخدمين</p>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function loadBannedUsers() {
    const container = document.getElementById('banned-users-list');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/banned-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.users && data.users.length > 0) {
            container.innerHTML = data.users.map(user => `
                <div style="background: #fee; padding: 15px; border-radius: 10px; border: 2px solid #ef4444;">
                    <div style="margin-bottom: 10px;">
                        <h4 style="margin: 0 0 5px 0; color: #333;">${user.first_name || 'مستخدم'} ${user.last_name || ''}</h4>
                        <p style="margin: 0; color: #888; font-size: 12px;">ID: ${user.user_id}</p>
                        <p style="margin: 5px 0 0 0; color: #ef4444; font-size: 13px;">السبب: ${user.ban_reason || 'لم يحدد'}</p>
                        ${user.ban_expires ? `<p style="margin: 5px 0 0 0; color: #f59e0b; font-size: 12px;">ينتهي: ${new Date(user.ban_expires).toLocaleString('ar')}</p>` : '<p style="margin: 5px 0 0 0; color: #dc2626; font-size: 12px;">حظر دائم</p>'}
                    </div>
                    <button onclick="unbanUser('${user.user_id}')" style="width: 100%; padding: 10px; border: none; border-radius: 6px; background: #10b981; color: white; cursor: pointer;">✅ إلغاء الحظر</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا يوجد مستخدمين محظورين</p>';
        }
    } catch (error) {
        console.error('Error loading banned users:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

function banUserPrompt(targetUserId) {
    const reason = prompt('أدخل سبب الحظر:');
    if (!reason) return;
    banUserAction(targetUserId, reason, null);
}

function banUserTempPrompt(targetUserId) {
    const reason = prompt('أدخل سبب الحظر:');
    if (!reason) return;
    const hours = prompt('أدخل مدة الحظر بالساعات:');
    if (!hours) return;
    banUserAction(targetUserId, reason, parseInt(hours));
}

async function banUserAction(targetUserId, reason, duration) {
    try {
        const response = await fetch('/api/admin/ban-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                target_user_id: targetUserId,
                reason: reason,
                duration: duration,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert('✅ تم حظر المستخدم بنجاح');
            loadAllUsers();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل الحظر'));
        }
    } catch (error) {
        tg.showAlert('حدث خطأ');
    }
}

async function unbanUser(targetUserId) {
    if (!confirm('هل تريد إلغاء حظر هذا المستخدم؟')) return;
    
    try {
        const response = await fetch('/api/admin/unban-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                target_user_id: targetUserId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert('✅ تم إلغاء الحظر بنجاح');
            loadBannedUsers();
            loadAllUsers();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل إلغاء الحظر'));
        }
    } catch (error) {
        tg.showAlert('حدث خطأ');
    }
}

function deleteUserPrompt(targetUserId) {
    if (!confirm('⚠️ تحذير: سيتم حذف جميع بيانات المستخدم بشكل نهائي. هل أنت متأكد؟')) return;
    
    deleteUserAction(targetUserId);
}

async function deleteUserAction(targetUserId) {
    try {
        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                target_user_id: targetUserId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert('✅ تم حذف المستخدم بنجاح');
            loadAllUsers();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل الحذف'));
        }
    } catch (error) {
        tg.showAlert('حدث خطأ');
    }
}

async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            const stats = data.stats;
            document.getElementById('stat-total-users').textContent = stats.total_users;
            document.getElementById('stat-active-today').textContent = stats.active_users_today;
            document.getElementById('stat-active-week').textContent = stats.active_users_week;
            document.getElementById('stat-total-balance').textContent = stats.total_balance + ' USDT';
            document.getElementById('stat-subscriptions').textContent = stats.total_subscriptions;
            document.getElementById('stat-analysts').textContent = stats.total_analysts;
            document.getElementById('stat-transactions').textContent = stats.total_transactions;
            document.getElementById('stat-pending-withdrawals').textContent = stats.total_withdrawals_pending;
            document.getElementById('stat-referral-earnings').textContent = stats.total_referral_earnings + ' USDT';
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

async function loadAdvancedStats() {
    try {
        const response = await fetch('/api/admin/advanced-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            const stats = data.stats;
            
            // الأرباح
            if (stats.revenue) {
                document.getElementById('revenue-subscriptions').textContent = stats.revenue.bot_subscriptions + ' USDT';
                document.getElementById('revenue-analysts').textContent = stats.revenue.analyst_commissions + ' USDT';
                document.getElementById('revenue-deposits').textContent = stats.revenue.total_deposits + ' USDT';
                document.getElementById('revenue-total').textContent = stats.revenue.total_revenue + ' USDT';
            }
            
            // السحوبات
            if (stats.withdrawals) {
                document.getElementById('withdrawal-pending').textContent = stats.withdrawals.pending;
                document.getElementById('withdrawal-completed').textContent = stats.withdrawals.completed;
                document.getElementById('withdrawal-rejected').textContent = stats.withdrawals.rejected;
                document.getElementById('withdrawal-failed').textContent = stats.withdrawals.failed;
                document.getElementById('withdrawal-pending-amount').textContent = stats.withdrawals.total_pending_amount.toFixed(2) + ' USDT';
                document.getElementById('withdrawal-completed-amount').textContent = stats.withdrawals.total_completed_amount.toFixed(2) + ' USDT';
            }
            
            // قاعدة البيانات
            if (stats.database) {
                document.getElementById('db-total-users').textContent = stats.database.total_users;
                document.getElementById('db-total-analysts').textContent = stats.database.total_analysts;
                document.getElementById('db-total-transactions').textContent = stats.database.total_transactions;
                document.getElementById('db-total-withdrawals').textContent = stats.database.total_withdrawals;
                document.getElementById('db-analyst-subs').textContent = stats.database.total_analyst_subscriptions;
                document.getElementById('db-active-analyst-subs').textContent = stats.database.active_analyst_subscriptions;
            }
            
            // النظام
            if (stats.system) {
                const uptimeHours = Math.floor(stats.system.uptime / 3600);
                const uptimeMinutes = Math.floor((stats.system.uptime % 3600) / 60);
                document.getElementById('system-uptime').textContent = `${uptimeHours}س ${uptimeMinutes}د`;
                
                const memoryMB = (stats.system.memory_usage.heapUsed / 1024 / 1024).toFixed(0);
                const memoryTotalMB = (stats.system.memory_usage.heapTotal / 1024 / 1024).toFixed(0);
                document.getElementById('system-memory').textContent = `${memoryMB} / ${memoryTotalMB} MB`;
                
                document.getElementById('system-node-version').textContent = stats.system.node_version;
                document.getElementById('system-platform').textContent = stats.system.platform;
            }
            
            // أفضل المحللين
            if (stats.top_analysts && stats.top_analysts.length > 0) {
                const container = document.getElementById('top-analysts-list');
                container.innerHTML = stats.top_analysts.map((analyst, index) => `
                    <div style="background: ${index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' : index === 1 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' : index === 2 ? 'linear-gradient(135deg, #cd7f32 0%, #e4a672 100%)' : 'white'}; padding: 15px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 18px; font-weight: bold; color: ${index < 3 ? 'white' : '#333'};">${index + 1}. ${analyst.analyst_name}</div>
                            <div style="font-size: 12px; color: ${index < 3 ? 'rgba(255,255,255,0.9)' : '#666'};">المشتركين: ${analyst.total_subscribers}</div>
                        </div>
                        <div style="text-align: left; font-size: 20px; font-weight: bold; color: ${index < 3 ? 'white' : '#00D9FF'};">
                            ${analyst.total_revenue.toFixed(2)} USDT
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading advanced stats:', error);
    }
}

async function loadAdminAnalysts() {
    const container = document.getElementById('analysts-list');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/analysts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.analysts && data.analysts.length > 0) {
            container.innerHTML = data.analysts.map(analyst => `
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                        <div>
                            <h3 style="margin: 0 0 5px 0; color: #333;">${analyst.name}</h3>
                            <p style="margin: 0; color: #888; font-size: 13px;">ID: ${analyst.user_id}</p>
                            <p style="margin: 5px 0 0 0; color: #888; font-size: 13px;">@${analyst.username || 'لا يوجد'}</p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${analyst.monthly_price} USDT</div>
                            <div style="font-size: 12px; color: #888;">السعر الشهري</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 15px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                        <div style="font-size: 14px; color: #666;">${analyst.description || 'لا يوجد وصف'}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
                        <div style="text-align: center; padding: 10px; background: #e8f5e9; border-radius: 8px;">
                            <div style="font-size: 20px; font-weight: bold; color: #4caf50;">${analyst.total_subscribers || 0}</div>
                            <div style="font-size: 12px; color: #666;">المشتركين</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: ${analyst.is_active ? '#e3f2fd' : '#ffebee'}; border-radius: 8px;">
                            <div style="font-size: 14px; font-weight: bold; color: ${analyst.is_active ? '#2196f3' : '#f44336'};">${analyst.is_active ? 'نشط ✅' : 'متوقف ⏸️'}</div>
                            <div style="font-size: 12px; color: #666;">الحالة</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="toggleAnalystStatus('${analyst._id}', ${analyst.is_active})" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: ${analyst.is_active ? '#ff9800' : '#4caf50'}; color: white; cursor: pointer; font-size: 13px;">
                            ${analyst.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                        </button>
                        <button onclick="deleteAnalyst('${analyst._id}')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #f44336; color: white; cursor: pointer; font-size: 13px;">🗑️ حذف</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا يوجد محللين</p>';
        }
    } catch (error) {
        console.error('Error loading analysts:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function loadAdminWithdrawals() {
    const container = document.getElementById('withdrawals-list');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/withdrawals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.withdrawals && data.withdrawals.length > 0) {
            container.innerHTML = data.withdrawals.map(w => `
                <div style="background: #fffbea; padding: 20px; border-radius: 12px; border: 2px solid #ffc107;">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 8px 0; color: #333;">طلب سحب من ${w.first_name || 'مستخدم'}</h4>
                        <p style="margin: 0; color: #888; font-size: 13px;">ID: ${w.user_id}</p>
                        <p style="margin: 5px 0 0 0; color: #888; font-size: 13px;">التاريخ: ${new Date(w.created_at).toLocaleString('ar')}</p>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="margin-bottom: 10px;">
                            <strong style="color: #667eea;">المبلغ:</strong>
                            <span style="font-size: 20px; font-weight: bold; color: #10b981; margin-right: 10px;">${w.amount} USDT</span>
                        </div>
                        <div>
                            <strong style="color: #667eea;">عنوان المحفظة:</strong>
                            <code style="display: block; margin-top: 5px; padding: 8px; background: #f5f5f5; border-radius: 6px; font-size: 12px; word-break: break-all;">${w.wallet_address}</code>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="approveWithdrawal('${w._id}')" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: #10b981; color: white; cursor: pointer; font-weight: bold;">✅ موافقة</button>
                        <button onclick="rejectWithdrawalPrompt('${w._id}')" style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: #ef4444; color: white; cursor: pointer; font-weight: bold;">❌ رفض</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا توجد طلبات سحب معلقة</p>';
        }
    } catch (error) {
        console.error('Error loading withdrawals:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function approveWithdrawal(withdrawalId) {
    if (!confirm('هل تريد الموافقة على طلب السحب؟')) return;
    
    try {
        const response = await fetch('/api/admin/approve-withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                withdrawal_id: withdrawalId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert('✅ تمت الموافقة على طلب السحب');
            loadAdminWithdrawals();
            loadAdminStats();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشلت العملية'));
        }
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        tg.showAlert('حدث خطأ');
    }
}

function rejectWithdrawalPrompt(withdrawalId) {
    const reason = prompt('أدخل سبب الرفض (اختياري):');
    if (reason === null) return;
    rejectWithdrawal(withdrawalId, reason);
}

async function rejectWithdrawal(withdrawalId, reason) {
    try {
        const response = await fetch('/api/admin/reject-withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                withdrawal_id: withdrawalId,
                reason: reason || 'لم يتم تحديد السبب',
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert('✅ تم رفض طلب السحب');
            loadAdminWithdrawals();
            loadAdminStats();
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشلت العملية'));
        }
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        tg.showAlert('حدث خطأ');
    }
}

async function loadAdminTransactions() {
    const container = document.getElementById('transactions-list');
    const typeFilter = document.getElementById('transaction-type-filter').value;
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                type_filter: typeFilter,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.transactions && data.transactions.length > 0) {
            container.innerHTML = data.transactions.map(t => {
                const typeColors = {
                    'deposit': { bg: '#e8f5e9', text: '#4caf50', icon: '📥' },
                    'withdrawal': { bg: '#ffebee', text: '#f44336', icon: '📤' },
                    'subscription': { bg: '#e3f2fd', text: '#2196f3', icon: '💎' },
                    'referral': { bg: '#f3e5f5', text: '#9c27b0', icon: '🎁' }
                };
                const colors = typeColors[t.type] || { bg: '#f5f5f5', text: '#666', icon: '💰' };
                
                return `
                    <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                    <span style="font-size: 20px;">${colors.icon}</span>
                                    <span style="font-weight: bold; color: ${colors.text};">${t.type === 'deposit' ? 'إيداع' : t.type === 'withdrawal' ? 'سحب' : t.type === 'subscription' ? 'اشتراك' : 'إحالة'}</span>
                                </div>
                                <p style="margin: 0; color: #888; font-size: 12px;">المستخدم: ${t.user_id}</p>
                                <p style="margin: 3px 0 0 0; color: #888; font-size: 11px;">${new Date(t.created_at).toLocaleString('ar')}</p>
                            </div>
                            <div style="text-align: left;">
                                <div style="font-size: 18px; font-weight: bold; color: ${colors.text};">${t.amount} USDT</div>
                                <div style="font-size: 11px; color: #888; margin-top: 3px;">${t.status || 'مكتمل'}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا توجد معاملات</p>';
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function loadAdminReferrals() {
    const container = document.getElementById('referrals-list');
    container.innerHTML = '<p class="empty-state">جاري التحميل...</p>';
    
    try {
        const response = await fetch('/api/admin/top-referrers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.referrers && data.referrers.length > 0) {
            container.innerHTML = data.referrers.map((ref, index) => `
                <div style="background: white; padding: 15px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 15px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px 0; color: #333;">${ref.first_name || 'مستخدم'}</h4>
                        <p style="margin: 0; color: #888; font-size: 12px;">@${ref.username || 'لا يوجد'} - ID: ${ref.user_id}</p>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 16px; font-weight: bold; color: #10b981;">${ref.total_earnings} USDT</div>
                        <div style="font-size: 12px; color: #888;">${ref.total_referrals} إحالة</div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="empty-state">لا توجد إحالات</p>';
        }
    } catch (error) {
        console.error('Error loading referrals:', error);
        container.innerHTML = '<p class="empty-state">حدث خطأ في التحميل</p>';
    }
}

async function sendBroadcastMessage() {
    const message = document.getElementById('broadcast-message').value.trim();
    
    if (!message) {
        tg.showAlert('❌ الرسالة فارغة');
        return;
    }
    
    if (!confirm('⚠️ هل أنت متأكد من إرسال هذه الرسالة لجميع المستخدمين؟')) {
        return;
    }
    
    try {
        tg.showAlert('⏳ جاري الإرسال...');
        
        const response = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                message: message,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        if (data.success) {
            tg.showAlert(`✅ ${data.message}`);
            document.getElementById('broadcast-message').value = '';
        } else {
            tg.showAlert('❌ ' + (data.error || 'فشل الإرسال'));
        }
    } catch (error) {
        console.error('Error broadcasting:', error);
        tg.showAlert('حدث خطأ');
    }
}

async function searchUserAdvanced() {
    const query = document.getElementById('advanced-search-input').value.trim();
    const resultDiv = document.getElementById('search-result');
    const detailsDiv = document.getElementById('search-user-details');
    
    if (!query) {
        tg.showAlert('❌ يرجى إدخال معرف المستخدم أو الاسم');
        return;
    }
    
    resultDiv.style.display = 'none';
    detailsDiv.innerHTML = '<p class="empty-state">جاري البحث...</p>';
    
    try {
        const response = await fetch('/api/admin/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: userId,
                query: query,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            resultDiv.style.display = 'block';
            
            detailsDiv.innerHTML = `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0;">👤 معلومات المستخدم</h4>
                    <p><strong>الاسم:</strong> ${user.first_name || '-'} ${user.last_name || ''}</p>
                    <p><strong>اسم المستخدم:</strong> @${user.username || 'لا يوجد'}</p>
                    <p><strong>ID:</strong> ${user.user_id}</p>
                    <p><strong>الرصيد:</strong> ${user.balance || 0} USDT</p>
                    <p><strong>اللغة:</strong> ${user.language || 'ar'}</p>
                    ${user.is_banned ? '<p style="color: red;"><strong>⚠️ محظور</strong></p>' : ''}
                </div>
                
                ${user.analyst ? `
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0;">👨‍💼 معلومات المحلل</h4>
                        <p><strong>اسم المحلل:</strong> ${user.analyst.name}</p>
                        <p><strong>السعر الشهري:</strong> ${user.analyst.monthly_price} USDT</p>
                        <p><strong>المشتركين:</strong> ${user.analyst.total_subscribers || 0}</p>
                        <p><strong>الحالة:</strong> ${user.analyst.is_active ? 'نشط ✅' : 'متوقف ⏸️'}</p>
                    </div>
                ` : ''}
                
                ${user.referral_stats ? `
                    <div style="background: #f3e5f5; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0;">🎁 إحصائيات الإحالة</h4>
                        <p><strong>عدد الإحالات:</strong> ${user.referral_stats.total_referrals || 0}</p>
                        <p><strong>الأرباح:</strong> ${user.referral_stats.total_earnings || 0} USDT</p>
                    </div>
                ` : ''}
                
                ${user.subscriptions && user.subscriptions.length > 0 ? `
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0;">💎 الاشتراكات</h4>
                        ${user.subscriptions.map(sub => `
                            <p>• ${sub.analyst_name} - ينتهي: ${new Date(sub.expires_at).toLocaleDateString('ar')}</p>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${user.transactions && user.transactions.length > 0 ? `
                    <div style="background: #fff3e0; padding: 15px; border-radius: 10px;">
                        <h4 style="margin: 0 0 10px 0;">💰 آخر المعاملات (5)</h4>
                        ${user.transactions.slice(0, 5).map(t => `
                            <p style="font-size: 13px;">• ${t.type === 'deposit' ? '📥' : t.type === 'withdrawal' ? '📤' : '💎'} ${t.amount} USDT - ${new Date(t.created_at).toLocaleDateString('ar')}</p>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } else {
            tg.showAlert('❌ ' + (data.error || 'المستخدم غير موجود'));
        }
    } catch (error) {
        console.error('Error searching user:', error);
        tg.showAlert('حدث خطأ في البحث');
    }
}

async function toggleAnalystStatus(analystId, currentStatus) {
    if (!confirm(`هل تريد ${currentStatus ? 'إيقاف' : 'تفعيل'} هذا المحلل؟`)) return;
    
    tg.showAlert('⏳ جاري التحديث...');
}

async function deleteAnalyst(analystId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا المحلل؟ سيتم إلغاء جميع اشتراكاته.')) return;
    
    tg.showAlert('⏳ جاري الحذف...');
}

async function loadNotificationSettings() {
    try {
        const response = await fetch('/api/notification-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.settings) {
            const toggle = document.getElementById('notifications-toggle');
            const marketsDiv = document.getElementById('notification-markets');
            
            toggle.checked = data.settings.enabled || false;
            
            if (data.settings.enabled) {
                marketsDiv.style.display = 'block';
            }

            if (data.settings.markets && data.settings.markets.length > 0) {
                document.querySelectorAll('.market-checkbox').forEach(checkbox => {
                    checkbox.checked = data.settings.markets.includes(checkbox.value);
                });
            }
        }
    } catch (error) {
        console.error('Error loading notification settings:', error);
    }
}

async function toggleNotifications() {
    const toggle = document.getElementById('notifications-toggle');
    const marketsDiv = document.getElementById('notification-markets');
    const enabled = toggle.checked;

    try {
        const response = await fetch('/api/toggle-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                enabled: enabled,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            marketsDiv.style.display = enabled ? 'block' : 'none';
            tg.showAlert(enabled ? '✅ تم تفعيل الإشعارات' : '❌ تم إيقاف الإشعارات');
        } else {
            toggle.checked = !enabled;
            tg.showAlert('❌ حدث خطأ: ' + (data.error || 'غير معروف'));
        }
    } catch (error) {
        console.error('Error toggling notifications:', error);
        toggle.checked = !enabled;
        tg.showAlert('❌ حدث خطأ في تحديث الإشعارات');
    }
}

async function saveNotificationMarkets() {
    const selectedMarkets = [];
    document.querySelectorAll('.market-checkbox:checked').forEach(checkbox => {
        selectedMarkets.push(checkbox.value);
    });

    if (selectedMarkets.length === 0) {
        tg.showAlert('⚠️ يرجى اختيار سوق واحد على الأقل');
        return;
    }

    try {
        const response = await fetch('/api/update-notification-markets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                markets: selectedMarkets,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ تم حفظ التفضيلات بنجاح');
        } else {
            tg.showAlert('❌ ' + (data.error || 'حدث خطأ'));
        }
    } catch (error) {
        console.error('Error saving notification markets:', error);
        tg.showAlert('❌ حدث خطأ في حفظ التفضيلات');
    }
}

function openSupportChat() {
    document.getElementById('support-modal').style.display = 'flex';
    document.getElementById('support-messages').innerHTML = `
        <div class="message bot">
            مرحباً! 👋 أنا مساعدك الذكي لمشروع OBENTCHI. كيف يمكنني مساعدتك؟
        </div>
    `;
}

function closeSupportChat() {
    document.getElementById('support-modal').style.display = 'none';
}

async function sendSupportMessage() {
    const input = document.getElementById('support-message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    const messagesDiv = document.getElementById('support-messages');
    
    messagesDiv.innerHTML += `<div class="message user">${message}</div>`;
    input.value = '';
    
    messagesDiv.innerHTML += `<div class="message loading">جاري الكتابة...</div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        const response = await fetch('/api/customer-support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message, 
                language: localStorage.getItem('language') || 'ar' 
            })
        });
        
        const data = await response.json();
        
        const loadingMsg = messagesDiv.querySelector('.loading');
        if (loadingMsg) loadingMsg.remove();
        
        if (data.reply) {
            messagesDiv.innerHTML += `<div class="message bot">${data.reply}</div>`;
        } else {
            messagesDiv.innerHTML += `<div class="message bot">عذراً، حدث خطأ. حاول مرة أخرى.</div>`;
        }
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        const loadingMsg = messagesDiv.querySelector('.loading');
        if (loadingMsg) loadingMsg.remove();
        messagesDiv.innerHTML += `<div class="message bot">عذراً، فشل الاتصال. حاول مرة أخرى.</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const supportInput = document.getElementById('support-message-input');
    if (supportInput) {
        supportInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendSupportMessage();
        });
    }
});

// دوال قسم "المزيد"
async function changeLanguageFromMore() {
    const lang = document.getElementById('more-language-select').value;
    
    if (!userId) {
        tg.showAlert('❌ خطأ: لا يمكن تغيير اللغة');
        return;
    }
    
    try {
        const response = await fetch('/api/change-language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                language: lang,
                init_data: tg.initData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user_language', lang);
            
            const isRTL = lang === 'ar' || lang === 'fa' || lang === 'he';
            document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
            document.documentElement.setAttribute('lang', lang);
            
            if (typeof applyTranslations === 'function') {
                applyTranslations();
            }
            
            tg.showAlert('✅ تم تغيير اللغة بنجاح!');
            
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            tg.showAlert('❌ فشل تغيير اللغة: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (error) {
        console.error('Error changing language:', error);
        tg.showAlert('❌ حدث خطأ أثناء تغيير اللغة');
    }
}

async function toggleNotificationsFromMore() {
    const toggle = document.getElementById('more-notifications-toggle');
    const marketsDiv = document.getElementById('more-notification-markets');
    const enabled = toggle.checked;

    try {
        const response = await fetch('/api/toggle-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                enabled: enabled,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            marketsDiv.style.display = enabled ? 'block' : 'none';
            tg.showAlert(enabled ? '✅ تم تفعيل الإشعارات' : '❌ تم إيقاف الإشعارات');
        } else {
            toggle.checked = !enabled;
            tg.showAlert('❌ حدث خطأ: ' + (data.error || 'غير معروف'));
        }
    } catch (error) {
        console.error('Error toggling notifications:', error);
        toggle.checked = !enabled;
        tg.showAlert('❌ حدث خطأ في تحديث الإشعارات');
    }
}

async function saveNotificationMarketsFromMore() {
    const selectedMarkets = [];
    document.querySelectorAll('.more-market-checkbox:checked').forEach(checkbox => {
        selectedMarkets.push(checkbox.value);
    });

    if (selectedMarkets.length === 0) {
        tg.showAlert('⚠️ يرجى اختيار سوق واحد على الأقل');
        return;
    }

    try {
        const response = await fetch('/api/update-notification-markets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                markets: selectedMarkets,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            tg.showAlert('✅ تم حفظ التفضيلات بنجاح');
        } else {
            tg.showAlert('❌ ' + (data.error || 'حدث خطأ'));
        }
    } catch (error) {
        console.error('Error saving notification markets:', error);
        tg.showAlert('❌ حدث خطأ في حفظ التفضيلات');
    }
}

async function loadMoreSectionSettings() {
    // تحديث قائمة اللغة
    const currentLang = localStorage.getItem('user_language') || 'ar';
    const moreLangSelect = document.getElementById('more-language-select');
    if (moreLangSelect) {
        moreLangSelect.value = currentLang;
    }

    // تحميل إعدادات الإشعارات
    if (!userId) return;

    try {
        const response = await fetch('/api/notification-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success && data.settings) {
            const toggle = document.getElementById('more-notifications-toggle');
            const marketsDiv = document.getElementById('more-notification-markets');
            
            if (toggle) {
                toggle.checked = data.settings.enabled || false;
            }
            
            if (data.settings.enabled && marketsDiv) {
                marketsDiv.style.display = 'block';
            }

            if (data.settings.markets && data.settings.markets.length > 0) {
                document.querySelectorAll('.more-market-checkbox').forEach(checkbox => {
                    checkbox.checked = data.settings.markets.includes(checkbox.value);
                });
            }
        }
    } catch (error) {
        console.error('Error loading notification settings:', error);
    }
}

async function loadAnalystAdvancedPerformance(analystId) {
    try {
        const response = await fetch('/api/analyst-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (data.success) {
            displayAdvancedPerformance(data);
        } else {
            console.error('Error loading performance:', data.error);
        }
    } catch (error) {
        console.error('Error loading analyst performance:', error);
    }
}

function displayAdvancedPerformance(data) {
    const container = document.getElementById('advanced-performance-container');
    if (!container) return;

    const { metrics, tier, badges, achievements } = data;

    let html = `
        <div class="analyst-tier-badge tier-${tier}">
            ${getTierEmoji(tier)} ${tier}
        </div>

        <div class="analyst-badges">
            ${badges.map(badge => `
                <span class="analyst-badge badge-${badge}">
                    ${getBadgeEmoji(badge)} ${getBadgeLabel(badge)}
                </span>
            `).join('')}
        </div>

        <div class="performance-metrics-grid">
            <div class="metric-card ${getMetricClass(metrics.win_rate, 'win_rate')}">
                <div class="metric-label">نسبة النجاح</div>
                <div class="metric-value">${metrics.win_rate}%</div>
            </div>

            <div class="metric-card ${getMetricClass(metrics.profit_factor, 'profit_factor')}">
                <div class="metric-label">عامل الربح</div>
                <div class="metric-value">${metrics.profit_factor}</div>
            </div>

            <div class="metric-card ${getMetricClass(metrics.average_rr, 'rr')}">
                <div class="metric-label">متوسط R/R</div>
                <div class="metric-value">${metrics.average_rr}</div>
            </div>

            <div class="metric-card ${getMetricClass(metrics.sharpe_ratio, 'sharpe')}">
                <div class="metric-label">نسبة شارب</div>
                <div class="metric-value">${metrics.sharpe_ratio}</div>
            </div>

            <div class="metric-card ${getMetricClass(metrics.max_drawdown, 'drawdown')}">
                <div class="metric-label">أقصى تراجع</div>
                <div class="metric-value">${metrics.max_drawdown}%</div>
            </div>

            <div class="metric-card ${getMetricClass(metrics.consistency_score, 'consistency')}">
                <div class="metric-label">درجة الثبات</div>
                <div class="metric-value">${metrics.consistency_score}</div>
            </div>
        </div>

        ${achievements && achievements.length > 0 ? `
            <div class="achievements-section">
                <h3>🏆 الإنجازات</h3>
                ${achievements.map(ach => `
                    <div class="achievement-item">
                        <div class="achievement-icon">${ach.icon}</div>
                        <div class="achievement-info">
                            <h4>${ach.title}</h4>
                            <p>${ach.description}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

async function loadAnalystAIInsights(analystId, generateNew = false) {
    try {
        const loadingEl = document.getElementById('ai-insights-loading');
        const container = document.getElementById('ai-insights-container');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (container) container.innerHTML = '';

        const response = await fetch('/api/analyst-ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                analyst_id: analystId,
                generate_new: generateNew,
                init_data: tg.initData
            })
        });

        const data = await response.json();

        if (loadingEl) loadingEl.style.display = 'none';

        if (data.success && data.insights) {
            displayAIInsights(data.insights);
        } else {
            if (container) {
                container.innerHTML = `<p style="text-align: center; color: #666;">${data.message || 'حدث خطأ في تحميل التحليل'}</p>`;
            }
        }
    } catch (error) {
        console.error('Error loading AI insights:', error);
        const container = document.getElementById('ai-insights-container');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">حدث خطأ في تحميل تحليل الذكاء الاصطناعي</p>';
        }
    }
}

function displayAIInsights(insights) {
    const container = document.getElementById('ai-insights-container');
    if (!container) return;

    let html = `
        <div class="ai-insights-section">
            <h3>🤖 تحليل الذكاء الاصطناعي</h3>
            <div class="insights-content">${insights.ai_analysis || ''}</div>
        </div>

        ${insights.strengths && insights.strengths.length > 0 ? `
            <div class="strengths-weaknesses">
                <div>
                    <h3 style="color: #4CAF50;">💪 نقاط القوة</h3>
                    ${insights.strengths.map(s => `
                        <div class="strength-item">
                            <h4>${s.title}</h4>
                            <p>${s.description}</p>
                        </div>
                    `).join('')}
                </div>
                
                ${insights.weaknesses && insights.weaknesses.length > 0 ? `
                    <div>
                        <h3 style="color: #f44336;">⚠️ نقاط الضعف</h3>
                        ${insights.weaknesses.map(w => `
                            <div class="weakness-item">
                                <h4>${w.title}</h4>
                                <p>${w.description}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        ` : ''}

        ${insights.recommendations && insights.recommendations.length > 0 ? `
            <div class="recommendations-list">
                <h3>📋 التوصيات</h3>
                ${insights.recommendations.map(rec => `
                    <div class="recommendation-item">
                        <span class="recommendation-priority priority-${rec.priority}">${rec.priority.toUpperCase()}</span>
                        <h4>${rec.title}</h4>
                        <p><strong>الإجراء:</strong> ${rec.action}</p>
                        <p><strong>التأثير المتوقع:</strong> ${rec.expected_impact}</p>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        ${insights.performance_score ? `
            <div style="text-align: center;">
                <h3>🎯 درجة الأداء الإجمالية</h3>
                <div class="performance-score-circle ${getScoreClass(insights.performance_score)}">
                    ${insights.performance_score}
                </div>
            </div>
        ` : ''}
    `;

    container.innerHTML = html;
}

function getTierEmoji(tier) {
    const emojis = {
        DIAMOND: '💎',
        PLATINUM: '🥈',
        GOLD: '🥇',
        SILVER: '🥈',
        BRONZE: '🥉'
    };
    return emojis[tier] || '🏅';
}

function getBadgeEmoji(badge) {
    const emojis = {
        EXPERT_TRADER: '🎯',
        MASTER_TRADER: '👑',
        PROFIT_MACHINE: '💰',
        CONSISTENT_PERFORMER: '⭐',
        POPULAR_ANALYST: '👥',
        CELEBRITY_ANALYST: '🌟',
        EXPERIENCED: '📚',
        VETERAN: '🏅',
        RISK_MASTER: '🛡️',
        LOW_RISK: '✅',
        HIGH_SHARPE: '📊',
        HOT_STREAK: '🔥'
    };
    return emojis[badge] || '🏆';
}

function getBadgeLabel(badge) {
    const labels = {
        EXPERT_TRADER: 'متداول خبير',
        MASTER_TRADER: 'متداول محترف',
        PROFIT_MACHINE: 'آلة أرباح',
        CONSISTENT_PERFORMER: 'أداء ثابت',
        POPULAR_ANALYST: 'محلل شهير',
        CELEBRITY_ANALYST: 'نجم التحليل',
        EXPERIENCED: 'ذو خبرة',
        VETERAN: 'محترف قديم',
        RISK_MASTER: 'ماهر بالمخاطر',
        LOW_RISK: 'مخاطر منخفضة',
        HIGH_SHARPE: 'شارب عالي',
        HOT_STREAK: 'سلسلة ساخنة'
    };
    return labels[badge] || badge;
}

function getMetricClass(value, type) {
    switch(type) {
        case 'win_rate':
            if (value >= 70) return 'positive';
            if (value >= 50) return 'neutral';
            return 'negative';
        case 'profit_factor':
            if (value >= 2) return 'positive';
            if (value >= 1.5) return 'neutral';
            return 'negative';
        case 'rr':
            if (value >= 2.5) return 'positive';
            if (value >= 2) return 'neutral';
            return 'negative';
        case 'sharpe':
            if (value >= 2) return 'positive';
            if (value >= 1) return 'neutral';
            return 'negative';
        case 'drawdown':
            if (value <= 10) return 'positive';
            if (value <= 20) return 'neutral';
            return 'negative';
        case 'consistency':
            if (value >= 75) return 'positive';
            if (value >= 60) return 'neutral';
            return 'negative';
        default:
            return 'neutral';
    }
}

function getScoreClass(score) {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-poor';
}

// ========== الماسح الذكي ==========
let scannerRunning = false;
let scannerAborted = false;

async function startSmartScanner() {
    const marketType = document.getElementById('scanner-market-type').value;
    const analysisType = document.getElementById('scanner-analysis-type').value;
    const timeframe = document.getElementById('scanner-timeframe').value;
    
    document.getElementById('start-scanner-btn').style.display = 'none';
    document.getElementById('stop-scanner-btn').style.display = 'block';
    document.getElementById('scanner-progress').style.display = 'block';
    document.getElementById('scanner-results').style.display = 'block';
    document.getElementById('scanner-results-container').innerHTML = '';
    
    scannerRunning = true;
    scannerAborted = false;
    
    try {
        const response = await fetch('/api/smart-scanner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                market_type: marketType,
                analysis_type: analysisType,
                timeframe: timeframe,
                init_data: tg.initData
            })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (scannerRunning && !scannerAborted) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        handleScannerUpdate(data);
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e);
                    }
                }
            }
        }
        
        if (scannerAborted) {
            reader.cancel();
        }
    } catch (error) {
        console.error('Scanner error:', error);
        alert('❌ حدث خطأ في الماسح: ' + error.message);
    } finally {
        scannerRunning = false;
        document.getElementById('start-scanner-btn').style.display = 'block';
        document.getElementById('stop-scanner-btn').style.display = 'none';
    }
}

function stopSmartScanner() {
    scannerAborted = true;
    scannerRunning = false;
    document.getElementById('scanner-status').textContent = 'متوقف';
    document.getElementById('start-scanner-btn').style.display = 'block';
    document.getElementById('stop-scanner-btn').style.display = 'none';
}

function handleScannerUpdate(data) {
    if (data.type === 'progress') {
        document.getElementById('scanned-count').textContent = data.scanned;
        document.getElementById('total-count').textContent = data.total;
        document.getElementById('signals-found').textContent = data.signalsFound;
        
        const percentage = (data.scanned / data.total) * 100;
        document.getElementById('scanner-progress-bar').style.width = percentage + '%';
        
        if (data.timeRemaining) {
            const mins = Math.floor(data.timeRemaining / 60);
            const secs = data.timeRemaining % 60;
            document.getElementById('time-remaining').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        
        if (data.currentSymbol) {
            document.getElementById('scanner-status').textContent = `فحص ${data.currentSymbol}...`;
        }
    } else if (data.type === 'signal') {
        addScannerSignal(data.signal);
    } else if (data.type === 'complete') {
        document.getElementById('scanner-status').textContent = `✅ اكتمل - وجد ${data.totalSignals} إشارة`;
        scannerRunning = false;
        document.getElementById('start-scanner-btn').style.display = 'block';
        document.getElementById('stop-scanner-btn').style.display = 'none';
    } else if (data.type === 'error') {
        document.getElementById('scanner-status').textContent = '❌ خطأ';
        alert('❌ ' + data.message);
        stopSmartScanner();
    }
}

function addScannerSignal(signal) {
    const container = document.getElementById('scanner-results-container');
    const signalCount = container.children.length + 1;
    
    const actionEmoji = signal.action === 'شراء' || signal.action === 'BUY' ? '🟢' : '🔴';
    const actionText = signal.action === 'شراء' || signal.action === 'BUY' ? 'شراء' : 'بيع';
    const actionColor = signal.action === 'شراء' || signal.action === 'BUY' ? '#00ff00' : '#ff0000';
    
    let confidenceText = signal.confidence || 'متوسطة';
    if (typeof signal.confidenceScore === 'number' && isFinite(signal.confidenceScore)) {
        confidenceText = `${(signal.confidenceScore * 100).toFixed(0)}%`;
    }
    
    let agreementText = '0%';
    if (typeof signal.agreementPercentage === 'number' && isFinite(signal.agreementPercentage)) {
        agreementText = `${signal.agreementPercentage.toFixed(0)}%`;
    } else if (typeof signal.confidenceScore === 'number' && isFinite(signal.confidenceScore)) {
        agreementText = `${(signal.confidenceScore * 100).toFixed(0)}%`;
    }
    
    const marketEmoji = signal.marketType === 'crypto' ? '💎' : 
                       signal.marketType === 'forex' ? '💱' : 
                       signal.marketType === 'stocks' ? '📈' : 
                       signal.marketType === 'commodities' ? '🛢️' : '📊';
    
    const signalCard = document.createElement('div');
    signalCard.className = 'signal-card';
    signalCard.style.cssText = `
        border: 2px solid ${actionColor};
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 15px;
        background: linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 100%);
        animation: slideIn 0.5s ease-out;
    `;
    
    signalCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 18px;">${actionEmoji} #${signalCount} - ${marketEmoji} ${signal.symbol}</h3>
            <div style="background: ${actionColor}; color: black; padding: 5px 12px; border-radius: 8px; font-weight: bold; font-size: 14px;">
                ${actionText}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; color: #fff;">
            <div><strong>💪 الثقة:</strong> ${confidenceText}</div>
            <div><strong>📊 الاتفاق:</strong> ${agreementText}</div>
            <div><strong>💰 الدخول:</strong> $${parseFloat(signal.entryPrice).toFixed(2)}</div>
            <div><strong>🎯 الهدف:</strong> $${parseFloat(signal.takeProfit).toFixed(2)}</div>
            <div><strong>🛑 الإيقاف:</strong> $${parseFloat(signal.stopLoss).toFixed(2)}</div>
            <div><strong>⚖️ R/R:</strong> ${signal.riskReward || 'N/A'}</div>
        </div>
        
        ${signal.reasons && signal.reasons.length > 0 ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
                <strong style="font-size: 13px; color: #fff;">📌 أسباب:</strong>
                <ul style="margin: 5px 0 0 0; padding-right: 20px; font-size: 12px; color: #ddd;">
                    ${signal.reasons.map(r => `<li>${r}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
    
    container.insertBefore(signalCard, container.firstChild);
    
    if (container.children.length > 20) {
        container.removeChild(container.lastChild);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}