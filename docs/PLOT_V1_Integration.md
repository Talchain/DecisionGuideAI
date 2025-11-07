# PLoT V1 Integration - Technical Documentation

**Status**: Completed (Phase 2+ Sections A-D)
**Integration Layer**: `src/adapters/plot/httpV1Adapter.ts`
**Backend API**: PLoT v1 HTTP API (sync + templates)

## Overview

The PLoT v1 Integration provides a complete HTTP-based adapter for running decision analyses against the PLoT v1 backend. This replaces the previous placeholder/mock implementation with production-ready API integration.

## Architecture Layers

### 1. Adapter Interface (`httpV1Adapter`)

**Entry Point**: `src/adapters/plot/httpV1Adapter.ts`

Public API surface:
```typescript
export const httpV1Adapter = {
  run(input: RunRequest): Promise<ReportV1>
  templates(): Promise<TemplateListV1>
  template(id: string): Promise<TemplateMetadataV1>
  limits(): Promise<LimitsV1>
  validate(input: RunRequest): Promise<ValidationResult>
  health(): Promise<HealthResponse>
}
```

### 2. HTTP Client (`v1/http.ts`)

Low-level HTTP operations with retry logic and error mapping:
```typescript
export async function runSync(request: V1RunRequest): Promise<V1RunResponse>
export async function templates(): Promise<V1Template[]>
export async function templateGraph(id: string): Promise<V1TemplateGraph>
export async function validate(request: V1RunRequest): Promise<ValidationResult>
export async function limits(): Promise<{ nodes: { max: number }; edges: { max: number } }>
export async function health(): Promise<HealthResponse>
```

**Features**:
- Exponential backoff retry (3 attempts max)
- Timeout handling (30s for /run, 5s for /validate)
- Error normalization to `ErrorV1` schema
- ETag caching for templates and limits

### 3. Response Normalization (`v1/reportNormalizer.ts`)

Handles multiple backend response envelope formats:
```typescript
export function toUiReport(body: RunResponse): NormalizedReport
```

**Flexible Field Extraction**:
- Conservative: `results.conservative ?? summary?.conservative`
- Likely: `results.most_likely ?? results.likely ?? summary?.likely`
- Optimistic: `results.optimistic ?? summary?.optimistic`
- Confidence: `results.confidence ?? confidence`
- Hash: `model_card?.response_hash ?? response_hash`

This normalization allows the UI to work with evolving backend API schemas.

### 4. Request Mapping (`v1/mapper.ts`)

Converts UI graph representation to PLoT v1 API format:
```typescript
export function graphToV1Request(graph: ReactFlowGraph, seed?: number): V1RunRequest
```

**Transformations**:
- Node labels: `node.data.label` → `label` (sanitized, max 120 chars)
- Node IDs: string IDs (sanitized, alphanumeric + hyphen/underscore)
- Edge probabilities: `edge.data.probability` (0.0-1.0) → `confidence` (0.0-1.0)
- Edge weights: `edge.data.weight` → `weight`

**Validation**:
- Enforces limits (nodes, edges) from `limitsManager`
- Throws `ValidationError` if limits exceeded
- Validates probability range [0.0, 1.0]

### 5. Limits Manager (`v1/limitsManager.ts`)

Singleton pattern for managing graph constraints:
```typescript
export const limitsManager = {
  hydrate(): Promise<void>
  getLimits(): Limits
  reset(): void
}
```

**Boot Sequence**:
1. App boots → `hydrate()` called
2. Fetches `/v1/limits` with ETag caching
3. Falls back to `V1_LIMITS` defaults if fetch fails
4. All validation uses cached limits (O(1) access)

**Graceful Degradation**:
- If `/v1/limits` unreachable, uses hardcoded defaults:
  ```typescript
  const V1_LIMITS = {
    nodes: { max: 200 },
    edges: { max: 500 }
  }
  ```

### 6. ETag Cache (`v1/etagCache.ts`)

HTTP cache with ETag support for templates and limits:
```typescript
export function fetchWithETag<T>(
  key: string,
  url: string,
  options?: RequestInit
): Promise<T>
```

**Cache Behavior**:
- First request: Full response + cache entry with ETag
- Subsequent requests: `If-None-Match` header with cached ETag
- 304 Not Modified: Returns cached data (no network payload)
- Cache invalidation: Explicit calls to `invalidateTemplatesCache()`

**Telemetry**:
- Cache hit/miss tracking
- Exposed via `getCacheStats()` for debugging
- Visible with `?dq=1` query parameter (Task F4)

## API Endpoints

### POST /v1/run (Sync Execution)

**Request**:
```json
{
  "graph": {
    "nodes": [
      { "id": "node-1", "label": "Start", "kind": "decision" }
    ],
    "edges": [
      { "from": "node-1", "to": "node-2", "confidence": 0.8 }
    ]
  },
  "seed": 42
}
```

**Response**:
```json
{
  "result": {
    "results": {
      "summary": {
        "conservative": 100,
        "likely": 150,
        "optimistic": 200,
        "units": "units"
      }
    },
    "confidence": 0.85,
    "explanation": "Analysis complete",
    "explain_delta": {
      "top_drivers": [
        { "kind": "node", "node_id": "revenue", "label": "Revenue", "impact": 0.8 }
      ]
    },
    "response_hash": "sha256:abc123...",
    "seed": 42
  },
  "execution_ms": 450
}
```

### POST /v1/validate (Preflight Validation)

**Purpose**: Check graph constraints before expensive /run call

**Request**: Same as /run
**Response**:
```json
{
  "valid": true
}
```
or
```json
{
  "valid": false,
  "violations": [
    { "field": "nodes", "message": "Too many nodes: 250 > 200 (max)" }
  ]
}
```

**Integration**:
- Called automatically in `httpV1Adapter.run()` as preflight
- Fails fast for invalid graphs
- Graceful degradation: continues if validation endpoint unavailable

