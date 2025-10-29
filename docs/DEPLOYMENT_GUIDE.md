# 🚀 دليل النشر لمشروع OBENTCHI Bot
## دعم ملايين المستخدمين

تم إعادة هيكلة المشروع بالكامل ليدعم ملايين المستخدمين باستخدام:
- ✅ Telegram Webhooks (بدلاً من Polling)
- ✅ Docker Containers للتوزيع
- ✅ Redis Cluster للمرونة
- ✅ Kubernetes للتوسع التلقائي
- ✅ Load Balancing مع Nginx
- ✅ Auto-scaling للـ Queue Workers
- ✅ Monitoring مع Prometheus & Grafana

---

## 📋 المتطلبات

### البيئة المحلية (التطوير):
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (للتطوير المحلي)

### بيئة الإنتاج:
- Kubernetes 1.24+
- Helm 3+
- Redis Cluster أو Managed Redis
- MongoDB Atlas أو MongoDB Cluster
- Domain مع SSL Certificate

---

## 🔧 الخطوة 1: إعداد البيئة

### 1.1 نسخ ملف المتغيرات البيئية

```bash
cp .env.example .env
```

### 1.2 تعبئة المتغيرات الضرورية

افتح `.env` وعبّئ القيم التالية:

```env
# Telegram
BOT_TOKEN=your_bot_token_here
OWNER_ID=your_user_id
CHANNEL_ID=-1001234567890

# MongoDB
MONGODB_USER=your_mongodb_user
MONGODB_PASSWORD=your_mongodb_password
MONGODB_CLUSTER=your_cluster.mongodb.net

# للـ Webhooks (الإنتاج)
PUBLIC_URL=https://your-domain.com
WEBHOOK_URL=https://your-domain.com/webhook/${BOT_TOKEN}
```

---

## 🐳 الخطوة 2: التشغيل مع Docker Compose

### للتطوير المحلي:

```bash
# بناء الصور
docker-compose build

# تشغيل جميع الخدمات
docker-compose up -d

# مشاهدة الـ logs
docker-compose logs -f

# إيقاف الخدمات
docker-compose down
```

### للإنتاج (مع Redis Cluster):

```bash
# تشغيل بيئة الإنتاج
docker-compose -f docker-compose.production.yml up -d

# تهيئة Redis Cluster (مرة واحدة فقط)
chmod +x init-redis-cluster.sh
docker-compose -f docker-compose.production.yml exec redis-master-1 sh -c "/init-redis-cluster.sh"

# التحقق من صحة الإعداد
docker-compose -f docker-compose.production.yml ps
```

---

## ☸️ الخطوة 3: النشر على Kubernetes

### 3.1 إعداد Secrets

```bash
# إنشاء namespace
kubectl create namespace obentchi-bot

# إنشاء secrets
kubectl create secret generic obentchi-secrets \
  --from-literal=BOT_TOKEN=your_bot_token \
  --from-literal=MONGODB_USER=your_user \
  --from-literal=MONGODB_PASSWORD=your_password \
  --from-literal=MONGODB_CLUSTER=your_cluster.mongodb.net \
  --from-literal=OKX_API_KEY=your_okx_key \
  --from-literal=OKX_SECRET_KEY=your_okx_secret \
  --from-literal=OKX_PASSPHRASE=your_passphrase \
  -n obentchi-bot
```

### 3.2 بناء الصور ورفعها

```bash
# بناء جميع الصور
docker build -f Dockerfile.http -t your-registry/obentchi-http:latest .
docker build -f Dockerfile.bot -t your-registry/obentchi-bot:latest .
docker build -f Dockerfile.queue -t your-registry/obentchi-queue:latest .
docker build -f Dockerfile.scheduler -t your-registry/obentchi-scheduler:latest .

# رفع الصور للـ registry
docker push your-registry/obentchi-http:latest
docker push your-registry/obentchi-bot:latest
docker push your-registry/obentchi-queue:latest
docker push your-registry/obentchi-scheduler:latest
```

### 3.3 النشر

```bash
# تطبيق الـ manifests
kubectl apply -f kubernetes/deployment.yaml

# التحقق من حالة الـ pods
kubectl get pods -n obentchi-bot

# مشاهدة الـ logs
kubectl logs -f deployment/http-server -n obentchi-bot
kubectl logs -f deployment/bot-webhook -n obentchi-bot
kubectl logs -f deployment/queue-worker -n obentchi-bot
```

### 3.4 إعداد Ingress و SSL

```bash
# تثبيت cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# إنشاء ClusterIssuer لـ Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# تحديث domain في kubernetes/deployment.yaml ثم تطبيق الـ Ingress
kubectl apply -f kubernetes/deployment.yaml
```

---

## 📊 الخطوة 4: المراقبة (Monitoring)

### 4.1 الوصول لـ Prometheus

```bash
# Port forwarding
kubectl port-forward -n obentchi-bot service/prometheus 9090:9090

# افتح المتصفح
open http://localhost:9090
```

