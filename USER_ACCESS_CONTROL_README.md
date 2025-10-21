# نظام التحكم في صلاحيات المستخدمين (User Access Control System)

## 📋 نظرة عامة

نظام متكامل ومتقدم للتحكم في صلاحيات المستخدمين وتحديد معدل الطلبات حسب مستوى الاشتراك. يوفر النظام 5 مستويات (tiers) مختلفة مع حدود مخصصة لكل نوع من الموارد.

---

## 🎯 الميزات الرئيسية

### 1. نظام متعدد المستويات (5 Tiers)

#### 🆓 Free Tier
- **تحليل فني**: 10 طلبات/ساعة
- **بيانات السوق**: 50 طلب/ساعة
- **بحث**: 5 طلبات/ساعة
- **AI**: 2 طلب/ساعة
- **ماسح السوق**: 1 طلب/يوم
- **Burst Allowance**: 20%
- **الأولوية**: 1

#### 💎 Basic Tier
- **تحليل فني**: 50 طلب/ساعة
- **بيانات السوق**: 200 طلب/ساعة
- **بحث**: 20 طلب/ساعة
- **AI**: 10 طلب/ساعة
- **ماسح السوق**: 5 طلب/يوم
- **Burst Allowance**: 30%
- **الأولوية**: 2

#### ⭐ VIP Tier
- **تحليل فني**: 200 طلب/ساعة
- **بيانات السوق**: 1000 طلب/ساعة
- **بحث**: 100 طلب/ساعة
- **AI**: 50 طلب/ساعة
- **ماسح السوق**: 20 طلب/يوم
- **Burst Allowance**: 50%
- **الأولوية**: 3

#### 📊 Analyst Tier
- **تحليل فني**: 500 طلب/ساعة
- **بيانات السوق**: 2000 طلب/ساعة
- **بحث**: غير محدود
- **AI**: 100 طلب/ساعة
- **ماسح السوق**: غير محدود
- **Burst Allowance**: 100%
- **الأولوية**: 4

#### 👑 Admin Tier
- **جميع الموارد**: غير محدود
- **Burst Allowance**: غير محدود
- **الأولوية**: 999

### 2. ميزات متقدمة

- ✅ **Sliding Window Algorithm**: خوارزمية نافذة منزلقة دقيقة
- ✅ **Redis-Backed**: نظام موزع عبر عدة instances
- ✅ **Cost-based Limiting**: تكلفة مختلفة لكل عملية
- ✅ **Burst Allowance**: السماح بارتفاعات مؤقتة
- ✅ **Soft Limit Warning**: تحذير عند 80% استخدام
- ✅ **Dynamic Configuration**: تعديل الحدود بدون restart
- ✅ **Whitelist/Blacklist**: قوائم بيضاء وسوداء
- ✅ **IP-based Fallback**: rate limiting بناءً على IP
- ✅ **Monitoring & Analytics**: متابعة وتحليلات شاملة

---

## 🔌 API Endpoints

### واجهات المستخدم

#### 1. لوحة تحكم المستخدم
```http
GET /api/access/dashboard?user_id=123
```

**Response:**
```json
{
  "success": true,
  "user": {
    "user_id": 123,
    "username": "user123",
    "balance": 100,
    "subscription_expires": "2025-12-31T23:59:59.000Z"
  },
  "access_control": {
    "tier": "vip",
    "tier_name": "VIP",
    "priority": 3,
    "resources": [
      {
        "resource": "analysis",
        "limit": 200,
        "remaining": 150,
        "count": 50,
        "percent_used": 25,
        "reset_time": 1729621200000,
        "unlimited": false,
        "warning": null
      }
    ]
  },
  "recommendations": [
    {
      "type": "upgrade",
      "priority": "medium",
      "message": "...",
      "action": "upgrade_or_wait"
    }
  ]
}
```

#### 2. حالة الحدود الحالية
```http
GET /api/access/status?user_id=123&resource=analysis
```

