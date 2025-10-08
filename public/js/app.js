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
    { value: 'QNTUSDT', label: '⚡ Quant (QNT)' }
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
            document.getElementById('loading').style.display = 'none';
            updateUI();
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
        // دعم بيئة التطوير مع بيانات افتراضية
        let user;
        if (!tg.initDataUnsafe?.user?.id) {
            console.warn('⚠️ لا يوجد معرف مستخدم من Telegram - استخدام بيانات تجريبية للتطوير');
            user = {
                id: 123456789,
                first_name: 'Test',
                last_name: 'User'
            };
            // إضافة البيانات لـ tg.initDataUnsafe
            if (!tg.initDataUnsafe) tg.initDataUnsafe = {};
            tg.initDataUnsafe.user = user;
        } else {
            user = tg.initDataUnsafe.user;
        }
        
        userId = user.id;
        console.log('✅ Final User ID:', userId);

        tg.ready();
        tg.expand();

        // تحميل بيانات المستخدم أولاً
        await loadUserData();
        await loadMyAnalystProfile();

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
    if (refLinkEl) {
        const botUsername = tg.initDataUnsafe.bot_username || 'Uuttyibv76bot';
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
}

function setupSymbolSearch() {
    const searchInput = document.getElementById('symbol-search');
    const select = document.getElementById('symbol-select');

    if (searchInput) {
        searchInput.addEventListener('input', async function() {
            const searchTerm = this.value.toLowerCase().trim();
            const marketType = document.getElementById('market-type').value;

            let allSymbols = [];
            
            if (marketType === 'crypto') {
                if (CRYPTO_SYMBOLS.length === 0) {
                    await loadAllCryptoSymbols();
                }
                allSymbols = CRYPTO_SYMBOLS;
            } else if (marketType === 'forex') {
                if (FOREX_PAIRS.length === 0) {
                    generateAllForexPairs();
                }
                allSymbols = FOREX_PAIRS;
            } else if (marketType === 'stocks') {
                if (STOCKS.length < 50) {
                    await loadAllStocks();
                }
                allSymbols = STOCKS;
            } else if (marketType === 'commodities') {
                allSymbols = COMMODITIES;
            } else if (marketType === 'indices') {
                allSymbols = INDICES;
            }

            if (searchTerm === '') {
                select.innerHTML = allSymbols.map(s => 
                    `<option value="${s.value}">${s.label}</option>`
                ).join('');
                return;
            }

            const filtered = allSymbols.filter(s => 
                s.value.toLowerCase().includes(searchTerm) || 
                s.label.toLowerCase().includes(searchTerm)
            );

            if (filtered.length === 0) {
                select.innerHTML = '<option>❌ لا توجد نتائج</option>';
            } else {
                select.innerHTML = filtered.map(s => 
                    `<option value="${s.value}">${s.label}</option>`
                ).join('');
            }
        });
    }
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
                container.innerHTML = data.analysts.map(analyst => `
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
                        <div class="analyst-footer">
                            <span class="price">${analyst.monthly_price} USDT/شهر</span>
                            <button class="subscribe-analyst-btn" onclick="subscribeToAnalyst(${analyst.id})">
                                ${analyst.is_subscribed ? '🔄 تجديد' : '✅ اشترك'}
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="empty-state">لا يوجد محللين حالياً</p>';
            }

            // تحميل الاشتراكات النشطة
            if (data.active_subscriptions && data.active_subscriptions.length > 0) {
                const subsContainer = document.getElementById('active-subscriptions');
                subsContainer.innerHTML = data.active_subscriptions.map(sub => `
                    <div class="subscription-item">
                        <div class="sub-info">
                            <strong>${sub.analyst_name}</strong>
                            <span>صالح حتى: ${new Date(sub.end_date).toLocaleDateString('ar')}</span>
                        </div>
                        <button onclick="viewAnalystSignals(${sub.analyst_id})">📊 الإشارات</button>
                    </div>
                `).join('');
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
    document.getElementById('analyst-name').value = myAnalystData.name;
    document.getElementById('analyst-description').value = myAnalystData.description;
    document.getElementById('analyst-price').value = myAnalystData.monthly_price;
    document.getElementById('analyst-profile-picture').value = myAnalystData.profile_picture || '';
    
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
    
    document.getElementById('analyst-name').value = '';
    document.getElementById('analyst-description').value = '';
    document.getElementById('analyst-price').value = '';
    document.getElementById('analyst-profile-picture').value = '';
    document.getElementById('market-crypto').checked = false;
    document.getElementById('market-forex').checked = false;
    document.getElementById('market-stocks').checked = false;
    document.getElementById('market-commodities').checked = false;
    document.getElementById('market-indices').checked = false;
    isEditingAnalyst = false;
}

async function submitAnalystRegistration() {
    const name = document.getElementById('analyst-name').value.trim();
    const description = document.getElementById('analyst-description').value.trim();
    const price = parseFloat(document.getElementById('analyst-price').value);
    const profilePicture = document.getElementById('analyst-profile-picture').value.trim();
    
    const markets = [];
    if (document.getElementById('market-crypto').checked) markets.push('crypto');
    if (document.getElementById('market-forex').checked) markets.push('forex');
    if (document.getElementById('market-stocks').checked) markets.push('stocks');
    if (document.getElementById('market-commodities').checked) markets.push('commodities');
    if (document.getElementById('market-indices').checked) markets.push('indices');

    if (!name || !description || !price) {
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
                name: name,
                description: description,
                monthly_price: price,
                profile_picture: profilePicture,
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
}

function hideDeposit() {
    document.getElementById('deposit-form').style.display = 'none';
    document.getElementById('tx-id').value = '';
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
    const txId = document.getElementById('tx-id').value.trim();

    if (!txId || txId.length !== 64) {
        tg.showAlert('يرجى إدخال معرف معاملة صحيح (64 حرف)');
        return;
    }

    tg.showConfirm('هل أنت متأكد من معرف المعاملة؟', async (confirmed) => {
        if (confirmed) {
            tg.sendData(JSON.stringify({
                action: 'deposit',
                tx_id: txId
            }));
            tg.showAlert('تم إرسال طلب الإيداع! سيتم التحقق منه قريباً.');
            hideDeposit();
        }
    });
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

function copyAddress() {
    const address = 'TCZwoWnmi8uBssqjtKGmUwAjToAxcJkjLP';

    if (navigator.clipboard) {
        navigator.clipboard.writeText(address).then(() => {
            tg.showAlert('تم نسخ العنوان!');
        });
    } else {
        const input = document.createElement('input');
        input.value = address;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        tg.showAlert('تم نسخ العنوان!');
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
                            '/api/analyze-advanced';

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: getCurrentUserId(),
                symbol: symbol,
                timeframe: timeframe,
                market_type: marketType,
                trading_type: tradingType,
                analysis_type: analysisType,
                indicators,
                init_data: tg.initData
            })
        });

        const data = await response.json();
        loadingMsg.remove();

        if (data.success && data.analysis) {
            if (analysisType === 'ultra') {
                displayUltraAnalysisResult(data.analysis, symbol, timeframe);
            } else if (analysisType === 'zero-reversal') {
                displayZeroReversalResult(data.analysis, symbol, timeframe);
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

async function loadTop100Analysts() {
    const container = document.getElementById('top100-container');
    container.innerHTML = '<p class="empty-state">جاري تحميل الترتيب...</p>';

    try {
        const response = await fetch('/api/top-analysts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                init_data: tg.initData
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
                            <p style="margin: 5px 0; color: #666; font-size: 14px;">نسبة النجاح: ${(analyst.success_rate || 0).toFixed(1)}%</p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 18px; font-weight: bold; color: #667eea;">${analyst.performance_score ? analyst.performance_score.toFixed(1) : '0.0'}</div>
                            <div style="font-size: 11px; color: #888;">نقاط الأداء</div>
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}