### GET /v1/limits

**Response**:
```json
{
  "nodes": { "max": 200 },
  "edges": { "max": 500 }
}
```

**Caching**: ETag-based, fetched at boot via `limitsManager.hydrate()`

### GET /v1/templates

**Response**:
```json
[
  {
    "id": "revenue-forecast",
    "label": "Revenue Forecast",
    "summary": "Forecast revenue outcomes",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
]
```

**Mapping**: `label` → `name`, `summary` → `description`

### GET /v1/templates/{id}/graph

**Response**:
```json
{
  "template_id": "revenue-forecast",
  "default_seed": 1337,
  "graph": {
    "nodes": [...],
    "edges": [...]
  },
  "meta": {
    "suggested_positions": {
      "node-1": { "x": 100, "y": 100 },
      "node-2": { "x": 300, "y": 150 }
    }
  }
}
```

**F2 Integration**: TemplatesPanel uses `suggested_positions` when available, falls back to BFS hierarchical layout.

### GET /v1/health

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T17:00:00Z",
  "version": "1.0.0",
  "uptime_ms": 123456
}
```

**UI Integration**: PlotHealthPill component polls health and shows status indicator.

## Error Handling

### Error Schema

All errors are normalized to `ErrorV1`:
```typescript
interface ErrorV1 {
  schema: 'error.v1'
  code: 'BAD_INPUT' | 'LIMIT_EXCEEDED' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT'
  error: string
  retry_after?: number
  fields?: Record<string, any>
}
```

### HTTP Status Code Mapping

| Status | Error Code | Retry? | Description |
|--------|------------|--------|-------------|
| 400 | BAD_INPUT | No | Invalid request (malformed JSON, missing fields) |
| 413 | LIMIT_EXCEEDED | No | Graph exceeds size limits |
| 429 | RATE_LIMITED | Yes | Too many requests, respect `retry_after` |
| 500 | SERVER_ERROR | Yes | Backend error, retry with exponential backoff |
| Network | NETWORK_ERROR | Yes | Connection failed, DNS error, etc. |
| Timeout | TIMEOUT | Yes | Request exceeded timeout threshold |

### Retry Logic

**Exponential Backoff** (implemented in `withRetry`):
- Attempt 1: immediate
- Attempt 2: ~1000ms delay (randomized jitter)
- Attempt 3: ~2000ms delay (randomized jitter)
- Max attempts: 3

**Jitter Formula**:
```typescript
const delay = baseDelay * (0.8 + Math.random() * 0.4)
```
This prevents thundering herd when multiple clients retry simultaneously.

## Determinism & Hashing

**Client Hash** (`clientHash`):
- Computed from graph structure + seed
- Uses `computeClientHash(graph, seed)` from `v1/hash.ts`
- Sent with request for backend idempotency checks

**Response Hash** (`response_hash`):
- Backend-provided SHA-256 hash of full response
- Stored in `model_card.response_hash`
- Used for reproducibility tracking
- MUST be present for valid responses (enforced in httpV1Adapter)

**Determinism Enforcement**:
```typescript
if (!normalized.hash) {
  throw {
    schema: 'error.v1',
    code: 'SERVER_ERROR',
    error: 'Backend returned no response_hash (determinism requirement violated)',
  }
}
```

## Security

### Input Sanitization

**Label Sanitization** (Task H1):
```typescript
import { sanitizeLabel } from '../canvas/utils/sanitize'

const sanitized = sanitizeLabel(node.data.label, 120)
```
- Removes HTML tags, control characters
- Enforces max length (120 chars)
- Prevents XSS injection

**Filename Sanitization**:
```typescript
import { sanitizeFilename } from '../canvas/utils/sanitize'

const filename = sanitizeFilename(userInput)
```
- Removes directory traversal patterns (`../`)
- Prevents shell injection (`;`, `|`, `&`)

### URL Validation

Templates loaded from backend are validated:
```typescript
import { sanitizeUrl } from '../canvas/utils/sanitize'

const safeUrl = sanitizeUrl(templateUrl, ALLOWED_DOMAINS)
```

### Share Hash Validation

Snapshot hashes are strictly validated:
```typescript
import { sanitizeShareHash } from '../canvas/utils/sanitize'