**Response:**
```json
{
  "success": true,
  "tier": "vip",
  "status": {
    "allowed": true,
    "remaining": 150,
    "limit": 200,
    "count": 50,
    "tier": "vip",
    "resource": "analysis",
    "percentUsed": 25
  }
}
```

### واجهات الإدارة (Admin Only)

#### 1. نظرة عامة على النظام
```http
POST /api/access/admin/overview
Content-Type: application/json

{
  "user_id": "admin_id"
}
```

**Response:**
```json
{
  "success": true,
  "tier_distribution": [
    {
      "tier": "admin",
      "tierName": "Admin",
      "userCount": 1,
      "priority": 999
    },
    {
      "tier": "vip",
      "tierName": "VIP",
      "userCount": 15,
      "priority": 3
    }
  ],
  "resource_usage": [
    {
      "tier": "vip",
      "resource": "analysis",
      "totalRequests": 1500,
      "totalCost": 1500,
      "uniqueUsers": 15,
      "avgCostPerUser": 100
    }
  ],
  "most_limited_users": [
    {
      "userId": 123,
      "violations": 5
    }
  ]
}
```

#### 2. تعيين حدود ديناميكية
```http
POST /api/access/admin/limits
Content-Type: application/json

{
  "user_id": "admin_id",
  "tier": "free",
  "resource": "analysis",
  "limit": {
    "count": 20,
    "window": 3600,
    "cost": 1
  }
}
```

#### 3. إدارة القائمة البيضاء
```http
POST /api/access/admin/whitelist
Content-Type: application/json

{
  "user_id": "admin_id",
  "target_user_id": 123,
  "action": "add"
}
```

#### 4. إدارة القائمة السوداء
```http
POST /api/access/admin/blacklist
Content-Type: application/json

{
  "user_id": "admin_id",
  "target_user_id": 123,
  "action": "add",
  "reason": "abuse"
}
```

#### 5. إعادة تعيين حدود المستخدم
```http
POST /api/access/admin/reset
Content-Type: application/json

{
  "user_id": "admin_id",
  "target_user_id": 123,
  "resource": "analysis"
}
```

#### 6. البحث عن مستخدم
```http
POST /api/access/admin/search
Content-Type: application/json

{
  "user_id": "admin_id",
  "target_user_id": 123
}
```

---

## 💻 استخدام في الكود

### Middleware للتحقق من الصلاحيات

```javascript
const { rateLimitMiddleware } = require('./advanced-rate-limiter');
const accessControl = require('./user-access-control');

// استخدام middleware جاهز
app.post('/api/analyze', 
  authenticateAPI,
  rateLimitMiddleware.analysis(),
  async (req, res) => {
    // منطق التحليل هنا
  }
);

// استخدام custom middleware
app.post('/api/custom',
  authenticateAPI,
  accessControl.createAccessMiddleware('analysis', { cost: 2 }),
  async (req, res) => {
    // منطق مخصص هنا
  }
);
```

### التحقق من الصلاحيات بدون استهلاك

```javascript
const accessControl = require('./user-access-control');

// التحقق فقط
const check = await accessControl.checkAccess(userId, 'analysis');

if (check.allowed) {
  console.log(`Remaining: ${check.remaining}`);
} else {
  console.log(`Rate limit exceeded. Retry after ${check.retryAfter}s`);
}
```

### الحصول على tier المستخدم

```javascript
const tier = await accessControl.getUserTier(userId);
console.log(`User tier: ${tier}`); // 'free', 'basic', 'vip', 'analyst', 'admin'
```

---

## 📊 Response Headers

