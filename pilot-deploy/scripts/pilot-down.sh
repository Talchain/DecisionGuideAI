#!/bin/bash

# Pilot Down Script - Stop the Scenario Sandbox PoC
set -e

echo "🛑 Stopping Scenario Sandbox PoC..."
echo "==================================="

# Navigate to pilot deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PILOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PILOT_DIR"

echo "📁 Working directory: $PILOT_DIR"

# Stop all services including observability
echo "🔄 Stopping all services..."
docker-compose -f docker-compose.poc.yml --profile observability down

# Show final status
echo ""
echo "📊 Final Status:"
docker-compose -f docker-compose.poc.yml ps

echo ""
echo "✅ Pilot PoC stopped successfully"
echo "================================"
echo ""
echo "🔧 Management Commands:"
echo "   Start again:  ./scripts/pilot-up.sh"
echo "   Full reset:   ./scripts/pilot-reset.sh"
echo ""
echo "💡 Note: Docker volumes are preserved. Use pilot-reset.sh to clear all data."