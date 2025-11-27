# PLoT V1 Backend Integration - Smoke Test Checklist

**Purpose**: Manual verification checklist for backend integration with `https://plot-lite-service.onrender.com`

**Prerequisites**:
- `.env.local` configured with `PLOT_API_URL=https://plot-lite-service.onrender.com`
- Dev server running (`npm run dev`)
- Browser console open for error monitoring
- Network tab open to monitor API calls

---

## Phase 1: Health & Configuration (5 min)

### Backend Availability
- [ ] **Health Check**: Open `/api/plot/v1/health` in browser
  - **Expected**: `{"status": "ok", "timestamp": "...", "version": "..."}`
  - **Actual**: _______________

- [ ] **Proxy Configuration**: Check browser console on app load
  - **Expected**: `[PROXY] Configured target: https://plot-lite-service.onrender.com`
  - **Actual**: _______________

- [ ] **Proxy Errors**: Look for `[PROXY ERROR]` in terminal
  - **Expected**: None
  - **Actual**: _______________

---

## Phase 2: Core API Endpoints (10 min)

### GET /v1/limits
- [ ] **Request**: Open canvas, check Network tab for `/api/plot/v1/limits`
  - **Expected**: 200 OK with `{"nodes": {"max": 200}, "edges": {"max": 500}}`
  - **Fallback OK**: 404 (uses static 200/500)
  - **Actual**: _______________

### POST /v1/validate
- [ ] **Trigger**: Attempt to run analysis with empty canvas
  - **Expected**: Request to `/api/plot/v1/validate` in Network tab
  - **Fallback OK**: 404 + warning in console
  - **Actual**: _______________

### POST /v1/run (Sync)
- [ ] **Setup**: Create 4-node demo graph (Start → Option A/B → Outcome)
- [ ] **Trigger**: Run analysis (⌘/Ctrl + Enter or Run button)
- [ ] **Request Check**:
  - **URL**: `/api/plot/v1/run`
  - **Method**: POST
  - **Payload**: Should have `graph.nodes` (API shape: `id`, `label`)
  - **Payload**: Should have `graph.edges` (API shape: `from`, `to`, `weight`)
  - **Payload**: Should NOT have `source`, `target`, `data`, `position`
  - **Actual**: _______________

- [ ] **Response Check**:
  - **Status**: 200 OK
  - **Body**: Has `result.response_hash` OR `model_card.response_hash`
  - **Body**: Has `result.summary` with `conservative`, `likely`, `optimistic`
  - **Body**: Has `result.explain_delta.top_drivers` array
  - **Actual**: _______________

- [ ] **UI Update**:
  - **Results panel opens**: Yes / No
  - **Shows summary values**: Yes / No
  - **Shows drivers**: Yes / No
  - **No console errors**: Yes / No
  - **Actual**: _______________

---

## Phase 3: Shape Validation (DEV-only) (5 min)

### Dev-Mode Assertions
- [ ] **Open Console**: Ensure `NODE_ENV=development`
- [ ] **Run Analysis**: Trigger a run
- [ ] **Check Console**:
  - **Expected**: NO `[DEV] toApiGraph() validation failed` errors
  - **Expected**: NO `API shape violation` errors
  - **Actual**: _______________

### Manual Shape Test (Optional)
- [ ] **Temporarily Break Shape**: In dev tools, intercept request and add `source` field to edge
- [ ] **Expected**: `[DEV] API shape violation` error thrown
- [ ] **Restore**: Remove breakpoint
- [ ] **Actual**: _______________

---

## Phase 4: Response Hash Helper (5 min)

### Determinism Verification
- [ ] **Run 1**: Run analysis with seed=42
  - **Hash**: _______________ (copy from response)

- [ ] **Run 2**: Run same graph with seed=42 again
  - **Hash**: _______________ (should match Run 1)

- [ ] **Verification**:
  - **Hashes match**: Yes / No
  - **Hash source**: `result.response_hash` OR `model_card.response_hash`
  - **Actual**: _______________

---

## Phase 5: Command Palette Integration (5 min)

*Skip this section if `VITE_FEATURE_COMMAND_PALETTE !== '1'`*

### Palette Actions
- [ ] **Open Palette**: Press ⌘K / Ctrl+K
  - **Opens**: Yes / No
  - **Shows actions**: Yes / No
  - **Actual**: _______________

- [ ] **When NOT Streaming**:
  - **Search "run"**: Shows "Run Analysis"
  - **Search "cancel"**: Does NOT show "Cancel Run"
  - **Actual**: _______________

- [ ] **Trigger Run**: Select "Run Analysis" from palette
  - **Results panel opens**: Yes / No
  - **Analysis starts**: Yes / No
  - **Actual**: _______________

- [ ] **During Streaming** (if supported):
  - **Re-open palette**: ⌘K
  - **Search "run"**: Does NOT show "Run Analysis"
  - **Search "cancel"**: Shows "Cancel Run"
  - **Actual**: _______________

