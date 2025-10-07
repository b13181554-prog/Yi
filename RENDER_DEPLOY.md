# دليل النشر على Render

## الخطوات المطلوبة للنشر:

### 1. إنشاء حساب على Render
- اذهب إلى [Render.com](https://render.com)
- سجل حساب جديد أو سجل الدخول

### 2. ربط المستودع (Repository)
- في لوحة التحكم، اضغط على "New +"
- اختر "Web Service"
- اربط حسابك على GitHub/GitLab
- اختر مستودع المشروع

### 3. إعدادات النشر

#### Build Command:
```
npm install
```

#### Start Command:
```
npm start
```

#### Health Check Path:
```
/health
```

### 4. إضافة المتغيرات البيئية (Environment Variables)

**مطلوبة (REQUIRED):**
- `BOT_TOKEN` - توكن البوت من BotFather
- `MONGODB_PASSWORD` - كلمة مرور قاعدة البيانات

**اختيارية (Optional):**
- `CURRENCY_API_KEY` - مفتاح CurrencyAPI
- `CURRENCY_FREAKS_API_KEY` - مفتاح CurrencyFreaks
- `COINGECKO_API_KEY` - مفتاح CoinGecko
- `FOREX_API_KEY` - مفتاح Forex API
- `BINANCE_API_KEY` - مفتاح Binance
- `BINANCE_SECRET_KEY` - مفتاح Binance السري

**تلقائية:**
- `PORT` = 5000 (يتم تعيينها تلقائياً)
- `NODE_ENV` = production (يفضل تعيينها)

### 5. النشر

بعد إضافة جميع المتغيرات:
1. اضغط على "Create Web Service"
2. انتظر حتى يكتمل النشر (5-10 دقائق)
3. سيظهر رابط التطبيق (مثل: `https://your-app-name.onrender.com`)

### 6. تحديث رابط التطبيق

بعد النشر، قم بتحديث متغير `WEBAPP_URL`:
```
WEBAPP_URL=https://your-app-name.onrender.com
```

### 7. تحديث BotFather

في تليجرام، أرسل إلى @BotFather:
```
/setmenubutton
```
ثم أرسل رابط التطبيق:
```
https://your-app-name.onrender.com
```

## ملاحظات مهمة:

### الحصول على المفاتيح:

#### BOT_TOKEN:
1. أرسل `/newbot` إلى @BotFather في تليجرام
2. اتبع التعليمات لإنشاء البوت
3. احفظ التوكن المُعطى

#### MONGODB_PASSWORD:
- استخدم كلمة المرور الحالية لقاعدة البيانات
- أو أنشئ قاعدة بيانات MongoDB جديدة على [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

#### مفاتيح API الأخرى (اختيارية):
- **CurrencyAPI**: [currencyapi.com](https://currencyapi.com)
- **CurrencyFreaks**: [currencyfreaks.com](https://currencyfreaks.com)
- **CoinGecko**: [coingecko.com/api](https://www.coingecko.com/api)
- **Binance**: [binance.com/api](https://www.binance.com/api)

### الخطة المجانية:
- Render يوفر خطة مجانية
- التطبيق قد ينام بعد 15 دقيقة من عدم النشاط
- للحفاظ على التطبيق يعمل 24/7، استخدم خدمة ping مثل [UptimeRobot](https://uptimerobot.com)

### استخدام UptimeRobot:
1. سجل حساب مجاني على [UptimeRobot](https://uptimerobot.com)
2. أضف Monitor جديد:
   - Type: HTTP(s)
   - URL: رابط تطبيقك + `/health`
   - Interval: 5 minutes
3. سيقوم UptimeRobot بزيارة التطبيق كل 5 دقائق لمنعه من النوم

## استكشاف الأخطاء:

### إذا فشل النشر:
1. تحقق من أن جميع المتغيرات المطلوبة موجودة
2. راجع سجلات النشر في Render Dashboard
3. تأكد من صحة توكن البوت

### إذا لم يستجب البوت:
1. تحقق من أن البوت يعمل في Render Dashboard
2. تأكد من تحديث `WEBAPP_URL`
3. أعد تشغيل الخدمة من Render Dashboard

## الدعم:
للمساعدة، تواصل مع مطور البوت أو راجع [Render Documentation](https://render.com/docs)
