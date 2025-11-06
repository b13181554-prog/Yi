// استيراد جميع ملفات الترجمة
const ar = require('./locales/ar');
const en = require('./locales/en');
const fr = require('./locales/fr');
const es = require('./locales/es');
const de = require('./locales/de');
const ru = require('./locales/ru');
const zh = require('./locales/zh');

// بناء كائن الترجمات
const translations = {
  ar,
  en,
  fr,
  es,
  de,
  ru,
  zh
};

// دالة للحصول على الترجمة
function t(lang, key) {
  const language = translations[lang] || translations.ar;
  return language[key] || translations.ar[key] || key;
}

// دالة للتحقق من مطابقة النص لمفتاح زر معين في أي لغة
function matchesButtonKey(text, buttonKey) {
  if (!text) return false;
  const supportedLangs = ['ar', 'en', 'fr', 'es', 'de', 'ru', 'zh'];
  for (const lang of supportedLangs) {
    if (text === t(lang, buttonKey)) {
      return true;
    }
  }
  return false;
}

// دالة للحصول على لوحة مفاتيح تبديل اللغة
function getLanguageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇸🇦 العربية', callback_data: 'lang_ar' },
        { text: '🇬🇧 English', callback_data: 'lang_en' }
      ],
      [
        { text: '🇫🇷 Français', callback_data: 'lang_fr' },
        { text: '🇪🇸 Español', callback_data: 'lang_es' }
      ],
      [
        { text: '🇩🇪 Deutsch', callback_data: 'lang_de' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' }
      ],
      [
        { text: '🇨🇳 中文', callback_data: 'lang_zh' }
      ]
    ]
  };
}

// دالة للحصول على القائمة الرئيسية بناءً على اللغة
function getMainKeyboard(lang) {
  return {
    keyboard: [
      [{ text: t(lang, 'select_currency') }, { text: t(lang, 'timeframe') }],
      [{ text: t(lang, 'indicators') }, { text: t(lang, 'market_type') }],
      [{ text: t(lang, 'request_recommendation') }, { text: t(lang, 'top_movers') }],
      [{ text: t(lang, 'analysts') }, { text: t(lang, 'referrals') }],
      [{ text: t(lang, 'wallet') }, { text: t(lang, 'transactions_history') }],
      [{ text: t(lang, 'my_account') }, { text: t(lang, 'reset') }],
      [{ text: t(lang, 'language_settings') }]
    ],
    resize_keyboard: true
  };
}

module.exports = {
  t,
  matchesButtonKey,
  getLanguageKeyboard,
  getMainKeyboard,
  translations
};
