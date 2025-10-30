# PLoT v1 HTTP Adapter - Technical Design Document

**Status:** Draft for Review
**Author:** Claude + Paul
**Date:** 2025-10-26
**Target Release:** TBD (pending backend v1 endpoint availability)

---

## Executive Summary

Integrate the **PLoT v1 HTTP API** with the Canvas Templates panel to enable real-time AI-powered decision analysis with streaming progress and interactive results.

**Key Requirements:**
- ✅ Use live PLoT engine via proxy (never expose API keys client-side)
- ✅ SSE streaming with progress bar + cancel support
- ✅ Deterministic results (seed → stable response_hash)
- ✅ Full error taxonomy mapped to UI (BAD_INPUT, RATE_LIMITED, LIMIT_EXCEEDED, SERVER_ERROR)
- ✅ Comprehensive test coverage (unit, integration, E2E)
- ⚠️ **NO mock fallback** - production integration only

---

## 1. Architecture Overview

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (UI)                             │
│  ┌────────────────────┐      ┌──────────────────────────┐  │
│  │ TemplatesPanel.tsx │─────▶│ useTemplatesRun Hook     │  │
│  └────────────────────┘      └───────┬──────────────────┘  │
│                                       │                      │
│                              ┌────────▼────────────┐        │
│                              │ httpV1Adapter       │        │
│                              │  - run()            │        │
│                              │  - stream.run()     │        │
│                              │  - cancel()         │        │
│                              └────────┬────────────┘        │
│                                       │                      │
│                       ┌───────────────┴───────────────┐     │
│                       │                               │     │
│              ┌────────▼────────┐            ┌────────▼─────┐│
│              │ v1/http.ts      │            │ v1/sseClient │││
│              │  - runSync()    │            │  - runStream()│││
│              │  - health()     │            │  - cancel()  │││
│              │  - mapErrors()  │            │              │││
│              └────────┬────────┘            └────────┬─────┘│
└───────────────────────┼──────────────────────────────┼──────┘
                        │                              │
                ────────┼──────────────────────────────┼───────
                        │    HTTP (via proxy)          │
                ────────┼──────────────────────────────┼───────
                        │                              │
┌───────────────────────▼──────────────────────────────▼──────┐
│                  Vite Dev Proxy (/api/plot)                  │
│  - Injects Authorization: Bearer ${PLOT_API_KEY}             │
│  - HTTPS support (secure: false)                             │
│  - Error logging                                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
                ────────┼─────────────────────────────
                        │    HTTPS
                ────────┼─────────────────────────────
                        │
┌───────────────────────▼──────────────────────────────────────┐
│          PLoT Engine (plot-lite-service.onrender.com)        │
│   Endpoints:                                                 │
│   - GET  /v1/health                                          │
│   - POST /v1/run          (sync)                             │
│   - POST /v1/stream       (SSE)                              │
│   - POST /v1/run/{id}/cancel                                 │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User clicks "Run Analysis"
     │
     ▼
[TemplatesPanel] ─────▶ useTemplatesRun.run({ template_id, seed })
     │
     ▼
[httpV1Adapter] ──────▶ Decide: sync or stream?
     │                   (nodes.length <= 30 → sync, else stream)
     ├─────▶ [Sync Path]
     │         POST /api/plot/v1/run
     │         ↓
     │       Single HTTP response
     │         ↓
     │       mapV1ResultToReport()
     │         ↓
     │       Return ReportV1
     │
     └─────▶ [Stream Path]
               POST /api/plot/v1/stream
               ↓
             SSE events: STARTED → PROGRESS → HEARTBEAT → COMPLETE
               ↓
             onProgress({ percent })  [debounced 100ms]
               ↓
             onComplete({ result, execution_ms })
               ↓
             mapV1ResultToReport()
               ↓
             Return ReportV1

[Cancel Flow]
User clicks Cancel button
     │
     ▼
cancel(runId) ─────▶ POST /api/plot/v1/run/{runId}/cancel
     │
     ▼
