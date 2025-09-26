#!/bin/bash

# Pilot Up Script - Start the Scenario Sandbox PoC
set -e

echo "🚀 Starting Scenario Sandbox PoC..."
echo "===================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to pilot deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PILOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PILOT_DIR"

echo "📁 Working directory: $PILOT_DIR"

# Check for environment file
if [ ! -f ".env.poc" ]; then
    echo "📝 Creating .env.poc from example..."
    cp .env.poc.example .env.poc
    echo "✅ Environment file created. Review .env.poc before continuing."
fi

# Pull latest images (if available)
echo "🔄 Pulling Docker images..."
docker-compose -f docker-compose.poc.yml pull || echo "⚠️  Some images may need to be built locally"

# Start core services
echo "🏗️  Starting core services (Gateway, Engine, Jobs)..."
docker-compose -f docker-compose.poc.yml up -d gateway engine jobs

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout 60 bash -c 'until docker-compose -f docker-compose.poc.yml ps | grep -q "healthy"; do sleep 2; done' || {
    echo "⚠️  Services taking longer than expected to start"
}

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.poc.yml ps

# Test basic connectivity
echo ""
echo "🔍 Testing basic connectivity..."

# Test Gateway health
if curl -f http://localhost:3001/healthz > /dev/null 2>&1; then
    echo "✅ Gateway (http://localhost:3001) - Healthy"
else
    echo "❌ Gateway (http://localhost:3001) - Not responding"
fi

# Test Engine health
if curl -f http://localhost:3002/healthz > /dev/null 2>&1; then
    echo "✅ Engine (http://localhost:3002) - Healthy"
else
    echo "❌ Engine (http://localhost:3002) - Not responding"
fi

# Test Jobs health
if curl -f http://localhost:3003/healthz > /dev/null 2>&1; then
    echo "✅ Jobs (http://localhost:3003) - Healthy"
else
    echo "❌ Jobs (http://localhost:3003) - Not responding"
fi

echo ""
echo "🎯 Pilot PoC is ready!"
echo "====================="
echo "📺 Frontend: Open your Windsurf application and configure:"
echo "   - Stream URL: http://localhost:3001/stream"
echo "   - Cancel URL: http://localhost:3001/cancel"
echo "   - Report URL: http://localhost:3001/report"
echo ""
echo "🔧 Management Commands:"
echo "   View logs:    docker-compose -f docker-compose.poc.yml logs -f"
echo "   Stop:         ./scripts/pilot-down.sh"
echo "   Reset:        ./scripts/pilot-reset.sh"
echo "   Observe:      ./scripts/pilot-observe.sh"
echo ""
echo "📖 Next: See RUNBOOK.md for demo workflow"