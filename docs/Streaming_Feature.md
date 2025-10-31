# PLoT V1 Streaming Feature - Implementation Guide

## Overview

Server-Sent Events (SSE) streaming for PLoT v1 analysis runs, providing real-time progress updates and incremental results feedback.

**Status:** Implemented behind feature flag (October 2025)
**Feature Flag:** `VITE_FEATURE_PLOT_STREAM=1`
**Default:** Disabled (automatic fallback to sync endpoint)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│  useResultsRun → ResultsPanel (progress, cancel button)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  Adapter Layer                              │
│  autoDetectAdapter → httpV1Adapter.stream.run()             │
│  (Conditional: Only if flag=1 AND stream exists)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  Transport Layer                            │
│  sseClient.ts: fetch-based SSE with throttling              │
│  - Progress capping at 90% until COMPLETE                   │
│  - Heartbeat monitoring (timeout detection)                 │
│  - Event parsing (started/progress/interim/complete/error)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend Endpoints                          │
│  POST /api/plot/v1/stream (SSE)                             │
│  POST /api/plot/v1/run/{run_id}/cancel                      │
└─────────────────────────────────────────────────────────────┘
```

### Event Flow

```
1. User triggers run → useResultsRun.run()
2. Hook checks adapter.stream existence (feature-gated)
3. If exists → stream.run() with event handlers
4. SSE events received:
   - RUN_STARTED → onHello (run_id)
   - PROGRESS (0-100%) → onTick (capped at 90%)
   - INTERIM_FINDINGS → onInterim (optional)
   - HEARTBEAT → resets timeout timer
   - COMPLETE → onDone (full report + hash)
   - ERROR → onError (with retry_after for 429)
5. User cancels → AbortController + POST /v1/run/{id}/cancel
```

---

## Backend Prerequisites

### Required Endpoints

#### 1. POST /v1/stream (SSE)

**Request:**
```json
{
  "graph": {
    "nodes": [{"id": "a", "label": "Node A"}],
    "edges": [{"from": "a", "to": "b", "weight": 0.8}]
  },
  "seed": 42
}
```

**Response:** SSE stream with events:

```
event: started
data: {"run_id": "run-123-abc"}

event: progress
data: {"percent": 25, "message": "Analyzing node dependencies..."}

event: interim
data: {"findings": ["Risk factor A identified", "Confidence building..."]}

event: progress
data: {"percent": 75}

event: heartbeat
data: {}

event: complete
data: {
  "result": {
    "answer": "Expected outcome: 150 units",
    "confidence": 0.85,
    "explanation": "Analysis complete",
    "summary": {
      "conservative": 100,
      "likely": 150,
      "optimistic": 200,
      "units": "units"
    },
    "explain_delta": {
      "top_drivers": [
        {"label": "Factor A", "kind": "node", "node_id": "a", "impact": 0.8}
      ]
    },
    "response_hash": "abc123xyz",
    "seed": 42
  },
  "execution_ms": 5000
}
```

**Error Response:**
```
event: error
data: {"code": "SERVER_ERROR", "message": "Analysis failed", "retry_after": 10}
```

**Rate Limit (429):**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "retry_after": 30
}
```

**Requirements:**
- Content-Type: `text/event-stream`
- Heartbeat every 10-15 seconds to prevent timeout
- Progress percent: 0-100 (client caps at 90 until COMPLETE)
- `response_hash` MUST be present in complete event (determinism)
- Support AbortSignal for early cancellation

#### 2. POST /v1/run/{run_id}/cancel

**Request:**
```http
POST /v1/run/run-123-abc/cancel
```

**Response:**
```http
HTTP/1.1 200 OK (success)
HTTP/1.1 404 Not Found (run not found - acceptable, idempotent)
HTTP/1.1 410 Gone (run already completed - acceptable)
```

**Requirements:**
- Idempotent (safe to call multiple times)
- Best-effort (client handles failures gracefully)
- Return quickly (< 500ms preferred)

---

## Feature Flag Configuration

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_FEATURE_PLOT_STREAM` | `"1"`, `"0"` | `"0"` | Enable SSE streaming |
| `VITE_PLOT_PROXY_BASE` | URL | `/api/plot` | Backend proxy base |
| `VITE_PLOT_STREAM_TIMEOUT_MS` | ms | `120000` | Stream timeout |

### Example `.env.local`

```bash
# Enable streaming (local development)
VITE_FEATURE_PLOT_STREAM=1

# Optional: Custom proxy base
VITE_PLOT_PROXY_BASE=/api/plot

