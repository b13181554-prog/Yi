#!/bin/bash

echo "🚀 Starting OBENTCHI Trading Bot - Production Mode"
echo "================================================"
echo ""

# تشغيل Redis في الخلفية
echo "📡 Starting Redis..."
./start-redis.sh &

sleep 2
echo ""

# تشغيل جميع الخدمات في الخلفية ماعدا HTTP Server
echo "🤖 Starting Bot Worker in background..."
node services/bot-worker.js > /dev/null 2>&1 &
BOT_PID=$!

echo "⚙️ Starting Queue Worker in background..."
node services/queue-worker.js > /dev/null 2>&1 &
QUEUE_PID=$!

echo "📅 Starting Scheduler in background..."
node services/scheduler.js > /dev/null 2>&1 &
SCHEDULER_PID=$!

sleep 2
echo ""

# تشغيل HTTP Server في المقدمة (للـ workflow)
echo "🌐 Starting HTTP Server on port 5000..."
echo ""
node services/http-server.js

# عند الإيقاف، إيقاف جميع العمليات
echo ""
echo "⚠️ Stopping all background services..."
kill $BOT_PID $QUEUE_PID $SCHEDULER_PID 2>/dev/null
