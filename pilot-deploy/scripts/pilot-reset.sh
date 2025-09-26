#!/bin/bash

# Pilot Reset Script - Complete reset of the Scenario Sandbox PoC
set -e

echo "🔄 Resetting Scenario Sandbox PoC..."
echo "===================================="

# Navigate to pilot deploy directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PILOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PILOT_DIR"

echo "📁 Working directory: $PILOT_DIR"

# Warn user about data loss
echo "⚠️  WARNING: This will:"
echo "   - Stop all containers"
echo "   - Remove all volumes and data"
echo "   - Reset to clean state"
echo ""
read -p "Are you sure? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset cancelled"
    exit 1
fi

echo ""
echo "🛑 Stopping all services..."
docker-compose -f docker-compose.poc.yml --profile observability down

echo "🗑️  Removing volumes and data..."
docker-compose -f docker-compose.poc.yml --profile observability down -v

echo "🧹 Removing orphaned containers..."
docker-compose -f docker-compose.poc.yml --profile observability rm -f

echo "🔍 Cleaning up Docker system..."
docker system prune -f --volumes

# Reset environment file
if [ -f ".env.poc" ]; then
    echo "📝 Backing up current .env.poc to .env.poc.backup"
    cp .env.poc .env.poc.backup
    echo "🔄 Resetting .env.poc from example"
    cp .env.poc.example .env.poc
fi

echo ""
echo "✅ Pilot PoC reset complete!"
echo "============================"
echo ""
echo "🔧 Next Steps:"
echo "   1. Review .env.poc configuration"
echo "   2. Start fresh: ./scripts/pilot-up.sh"
echo "   3. Run smoke tests: ../scripts/pilot-smoke.sh"
echo ""
echo "💾 Backup: Previous environment saved as .env.poc.backup"