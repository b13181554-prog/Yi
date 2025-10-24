#!/bin/bash

# Start Bot in Webhook Mode
# تشغيل البوت في وضع Webhook

echo "🚀 Starting OBENTCHI Bot - Webhook Mode"
echo "========================================"
echo ""

# التحقق من المتغيرات البيئية
if [ -z "$BOT_TOKEN" ]; then
  echo "❌ BOT_TOKEN is not set!"
  echo "Please set it in .env file"
  exit 1
fi

if [ -z "$PUBLIC_URL" ] && [ -z "$WEBHOOK_URL" ]; then
  echo "❌ PUBLIC_URL or WEBHOOK_URL is not set!"
  echo "Please set it in .env file for webhook mode"
  exit 1
fi

# تشغيل Redis إذا لم يكن يعمل
echo "📡 Checking Redis..."
if ! redis-cli ping > /dev/null 2>&1; then
  echo "⚠️ Redis not running, starting..."
  ./start-redis.sh
  sleep 2
fi

# تشغيل Webhook Worker
echo "🤖 Starting Bot Webhook Worker..."
node services/bot-webhook-worker.js

# في حالة الخطأ
if [ $? -ne 0 ]; then
  echo "❌ Failed to start Bot Webhook Worker"
  exit 1
fi
