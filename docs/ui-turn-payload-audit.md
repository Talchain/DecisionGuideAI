# UI Orchestrator Turn Payload Audit

Date: 2026-03-15 (updated)
Scope: All data flows from UI to `/bff/orchestrate/v1/turn`

---

## 1. analysis_state fix

### Root cause

Two bugs combined to ensure CEE never received analysis data:

1. **Non-existent field read**: `useConversation.ts:1011` read `results.analysis` from `ResultsState`, but that field doesn't exist. The `as unknown` cast hid this from TypeScript — the value was always `undefined`.

2. **Allowlist exclusion**: `analysis_state` was only permitted on `explain` turns. Regular `conversation` turns (the most common post-analysis turn type) explicitly forbade it via boundary validation.

### Fix applied

- **Data source** (`useConversation.ts:1011`): Replaced broken `results.analysis` read with proper assembly from `resultsStore.results.status`, `.hash`, and `.analysisSummary`.
- **Staleness guard**: `analysis_state` is omitted when `store.graphEditedSinceLastRun === true` — stale results are not sent.
- **Turn types**: Added `analysis_state` as optional field on `ConversationTurnRequest`, `ExplicitGenerateTurnRequest`, `SystemEventTurnRequest`, and `PatchFollowupTurnRequest`.
- **Allowlists**: Added `'analysis_state'` to allowlists for all turn types that send `graph_state`.
- **Builders**: All 5 graph_state builders now accept and validate `analysis_state` via `isValidExplainAnalysisState()`.
- **Boundary validation**: Removed the "analysis_state forbidden on conversation" rule. Structural validation (requires `analysis_status`, `meta.response_hash`, `results`) now applies to all turn types.
- **Tests**: Updated 3 test files (turn-request-builder.test.ts, turnRequestShape.spec.ts, useConversation.hook.spec.ts).

### Payload shape sent

```json
{
  "analysis_state": {
    "analysis_status": "complete",
    "meta": { "response_hash": "<hash>" },
    "results": { /* AnalysisInputsSummary contract v1.0.0 */ }
  }
}
```

Included only when ALL conditions are met:
- `store.graphEditedSinceLastRun === false` (graph matches analyzed state)
- `resultsStore.results.status === 'complete'`
- `resultsStore.results.hash` is truthy
- `resultsStore.results.analysisSummary` is truthy

---

## 2. Staleness guard

**Status: Implemented in request gating.**

The canvas store tracks `graphEditedSinceLastRun`:
- **Set to `true`** in `pushToHistory()` (`store.ts:609`) — triggered by any structural graph mutation (node/edge add/update/remove)
- **Reset to `false`** on analysis completion (`store.ts:1742`, `1965`, `2121`, `2159`)
- **UI usage**: `ActionStrip.tsx:75` displays staleness warning

**Request gating** (`useConversation.ts:1013`): When `graphEditedSinceLastRun` is `true`, `analysisState` is set to `undefined` and omitted from all turn requests. This prevents stale analysis data from reaching CEE.

**Lifecycle**: Run analysis → `graphEditedSinceLastRun = false` → analysis_state sent on turns → user edits graph → `graphEditedSinceLastRun = true` → analysis_state omitted → user re-runs analysis → `graphEditedSinceLastRun = false` → analysis_state sent again.

**Test coverage**: `useConversation.hook.spec.ts` includes:
- Happy path: analysis_state present when analysis is complete and graph is fresh
- Stale guard: analysis_state omitted when graph has been edited since last analysis

---

## 3. Data flow audits

### 3a: graph_state

**Assembly**: `useConversation.ts:963-1009` (buildRequest function)

**Shape**:
```typescript
{
  nodes: Array<{
    id: string
    kind: 'decision' | 'event' | 'outcome' | 'goal' | 'option' | 'factor' | 'risk' | 'action'
    label: string
    category?: string
    prior?: object
    observed_state?: object  // renamed from camelCase observedState
    flagged_as_assumption?: boolean
    // ... other CEE-relevant fields pass through
  }>
  edges: Array<{
    from: string   // source node
    to: string     // target node
    strength: { mean: number, std?: number }  // signed: direction * weight
    exists_probability?: number  // [0, 1]
    effect_direction?: 'positive' | 'negative'
  }>
}
```

**Findings**:
- Always current (reads live from `useCanvasStore.getState()` at request time)
- React Flow internals stripped via `RF_NODE_BLOCKLIST` (20 fields blocked)
- `observedState` → `observed_state` rename at line 978
- Weight clamped to [0, 2] via `clamp01(weight/2) * 2`; direction sign applied
- Missing weight defaults to 0.5, missing direction defaults to positive
- No issues found in this data flow.

### 3b: conversation_history

**Assembly**: `buildHistory()` at `useConversation.ts:278-296`

