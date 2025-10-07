
# 🚀 دليل نشر OBENTCHI Bot على Render

## الخطوات:

### 1. إنشاء حساب على Render
- اذهب إلى [render.com](https://render.com)
- سجل حساب جديد (يمكنك استخدام GitHub)

### 2. ربط المشروع
- اضغط "New +" → "Web Service"
- اختر "Build and deploy from a Git repository"
- اربط حساب GitHub الخاص بك
- اختر repository المشروع

### 3. إعدادات النشر
- **Name**: obentchi-bot
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Plan**: Free (أو أي خطة تناسبك)

### 4. إضافة المتغيرات البيئية (Environment Variables)
انسخ هذه المتغيرات من Replit Secrets:

```
BOT_TOKEN=your_telegram_bot_token
MONGODB_PASSWORD=your_mongodb_password
WEBAPP_URL=https://your-app-name.onrender.com
```

### 5. متغيرات إضافية (اختيارية):
```
COINGECKO_API_KEY=your_key
FOREX_API_KEY=your_key
BINANCE_API_KEY=your_key
BINANCE_SECRET_KEY=your_key
```

### 6. النشر
- اضغط "Create Web Service"
- انتظر حتى يكتمل النشر (5-10 دقائق)

### 7. تحديث رابط WebApp في BotFather
1. افتح [@BotFather](https://t.me/BotFather)
2. أرسل `/mybots`
3. اختر البوت الخاص بك
4. اختر "Bot Settings" → "Menu Button"
5. أرسل URL الجديد: `https://your-app-name.onrender.com`

## ⚠️ ملاحظات مهمة:

### Free Plan Limitations:
- النوم بعد 15 دقيقة من عدم النشاط
- 750 ساعة شهرياً مجاناً
- يحتاج إلى UptimeRobot للبقاء نشطاً

### لمنع النوم (Free Plan):
استخدم [UptimeRobot](https://uptimerobot.com):
1. سجل حساب مجاني
2. أنشئ "HTTP(s)" monitor
3. URL: `https://your-app-name.onrender.com/health`
4. Interval: كل 5 دقائق

## 🔒 الأمان:

✅ جميع API endpoints محمية بـ:
- التحقق من Telegram WebApp
- Rate Limiting (60 طلب/دقيقة)
- Security Headers
- Request Size Validation

✅ Environment Variables مخزنة بشكل آمن

## 📊 المراقبة:

- Logs: متاحة في لوحة تحكم Render
- Health Check: `/health` endpoint
- Metrics: متاحة في Dashboard

## 🔄 التحديثات:

- كل push لـ GitHub = نشر تلقائي
- أو يدوياً من Render Dashboard

## 💡 نصائح:

1. استخدم خطة مدفوعة للإنتاج الجاد
2. فعّل Auto-Deploy من GitHub
3. راقب الـ Logs بانتظام
4. احتفظ بنسخة احتياطية من MongoDB
