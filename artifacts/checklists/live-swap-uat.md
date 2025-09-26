# Live-Swap UAT Checklist for Windsurf

**Purpose**: User Acceptance Testing guide for Windsurf team to validate live integration with Scenario Sandbox pilot.

## 🎯 Objective

Verify that Windsurf can seamlessly switch from fixtures to live Scenario Sandbox endpoints with full functionality and expected performance.

## 📋 Pre-UAT Checklist

### Environment Setup
- [ ] **Pilot services running**: `cd pilot-deploy && ./scripts/pilot-up.sh`
- [ ] **Health check passes**: `curl http://localhost:3001/healthz` returns `{"status": "healthy"}`
- [ ] **CORS configured**: Your development origin added to CORS_ORIGINS
- [ ] **Windsurf dev server running**: On port 3000, 5173, or 8080
- [ ] **Templates accessible**: Starter templates available at `/artifacts/seed/templates/`

### Required Flags to Flip
Before starting UAT, ensure these configuration changes:

```javascript
// In your Windsurf UI configuration
const config = {
  USE_MOCK_DATA: false,        // ✅ Flip to false (was true)
  USE_SIMULATION: false,       // ✅ Flip to false (was true)
  ENABLE_SEED_ECHO: true       // ✅ Keep true for determinism
};

// Base URLs to update
const LIVE_ENDPOINTS = {
  STREAM_URL: 'http://localhost:3001/stream',
  CANCEL_URL: 'http://localhost:3001/cancel',
  REPORT_URL: 'http://localhost:3001/report'
};
```

### Safety Verifications
Confirm these remain OFF in pilot mode:
- [ ] `ENABLE_RATE_LIMITING: false`
- [ ] `ENABLE_CACHE: false`
- [ ] `ENABLE_USAGE_TRACKING: false`
- [ ] `ENABLE_MONITORING: false`

## 🧪 UAT Test Scenarios

### Test 1: Template Import and Load (2 minutes)

**Objective**: Verify Windsurf can load and display starter templates.

**Steps**:
1. **Import Template**
   ```javascript
   // Load pricing change template
   const template = await fetch('/artifacts/seed/templates/pricing-change.seed42.json');
   const data = await template.json();
   ```

2. **Populate UI**
   - Title displays: "Should we increase our Pro plan pricing by 20%?"
   - Context shows complete scenario background
   - 4 options visible with pros/cons
   - Seed 42 is captured for deterministic analysis

3. **Validate Template Structure**
   - `template.seed` equals 42
   - `template.scenario.options.length` equals 4
   - All required fields present

**Expected Result**: ✅ Template loads and populates UI correctly
**Time Limit**: <30 seconds for import and display

### Test 2: Start Stream and First Token (30 seconds)

**Objective**: Verify live SSE streaming with deterministic results.

**Steps**:
1. **Initiate Analysis**
   - Use template seed (42) for analysis request
   - Start stream: `GET /stream?route=critique&seed=42&sessionId=windsurf_test`
   - Monitor for SSE connection establishment

2. **First Token Verification**
   - Record time from request to first token
   - Verify token content is deterministic (same seed = same tokens)
   - Check for proper event structure: `{type: 'token', data: {text: '...'}}`

3. **Stream Continuity**
   - Tokens arrive in sequence
   - No gaps or duplicates
   - Event IDs increment properly

**Expected Results**:
- ✅ **First Token Time**: <500ms (Target: <150ms)
- ✅ **Deterministic Content**: Same tokens with seed 42
- ✅ **Event Structure**: Proper SSE format with type/data

**Time Limit**: First token within 500ms, full test within 30 seconds

### Test 3: Cancel Stream (15 seconds)

**Objective**: Test stream cancellation and idempotent behaviour.

**Steps**:
1. **Cancel Active Stream**
   - Send cancel request: `POST /cancel` with session ID
   - Verify immediate response (HTTP 202)
   - Confirm SSE stream stops

2. **Test Idempotence**
   - Send second cancel with same session ID
   - Verify HTTP 409 (Conflict) response
   - Confirm no additional side effects

3. **UI State Update**
   - Cancel button becomes disabled or changes to "Resume"
   - Stream status updates appropriately
   - No hanging connections

**Expected Results**:
- ✅ **First Cancel**: HTTP 202 within 150ms
- ✅ **Second Cancel**: HTTP 409 (idempotent)
- ✅ **UI Update**: Proper state transition

**Time Limit**: 15 seconds total

### Test 4: Resume Stream (30 seconds)

**Objective**: Verify single-resume capability with Last-Event-ID.

**Steps**:
1. **Resume from Last Position**
   - Use captured Last-Event-ID from cancelled stream
   - Send resume request with header: `Last-Event-ID: msg_XXX`
   - Verify stream continues from correct position

2. **Continuity Check**
   - No duplicate tokens from before cancellation
   - Stream continues with next expected token
   - Event IDs continue sequence properly

3. **Single Resume Rule**
   - Only one resume per session
   - Subsequent resume attempts should be handled gracefully

**Expected Results**:
- ✅ **Resume Time**: <200ms to reconnect
- ✅ **Continuity**: No lost or duplicate events
- ✅ **Single Resume**: Only one resume per session

**Time Limit**: 30 seconds including verification

### Test 5: Report Generation (30 seconds)

**Objective**: Validate structured report retrieval and format.

**Steps**:
1. **Fetch Report**
   - Request: `GET /report?scenarioId=demo&seed=42`
   - Verify HTTP 200 response
   - Check Content-Type: application/json

