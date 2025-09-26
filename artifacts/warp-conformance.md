# Warp Conformance Micro-Suite

A portable, lightweight test runner to verify Warp engine compliance with DecisionGuide AI platform requirements.

## 🎯 Overview

The Warp Conformance Suite tests critical platform behaviors:

- **Cancel Speed**: ≤150ms cancellation with terminal `done` event
- **Determinism**: Same seed produces identical results
- **Cache Headers**: `Cache-Control: no-store` on non-cacheable routes
- **Seed Echo**: Request seed appears in response metadata

## 🚀 Quick Start

### Simulation Mode (No Network)
```bash
# Run all tests in simulation mode
npm run conformance:warp -- --sim

# Alternative direct execution
tsx tools/warp-conformance.ts --sim
```

### Live Testing
```bash
# Test against local Warp instance
npm run conformance:warp -- --base http://localhost:4311

# Test against remote Warp
npm run conformance:warp -- --base https://warp.example.com

# Direct execution with custom base URL
tsx tools/warp-conformance.ts --base http://localhost:8080
```

## 📋 Test Details

### 1. Cancel Speed ≤150ms & Terminal Event
**What it tests:**
- Start a 10-step job/stream
- Cancel at step 5
- Measure cancellation latency
- Verify terminal `done` event with `reason: "cancelled"`

**Success criteria:**
- Cancellation completes in ≤150ms
- Terminal event is emitted with correct reason

### 2. Determinism by Seed
**What it tests:**
- Run same request twice with identical seed
- Compare response hashes/content
- Verify identical results

**Success criteria:**
- Same seed produces byte-for-byte identical results
- No variance between runs

### 3. Cache-Control Headers
**What it tests:**
- Call non-cacheable routes (e.g., `/api/v1/analyze`)
- Check response headers
- Verify cache prevention

**Success criteria:**
- `Cache-Control` header includes `no-store`
- Additional cache prevention headers may be present

### 4. Seed Echo in Metadata
**What it tests:**
- Send request with `seed` parameter
- Check response metadata
- Verify seed is echoed back

**Success criteria:**
- Response `meta.seed` matches request seed
- Seed is preserved in both stream and report responses

## 📊 Output

### Console Output
```
🧪 Warp Conformance Micro-Suite
================================
Mode: SIMULATION
Base URL: http://localhost:4311

🛑 Testing: Cancel Speed ≤150ms & Terminal Event
🎲 Testing: Determinism by Seed
📦 Testing: Cache-Control: no-store
🌱 Testing: Seed Echo in Metadata

📄 Report saved: artifacts/reports/warp-conformance.html

📊 Conformance Summary
==============================
Overall Status: ✅ PASS
Tests Run: 4
Passed: 4
Failed: 0

✅ Cancel Speed ≤150ms & Terminal Event: Cancellation in 120ms with terminal done event
✅ Determinism by Seed: Same seed produces identical results
✅ Cache-Control: no-store: Cache-Control header correctly prevents caching
✅ Seed Echo in Metadata: Seed correctly echoed in response metadata
```

### HTML Report
Generated at `artifacts/reports/warp-conformance.html`:

- **Summary Dashboard**: Pass/fail counts and overall status
- **Detailed Results**: Each test with expected vs actual values
- **Timing Information**: Performance metrics where applicable
- **Error Details**: Full error context for failed tests

## 🔧 Configuration Options

### Command Line Arguments
```bash
# Show help
npm run conformance:warp -- --help

# Simulation mode (default: false)
npm run conformance:warp -- --sim

# Live testing with base URL
npm run conformance:warp -- --base <url>
```

### Environment Variables
None required. All configuration is via command line arguments.

## 🛠️ Integration

### CI/CD Usage
```bash
# Run conformance tests in CI
npm run conformance:warp -- --sim

# Exit codes:
# 0 = All tests passed
# 1 = One or more tests failed or suite crashed
```

### Pre-Release Validation
```bash
# Validate before Warp deployment
npm run conformance:warp -- --base http://staging.warp.internal

# Check report for detailed results
open artifacts/reports/warp-conformance.html
```

## 📈 Interpreting Results

### ✅ PASS Status
All conformance requirements met:
- Cancellation is fast and reliable
- Determinism is maintained
- Caching is properly prevented
- Seed traceability works

### ❌ FAIL Status
One or more requirements not met:
- Review HTML report for details
- Check specific test failures
- Validate Warp configuration
- Verify network connectivity (live mode)

## 🐛 Troubleshooting

### Common Issues

**"Connection refused" in live mode**
- Verify Warp is running at specified base URL
- Check network connectivity
- Ensure correct port and protocol

**"Timeout" errors**
- Warp may be overloaded
- Increase timeout values in code if needed
- Check Warp logs for errors

**Determinism test fails**
- Warp may have timing-based variance
- Check for external dependencies in Warp
- Verify seed handling is implemented correctly

**Headers test fails**
- Check Warp's cache-control configuration
- Verify response middleware is properly set
- Review Warp's HTTP header settings

### Debug Mode
For detailed debugging, modify the tool to add verbose logging:
```typescript
// Uncomment debug lines in tools/warp-conformance.ts
console.log('DEBUG: Request details:', requestDetails);
```

## 🔗 Related Documentation

- [Warp Engine Documentation](../docs/WARP_ENGINE.md)
- [Integration Testing Guide](../docs/INTEGRATION_TESTING.md)
- [Platform Requirements](../docs/PLATFORM_REQUIREMENTS.md)

## 📝 Test Data

### Sample Conformant Response
```json
{
  "meta": {
    "seed": 12345,
    "timestamp": "2025-09-26T14:30:00Z",
    "duration": 1250,
    "model": "gpt-4"
  },
  "steps": [...],
  "totals": {
    "totalTokens": 150,
    "totalCost": 0.045
  }
}
```

### Sample Headers
```
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store, no-cache, must-revalidate
Expires: Thu, 01 Jan 1970 00:00:00 GMT
```

---

*Last Updated: 2025-09-26*
*Part of DecisionGuide AI Platform Quality Assurance Suite*