const hash = sanitizeShareHash(urlParam)  // Returns null if invalid
```
- Accepts SHA-256 hex (64 chars)
- Accepts base64url (for compressed snapshots)
- Rejects invalid characters and excessive length

## Performance Optimizations

### 1. ETag Caching
- Templates: Cached indefinitely until explicitly invalidated
- Limits: Cached at boot, reused for all validations
- Reduces API calls by ~90% for repeated template loads

### 2. Preflight Validation
- Client-side check before /validate call
- Prevents network round-trip for obvious violations
- Saves ~150ms per invalid graph attempt

### 3. Limits Singleton
- O(1) access to limits (no async lookups)
- Hydrated once at boot
- Shared across all adapter calls

### 4. Memoization
- ResultsPanel: `useMemo` for driver arrays (Task optimization)
- Prevents React.memo bypass from new array references

### 5. Streaming (Future)
- `/v1/stream` endpoint support scaffolded
- Will enable progress updates and early termination
- Currently using sync endpoint (streaming not deployed Oct 2025)

## Testing

### Unit Tests (`src/adapters/plot/__tests__/`)
- `httpV1Adapter.contract.test.ts`: 15 MSW contract tests (Task I2)
- `reportNormalizer.test.ts`: Response normalization edge cases
- `mapper.test.ts`: Graph-to-request transformations

### E2E Tests (`e2e/`)
- `templates/templates.spec.ts`: Template loading with suggested_positions (Task I3)
- `boot.plot.spec.ts`: Integration smoke tests
- `plot.production.spec.ts`: Production API validation

### Security Tests (`src/canvas/utils/__tests__/`)
- `sanitize.spec.ts`: 77 comprehensive security tests (Task I1)
- XSS prevention, prototype pollution, injection attacks

## Monitoring & Observability

### Health Checks
- `/v1/health` polled every 30s by PlotHealthPill
- Status: `ok`, `degraded`, `down`
- Version and uptime displayed in UI

### Cache Telemetry
- `?dq=1` query parameter enables debug mode
- Shows cache hit rate in PlotHealthPill
- Format: `Cache: 85% (17/20)`

### Error Reporting
- All errors logged to console in DEV mode
- ErrorV1 schema includes structured error details
- Violations array for multi-field errors

## Migration from Mock Adapter

**Before (Mock)**:
```typescript
import { mockPlotAdapter } from '@/adapters/plot/mockPlotAdapter'
```

**After (V1)**:
```typescript
import { httpV1Adapter } from '@/adapters/plot/httpV1Adapter'
```

**Compatibility**:
- Same interface as mock adapter
- Drop-in replacement (no UI changes required)
- Feature parity + production robustness

## Configuration

**Environment Variables**:
- `VITE_PLOT_API_BASE`: Base URL for PLoT v1 API (default: `/api/plot`)
- `VITE_PLOT_ADAPTER`: Adapter selection (default: `http-v1`)

**Proxy Configuration** (`vite.config.ts`):
```typescript
proxy: {
  '/api/plot': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/plot/, '')
  }
}
```

## Related Documentation

- [PLOT_V1_HTTP_ADAPTER_TDD.md](./PLOT_V1_HTTP_ADAPTER_TDD.md) - TDD patterns
- [Preview_Mode.md](./Preview_Mode.md) - Preview Mode integration
- [PROBABILITY_TOLERANCE.md](./PROBABILITY_TOLERANCE.md) - Edge probability constraints

## Streaming (Phase 2+ PLoT V1)

**Status**: ✅ Completed (requires `VITE_FEATURE_PLOT_STREAM=1`)

The PLoT V1 adapter now supports Server-Sent Events (SSE) streaming for real-time progress updates, interim findings, and graceful cancellation.

### Streaming API

**Endpoint**: `POST /v1/stream`

**Request**: Same as `/v1/run` (graph + seed)

**Response**: SSE stream with event types:

```typescript
// Event: started
event: started
data: {"run_id":"abc-123"}

// Event: progress
event: progress
data: {"percent":50}

// Event: interim (optional)
event: interim
data: {"findings":["Risk factor A identified","Analyzing dependencies"]}

// Event: complete
event: complete
data: {"result":{...},"execution_ms":500}

// Event: error
event: error
data: {"code":"RATE_LIMITED","error":"Rate limit exceeded","retry_after":60}
```

### Adapter Interface

```typescript
httpV1Adapter.stream?.run(request: RunRequest, callbacks: {
  onHello: (data: { response_id: string }) => void
  onTick: (data: { index: number }) => void
  onInterim?: (data: { findings: string[] }) => void
  onDone: (data: { response_id: string; report: ReportV1 }) => void
  onError: (error: ErrorV1) => void
}): CancelFn
```

**Cancellation**:
```typescript
const cancel = httpV1Adapter.stream.run(request, callbacks)

// Cancel via ESC key or route change
cancel()  // Sends POST /v1/run/:runId/cancel
```

### Interim Findings

**Purpose**: Progressive feedback during long-running analyses

**Behavior**:
- Backend sends cumulative lists (not deltas)
- Client replaces buffer on each event (no append)
- Micro-batching: 250ms window, 50 item cap
- Auto-cleared on completion or cancellation

**Implementation**: `src/canvas/store/interimQueue.ts`

```typescript
enqueueInterim(push, items)  // Replace buffer with new cumulative payload
clearInterimQueue()          // Cancel pending flush
```

**Store Integration**:
```typescript
// Store action
resultsInterim: (findings: string[]) => {
  // Replaces previous interim findings
  set({ interim_findings: findings })
}

// Auto-cleanup
resultsComplete: () => {
  clearInterimQueue()  // Flush any pending batches
  set({ interim_findings: [] })
}

resultsCancelled: () => {
  clearInterimQueue()  // Clean up on cancel
  set({ interim_findings: [] })
}
```

### Cancellation Behavior

**Triggers**:
1. **ESC key**: User presses Escape during streaming run
2. **Route change**: Navigation away from /plot
3. **New run**: Starting a new run cancels previous streaming run

**Flow**:
```typescript
1. User presses ESC
2. cancel() called → POST /v1/run/{runId}/cancel
3. SSE connection closed (EventSource.close())
4. Store updated: resultsCancelled()
5. Screen reader announcement: "Analysis cancelled"
```

**Network Behavior**:
- Cancel request sent with 5s timeout
- Non-blocking (fire-and-forget pattern)
- Stream cleanup happens regardless of cancel response

### Progress Updates

**UI Components**:
- Progress bar with `aria-valuenow` updates
- Percentage display (0-100)
- Estimated time remaining (optional)

**Accessibility**:
- `role="progressbar"`
- `aria-label="Analysis progress"`
- `aria-valuenow` updates on each progress event
- Screen reader announcements via `aria-live="polite"`

### Feature Flag

**Environment Variable**: `VITE_FEATURE_PLOT_STREAM=1`

**Adapter Selection**:
```typescript
const hasStreaming = import.meta.env.VITE_FEATURE_PLOT_STREAM === '1'