جميع الطلبات تحتوي على headers لمعلومات rate limit:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 150
X-RateLimit-Reset: 2025-10-22T12:00:00.000Z
X-RateLimit-Tier: vip
X-RateLimit-Warning: ⚠️ اقتربت من الحد المسموح (85%)
Retry-After: 3600
```

---

## 🔧 التكوين

### Resource Costs

يمكن تخصيص تكلفة العمليات المختلفة:

```javascript
const RESOURCE_COSTS = {
  analysis_basic: 1,
  analysis_advanced: 2,
  analysis_ultra: 3,
  market_data_realtime: 1,
  market_data_historical: 2,
  search_basic: 1,
  search_advanced: 2,
  ai_simple: 1,
  ai_complex: 3,
  scanner_quick: 1,
  scanner_deep: 2
};
```

### Dynamic Limits

يمكن تعديل الحدود ديناميكياً بدون restart:

```javascript
const accessControl = require('./user-access-control');

// تعديل حد للـ free tier
await accessControl.setDynamicLimit(
  adminId,
  'free',
  'analysis',
  { count: 20, window: 3600, cost: 1 }
);
```

---

## 📈 Monitoring & Analytics

### الحصول على نظرة عامة

```javascript
const overview = await accessControl.getSystemOverview(adminId);
console.log(overview.tier_distribution);
console.log(overview.resource_usage);
console.log(overview.most_limited_users);
```

### معلومات المستخدم

```javascript
const userInfo = await accessControl.searchUser(adminId, targetUserId);
console.log(userInfo.user);
console.log(userInfo.access_control);
```

---

## 🎨 User Experience

### رسائل خطأ واضحة

عند تجاوز الحد:
```json
{
  "success": false,
  "error": "rate_limit_exceeded",
  "message": "تجاوزت الحد المسموح لـ analysis (10/ساعة). الحد سيتم إعادة تعيينه في 45 دقيقة.",
  "tier": "free",
  "limit": 10,
  "retryAfter": 2700,
  "upgrade_suggestion": "قم بالترقية إلى Basic للحصول على 50 طلب/ساعة"
}
```

### تحذيرات مبكرة

عند 80% استخدام:
```json
{
  "warning": "⚠️ اقتربت من الحد المسموح (85%)"
}
```

### توصيات ذكية

```json
{
  "recommendations": [
    {
      "type": "upgrade",
      "priority": "high",
      "message": "قم بالترقية إلى Basic للحصول على حدود أعلى",
      "action": "subscribe"
    },
    {
      "type": "usage_warning",
      "priority": "medium",
      "message": "أنت قريب من الحد الأقصى في 2 موارد",
      "resources": ["analysis", "search"],
      "action": "upgrade_or_wait"
    }
  ]
}
```

---

## 🚀 المزايا

1. **عدالة**: كل مستخدم يحصل على حصته بناءً على tier
2. **شفافية**: المستخدمون يرون حدودهم واستخدامهم بوضوح
3. **مرونة**: Admin يمكنه تعديل الحدود ديناميكياً
4. **أمان**: حماية من الإساءة والاستخدام المفرط
5. **قابلية التوسع**: نظام موزع مع Redis
6. **تحفيز**: توصيات ذكية للترقية

---

## 📚 الملفات ذات الصلة

- `user-access-control.js` - النظام الرئيسي
- `advanced-rate-limiter.js` - محرك Rate Limiting
- `api-routes/access-control-routes.js` - واجهات API
- `services/http-server.js` - التكامل مع الخادم

---

## ⚠️ ملاحظات مهمة

1. **Redis مطلوب**: النظام يحتاج Redis للعمل بشكل موزع
2. **Fallback**: في حالة فشل Redis، يعود للذاكرة
3. **Fail Open**: في حالة خطأ، يسمح بالطلب (للأمان)
4. **Admin Only**: بعض الوظائف محصورة للـ Admin فقط
5. **OWNER_ID**: تأكد من تعيين OWNER_ID في config

---

## 🔄 Workflow Integration

النظام متكامل مع:
- ✅ HTTP Server
- ✅ Bot Worker
- ✅ Queue Worker
- ✅ Scheduler

جميع الطلبات تمر عبر نظام التحكم في الصلاحيات.
