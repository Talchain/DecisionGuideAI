# Usage Meter Backup Guide

**Safe backup procedures for usage tracking data (when enabled)**

## Overview

The usage meter tracks API calls, token consumption, and resource utilization when `ENABLE_USAGE_TRACKING=true`. This guide covers backup procedures that run safely even when the feature is disabled.

**⚠️ Default State: DISABLED** - Usage tracking is OFF by default for privacy and safety.

## Quick Status Check

```bash
# Check if usage tracking is enabled
npm run flags:print | grep USAGE

# Expected output when disabled (default):
# ENABLE_USAGE_TRACKING: false (or not shown)
```

## Backup Procedures

### Dry-Run Backup (Safe Always)

The backup script runs safely whether usage tracking is enabled or not:

```bash
# Run backup dry-run (safe - no changes made)
./tools/usage-backup-dry-run.sh

# What it does:
# ✅ Checks if DATABASE_URL is configured
# ✅ Verifies usage tracking status
# ✅ Shows what would be backed up (if enabled)
# ✅ Reports "skipped (no DB)" if disabled
```

### When Usage Tracking is OFF (Default)

```
🗄️ Usage Backup Dry-Run
========================
📊 Usage Tracking: DISABLED
🗃️ Database: Not configured
📤 Backup Status: SKIPPED (no data to backup)
✅ No action needed - usage tracking is off
```

### When Usage Tracking is ON

```
🗄️ Usage Backup Dry-Run
========================
📊 Usage Tracking: ENABLED
🗃️ Database: Connected (sqlite/postgres)
📊 Records found: 1,247 usage entries
📤 Would backup: /artifacts/usage-backup-YYYY-MM-DD.json
✅ Dry-run complete - no files created
```

## Backup Data Format

When enabled, usage data is backed up as JSON:

```json
{
  "backup_info": {
    "timestamp": "2024-09-24T19:35:00Z",
    "source_db": "postgresql://...",
    "record_count": 1247,
    "date_range": {
      "start": "2024-09-01T00:00:00Z",
      "end": "2024-09-24T19:35:00Z"
    }
  },
  "usage_records": [
    {
      "timestamp": "2024-09-24T19:30:00Z",
      "endpoint": "/api/analysis",
      "method": "POST",
      "tokens_consumed": 156,
      "response_time_ms": 2340,
      "status_code": 200,
      "user_id": "usr_anonymized_001"
    }
  ],
  "aggregates": {
    "total_requests": 1247,
    "total_tokens": 185432,
    "avg_response_time": 1850,
    "success_rate": 0.987
  }
}
```

## Running Real Backup (When Enabled)

### Prerequisites

1. Usage tracking must be enabled:
```bash
export ENABLE_USAGE_TRACKING=true
```

2. Database must be configured:
```bash
export DATABASE_URL="postgresql://user:pass@localhost/usage_db"
# OR for development:
export DATABASE_URL="sqlite:./usage.db"
```

### Backup Commands

```bash
# Full backup (all time)
./tools/usage-backup.sh

# Last 30 days only
./tools/usage-backup.sh --days 30

# Specific date range
./tools/usage-backup.sh --start 2024-09-01 --end 2024-09-24
```

### Backup Schedule

For production environments with usage tracking enabled:

```bash
# Daily backup (in cron)
0 2 * * * /path/to/tools/usage-backup.sh --days 7

# Weekly full backup
0 3 * * 0 /path/to/tools/usage-backup.sh
```

## Data Privacy & Security

### PII Protection

- **User IDs**: Anonymized (usr_anonymized_001, usr_anonymized_002, etc.)
- **IP Addresses**: Not stored
- **Request Payloads**: Never logged or backed up
- **Response Content**: Never logged or backed up

### Backup Security

```bash
# Encrypt backup files (recommended)
gpg --encrypt --recipient ops@company.com usage-backup-2024-09-24.json

# Secure transfer
scp usage-backup-2024-09-24.json.gpg backup-server:/secure/backups/
```

### Retention Policy

- **Local backups**: Keep for 90 days
- **Encrypted backups**: Keep for 1 year
- **Raw database**: Keep for 30 days active + 60 days archive

## Restore Procedures

### When Usage Tracking is OFF

No restore needed - no data was collected.

### When Restoring Usage Data

```bash
# Restore from backup file
./tools/usage-restore.sh usage-backup-2024-09-24.json

# Validate restore
./tools/usage-validate.sh --check-counts --check-integrity
```

## Troubleshooting

### "No database configured"

This is normal when `DATABASE_URL` is not set. Usage tracking uses memory-only counters when no database is available.

```bash
# Check configuration
echo "DATABASE_URL: ${DATABASE_URL:-"not set"}"
echo "USAGE_TRACKING: ${ENABLE_USAGE_TRACKING:-"false"}"
```

### "Database connection failed"

Ensure your database is running and accessible:

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# OR for SQLite
sqlite3 ${DATABASE_URL#sqlite:} "SELECT 1;"
```

### "Backup file too large"

Usage data can grow quickly. Consider:

```bash
# Backup with compression
./tools/usage-backup.sh --compress --days 30

# Split large backups
./tools/usage-backup.sh --split-by-month
```

## Emergency Procedures

### Disable Usage Tracking Immediately

```bash
# Emergency disable (current session)
export ENABLE_USAGE_TRACKING=false

# OR use panic-off switch
source ./tools/panic-off.sh
```

### Data Breach Response

1. Immediately disable usage tracking
2. Secure existing backup files
3. Review what data was collected
4. Notify relevant parties per policy

```bash
# Emergency backup before disabling
./tools/usage-backup.sh --emergency --encrypt

# Disable tracking
export ENABLE_USAGE_TRACKING=false
```

## Best Practices

### Development

- Use dry-run scripts first
- Test backups with synthetic data
- Never enable usage tracking for local development

### Production

- Regular backup schedule
- Encrypted storage
- Limited retention periods
- Regular restore testing

### Monitoring

```bash
# Check backup health
./tools/usage-backup-health.sh

# Monitor backup sizes
du -h artifacts/usage-backup-*.json | tail -5
```

---

**🛡️ Remember**: Usage tracking is OFF by default. These procedures are for environments where you explicitly enable usage monitoring.

*All backup operations are safe to run even when usage tracking is disabled.*