if (hasStreaming && httpV1Adapter.stream) {
  // Use streaming endpoint
  httpV1Adapter.stream.run(request, callbacks)
} else {
  // Fall back to sync endpoint
  await httpV1Adapter.run(request)
}
```

**Graceful Degradation**:
- Flag off → sync endpoint used (no progress updates)
- Flag on but stream endpoint fails → falls back to sync
- Preserves functionality regardless of backend support

### Error Handling

**Streaming-Specific Errors**:
```typescript
{
  code: 'STREAM_FAILED',
  error: 'Stream connection lost',
  retry_after: undefined
}
```

**Retry Logic**:
- Network errors: Auto-retry with exponential backoff (max 3 attempts)
- Rate limits: Respect `retry_after` from error event
- Timeouts: 60s max for complete event (longer than sync 30s)

### Test Coverage

**Unit Tests** (`src/adapters/plot/__tests__/`):
- `determinism.test.ts`: Sync vs streaming hash parity (5 tests)
- `autoDetectAdapter.streaming.test.ts`: Probe-based selection (9 tests)

**E2E Tests** (`e2e/`):
- `plot.streaming.spec.ts`: Happy path, ESC cancel, route change, 429, network error (7 tests)

---

## Debug Slices (Phase 2+ PLoT V1)

**Status**: ✅ Completed (requires `VITE_FEATURE_COMPARE_DEBUG=1` or `VITE_FEATURE_INSPECTOR_DEBUG=1`)

Debug slices provide advanced statistical analysis and edge-level insights without affecting determinism (`response_hash`).

### Backend Contract

**Request**:
```json
{
  "graph": {...},
  "seed": 42,
  "include_debug": true
}
```

**Response** (with debug slices):
```json
{
  "result": {
    "results": {...},
    "model_card": {
      "response_hash": "abc123..."  // SAME hash regardless of include_debug
    },
    "debug": {
      "compare": {
        "conservative": {
          "p10": 90,
          "p50": 100,
          "p90": 110,
          "top3_edges": [
            {"edge_id":"e1","from":"n1","to":"n2","label":"Risk A","weight":0.8}
          ]
        },
        "likely": {...},
        "optimistic": {...}
      },
      "inspector": {
        "edges": [
          {
            "edge_id": "e1",
            "from": "n1",
            "to": "n2",
            "label": "Risk Factor A",
            "weight": 0.85,
            "belief": 0.95,
            "provenance": "calibrated"
          }
        ]
      }
    }
  }
}
```

**Determinism Guarantee**:
- Debug slices **DO NOT** affect `response_hash`
- Server-side exclusion from hash computation
- Verified by determinism tests (with/without debug)

### Compare Debug Slices

**Feature Flag**: `VITE_FEATURE_COMPARE_DEBUG=1`

**Purpose**: Statistical analysis for Monte Carlo simulations

**UI Location**: CompareView → Debug Analysis section

**Data Structure**:
```typescript
debug.compare[option_id] = {
  p10: number    // 10th percentile
  p50: number    // 50th percentile (median)
  p90: number    // 90th percentile
  top3_edges: Array<{
    edge_id: string
    from: string
    to: string
    label: string
    weight: number
  }>
}
```

**Cross-Run Comparison**:
- **Single run**: Shows percentiles for current run only
- **A vs B**: Shows delta (B - A) for each metric
- Example: `p50: 150 → 170 (+20)`

**Top-3 Edges**:
- Click chip → Highlight edge on canvas (10Hz throttled)
- Auto-clear highlight after 2 seconds
- Keyboard accessible (Tab + Enter)

**Accessibility**:
- `role="region"` for debug section
- `aria-label` for each option (Conservative, Likely, Optimistic)
- Delta announcements: `aria-live="polite"`
- Tooltips explain p10/p50/p90 terminology
- Beta badge with info icon

**Parsing**:
```typescript
import { parseDebugCompare } from '@/adapters/plot/types'

const compareData = parseDebugCompare(report.debug?.compare)
if (!compareData) {
  // Graceful degradation - hide debug section
}
```

**Utilities**:
```typescript
// src/lib/compare.ts
deriveCompare(compareMap, optionId)            // Extract single run stats
deriveCompareAcrossRuns(mapA, mapB, optionId) // Calculate deltas (B - A)
```

### Inspector Debug Facts

**Feature Flag**: `VITE_FEATURE_INSPECTOR_DEBUG=1`

**Purpose**: Edge-level analysis with belief and provenance metadata

**UI Location**: EdgeInspector → Edge Facts table

**Data Structure**:
```typescript
debug.inspector.edges[] = {
  edge_id: string
  from: string
  to: string
  label: string
  weight: number          // Edge strength (0.0-1.0)
  belief?: number         // Default: 1.0
  provenance?: string     // Default: 'template'
}
```

**Default Values**:
- `belief`: `1.0` (full confidence)
- `provenance`: `'template'` (user-defined)

**Other Provenance Values**:
- `'calibrated'`: Adjusted by backend calibration
- `'inferred'`: Derived from other edges
- `'historical'`: From previous runs

**Facts Table**:
```tsx
<table aria-label="Edge debug facts">
  <tbody>
    <tr>
      <th>Weight</th>
      <td aria-label="Edge strength: 0.85">0.85</td>
      <Tooltip>Edge strength in causal graph</Tooltip>
    </tr>
    <tr>
      <th>Belief</th>
      <td aria-label="Confidence: 0.95">0.95</td>
      <Tooltip>Confidence in this relationship</Tooltip>
    </tr>
    <tr>
      <th>Provenance</th>
      <td aria-label="Source: calibrated">calibrated</td>
      <Tooltip>Source of edge data</Tooltip>
    </tr>
  </tbody>
</table>
```

**"Edit Probabilities" CTA**:
- Button: "Edit probabilities in this decision"
- Action: Selects source node, closes inspector
- Hint: "or press P after selecting"
- Fixed: Now uses `selectNodeWithoutHistory()` (was silently failing with `selectNodes()`)

**Parsing**:
```typescript
import { parseDebugInspectorEdges } from '@/adapters/plot/types'

const edgeFacts = parseDebugInspectorEdges(report.debug?.inspector?.edges)
if (!edgeFacts) {
  // Graceful degradation - hide facts table
}

