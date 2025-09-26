#!/bin/bash

# Pilot Observe Script - Start observability stack (Prometheus + Grafana)
set -e

echo "📊 Starting Observability Stack..."
echo "=================================="

# Navigate to pilot deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PILOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PILOT_DIR"

echo "📁 Working directory: $PILOT_DIR"

# Check if core services are running
if ! docker-compose -f docker-compose.poc.yml ps | grep -q "Up"; then
    echo "⚠️  Core services not running. Starting them first..."
    ./scripts/pilot-up.sh
fi

# Start observability services
echo "🏗️  Starting Prometheus and Grafana..."
docker-compose -f docker-compose.poc.yml --profile observability up -d prometheus grafana

# Wait for services to be ready
echo "⏳ Waiting for observability services..."
timeout 60 bash -c 'until curl -f http://localhost:9090 > /dev/null 2>&1; do sleep 2; done' || {
    echo "⚠️  Prometheus taking longer than expected"
}

timeout 60 bash -c 'until curl -f http://localhost:3000 > /dev/null 2>&1; do sleep 2; done' || {
    echo "⚠️  Grafana taking longer than expected"
}

# Check service status
echo ""
echo "📊 Observability Status:"
docker-compose -f docker-compose.poc.yml --profile observability ps

# Test connectivity
echo ""
echo "🔍 Testing observability connectivity..."

if curl -f http://localhost:9090 > /dev/null 2>&1; then
    echo "✅ Prometheus (http://localhost:9090) - Ready"
else
    echo "❌ Prometheus (http://localhost:9090) - Not responding"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Grafana (http://localhost:3000) - Ready"
else
    echo "❌ Grafana (http://localhost:3000) - Not responding"
fi

echo ""
echo "📈 Observability Stack Ready!"
echo "============================="
echo ""
echo "🎯 Access Points:"
echo "   📊 Prometheus: http://localhost:9090"
echo "   📈 Grafana:    http://localhost:3000"
echo "      - Username: admin"
echo "      - Password: pilot123"
echo ""
echo "📋 Pre-configured Dashboards:"
echo "   - Pilot PoC Overview"
echo "   - Success Metrics Tracking"
echo "   - System Health Monitor"
echo ""
echo "🔧 Management:"
echo "   View logs: docker-compose -f docker-compose.poc.yml --profile observability logs -f"
echo "   Stop all:  ./scripts/pilot-down.sh"