**Shape**: `Array<{ role: 'user' | 'assistant', content: string }>`

**Findings**:
- Last 5 turn pairs (10 messages max), called at line 925
- Filters out: synthetic messages, non-conversation-origin entries, incomplete threads, non-fully-redacted entries
- Includes both user and assistant messages
- Does NOT include tool calls (they're embedded in block structures, not raw content)
- Truncation at 5 pairs is intentional. No issues found.

### 3c: system_event payloads

**Wire format**: Serialized via `serializeSystemEvent()` in `systemEvents.ts:66-84`

```typescript
{
  event_type: string     // CEE v3 wire discriminator
  timestamp: string      // ISO-8601
  event_id: string       // UUID
  details: object        // renamed from internal 'payload'
}
```

**Events dispatched**:

| Event | Trigger | Debounce | Payload |
|-------|---------|----------|---------|
| `direct_graph_edit` | Canvas mutation (structural) | 1500ms | `changed_node_ids`, `changed_edge_ids`, `operations`, `summary` |
| `patch_accepted` | User accepts patch | none | `patch_id`, `operations`, `applied_graph_hash?` |
| `patch_dismissed` | User rejects/dismisses | none | `patch_id`, `reason?` |
| `feedback_submitted` | Thumbs up/down | none | `turn_id`, `rating` |
| `direct_analysis_run` | User runs analysis | none | varies |

Pre-flight filter drops unknown event types. All 5 types above are in `CEE_V3_KNOWN_TYPES`.

No issues found — events are properly wired, serialized, and dispatched.

---

## 4. Unsafe cast audit

### CRITICAL BUG (fixed)

| Location | Cast | Bug? | Status |
|----------|------|------|--------|
| `useConversation.ts:1011` | `results.analysis as unknown` | YES — field doesn't exist | **Fixed** |

### Unsafe casts fixed (non-critical)

| Location | Cast | Status |
|----------|------|--------|
| `useConversation.ts:153` | `(store as any).showDraftChat` | **Fixed** — removed unnecessary cast, field exists on CanvasState |
| `useConversation.ts:897` | `-1 as unknown as number` | **Fixed** — removed nonsensical double-cast |

### Remaining casts in turn request path

| Location | Cast | Assessment |
|----------|------|------------|
| `useConversation.ts:968` | `(d as any).kind` | Safe — defensive fallback to `n.type ?? 'factor'` |
| `useConversation.ts:972` | `(d as any).label` | Safe — defensive fallback to `n.id` |
| `useConversation.ts:975` | `d as Record<string, unknown>` | Safe — `d` is `n.data ?? {}`, always object |
| `useConversation.ts:986` | `(e.data ?? {}) as Record<string, unknown>` | Safe — same pattern |
| `turn-request-builder.ts:152` | `value as Record<string, unknown>` in `hasGraphState` | Safe — guarded by typeof check |
| `turn-request-builder.ts:158` | `value as Record<string, unknown>` in `isValidExplainAnalysisState` | Safe — guarded by typeof check |

### Remaining casts in block normalization (follow-up recommended)

| Location | Cast | Assessment |
|----------|------|------------|
| `useConversation.ts:580,584` | `normOps as any`, `actions as any` | Hides ConversationBlock type mismatch for graph_patch operations/actions arrays |
| `useConversation.ts:599-601` | `fact_type/facts/lineage as any` | Hides fact block field typing |
| `useConversation.ts:608` | `citations as any` | Hides commentary citations typing |
| `useConversation.ts:617` | `priority as any` | Hides review_card priority typing |
| `useConversation.ts:638` | `as unknown as ConversationBlock` | Double-cast for unknown block types — highest risk |
| `useConversation.ts:1172` | `createEnrichmentFromV2Response(result) as any` | Should validate return type |

These are in the block normalization layer (adapting untyped backend responses to typed ConversationBlock union). They don't affect request construction but could mask schema drift in response handling. Recommend addressing in a dedicated block-typing cleanup.

---

## 5. Recommended follow-up fixes

1. **Block normalization typing**: Replace `as any` casts in block case-switch (`useConversation.ts:576-638`) with proper discriminated union narrowing. Medium priority — masks response schema drift.

2. **Increase conversation history depth**: 5 turn pairs may be too shallow for complex multi-turn conversations. Consider making this configurable or increasing to 10.

---

## Test results

- Typecheck: Clean
- turn-request-builder.test.ts: 27 tests passed (includes 7 new analysis_state tests)
- turnRequestShape.spec.ts: 48 tests passed (updated from old `has_results`/`last_run_hash` shape)
- useConversation.hook.spec.ts: Updated with happy-path and stale-guard regression tests
- Full related tests (`--changed`): 22+ files, 323+ tests passed