const thisEdge = edgeFacts.find(e => e.edge_id === edgeId)
```

### Fail-Closed Parsing

**Strategy**: Zod schemas with fail-closed fallback

```typescript
// Zod schema with defaults
const DebugInspectorEdgeSchema = z.object({
  edge_id: z.string(),
  weight: z.number(),
  belief: z.number().optional().default(1.0),
  provenance: z.string().optional().default('template')
})

// Parse with try-catch
try {
  return DebugCompareMapSchema.parse(data)
} catch (err) {
  console.warn('[DebugSlice] Failed to parse:', err)
  // TODO: Sentry.captureException(err)
  return null
}
```

**Benefits**:
- Malformed debug data doesn't crash UI
- Debug features degrade gracefully
- Core functionality always works (results, drivers)

### Test Coverage

**Unit Tests**:
- `src/lib/__tests__/compare.debug.test.ts`: Compare utilities (16 tests)

**E2E Tests**:
- `e2e/plot.compare-debug.spec.ts`: Compare debug UI & a11y (7 tests)
- `e2e/plot.inspector-debug.spec.ts`: Inspector facts UI & a11y (8 tests)

---

## Keyboard Shortcuts

### Global Shortcuts

| Key | Action | Context | Notes |
|-----|--------|---------|-------|
| <kbd>ESC</kbd> | Cancel run | Streaming run in progress | Sends cancel request, closes stream |
| <kbd>P</kbd> | Open probabilities panel | Node selected | Opens panel for editing edge probabilities from selected node |

### Canvas Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| <kbd>Tab</kbd> | Focus next interactive element | Anywhere |
| <kbd>Enter</kbd> | Activate focused element | Button, edge chip |
| <kbd>Space</kbd> | Activate focused button | Button |

### Inspector Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| <kbd>Tab</kbd> | Navigate facts table | EdgeInspector open |
| <kbd>Enter</kbd> | Activate "Edit probabilities" | Focus on CTA button |
| <kbd>ESC</kbd> | Close inspector | EdgeInspector open |

### Compare View Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| <kbd>Enter</kbd> | Highlight edge | Focus on edge chip |
| <kbd>Tab</kbd> | Navigate edge chips | Top-3 edges visible |

---

## Future Enhancements

### Batch Operations
- `/v1/batch` endpoint for multi-scenario analysis
- Parallel execution of N seeds
- Progress aggregation

### Caching Strategy
- Response caching based on `clientHash`
- Instant results for repeated queries
- Cache size management (LRU eviction)

### Offline Support
- Service worker for template caching
- Graceful degradation when backend unavailable
- Queue requests for retry when online

### Debug Slice Enhancements
- Historical trend charts (p10/p50/p90 over time)
- Edge belief calibration UI
- Provenance lineage visualization
- Export debug data to CSV

## Security Appendix

### Sanitization Strategy

The application uses a **defense-in-depth** approach with centralized sanitization utilities (`src/canvas/utils/sanitize.ts`).

#### Core Sanitization Functions

**1. Label Sanitization** (`sanitizeLabel`)
- **Purpose**: Remove malicious code from user-provided labels while preserving legitimate text
- **Protection**: XSS via script injection, control characters
- **Behavior**:
  - Strips HTML tags: `<script>`, `<img>`, etc.
  - Removes script function calls: `alert()`, `eval()`, `onclick()`, etc.
  - Preserves legitimate parentheses: `"Revenue (Q1 2024)"` ✓
  - Falls back to `"Untitled"` if sanitization removes all content
- **Trade-off**: Balances security (removing malicious patterns) with UX (preserving annotations)

**2. Markdown Sanitization** (`sanitizeMarkdown`)
- **Purpose**: Convert user markdown to safe HTML
- **Protection**: XSS via markdown → HTML injection
- **Implementation**: `marked` + `DOMPurify`
- **Allowed tags**: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `code`, `pre`, `blockquote`, `h1-h6`, `a`, `span`
- **Blocked**: Scripts, iframes, objects, event handlers

**3. JSON Sanitization** (`sanitizeJSON`)
- **Purpose**: Remove prototype pollution keys from parsed JSON
- **Protection**: Prototype pollution attacks
- **Behavior**:
  - Uses `Object.create(null)` for pollution-free objects
  - Blocks keys: `__proto__`, `constructor`, `prototype`
  - Recursive: sanitizes nested objects and arrays
  - Max depth: 10 levels (prevents stack overflow)
- **Used in**: `importCanvas()` for template import protection

**4. Share Hash Validation** (`sanitizeShareHash`)
- **Purpose**: Validate snapshot/result share hashes
- **Protection**: Open redirect, URL injection
- **Accepted formats**:
  - SHA-256 hex: exactly 64 characters `[a-f0-9]`
  - Base64url: `[a-zA-Z0-9_-]+` with optional `z:` prefix (max 8KB)
- **Allowlist support**: Optional strict validation against server-provided hash list
- **Behavior**: Returns `null` for invalid hashes (fail-closed)

**5. Filename Sanitization** (`sanitizeFilename`)
- **Purpose**: Remove directory traversal and shell metacharacters
- **Protection**: Directory traversal (`../`), shell injection (`;`, `|`, `&`)
- **Transformation**:
  - `../../../etc/passwd` → `------etc-passwd`
  - Preserves alphanumeric, hyphen, underscore, single dots (for extensions)

**6. URL Sanitization** (`sanitizeUrl`)
- **Purpose**: Prevent open redirect and javascript: protocol injection
- **Protection**: Open redirect, XSS via URL
- **Behavior**:
  - Allows relative paths: `/templates` ✓
  - Allows same-origin: `http://localhost:3000/canvas` ✓
  - Blocks external URLs unless allowlisted
  - Blocks dangerous protocols: `javascript:`, `data:`, `file:`
  - Falls back to `"/"` for invalid URLs (safe default)

