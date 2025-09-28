# Live UAT Script
## User Acceptance Testing for Decision Analysis Sandbox (Live Gateway Mode)

**Mode:** Live Gateway (Feature Flag ON)
**Primary Seed:** 42
**Duration:** ~12-15 minutes
**Prerequisites:** Live Gateway backend available

### Enable Live Mode
**Before starting:** Set feature flag in browser console:
```javascript
localStorage.setItem('feature.liveGateway', 'true')
```
Then refresh the page.

---

## Test Flow 1: Live Gateway Health Check

### Step 1: Health Status Verification
1. Navigate to `/windsurf` with live flag enabled
2. **Verify:** Health status icon appears in top-right corner
3. Hover over health icon
4. **Verify:** Tooltip shows:
   - Status: Healthy/Degraded/Unhealthy
   - P95: [number]ms
   - Correlation ID (first 8 chars + ...)
5. Click health icon to refresh
6. **Verify:** Health check triggers (network activity)

### Step 2: Mode Indication
1. Check Results Summary Performance section
2. **Verify:** Mode shows "Live Gateway" (not "Fixtures")
3. **Verify:** Connection status shows "Live" or "Disconnected"

---

## Test Flow 2: Live Streaming Analysis

### Step 3: Template Selection & Live Analysis
1. Select "Pricing Change" template (Seed 42)
2. **Verify:** "Analyse" button appears in controls area
3. **Verify:** Template loads immediately (non-blocking)
4. Click "Analyse" button
5. **Verify:** Button changes to "Streaming..." and becomes disabled
6. **Verify:** "Cancel" button appears
7. **Verify:** ARIA announcement: "Results streaming"

### Step 4: Streaming Progress Monitoring
1. Watch Performance section during stream
2. **Verify:** "Live" indicator with pulsing animation
3. **Verify:** First Token timing appears when available
4. **Verify:** Real-time progress updates
5. Wait for stream completion
6. **Verify:** Final announcement: "Report available"

### Step 5: Compare Drawer (Live Mode)
1. During or after streaming, click "Compare Options"
2. **Verify:** Compare drawer behaviour identical to fixtures
3. **Verify:** Live streaming status doesn't interfere with drawer
4. **Verify:** Focus management works during live operations

---

## Test Flow 3: Connection Resilience Testing

### Step 6: Simulate Connection Blip
1. Start a new analysis (click "Analyse")
2. **Wait 2-3 seconds** for stream to establish
3. Click "Blip" button (simulates connection interruption)
4. **Verify:** Connection status changes to "Disconnected"
5. **Verify:** ARIA announcement: "Connection restored; continuing"
6. **Verify:** Resume count increments in Performance section
7. **Verify:** Analysis continues with same correlation

### Step 7: Resume Limitation Testing
1. Start another analysis
2. Click "Blip" button again
3. **Verify:** "Resume limit reached" announcement
4. **Verify:** Blip button becomes disabled
5. **Verify:** Resume count shows: "1 resumes, 0 cancels"

### Step 8: Idempotent Cancel Testing
1. Start a fresh analysis
2. Click "Cancel" button
3. **Verify:** Stream stops immediately
4. **Verify:** ARIA announcement: "Stream cancelled"
5. **Verify:** Cancel count shows: "0 resumes, 1 cancels"
6. Click "Cancel" button again (if still visible)
7. **Verify:** Second cancel is no-op (idempotent)
8. **Verify:** Cancel count remains: "0 resumes, 1 cancels"

---

## Test Flow 4: List View & Mobile in Live Mode

### Step 9: List View with Live Streaming
1. Switch to List View
2. Start an analysis with "Analyse" button
3. **Verify:** List view updates don't interfere with streaming
4. **Verify:** Streaming controls remain accessible
5. **Verify:** Performance metrics update correctly

### Step 10: Mobile Responsiveness (Live)
1. Resize browser to ≤480px width
2. **Verify:** List View shown by default
3. **Verify:** "Switch to Canvas" toggle accessible
4. **Verify:** Health status icon remains functional
5. **Verify:** Streaming controls maintain ≥44px tap targets
6. **Verify:** All buttons reachable by touch

---

## Test Flow 5: Error Handling & Recovery

### Step 11: Connection Error Simulation
1. Start analysis
2. Simulate network error (disable network in dev tools)
3. **Verify:** Connection status shows error state
4. **Verify:** Appropriate error announcement
5. Re-enable network
6. **Verify:** Recovery handling

### Step 12: Health Status Edge Cases
1. Check health status with various backend states
2. **Verify:** Degraded status shows yellow indicator
3. **Verify:** Unhealthy status shows red indicator
4. **Verify:** Unknown status shows grey indicator

---

## Test Flow 6: Performance & Timing

### Step 13: First Token Timing
1. Start fresh analysis
2. Monitor Performance section
3. **Verify:** First Token timing ≤500ms (if backend compliant)
4. **Verify:** Time displayed as "[number]ms"
5. **Verify:** Timing persists after stream completion

### Step 14: Session Continuity
1. Complete an analysis
2. Start another analysis with same template
3. **Verify:** Previous session stats cleared
4. **Verify:** New correlation ID generated
5. **Verify:** Fresh timing metrics

---

## Test Flow 7: Flag Toggle Verification

### Step 15: Live to Fixtures Mode Switch
1. In browser console: `localStorage.removeItem('feature.liveGateway')`
2. Refresh page
3. **Verify:** Returns to fixtures mode
4. **Verify:** Health status disappears
5. **Verify:** Streaming controls hidden
6. **Verify:** Mode shows "Fixtures" again

### Step 16: Flag Re-enable
1. Re-enable flag: `localStorage.setItem('feature.liveGateway', 'true')`
2. Refresh page
3. **Verify:** Live mode restored
4. **Verify:** All live features functional

---

## Expected Results Summary

✅ **Health status displays correctly with tooltip**
✅ **Live streaming works with real-time updates**
✅ **Connection blip simulation succeeds**
✅ **Single resume limit enforced**
✅ **Idempotent cancel behaviour verified**
✅ **List view compatible with live streaming**
✅ **Mobile guardrails work in live mode**
✅ **Error states handled gracefully**
✅ **First token timing tracked accurately**
✅ **Feature flag toggle works reliably**

## Live Mode Specific Features Verified
- Real-time SSE event processing
- Resume semantics with Last-Event-ID
- Connection health monitoring
- Performance metric collection
- Correlation ID tracking (hidden from user)
- Graceful degradation on errors

---

## Critical Paths Validated
1. **Happy Path:** Template → Analyse → Complete → Compare
2. **Resilience Path:** Template → Analyse → Blip → Resume → Complete
3. **Cancel Path:** Template → Analyse → Cancel → Idempotent Cancel
4. **Mobile Path:** Resize → List First → Stream → Complete

---

**Test completed:** ____________
**Tested by:** ____________
**Backend version:** ____________
**Issues found:** ____________