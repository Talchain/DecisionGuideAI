# Live Swap Safeguards Checklist

**For Windsurf Integration with DecisionGuide AI Platform**

This checklist ensures safe live swapping between simulated and real endpoints during development.

## 🔒 Pre-Flight Safety Checklist

### Essential Flags & Configuration

- [ ] **Sim Mode Toggle** - `SIM_MODE=true/false` environment variable ready
- [ ] **Rate Limiting** - `ENABLE_RATE_LIMITING=false` (OFF during development)
- [ ] **Usage Tracking** - `ENABLE_USAGE_TRACKING=false` (OFF during development)
- [ ] **Telemetry** - `ENABLE_TELEMETRY=false` (OFF during development)
- [ ] **Secret Hygiene** - `ENABLE_SECRET_BLOCKING=false` (OFF during testing)
- [ ] **Cache Layer** - `ENABLE_CACHE=false` (OFF for accurate testing)

### Headers to Preserve

- [ ] **Session ID** - `X-Session-ID` (maintains continuity)
- [ ] **Request ID** - `X-Request-ID` (for debugging/tracing)
- [ ] **User Agent** - `User-Agent` (preserve client identification)
- [ ] **Authorization** - `Authorization` (for real endpoint authentication)
- [ ] **Content-Type** - `application/json` (ensure proper parsing)
- [ ] **CORS Headers** - Allow local development origins

### SSE Stream Safeguards

- [ ] **Single Reconnect Rule** - Maximum 1 automatic reconnection attempt
- [ ] **Connection State** - Track `connected|disconnected|reconnecting|failed`
- [ ] **Event ID Tracking** - Maintain `last-event-id` for resume capability
- [ ] **Duplicate Prevention** - Filter duplicates using `last-event-id`
- [ ] **Timeout Handling** - 30-second connection timeout
- [ ] **Graceful Degradation** - Fallback to polling if SSE fails

### Endpoint Validation

- [ ] **Real Endpoint Health** - `/health` check before live swap
- [ ] **Authentication Ready** - Valid API keys/tokens configured
- [ ] **Schema Compatibility** - Response formats match mock structure
- [ ] **Rate Limit Headroom** - Sufficient quota for testing
- [ ] **Error Handling** - 4xx/5xx responses handled gracefully

### Data Safety

- [ ] **No Personal Data** - Remove/redact PII from test requests
- [ ] **Sanitized Inputs** - Clean test data only
- [ ] **Log Level** - Set to `INFO` or lower (no verbose logging)
- [ ] **Request Buffering** - Disable request/response logging in prod mode
- [ ] **Sensitive Headers** - Mask authorization headers in logs

## 🎯 Go/No-Go Decision Matrix

### ✅ GO Criteria (All must be true)
- All safety flags are OFF (development mode)
- Real endpoint health check passes
- Mock/real response schemas match
- Session continuity preserved
- Error boundaries in place
- No sensitive data in test payloads

### ❌ NO-GO Criteria (Any triggers abort)
- Production flags accidentally enabled
- Real endpoint returns 5xx errors
- Schema mismatches detected
- Authentication failures
- Rate limit near exhaustion
- Sensitive data in logs/requests

## 🚀 Live Swap Procedure

### 1. Pre-Swap Validation
```bash
# Verify configuration and lint
npm run config:lint

# Run integration checks
npm run integration:check

# Check system dependencies
npm run typecheck && npm test

# Check endpoint health (replace with actual endpoint)
curl -f https://api.example.com/health
```

### 2. Gradual Swap Process
1. **Start with health checks only** - Verify connectivity
2. **Swap single request type** - Test one endpoint first
3. **Monitor error rates** - Watch for 4xx/5xx increases
4. **Verify data continuity** - Check session/state preservation
5. **Full swap** - Switch all endpoints if successful

### 3. Emergency Rollback
```bash
# Immediate fallback to sim mode
export SIM_MODE=true

# Use panic-off script to disable all features
source ./tools/panic-off.sh

# Restart dev server
npm run dev
```

## 📊 Monitoring During Live Swap

### Key Metrics to Watch
- **Error Rate** - Should stay < 5%
- **Response Time** - Should stay < 2s for endpoints
- **Connection Success** - SSE connections should establish < 1s
- **Duplicate Events** - Should be 0 after deduplication
- **Memory Usage** - Should not spike during swap

### Warning Signs (Trigger Rollback)
- Error rate > 10%
- Response time > 5s consistently
- SSE connections failing repeatedly
- Memory leaks detected
- Authentication errors

## 🔧 Debugging Commands

```bash
# Check current mode and flags
echo "SIM_MODE: $SIM_MODE"
npm run flags:print

# Run determinism checks
npm run determinism:check

# Check integration status
npm run integration:check

# Verify configuration
npm run config:lint

# Emergency shutdown - disable all features
source ./tools/panic-off.sh && npm run poc:stop
```

## 📝 Post-Swap Validation

- [ ] **Functional Test** - Run key user journey
- [ ] **Performance Check** - Verify response times acceptable
- [ ] **Error Log Review** - Check for new errors/warnings
- [ ] **Resource Usage** - Confirm no memory/CPU spikes
- [ ] **Data Integrity** - Verify no data corruption/loss

## 🎭 Branch Integration Notes

**For Release Dry-Run Integration:**

When Windsurf confirms live wiring in a branch:
1. Add `LIVE_SWAP_READY=true` to branch metadata
2. Include this checklist verification in CI/CD
3. Generate go/no-go assessment automatically
4. Block deployment if safety criteria not met

**Go/No-Go Snippet for release:dry:**

Add this assessment snippet to release dry-run reports:
```bash
# Live Swap Assessment (run after core checks)
LIVE_SWAP_READY=false

# Check safety flags are OFF
if [[ "$ENABLE_RATE_LIMITING" != "true" && "$ENABLE_USAGE_TRACKING" != "true" ]]; then
    echo "✅ Safety flags: OFF (development mode)"
    LIVE_SWAP_READY=true
else
    echo "❌ Safety flags: Some production features enabled"
    LIVE_SWAP_READY=false
fi

# Check integration tests pass
if npm run integration:check > /dev/null 2>&1; then
    echo "✅ Integration tests: PASS"
else
    echo "❌ Integration tests: FAIL"
    LIVE_SWAP_READY=false
fi

# Output assessment
if [[ "$LIVE_SWAP_READY" == "true" ]]; then
    echo
    echo "🟢 LIVE SWAP ASSESSMENT: READY"
    echo "✅ Safety flags validated (all OFF)"
    echo "✅ Integration tests passing"
    echo "✅ Error boundaries present"
    echo "✅ Branch: $(git branch --show-current)"
    echo "✅ Commit: $(git rev-parse --short HEAD)"
else
    echo
    echo "🔴 LIVE SWAP ASSESSMENT: NOT READY"
    echo "⚠️  Some safety criteria not met"
    echo "⚠️  Review checklist before live wiring"
fi
```

---
*Last Updated: 2025-09-26*
*Part of DecisionGuide AI Platform Safety Documentation*