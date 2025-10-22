#!/bin/bash

echo "🚀 Starting OBENTCHI Trading Bot - Production Mode"
echo "================================================"
echo ""

# تشغيل Redis في الخلفية
echo "📡 Starting Redis..."
./start-redis.sh &

sleep 2
echo ""

# تشغيل Queue Worker و Scheduler في الخلفية
echo "⚙️ Starting Queue Worker in background..."
node services/queue-worker.js > /dev/null 2>&1 &
QUEUE_PID=$!

echo "📅 Starting Scheduler in background..."
node services/scheduler.js > /dev/null 2>&1 &
SCHEDULER_PID=$!

sleep 2
echo ""

# تشغيل index.js الذي يحتوي على جميع API endpoints والبوت
echo "🌐 Starting Complete Server (API + Bot) on port 5000..."
echo ""
node index.js

# عند الإيقاف، إيقاف جميع العمليات
echo ""
echo "⚠️ Stopping all background services..."
kill $QUEUE_PID $SCHEDULER_PID 2>/dev/null