# Optional: Longer timeout for slow networks
VITE_PLOT_STREAM_TIMEOUT_MS=180000
```

### Rollout Strategy

**Phase 1: Staging (Backend Ready)**
```bash
# .env.staging
VITE_FEATURE_PLOT_STREAM=1
```
- Verify SSE endpoint availability
- Test heartbeat reliability
- Monitor error rates and retry loops

**Phase 2: Canary (10% traffic)**
```bash
# Split testing config
if (userId % 10 === 0) {
  window.localStorage.setItem('FEATURE_PLOT_STREAM', '1')
}
```
- Monitor Web Vitals (INP, LCP)
- Track cancellation rates
- Compare error rates vs sync

**Phase 3: Production (100%)**
```bash
# .env.production
VITE_FEATURE_PLOT_STREAM=1
```
- Gradual rollout over 1 week
- Monitor rate-limit events
- Track quota recovery success

---

## Testing

### Unit Tests (Existing)

**sseClient.test.ts** (267 lines, comprehensive)
- ✅ HTTP error handling (400, 429, 500)
- ✅ Network errors
- ✅ Cancel (immediate, idempotent)
- ✅ Progress capping (90% until COMPLETE)
- ✅ Event parsing (started, progress, interim, complete, error, heartbeat)

**Location:** `src/adapters/plot/v1/__tests__/sseClient.test.ts`

**Run:**
```bash
npm test -- sseClient.test.ts
```

### E2E Tests (Recommended)

Create `e2e/streaming.spec.ts` with:

```typescript
test('Streaming lifecycle: start → progress → complete', async ({ page }) => {
  // Enable feature flag
  await page.addInitScript(() => {
    localStorage.setItem('VITE_FEATURE_PLOT_STREAM', '1')
  })

  await page.goto('/#/canvas')

  // Load template and trigger run
  // ...

  // Verify streaming UX
  await expect(page.locator('[aria-label="Progress"]')).toBeVisible()
  await expect(page.locator('text=/Analyzing|Computing/i')).toBeVisible()

  // Wait for completion
  await expect(page.locator('text=Complete')).toBeVisible({ timeout: 15000 })

  // Verify Seed • Hash displayed
  await expect(page.locator('text=/Seed.*42/i')).toBeVisible()
  await expect(page.locator('text=/Hash.*[a-f0-9]{6}/i')).toBeVisible()
})

test('Cancel during streaming', async ({ page }) => {
  // ... setup streaming

  // Click cancel button or press Esc
  await page.keyboard.press('Escape')

  // Verify state reset
  await expect(page.locator('[aria-label="Progress"]')).not.toBeVisible()
  await expect(page.locator('text=Cancelled')).toBeVisible()
})

test('429 rate limit handling', async ({ page }) => {
  // Mock 429 response
  // ...

  // Trigger run
  // ...

  // Verify countdown UI
  await expect(page.locator('text=/Wait.*30.*seconds/i')).toBeVisible()

  // Verify button disabled
  await expect(page.locator('button:has-text("Run")')).toBeDisabled()
})
```

---

## Monitoring & Telemetry

### Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Stream start rate | SSE `started` events | < 90% success |
| Heartbeat timeouts | `onError(TIMEOUT)` | > 5% |
| Progress stalls | Progress stuck at same % | > 10s |
| 429 rate limits | `onError(RATE_LIMITED)` | > 10% of requests |
| Cancel success rate | `/cancel` 2xx responses | < 95% |
| Completion rate | `complete` / `started` | < 90% |

### Implementation (Future)

```typescript
// In httpV1Adapter.stream.run()
onStarted: (data) => {
  telemetry.increment('plot.stream.started')
  telemetry.timer('plot.stream.duration').start()
}

onComplete: (data) => {
  telemetry.increment('plot.stream.completed')
  telemetry.timer('plot.stream.duration').stop()
  telemetry.histogram('plot.stream.execution_ms', data.execution_ms)
}

onError: (error) => {
  telemetry.increment(`plot.stream.error.${error.code}`)
  if (error.retry_after) {
    telemetry.histogram('plot.stream.retry_after_seconds', error.retry_after)
  }
}
```

### Dev Overlay

Enable with `?dev=1`:
- Stream status (connecting/streaming/complete/error)
- Progress history graph
- Heartbeat timeline
- Error log with retry_after values
- Cancel latency

---

## Security Considerations

### Determinism

- **Requirement:** Every COMPLETE event MUST include `response_hash`
- **Validation:** Client fails fast if hash missing (prevents drift)
- **Cache:** Results cached by `model_card.response_hash`
- **UI:** Always display `Seed • Hash` for reproducibility

### Rate Limiting

- **Client:** 500ms debouncing prevents rapid successive runs
- **Server:** Returns 429 with `retry_after` seconds
- **UI:** Countdown timer disables run button
- **Cancel:** Honors rate limits (doesn't bypass)

### Input Sanitization

- **Graph:** Validated through central `sanitize.ts`
- **Seed:** Numeric only, no injection risk
- **Request ID:** Generated server-side (not client-controlled)

### Share Hash Allowlist

- **Feature:** `VITE_FEATURE_SHARE_ALLOWLIST=1` (separate flag)
- **Purpose:** Validates share hashes against server allowlist
- **Streaming:** Applies same validation to streamed reports
- **See:** `docs/PLOT_V1_Integration.md#allowlist-feature-flag`

---

## Known Limitations

