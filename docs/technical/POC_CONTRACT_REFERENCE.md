# PoC Contract Reference

> **Purpose**: Single source of truth for the current PoC implementation contract.
> **Audience**: Testers, developers, and integrators.
> **Last Updated**: December 2025

This document clarifies the actual PoC contract as implemented, superseding any conflicting statements in older specifications.

---

## Request Contract

### Endpoint
```
POST /v2/run
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `graph` | `{ nodes[], edges[] }` | Causal graph structure |
| `options` | `{ id, label, interventions }[]` | Decision options with intervention bundles |
| `goal_node_id` | `string` | Target outcome node ID |
| `seed` | `string` | Random seed (e.g., `"42"`) |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `request_id` | `string` | auto-generated | UUID for request tracing |
| `detail_level` | `"quick" \| "standard" \| "deep"` | `"deep"` | Analysis depth |

### Request Example

```json
{
  "graph": {
    "nodes": [
      { "id": "factor_price", "kind": "factor", "label": "Price" },
      { "id": "outcome_revenue", "kind": "outcome", "label": "Revenue" }
    ],
    "edges": [
      { "from": "factor_price", "to": "outcome_revenue", "strength": { "mean": 0.8, "std": 0.1 }, "exists_probability": 0.9 }
    ]
  },
  "options": [
    {
      "id": "opt_low",
      "label": "Low Price Strategy",
      "interventions": { "factor_price": 80 }
    },
    {
      "id": "opt_high",
      "label": "High Price Strategy",
      "interventions": { "factor_price": 150 }
    }
  ],
  "goal_node_id": "outcome_revenue",
  "seed": "42",
  "detail_level": "deep",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Response Contract

### Success Response (HTTP 200)

| Field | Type | Description |
|-------|------|-------------|
| `analysis_status` | `"computed" \| "partial" \| "failed"` | Overall computation status |
| `options` | `V2OptionResult[]` | Per-option outcomes with p10/p50/p90 |
| `response_hash` | `string` | Determinism verification hash |
| `seed_used` | `string` | Echoed seed |
| `request_id` | `string` | Echoed from request |
| `critiques` | `V2Critique[]` | Warnings and info items |
| `drivers` | `V2Driver[]` | (optional) Key influence factors |
| `robustness` | `V2Robustness` | (optional) Model confidence |

### Success Example

```json
{
  "analysis_status": "computed",
  "option_comparison_status": "computed",
  "robustness_status": "computed",
  "drivers_status": "computed",
  "options": [
    {
      "id": "opt_low",
      "label": "Low Price Strategy",
      "outcome": { "mean": 50, "std": 10, "p10": 35, "p50": 50, "p90": 65 },
      "status": "computed"
    },
    {
      "id": "opt_high",
      "label": "High Price Strategy",
      "outcome": { "mean": 60, "std": 12, "p10": 42, "p50": 60, "p90": 78 },
      "status": "computed"
    }
  ],
  "drivers": [
    { "node_id": "factor_price", "label": "Price", "contribution": 0.85, "direction": "positive" }
  ],
  "robustness": { "level": "high", "confidence": 0.85 },
  "critiques": [],
  "response_hash": "abc123def456",
  "seed_used": "42",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Blocked Response (HTTP 422)

| Field | Type | Description |
|-------|------|-------------|
| `analysis_status` | `"blocked"` | Always `"blocked"` for 422 |
| `status_reason` | `string` | Human-readable explanation |
| `critiques` | `V2Critique[]` | Blocker details with codes |
| `request_id` | `string` | Echoed from request |

### Blocked Example

```json
{
  "analysis_status": "blocked",
  "status_reason": "Graph contains a cycle",
  "critiques": [
    {
      "code": "CYCLE_DETECTED",
      "severity": "blocker",
      "message": "Detected cycle: A -> B -> C -> A",
      "suggestion": "Remove one edge to break the cycle",
      "affected_nodes": ["A", "B", "C"]
    }
  ],
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## UI Behaviour

### Results Panel
- Displays per-option outcomes from a single run
- Users compare options visually within the Results tab
- Shows p10/p50/p90 bands for each option
- Displays top drivers (key influence factors)

### Compare Tab
- Compares **different analysis runs** (model iteration over time)
- NOT within-run option comparison
- Used for: "How do results differ after I changed an edge weight?"

### Trust Data
- `seed_used` and `response_hash` are available in the response
- Displayed in **RunHistory**, not the primary Results panel (PoC scope)
- Full trust footer with engine label is deferred to production

### Pre-Run Validation
- `usePreRunValidation` hook checks graph before running
- Run button disabled with reason when validation fails
- 422 errors from PLoT are displayed as critiques in error state

---

## Key Terminology

| Correct Term | Incorrect / Legacy | Notes |
|--------------|-------------------|-------|
| `goal_node_id` | `outcome_node` | Field name in request |
| `analysis_status` | `status` | Field name in response |
| `interventions: Record<string, number>` | `interventions: Record<string, object>` | Simple numbers in request |
| `seed: string` | `seed: number` | Sent as string `"42"` |
| `V2RunError` | `error.v1` envelope | 422 body is unwrapped |

---

## Request Tracing

Every V2 run includes a request ID for debugging:

1. **Generated**: UUID v4 created in `useV2Run` hook
2. **Sent**: In request body (`request_id`) AND header (`X-Request-Id`)
3. **Echoed**: PLoT returns the ID in response
4. **Logged**: Console output in development mode
5. **Stored**: Included with run results and errors

To trace a failed request:
1. Check browser console for `[useV2Run] Request ID: <uuid>`
2. Provide this ID to backend team for log correlation

---

## Intervention Format

CEE produces rich intervention metadata:
```typescript
// CEE output (internal)
{
  "factor_price": {
    value: 120,
    source: "brief_extraction",
    target_match: { node_id: "factor_price", match_type: "exact", confidence: 0.95 }
  }
}
```

UI flattens to simple numbers before sending:
```typescript
// /v2/run request (external)
{
  "factor_price": 120
}
```

This transformation happens in `uiOptionToV2Option()`.

---

## Node ID Normalisation

ISL V2 requires node IDs matching `^[a-z0-9_:-]+$`.

UI normalises IDs automatically:
- `Price` → `price`
- `Factor 1` → `factor_1`
- Collisions use `__2`, `__3` suffixes

Response IDs are translated back to UI IDs transparently.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial PoC contract reference |
