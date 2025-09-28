# Resilience Drills Checklist

**Purpose**: Verify fault tolerance and recovery behavior using dev-only chaos endpoints

## ⚠️ Development Only

**CRITICAL**: These endpoints are only available when:
- `TEST_ROUTES=1` environment variable is set
- `NODE_ENV` is NOT `production`
- Never available in production deployments

## 🎯 Quick Setup

### Prerequisites
```bash
# Enable test routes
export TEST_ROUTES=1

# Ensure not in production
export NODE_ENV=development

# Start pilot services
cd pilot-deploy && ./scripts/pilot-up.sh

# Verify chaos endpoints available
curl -X POST "http://localhost:3001/_faults/network-blip-once"
# Should return 200 (armed) not 404 (unavailable)
```

## 🧪 Fault Injection Tests

### Test 1: Network Blip Recovery (2 minutes)

**Objective**: Verify stream reconnection after temporary network drop

#### 1.1 Arm Network Blip Fault
```bash
curl -X POST "http://localhost:3001/_faults/network-blip-once"
```

**Expected Response**:
```json
{
  "status": "armed",
  "fault": "network-blip-once",
  "message": "Next new stream connection will drop once before resuming",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```

#### 1.2 Trigger Fault with Stream Connection
```bash
# Start SSE stream (will trigger armed fault)
curl -N "http://localhost:3001/stream?route=critique&scenarioId=resilience-test&seed=999" \
  -H "Accept: text/event-stream"
```

**Expected Behavior**:
- Connection established
- Fault triggers: connection drops briefly
- Automatic reconnection attempts
- Stream resumes (possibly with Last-Event-ID)
- Eventually receives `type: done` event

#### 1.3 Verify Single Use
```bash
# Second stream should work normally (fault consumed)
curl -N "http://localhost:3001/stream?route=critique&scenarioId=resilience-test&seed=998" \
  -H "Accept: text/event-stream"
```

**Expected**: Normal stream flow without drops

---

### Test 2: Slow First Token Tolerance (3 minutes)

**Objective**: Verify TTFF remains acceptable despite artificial delays

#### 2.1 Arm Slow First Token (300ms delay)
```bash
curl -X POST "http://localhost:3001/_faults/slow-first-token?ms=300"
```

**Expected Response**:
```json
{
  "status": "armed",
  "fault": "slow-first-token",
  "delay_ms": 300,
  "message": "Next stream will delay 300ms before first token",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```

#### 2.2 Measure TTFF with Delay
```bash
# Time the first token arrival
time_start=$(date +%s%3N)
curl -N "http://localhost:3001/stream?route=critique&scenarioId=ttff-test&seed=555" \
  -H "Accept: text/event-stream" | head -5
time_end=$(date +%s%3N)

echo "TTFF with 300ms delay: $((time_end - time_start))ms"
```

**Expected Results**:
- TTFF > 300ms (due to injected delay)
- TTFF < 2000ms (within relaxed budget)
- Subsequent tokens arrive normally
- Complete stream execution

#### 2.3 Test Different Delay Values
```bash
# Test with larger delay
curl -X POST "http://localhost:3001/_faults/slow-first-token?ms=1000"

# Verify still within tolerance
curl -N "http://localhost:3001/stream?route=critique&scenarioId=ttff-test&seed=556" \
  -H "Accept: text/event-stream" | head -1
```

---

### Test 3: Automated Fault Drill Script (5 minutes)

**Objective**: Run comprehensive resilience test suite

#### 3.1 Execute Fault Drill Script
```bash
# Run the automated drill
./scripts/fault-drill.mjs
```

**Expected Output**:
```
[2024-09-27T10:00:00.000Z] Starting fault drill...
[2024-09-27T10:00:01.000Z] ✓ Armed network blip fault: Next new stream connection will drop once before resuming
[2024-09-27T10:00:02.000Z] Starting network-blip-test...
[2024-09-27T10:00:03.000Z] Connection dropped as expected (network-blip-test)
[2024-09-27T10:00:04.000Z] ✓ Network blip test passed: 5 events, TTFF: 180ms
[2024-09-27T10:00:05.000Z] ✓ Armed slow first token fault: Next stream will delay 300ms before first token
[2024-09-27T10:00:06.000Z] Starting slow-first-token-test...
[2024-09-27T10:00:07.000Z] ✓ Slow first token test passed: TTFF 450ms (within 2000ms budget)

--- FAULT DRILL SUMMARY ---
Health Check: PASS
Network Blip Recovery: PASS
Slow First Token: PASS
TTFF Within Budget: PASS
Overall: PASS (4/4 tests passed)

FAULT_DRILL_RESULT: PASS
```

#### 3.2 Handle Drill Failures
```bash
# If drill fails, check specific issues
./scripts/fault-drill.mjs 2>&1 | grep "FAIL"

# Common failure modes:
# - Chaos endpoints not available (TEST_ROUTES=0)
# - TTFF exceeds budget (performance issue)
# - Network blip not recovering (reconnection logic broken)
```

