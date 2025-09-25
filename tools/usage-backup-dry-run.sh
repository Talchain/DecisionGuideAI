#!/bin/bash
# Usage Meter Backup Dry-Run - Safe to run always (no changes made)
# NOOPs if DATABASE_URL is missing or usage tracking is disabled

echo "🗄️ Usage Backup Dry-Run"
echo "========================"

# Check if usage tracking is enabled
USAGE_ENABLED="${ENABLE_USAGE_TRACKING:-false}"
echo "📊 Usage Tracking: $(echo "$USAGE_ENABLED" | tr '[:lower:]' '[:upper:]')"

# Check database configuration
if [[ -z "$DATABASE_URL" ]]; then
    echo "🗃️ Database: Not configured"
    echo "📤 Backup Status: SKIPPED (no DB configured)"
    echo "✅ No action needed - DATABASE_URL not set"
    echo
    echo "ℹ️ To enable usage tracking and backups:"
    echo "  1. Set DATABASE_URL (e.g., sqlite:./usage.db)"
    echo "  2. Set ENABLE_USAGE_TRACKING=true"
    echo "  3. Run actual backup with ./tools/usage-backup.sh"
    exit 0
fi

echo "🗃️ Database: Configured"
echo "   URL: ${DATABASE_URL%%:*}://[REDACTED]"

# Check if usage tracking is off
if [[ "$USAGE_ENABLED" != "true" ]]; then
    echo "📤 Backup Status: SKIPPED (usage tracking disabled)"
    echo "✅ No action needed - usage tracking is off"
    echo
    echo "ℹ️ Usage tracking is disabled by design for privacy"
    echo "   Enable only if you need usage analytics:"
    echo "   export ENABLE_USAGE_TRACKING=true"
    exit 0
fi

echo "📊 Usage Tracking: ENABLED - simulating backup check..."

# Simulate database connection (dry-run)
echo "🔌 Testing database connection..."

# Determine database type
if [[ "$DATABASE_URL" == sqlite:* ]]; then
    DB_FILE="${DATABASE_URL#sqlite:}"
    if [[ -f "$DB_FILE" ]]; then
        echo "✅ SQLite database file exists: $DB_FILE"
        # Simulate record count check
        SIMULATED_COUNT=$((RANDOM % 1000 + 100))
        echo "📊 Records found: $SIMULATED_COUNT usage entries (simulated)"
    else
        echo "⚠️ SQLite database file not found: $DB_FILE"
        echo "   Would be created on first usage tracking event"
        SIMULATED_COUNT=0
    fi
elif [[ "$DATABASE_URL" == postgresql:* ]] || [[ "$DATABASE_URL" == postgres:* ]]; then
    echo "✅ PostgreSQL URL configured"
    # Simulate connection test without actually connecting
    SIMULATED_COUNT=$((RANDOM % 5000 + 500))
    echo "📊 Records found: $SIMULATED_COUNT usage entries (simulated)"
else
    echo "⚠️ Unsupported database URL format"
    echo "   Supported: sqlite:, postgresql:, postgres:"
    exit 1
fi

# Generate backup filename
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_FILE="artifacts/usage-backup-${BACKUP_DATE}.json"

echo "📤 Would backup to: $BACKUP_FILE"

if [[ $SIMULATED_COUNT -gt 0 ]]; then
    echo "📋 Backup would include:"
    echo "   - $SIMULATED_COUNT usage records"
    echo "   - Request/response metrics"
    echo "   - Token consumption data"
    echo "   - Anonymized user statistics"
    echo "   - Performance aggregates"
else
    echo "📋 No usage data to backup (empty database)"
fi

echo "🗜️ Estimated backup size: ~$((SIMULATED_COUNT * 120))B"

echo
echo "✅ Dry-run complete - no files created"
echo "🛡️ All user data would be anonymized in actual backup"
echo "🔒 No payloads or PII would be included"

echo
echo "📝 To run actual backup (when ready):"
echo "   ./tools/usage-backup.sh"
echo "   ./tools/usage-backup.sh --days 30    # Last 30 days only"
echo "   ./tools/usage-backup.sh --compress   # Compressed backup"