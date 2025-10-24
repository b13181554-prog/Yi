#!/bin/bash

# Redis Cluster Initialization Script
# تهيئة Redis Cluster للإنتاج

echo "🚀 Initializing Redis Cluster..."
echo "=================================="

# انتظار جاهزية جميع Redis nodes
echo "⏳ Waiting for all Redis nodes to be ready..."
sleep 10

# إنشاء الـ cluster
echo "🔧 Creating Redis cluster..."
redis-cli --cluster create \
  redis-master-1:7001 \
  redis-master-2:7002 \
  redis-master-3:7003 \
  redis-replica-1:7004 \
  redis-replica-2:7005 \
  redis-replica-3:7006 \
  --cluster-replicas 1 \
  --cluster-yes

if [ $? -eq 0 ]; then
  echo "✅ Redis cluster created successfully!"
  echo ""
  echo "📊 Cluster info:"
  redis-cli -c -h redis-master-1 -p 7001 cluster info
  echo ""
  echo "📋 Cluster nodes:"
  redis-cli -c -h redis-master-1 -p 7001 cluster nodes
else
  echo "❌ Failed to create Redis cluster"
  exit 1
fi

echo ""
echo "✅ Redis Cluster is ready!"
