# SLO Guard & Trend Monitoring

Service Level Objective monitoring with configurable thresholds and fail-fast behaviour for CI/CD integration.

## Overview

The SLO Guard system monitors key performance metrics against configurable thresholds and maintains a historical trend for analysis. It's designed to fail fast when performance drifts beyond acceptable limits.

## Usage

### Quick Start

```bash
# Run SLO guard with default thresholds
npm run slo:guard

# Run with custom thresholds
SLO_P95_MS=800 SLO_TTFF_MS=600 npm run slo:guard
```

### Exit Codes

- `0`: All SLO checks passed
- `1`: One or more SLO violations detected
- `2`: System error (configuration, file access, etc.)

## Configuration

All thresholds are configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SLO_TTFF_MS` | `500` | Time to First Frame threshold (milliseconds) |
| `SLO_CANCEL_MS` | `150` | Cancel operation latency threshold (milliseconds) |
| `SLO_P95_MS` | `600` | 95th percentile response time threshold (milliseconds) |
| `SLO_ERROR_RATE` | `0.05` | Maximum acceptable error rate (5%) |
| `SLO_SUCCESS_RATE` | `0.95` | Minimum acceptable success rate (95%) |

### Example: Stricter Thresholds

```bash
export SLO_TTFF_MS=300        # Stricter TTFF
export SLO_P95_MS=400         # Stricter P95
export SLO_ERROR_RATE=0.02    # Lower error tolerance (2%)
npm run slo:guard
```

### Example: Relaxed Thresholds

```bash
export SLO_TTFF_MS=800        # More lenient TTFF
export SLO_P95_MS=1000        # More lenient P95
export SLO_SUCCESS_RATE=0.90  # Lower success requirement (90%)
npm run slo:guard
```

## Data Sources

The SLO Guard automatically discovers metrics from multiple sources in order of preference:

1. **Health Endpoint Data** (`artifacts/reports/health-status.json`)
   - P95/P99 response times
   - Error and success rates
   - Most accurate source when available

2. **Live Swap Logs** (`artifacts/reports/live-swap.log`)
   - TTFF measurements from recent live validations
   - Provides real-world client experience data

3. **Simulated Metrics**
   - Used when real data unavailable
   - Provides realistic baseline for demonstration

## Outputs

### Console Output

Immediate feedback with pass/fail status:

```
✅ SLO Guard: PASS

📊 Checks: 5/5 passed
📈 Trend: healthy (stable)
🎯 Recent failures: 0/7 days
📍 Source: health-endpoint
```

Or when violations detected:

```
❌ SLO Guard: FAIL

❌ SLO Violations:
   P95 Response Time: 635ms (≤ 600ms)
   Success Rate: 94% (≥ 95%)

📊 Checks: 3/5 passed
📈 Trend: warning (degrading)
🎯 Recent failures: 2/7 days
📍 Source: live-swap-log
```

### Trend Data File

Historical data stored in `artifacts/reports/slo-trend.json`:

```json
{
  "version": "1.0",
  "created_at": "2025-09-27T15:48:29.157Z",
  "last_updated": "2025-09-27T15:48:29.158Z",
  "thresholds": {
    "ttff_ms": 500,
    "cancel_ms": 150,
    "p95_ms": 600,
    "error_rate": 0.05,
    "success_rate": 0.95
  },
  "data_points": [
    {
      "date": "2025-09-27",
      "timestamp": "2025-09-27T15:48:29.158Z",
      "metrics": {
        "ttff_ms": 483,
        "cancel_ms": 127,
        "p95_ms": 592,
        "error_rate": 0.026,
        "success_rate": 0.974
      },
      "evaluation": {
        "overall_passed": true,
        "passed_checks": 5,
        "total_checks": 5,
        "failures": []
      },
      "source": "health-endpoint"
    }
  ]
}
```

## Trend Analysis

The system maintains 30 days of historical data and provides trend analysis:

- **healthy**: No recent failures, metrics within bounds
- **warning**: 1-3 failures in last 7 days
- **critical**: More than 3 failures in last 7 days
- **insufficient_data**: Less than 2 data points available

Trend direction:
- **improving**: Metrics trending better over time
- **stable**: Metrics relatively consistent
- **degrading**: Metrics trending worse over time

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: SLO Guard Check
  run: npm run slo:guard
  continue-on-error: false  # Fail build on SLO violations
```

### Local Development

For local development, you may want to run SLO guard non-blocking:

```bash
npm run slo:guard || echo "⚠️ SLO violations detected but continuing..."
```

## Tuning Guidelines

### Initial Setup

1. **Baseline Period**: Run for 7-14 days with relaxed thresholds to establish baseline
2. **Gradual Tightening**: Reduce thresholds by 10-20% weekly until optimal
3. **Monitor False Positives**: Adjust if legitimate traffic patterns trigger failures

### Threshold Recommendations

#### Development Environment
- `SLO_P95_MS=1000` (more lenient for local debugging)
- `SLO_SUCCESS_RATE=0.90` (account for dev environment instability)

#### Staging Environment
- `SLO_P95_MS=600` (production-like performance)
- `SLO_SUCCESS_RATE=0.95` (production-like reliability)

#### Production Environment
- `SLO_P95_MS=400` (strict performance requirements)
- `SLO_SUCCESS_RATE=0.98` (high reliability expectations)

### Performance Baselines

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| TTFF | < 300ms | < 500ms | > 800ms |
| Cancel Latency | < 100ms | < 150ms | > 250ms |
| P95 Response | < 400ms | < 600ms | > 1000ms |
| Error Rate | < 2% | < 5% | > 10% |
| Success Rate | > 98% | > 95% | < 90% |

## Troubleshooting

### Common Issues

**No metrics found:**
```
📍 Source: simulated
```
- Ensure health endpoint is generating `artifacts/reports/health-status.json`
- Or run live swap validation to generate logs

**All checks failing:**
```
❌ SLO Violations: [all metrics]
```
- Check if thresholds are too strict for current system
- Verify metrics collection is working correctly

**Trend shows "insufficient_data":**
- Need at least 2 days of data for trend analysis
- Run SLO guard daily for proper trending

### Debug Mode

For detailed debugging, check the trend file:

```bash
cat artifacts/reports/slo-trend.json | jq .data_points[-1]
```

This shows the most recent data point with all collected metrics and evaluation results.

## Files

- **Script**: `scripts/slo-guard.mjs`
- **NPM Command**: `npm run slo:guard`
- **Trend Data**: `artifacts/reports/slo-trend.json`
- **Configuration**: Environment variables (see table above)

The SLO Guard is designed to be a simple, reliable way to ensure your service maintains acceptable performance characteristics over time.