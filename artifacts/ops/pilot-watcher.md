# Pilot Watcher Operations Guide

The Pilot Watcher is a continuous monitoring tool designed for live pilot operations. It performs regular health checks and maintains a real-time log of system status.

## Overview

- **Purpose**: Continuous monitoring during pilot sessions with enhanced resilience
- **Frequency**: Every 5 minutes (with exponential backoff on failures)
- **Default Duration**: 1 hour (configurable via `--duration`)
- **Log Output**: `artifacts/reports/live-swap.log`
- **Status**: OFF by default (opt-in)

### Enhanced Features

- **Exponential Backoff**: Delays increase on consecutive failures (5min → 10min → 20min → 40min)
- **Incident Stubs**: Automatic creation for 2+ consecutive failures
- **Final Capsule**: Summary line with PASS/FAIL statistics for the monitoring window
- **Bounded Runs**: Clean shutdown after specified duration
- **Improved CLI**: `--duration` flag for easy time specification

## Quick Start

```bash
# Start monitoring with defaults (1 hour, localhost:3001)
node scripts/pilot-watcher.mjs

# Monitor for 30 minutes using --duration flag
node scripts/pilot-watcher.mjs --duration 30

# Monitor for 2 hours
node scripts/pilot-watcher.mjs --duration 120

# Monitor different endpoint for 45 minutes
BASE_URL=https://pilot.example.com node scripts/pilot-watcher.mjs --duration 45

# Show help
node scripts/pilot-watcher.mjs --help

# Stop cleanly with Ctrl+C
```

## Configuration

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--duration <minutes>` | How long to monitor | 60 minutes |
| `--help`, `-h` | Show help message | - |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | Target endpoint to monitor |

### Monitoring Parameters

- **Interval**: 5 minutes (fixed)
- **Health Timeout**: 10 seconds per check
- **Log Location**: `artifacts/reports/live-swap.log`
- **Check Endpoint**: `${BASE_URL}/health`

## Log Format

Each monitoring check appends a line to the log file:

```
2025-09-28T16:15:00.000Z | Check #1 | PASS | 45ms | HTTP 200
2025-09-28T16:20:00.000Z | Check #2 | FAIL | 10003ms | Timeout
2025-09-28T16:25:00.000Z | Check #3 | PASS | 78ms | HTTP 200
```

**Format**: `timestamp | check# | PASS/FAIL | duration | details`

### Final Capsule Line

At the end of each monitoring session, a summary capsule line is written:

```
CAPSULE: 2025-09-28T17:10:00.456Z | Window: 3600s | Checks: 12 | PASS: 11 | FAIL: 1 | Rate: 92% | Status: HEALTHY
```

**Capsule Format**: `CAPSULE: timestamp | Window: Xs | Checks: N | PASS: N | FAIL: N | Rate: N% | Status: HEALTHY/DEGRADED/UNHEALTHY`

**Status Classification**:
- `HEALTHY`: ≥90% pass rate
- `DEGRADED`: 70-89% pass rate
- `UNHEALTHY`: <70% pass rate

## Usage Scenarios

### During Pilot Sessions

1. **Pre-pilot**: Start watcher 5 minutes before demo
2. **During pilot**: Monitor runs in background
3. **Post-pilot**: Review log for any issues

```bash
# 30 minutes before pilot meeting
DURATION_MS=2700000 node scripts/pilot-watcher.mjs &

# Check log during pilot
tail -f artifacts/reports/live-swap.log
```

### Development Testing

```bash
# Quick 10-minute health monitoring
DURATION_MS=600000 node scripts/pilot-watcher.mjs

# Monitor staging environment
BASE_URL=https://staging.example.com node scripts/pilot-watcher.mjs
```

## Operational Features

### Clean Shutdown

- **SIGINT**: Ctrl+C for immediate clean stop
- **SIGTERM**: Graceful shutdown from process managers
- **Auto-stop**: Stops after configured duration
- **Error handling**: Logs errors and exits cleanly

### Log Management

The watcher appends to `live-swap.log` with session markers:

```
# Pilot Watcher Session Started - 2025-09-28T16:10:00.000Z
# Target: http://localhost:3001, Interval: 300000ms, Duration: 3600000ms
2025-09-28T16:10:00.123Z | Check #1 | PASS | 67ms | HTTP 200
...
# Pilot Watcher Session Ended - 2025-09-28T17:10:00.456Z (12 checks completed)
```

### Status Indicators

| Status | Meaning | Action |
|--------|---------|---------|
| `PASS` | Health endpoint returned 200 OK | Continue monitoring |
| `FAIL` | Health check failed or timeout | Investigate service |

**Common failure details**:
- `Timeout` - Health check took >10 seconds
- `HTTP 500` - Server error
- `ECONNREFUSED` - Service not running
- `ENOTFOUND` - DNS/network issue

## Integration

### With Rehearsal Script

```bash
# Run rehearsal then start monitoring
npm run pilot:rehearse && node scripts/pilot-watcher.mjs
```

### With CI/CD

```bash
# In deployment pipeline
DURATION_MS=900000 node scripts/pilot-watcher.mjs &
WATCHER_PID=$!

# Deploy new version...
# ...

# Stop monitoring
kill $WATCHER_PID
```

### With Process Managers

```bash
# PM2 example
pm2 start scripts/pilot-watcher.mjs --name "pilot-watcher" --env DURATION_MS=7200000

# Stop monitoring
pm2 stop pilot-watcher
```

## Troubleshooting

### Watcher Won't Start

1. Check if artifacts/reports directory exists
2. Verify BASE_URL is accessible
3. Ensure no other process is using the log file

### Missing Log Entries

1. Check write permissions on artifacts/reports/
2. Verify watcher is still running (`ps aux | grep pilot-watcher`)
3. Check for error messages in console output

### High Failure Rate

1. Verify target service is running (`curl ${BASE_URL}/health`)
2. Check network connectivity
3. Review service logs for errors
4. Consider increasing health timeout

## Security Considerations

- **No authentication**: Health checks use anonymous requests
- **Log content**: Contains timestamps and response codes only
- **Network**: Uses standard HTTP requests
- **File permissions**: Respects system umask for log files

## Performance Impact

- **CPU**: Minimal (one request every 5 minutes)
- **Memory**: ~10MB resident
- **Network**: ~1KB per check
- **Disk**: ~50 bytes per log line

## Best Practices

1. **Pre-pilot**: Test watcher with your target URL
2. **During pilot**: Monitor console output for immediate feedback
3. **Post-pilot**: Archive log files with session artifacts
4. **Automation**: Use environment variables for configuration
5. **Monitoring**: Consider alerting on consecutive failures

## Related Tools

- **pilot-rehearsal.mjs**: Pre-pilot readiness testing
- **nightly-selftest.mjs**: Comprehensive system validation
- **stability-runner.mjs**: Multi-seed determinism testing

---

*This tool is part of the Decision Guide AI pilot operations suite. Default state: OFF.*