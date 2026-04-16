# UI Data Mutation Audit v1

**Date:** 20 March 2026
**Scope:** All semantic transforms in the DecisionGuideAI UI — tagged (UI-SEM-001–034) and undocumented.
**Method:** Static analysis of source code. Read-only — no code changes.

---

## Table of Contents

1. [Known UI-SEM Transforms](#1-known-ui-sem-transforms)
2. [Analysis Request Construction](#2-analysis-request-construction)
3. [Graph State Management](#3-graph-state-management)
4. [Results Display Transforms](#4-results-display-transforms)
5. [Edge and Node Display](#5-edge-and-node-display)
6. [Staleness and Invalidation](#6-staleness-and-invalidation)
7. [Undocumented Transforms](#7-undocumented-transforms)
8. [Summary Table](#8-summary-table)

---

## 1. Known UI-SEM Transforms

34 transforms tagged in the codebase. 31 active, 3 removed.

### 1.1 UI-SEM-001: Signed Mean from Direction + Weight

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/v2/adapter.ts:561–588` |
| **Status** | Active |
| **Direction** | Outbound (canvas → PLoT) |
| **Affects inference?** | Yes — determines strength.mean in V2 request |

**Expected:** UI passes strength values as-is.
**Actual:** Canvas stores unsigned `weight` (0–2) + `direction` ('positive'/'negative'). Adapter computes `sign * magnitude`, clamps to [-1, +1] via `clampStrength()`. Adjustments logged to `strengthCorrections` array.
**Classification:** Format conversion — legitimate. Canvas format (unsigned + direction) differs from wire format (signed mean). This is the adapter's job.
**Double-application risk:** None. One-way outbound; PLoT receives signed value and operates on it directly.

### 1.2 UI-SEM-002: Observed State Default Injection (std/baseline)

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/v2/adapter.ts:301–362` |
| **Status** | Active |
| **Direction** | Outbound (canvas → PLoT) |
| **Affects inference?** | Yes — provides std/baseline for nodes where CEE omitted them |

**Expected:** UI passes observed_state as received from CEE.
**Actual:** `extractObservedState()` spreads all CEE fields first (preserves V3 pass-through: `raw_value`, `cap`, `factor_type`, `uncertainty_drivers`, `extractionType`), then overlays computed `std` and `baseline` only when CEE omitted them.

Computation:
- `baseline` = `observedState.baseline ?? value`
- `delta = |value - baseline|`
- `std = max(STD_FLOOR, delta > 0 ? delta * 0.25 : |value| * 0.01)`
- Ceiling: `std = min(rawStd, |value| * 0.5, STD_CEILING_ABS=10)`

**Classification:** Adapter concern — legitimate. PLoT requires std for inference; CEE does not always provide it.
**Double-application risk:** None. Spread-first pattern means CEE-provided values take precedence.

### 1.3 UI-SEM-003: STD Floor Enforcement

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/v2/adapter.ts:323, 618, 669` |
| **Status** | Active |
| **Direction** | Outbound (canvas → PLoT) |
| **Affects inference?** | Yes — prevents zero-variance crash |

**Expected:** UI passes std as-is.
**Actual:** `Math.max(STD_FLOOR, std)` applied in 3 locations: `extractObservedState()` (line 323), `transformEdgeToV2()` (line 618), `transformEdgeToV2Strict()` (line 669). `STD_FLOOR` imported from `@talchain/schemas`.
**Classification:** Adapter concern — legitimate. Zero-variance crashes PLoT's numerical solver.

### 1.4 UI-SEM-004: Risk→Goal Sign Heuristic

| Field | Value |
|-------|-------|
| **File** | `src/canvas/adapters/islRequestAdapter.ts:648–684` |
| **Status** | Active |
| **Direction** | Outbound (canvas → ISL) |
| **Affects inference?** | Yes — auto-negates coefficient for risk→goal edges as last-resort |

**Expected:** Signed strength_mean should be canonical source of truth.
**Actual:** 3-level priority: (1) signed strength_mean, (2) effect_direction, (3) risk→goal heuristic with warning. Only triggers when coefficient is positive and no explicit direction exists.
**Classification:** Adapter concern — legitimate last-resort fallback. Logs warning when triggered.

### 1.5 UI-SEM-005: Robustness Level Derivation

| Field | Value |
|-------|-------|
| **File** | `src/components/results/useResultsSectionData.ts:1046–1082` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No — display only |

**Expected:** PLoT provides robustness.level.
**Actual:** When PLoT omits `level`, derives from `recommendation_stability`: ≥0.8→high, ≥0.5→moderate, ≥0.3→low, <0.3→very_low. Dev-only logging when fallback activates.
**Classification:** Defensive fallback — documented debt. Remove when PLoT guarantees level on all responses.

### 1.6 UI-SEM-006: DecisionState Thresholds

| Field | Value |
|-------|-------|
| **File** | `src/components/results/buildResultsVM.ts:30–113` |
| **Status** | Active |
| **Direction** | Display derivation |
| **Affects inference?** | No |

**Expected:** PLoT provides decision classification.
**Actual:** `deriveDecisionState()` maps gap + stability to robust/sensitive/indeterminate using GAP=0.10, ROBUST=0.80, SENSITIVE=0.55. Gap rule evaluated first.
**Classification:** VM-layer display derivation — legitimate. Thresholds are display-specific.

### 1.7 UI-SEM-007: Stability Fabrication — REMOVED

| Field | Value |
|-------|-------|
| **File** | `src/components/results/buildResultsVM.ts:40–42` (comment only) |
| **Status** | **Removed** (Audit F-56) |

Previously fabricated numeric stability from categorical robustness level. Now `resolveStability()` returns null when numeric stability absent.

### 1.8 UI-SEM-008: Probability Cap at 99%

| Field | Value |
|-------|-------|
| **File** | `src/lib/format.ts:61–131` |
| **Status** | Active |
| **Direction** | Display formatting |
| **Affects inference?** | No |

**Actual:** `Math.min(value, 0.99)` applied in 3 locations (lines 72, 80, 128). Only caps 0–1 probabilities, NOT outcome values (which can exceed 100%).
**Classification:** Display formatting — legitimate. Prevents misleading "100%" display.

### 1.9 UI-SEM-009: p15/p85 Confidence Band Fabrication — REMOVED

| Field | Value |
|-------|-------|
| **Status** | **Removed** (Audit F-55) |

Previously interpolated p15/p85 from p10/p50/p90. Now uses p10–p90 band directly.

### 1.10 UI-SEM-010: Constraint Confidence Colour Thresholds

| Field | Value |
|-------|-------|
| **File** | `src/types/constraints.ts:38–46` |
| **Status** | Active |
| **Direction** | Display formatting |
| **Affects inference?** | No |

Maps constraint satisfaction probability to colour: ≥0.70→success, 0.40–0.69→info, <0.40→danger.

### 1.11 UI-SEM-011 & UI-SEM-030: Default Belief Injection for CEE Coaching

| Field | Value |
|-------|-------|
| **File** | `src/canvas/hooks/useGraphReadiness.ts:370–386` |
| **Status** | Active |
| **Direction** | Outbound (canvas → CEE coaching) |
| **Affects PLoT inference?** | No — coaching request only |

Injects default edge values (weight 0.5, belief 0.7, direction 'positive') for CEE graph-readiness coaching. Not used for PLoT analysis requests.

### 1.12 UI-SEM-012: Edge Severity from Switch Probability

| Field | Value |
|-------|-------|
| **File** | `src/components/results/useResultsSectionData.ts:1957–1959` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No |

Thresholds: >0.7→critical, >0.5→error. Remove when PLoT provides severity field.

### 1.13 UI-SEM-013: Fragile Edge Filter Threshold

| Field | Value |
|-------|-------|
| **Files** | `src/components/results/useResultsSectionData.ts:1674`, `src/canvas/utils/fragileEdgeMatch.ts:6` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No — visibility filter only |

Filters fragile edges to show only those with switch_probability > 0.3. Centralised in `fragileEdgeMatch.ts` for reuse across StyledEdge, context menu, lens filter.

### 1.14 UI-SEM-014: VOI Evidence Threshold

| Field | Value |
|-------|-------|
| **File** | `src/components/results/DriversSection.tsx:228–230` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No |

Shows VOI hint only when `valueOfInformation > 0.05`.

### 1.15 UI-SEM-015: Confidence Tier Score-Based Fallback

| Field | Value |
|-------|-------|
| **File** | `src/components/results/useResultsSectionData.ts:586–593` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No |

Fallback when PLoT omits readiness_level: readiness_score ≥70→strong, ≥40→fair, <40→needs_work.

### 1.16 UI-SEM-016: Robustness Label from Numeric Score

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/enrichment.ts:278–287` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No |

Derives label: ≥0.7→robust, ≥0.4→moderate, <0.4→fragile. Remove when PLoT provides label.

### 1.17 UI-SEM-017: Confidence Level from Numeric Score (V1)

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/httpV1Adapter.ts:87–94` |
| **Status** | Active |
| **Direction** | Inbound (PLoT V1 → display) |
| **Affects inference?** | No |

V1-specific: ≥0.7→high, ≥0.4→medium, <0.4→low.

### 1.18 UI-SEM-018: Confidence Score Fabrication — REMOVED

| Field | Value |
|-------|-------|
| **Status** | **Removed** (Audit F-57) |

Previously fabricated numeric scores (high=0.8, medium=0.5, low=0.3) from categorical labels.

### 1.19 UI-SEM-019: Readiness/Confidence Taxonomy Mapping

| Field | Value |
|-------|-------|
| **File** | `src/components/results/useResultsSectionData.ts:544–571` |
| **Status** | Active |
| **Direction** | Inbound (PLoT → display) |
| **Affects inference?** | No |

Normalises PLoT's varied labels (ready/caution/not_ready, high/medium/low) to canonical strong/fair/needs_work.

### 1.20 UI-SEM-020: Stage Derivation from Canvas State

| Field | Value |
|-------|-------|
| **File** | `src/canvas/hooks/useStagePill.ts` |
| **Status** | Active |
| **Direction** | Display fallback |
| **Affects inference?** | No |

Fallback for first render before CEE envelope: no nodes→frame, nodes exist→ideate, complete→evaluate.

### 1.21 UI-SEM-021: Coaching Copy Suppression

| Field | Value |
|-------|-------|
| **File** | `src/components/results/HeroSection.tsx:267–275` |
| **Status** | Active |
| **Direction** | Inbound (CEE/PLoT → display) |
| **Affects inference?** | No |

Suppresses coaching text containing "robust"/"ready to proceed" when robustness is low/very_low. Prevents contradictory executive messaging.

### 1.22 UI-SEM-022: Direction Inference from Signed Weight

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/DraftChat.tsx:506–508` |
| **Status** | Active |
| **Direction** | Inbound (CEE → canvas store) |
| **Affects inference?** | Yes — stored direction affects signed mean computation |

Infers `direction` from `rawWeight < 0` when CEE omits `effect_direction`. Dev-only warning when triggered.

### 1.23 UI-SEM-023: Weight Magnitude Clamped to [0, 2]

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/DraftChat.tsx:520–522` |
| **Status** | Active |
| **Direction** | Inbound (CEE → canvas store) |
| **Affects inference?** | Yes — stored weight used by V2 adapter |

`Math.max(0, Math.min(2, Math.abs(rawWeight)))`. Stores unsigned magnitude.

### 1.24 UI-SEM-024: Belief Confidence Clamped to [0, 1]

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/DraftChat.tsx:545–548` |
| **Status** | Active |
| **Direction** | Inbound (CEE → canvas store) |
| **Affects inference?** | Yes — stored belief used by V2 adapter |

### 1.25 UI-SEM-025: belief_exists Clamped to [0, 1]

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/DraftChat.tsx:557–560` |
| **Status** | Active |
| **Direction** | Inbound (CEE → canvas store) |
| **Affects inference?** | Yes — stored beliefExists used by V2 adapter |

### 1.26 UI-SEM-026: CEE Edge Weight Clamped to [0, 1]

| Field | Value |
|-------|-------|
| **File** | `src/adapters/cee/client.ts:251–255` |
| **Status** | Active |
| **Direction** | Inbound (CEE → canvas store) |
| **Affects inference?** | Yes (via downstream storage) |

CIL 0.2: rejects NaN/Infinity, clamps to [0, 1].

### 1.27 UI-SEM-027: CEE Edge Belief Clamped to [0, 1]

| Field | Value |
|-------|-------|
| **File** | `src/adapters/cee/client.ts:257–261` |
| **Status** | Active |

### 1.28 UI-SEM-028: CEE belief_exists Clamped to [0, 1]

| Field | Value |
|-------|-------|
| **File** | `src/adapters/cee/client.ts:303–307` |
| **Status** | Active |

### 1.29 UI-SEM-029: Edge Weight/Direction Display Defaults

| Field | Value |
|-------|-------|
| **File** | `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:143–149` |
| **Status** | Active |
| **Direction** | Display only |
| **Affects inference?** | No |

Defaults: weight 0.5, direction 'positive'. Display fallback when edge data missing.

### 1.30 UI-SEM-031: Default exists_probability for Std Computation

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/v2/adapter.ts:597–604` |
| **Status** | Active |
| **Direction** | Outbound (canvas → PLoT) |
| **Affects inference?** | Yes — provides edge std when belief missing |

`belief = beliefExists ?? confidence ?? belief ?? DEFAULT_EXISTS_PROBABILITY (0.8)`. Then `cv = 0.3 * (1 - belief) + 0.1; std = max(STD_FLOOR, cv * magnitude)`.

### 1.31 UI-SEM-032: Default exists_probability (ISL Adapter)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/adapters/islRequestAdapter.ts:169` |
| **Status** | Active |
| **Direction** | Outbound (canvas → ISL) |
| **Affects inference?** | Yes |

Mirror of UI-SEM-031 in ISL adapter path.

### 1.32 UI-SEM-033: Edge Display Defaults (ModelTabBody)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/ModelTabBody.tsx:683` |
| **Status** | Active |
| **Direction** | Display only |
| **Affects inference?** | No |

Defaults: weight 0.5, direction 'positive', belief 0.7.

### 1.33 UI-SEM-034: V1 Adapter Belief Clamping

| Field | Value |
|-------|-------|
| **File** | `src/adapters/plot/v1/mapper.ts:207` |
| **Status** | Active |
| **Direction** | Inbound (PLoT V1 → display) |
| **Affects inference?** | No |

---

## 2. Analysis Request Construction

### 2.1 Entry Point

**Trigger:** User clicks Play → `handleRunAnalysis()` in OutputsDock → `runV2Analysis()` in `useV2Run` hook → `executeV2RunWithAnalysisReady()`.

### 2.2 Request Building Flow

`buildV2RequestFromAnalysisReady()` at `src/adapters/plot/v2/adapter.ts:792–887`:

1. **Nodes** → `transformNodeToV2()` (line 821): Blocklist approach — excludes RF internals and UI-only fields via `V2_NODE_BLOCKLIST` (line 371–384). All other fields pass through via spread. `observedState` (camelCase) → `observed_state` (snake_case). V3 fields survive.

2. **Edges** → `transformEdgeToV2()` (line 824): Computes signed `strength.mean` (UI-SEM-001), computes default `std` (UI-SEM-002/003/031), resolves `exists_probability`.

3. **Options** → `ceeOptionToV2Option()` (line 827): Flattens nested intervention values (`{ value: number }` → `number`). Validates intervention targets against `validNodeIds`. Skips self-targeting interventions.

4. **ID normalisation** → `normaliseGraphIds()` (line 841): Normalises all IDs coherently (nodes, edges, options, goal_node_id) for ISL V2 constraint (`^[a-z0-9_:-]+$`).

5. **Final request** (lines 860–884):
   - `graph`, `options`, `goal_node_id`, `seed`, `detail_level: 'deep'`
   - Optional: `brief`, `goal_threshold` (normalised 0–1, from CEE), `goal_constraints`
   - XOR enforcement: constraints present → `goal_threshold` deleted (line 879–884)

### 2.3 Goal Node ID

Source: `analysisReady.goal_node_id` (CEE provides). Fallback: `outcomeNodeId` from canvas store.

### 2.4 Goal Threshold

Source: `analysisReady.goal_threshold` (normalised 0–1, from CEE). No UI transform. Deleted when `goal_constraints` are present (PLoT contract §3.3.5).

### 2.5 Goal Constraints

Source: CEE response root (not analysis_ready). Forwarded as-is when present.

### 2.6 Transforms in Request Path

| Transform | Location | Effect | Classification |
|-----------|----------|--------|----------------|
| Unsigned weight + direction → signed mean | adapter.ts:561–588 | strength.mean in [-1, +1] | UI-SEM-001 — format conversion |
| Default std/baseline when CEE omits | adapter.ts:311–362 | Computed std/baseline for PLoT | UI-SEM-002 — adapter concern |
| STD floor enforcement | adapter.ts:323, 618, 669 | std ≥ STD_FLOOR | UI-SEM-003 — prevents crash |
| Default exists_probability for edge std | adapter.ts:597–604 | Assume 0.8 when belief missing | UI-SEM-031 — adapter concern |
| ID normalisation | nodeIdNormalisation.ts | Regex-safe IDs for ISL | Format conversion |
| Intervention value flattening | adapter.ts:131–145 | `{ value: N }` → `N` | Format conversion |
| XOR goal_threshold vs constraints | adapter.ts:879–884 | Deletes threshold when constraints present | Contract enforcement |

**Risk:** All transforms are format conversions or documented adapter concerns. No undocumented semantic transforms in the V2 request path.

---

## 3. Graph State Management

### 3.1 Canonical Store

**Location:** `src/canvas/store.ts` — Zustand store.

Key fields: `nodes`, `edges`, `outcomeNodeId`, `goalThreshold`, `goalConstraints`, `ceeAnalysisReady`, `results`, `runMeta`.

### 3.2 CEE Draft Ingestion (DraftChat)

**File:** `src/canvas/components/DraftChat.tsx`

When CEE returns a draft graph, DraftChat applies these transforms before storing:

| Transform | Line | Tag | Effect |
|-----------|------|-----|--------|
| `observed_state` → `observedState` | 448–468 | — | Snake→camelCase mapping |
| Direction inference from signed weight | 506–508 | UI-SEM-022 | Infers direction when CEE omits |
| Weight magnitude clamp [0, 2] | 520–522 | UI-SEM-023 | Stores unsigned magnitude |
| Belief confidence clamp [0, 1] | 545–548 | UI-SEM-024 | Normalises range |
| belief_exists clamp [0, 1] | 557–560 | UI-SEM-025 | Normalises range |

Weight source resolution priority: `strength.mean` > `strength_mean` (flat) > `weight` (legacy) > default 0.5.

### 3.3 CEE Client Normalisation

**File:** `src/adapters/cee/client.ts:245–307`

Pre-storage normalisation of CEE draft response edges:

| Transform | Line | Tag | Effect |
|-----------|------|-----|--------|
| Weight clamp [0, 1] + NaN rejection | 251–255 | UI-SEM-026 | CIL 0.2 |
| Belief clamp [0, 1] + NaN rejection | 257–261 | UI-SEM-027 | CIL 0.2 |
| belief_exists clamp [0, 1] | 303–307 | UI-SEM-028 | CIL 0.2 |

### 3.4 Direct User Edits

`updateNode()` and `updateEdge()` in store.ts call `pushToHistory()`, which marks graph as modified. No semantic transforms applied to user input values.

### 3.5 Patch Application

**File:** `src/canvas/conversation/utils/applyPatch.ts`

Orchestrator patches applied directly — no semantic transforms. Uses `beginExternalGraphMutation()` / `endExternalGraphMutation()` to batch updates and suppress intermediate history entries.

### 3.6 Hydration

No standalone hydration step. Defaults are applied at adapter boundaries (DraftChat for CEE ingestion, V2 adapter for PLoT requests) rather than on stored state.

---

## 4. Results Display Transforms

### 4.1 Probability Formatting

**File:** `src/lib/format.ts`

- UI-SEM-008: Probability capped at 99% (lines 72, 80, 128). Display-only.
- Auto-detect: 0–1 range values → multiplied by 100 for percentage display.
- 5 formatting functions: `formatOutcomeValue()`, `formatOutcomeValueCompact()`, `formatPercent()`, `formatConfidence()`, `formatConfidencePercent()`.
- All formatting is display-only — stored values unchanged.

### 4.2 Robustness Level

- UI-SEM-005 (`useResultsSectionData.ts:1046–1082`): Derives level from stability when PLoT omits.
- UI-SEM-016 (`enrichment.ts:278–287`): Derives label from numeric score.
- UI-SEM-006 (`buildResultsVM.ts:98–113`): Derives DecisionState from gap + stability.

### 4.3 Confidence Tier

- UI-SEM-019 (`useResultsSectionData.ts:544–571`): Normalises PLoT's varied labels.
- UI-SEM-015 (`useResultsSectionData.ts:586–593`): Score-based fallback (≥70→strong, ≥40→fair).
- UI-SEM-017 (`httpV1Adapter.ts:87–94`): V1-specific confidence mapping.

### 4.4 ID Translation

`translateResponseToUIIds()` from `src/utils/nodeIdNormalisation.ts` — converts normalised V2 response IDs back to original canvas IDs. Still in use. Applied after V2 response to restore canvas ID scheme before storing.

### 4.5 Sensitivity Display

No modification to raw sensitivity scores. Edge severity is derived from switch_probability (UI-SEM-012) for display classification only.

### 4.6 Coaching Copy

UI-SEM-021 (`HeroSection.tsx:267–275`): Suppresses coaching text containing "robust"/"ready to proceed" when robustness is low/very_low. Display filtering only.

---

## 5. Edge and Node Display

### 5.1 Edge Strength on Canvas

**File:** `src/canvas/edges/StyledEdge.tsx`

**Pre-run:** Stroke width encodes raw weight magnitude via `weightMagnitudeToStrokeWidth()`. `weight = edgeData?.weight ?? 1.0`.

**Post-run (results mode):** Stroke width encodes **importance** = `belief × strength × goalSensitivity`, mapped to 1–8px via `importanceToStrokeWidth()`. All raw values passed through unchanged; only visual encoding changes.

### 5.2 Edge Confidence

**File:** `src/canvas/domain/edges.ts`

`getEdgeConfidence()` returns `beliefExists` first, falls back to legacy `belief`. `formatConfidence()` converts to percentage: `Math.round(confidence * 100) + "%"`. Display-only.

### 5.3 Node Values

`data.observedState.value` (normalised) used for computations. `data.observedState.raw_value` (user's original units) available for display via `useNodeDisplayMetadata()`. External factors use `node.data.prior.range_min/max` instead of value/baseline.

### 5.4 Cap Field

`data.cap` is a CEE pass-through — preserved by V2 adapter's spread pattern. Used for display bounds but NOT for re-normalisation in the UI.

### 5.5 Colour Encodings

| Condition | Colour |
|-----------|--------|
| direction = 'positive' | var(--success) (green) |
| direction = 'negative' | var(--danger) (red) |
| No direction + no weight | var(--goal) (yellow) |
| No direction + weight defined | Grey |

### 5.6 Thickness Encodings

| Mode | Encoding |
|------|----------|
| Pre-run | Raw weight magnitude → stroke width |
| Post-run | Importance (belief × strength × goalSensitivity) → 1–8px |

---

## 6. Staleness and Invalidation

### 6.1 Hash-Based Detection

**File:** `src/canvas/ui/inspector-v2/useStaleGuard.ts:10–25`

Compares `_internal.graphHash` against `results.graphHash`. Returns: `none` (no results), `stale` (hashes differ), `current` (hashes match).

### 6.2 Graph Hash Computation

**File:** `src/canvas/utils/graphHash.ts:19–37`

`generateGraphHash()`: Deterministic hash of node IDs, types, labels, probability, confidence + edge keys, confidence, weight, belief. Sorted for stability.

`generateStructuralHash()`: Lighter — only node/edge IDs, no data fields.

### 6.3 Event-Based Detection

**File:** `src/hooks/useScenario.ts`

JSON serialisation comparison of `{nodes, edges}`. When `resultsStatus === 'complete'` and graph changed → `setAnalysisStale(true)`.

### 6.4 What Triggers Staleness

Any mutation via `updateNode()` or `updateEdge()` → `pushToHistory()` → graph hash changes → staleness detected on next comparison.

Specific triggers: adding/removing nodes or edges, editing node values, editing edge weights/beliefs, accepting patches.

### 6.5 Visibility

**File:** `src/canvas/ui/inspector-v2/shared/StaleGuardBanner.tsx`

Warning banner displayed when `isStale === true`. Results are NOT hidden — shown with coaching to re-run analysis. User must re-run to refresh.

---

## 7. Undocumented Transforms

### 7.1 applyDraftResult.ts — Duplicate Clamping (UNTAGGED)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/utils/applyDraftResult.ts:74–82` |
| **Classification** | State mutation — duplicates UI-SEM-023/024/025 |
| **Risk** | LOW — same clamping logic, but untagged |

```typescript
const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))  // line 74
const confidence = Math.max(0, Math.min(1, e.belief))          // line 77
const beliefExists = Math.max(0, Math.min(1, e.belief_exists)) // line 81
```

This file applies the same clamping as DraftChat (UI-SEM-023/024/025) but without UI-SEM tags. Used by `useRetryDraft` and `applyPatch` — an alternate ingestion path for CEE draft responses.

**Recommendation:** Tag as UI-SEM-023b/024b/025b or consolidate with DraftChat path.

### 7.2 useConversation.ts — Weight Division-Clamp-Multiply (UNTAGGED)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/conversation/useConversation.ts:1086` |
| **Classification** | State mutation — outbound to CEE |
| **Risk** | MEDIUM — unclear rationale, affects CEE graph state payload |

```typescript
const weight = typeof weightValue === 'number' ? clamp01(weightValue / 2) * 2 : 0.5
```

Canvas weight is 0–2. This divides by 2 (→ 0–1), clamps to [0, 1], then multiplies by 2 (→ 0–2). Effectively clamps weight to [0, 2]. The signed mean is then computed as `direction * weight` (line 1088), which means the final `strength.mean` sent to CEE can be [-2, +2] — different from the [-1, +1] range used by the V2 adapter (UI-SEM-001).

This is part of the `buildGraphStatePayload()` function that constructs graph state for CEE turn requests. The CEE edge schema allows wider ranges than ISL/PLoT.

**Recommendation:** Tag as UI-SEM-035. Document the different clamping ranges between CEE path ([-2, +2]) and PLoT path ([-1, +1]).

### 7.3 ceeSynthesisAdapter.ts — Robustness Score Default (UNTAGGED)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/adapters/ceeSynthesisAdapter.ts:75–81` |
| **Classification** | State mutation — outbound to CEE |
| **Risk** | LOW — CEE uses for synthesis context, not inference |

```typescript
function robustnessLabelToScore(label: string): number {
  const scoreMap = { robust: 0.9, moderate: 0.5, fragile: 0.2 }
  return scoreMap[label.toLowerCase()] ?? 0.5  // default 0.5
}
```

Maps robustness label to numeric score for CEE synthesis request. Default 0.5 when label is unknown.

**Recommendation:** Tag as UI-SEM-036. Low risk — CEE uses for context, not numerical inference.

### 7.4 islRobustnessAdapter.ts — Sensitive Parameter Defaults (UNTAGGED)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/adapters/islRobustnessAdapter.ts:171–178` |
| **Classification** | Display formatting |
| **Risk** | LOW — inbound from ISL, display only |

```typescript
current_value: raw.current_value ?? raw.value ?? 0.5,
flip_threshold: raw.flip_threshold ?? raw.threshold ?? 0.5,
sensitivity: raw.sensitivity ?? raw.magnitude ?? 0.5,
```

Defaults ISL robustness response fields for display when ISL omits them.

**Recommendation:** Tag as UI-SEM-037. Display-only — low risk.

### 7.5 ModelTabBody.tsx — Edge Sorting Defaults (UNTAGGED)

| Field | Value |
|-------|-------|
| **File** | `src/canvas/components/ModelTabBody.tsx:264–269` |
| **Classification** | Display formatting |
| **Risk** | LOW — affects sort order only |

```typescript
const aConf = aData?.beliefExists ?? aData?.exists_probability ?? aData?.confidence ?? 0.7
const bConf = bData?.beliefExists ?? bData?.exists_probability ?? bData?.confidence ?? 0.7
const aWeight = aData?.weight ?? 0.5
const bWeight = bData?.weight ?? 0.5
```

Defaults used for edge sorting in Model tab. Display-only.

### 7.6 Display Threshold Occurrences (UNTAGGED, 20+)

Multiple files contain hardcoded display thresholds without UI-SEM tags:

| File | Thresholds | Purpose |
|------|-----------|---------|
| `EdgePanel.tsx:103–106` | 0.7/0.4 | Confidence colour (green/yellow/red) |
| `UnifiedStatusBadge.tsx:56–58` | 0.7/0.4 | Status tier derivation |
| `strengthBands.ts:70–71` | 0.7/0.5 | Confidence band labels |
| `labelUtils.ts:37–56` | 0.7/0.4 | Sensitivity/evidence tier labels |
| `modelCardAdapter.ts:185–186` | 0.7/0.4 | Robustness label from stability |
| `ScoreChip.tsx:48–83` | Various | Colour + label from numeric score |

All are display-only formatting. Risk: LOW — no inference impact.

**Recommendation:** Consider consolidating threshold constants and tagging as a group (UI-SEM-038: Display threshold family).

---

## 8. Summary Table

### 8.1 All Tagged Transforms

| ID | File | Status | Direction | Affects Inference? | Classification |
|----|------|--------|-----------|-------------------|----------------|
| UI-SEM-001 | v2/adapter.ts:561 | Active | Outbound | Yes | Format conversion — keep |
| UI-SEM-002 | v2/adapter.ts:301 | Active | Outbound | Yes | Adapter concern — keep |
| UI-SEM-003 | v2/adapter.ts:323 | Active | Outbound | Yes | Safety floor — keep |
| UI-SEM-004 | islRequestAdapter.ts:648 | Active | Outbound | Yes | Fallback heuristic — keep |
| UI-SEM-005 | useResultsSectionData.ts:1046 | Active | Inbound | No | Defensive fallback — remove when PLoT guarantees |
| UI-SEM-006 | buildResultsVM.ts:84 | Active | Display | No | VM-layer display — keep |
| UI-SEM-007 | buildResultsVM.ts:40 | **Removed** | — | — | F.6 violation (Audit F-56) |
| UI-SEM-008 | format.ts:61 | Active | Display | No | Display formatting — keep |
| UI-SEM-009 | DecisionSummary.tsx | **Removed** | — | — | F.6 violation (Audit F-55) |
| UI-SEM-010 | constraints.ts:38 | Active | Display | No | Display formatting — keep |
| UI-SEM-011 | useGraphReadiness.ts:371 | Active | Outbound (CEE coaching) | No (coaching only) | Pre-analysis default — keep |
| UI-SEM-012 | useResultsSectionData.ts:1957 | Active | Inbound | No | Defensive fallback — remove when PLoT provides |
| UI-SEM-013 | useResultsSectionData.ts:1674 | Active | Inbound | No | Visibility filter — remove when PLoT provides |
| UI-SEM-014 | DriversSection.tsx:228 | Active | Inbound | No | Visibility gate — remove when PLoT provides |
| UI-SEM-015 | useResultsSectionData.ts:586 | Active | Inbound | No | Score fallback — remove when PLoT provides |
| UI-SEM-016 | enrichment.ts:278 | Active | Inbound | No | Label fallback — remove when PLoT provides |
| UI-SEM-017 | httpV1Adapter.ts:87 | Active | Inbound | No | V1 fallback — remove when PLoT provides |
| UI-SEM-018 | UnifiedStatusBadge.tsx | **Removed** | — | — | F.6 violation (Audit F-57) |
| UI-SEM-019 | useResultsSectionData.ts:544 | Active | Inbound | No | Taxonomy mapping — remove when PLoT provides |
| UI-SEM-020 | useStagePill.ts | Active | Display | No | Stage fallback — remove when orchestrator provides |
| UI-SEM-021 | HeroSection.tsx:267 | Active | Inbound | No | Copy suppression — remove when PLoT provides |
| UI-SEM-022 | DraftChat.tsx:506 | Active | Inbound (stored) | Yes | Direction inference — remove when CEE guarantees |
| UI-SEM-023 | DraftChat.tsx:520 | Active | Inbound (stored) | Yes | Normalisation — keep |
| UI-SEM-024 | DraftChat.tsx:545 | Active | Inbound (stored) | Yes | Normalisation — keep |
| UI-SEM-025 | DraftChat.tsx:557 | Active | Inbound (stored) | Yes | Normalisation — keep |
| UI-SEM-026 | cee/client.ts:251 | Active | Inbound (stored) | Yes | Normalisation (CIL 0.2) — keep |
| UI-SEM-027 | cee/client.ts:257 | Active | Inbound (stored) | Yes | Normalisation (CIL 0.2) — keep |
| UI-SEM-028 | cee/client.ts:303 | Active | Inbound (stored) | Yes | Normalisation (CIL 0.2) — keep |
| UI-SEM-029 | EdgePanel.tsx:143 | Active | Display | No | Display fallback — keep |
| UI-SEM-030 | useGraphReadiness.ts:381 | Active | Outbound (CEE coaching) | No (coaching only) | Pre-analysis default — keep |
| UI-SEM-031 | v2/adapter.ts:597 | Active | Outbound | Yes | Adapter concern — keep |
| UI-SEM-032 | islRequestAdapter.ts:169 | Active | Outbound | Yes | Adapter concern — keep |
| UI-SEM-033 | ModelTabBody.tsx:683 | Active | Display | No | Display fallback — keep |
| UI-SEM-034 | v1/mapper.ts:207 | Active | Inbound | No | Normalisation — keep |

### 8.2 Undocumented Transforms

| Finding | File | Direction | Affects Inference? | Risk | Recommendation |
|---------|------|-----------|-------------------|------|----------------|
| Duplicate clamping (weight/belief/beliefExists) | applyDraftResult.ts:74–82 | Inbound (stored) | Yes | LOW | Tag UI-SEM-023b/024b/025b |
| Weight clamp01 * 2 pattern | useConversation.ts:1086 | Outbound (CEE) | CEE only | MEDIUM | Tag UI-SEM-035; document [-2,+2] vs [-1,+1] |
| Robustness score default 0.5 | ceeSynthesisAdapter.ts:81 | Outbound (CEE) | CEE only | LOW | Tag UI-SEM-036 |
| ISL sensitive param defaults 0.5 | islRobustnessAdapter.ts:175–178 | Inbound (display) | No | LOW | Tag UI-SEM-037 |
| Edge sorting defaults (0.7/0.5) | ModelTabBody.tsx:264–269 | Display | No | LOW | Acceptable — display only |
| 20+ display threshold occurrences | Multiple files | Display | No | LOW | Consider consolidating constants |

### 8.3 Risk Summary

| Risk Level | Count | Items |
|------------|-------|-------|
| **Affects PLoT inference (outbound)** | 9 | UI-SEM-001, 002, 003, 004, 031, 032 (tagged); applyDraftResult (untagged) |
| **Affects stored state (inbound)** | 7 | UI-SEM-022–028 (all tagged) |
| **Affects CEE requests** | 3 | UI-SEM-011/030 (tagged); useConversation:1086, ceeSynthesisAdapter:81 (untagged) |
| **Display only** | 21 | UI-SEM-005, 006, 008, 010, 012–021, 029, 033, 034 + untagged thresholds |
| **Removed** | 3 | UI-SEM-007, 009, 018 |

### 8.4 Double-Application Risk

**None detected.** All flows are unidirectional:
- CEE → (normalise at ingestion) → canvas store → (convert at adapter) → PLoT
- PLoT → (format at display) → UI rendering
- No circular conversions between inbound and outbound transforms.
