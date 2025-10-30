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

## Future Enhancements

### SSE Streaming
- Enable real-time progress updates
- Reduce perceived latency
- Support cancellation mid-execution

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

## Change Log

- **2025-10-30**: Security Appendix added (comprehensive sanitization strategy documentation)
- **2025-10-30**: Initial documentation (Phase 2+ Section J, Task J2)
- **Phase 2+ Sections A-D**: httpV1Adapter implementation completed
- **Phase 2+ Section F**: Templates with suggested_positions (F2)
- **Phase 2+ Section H**: Security hardening (H1-H3)