## 🔧 Manual Testing Scenarios

### Scenario A: Resume with Last-Event-ID
```bash
# 1. Start stream and capture events
curl -N "http://localhost:3001/stream?route=critique&scenarioId=resume-test&seed=777" \
  -H "Accept: text/event-stream" > stream_log.txt &
STREAM_PID=$!

# 2. Kill after few seconds
sleep 3 && kill $STREAM_PID

# 3. Extract last event ID
LAST_ID=$(grep "id:" stream_log.txt | tail -1 | cut -d: -f2 | tr -d ' ')

# 4. Resume from last event
curl -N "http://localhost:3001/stream?route=critique&scenarioId=resume-test&seed=777" \
  -H "Accept: text/event-stream" \
  -H "Last-Event-ID: $LAST_ID"
```

### Scenario B: Multiple Simultaneous Faults
```bash
# Arm multiple faults
curl -X POST "http://localhost:3001/_faults/network-blip-once"
curl -X POST "http://localhost:3001/_faults/slow-first-token?ms=500"

# Start stream (should trigger both)
curl -N "http://localhost:3001/stream?route=critique&scenarioId=multi-fault&seed=888" \
  -H "Accept: text/event-stream"

# Expected: Connection drop + slow first token when reconnected
```

### Scenario C: Fault Under Load
```bash
# Arm fault
curl -X POST "http://localhost:3001/_faults/network-blip-once"

# Start multiple concurrent streams
for i in {1..5}; do
  curl -N "http://localhost:3001/stream?route=critique&scenarioId=load-test-$i&seed=$i" \
    -H "Accept: text/event-stream" > "stream_$i.log" &
done

# Wait for completion
wait

# Verify: Only first stream should experience fault
grep -l "connection.*drop" stream_*.log | wc -l
# Expected: 1 (only one stream affected)
```

## 📊 Success Criteria

### Test Results Validation

| Test | Success Criteria | Failure Indicators |
|------|------------------|-------------------|
| **Network Blip** | Stream reconnects, receives `done` event | Permanent connection failure, incomplete stream |
| **Slow First Token** | TTFF < 2000ms despite delay | TTFF exceeds budget, timeout errors |
| **Automated Drill** | All tests PASS, exit code 0 | Any test FAIL, non-zero exit |
| **Resume** | Continues from Last-Event-ID | Restarts from beginning, duplicate events |

### Performance Thresholds
```bash
# Relaxed budgets for fault conditions
TTFF_BUDGET_MS=2000        # Normal: 500ms, Fault: 2000ms
RECOVERY_TIME_MS=1000      # Max time to reconnect
COMPLETION_TIMEOUT_S=30    # Max total time for stream
```

## 🚨 Common Issues & Fixes

### Issue: Chaos Endpoints Return 404
**Cause**: TEST_ROUTES not enabled or production mode
**Fix**:
```bash
export TEST_ROUTES=1
export NODE_ENV=development
./scripts/pilot-down.sh && ./scripts/pilot-up.sh
```

### Issue: Network Blip Doesn't Trigger
**Cause**: EventSource polyfill or client doesn't support auto-reconnect
**Fix**: Use real browser or update EventSource implementation

### Issue: TTFF Exceeds Budget
**Cause**: System under load or delays compounding
**Fix**:
- Check system resources
- Increase budget temporarily
- Investigate other performance bottlenecks

### Issue: Drill Script Times Out
**Cause**: Mock EventSource not behaving correctly
**Fix**: Use real SSE implementation or increase timeouts

## 🔄 Integration with CI/CD

### Pre-deployment Check
```bash
# Add to deployment pipeline
if [ "$NODE_ENV" != "production" ]; then
  echo "Running resilience drills..."
  ./scripts/fault-drill.mjs
  if [ $? -ne 0 ]; then
    echo "❌ Resilience drills failed - deployment blocked"
    exit 1
  fi
  echo "✅ Resilience drills passed"
fi
```

### Weekly Regression Testing
```bash
# Cron job for regular resilience validation
0 2 * * 1 cd /path/to/project && TEST_ROUTES=1 ./scripts/fault-drill.mjs >> /var/log/resilience-drill.log 2>&1
```

## 🔗 Related Tools

- **Nightly Self-Test**: `scripts/nightly-selftest.mjs` (includes basic resilience)
- **Health Endpoint**: Monitor fault injection status
- **Run Registry**: Verify determinism after recovery
- **Snapshots**: Evidence of fault behavior in ZIP bundles

---

**Safety**: Dev-only endpoints, never in production
**Scope**: Connection resilience, TTFF tolerance, recovery behavior
**Budget**: Relaxed thresholds during fault conditions
**Automation**: `fault-drill.mjs` for comprehensive testing