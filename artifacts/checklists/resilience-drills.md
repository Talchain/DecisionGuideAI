# Resilience Drills - Scenario Sandbox Pilot

**Purpose**: Scripted resilience tests with clear PASS/FAIL criteria for demo preparation and operational confidence.

## 🎯 Overview

These drills validate the system's ability to handle network interruptions, client performance issues, and emergency procedures. Each drill has specific expected outcomes and timing requirements.

## 🌐 Drill 1: Network Blip Simulation

### Objective
Verify single-resume behaviour when EventSource connection drops briefly.

### Setup
```bash
# 1. Start pilot services
cd pilot-deploy && ./scripts/pilot-up.sh

# 2. Open SSE viewer
open artifacts/tools/sse-viewer.html
```

### Execution Steps
1. **Enable Network Blip Toggle**
   - Toggle "Simulate network blip" to ON (purple)
   - Verify toggle state shows active

2. **Start Stream with Known Seed**
   - Set seed to 42 for deterministic results
   - Set budget to 1000ms
   - Click "Connect"

3. **Observe Auto-Blip Behaviour**
   - Wait for first token to arrive
   - Watch for automatic disconnection message
   - Network blip should occur randomly within first few tokens

4. **Monitor Auto-Resume**
   - System should auto-resume after 800-1200ms delay
   - Resume should use Last-Event-ID header
   - Stream should continue from interruption point

### PASS Criteria
- ✅ **Badge Test**: "Single resume occurred" turns GREEN
- ✅ **Log Evidence**: Shows "Simulating network blip..." followed by "Auto-resuming after blip..."
- ✅ **Continuity**: Tokens continue from last received ID (no duplicates)
- ✅ **Timing**: Resume happens within 800-1200ms of disconnection

### FAIL Indicators
- ❌ Multiple resumes attempted
- ❌ Stream restarts from beginning
- ❌ Lost events or duplicate tokens
- ❌ Resume takes >2 seconds

### Expected Event Order
```
🚀 Stream started (session: viewer_...)
💬 Token: "When" (index: 1)
💬 Token: "considering" (index: 2)
🌐 Simulating network blip...
❌ SSE connection error
🔄 Auto-resuming after blip...
🚀 Stream started (session: viewer_...) [resume]
💬 Token: "the" (index: 3) [continues from where left off]
```

## ⚡ Drill 2: Cancel Idempotence Test

### Objective
Verify HTTP 202 → 409 response pattern for duplicate cancel requests.

### Setup
- Use same SSE viewer session from Drill 1
- Ensure active streaming session exists

### Execution Steps
1. **Start Fresh Stream**
   - Clear previous session with "Clear Log"
   - Set new session ID (or auto-generate)
   - Click "Connect" and wait for tokens

2. **Execute Double Cancel**
   - Click "Cancel Twice" button
   - Watch log for two sequential HTTP requests

3. **Verify Response Pattern**
   - First cancel should return HTTP 202
   - Second cancel should return HTTP 409
   - Both requests use same session ID

### PASS Criteria
- ✅ **Badge Test**: "Cancel idempotent" turns GREEN
- ✅ **HTTP Sequence**: 202 (Accepted) → 409 (Conflict)
- ✅ **Response Time**: Both requests complete within 500ms
- ✅ **Session State**: Stream stops after first cancel

### FAIL Indicators
- ❌ Both requests return 202
- ❌ Both requests return 409
- ❌ Different HTTP status codes
- ❌ Requests timeout or error

### Expected Log Output
```
🧪 Testing cancel idempotence...
First cancel: HTTP 202
Second cancel: HTTP 409
✅ Cancel idempotence test passed (202 → 409)
```

## 🚀 Drill 3: Performance Budget Validation

### Objective
Confirm first token arrives within specified time budget.

### Setup
- Reset SSE viewer session
- Configure performance parameters

### Execution Steps
1. **Set Tight Budget**
   - Set Budget field to 500ms
   - Use seed 42 for consistent performance
   - Ensure base URL points to pilot (localhost:3001)

2. **Measure Time-to-First-Token**
   - Click "Connect"
   - System automatically measures from connection to first token
   - Budget test runs automatically

3. **Verify Performance**
   - First token should arrive within 500ms budget
   - Measurement includes full SSE handshake time

### PASS Criteria
- ✅ **Badge Test**: "First token under budget" turns GREEN
- ✅ **Timing**: First token arrives ≤500ms after connection
- ✅ **Consistency**: Repeated tests show similar performance
- ✅ **Log Evidence**: Shows actual timing measurement

### FAIL Indicators
- ❌ First token takes >500ms
- ❌ Connection takes excessive time to establish
- ❌ Timing measurement shows negative or invalid values

### Expected Timing
- **Target**: <500ms for first token
- **Typical**: 50-150ms on localhost
- **Warning**: >300ms suggests performance issue
- **Critical**: >1000ms indicates system problem

## 🛑 Drill 4: Kill Switch Activation

