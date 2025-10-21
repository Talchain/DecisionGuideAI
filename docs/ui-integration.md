# PLoT UI Integration - Phase A

## Overview

Sync integration with PLoT `/v1/run` endpoint for deterministic decision analysis.

## Request/Response Shapes

### RunRequest
```typescript
{
  template_id?: string      // e.g., "pricing-v1"
  seed: number              // Determinism seed
  belief_mode?: 'strict' | 'as_provided'
  graph: {
    goalNodeId: string
    nodes: { id, kind, label }[]
    edges: { id, source, target, weight, belief }[]
  }
}
```

### RunResponse
```typescript
{
  schema: 'report.v1'
  meta: { seed, elapsed_ms, response_id, template_id? }
  summary: {
    bands: { p10, p50, p90 }
    confidence: { level, score, reason? }
  }
  critique: { type, text }[]
  model_card: { response_hash, response_hash_algo, normalized, determinism_note? }
}
```

## Error Taxonomy

| Code | User Message | Action |
|------|--------------|--------|
| BAD_INPUT | "Looks like {field} is invalid or missing." | Fix input |
| LIMIT_EXCEEDED | "This template exceeds the limit ({field}, max {max})." | Reduce size |
| RATE_LIMITED | "A bit busy. Try again in ~{retry_after}s." | Wait |
| UNAUTHORIZED | "Sign in again to continue." | Re-auth |
| SERVER_ERROR | "Something went wrong. Please try again." | Retry |

## Determinism Proof

Same template + seed → identical `response_hash`

Test: Run 5 times with same inputs, verify all hashes match.

## Limits Caching

- GET `/v1/limits` with `If-None-Match: {etag}`
- 304 response → use cached limits
- Client gates: ≤12 nodes, ≤20 edges

## Feature Flags

- `VITE_UI_STREAM_CANARY=1` - Enable SSE canary view (hidden)
- `VITE_PLOT_API_BASE_URL` - API base URL