2. **Validate Report Structure**
   ```javascript
   // Required Report v1 structure
   const requiredFields = [
     'decision.title',
     'decision.options',
     'recommendation.primary',
     'analysis.confidence',
     'meta.scenarioId',
     'meta.seed'
   ];
   ```

3. **Display in UI**
   - Report renders in drawer/modal
   - Options comparison shows properly
   - Recommendation is highlighted
   - Metadata (seed, timestamp) visible

**Expected Results**:
- ✅ **Response Time**: <1 second for report
- ✅ **Structure Valid**: All required fields present
- ✅ **UI Display**: Report renders correctly

**Time Limit**: 30 seconds including UI display

### Test 6: Two-Option Comparison (1 minute)

**Objective**: Complete end-to-end scenario analysis and comparison.

**Steps**:
1. **Load Feature Launch Template**
   - Import: `feature-launch.seed17.json`
   - Verify 4 rollout options display
   - Seed 17 configured for analysis

2. **Run Full Analysis**
   - Start stream with seed 17
   - Allow complete token sequence
   - Monitor for 'done' event

3. **Compare Top Two Options**
   - Open final report
   - Identify top two recommended options
   - Verify pros/cons are clearly differentiated
   - Check confidence scores

4. **Validate Determinism**
   - Re-run same analysis with seed 17
   - Verify identical recommendations
   - Confirm consistent option ranking

**Expected Results**:
- ✅ **Complete Analysis**: <10 seconds for full stream
- ✅ **Report Quality**: Clear top recommendations
- ✅ **Determinism**: Identical results with same seed

**Time Limit**: 1 minute total

## 📊 Success Metrics and Timings

### Performance Expectations
Based on pilot deployment metrics:

| Metric | Target | Current Pilot | UAT Pass Criteria |
|--------|--------|---------------|-------------------|
| **Time-to-First-Token** | ≤500ms | 50ms | ≤500ms |
| **Cancel Latency** | ≤150ms | 45ms | ≤150ms |
| **Time-to-Comparison** | ≤10min | <1s | ≤60s for full analysis |
| **Report Generation** | ≤5s | <1s | ≤2s |

### Functional Requirements
- [x] **SSE Streaming**: Events flow correctly with proper structure
- [x] **Resume Once**: Last-Event-ID reconnection works
- [x] **Idempotent Cancel**: HTTP 202 → 409 behaviour
- [x] **Report v1**: Structured JSON with all required fields
- [x] **CORS Headers**: Cross-origin requests allowed
- [x] **Deterministic**: Same seed produces identical results

## 🎯 "What Good Looks Like" Rubric

### Excellent (🟢 Ready for Demo)
- All tests pass within time limits
- Performance exceeds targets (first token <100ms)
- UI feels responsive and immediate
- Error handling is graceful
- Deterministic behaviour is rock-solid

### Good (🟡 Minor Issues)
- All tests pass but near time limits
- Performance meets targets
- Occasional UI delays but functional
- Some edge cases need polish
- Determinism works but results vary slightly

### Needs Work (🔴 Not Ready)
- Any test fails or times out
- Performance significantly below targets
- UI feels sluggish or unresponsive
- Error handling is confusing
- Non-deterministic or inconsistent results

## 🚨 Common Issues and Fixes

### CORS Errors
```bash
# Add your development origin to pilot
cd pilot-deploy
echo "CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:YOUR_PORT" >> .env.poc
./scripts/pilot-down.sh && ./scripts/pilot-up.sh
```

### Connection Timeouts
```bash
# Check pilot health
curl http://localhost:3001/healthz

# Restart if needed
cd pilot-deploy && ./scripts/pilot-reset.sh
```

### Template Loading Issues
```javascript
// Verify template accessibility
fetch('/artifacts/seed/templates/pricing-change.seed42.json')
  .then(r => r.ok ? console.log('✅ Template accessible') : console.error('❌ Template not found'));
```

### Event Stream Interruptions
```javascript
// Add proper error handling
eventSource.onerror = (error) => {
  console.log('Stream error, attempting resume...');
  // Implement resume logic with Last-Event-ID
};
```

## 📝 UAT Sign-off Template

```
Windsurf Live-Swap UAT Results
=============================
Date: [YYYY-MM-DD]
Tester: [Name]
Environment: [Windsurf version, browser, OS]

Test Results:
✅/❌ Template Import (Target: <30s): [Actual time]
✅/❌ First Token (Target: <500ms): [Actual time]
✅/❌ Cancel Stream (Target: <150ms): [Actual time]
✅/❌ Resume Stream (Target: <200ms): [Actual time]
✅/❌ Report Generation (Target: <2s): [Actual time]
✅/❌ Two-Option Comparison (Target: <60s): [Actual time]

Overall Assessment: 🟢/🟡/🔴
Demo Ready: YES/NO
Notes: [Any observations or concerns]

Next Steps:
- [Any follow-up actions needed]
- [Performance optimisations]
- [UI/UX improvements]

Signed: [Windsurf Lead] | Date: [YYYY-MM-DD]
```

## 🔗 Related Resources

- **Integration Harness**: `../tools/sse-viewer.html` (for validation)
- **Starter Templates**: `../seed/templates/` (pricing, feature, build-vs-buy)
- **Wiring Guide**: `../windsurf-live-swap.md` (technical details)
- **Microcopy**: `../ui-content/microcopy.json` (UI strings)
- **Accessibility**: `../ui-content/accessibility-announcements.md` (a11y)

---

**Success Criteria**: All tests pass within time limits with 🟢 assessment. System ready for stakeholder demo and production consideration.