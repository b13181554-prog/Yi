# AWS Webhook Deployment Guide

## نظرة عامة

تم تحويل نظام OBENTCHI Bot ليعمل بالكامل على **Webhook Mode** فقط، مع إزالة نظام Polling المحلي. النظام الآن يعمل كخادم موحد يدمج جميع الخدمات في عملية واحدة.

## البنية الموحدة الجديدة

### الخادم الموحد: `services/unified-webhook-server.js`

يدمج هذا الخادم جميع الخدمات التالية في عملية واحدة:

1. **Telegram Webhook Handler** - استقبال ومعالجة تحديثات Telegram
2. **HTTP API Server** - جميع endpoints الخاصة بالـ API
3. **Queue Workers** - معالجة السحوبات والدفعات (Bull Queues)
4. **Schedulers** - المهام المجدولة (Rankings, Monitoring, Trade Signals)

### المتغيرات البيئية المطلوبة

#### متغيرات إلزامية للإنتاج (AWS):

```bash
# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# Database
MONGODB_USER=your_mongodb_user
MONGODB_PASSWORD=your_mongodb_password
MONGODB_CLUSTER=your_mongodb_cluster

# Webhook Configuration
PUBLIC_URL=https://your-domain.com
WEBHOOK_SECRET=your_random_secret_token

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Environment
NODE_ENV=production
```

#### متغيرات اختيارية:

```bash
# Port Configuration
PORT=8443                    # Default for AWS
BOT_WEBHOOK_PORT=8443       # Alternative port variable

# Instance ID (for multiple instances)
INSTANCE_ID=instance-1

# Logging
LOG_LEVEL=info
```

## التشغيل على AWS

### 1. التثبيت الأولي

```bash
# Clone the repository
git clone https://github.com/your-repo/obentchi-bot.git
cd obentchi-bot

# Install dependencies
npm install

# Install PM2 globally
npm install -g pm2

# Setup environment variables
cp .env.example .env
nano .env  # Edit with your actual values
```

### 2. تشغيل الخادم باستخدام PM2

```bash
# Start using PM2
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs obentchi-webhook-server

# Restart
pm2 restart obentchi-webhook-server

# Stop
pm2 stop obentchi-webhook-server
```

### 3. تكوين Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# SSL Configuration (recommended)
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. تكوين Webhook مع Telegram

بعد تشغيل الخادم، سيتم تكوين الـ webhook تلقائياً. للتحقق:

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

للتكوين اليدوي (إذا لزم الأمر):

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook",
    "secret_token": "your_webhook_secret",
    "max_connections": 100,
    "allowed_updates": ["message", "callback_query", "inline_query"]
  }'
```

## التشغيل المباشر (بدون PM2)

```bash
# Development/Testing
node services/unified-webhook-server.js

# Production
NODE_ENV=production node services/unified-webhook-server.js
```

## Endpoints المتاحة

- `GET /health` - Health check
- `GET /api/health` - API health check
- `GET /metrics` - Prometheus metrics
- `POST /webhook` - Telegram webhook endpoint (secured with secret token)
- `POST /api/*` - جميع API endpoints

## المراقبة والصيانة

### فحص الحالة

```bash
# Check if server is running
curl http://localhost:8443/health

# Check metrics
curl http://localhost:8443/metrics
```

### اللوجات

```bash
# PM2 logs
pm2 logs obentchi-webhook-server

# PM2 logs (real-time)
pm2 logs obentchi-webhook-server --lines 100

# System logs
tail -f logs/pm2-combined.log
```

### إعادة التشغيل التلقائية

PM2 سيقوم بإعادة تشغيل الخادم تلقائياً:
- عند حدوث أخطاء (max 10 restarts)
- يومياً في الساعة 4 صباحاً (cron restart)
- عند استخدام ذاكرة أكثر من 1GB

## الاختلافات عن النظام القديم

### قبل (Polling + Microservices):
```
- services/bot-worker.js (Polling)
- services/http-server.js (API)
- services/queue-worker.js (Queues)
- services/scheduler.js (Cron jobs)
- process-manager.js (Process orchestration)
```

### الآن (Webhook Unified):
```
- services/unified-webhook-server.js (All-in-one)
- ecosystem.config.js (PM2 config)
```

## الميزات

✅ **أداء أفضل**: خادم واحد بدلاً من 4 عمليات منفصلة
✅ **موارد أقل**: استهلاك ذاكرة و CPU أقل
✅ **نشر أسهل**: ملف واحد فقط
✅ **موثوقية أعلى**: Webhook بدلاً من Polling
✅ **قابلية التوسع**: يمكن تشغيل عدة instances خلف load balancer

## استكشاف الأخطاء

### الخادم لا يبدأ

1. تحقق من المتغيرات البيئية:
   ```bash
   cat .env
   ```

2. تحقق من اللوجات:
   ```bash
   pm2 logs
   ```

3. تحقق من البورت:
   ```bash
   netstat -tlnp | grep 8443
   ```

### Webhook لا يعمل

1. تحقق من الـ webhook info:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```

2. تأكد من أن PUBLIC_URL صحيح
3. تأكد من أن WEBHOOK_SECRET متطابق
4. تحقق من لوجات Nginx

### مشاكل الاتصال بقاعدة البيانات

1. تحقق من MongoDB connection string
2. تحقق من Redis:
   ```bash
   redis-cli ping
   ```

## الأمان

- ✅ Webhook secured بـ secret token
- ✅ Rate limiting على جميع API endpoints
- ✅ Request size validation
- ✅ HTTPS إلزامي للإنتاج
- ✅ Environment variables للمعلومات الحساسة

## الدعم

للمزيد من المعلومات، راجع:
- `ecosystem.config.js` - تكوين PM2
- `replit.md` - توثيق المشروع
- `AWS_DEPLOYMENT.md` - دليل النشر على AWS
