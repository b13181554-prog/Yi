#!/bin/bash

# Build All Docker Images Script
# بناء جميع صور Docker للمشروع

set -e  # Exit on error

echo "🏗️ Building All Docker Images for OBENTCHI Bot"
echo "=============================================="
echo ""

# إعداد المتغيرات
REGISTRY=${DOCKER_REGISTRY:-"obentchi-bot"}
VERSION=${VERSION:-"latest"}

echo "📦 Registry: $REGISTRY"
echo "🏷️ Version: $VERSION"
echo ""

# دالة للبناء مع progress
build_image() {
  local name=$1
  local dockerfile=$2
  local tag="${REGISTRY}/${name}:${VERSION}"
  
  echo "🔨 Building ${name}..."
  docker build -f ${dockerfile} -t ${tag} . \
    --build-arg NODE_ENV=production
  
  if [ $? -eq 0 ]; then
    echo "✅ ${name} built successfully: ${tag}"
  else
    echo "❌ Failed to build ${name}"
    exit 1
  fi
  echo ""
}

# بناء جميع الصور
echo "🚀 Starting build process..."
echo ""

build_image "http-server" "Dockerfile.http"
build_image "bot-webhook" "Dockerfile.bot"
build_image "queue-worker" "Dockerfile.queue"
build_image "scheduler" "Dockerfile.scheduler"

echo "=============================================="
echo "✅ All images built successfully!"
echo ""
echo "📋 Built images:"
docker images | grep ${REGISTRY}
echo ""
echo "💡 To push to registry:"
echo "   docker push ${REGISTRY}/http-server:${VERSION}"
echo "   docker push ${REGISTRY}/bot-webhook:${VERSION}"
echo "   docker push ${REGISTRY}/queue-worker:${VERSION}"
echo "   docker push ${REGISTRY}/scheduler:${VERSION}"
echo ""
echo "🚀 Ready for deployment!"