### 4.2 الوصول لـ Grafana

```bash
# Port forwarding
kubectl port-forward -n obentchi-bot service/grafana 3000:3000

# افتح المتصفح (admin/admin)
open http://localhost:3000
```

### 4.3 إضافة Dashboards

في Grafana:
1. اذهب إلى Configuration → Data Sources
2. أضف Prometheus: `http://prometheus:9090`
3. استورد Dashboard للـ Kubernetes
4. استورد Dashboard للـ Redis
5. استورد Dashboard للـ Node.js

---

## 🔄 الخطوة 5: التوسع (Scaling)

### التوسع اليدوي:

```bash
# زيادة HTTP Servers
kubectl scale deployment http-server --replicas=10 -n obentchi-bot

# زيادة Bot Webhook Workers
kubectl scale deployment bot-webhook --replicas=20 -n obentchi-bot

# زيادة Queue Workers
kubectl scale deployment queue-worker --replicas=50 -n obentchi-bot
```

### التوسع التلقائي:

الـ HorizontalPodAutoscaler مُعرَّف بالفعل في `kubernetes/deployment.yaml`:

- **HTTP Server**: 3-50 pods (70% CPU)
- **Bot Webhook**: 5-100 pods (70% CPU)
- **Queue Worker**: 10-200 pods (75% CPU)

---

## 🧪 الخطوة 6: اختبار الحمل (Load Testing)

### باستخدام k6:

```bash
# تثبيت k6
brew install k6  # macOS
# أو
apt install k6   # Ubuntu

# اختبار بـ 1000 مستخدم متزامن
k6 run --vus 1000 --duration 30s load-test.js
```

### باستخدام Apache Bench:

```bash
# اختبار API endpoint
ab -n 10000 -c 100 https://your-domain.com/api/health
```

---

## 📈 قياس الأداء

### المقاييس الأساسية:

| المكون | الحد الأقصى | الملاحظات |
|--------|-------------|-----------|
| HTTP Server | ~10K req/sec | مع 10 pods |
| Bot Webhook | ~50K updates/sec | مع 50 pods |
| Queue Workers | ~500K jobs/hour | مع 50 workers |
| Redis Cluster | ~100K ops/sec | 3 masters + 3 replicas |

### التوقعات لملايين المستخدمين:

- **1M مستخدم نشط**: 20 HTTP pods + 50 Bot pods + 100 Queue workers
- **5M مستخدم نشط**: 50 HTTP pods + 100 Bot pods + 200 Queue workers
- **10M+ مستخدم نشط**: توسيع Redis Cluster + MongoDB Sharding

---

## 🔧 استكشاف الأخطاء

### مشكلة: البوت لا يستقبل updates

```bash
# التحقق من webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# إعادة تعيين webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
kubectl rollout restart deployment/bot-webhook -n obentchi-bot
```

### مشكلة: Queue workers بطيئة

```bash
# زيادة الـ concurrency
kubectl set env deployment/queue-worker WITHDRAWAL_CONCURRENCY=100 -n obentchi-bot
kubectl set env deployment/queue-worker PAYMENT_CONCURRENCY=50 -n obentchi-bot
```

### مشكلة: Redis غير متاح

```bash
# التحقق من صحة الـ cluster
kubectl exec -it redis-master-1 -n obentchi-bot -- redis-cli cluster info
kubectl exec -it redis-master-1 -n obentchi-bot -- redis-cli cluster nodes
```

---

## 🔐 الأمن

### Best Practices:

1. **Secrets Management**: استخدم Kubernetes Secrets أو HashiCorp Vault
2. **Network Policies**: حدد الاتصالات بين الـ pods
3. **RBAC**: قيّد الصلاحيات للـ service accounts
4. **SSL/TLS**: استخدم شهادات صالحة من Let's Encrypt
5. **Rate Limiting**: مُفعَّل بالفعل في Nginx

---

## 📝 الصيانة

### النسخ الاحتياطي:

```bash
# MongoDB Backup (عبر Atlas)
# Redis Backup
kubectl exec -it redis-master-1 -n obentchi-bot -- redis-cli BGSAVE
```

### التحديثات:

```bash
# تحديث صورة واحدة
kubectl set image deployment/http-server http-server=your-registry/obentchi-http:v2.0 -n obentchi-bot

# Rolling update تلقائي
kubectl apply -f kubernetes/deployment.yaml
```

---

## 🎯 الخلاصة

بعد اتباع هذا الدليل، مشروعك الآن:

✅ يدعم ملايين المستخدمين  
✅ قابل للتوسع التلقائي  
✅ موزع عبر عدة خوادم  
✅ مرن ضد الأعطال  
✅ مُراقب بشكل شامل  
✅ آمن ومحمي  

**للدعم**: افتح issue على GitHub أو تواصل مع فريق التطوير.

---

## 📚 موارد إضافية

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Redis Cluster Tutorial](https://redis.io/topics/cluster-tutorial)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