**7. Number Sanitization** (`sanitizeNumber`)
- **Purpose**: Validate numeric input with range constraints
- **Protection**: NaN injection, Infinity DoS
- **Behavior**:
  - Rejects `NaN`, `Infinity`, `-Infinity`
  - Enforces min/max bounds
  - Falls back to configurable default (not coercing `null` → `0`)

**8. HTML Sanitization** (`sanitizeHTML`)
- **Purpose**: Strip HTML to bare minimum safe tags
- **Protection**: XSS in user-generated content
- **Allowed tags**: `b`, `i`, `em`, `strong`, `br` (no attributes)
- **Use case**: Inline user comments, annotations

### Preview Persistence Boundaries

**Security Requirement**: Preview Mode state must NEVER persist to storage.

**Why**: Preview state contains:
- Staged edits that user may discard
- Speculative "what-if" scenarios
- Potentially sensitive exploratory analysis

**Implementation** (`src/canvas/persist.ts`):
```typescript
// ✅ CORRECT: Explicit property extraction
const persisted: PersistedState = {
  version: 1,
  timestamp: Date.now(),
  nodes: state.nodes,  // ONLY nodes
  edges: state.edges,  // ONLY edges
}

// ❌ WRONG: Would leak preview state
const persisted = { ...state } // Don't use spread!
```

**Protected Operations**:
1. `saveState()` → localStorage `canvas-storage`
2. `saveSnapshot()` → localStorage `canvas-snapshot-*`
3. `exportCanvas()` → JSON export

**Excluded Properties**:
- `preview.active`
- `preview.stagedNodes`
- `preview.stagedEdges`
- `preview.previewReport`
- `preview.previewSeed`
- `preview.previewHash`

**Test Coverage**: 2 integration tests verify exclusion (Task I improvements)

### Attack Vector Coverage

| Attack Type | Protection | Test Coverage |
|-------------|-----------|---------------|
| XSS (script tags) | `sanitizeLabel`, `sanitizeMarkdown` | 18 tests |
| XSS (event handlers) | `sanitizeLabel`, `sanitizeHTML` | 12 tests |
| Prototype Pollution | `sanitizeJSON` | 4 tests |
| Directory Traversal | `sanitizeFilename` | 3 tests |
| Shell Injection | `sanitizeFilename` | 3 tests |
| Open Redirect | `sanitizeUrl`, `sanitizeShareHash` | 6 tests |
| URL Protocol Injection | `sanitizeUrl` | 4 tests |
| Preview State Leakage | Explicit persistence guards | 2 tests |

**Total Security Tests**: 52+ across 9 sanitization functions

### Security Best Practices

**1. Single Source of Truth**
- All sanitization routes through `src/canvas/utils/sanitize.ts`
- No inline regex sanitization (DRY principle)
- Example: `ResultsPanel.handleShare` now delegates to `sanitizeShareHash()`

**2. Fail-Closed Defaults**
- Invalid input → safe fallback (not coercion)
- `sanitizeShareHash()` returns `null` (not empty string)
- `sanitizeUrl()` returns `"/"` (not passthrough)
- `sanitizeLabel()` returns `"Untitled"` (prevents unnamed nodes)

**3. Defense in Depth**
- Multiple layers: client-side + backend validation
- Preflight validation before `/v1/run` (saves network calls)
- Server-side validation via `/v1/validate` endpoint
- Limits enforced by `limitsManager` singleton

**4. Explicit Over Implicit**
- Persistence uses explicit property extraction (not spread operator)
- Allowlists are opt-in (explicit safer than deny-lists)
- Type guards validate structure before processing

### Known Limitations & Future Work

**1. Allowlist Integration**
- `validateShareHashAllowlist()` exists but unused
- **Action**: Add E2E test with mock allowlist before enabling server-provided hash vetting

**2. Sanitization Feedback**
- Users don't see warnings when labels are heavily sanitized
- **Action**: Add UI feedback when sanitization modifies input significantly

**3. LocalStorage Quota**
- Snapshot rotation may leave stale keys if quota exceeded mid-rotation
- **Action**: Add cleanup retry logic in quota error handler

**4. Template Import Validation**
- Template structure validation is basic (type checks only)
- **Action**: Consider JSON schema validation for stricter template format enforcement

**5. Rate Limiting**
- No client-side throttling for API calls
- **Action**: Add debouncing for rapid successive runs (UX + backend protection)

### References

- Sanitization implementation: `src/canvas/utils/sanitize.ts`
- Sanitization tests: `src/canvas/utils/__tests__/sanitize.spec.ts` (78 tests)
- Persistence guards: `src/canvas/persist.ts`
- Persistence tests: `src/canvas/__tests__/persist.spec.ts` (17 tests)
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Prototype Pollution: https://learn.snyk.io/lessons/prototype-pollution/javascript/

---

## Troubleshooting

### 429 Rate Limiting

**Symptom:** Run button disabled with countdown timer

**Cause:** Backend returned 429 Too Many Requests with `Retry-After` header

**Behavior:**
- Run button automatically disabled for duration specified in `Retry-After` header
- Countdown displayed to user showing seconds remaining
- Button auto-re-enables when countdown reaches zero
- No duplicate runs fired during countdown period

**Mitigation:**
- Client-side: 500ms debouncing prevents rapid successive runs
- UI feedback: Countdown provides clear user guidance
- No action required - system automatically recovers

**Developer Notes:**
- Error handling in `useResultsRun.ts` and `usePreviewRun.ts`
- Store action: `resultsError({ retryAfter: number })`
- Test coverage: Contract tests simulate 429 responses

---

### Sanitizer Side Effects

**Symptom:** User-provided labels modified or changed to "Untitled"

**Cause:** Aggressive sanitization removed malicious patterns or entire input

**Examples:**
```typescript
// Malicious input → safe fallback
"<script>alert(1)</script>" → "Untitled"
"onclick(steal())" → "Untitled"

// Legitimate input preserved
"Alert Threshold (Critical)" → "Alert Threshold (Critical)"
"Revenue (Q1 2024)" → "Revenue (Q1 2024)"
```

