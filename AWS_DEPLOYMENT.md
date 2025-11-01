# 🚀 دليل نشر OBENTCHI Bot على AWS Free Tier

هذا الدليل الشامل يوضح كيفية نشر بوت OBENTCHI على AWS EC2 مع ضمان عمله بشكل دائم بدون مشاكل.

---

## 📋 المتطلبات الأساسية

### 1. حساب AWS
- إنشاء حساب AWS Free Tier
- التأكد من تفعيل البطاقة الائتمانية (مطلوب للتحقق فقط)

### 2. المتطلبات المحلية
- Git مثبت على جهازك
- حساب GitHub
- محرر نصوص (VS Code, Sublime, etc.)

### 3. معلومات البوت المطلوبة
- `BOT_TOKEN` من [@BotFather](https://t.me/BotFather)
- `OWNER_ID` (معرف Telegram الخاص بك)
- قاعدة بيانات MongoDB Atlas (مجانية)
- Google Gemini API Key (مجاني وغير محدود)

---

## 🎯 الخطوة 1: إنشاء EC2 Instance

### 1.1 تسجيل الدخول لـ AWS Console
1. انتقل إلى [AWS Console](https://console.aws.amazon.com)
2. اختر **EC2** من قائمة الخدمات

### 1.2 إطلاق Instance جديد
```
1. اضغط على "Launch Instance"
2. Instance Name: obentchi-bot
3. Application and OS Images:
   - اختر: Ubuntu Server 22.04 LTS (Free tier eligible)
4. Instance Type:
   - اختر: t2.micro (Free tier eligible)
   - 1 vCPU, 1 GB RAM
5. Key Pair:
   - اضغط "Create new key pair"
   - Name: obentchi-bot-key
   - Type: RSA
   - Format: .pem (للـ Linux/Mac) أو .ppk (للـ Windows/PuTTY)
   - احفظ الملف في مكان آمن!
6. Network Settings:
   - اضغط "Edit"
   - Auto-assign public IP: Enable
   - Firewall (Security Groups):
     ✅ SSH (port 22) - للوصول للسيرفر
     ✅ HTTP (port 80) - للـ webhook
     ✅ HTTPS (port 443) - للـ webhook الآمن
     ✅ Custom TCP (port 5000) - للتطبيق
7. Storage:
   - 20 GB gp3 (Free tier: حتى 30 GB)
8. اضغط "Launch Instance"
```

### 1.3 الحصول على IP Address
بعد إطلاق الـ Instance:
1. انتقل إلى EC2 Dashboard
2. اضغط على Instance الخاص بك
3. انسخ **Public IPv4 address** (مثال: 3.25.123.456)

---

## 🔐 الخطوة 2: الاتصال بالسيرفر

### لمستخدمي Linux/Mac:
```bash
# تغيير صلاحيات المفتاح
chmod 400 obentchi-bot-key.pem

# الاتصال بالسيرفر (استبدل IP_ADDRESS بعنوان IP الخاص بك)
ssh -i obentchi-bot-key.pem ubuntu@YOUR_EC2_IP
```

### لمستخدمي Windows:
استخدم **PuTTY** أو **Windows Terminal** مع WSL:
```powershell
ssh -i obentchi-bot-key.pem ubuntu@YOUR_EC2_IP
```

---

## ⚙️ الخطوة 3: تثبيت المتطلبات على السيرفر

بعد الاتصال بنجاح، نفذ الأوامر التالية:

### 3.1 تحديث النظام
```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2 تثبيت Node.js 20
```bash
# إضافة مستودع NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# تثبيت Node.js و npm
sudo apt install -y nodejs

# التحقق من الإصدار
node --version  # يجب أن يكون v20.x.x
npm --version
```

### 3.3 تثبيت Redis
```bash
# تثبيت Redis
sudo apt install -y redis-server

# تعديل إعدادات Redis للتشغيل التلقائي
sudo systemctl enable redis-server
sudo systemctl start redis-server

# التحقق من عمل Redis
redis-cli ping  # يجب أن يظهر: PONG
```

### 3.4 تثبيت PM2 (مدير العمليات)
```bash
sudo npm install -g pm2

# إعداد PM2 للبدء التلقائي عند إعادة التشغيل
pm2 startup
# نفذ الأمر الذي سيظهر لك

# حفظ الإعدادات
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 3.5 تثبيت Nginx (Reverse Proxy)
```bash
sudo apt install -y nginx

# تفعيل Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 📦 الخطوة 4: رفع المشروع على GitHub

### 4.1 على جهازك المحلي (Replit):

```bash
# تهيئة Git (إذا لم يكن مُعد)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# إضافة جميع الملفات
git add .
git commit -m "Prepare for AWS deployment"

# إنشاء repository على GitHub ثم:
git remote add origin https://github.com/YOUR_USERNAME/obentchi-bot.git
git branch -M main
git push -u origin main
```

### 4.2 تأكد من عدم رفع الملفات الحساسة:
```bash
# تحقق من .gitignore
cat .gitignore | grep ".env"  # يجب أن يظهر .env
```

---

## 📥 الخطوة 5: استنساخ المشروع على السيرفر

على السيرفر (AWS EC2):

```bash
# الانتقال للمجلد الرئيسي
cd /home/ubuntu

# استنساخ المشروع من GitHub
git clone https://github.com/YOUR_USERNAME/obentchi-bot.git

# الدخول للمشروع
cd obentchi-bot

# تثبيت التبعيات
npm install --production
```

---

## 🔑 الخطوة 6: إعداد المتغيرات البيئية

### 6.1 إنشاء ملف .env

```bash
# نسخ الملف المثال
cp .env.example .env

# تحرير الملف
nano .env
```

### 6.2 ملء المتغيرات المطلوبة:

```env
# Telegram
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
OWNER_ID=YOUR_TELEGRAM_USER_ID
CHANNEL_ID=YOUR_CHANNEL_ID
CHANNEL_USERNAME=@YOUR_CHANNEL

# MongoDB (من MongoDB Atlas)
MONGODB_USER=your_username
MONGODB_PASSWORD=your_password
MONGODB_CLUSTER=cluster0.xxxxx.mongodb.net
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/obentchi_bot

# Webhook
PUBLIC_URL=http://YOUR_EC2_IP
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Bot Wallet
BOT_WALLET_ADDRESS=YOUR_TRON_WALLET

# AI (مطلوب واحد على الأقل)
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY

# OKX (اختياري)
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_PASSPHRASE=

# Settings
NODE_ENV=production
MODE=webhook
PORT=5000
```

احفظ الملف: `Ctrl + O`, ثم `Enter`, ثم `Ctrl + X`

### 6.3 توليد WEBHOOK_SECRET تلقائياً:
```bash
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env
```

---

## 🌐 الخطوة 7: إعداد Nginx

### 7.1 إنشاء ملف التكوين:
```bash
sudo nano /etc/nginx/sites-available/obentchi-bot
```

### 7.2 إضافة التكوين التالي:
```nginx
server {
    listen 80;
    server_name YOUR_EC2_IP;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Webhook endpoint
    location /webhook {
        proxy_pass http://localhost:5000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 90;
    }
}
```

### 7.3 تفعيل التكوين:
```bash
# إنشاء رابط رمزي
sudo ln -s /etc/nginx/sites-available/obentchi-bot /etc/nginx/sites-enabled/

# حذف التكوين الافتراضي
sudo rm /etc/nginx/sites-enabled/default

# اختبار التكوين
sudo nginx -t

# إعادة تشغيل Nginx
sudo systemctl restart nginx
```

---

## 🚀 الخطوة 8: تشغيل البوت

### 8.1 تشغيل باستخدام PM2:
```bash
# الدخول لمجلد المشروع
cd /home/ubuntu/obentchi-bot

# تشغيل البوت
pm2 start ecosystem.config.js --env production

# حفظ العمليات
pm2 save

# التحقق من حالة البوت
pm2 status

# عرض السجلات
pm2 logs obentchi-bot
```

### 8.2 التحقق من عمل الخدمات:
```bash
# التحقق من Redis
redis-cli ping  # يجب أن يعرض: PONG

# التحقق من Nginx
sudo systemctl status nginx

# التحقق من PM2
pm2 list
```

---

## 🧪 الخطوة 9: اختبار البوت

### 9.1 فحص الاتصال:
```bash
# اختبار HTTP Server
curl http://localhost:5000/api/health

# اختبار Webhook من الخارج
curl http://YOUR_EC2_IP/api/health
```

### 9.2 اختبار Telegram Bot:
1. افتح التليجرام
2. أرسل `/start` للبوت
3. يجب أن يرد فوراً!

---

## 📊 الخطوة 10: المراقبة والصيانة

### أوامر PM2 المفيدة:
```bash
# عرض السجلات المباشرة
pm2 logs obentchi-bot

# إعادة تشغيل
pm2 restart obentchi-bot

# إيقاف
pm2 stop obentchi-bot

# معلومات مفصلة
pm2 show obentchi-bot

# مراقبة الأداء
pm2 monit
```

### فحص استخدام الموارد:
```bash
# استخدام RAM و CPU
htop

# مساحة القرص
df -h

# حالة النظام
systemctl status
```

---

## 🔄 التحديثات المستقبلية

### عند تحديث الكود على GitHub:

```bash
# على السيرفر
cd /home/ubuntu/obentchi-bot

# سحب التحديثات
git pull origin main

# تثبيت التبعيات الجديدة (إن وجدت)
npm install --production

# إعادة تشغيل البوت
pm2 restart obentchi-bot

# التحقق من السجلات
pm2 logs obentchi-bot --lines 50
```

---

## 🛡️ الأمان والنصائح

### 1. تحديث النظام بانتظام:
```bash
sudo apt update && sudo apt upgrade -y
pm2 update
```

### 2. إعداد Firewall:
```bash
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw enable
sudo ufw status
```

### 3. النسخ الاحتياطي:
```bash
# نسخة احتياطية من .env
cp .env .env.backup

# نسخة احتياطية من قاعدة البيانات (MongoDB Atlas يفعل ذلك تلقائياً)
```

### 4. مراقبة السجلات:
```bash
# السجلات اليومية
pm2 logs --lines 100

# رصد الأخطاء
pm2 logs obentchi-bot --err
```

---

## ❓ حل المشاكل الشائعة

### المشكلة: البوت لا يستجيب في Telegram
```bash
# تحقق من حالة PM2
pm2 status

# تحقق من السجلات
pm2 logs obentchi-bot --lines 50

# أعد تشغيل البوت
pm2 restart obentchi-bot
```

### المشكلة: خطأ في Webhook
```bash
# تحقق من PUBLIC_URL في .env
cat .env | grep PUBLIC_URL

# اختبار الاتصال
curl http://YOUR_EC2_IP/webhook -X POST -H "Content-Type: application/json" -d '{"test":"test"}'
```

### المشكلة: Redis لا يعمل
```bash
# أعد تشغيل Redis
sudo systemctl restart redis-server

# تحقق من الحالة
sudo systemctl status redis-server
```

### المشكلة: نفذت الذاكرة (OOM)
```bash
# تحقق من استخدام الذاكرة
free -h

# أعد تشغيل البوت
pm2 restart obentchi-bot
```

---

## 📈 الترقية من Free Tier (اختياري)

عند زيادة الاستخدام، يمكنك الترقية إلى:
- **t3.small** (2 vCPU, 2 GB RAM) - $15/شهر
- **t3.medium** (2 vCPU, 4 GB RAM) - $30/شهر

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من السجلات: `pm2 logs obentchi-bot`
2. تحقق من حالة الخدمات: `pm2 status` و `sudo systemctl status nginx`
3. راجع هذا الدليل مرة أخرى

---

## ✅ Checklist النشر النهائي

- [ ] EC2 Instance يعمل
- [ ] Node.js 20 مثبت
- [ ] Redis يعمل
- [ ] PM2 مثبت ومُعد
- [ ] Nginx مُكوّن ويعمل
- [ ] المشروع منسوخ من GitHub
- [ ] ملف .env مُعد بالكامل
- [ ] البوت يعمل عبر PM2
- [ ] Webhook مُعد في Telegram
- [ ] البوت يستجيب للأوامر
- [ ] المراقبة مُفعّلة

---

**🎉 تهانينا! بوتك الآن يعمل على AWS بشكل دائم!**

---

## 📝 ملاحظات إضافية

- Free Tier يوفر 750 ساعة/شهر (كافية لتشغيل 24/7)
- مساحة التخزين: حتى 30 GB مجاناً
- النقل البيانات: 15 GB/شهر مجاناً
- بعد 12 شهر: سعر t2.micro حوالي $8-10/شهر

**نصيحة**: راقب استخدامك من AWS Billing Dashboard لتجنب التكاليف غير المتوقعة.
