# تكامل CryptAPI لنظام الدفع

## نظرة عامة

تم استبدال نظام الدفع القديم (الذي كان يعتمد على التحقق اليدوي من معاملات TRON) بنظام **CryptAPI** الأكثر احترافية وأتمتة.

## المميزات الجديدة

✅ **إنشاء عنوان دفع فريد** لكل معاملة تلقائيًا  
✅ **إشعارات تلقائية** عند استلام الدفعات  
✅ **دعم USDT** على شبكة TRC-20  
✅ **رسوم منخفضة** - 1% فقط من قيمة المعاملة  
✅ **لا يحتاج تسجيل** - فقط عنوان محفظتك  

## كيف يعمل النظام

### 1. إنشاء عنوان الدفع
عندما يريد المستخدم الإيداع:
- يطلب Web App عنوان دفع جديد من `/api/cryptapi/create-payment`
- يتم إنشاء عنوان USDT TRC-20 فريد للمستخدم
- يتم حفظ معلومات الدفع في قاعدة البيانات
- يتم إرجاع العنوان + QR Code للمستخدم

### 2. الدفع
- المستخدم يرسل USDT إلى العنوان المُنشأ
- CryptAPI يراقب العنوان تلقائيًا

### 3. الإشعار التلقائي (Callback)
- عندما يتم استلام الدفع، CryptAPI يرسل callback إلى `/api/cryptapi/callback`
- النظام يتحقق من صحة البيانات
- يتم تحديث رصيد المستخدم تلقائيًا
- يتم إرسال إشعارات للمستخدم والمالك

## الملفات المُضافة/المُعدّلة

### ملفات جديدة:
- `cryptapi.js` - خدمة التكامل مع CryptAPI

### ملفات معدلة:
- `config.js` - إضافة `CRYPTAPI_CALLBACK_URL`
- `database.js` - إضافة وظائف لإدارة دفعات CryptAPI
- `index.js` - إضافة endpoints جديدة:
  - `POST /api/cryptapi/create-payment` - إنشاء عنوان دفع
  - `POST /api/cryptapi/callback` - استقبال إشعارات الدفع

## متغيرات البيئة

### متغيرات موجودة (يتم استخدامها):
- `BOT_WALLET_ADDRESS` - عنوان محفظة استقبال USDT
- `REPLIT_DOMAINS` - يُستخدم لإنشاء callback URL تلقائيًا

### متغيرات اختيارية:
- `CRYPTAPI_CALLBACK_URL` - URL للـ callback (اختياري، يتم إنشاؤه تلقائيًا من REPLIT_DOMAINS)

## API Endpoints

### 1. إنشاء عنوان دفع
```
POST /api/cryptapi/create-payment
```

**Request Body:**
```json
{
  "user_id": 123456789,
  "amount": 10,
  "init_data": "telegram_web_app_data..."
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "payment_address": "TXyz123...",
    "qr_code_url": "https://api.cryptapi.io/trc20_usdt/qrcode/...",
    "amount": 10,
    "coin": "trc20_usdt"
  }
}
```

### 2. Callback من CryptAPI
```
POST /api/cryptapi/callback
```

يستقبل البيانات من CryptAPI ويعالجها تلقائيًا.

**الأمان:**
- يتم التحقق من توقيع RSA-SHA256 في header `x-ca-signature`
- يتم رفض أي callback بدون توقيع صحيح
- يحمي من هجمات تزوير إشعارات الدفع

## قاعدة البيانات

### Collection جديدة: `cryptapi_payments`

```javascript
{
  user_id: Number,
  payment_address: String (unique),
  amount: Number,
  qr_code_url: String,
  callback_url: String,
  status: String, // 'pending', 'confirmed', 'completed'
  created_at: Date,
  tx_id: String,
  confirmations: Number,
  completed_at: Date
}
```

### Indexes:
- `payment_address` (unique)
- `user_id + created_at`
- `status + created_at`

## التكامل مع Web App

لتفعيل النظام الجديد في Web App، قم بتعديل واجهة الإيداع لتستخدم الـ endpoint الجديد:

### مثال (JavaScript):
```javascript
async function createDeposit(amount) {
  const response = await fetch('/api/cryptapi/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: tg.initDataUnsafe.user.id,
      amount: amount,
      init_data: tg.initData
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // عرض عنوان الدفع و QR code للمستخدم
    showPaymentAddress(data.payment.payment_address);
    showQRCode(data.payment.qr_code_url);
  }
}
```

## النظام القديم

النظام القديم (التحقق اليدوي من TxID) لا يزال موجودًا في الكود ولكن يُنصح بالانتقال الكامل إلى CryptAPI.

للإزالة الكاملة للنظام القديم، قم بحذف:
- الكود في `index.js` (السطور التي تتحقق من TxID يدويًا)
- ملفات `tron.js` و `tron-enhanced.js` (إذا لم تكن مستخدمة في مكان آخر)

## الاختبار

### 1. اختبار إنشاء عنوان الدفع:
```bash
curl -X POST https://your-domain.replit.app/api/cryptapi/create-payment \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123456789,
    "amount": 10,
    "init_data": "your_telegram_init_data"
  }'
```

### 2. اختبار Callback (للتطوير فقط):
يمكنك استخدام أدوات مثل Postman لمحاكاة callback من CryptAPI.

## الدعم

- **CryptAPI Docs**: https://docs.cryptapi.io
- **رسوم الخدمة**: 1% من قيمة المعاملة
- **الحد الأدنى للدفع**: حسب العملة (USDT TRC-20 عادةً 1 USDT)

## الخطوات التالية

1. ✅ تم تثبيت المكتبة وإعداد الملفات
2. ✅ تم إنشاء endpoints API
3. ✅ تم تحديث قاعدة البيانات
4. ⏳ تحديث Web App للاستخدام (يحتاج تعديل من المطور)
5. ⏳ اختبار النظام مع دفعة حقيقية

## الأمان

### التدابير الأمنية المطبقة:

1. **التحقق من توقيع CryptAPI (RSA-SHA256)**
   - كل callback يتم التحقق من توقيعه عبر header `x-ca-signature`
   - يتم جلب المفتاح العام من CryptAPI وحفظه في الذاكرة (cache لمدة 24 ساعة)
   - أي callback بدون توقيع صحيح يتم رفضه فورًا
   - يحمي من هجمات تزوير إشعارات الدفع

2. **التحقق من Telegram WebApp Data**
   - endpoint `/api/cryptapi/create-payment` يتحقق من صحة `init_data`
   - يضمن أن الطلب قادم من Telegram WebApp الرسمي
   - يمنع إنشاء دفعات وهمية

3. **التحقق من حالة الدفع**
   - منع معالجة نفس الدفع مرتين
   - التحقق من عنوان الاستقبال (BOT_WALLET_ADDRESS)
   - التحقق من الحد الأدنى للمبلغ

4. **Rate Limiting**
   - جميع API endpoints محمية بـ rate limiting
   - يمنع هجمات DDoS والطلبات المفرطة

## ملاحظات مهمة

- تأكد من أن `BOT_WALLET_ADDRESS` صحيح وتملك مفاتيحه
- CryptAPI يحتاج الوصول إلى callback URL (تأكد أنه عام ويمكن الوصول إليه)
- يتم التحقق من الدفعات بعد تأكيد واحد على الأقل على blockchain
- النظام يدعم USDT TRC-20 فقط حاليًا (يمكن إضافة عملات أخرى بسهولة)
- **مهم جدًا**: لا تشارك `BOT_WALLET_ADDRESS` private key مع أي شخص