**Current Behavior:** Silent modification (no user warning)

**Future Enhancement:** Show toast when input heavily modified
```typescript
if (sanitized !== original && sanitized === 'Untitled') {
  showToast('Label contained unsafe content and was reset to "Untitled"', 'warning')
}
```

**Developer Notes:**
- Sanitization logic: `src/canvas/utils/sanitize.ts`
- Design principle: Fail-closed (safe fallback over coercion)
- Test coverage: 78 tests including XSS vectors

---

### LocalStorage Quota Exceeded

**Symptom:** "LocalStorage quota exceeded" error in console

**Cause:** Browser storage limit reached (typically 5-10MB depending on browser)

**Automatic Recovery:**
- System attempts progressive cleanup (removes oldest snapshots incrementally)
- Up to 5 cleanup attempts before giving up
- Telemetry tracked via `getQuotaTelemetry()`

**Manual Resolution:**
1. **Clear old snapshots:** Settings → Snapshot Manager → Delete oldest
2. **Export canvas:** File → Export → Save locally
3. **Clear browser storage:** Browser DevTools → Application → Local Storage → Clear
4. **Reduce graph size:** Delete unused nodes/edges

**Monitoring:**
```typescript
import { getQuotaTelemetry } from './canvas/persist'

const { exceeded, recovered } = getQuotaTelemetry()
console.log(`Quota errors: ${exceeded}, Recovered: ${recovered}`)
```

**Developer Notes:**
- Progressive cleanup: `src/canvas/persist.ts` (tryProgressiveCleanup)
- Rotation limit: MAX_SNAPSHOTS = 10
- Payload limit: MAX_PAYLOAD_SIZE = 5MB
- Test coverage: `persist.spec.ts` (quota simulation)

---

### Allowlist Feature Flag

**Status:** Implemented but not yet deployed (as of October 2025)

**Activation:** Set `VITE_FEATURE_SHARE_ALLOWLIST=1` in environment

**Purpose:** Enable server-provided hash vetting for share links

**When Enabled:**
- `validateShareHashAllowlist()` function activates
- Client sends hash to `/v1/allowlist` endpoint (when deployed)
- Only allowlisted hashes accepted for shared runs

**Current State:**
- Function exists in `sanitize.ts` with test coverage
- Backend endpoint not deployed yet
- Feature flag gates activation

**Developer Notes:**
- Implementation: `src/canvas/utils/sanitize.ts`
- E2E test: `e2e/share-allowlist.spec.ts` (behind flag)
- Deployment blocker: Requires backend `/v1/allowlist` endpoint

### Streaming Connection Issues

**Symptom:** Streaming runs timeout or fail with "Stream connection lost"

**Causes:**
1. Network interruption mid-stream
2. Proxy/firewall blocking SSE connections
3. Backend stream endpoint not available
4. Feature flag not set (`VITE_FEATURE_PLOT_STREAM=1`)

**Diagnosis:**
```typescript
// Check if streaming is enabled
console.log('Stream enabled:', !!(httpV1Adapter as any).stream)

// Check feature flag
console.log('Feature flag:', import.meta.env.VITE_FEATURE_PLOT_STREAM)

// Monitor SSE connection in DevTools → Network tab
// Look for "v1/stream" request with type "eventsource"
```

**Resolution:**
1. **Network issues**: Auto-retry with exponential backoff (3 attempts)
2. **Proxy blocking**: Add SSE support to proxy config:
   ```typescript
   // vite.config.ts
   proxy: {
     '/api/plot': {
       target: 'http://localhost:8000',
       changeOrigin: true,
       ws: true  // Enable WebSocket/SSE
     }
   }
   ```
3. **Backend unavailable**: Falls back to sync endpoint automatically
4. **Flag not set**: Set `VITE_FEATURE_PLOT_STREAM=1` in `.env.local`

**Developer Notes:**
- Streaming timeout: 60s (longer than sync 30s)
- Retry logic: `src/adapters/plot/v1/http.ts` (withRetry)
- Fallback: `autoDetectAdapter` probes /v1/health and /v1/run endpoints

---

### Debug Slices Not Showing

**Symptom:** Compare/Inspector debug sections are hidden or empty

**Causes:**
1. Feature flags not enabled
2. Backend doesn't support `include_debug=true`
3. Debug data failed parsing (malformed JSON)
4. Report missing debug field

**Diagnosis:**
```typescript
// Check feature flags
console.log('Compare debug:', import.meta.env.VITE_FEATURE_COMPARE_DEBUG)
console.log('Inspector debug:', import.meta.env.VITE_FEATURE_INSPECTOR_DEBUG)

// Check report structure
console.log('Debug field:', report.debug)

// Check parsing
import { parseDebugCompare, parseDebugInspectorEdges } from '@/adapters/plot/types'
console.log('Parsed compare:', parseDebugCompare(report.debug?.compare))
console.log('Parsed inspector:', parseDebugInspectorEdges(report.debug?.inspector?.edges))
```

**Resolution:**
1. **Flags not set**: Add to `.env.local`:
   ```bash
   VITE_FEATURE_COMPARE_DEBUG=1
   VITE_FEATURE_INSPECTOR_DEBUG=1
   ```
2. **Backend doesn't support**: Graceful degradation - core features still work
3. **Parse failure**: Check console for `[DebugSlice] Failed to parse:` warnings
4. **Zod schema mismatch**: Update schemas in `src/adapters/plot/types.ts`

**Expected Behavior:**
- Debug sections only visible when flags enabled AND data present
- Parsing failures logged to console (not crashing UI)
- Core functionality (results, drivers) always works