Close SSE stream ──▶ State: cancelled
```

---

## 2. API Contract

### 2.1 Base Configuration

**Proxy (Browser → Vite Dev Server):**
```
Base Path: /api/plot
Target: env.PLOT_API_URL (default: https://plot-lite-service.onrender.com)
Headers added by proxy:
  - Authorization: Bearer ${PLOT_API_KEY}  (server-side only)
```

**Security:**
- ✅ API key **NEVER** exposed to browser
- ✅ All requests go through `/api/plot` proxy
- ❌ Direct fetch to `plot-lite-service.onrender.com` from browser

### 2.2 Endpoints

#### Health Check
```http
GET /v1/health

Response 200:
{
  "status": "ok" | "degraded" | "down",
  "api_version": "v1",
  "version": "1.0.0",
  "p95_ms": 1,
  "rate_limit": {
    "enabled": true,
    "rpm": 60
  }
}
```

#### Sync Run
```http
POST /v1/run
Content-Type: application/json
Idempotency-Key: <uuid>  (optional)

Request:
{
  "graph": {
    "nodes": [
      { "id": "a", "label": "Goal", "body": "Maximize revenue" }
    ],
    "edges": [
      { "from": "a", "to": "b", "confidence": 0.8, "weight": 5 }
    ]
  },
  "seed": 1337,
  "clientHash": "a3f2e1b9",
  "template_id": "pricing-v1"
}

Response 200:
{
  "result": {
    "likely": 42.5,
    "confidence": "high",
    "explanation": "...",
    "drivers": [
      { "id": "a", "impact": 0.8 }
    ],
    "response_hash": "sha256:abc123..."
  },
  "execution_ms": 450
}

Errors:
- 400 BAD_INPUT: { code, error, hint?, fields? }
- 413 LIMIT_EXCEEDED: { code, error, field, max }
- 429 RATE_LIMITED: { code, error, retry_after? }
- 500 SERVER_ERROR: { code, error }
```

#### Stream Run
```http
POST /v1/stream
Content-Type: application/json
Accept: text/event-stream

Request: (same as /v1/run)

Response 200 (SSE):
event: started
data: {"run_id":"abc123"}

event: progress
data: {"percent":25}

event: heartbeat
data: {}

event: interim
data: {"partial_finding":"..."}

event: progress
data: {"percent":50}

event: complete
data: {"result":{...},"execution_ms":1200}

Errors (sent as SSE events):
event: error
data: {"code":"RATE_LIMITED","error":"...","retry_after":10}
```

#### Cancel Run
```http
POST /v1/run/{run_id}/cancel

Response 200:
{
  "run_id": "abc123",
  "status": "cancelled"
}

Response 404: (run already complete - treat as success)
```

### 2.3 Graph Contract

**Limits:**
```typescript
const LIMITS = {
  MAX_NODES: 200,
  MAX_EDGES: 500,
  MAX_LABEL_LENGTH: 120,
  MAX_BODY_LENGTH: 2000,
  MAX_SYNC_NODES: 30  // Threshold for sync vs stream
}
```

**Node Schema:**
```typescript
interface V1Node {
  id: string;           // Required, unique
  label?: string;       // Max 120 chars
  body?: string;        // Max 2000 chars
}
```

**Edge Schema:**
```typescript
interface V1Edge {
  from: string;         // Must reference existing node
  to: string;           // Must reference existing node
  confidence?: number;  // 0..1 (UI may use % or 0-1)
  weight?: number;      // Optional numeric weight
}
```

---

## 3. Implementation Details

### 3.1 Adapter Surface

**File:** `src/adapters/plot/httpV1Adapter.ts`

```typescript
export const httpV1Adapter: PlotAdapter = {
  /**
   * Decide sync vs stream based on graph size
   */
  async run(request: RunRequest): Promise<ReportV1> {
    const graph = await loadTemplateGraph(request.template_id);

    if (graph.nodes.length <= LIMITS.MAX_SYNC_NODES) {
      // Small graph → sync
      return runSyncPath(graph, request.seed);
    } else {
      // Large graph → stream (wrapped as Promise)
      return runStreamPath(graph, request.seed);
    }
  },

  /**
   * SSE streaming with handlers
   */
  stream: {
    run(request: RunRequest, handlers: StreamHandlers): CancelFn {
      const graph = await loadTemplateGraph(request.template_id);
      const v1Request = mapGraphToV1Request(graph, request.seed);

      return v1http.runStream(v1Request, {
        onStarted: (data) => {
          runId = data.run_id;
        },
        onProgress: (data) => {
          handlers.onTick?.({ index: Math.floor(data.percent / 20) });
        },
        onComplete: (data) => {
          const report = mapV1ResultToReport(data.result, ...);
          handlers.onDone?.({ response_id: report.meta.response_id, report });
        },
        onError: (error) => {
          handlers.onError?.(mapV1ErrorToUI(error));
        }
      });
    }
  },

  /**
   * Cancel running stream
   */
  async cancel(runId: string): Promise<void> {
    await v1http.cancel(runId);
  },

  /**
   * Template metadata (local blueprints until API supports /v1/templates)
   */
  async templates(): Promise<TemplateListV1> {
    return mockAdapter.templates();
  },

  async template(id: string): Promise<TemplateDetail> {
    return mockAdapter.template(id);
  }
};
```

### 3.2 HTTP Transport

**File:** `src/adapters/plot/v1/http.ts`

```typescript
/**
 * GET /v1/health
 */
export async function health(): Promise<HealthStatus> {
  const response = await fetch(`${getProxyBase()}/v1/health`);
  if (!response.ok) {
    return { status: 'down', timestamp: new Date().toISOString() };
  }
  const data = await response.json();
  return {
    status: data.status || 'ok',
    timestamp: new Date().toISOString(),
    metadata: data
  };
}

/**
 * POST /v1/run (sync)
 */
export async function runSync(
  request: V1RunRequest,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<V1SyncRunResponse> {
  const idempotencyKey = crypto.randomUUID();

  const response = await fetch(`${getProxyBase()}/v1/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw await mapHttpErrorToV1Error(response);
  }

  return response.json();
}

/**
 * Map HTTP errors to v1 error taxonomy
 */
async function mapHttpErrorToV1Error(response: Response): Promise<V1Error> {
  const body = await response.json().catch(() => ({}));

  switch (response.status) {
    case 400:
      return {
        schema: 'error.v1',
        code: 'BAD_INPUT',
        error: body.error || 'Invalid request',
        hint: body.hint,
        fields: body.fields
      };
    case 413:
    case 422:
      return {
        schema: 'error.v1',
        code: 'LIMIT_EXCEEDED',
        error: body.error || 'Request exceeds limits',
        fields: body.fields
      };
    case 429:
      return {
        schema: 'error.v1',
        code: 'RATE_LIMITED',
        error: body.error || 'Too many requests',
        retry_after: body.retry_after || 10
      };
    case 500:
    case 502:
    case 503:
    default:
      return {
        schema: 'error.v1',
        code: 'SERVER_ERROR',
        error: body.error || 'Internal server error'
      };
  }
}
```

### 3.3 SSE Client

**File:** `src/adapters/plot/v1/sseClient.ts`

```typescript
/**
 * POST /v1/stream with SSE
 */
export function runStream(
  request: V1RunRequest,
  handlers: V1StreamHandlers
): CancelFn {
  const controller = new AbortController();
  let runId: string | null = null;
  let heartbeatTimeout: NodeJS.Timeout;

  const resetHeartbeat = () => {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      controller.abort();
      handlers.onError({
        schema: 'error.v1',
        code: 'SERVER_ERROR',
        error: 'Stream timeout: no heartbeat received'
      });
    }, PLOT_SSE_TIMEOUT_MS);
  };

  fetch(`${getProxyBase()}/v1/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw await mapHttpErrorToV1Error(response);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      resetHeartbeat();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.slice(6).trim();
            const dataLine = lines[lines.indexOf(line) + 1];
            if (!dataLine?.startsWith('data:')) continue;

            const data = JSON.parse(dataLine.slice(5).trim());

            switch (event) {
              case 'started':
                runId = data.run_id;
                handlers.onStarted?.(data);
                break;
              case 'progress':
                throttledProgress(data);
                resetHeartbeat();
                break;
              case 'heartbeat':
                resetHeartbeat();
                break;
              case 'interim':
                handlers.onInterim?.(data);
                resetHeartbeat();
                break;
              case 'complete':
                clearTimeout(heartbeatTimeout);
                handlers.onComplete(data);
                return;
              case 'error':
                clearTimeout(heartbeatTimeout);
                handlers.onError(data);
                return;
            }
          }
        }
      }
    })
    .catch((err) => {
      clearTimeout(heartbeatTimeout);
      if (err.name === 'AbortError') return; // Cancelled
      handlers.onError(err);
    });

  // Return cancel function
  return () => {
    if (runId) {
      v1http.cancel(runId).catch(console.error);
    }
    clearTimeout(heartbeatTimeout);
    controller.abort();
  };
}