### Objective
Test emergency service shutdown procedure.

### Setup
```bash
# Access pilot deployment directory
cd pilot-deploy
```

### Execution Steps
1. **Verify Current Service State**
   ```bash
   curl http://localhost:3001/healthz
   # Expected: {"status": "healthy"}
   ```

2. **Activate Kill Switch**
   ```bash
   # Set environment variable
   echo "GLOBAL_KILL_SWITCH=true" >> .env.poc
   ```

3. **Restart Service with Kill Switch**
   ```bash
   ./scripts/pilot-down.sh
   ./scripts/pilot-up.sh
   ```

4. **Test Service Response**
   ```bash
   curl http://localhost:3001/stream?route=critique&seed=42
   # Expected: HTTP 503 or "service unavailable"
   ```

5. **Rollback Kill Switch**
   ```bash
   # Remove kill switch
   sed -i '' '/GLOBAL_KILL_SWITCH/d' .env.poc
   ./scripts/pilot-down.sh
   ./scripts/pilot-up.sh
   ```

### PASS Criteria
- ✅ **Kill Switch Active**: All endpoints return 503/unavailable
- ✅ **Health Check**: Reports service as limited/disabled
- ✅ **Rollback Works**: Service resumes normal operation
- ✅ **Timing**: Kill switch activation <30 seconds

### FAIL Indicators
- ❌ Service continues processing requests
- ❌ Kill switch doesn't activate
- ❌ Rollback doesn't restore service
- ❌ Partial kill switch (some endpoints still work)

## 🐌 Drill 5: Slow Client Simulation

### Objective
Verify stream behaviour when client processing is artificially slowed.

### Setup
- Use browser dev tools for CPU throttling
- Chrome: DevTools > Performance > CPU throttling

### Execution Steps
1. **Enable CPU Throttling**
   - Open browser DevTools (F12)
   - Go to Performance tab
   - Set CPU throttling to "4x slowdown"

2. **Start Stream with Throttling**
   - Connect to stream in SSE viewer
   - Observe event processing behaviour
   - Monitor for buffer overflow or lost events

3. **Verify Graceful Degradation**
   - Events should queue but not be lost
   - UI should remain responsive
   - Stream should continue flowing

### PASS Criteria
- ✅ **No Lost Events**: All events arrive in order
- ✅ **UI Responsive**: Interface doesn't freeze
- ✅ **Stream Continuity**: Connection maintained despite slow processing
- ✅ **Memory Stable**: No excessive memory growth

### FAIL Indicators
- ❌ Events are lost or arrive out of order
- ❌ UI becomes unresponsive
- ❌ Connection drops due to client slowness
- ❌ Memory usage grows unbounded

## 🔄 Full Resilience Test Suite

### Automated Execution
Use the SSE viewer's "Run Full Test" button for automated testing:

1. **Click "Run Full Test"**
   - Automatically enables network blip simulation
   - Starts connection with performance monitoring
   - Schedules cancel test after 3 seconds

2. **Monitor Badge Status**
   - All three badges should turn GREEN within 60 seconds
   - Watch log for detailed test progress

3. **Manual Verification**
   - Verify deterministic behaviour with same seed
   - Check timing measurements are reasonable
   - Confirm no unexpected errors in logs

### Success Pattern
```
🧪 Starting full resilience test suite...
🚀 Stream started...
✅ First token in 87ms (under 1000ms budget)
🌐 Simulating network blip...
🔄 Auto-resuming after blip...
✅ Single resume test passed
🧪 Testing cancel idempotence...
✅ Cancel idempotence test passed (202 → 409)

Final Status: 🟢 🟢 🟢 (All badges GREEN)
```

## 📊 Drill Results Documentation

### Test Log Template
```
Resilience Drill Results - [Date]
=====================================

Environment:
- Pilot URL: http://localhost:3001
- Browser: [Chrome/Firefox/Safari version]
- Network: [Local/WiFi/etc]

Drill 1 - Network Blip:
- Status: [PASS/FAIL]
- Resume Time: [XXXms]
- Events Lost: [0/N]
- Notes: [Any observations]

Drill 2 - Cancel Idempotence:
- Status: [PASS/FAIL]
- Response Sequence: [202→409/other]
- Timing: [XXXms]
- Notes: [Any observations]

Drill 3 - Performance Budget:
- Status: [PASS/FAIL]
- First Token Time: [XXXms]
- Budget Setting: [XXXms]
- Notes: [Any observations]

Overall Assessment: [READY/NEEDS WORK]
Next Steps: [Any follow-up actions]
```

## 🔗 Related Documentation

- **Go/No-Go Decision**: `../release/GO-NO-GO.md`
- **Live-Swap Guide**: `../windsurf-live-swap.md`
- **Integration Harness**: `../tools/README.md`
- **Rollback Procedures**: `../rollback.md`

---

**Note**: These drills should be run before any demo or stakeholder presentation to ensure system reliability and operator confidence.