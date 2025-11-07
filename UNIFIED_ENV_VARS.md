# 🎯 دليل المتغيرات البيئية الموحدة

## ✅ تم توحيد المتغيرات - لا تكرار بعد الآن!

تم تنظيف المشروع وإزالة جميع المتغيرات المكررة. الآن نستخدم **متغير واحد فقط** لكل إعداد في جميع البيئات (Replit + AWS).

---

## 🔴 المتغيرات المكررة التي تم إزالتها:

### 1. ❌ TELEGRAM_BOT_TOKEN
**تم استبدالها بـ:** `BOT_TOKEN`  
**السبب:** كان مكرراً والكود الآن يستخدم `BOT_TOKEN` فقط  
**الإجراء المطلوب:** احذف `TELEGRAM_BOT_TOKEN` من Replit Secrets

### 2. ❌ GOOGLE_GEMINI_API_KEY
**تم استبدالها بـ:** `GOOGLE_API_KEY`  
**السبب:** كان مكرراً والكود يستخدم `GOOGLE_API_KEY` فقط  
**الإجراء المطلوب:** احذف `GOOGLE_GEMINI_API_KEY` من Replit Secrets

### 3. ❌ MONGODB_URI
**تم استبدالها بـ:** `MONGODB_USER` + `MONGODB_PASSWORD` + `MONGODB_CLUSTER`  
**السبب:** يُبنى تلقائياً من المكونات الثلاثة في `config.js` و `config-manager.js`  
**الإجراء المطلوب:** احذف `MONGODB_URI` من Replit Secrets

---

## ✅ المتغيرات الموحدة (استخدمها في جميع البيئات):

### 🤖 Telegram Bot
```
BOT_TOKEN=your_bot_token_here
OWNER_ID=123456789
CHANNEL_ID=-1001234567890
CHANNEL_USERNAME=@your_channel
```

### 🗄️ MongoDB Database
```
MONGODB_USER=your_username
MONGODB_PASSWORD=your_password
MONGODB_CLUSTER=cluster0.xxxxx.mongodb.net
MONGODB_DB_NAME=obentchi_bot
```

### 🤖 AI Services
```
GOOGLE_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### 💰 Payment & Wallet
```
BOT_WALLET_ADDRESS=your_tron_address
OKX_API_KEY=your_okx_key
OKX_SECRET_KEY=your_okx_secret
OKX_PASSPHRASE=your_okx_passphrase
```

### 🔐 Security
```
SESSION_SECRET=your_session_secret
WEBHOOK_SECRET=your_webhook_secret
```

### 🌐 URLs (تُضاف عند النشر على AWS)
```
PUBLIC_URL=https://your-domain.com
```

---

## 📋 خطوات حذف المتغيرات المكررة من Replit:

1. **افتح Replit Project**
2. **اذهب إلى:** `Tools` → `Secrets`
3. **احذف هذه المتغيرات الثلاثة:**
   - ❌ `TELEGRAM_BOT_TOKEN`
   - ❌ `GOOGLE_GEMINI_API_KEY`
   - ❌ `MONGODB_URI`
4. **تأكد من وجود البدائل:**
   - ✅ `BOT_TOKEN` (موجود)
   - ✅ `GOOGLE_API_KEY` (موجود)
   - ✅ `MONGODB_USER` + `MONGODB_PASSWORD` + `MONGODB_CLUSTER` (موجودة)

---

## 🎯 الفوائد:

✅ **لا تكرار** - متغير واحد لكل إعداد  
✅ **موحد** - نفس المتغيرات في Replit و AWS  
✅ **واضح** - سهل الإدارة والصيانة  
✅ **آمن** - تقليل فرص الأخطاء  
✅ **مرن** - سهل النقل بين البيئات  

---

## 🚀 عند النشر على AWS:

فقط انسخ نفس المتغيرات من Replit Secrets وأضف:

```bash
PUBLIC_URL=https://your-ec2-domain.com
BOT_WEBHOOK_PORT=8443
NODE_ENV=production
```

البوت سيكتشف البيئة تلقائياً ويعمل بشكل صحيح! ✨

---

## ⚠️ ملاحظة مهمة:

بعد حذف المتغيرات المكررة، قد تحتاج لإعادة تشغيل الـ workflows:
1. أوقف الـ workflows الحالية
2. شغلها من جديد
3. تأكد من عمل البوت بشكل صحيح

---

**آخر تحديث:** نوفمبر 2025  
**الحالة:** ✅ تم توحيد جميع المتغيرات