// Debounce progress updates to 100ms
const throttledProgress = throttle((data) => {
  handlers.onProgress?.(data);
}, 100);
```

### 3.4 Graph Mapper

**File:** `src/adapters/plot/v1/mapper.ts`

```typescript
/**
 * Validate graph against limits
 */
export function validateGraphLimits(graph: ReactFlowGraph): void {
  if (graph.nodes.length > LIMITS.MAX_NODES) {
    throw {
      code: 'LIMIT_EXCEEDED',
      message: `Graph has ${graph.nodes.length} nodes (max ${LIMITS.MAX_NODES})`,
      field: 'nodes',
      max: LIMITS.MAX_NODES
    };
  }

  if (graph.edges.length > LIMITS.MAX_EDGES) {
    throw {
      code: 'LIMIT_EXCEEDED',
      message: `Graph has ${graph.edges.length} edges (max ${LIMITS.MAX_EDGES})`,
      field: 'edges',
      max: LIMITS.MAX_EDGES
    };
  }

  for (const node of graph.nodes) {
    const label = node.data?.label || '';
    const body = node.data?.body || '';

    if (label.length > LIMITS.MAX_LABEL_LENGTH) {
      throw {
        code: 'BAD_INPUT',
        message: `Node "${node.id}" label exceeds ${LIMITS.MAX_LABEL_LENGTH} chars`,
        field: `nodes[${node.id}].label`,
        max: LIMITS.MAX_LABEL_LENGTH
      };
    }

    if (body.length > LIMITS.MAX_BODY_LENGTH) {
      throw {
        code: 'BAD_INPUT',
        message: `Node "${node.id}" body exceeds ${LIMITS.MAX_BODY_LENGTH} chars`,
        field: `nodes[${node.id}].body`,
        max: LIMITS.MAX_BODY_LENGTH
      };
    }
  }
}

