#!/bin/bash

echo "🚀 Starting OBENTCHI Trading Bot - New Architecture"
echo "=================================================="
echo ""

# تشغيل Redis أولاً
echo "📡 Starting Redis..."
./start-redis.sh

if [ $? -ne 0 ]; then
  echo "⚠️ Warning: Redis failed to start"
  echo "Some features may be limited without Redis"
fi

sleep 2
echo ""

# تشغيل Process Manager
echo "🎯 Starting all services via Process Manager..."
echo ""
node process-manager.js
