#!/bin/bash

echo "🚀 Starting Redis Server..."

redis-server --daemonize yes \
  --port 6379 \
  --bind 127.0.0.1 \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru \
  --save 60 1000 \
  --loglevel notice \
  --logfile redis.log

if [ $? -eq 0 ]; then
  echo "✅ Redis Server started successfully on port 6379"
  echo "📊 Maxmemory: 256MB with LRU eviction policy"
else
  echo "❌ Failed to start Redis Server"
  exit 1
fi

sleep 1

if redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is responding to ping"
else
  echo "❌ Redis is not responding"
  exit 1
fi