/**
 * Map UI graph to v1 request
 */
export function mapGraphToV1Request(
  graph: ReactFlowGraph,
  seed: number
): V1RunRequest {
  validateGraphLimits(graph);

  return {
    graph: {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        label: n.data?.label,
        body: n.data?.body,
      })),
      edges: graph.edges.map(e => {
        let confidence = e.data?.confidence;
        // Normalize: if >1, assume percentage → divide by 100
        if (confidence != null && confidence > 1) {
          confidence = confidence / 100;
        }
        return {
          from: e.source,
          to: e.target,
          confidence,
          weight: e.data?.weight,
        };
      }),
    },
    seed,
    clientHash: computeClientHash(graph, seed),
  };
}

/**
 * Compute deterministic hash (djb2)
 */
export function computeClientHash(
  graph: ReactFlowGraph,
  seed: number
): string {
  const canonical = JSON.stringify({
    nodes: graph.nodes
      .map(n => ({
        id: n.id,
        label: n.data?.label,
        body: n.data?.body,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: graph.edges
      .map(e => ({
        from: e.source,
        to: e.target,
        conf: e.data?.confidence,
        weight: e.data?.weight,
      }))
      .sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
      ),
    seed,
  });

  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash << 5) + hash + canonical.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Map v1 result to UI report
 */
export function mapV1ResultToReport(
  result: V1Result,
  templateId: string,
  executionMs: number
): ReportV1 {
  const likely = result.likely || 0;

  return {
    schema: 'report.v1',
    meta: {
      seed: result.seed || 1337,
      response_id: result.response_hash || `http-v1-${Date.now()}`,
      elapsed_ms: executionMs,
    },
    model_card: {
      response_hash: result.response_hash || '',
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative: likely * 0.8,
      likely,
      optimistic: likely * 1.2,
      units: 'count',
    },
    confidence: {
      level: mapConfidenceLevel(result.confidence),
      why: result.explanation,
    },
    drivers: result.drivers.map(d => ({
      label: d.id || 'Unknown',
      polarity: d.impact > 0 ? 'up' : d.impact < 0 ? 'down' : 'neutral',
      strength: Math.abs(d.impact) > 0.7 ? 'high' :
                Math.abs(d.impact) > 0.3 ? 'medium' : 'low',
    })),
  };
}
```

---

## 4. UI Integration

### 4.1 Templates Panel

**File:** `src/canvas/panels/TemplatesPanel.tsx`

**Current State:**
- ✅ Prominent "▶ Run Analysis" button (lines 208-220)
- ✅ Dev controls for seed customization (collapsible)
- ✅ Progress strip component integration (line 275-280)
- ✅ Error banner with retry (line 283-285)
- ✅ Results display with SummaryCard + WhyPanel (lines 288-294)

**Required Enhancements:**
1. Show response_hash in SummaryCard with copy button
2. Add "Cancel" button during streaming (in ProgressStrip)
3. Rate limit countdown timer
4. Driver hover → canvas node highlight

### 4.2 State Machine

**File:** `src/routes/templates/hooks/useTemplatesRun.ts`

```
States:
  idle → loading → streaming → complete
                    ↓
                cancelled / error

Transitions:
- idle → loading: User clicks "Run"
- loading → streaming: SSE STARTED event
- streaming → complete: SSE COMPLETE event
- streaming → cancelled: User clicks "Cancel"
- * → error: SSE ERROR event or fetch failure
```

**State Shape:**
```typescript
interface TemplateRunState {
  loading: boolean;
  progress: number;        // 0-100 (cap at 90 until COMPLETE)
  result: ReportV1 | null;
  error: ErrorV1 | null;
  retryAfter: number | null; // Seconds remaining
  canCancel: boolean;
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**Target Coverage:** >90%

**Files:**
- `src/adapters/plot/v1/__tests__/http.test.ts` ✅ 14 tests
- `src/adapters/plot/v1/__tests__/mapper.test.ts` ✅ 19 tests
- `src/adapters/plot/v1/__tests__/sseClient.test.ts` ⚠️ TODO

**New Tests Required:**

**sseClient.test.ts:**
```typescript
describe('SSE Client', () => {
  it('emits events in correct order: STARTED → PROGRESS → COMPLETE');
  it('debounces progress updates to 100ms');
  it('triggers heartbeat timeout after 20s silence');
  it('handles cancel mid-stream');
  it('closes stream exactly once on COMPLETE');
  it('closes stream exactly once on ERROR');
  it('ignores events after stream closed');
});
```

### 5.2 Integration Tests (MSW)

**File:** `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts` ⚠️ TODO

```typescript
describe('httpV1Adapter Contract', () => {
  beforeEach(() => {
    server.use(
      http.post('/api/plot/v1/run', () => {
        return HttpResponse.json({
          result: { likely: 42.5, confidence: 'high', drivers: [] },
          execution_ms: 450
        });
      })
    );
  });

  it('sync run: small graph → POST /v1/run');
  it('stream run: large graph → POST /v1/stream');
  it('handles BAD_INPUT with field errors');
  it('handles RATE_LIMITED with retry_after');
  it('handles LIMIT_EXCEEDED');
  it('handles SERVER_ERROR with fallback message');
  it('cancel: POST /v1/run/{id}/cancel');
  it('determinism: same seed → same clientHash');
});
```

### 5.3 UI Component Tests (React Testing Library)

**File:** `src/canvas/panels/__tests__/TemplatesPanel.run.test.tsx` ⚠️ TODO

```typescript
describe('TemplatesPanel - Run Flow', () => {
  it('shows Run button after template inserted');
  it('disables Run button while loading');
  it('shows progress bar during stream');
  it('shows Cancel button during stream');
  it('clicking Cancel stops stream and transitions to cancelled');
  it('shows Results with response_hash after completion');
  it('shows error banner with Retry on failure');
  it('rate limit: shows countdown timer');
  it('no a11y violations on Run/Results surfaces');
});
```

### 5.4 E2E Tests (Playwright)

**File:** `e2e/plot-stream.spec.ts` ⚠️ TODO

```typescript
test.describe('PLoT Streaming', () => {
  test('happy path: insert template → run → progress → results', async ({ page }) => {
    await page.goto('/#/canvas');
    await page.click('[data-testid="templates-panel-toggle"]');
    await page.click('text=Pricing Strategy');
    await page.click('text=Insert');
    await page.click('text=▶ Run Analysis');

    // Wait for progress
    await expect(page.locator('[data-testid="progress-strip"]')).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="summary-card"]')).toBeVisible();

    // Verify response hash
    await expect(page.locator('text=/[a-f0-9]{8}/')).toBeVisible();
  });

  test('cancel flow', async ({ page }) => {
    // ... setup ...
    await page.click('text=▶ Run Analysis');
    await page.waitForSelector('[data-testid="progress-strip"]');
    await page.click('[data-testid="cancel-button"]');

    await expect(page.locator('text=/cancelled/i')).toBeVisible();
  });
});
```

**Task C4: Preview Mode E2E Test** ⚠️ TODO (Scheduled for Section I - Testing)

Deferred from Phase 2+ Section C. Requires E2E test coverage for preview flow:
- Stage changes (edit node/edge)
- Click preview button
- Verify PreviewDiff shows delta (Improved/Declined/No Change)
- Click "Apply to Live" to commit changes
- Verify undo restores previous state
- Test requires template seeding and full preview state machinery

---

## 6. Configuration

### 6.1 Environment Variables

**Browser-side (.env.local):**
```bash
# Adapter mode (mock until v1 endpoints confirmed)
VITE_PLOT_ADAPTER=mock

# Dev proxy base (proxy rewrites /api/plot → PLOT_API_URL)
# Not needed in browser (hardcoded in code)
```

**Server-side (Vite config):**
```bash
# PLoT API origin (proxy target)
PLOT_API_URL=https://plot-lite-service.onrender.com

# Optional: API key for authenticated requests
PLOT_API_KEY=<secret>
```

### 6.2 Proxy Configuration

**File:** `vite.config.ts`

```typescript
proxy: {
  '/api/plot': {
    target: env.PLOT_API_URL || 'http://localhost:4311',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/plot/, ''),
    configure: (proxy) => {
      console.log(`[PROXY] Target: ${env.PLOT_API_URL}`);

      proxy.on('error', (err) => {
        console.error('[PROXY ERROR]', err.message);
      });

      const apiKey = env.PLOT_API_KEY;
      if (apiKey) {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
        });
      }
    }
  }
}
```

### 6.3 Runtime Constants

**File:** `src/adapters/plot/v1/constants.ts`

```typescript
export const LIMITS = {
  MAX_NODES: 200,
  MAX_EDGES: 500,
  MAX_LABEL_LENGTH: 120,
  MAX_BODY_LENGTH: 2000,
  MAX_SYNC_NODES: 30,
} as const;

export const TIMEOUTS = {
  SYNC_REQUEST_MS: 30_000,
  STREAM_HEARTBEAT_MS: 20_000,
  HEALTH_CHECK_MS: 5_000,
} as const;

export const RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 10_000,
  JITTER_FACTOR: 0.2,
} as const;

export const PROXY_BASE = '/api/plot';
```

---

## 7. Error Handling

### 7.1 Error Taxonomy

| Code | HTTP Status | UI Treatment | Retry? |
|------|-------------|--------------|--------|
| **BAD_INPUT** | 400 | Show field errors in banner | ❌ No |
| **LIMIT_EXCEEDED** | 413/422 | Show limit + field in banner | ❌ No |
| **RATE_LIMITED** | 429 | Show countdown timer | ✅ Auto (after timer) |
| **SERVER_ERROR** | 500/502/503 | Generic error + Retry button | ✅ Manual |
| **NETWORK_ERROR** | - | "Connection lost" + Retry | ✅ Auto (3x) |
| **TIMEOUT** | - | "Request timeout" + Retry | ✅ Manual |

### 7.2 User-Facing Copy

**BAD_INPUT:**
```
⚠️ Invalid Request
• Node "pricing-decision" label exceeds 120 characters
• Edge "a→b" confidence must be between 0 and 1
[Fix Issues]
```

**RATE_LIMITED:**
```
⏱️ Rate Limit Reached
Too many requests. Try again in 8 seconds.
[Countdown: 8, 7, 6...]
[Retry Now] (enabled after countdown)
```

**SERVER_ERROR:**
```
❌ Something Went Wrong
The PLoT engine encountered an error. Please try again.
[Retry]  [Report Issue]
```

---

## 8. Observability

### 8.1 Console Logging (DEV only)

```typescript
if (import.meta.env.DEV) {
  console.log(`🚀 [httpV1] Calling live PLoT: POST /v1/run`);
  console.log(`🌊 [httpV1] Starting stream: POST /v1/stream`);
  console.log(`✅ [httpV1] Completed: ${executionMs}ms`);
  console.log(`❌ [httpV1] Error:`, error);
  console.log(`🛑 [httpV1] Cancelled: run_id=${runId}`);
}
```

### 8.2 Performance Metrics

Track in `useTemplatesRun`:
```typescript
const metrics = {
  startTime: Date.now(),
  timeToFirstByte: null,
  timeToComplete: null,
  progressUpdates: 0,
  bytesReceived: 0
};
```

---

## 9. Security Considerations

### 9.1 API Key Protection
- ✅ API key stored in server env only (`PLOT_API_KEY`)
- ✅ Proxy injects `Authorization: Bearer` header
- ❌ NEVER expose `PLOT_API_KEY` to browser bundle

### 9.2 Input Sanitization
- ✅ Validate graph limits **before** HTTP request
- ✅ Sanitize markdown in Results (use DOMPurify if rendering)
- ✅ Escape node IDs in error messages

### 9.3 CORS
- ✅ All requests go through `/api/plot` proxy
- ❌ No direct fetch to `plot-lite-service.onrender.com` from browser

---

## 10. Rollout Plan

### Phase 1: Confirm Backend Endpoints ⏳
**Blocker:** Verify production PLoT API has `/v1/run` and `/v1/stream`

**Actions:**
1. ⏳ Contact PLoT team for endpoint status
2. ⏳ Test endpoints manually:
   ```bash
   curl -X POST https://plot-lite-service.onrender.com/v1/run \
     -H "Content-Type: application/json" \
     -d '{"graph":{"nodes":[],"edges":[]},"seed":1337}'
   ```
3. ⏳ Confirm response schema matches TDD

### Phase 2: Complete Implementation ⚠️
**Current Status:** 70% complete

**Remaining Work:**
- [ ] Sync vs stream decision logic
- [ ] Idempotency-Key generation
- [ ] Heartbeat timeout watchdog
- [ ] Progress cap at 90%
- [ ] Retry/backoff logic
- [ ] MSW contract tests
- [ ] SSE client tests
- [ ] UI component tests
- [ ] E2E tests

**Estimated Time:** 12-16 hours

### Phase 3: Test in Staging ⏳
**Prerequisites:** Phases 1 & 2 complete

**Actions:**
1. Deploy to staging with `VITE_PLOT_ADAPTER=httpv1`
2. Run full test suite (unit + integration + E2E)
3. Manual QA of happy path + error flows
4. Performance testing (latency, cancel responsiveness)

### Phase 4: Production Release ⏳
**Prerequisites:** Phase 3 green

**Actions:**
1. Merge PR to `main`
2. Update `.env.local.example` with production settings
3. Deploy to production
4. Monitor error rates and performance
5. Gradual rollout (feature flag if available)

---

## 11. Open Questions

### 11.1 Backend Questions (for PLoT Team)

1. **Q: Are `/v1/run` and `/v1/stream` endpoints live on `plot-lite-service.onrender.com`?**
   - Current Status: Both return 404 (as of 2025-10-26)
   - Required: 200 OK with expected schema

2. **Q: What is the exact SSE event schema?**
   - Spec assumes: `event: started`, `event: progress`, etc.
   - Need confirmation of event names and data shapes

3. **Q: Does `/v1/run` support `Idempotency-Key` header?**
   - If yes: What happens on duplicate key? (return cached result?)
   - If no: Remove from implementation

4. **Q: What is `Retry-After` format in 429 responses?**
   - Seconds (integer) or ISO 8601 timestamp?
   - Spec assumes: integer seconds per RFC 7231

5. **Q: Are `drivers` guaranteed to have `id` fields?**
   - Current implementation uses `id` for canvas highlighting
   - Fallback: Use `label` if `id` missing?

### 11.2 Product Questions

1. **Q: Should we support both sync and stream, or stream only?**
   - Spec proposes: sync for small graphs (<30 nodes), stream for large
   - Alternative: Always stream for consistency

2. **Q: What should happen if user switches templates mid-stream?**
   - Current: Cancel previous run automatically
   - Alternative: Warn user before cancelling

3. **Q: Should response_hash be prominently displayed or hidden in "Advanced"?**
   - Current: Shown in Results with copy button
   - Alternative: Dev controls only

---

## 12. Success Metrics

### 12.1 Functional
- ✅ Health pill shows "PLoT v1.0 • OK"
- ✅ Progress bar animates 0% → 90% → 100%
- ✅ Cancel stops stream within 1 second
- ✅ Results display with response_hash
- ✅ All error codes mapped to friendly UI

### 12.2 Performance
- ✅ Time to first byte: <500ms (p95)
- ✅ Stream completion: <5s for typical graph (p95)
- ✅ Cancel latency: <1s
- ✅ UI updates: 60fps (no jank)

### 12.3 Quality
- ✅ Test coverage: >90%
- ✅ Zero TypeScript errors
- ✅ Zero a11y violations (axe)
- ✅ Zero console errors in happy path

---

## 13. Next Steps

**Immediate (This Week):**
1. ⏳ **Backend Coordination:** Confirm endpoint availability with PLoT team
2. ⏳ **Complete SSE Client:** Add heartbeat timeout, progress cap, retry logic
3. ⏳ **Add MSW Tests:** Contract tests for all error codes

**Short Term (Next Week):**
1. ⏳ **UI Polish:** Response hash display, driver highlighting
2. ⏳ **E2E Tests:** Playwright suite for streaming flows
3. ⏳ **Documentation:** User-facing guide for Canvas + PLoT

**Long Term (Next Sprint):**
1. ⏳ **Performance:** Optimize for large graphs (>100 nodes)
2. ⏳ **Analytics:** Track usage, errors, latency
3. ⏳ **Advanced Features:** Batch runs, comparison mode

---

## Appendix A: File Manifest

### Existing Files (Modified)
- `src/adapters/plot/httpV1Adapter.ts` ✅ Core adapter
- `src/adapters/plot/v1/http.ts` ✅ HTTP transport
- `src/adapters/plot/v1/sseClient.ts` ✅ SSE client
- `src/adapters/plot/v1/mapper.ts` ✅ Graph mapping
- `src/adapters/plot/index.ts` ✅ Adapter selection
- `src/canvas/panels/TemplatesPanel.tsx` ✅ UI integration
- `src/routes/templates/hooks/useTemplatesRun.ts` ✅ State machine
- `vite.config.ts` ✅ Proxy config

### Existing Test Files
- `src/adapters/plot/v1/__tests__/mapper.test.ts` ✅ 19 tests
- `src/adapters/plot/v1/__tests__/http.test.ts` ✅ 14 tests

### New Files Required
- `src/adapters/plot/v1/constants.ts` ⚠️ Limits, timeouts, retry config
- `src/adapters/plot/v1/__tests__/sseClient.test.ts` ⚠️ SSE-specific tests
- `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts` ⚠️ MSW integration
- `src/canvas/panels/__tests__/TemplatesPanel.run.test.tsx` ⚠️ UI component tests
- `e2e/plot-stream.spec.ts` ⚠️ E2E streaming tests
- `e2e/plot-errors.spec.ts` ⚠️ E2E error handling tests

---

## Appendix B: Glossary

- **SSE:** Server-Sent Events - unidirectional push protocol over HTTP
- **Idempotency Key:** UUID for cache-hit detection (same key → cached result)
- **Client Hash:** djb2 hash of graph + seed for deterministic results
- **Response Hash:** SHA256 hash from PLoT engine (verifiable result fingerprint)
- **Proxy Base:** `/api/plot` - local dev server path that proxies to production
- **Adapter:** Interface layer between UI types and PLoT v1 API types
- **Driver:** Node/edge identified by PLoT as significant influence on result
- **Template:** Pre-defined decision graph (pricing, hiring, retention, etc.)
- **Blueprint:** Local JSON definition of template metadata + graph structure

---

**Document Status:** Draft for Review
**Next Review:** After backend endpoint confirmation
**Owner:** Paul + Claude
**Last Updated:** 2025-10-26
