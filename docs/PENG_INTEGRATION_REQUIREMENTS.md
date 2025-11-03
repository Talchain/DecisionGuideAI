# PLoT V1 Frontend → P Engine Backend Integration Requirements

**Document Version**: 1.0
**Date**: 2025-11-01
**Branch**: `feat/command-palette`
**Status**: Ready for Backend Review

---

## Executive Summary

The DecisionGuideAI frontend has completed **PLoT V1 integration** including:
- ✅ HTTP adapter with strict UI ↔ API shape separation
- ✅ Streaming support with reconnection logic (feature-flagged)
- ✅ Validation and limits management
- ✅ Debug slices (Compare + Inspector modes)
- ✅ Polish features (Command Palette, Snapshots, Share Links, Onboarding)

**Current Integration Status**:
- Frontend calls v1 endpoints via proxy (`/api/plot` → P Engine)
- **BLOCKING**: Missing `response_hash` in `/v1/run` responses → runs fail
- **Non-blocking**: 404s on `/v1/limits` and `/v1/validate` (has fallbacks)

**What We Need**:
1. Add `response_hash` field to `/v1/run` response (**critical**)
2. Confirm `summary` and `explain_delta.top_drivers` schema (**critical**)
3. Implement `/v1/limits` and `/v1/validate` endpoints (**recommended**)
4. Provide staging environment for integration testing

> **⚠️ NEW: Determinism Enforcement (Nov 2025)**
>
> `/v1/run` **MUST** return `result.response_hash` (string). Staging/production builds now **fail** if this field is missing. DEV mode supports fallback (`dev-{random}`) for local testing, but staging/prod are **strictly enforced**. See [Determinism Hardening Guide](./DETERMINISM_HARDENING.md) for details.

---

## Table of Contents