**Developer Notes:**
- Parsing: `src/adapters/plot/types.ts` (parseDebugCompare, parseDebugInspectorEdges)
- UI: `src/canvas/components/CompareView.tsx`, `src/canvas/ui/EdgeInspector.tsx`
- Test coverage: `e2e/plot.compare-debug.spec.ts`, `e2e/plot.inspector-debug.spec.ts`

---

### Interim Findings Not Updating

**Symptom:** Interim findings list frozen or showing stale data

**Causes:**
1. Micro-batching queue not flushing
2. Stream sending delta updates (not cumulative)
3. Queue cleanup failed on cancel/complete

**Diagnosis:**
```typescript
// Check queue state (in DEV mode)
import { getQueueStats } from '@/canvas/store/interimQueue'
console.log('Queue stats:', getQueueStats())

// Monitor interim events in Network → EventSource
// Verify "event: interim" payloads are cumulative lists
```

**Resolution:**
1. **Queue stuck**: Force flush via `clearInterimQueue()`
2. **Delta payloads**: Backend bug - interim events MUST send full cumulative lists
3. **Cleanup failed**: Check `resultsComplete()` and `resultsCancelled()` call `clearInterimQueue()`

**Expected Behavior:**
- Interim findings replace (not append) on each event
- 250ms batching window to prevent re-render storms
- Auto-cleared on completion or cancellation

**Developer Notes:**
- Implementation: `src/canvas/store/interimQueue.ts`
- Store integration: `src/canvas/store.ts` (resultsInterim, resultsComplete, resultsCancelled)
- SSR guards: Uses `globalThis.setTimeout` instead of `window.setTimeout`

---

### Edge Highlight Not Working

**Symptom:** Clicking edge chips in Compare view doesn't highlight edge on canvas

**Causes:**
1. Throttling rate limit (10Hz = 100ms)
2. Edge ID mismatch between debug data and canvas
3. Highlight layer not rendering

**Diagnosis:**
```typescript
// Check throttle timing
// Click chip twice quickly - second click should no-op if within 100ms

// Verify edge ID exists on canvas
const edge = edges.find(e => e.id === 'e1')
console.log('Edge exists:', !!edge)

// Check highlight state
console.log('Highlighted driver:', store.getState().highlightedDriver)
```

**Resolution:**
1. **Throttling**: Working as intended - prevents performance issues
2. **ID mismatch**: Ensure backend debug data uses same edge IDs as graph
3. **Layer not rendering**: Check HighlightLayer component is mounted

**Expected Behavior:**
- Click → highlight edge immediately (if not throttled)
- Auto-clear after 2 seconds
- Keyboard (Tab + Enter) also triggers highlight

**Developer Notes:**
- Throttling: `src/canvas/components/CompareView.tsx` (handleEdgeHighlight)
- Rate limit: 10Hz (100ms minimum interval between highlights)
- Store: `setHighlightedDriver({ kind: 'edge', id: edgeId })`

---

### "Edit Probabilities" Button Silent Failure

**Symptom:** Clicking "Edit probabilities" in EdgeInspector does nothing

**Cause:** Bug fixed in Phase 2+ - was calling non-existent `selectNodes()` instead of `selectNodeWithoutHistory()`

**Fix Applied:**
```typescript
// OLD (broken):
selectNodes([edge.source])

// NEW (fixed):
selectNodeWithoutHistory(edge.source)
```

**Resolution:** Ensure you're running latest Phase 2+ code

**Developer Notes:**
- Fixed in commit: [91eba40]
- File: `src/canvas/ui/EdgeInspector.tsx:350`
- Store action: `selectNodeWithoutHistory(nodeId: string)`

---

## CI Budgets & Performance

### Web Vitals Thresholds (CI-Enforced)

**Performance budgets enforced in CI pipeline:**

```bash
# Environment variables (configurable)
VITALS_LCP_MS=2500      # Largest Contentful Paint ≤ 2.5s
VITALS_INP_MS=100       # Interaction to Next Paint ≤ 100ms
VITALS_CLS=0.1          # Cumulative Layout Shift ≤ 0.1
```

**Test Command:**
```bash
npm run e2e:vitals
```

**Output:**
- `test-artifacts/webvitals.json` - Detailed metrics
- `test-artifacts/webvitals-representative.json` - Full flow metrics

**CI Failure:**
- Tests fail if any threshold exceeded
- Blocks merge until performance regression fixed

**Local Profiling:**

1. **Chrome DevTools:**
   ```
   1. Open DevTools → Performance tab
   2. Record interaction (run analysis, open inspector)
   3. Check Core Web Vitals in Summary
   ```

2. **Lighthouse CI:**
   ```bash
   npm install -g @lhci/cli
   lhci autorun
   ```

3. **Bundle Analysis:**
   ```bash
   npm run measure:bundle
   npm run report:chunks
   ```

**Lazy Loading Impact:**
- ELK: ~500KB (loaded on first layout trigger)
- DOMPurify: ~50KB (loaded on first sanitization)
- marked: ~40KB (loaded on first markdown render)
- **Total savings on initial load:** ~600KB

**Target Metrics (Representative Flow):**
- Template load → Run → Results display
- LCP: < 2.5s (canvas render)
- INP: < 100ms (button click → response)
- CLS: < 0.1 (no layout shifts during run)

---

## Change Log

- **2025-10-31**: Phase 2+ PLoT V1 Streaming & Debug Features documentation
  - Added Streaming section (SSE, progress, cancellation, interim findings)
  - Added Debug Slices section (Compare & Inspector debug features)
  - Added Keyboard Shortcuts reference
  - Added troubleshooting for streaming, debug slices, edge highlighting
- **2025-10-30**: Security Appendix added (comprehensive sanitization strategy documentation)
- **2025-10-30**: Initial documentation (Phase 2+ Section J, Task J2)
- **Phase 2+ Sections A-D**: httpV1Adapter implementation completed
- **Phase 2+ Section F**: Templates with suggested_positions (F2)
- **Phase 2+ Section H**: Security hardening (H1-H3)
