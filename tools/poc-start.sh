#!/bin/bash
# Two-minute PoC start script for Scenario Sandbox
# Sets up the environment and starts all services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Scenario Sandbox PoC..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

cd "$PROJECT_ROOT"

# Copy example env if .env.poc doesn't exist
if [ ! -f ".env.poc" ]; then
    echo "📋 Creating .env.poc from example..."
    cp .env.poc.example .env.poc
    echo "✅ Created .env.poc with safe defaults (all features OFF)"
    echo "💡 Edit .env.poc to enable specific features for testing"
fi

echo "🐳 Starting PoC services..."
echo "   - Gateway: http://localhost:3001"
echo "   - Warp: http://localhost:4311"
echo "   - Jobs: http://localhost:4500"
echo "   - Usage Meter: http://localhost:4600"

# Start services with PoC profile
docker compose --profile poc --env-file .env.poc up -d

echo "⏳ Waiting for services to be healthy..."

# Wait for health checks (max 60 seconds)
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if docker compose --profile poc ps --format json | jq -r '.[].Health' | grep -q "unhealthy\|starting"; then
        echo "⏱️  Still starting... (${counter}s)"
        sleep 2
        counter=$((counter + 2))
    else
        break
    fi
done

# Check final status
echo "📊 Service status:"
docker compose --profile poc ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}"

echo ""
echo "✅ PoC Environment Ready!"
echo ""
echo "🌐 Quick Test:"
echo "curl http://localhost:3001/health"
echo ""
echo "🔧 To enable features:"
echo "   Edit .env.poc and restart: docker compose --profile poc --env-file .env.poc up -d"
echo ""
echo "🛑 To stop:"
echo "   docker compose --profile poc down"
echo ""
echo "📋 View logs:"
echo "   docker compose --profile poc logs -f"