1. [API Endpoints Reference](#1-api-endpoints-reference)
2. [Critical Issues](#2-critical-issues)
3. [Shape Separation (MUST READ)](#3-shape-separation-must-read)
4. [Complete Schemas](#4-complete-schemas)
5. [Questions for P Engine Team](#5-questions-for-p-engine-team)
6. [Proxy & CORS Setup](#6-proxy--cors-setup)
7. [Integration Checklist](#7-integration-checklist)
8. [Testing & Validation](#8-testing--validation)

---

## 1. API Endpoints Reference

### Core Endpoints (Required)

| Endpoint | Method | Status | Priority | Description |
|----------|--------|--------|----------|-------------|
| `/v1/run` | POST | ⚠️ Missing `response_hash` | **CRITICAL** | Execute analysis (sync) |
| `/v1/limits` | GET | 🚨 404 | High | Get system limits |
| `/v1/validate` | POST | 🚨 404 | Medium | Preflight validation |
| `/v1/health` | GET | ✅ Expected to work | High | Health check |

### Template Endpoints (Required)

| Endpoint | Method | Status | Priority | Description |
|----------|--------|--------|----------|-------------|
| `/v1/templates` | GET | ✅ Expected to work | High | List templates |
| `/v1/templates/{id}/graph` | GET | ✅ Expected to work | High | Get template graph |

### Streaming Endpoints (Optional - Feature Flagged)

| Endpoint | Method | Status | Priority | Description |
|----------|--------|--------|----------|-------------|
| `/v1/run/stream` | POST (SSE) | ❓ Unknown | Low | SSE streaming (flag: OFF) |
| `/v1/run/{id}/cancel` | POST | ❓ Unknown | Low | Cancel analysis |

---

## 2. Critical Issues

### 🚨 Issue 1: Missing `response_hash` in `/v1/run` Response

**Current Error**:
```
[httpV1] Backend returned no response_hash - determinism broken!
TypeError: Cannot read property 'response_hash' of undefined
```

**Root Cause**: `/v1/run` response missing `result.response_hash` field

**Impact**: All analysis runs fail immediately

**Frontend Code** (httpV1Adapter.ts:291-300):
```typescript
if (!normalized.hash) {
  throw {
    schema: 'error.v1',
    code: 'SERVER_ERROR',
    error: 'Backend returned no response_hash (determinism requirement violated)',
  }
}
```

**Required Fix**: Add `response_hash` to response:
```json
{
  "result": {
    "response_hash": "abc123def456...",  // ← ADD THIS
    "summary": { ... },
    // ... rest of response
  }
}
```

**Questions**:
- What algorithm generates `response_hash`? (Frontend expects SHA-256)
- Is it deterministic? (same input → same hash)
- What inputs are hashed? (graph only? graph + seed? graph + seed + params?)

---

### ⚠️ Issue 2: 404 on `/v1/limits`

**Current Behavior**:
```
GET /api/plot/v1/limits → 404
Frontend falls back to static limits (200 nodes, 500 edges)
```

**Impact**: Non-blocking (has fallback), but users see incorrect limits

**Recommended Fix**: Implement endpoint:
```json
{
  "nodes": { "max": 200 },
  "edges": { "max": 500 }
}
```

---

### ⚠️ Issue 3: 404 on `/v1/validate`

**Current Behavior**:
```
POST /api/plot/v1/validate → 404
Frontend logs warning, continues to /v1/run
```

**Impact**: Non-blocking (graceful degradation), but no preflight validation

**Recommended Fix**: Implement validation endpoint (same schema as `/v1/run`, no execution)

---

## 3. Shape Separation (MUST READ)

### ⚠️ CRITICAL: Frontend Uses TWO Different Graph Formats

The frontend maintains **strict separation** between UI and API shapes:

#### UI Shape (React Flow Format - Internal Only)
```typescript
{
  nodes: [{
    id: "n1",
    type: "decision",
    position: { x: 100, y: 200 },
    data: {
      label: "Option A",
      confidence: 0.8  // ← UI-only field
    }
  }],
  edges: [{
    id: "e1",
    source: "n1",    // ← UI uses "source"
    target: "n2",    // ← UI uses "target"
    data: {
      confidence: 0.8,
      weight: 1.0
    }
  }]
}
```

#### API Shape (PLoT V1 Format - Sent to Backend)
```typescript
{
  "nodes": [
    { "id": "n1", "label": "Option A" }
    // NO source/target, NO data, NO position
  ],
  "edges": [
    {
      "from": "n1",   // ← API uses "from"
      "to": "n2",     // ← API uses "to"
      "weight": 0.8   // ← Normalized from confidence
    }
    // NO id, NO data
  ]
}
```

### Shape Conversion Logic (v1/mapper.ts)

**Before sending to backend**, `toApiGraph()` converts:
- `source` → `from`
- `target` → `to`
- `node.data.label` → `node.label` (flattened)
- `edge.data.confidence` → `edge.weight` (normalized)
- **Strips**: `id`, `source`, `target`, `data`, `position`, `type`

**Weight Normalization**:
- `0.75` → `0.75` (no change)
- `75` → `0.75` (percentage to decimal)
- `-25` → `-0.25` (negative weights preserved)
- `0` → `0.01` (minimum non-zero)

### 🚨 Backend MUST NEVER Receive:

- ❌ `source` or `target` fields (UI-only)
- ❌ `data` nested objects (UI-only)
- ❌ `position` or `type` (UI-only)
- ❌ `data.confidence` (converted to `weight`)

### ✅ Backend SHOULD Receive:

- ✅ `from` and `to` (not source/target)
- ✅ `weight` (0-1 range, normalized)
- ✅ Flat `label` and `body` (no nesting)

---

## 4. Complete Schemas

### `POST /v1/run` - Execute Analysis

#### Request Schema
```typescript
{
  // Graph (API shape - see section 3)
  graph: {
    nodes: Array<{
      id: string
      label?: string    // max 120 chars
      body?: string     // max 2000 chars
    }>
    edges: Array<{
      from: string      // node ID
      to: string        // node ID
      weight?: number   // 0-1 range (NOT confidence!)
      // NO id, NO source/target, NO data
    }>
  }

  // Execution params
  seed?: number
  idempotencyKey?: string   // From clientHash (optional)
  clientHash?: string       // SHA-256 of graph (optional)

  // Advanced knobs (optional)
  k_samples?: number
  treatment_node?: string
  outcome_node?: string
  baseline_value?: number

  // Debug feature flag (Phase 2+)
  include_debug?: boolean   // Request debug slices
}
```

#### Response Schema
```typescript
{
  result: {
    // Core fields
    answer: string
    confidence: number        // 0-1
    explanation: string

    // 🚨 REQUIRED: Structured results
    summary: {
      conservative: number
      likely: number
      optimistic: number
      units?: string          // e.g., "currency", "percent"
    }

    // 🚨 REQUIRED: Drivers for UI
    explain_delta: {
      top_drivers: Array<{
        kind: 'node' | 'edge'
        node_id?: string      // For kind=node
        edge_id?: string      // For kind=edge
        label?: string        // Display label
        impact?: number       // -1 to 1
      }>
    }

    // 🚨 CRITICAL: Deterministic hash
    response_hash: string     // SHA-256, MUST BE PRESENT

    // Metadata
    seed?: number

    // Optional: Debug slices (when include_debug=true)
    debug?: {
      compare?: Record<string, {
        p10: number
        p50: number
        p90: number
        top3_edges: Array<{
          edge_id: string
          from: string
          to: string
          label?: string
          weight: number
        }>
      }>
      inspector?: {
        edges: Array<{
          edge_id: string
          from: string
          to: string
          label: string
          weight: number
          belief?: number       // default: 1.0
          provenance?: string   // default: 'template'
        }>
      }
    }
  }
  execution_ms: number
}
```

#### Example Request
```bash
curl -X POST http://localhost:4311/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "graph": {
      "nodes": [
        {"id": "goal", "label": "Increase Revenue"},
        {"id": "opt_a", "label": "Option A"},
        {"id": "outcome", "label": "Q4 Revenue"}
      ],
      "edges": [
        {"from": "goal", "to": "opt_a", "weight": 0.8},
        {"from": "opt_a", "to": "outcome", "weight": 0.9}
      ]
    },
    "seed": 42
  }'
```

#### Example Response
```json
{
  "result": {
    "answer": "Analysis complete with high confidence",
    "confidence": 0.85,
    "explanation": "Strong path through Option A yields positive outcome",
    "summary": {
      "conservative": 50000,
      "likely": 75000,
      "optimistic": 100000,
      "units": "currency"
    },
    "explain_delta": {
      "top_drivers": [
        {
          "kind": "edge",
          "edge_id": "opt_a->outcome",
          "label": "Option A → Q4 Revenue",
          "impact": 0.72
        }
      ]
    },
    "response_hash": "a3f5b8c9d1e2f4a6b7c8d9e0f1a2b3c4",
    "seed": 42
  },
  "execution_ms": 1234
}
```

---

### `GET /v1/limits` - Get System Limits

#### Request
None (GET)

#### Response Schema
```typescript
{
  nodes: { max: number }  // e.g., 200
  edges: { max: number }  // e.g., 500

  // Optional future fields
  label?: { max: number }      // e.g., 120
  body?: { max: number }       // e.g., 2000
  rateLimit?: { rpm: number }  // e.g., 60
}
```

#### Example Response
```json
{
  "nodes": {"max": 200},
  "edges": {"max": 500}
}
```

---

### `POST /v1/validate` - Preflight Validation

#### Request Schema
Same as `/v1/run` (but no execution)

#### Response Schema
```typescript
// Success
{ valid: true }

// Failure
{
  valid: false
  violations: Array<{
    field: string     // e.g., "graph.nodes"
    message: string   // e.g., "Too many nodes (max: 200, got: 250)"
  }>
}
```

#### Example Response (Invalid)
```json
{
  "valid": false,
  "violations": [
    {
      "field": "graph.nodes",
      "message": "Exceeds maximum nodes (max: 200, got: 250)"
    },
    {
      "field": "graph.edges[5].weight",
      "message": "Weight out of range (must be 0-1, got: 1.5)"
    }
  ]
}
```

---

### `GET /v1/health` - Health Check

#### Response Schema
```typescript
{
  status: 'ok' | 'degraded' | 'down'
  timestamp: string  // ISO 8601
  version?: string
  uptime_ms?: number
}
```

---

### `GET /v1/templates` - List Templates

#### Response Schema
**IMPORTANT**: Return **bare array** (not wrapped object)

```typescript
Array<{
  id: string
  label: string        // Display name
  summary: string      // Short description
  updated_at: string   // ISO 8601
}>
```

#### Example Response
```json
[
  {
    "id": "small",
    "label": "Small Demo",
    "summary": "Minimal 2-node graph for testing",
    "updated_at": "2025-11-01T12:00:00Z"
  },
  {
    "id": "pricing",
    "label": "Pricing Decision",
    "summary": "Evaluate pricing strategy options",
    "updated_at": "2025-10-15T08:30:00Z"
  }
]
```

---

### `GET /v1/templates/{id}/graph` - Get Template Graph

#### Response Schema
```typescript
{
  template_id: string
  default_seed: number
  graph: {
    nodes: Array<{ id: string; label?: string; body?: string }>
    edges: Array<{ from: string; to: string; weight?: number }>
  }
}
```

**IMPORTANT**: Graph is already in **API shape** (from/to, not source/target)

---

### Error Response Format (All Endpoints)

#### Schema
```typescript
{
  code: 'BAD_INPUT' | 'RATE_LIMITED' | 'LIMIT_EXCEEDED' |
        'SERVER_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR'
  message: string
  field?: string         // For BAD_INPUT, LIMIT_EXCEEDED
  max?: number          // For LIMIT_EXCEEDED
  retry_after?: number  // For RATE_LIMITED (seconds)
  details?: unknown     // Additional context
}
```

#### HTTP Status Mapping
- **400** → `BAD_INPUT`
- **413** → `LIMIT_EXCEEDED`
- **429** → `RATE_LIMITED` (with `Retry-After` header)
- **500-599** → `SERVER_ERROR`

#### Example Error Response
```json
{
  "code": "LIMIT_EXCEEDED",
  "message": "Graph exceeds maximum nodes",
  "field": "graph.nodes",
  "max": 200
}
```

---

## 5. Questions for P Engine Team

### 🚨 Critical (Blocking - Need Answers ASAP)

1. **response_hash Algorithm**:
   - What algorithm do you use? (Frontend expects SHA-256)
   - Is it deterministic? (same input → same hash)
   - What inputs are hashed? (graph? graph+seed? graph+seed+params?)
   - Example: graph `{nodes: [{id: "a"}], edges: []}` + seed `42` → what hash?

2. **summary Field**:
   - Is `result.summary` always present in `/v1/run` response?
   - What if analysis fails? Return `{conservative: 0, likely: 0, optimistic: 0}`?
   - Is `units` field always present or optional?

3. **explain_delta.top_drivers Field**:
   - Is this always present?
   - Can it be an empty array `[]`?
   - How do you populate `node_id` and `edge_id`? Match our graph IDs?

4. **Schema Validation**:
   - Do you validate that `weight` is 0-1 range?
   - Do you reject graphs with `source`/`target` (instead of `from`/`to`)?
   - Do you reject `data` nested objects?

### ⚠️ Important (Non-Blocking - Need Answers Soon)

5. **Debug Slices**:
   - Do you support `include_debug=true` parameter?
   - If yes, do you return `result.debug.compare` and `result.debug.inspector`?
   - What's the schema? (See `/v1/run` response schema above)

6. **Idempotency**:
   - Do you support `Idempotency-Key` header?
   - Do you support `clientHash` in request body?
   - How long do you cache results? (Frontend expects 5min-1hr)

7. **ETag Caching**:
   - Do you support `ETag` headers for `/v1/templates`?
   - Do you support `If-None-Match` → `304 Not Modified`?
   - Same for `/v1/limits`?

8. **Rate Limiting**:
   - Do you return `Retry-After` header on 429 responses?
   - What's the rate limit? (Frontend defaults to 60 req/min)
   - Per-IP? Per-API-key?

### 💡 Nice-to-Have (Future)

9. **Negative Weights**:
   - Do you support negative weights? (e.g., `-0.4` for inhibitory edges)
   - Frontend preserves them: `-25 → -0.25`

10. **Advanced Parameters**:
    - Do you accept `k_samples`, `treatment_node`, `outcome_node`, `baseline_value`?
    - Are these documented anywhere?

11. **SSE Streaming**:
    - Is `POST /v1/run/stream` implemented?
    - Event types: `started`, `progress`, `interim`, `complete`, `error`?
    - Schema matches sync `/v1/run`?

12. **Cancel Endpoint**:
    - Is `POST /v1/run/{run_id}/cancel` implemented?
    - Is it idempotent? (200 even if already complete/cancelled?)

13. **OpenAPI Spec**:
    - Do you have OpenAPI/Swagger documentation?
    - Can we get the spec file?

14. **Staging Environment**:
    - What's the staging URL?
    - How do we get API credentials?
    - Is CORS enabled or should we use proxy?

---

## 6. Proxy & CORS Setup

### Frontend Proxy (vite.config.ts)

```typescript
proxy: {
  '/api/plot': {
    target: env.PLOT_API_URL || 'http://localhost:4311',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/plot/, ''),
    configure: (proxy) => {
      const apiKey = env.PLOT_API_KEY
      if (apiKey) {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
        })
      }
    }
  }
}
```

### Environment Variables

**Required**:
- `PLOT_API_URL` - Backend base URL (e.g., `https://p-engine.example.com` or `http://localhost:4311`)
- `PLOT_API_KEY` - API key for `Authorization: Bearer` header (optional)

**Frontend calls**:
```typescript
fetch('/api/plot/v1/run', {...})
// Proxied to → ${PLOT_API_URL}/v1/run
```

### CORS Requirements

**If using proxy** (recommended):
- No CORS headers needed (proxy handles it)

**If direct calls** (not recommended):
- Backend must return: `Access-Control-Allow-Origin: http://localhost:5173`
- Allow headers: `Content-Type`, `Authorization`, `If-None-Match`, `Idempotency-Key`
- Allow methods: `GET`, `POST`, `OPTIONS`

---

## 7. Integration Checklist

For P Engine team to verify implementation:

### Must Have (Blocking)
- [ ] `POST /v1/run` returns `result.response_hash` (deterministic SHA-256)
- [ ] `POST /v1/run` returns `result.summary` (conservative, likely, optimistic)
- [ ] `POST /v1/run` returns `result.explain_delta.top_drivers` array
- [ ] `POST /v1/run` accepts API-shape graph (from/to, not source/target)
- [ ] `POST /v1/run` rejects graphs with `source`/`target`/`data` fields
- [ ] Error responses use consistent format (code, message, field?, max?, retry_after?)

### Should Have (High Priority)
- [ ] `GET /v1/limits` returns `{nodes: {max}, edges: {max}}`
- [ ] `POST /v1/validate` returns `{valid, violations}`
- [ ] `GET /v1/health` returns `{status, timestamp}`
- [ ] `GET /v1/templates` returns bare array (not wrapped object)
- [ ] `GET /v1/templates/{id}/graph` returns API-shape graph
- [ ] 429 responses include `Retry-After` header

### Nice to Have (Future)
- [ ] ETag support for `/v1/templates` and `/v1/limits`
- [ ] `Idempotency-Key` header support
- [ ] Debug slices (`result.debug.compare`, `result.debug.inspector`)
- [ ] SSE streaming (`POST /v1/run/stream`)
- [ ] Cancel endpoint (`POST /v1/run/{id}/cancel`)

---

## 8. Testing & Validation

### Frontend Test Coverage

**Completed**:
- ✅ Unit tests: 61 tests (mapper, reportNormalizer, limitsManager)
- ✅ Contract tests: MSW mocks for all v1 endpoints
- ✅ E2E tests: 66 tests (palette, snapshots, share links)

**Blocked**:
- ⏸️ Integration tests: Waiting for staging environment

### Backend Test Requests

**Can you provide**:
1. **OpenAPI/Swagger spec** for v1 endpoints?
2. **Postman collection** or example curl commands?
3. **Staging environment**:
   - URL (e.g., `https://staging.p-engine.example.com`)
   - API credentials (key or auth method)
   - CORS configuration (or confirm proxy recommended)
4. **Sample responses** for:
   - `POST /v1/run` (with `response_hash`)
   - `GET /v1/limits`
   - `POST /v1/validate`
   - Error responses (400, 413, 429, 500)

### Integration Test Plan

Once staging available:
1. Frontend sets `PLOT_API_URL` and `PLOT_API_KEY` env vars
2. Run manual tests against staging:
   - Create graph, run analysis, verify response
   - Test limits validation
   - Test error handling (400, 429, 500)
   - Verify `response_hash` determinism (same input → same hash)
3. Update MSW mocks to match real responses
4. Run full E2E test suite against staging
5. Document any schema mismatches

---

## 9. Summary of Action Items

### For P Engine Team (Backend)

**🚨 Must Fix (Blocking)**:
1. Add `response_hash` field to `/v1/run` response
2. Confirm `summary` and `explain_delta.top_drivers` are always present
3. Answer critical questions 1-4 (see section 5)

**⚠️ Should Implement (High Priority)**:
4. `GET /v1/limits` endpoint
5. `POST /v1/validate` endpoint
6. Consistent error format (code, message, field?, max?, retry_after?)
7. Answer important questions 5-8 (see section 5)

**💡 Nice to Have (Future)**:
8. ETag support for caching
9. `Retry-After` header on 429
10. `Idempotency-Key` support
11. Provide OpenAPI spec, staging environment, sample responses

### For Frontend Team (Next Steps)

**Immediate**:
1. Wait for P Engine to fix `response_hash` issue
2. Configure `PLOT_API_URL` and `PLOT_API_KEY` once staging available

**After Staging Available**:
3. Test against staging, document schema mismatches
4. Update MSW mocks to match real responses
5. Run E2E tests against staging

**Ongoing**:
6. Monitor console for integration errors
7. Update error handling if backend error format differs
8. Add telemetry for integration health monitoring

---

## 10. Appendix: File References

**Frontend Implementation**:
- `src/adapters/plot/httpV1Adapter.ts` - Main HTTP adapter
- `src/adapters/plot/v1/http.ts` - HTTP client with retry logic
- `src/adapters/plot/v1/types.ts` - V1 request/response types
- `src/adapters/plot/types.ts` - UI types (ReportV1, ErrorV1)
- `src/adapters/plot/v1/mapper.ts` - UI ↔ API shape conversion
- `src/adapters/plot/v1/limitsManager.ts` - Limits hydration
- `src/adapters/plot/v1/reportNormalizer.ts` - Response normalization
- `vite.config.ts` - Proxy configuration

**Documentation**:
- `docs/PLOT_V1_POLISH_FEATURES.md` - Feature documentation
- `docs/PLOT_V1_Integration.md` - Integration guide
- `PLOT_V1_INTEGRATION_STATUS.md` - Status tracking

**Tests**:
- `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts` - MSW contract tests
- `src/adapters/plot/v1/__tests__/mapper.test.ts` - Shape conversion tests
- `src/adapters/plot/v1/__tests__/reportNormalizer.test.ts` - Normalization tests
- `e2e/palette.spec.ts` - Command palette E2E tests

---

## Contact

**Frontend Team Lead**: @paulslee
**Branch**: `feat/command-palette`
**Last Updated**: 2025-11-01
**Next Review**: After P Engine team responds to questions

---

**End of Document**