- [ ] **Panel Toggles**:
  - **Search "results"**: Shows "Open Results"
  - **No compare action**: Correct (hidden until panel exists)
  - **No inspector action**: Correct (hidden until panel exists)
  - **Actual**: _______________

---

## Phase 6: Error Handling (10 min)

### 400 Bad Request
- [ ] **Trigger**: Send invalid graph (e.g., weight=999)
- [ ] **Expected**: Error toast with descriptive message
- [ ] **Console**: Shows `BAD_INPUT` error with field details
- [ ] **Actual**: _______________

### 429 Rate Limit
- [ ] **Trigger**: Send multiple rapid requests (if rate limiting enabled)
- [ ] **Expected**: Toast with "Rate limited, retry in X seconds"
- [ ] **Console**: Shows `Retry-After` header value
- [ ] **Actual**: _______________

### 500 Server Error
- [ ] **Trigger**: Backend returns 500
- [ ] **Expected**: Error toast with "Server error" message
- [ ] **Console**: Shows `SERVER_ERROR` with details
- [ ] **Actual**: _______________

### Network Failure
- [ ] **Trigger**: Stop backend or block network
- [ ] **Expected**: Toast with "Network error" message
- [ ] **Console**: Shows connection failure
- [ ] **Actual**: _______________

---

## Phase 7: Proxy & CORS (5 min)

### Proxy Rewrite
- [ ] **Check Network Tab**: Request URL
  - **Browser sees**: `/api/plot/v1/run`
  - **Backend receives**: `/v1/run` (no `/api/plot` prefix)
  - **Actual**: _______________

### CORS Headers
- [ ] **Check Response Headers**:
  - **If using proxy**: No CORS headers needed
  - **If direct**: Must have `Access-Control-Allow-Origin`
  - **Actual**: _______________

### Authorization
- [ ] **Check Request Headers**:
  - **If `PLOT_API_KEY` set**: Has `Authorization: Bearer <key>`
  - **If not set**: No Authorization header
  - **Actual**: _______________

---

## Phase 8: Regression Tests (5 min)

### Unit Tests
```bash
npm test src/adapters/plot/v1/__tests__/mapper.test.ts
```
- [ ] **All tests pass**: Yes / No
- [ ] **Shape validation tests**: 10+ tests pass
- [ ] **Actual**: _______________

### Type Check
```bash
npm run typecheck
```
- [ ] **No errors**: Yes / No
- [ ] **Actual**: _______________

---

## Phase 9: Production Build (5 min)

### Build Verification
```bash
npm run build
```
- [ ] **Build succeeds**: Yes / No
- [ ] **No dev-only code in bundle**: Verify validateApiGraphShape is tree-shaken
- [ ] **Actual**: _______________

### Preview
```bash
npm run preview
```
- [ ] **Runs on port 5173**: Yes / No
- [ ] **Backend requests work**: Yes / No
- [ ] **Actual**: _______________

---

## Known Issues & Workarounds

### Missing `result.response_hash`
**Symptom**: Error "Backend returned no response_hash"
**Workaround**: Helper automatically falls back to `model_card.response_hash`
**Status**: Expected until backend PR lands
**Action**: Verify fallback works, document hash source

### 404 on `/v1/limits`
**Symptom**: Console warning about 404
**Workaround**: Static fallback (200 nodes, 500 edges)
**Status**: Non-blocking
**Action**: Verify static limits shown in UI

### 404 on `/v1/validate`
**Symptom**: Console warning about preflight failure
**Workaround**: Graceful degradation, continues to `/v1/run`
**Status**: Non-blocking
**Action**: Verify runs still work

---

## Sign-Off

**Tester**: _______________
**Date**: _______________
**Backend Version**: _______________
**Frontend Commit**: _______________

**Overall Status**: ✅ Pass / ⚠️ Pass with Issues / ❌ Fail

**Critical Issues Found**: _______________ (if any)

**Notes**: _______________

---

## Quick Reference

### Environment Variables
```bash
# .env.local (for local dev)
PLOT_API_URL=https://plot-lite-service.onrender.com
# PLOT_API_KEY=your-key-here  # Optional
VITE_FEATURE_COMMAND_PALETTE=1  # Enable palette testing
```

### Test Graph (4-node diamond)
```json
{
  "nodes": [
    {"id": "start", "label": "Start"},
    {"id": "optA", "label": "Option A"},
    {"id": "optB", "label": "Option B"},
    {"id": "outcome", "label": "Outcome"}
  ],
  "edges": [
    {"from": "start", "to": "optA", "weight": 0.7},
    {"from": "start", "to": "optB", "weight": 0.8},
    {"from": "optA", "to": "outcome", "weight": 0.9},
    {"from": "optB", "to": "outcome", "weight": 0.6}
  ]
}
```

### Console Commands
```javascript
// Check current proxy target
console.log(import.meta.env.PLOT_API_URL || import.meta.env.VITE_PLOT_API_BASE_URL)

// Inspect last response
useCanvasStore.getState().results

// Manual run (advanced)
await plot.run({ template_id: 'canvas', seed: 42 })
```
