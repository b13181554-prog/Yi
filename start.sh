#!/bin/bash

echo "🚀 Starting OBENTCHI Trading Bot..."

./start-redis.sh

if [ $? -ne 0 ]; then
  echo "⚠️ Warning: Redis failed to start"
  echo "Continuing without Redis (some features may be disabled)"
fi

sleep 2

echo "🤖 Starting Bot Server..."
node index.js