1. **Backend Dependency & Cold-Start Behavior**
   - Streaming requires `/v1/stream` endpoint deployed
   - Automatic fallback to mock if unavailable
   - **Cold Start:** On initial page load, probe runs asynchronously to detect backend availability
   - Stream requests await probe completion before selecting httpV1/mock adapter
   - Cancel function returned immediately; actual stream starts after probe
   - Check adapter mode: `await getAdapterMode()` → `'httpv1'` or `'mock'`

2. **Interim Findings**
   - `onInterim` handler wired to store and displayed in ResultsPanel
   - Displayed during streaming status with aria-live announcements
   - Backend sends cumulative findings list (replaces previous state)
   - Future: Add timestamps or "live" indicator for enhanced UX

3. **Reconnection**
   - No automatic reconnection on transient failures
   - User must manually retry after error
   - Future: Add exponential backoff reconnection

4. **Quota Recovery**
   - LocalStorage quota handling independent of streaming
   - Progressive cleanup may occur during long streams
   - See: `docs/PLOT_V1_Integration.md#localstorage-quota`

---

## Troubleshooting

### Streaming Not Working (Flag Enabled)

**Symptom:** Runs still use sync endpoint despite `VITE_FEATURE_PLOT_STREAM=1`

**Diagnosis:**
```javascript
// In browser console
const adapter = await import('./src/adapters/plot')
console.log('Stream exists?', !!adapter.plot.stream)
console.log('Adapter mode:', await adapter.getAdapterMode())
```

**Common Causes:**
1. Backend `/v1/stream` not deployed → Falls back to mock
2. Probe detected v1 unavailable → Uses mock streaming
3. Env var not set correctly → Check `import.meta.env.VITE_FEATURE_PLOT_STREAM`

**Fix:**
- Verify backend availability: `curl -I https://your-backend/api/plot/v1/health`
- Check dev console for `[AutoDetect]` logs
- Rebuild after env changes: `npm run dev` (restart required)

### Heartbeat Timeouts

**Symptom:** Runs fail with "Stream timeout: no heartbeat received"

**Diagnosis:**
- Check `TIMEOUTS.STREAM_HEARTBEAT_MS` (default: 30s)
- Monitor backend heartbeat frequency

**Fix:**
- Increase timeout: `VITE_PLOT_STREAM_TIMEOUT_MS=60000`
- Ensure backend sends heartbeats every 10-15s
- Check network proxy isn't buffering SSE events

### 429 Retry Loops

**Symptom:** Repeated rate-limit errors despite countdown

**Diagnosis:**
- Check `retry_after` values in error events
- Verify client honors countdown (button disabled)

**Fix:**
- Ensure backend sends correct `retry_after` in seconds
- Verify client-side debouncing (500ms) working
- Monitor telemetry for retry patterns

---

## Next Steps

### Short Term (Before Production)

1. **ResultsPanel UI Enhancements** ✅ COMPLETE
   - ✅ Visible progress bar (0-90% during stream, 100% on complete)
   - ✅ Interim findings display with progressive updates
   - ✅ Cancel button integration (streaming status)
   - ✅ aria-live for screen reader announcements
   - ⏳ PENDING: Timestamps or "live" indicator for interim findings
   - ⏳ PENDING: ESC keyboard shortcut for cancel

2. **E2E Test Suite** ⏳ PENDING
   - ⏳ Happy path: start → progress → complete
   - ⏳ Cancel flow: ESC → state resets
   - ⏳ 429 handling: countdown UI → button disabled
   - ⏳ Network error: retry UI
   - ⏳ Integration test: autoDetectAdapter probe → httpV1 selection

3. **Documentation Updates** ✅ COMPLETE
   - ✅ Comprehensive streaming feature guide created
   - ✅ Cold-start behavior documented
   - ✅ Interim findings status updated
   - ⏳ PENDING: Add to main PLOT_V1_Integration.md
   - ⏳ PENDING: Update keyboard shortcuts section

### Long Term (Post-Launch)

1. **Telemetry & Monitoring**
   - Sentry integration for error tracking
   - Custom metrics dashboard
   - Web Vitals impact analysis

2. **UX Improvements**
   - Interim findings as progressive disclosure
   - Animated progress with micro-interactions
   - Reconnection with exponential backoff

3. **Performance**
   - Bundle size impact measurement
   - Memory leak detection in long streams
   - Throttling tuning based on real usage

---

## References

- **Implementation:** `src/adapters/plot/httpV1Adapter.ts` (lines 440-605)
- **SSE Client:** `src/adapters/plot/v1/sseClient.ts`
- **Hook:** `src/canvas/hooks/useResultsRun.ts` (lines 80-163)
- **Tests:** `src/adapters/plot/v1/__tests__/sseClient.test.ts`
- **Integration Guide:** `docs/PLOT_V1_Integration.md`

**Last Updated:** October 2025
**Feature Status:** Implemented, Gated
**Production Ready:** Staging-Ready (UI complete, E2E tests pending)
