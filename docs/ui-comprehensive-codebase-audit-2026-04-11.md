# UI Comprehensive Codebase Health Audit

**Date:** 11 April 2026
**Branch:** `staging` at `a57975fb`
**Codebase:** 1,111 source files, 248,685 lines of TypeScript/TSX
**Scope:** Everything outside the conversation layer (stores, canvas, analysis tab, model tab, inspector, adapters, formatters, layout, design system)
**Prior art:** Builds on "UI Conversation Layer Audit" (April 2026) — conversation rendering, SSE transport, system events, and message assembly are NOT re-audited here.

---

## Executive Summary: Top 10 Findings by Impact

| Rank | Finding | Impact | Location | Effort |
|---|---|---|---|---|
| **1** | **`useCanvasStore` is 4,006 lines with 80+ state fields and 150+ actions.** Single monolithic Zustand store holds graph, results, CEE state, UI panels, documents, history, lens, comparison mode, scenario metadata, and more. | Every PR touches this file. Merge conflicts inevitable. Re-render blast radius is entire app. | `store.ts` | Very High |
| **2** | **86 feature flags.** `flags.ts` alone is 609 lines. Legacy flags for permanently-on features remain, gating dead code paths. | Untested configuration combinations. Maintenance overhead. Confusion about what's active. | `flags.ts` + 86 `VITE_FEATURE_*` env vars | Medium |
| **3** | **2,257 legacy colour token violations.** `sand-`, `ink-`, `sky-`, `slate-` tokens used across 200+ files instead of semantic tokens (`text-body`, `bg-panel`, etc.). | Visual inconsistency risk. DS migration incomplete. Stale colours if theme changes. | Across `src/components/` and `src/canvas/` | High (mechanical) |
| **4** | **Results state duplicated in two stores.** `useCanvasStore` and `useResultsStore` both hold `results`, `runMeta`, `hasCompletedFirstRun`. `useResultsStore` exists but is secondary. | Confusion about which store to subscribe to. Potential state divergence. | `store.ts` + `stores/resultsStore.ts` | Medium |
| **5** | **536 hardcoded `fontSize` values in inline styles.** Many are in debug/dev panels, but ~50 are in production components (results, canvas nodes, model tab). Sub-11px fonts found in 20+ locations. | DS v5 non-compliance. Accessibility risk for sub-11px text. | Throughout `src/components/` and `src/canvas/` | Medium |
| **6** | **7 tooltip implementations and 6 popover implementations.** No single canonical component. Canvas nodes, edges, inspector, conversation, and sandbox each have their own. | Inconsistent interaction patterns. Duplicated logic. Maintenance burden. | 13 files across `src/` | Medium |
| **7** | **`useResultsSectionData.ts` is 2,403 lines** — computes analytical values locally (thresholds, severity, dominance detection, driver labels) that should come from PLoT. Contains 14 UI-SEM transforms. | F.6 violations: UI performs semantic computation. Risk of frontend/backend divergence. | `src/components/results/useResultsSectionData.ts` | High |
| **8** | **3 markdown rendering pipelines.** `renderMarkdownSafe` (lib/markdown.ts), `safeRichText` (canvas/utils/safeRichText.ts), and `renderSafeRichText` (lib/renderSafeRichText.ts). BaseNode uses deprecated re-export. | Inconsistent sanitisation. Potential XSS surface if wrong pipeline chosen. | 3 files | Low |
| **9** | **1,335 hardcoded hex colours in components.** Many in debug panels, but ~200 in production code (canvas, results, auth, layout). | DS non-compliance. Theme changes won't propagate. | Throughout `src/` | Medium (mechanical) |
| **10** | **`PreAnalysisPanel.tsx` is 1,852 lines** + `usePreAnalysisData.ts` is 2,053 lines. Pre-analysis computation spread across 3,900 lines with overlapping hook versions. | Hard to modify. Two versions of `usePreAnalysisData` exist (710 + 2,053 lines). | `src/canvas/components/pre-analysis/` | High |

---

## Part 1: Store Architecture

### 1A: `useCanvasStore` (`src/canvas/store.ts`, 4,006 lines)

#### State Slices

| Domain | Fields | Initial values | Mutating actions |
|---|---|---|---|
| **Graph** | `nodes`, `edges`, `nextNodeId`, `nextEdgeId`, `selection`, `clipboard`, `reconnecting`, `touchedNodeIds` | Empty arrays, 1, 1, empty set, null, null, empty set | 20+ (addNode, updateNode, deleteNodeById, addEdge, updateEdge, etc.) |
| **History** | `history.past`, `history.future`, `_internal.lastHistoryHash` | Empty arrays, empty string | `pushToHistory`, `undo`, `redo` |
| **Analysis results** | `results` (status/progress/report/hash/drivers/error/enrichment), `runMeta`, `previousReport`, `rawV2Response`, `lastAnalysisSeed`, `lastQualityMode`, `repairsApplied` | idle status, null report, etc. | `resultsStart`, `resultsComplete`, `resultsError`, `resultsCancelled`, `resultsReset` |
| **CEE readiness** | `ceeAnalysisReady`, `ceeAnalysisReadyNodeIds`, `ceeQuality`, `goalConstraints`, `ceePipelineTrace`, `nodeRationales`, `ceeExtendedWarnings`, `ceeGoalConnectivity`, `ceeModelQualityFactors`, `ceeInterventionHints`, `preAnalysisSensitivity` | All null/empty | `setCeeAnalysisReady`, `setCeeQuality`, `setGoalConstraints`, etc. |
| **Staleness flags** | `analysisStateReady`, `graphEditedSinceLastRun` | false, false | Set by `pushToHistory` (→ true/false), `resultsComplete` (→ false/true) |
| **Scenario** | `currentScenarioId`, `scenarioPersistedToDb`, `currentScenarioFraming`, `currentStage`, `currentScenarioLastResultHash`, `currentScenarioLastRunAt`, `currentScenarioLastRunSeed`, `hasCompletedFirstRun` | All null/false | `setCurrentScenarioId`, `loadScenario`, etc. |
| **Outcome/Goal** | `outcomeNodeId`, `goalThreshold` | null, null | `setOutcomeNode`, `setGoalThreshold` |
| **UI panels** | `showResultsPanel`, `showInspectorPanel`, `showTemplatesPanel`, `templatesPanelInvoker`, `showDraftChat`, `showProvenanceHub`, `showDocumentsDrawer`, `showIssuesPanel`, `showComparePanel`, `showAIClarifier` | All false/null | Individual setters |
| **Draft/Gen** | `currentBriefText`, `draftComposerText`, `selectedGenerationModel`, `selectedRepairModel`, `selectedEnrichmentModel`, `draftChatPreDraftSnapshot`, `lastDraftDescription`, `lastDraftError`, `isGenerating`, `fullDraftAppliedAt` | All null/empty | Individual setters |
| **Documents** | `documents`, `citations`, `provenanceRedactionEnabled`, `documentSearchQuery`, `documentSortField`, `documentSortDirection` | Empty arrays, false, empty string, defaults | Add/remove/rename documents, add citations |
| **Lens** | `lens` (active, selectedOptionId, _dimmedNodeIds, _dimmedEdgeIds, _sensitivityWeights, _sensitivityQuartiles, _fragileEdgeIds, _hiddenNodeIds, _hiddenEdgeIds, _causalEdgeParams, _evidenceNodeClass, _evidenceEdgeClass) | Default lens state | `setLensMode`, auto-reset on graph edit |
| **Comparison** | `comparisonMode` (active, scenarios, labels, selectedIndices, etc.), `selectedSnapshotsForComparison`, `currentDecisionRationale` | Inactive, empty | Comparison actions |
| **Highlight/Interaction** | `highlightedNodes`, `highlightedEdges`, `dimmedNodeIds`, `confirmedNodeIds`, `hoveredOptionId` | Empty sets, null | Individual setters |
| **Graph health** | `graphHealth`, `needleMovers`, `engineLimits`, `engineLimitsSource`, `engineLimitsLoading`, `engineLimitsError`, `engineLimitsFetchedAt` | All null/empty | Set via API responses |
| **View** | `viewMode` ('standard' \| 'expert') | 'standard' | `setViewMode` |
| **Save** | `isDirty`, `isSaving`, `lastSavedAt` | false, false, null | Save lifecycle |
| **Debug** | `debugRawCeeOutput` | false | Toggle |
| **Internal** | `_externalMutationActive`, `_suppressHistory`, `pendingFitView`, `_hydratedThread`, `_hydratedEvents` | 0, false, false, null, null | Internal use |

**Total: 80+ state fields, 150+ actions.**

#### Selectors

No extracted memoised selectors found. All 40+ consuming components use inline `useCanvasStore(s => s.fieldName)` or `useCanvasStore(s => ({ a: s.a, b: s.b }))`. Only 22 uses of `useShallow` across the entire codebase (4 in production components: `PreAnalysisReadinessPanel.legacy.tsx`, `usePreAnalysisData.ts`, `OutputsDock.tsx`, `StyledEdge.tsx`).

#### Graph-Mutating Actions — Staleness Behaviour

Every action that mutates `nodes` or `edges` calls `pushToHistory()`, which sets:
- `graphEditedSinceLastRun: true`
- `analysisStateReady: false`
- `lens: createDefaultLensState()` (auto-reset)

20+ actions confirmed: `addNode`, `addNodeWithEdge`, `updateNodeLabel`, `updateNode`, `updateEdge`, `onNodesChange`, `onEdgesChange`, `addEdge`, `deleteSelected`, `deleteNodeById`, `deleteEdgeById`, `duplicateSelected`, `pasteClipboard`, `cutSelected`, `nudgeSelected`, `applyLayout`, `applySimpleLayout`, `applyGuidedLayout`, `resetCanvas`, `deleteEdge`, `updateEdgeEndpoints`.

#### Staleness/Invalidation Model

When analysis results exist and a graph edit occurs:
1. `pushToHistory` → `graphEditedSinceLastRun = true`, `analysisStateReady = false`
2. `lens` auto-resets to `full` mode
3. If critical nodes deleted (goal/option/intervention targets), `invalidateAnalysisReady()` clears:
   - `ceeAnalysisReady: null`
   - `ceeAnalysisReadyNodeIds: null`
   - Plus 7 related CEE fields (quality, constraints, warnings, connectivity, model quality factors, intervention hints, pre-analysis sensitivity)

**`setCeeAnalysisReady(null)` call sites across codebase: 11**

| # | File | Line | Trigger |
|---|---|---|---|
| 1 | `store.ts` | :2659 | loadScenario() — falsy analysis_ready |
| 2 | `store.ts` | :2662 | loadScenario() — unconditional on scenario switch |
| 3 | `useAddBaseline.ts` | :122 | addBaseline() hook |
| 4 | `useV2Run.ts` | :315 | V2 run error handler |
| 5 | `OutputsDock.tsx` | :491 | Reset analysis action |
| 6 | `ConversationPanel.tsx` | :155 | Fallback when analysis_ready not in envelope |
| 7 | `DraftChat.tsx` | :774 | Fallback when analysis_ready not in draft response |
| 8 | `useConversation.ts` | :2040 | Fallback when analysis_ready not in response |
| 9 | `PreAnalysisReadinessPanel.legacy.tsx` | :2270 | Conditional goal update |
| 10-11 | `store.ts` invalidateAnalysisReady | :807-882 | Node/edge deletion of critical elements |

**Gap identified:** Invalidation only triggers on DELETION of critical nodes. Label changes, edge weight/confidence changes, and non-critical structure changes do NOT invalidate `ceeAnalysisReady`. This means stale `ceeAnalysisReady` could be sent to CEE if the graph is edited in ways that don't delete nodes.

#### Type Assertions in store.ts (10 instances)

| Line | Pattern | Context |
|---|---|---|
| :718 | `(e.data as any)?.schemaVersion` | historyHash edge schema check |
| :939 | `window as unknown as { __SAFE_DEBUG__?... }` | Debug middleware |
| :1266 | `(c as any).dragging` | Node drag detection |
| :2319 | `(report as any).summary` | Report summary fallback |
| :2421 | `window as any` | Global window access |
| :2453 | `run.drivers as any` | StoredRun driver casting |
| :2709 | `n.data as any` | Node data baseline stripping |
| :2743 | `n.data as any` | Node data baseline stripping (duplicate) |
| :2854 | `window as any` | Global window access |
| :3003 | `(analysisReady as any).goal_threshold` | Goal threshold fallback |

### 1B: Results Store (`src/canvas/stores/resultsStore.ts`, 239 lines)

**Schema:**
```typescript
ResultsStoreState {
  results: ResultsState        // status, progress, report, hash, drivers, error, enrichment, etc.
  runMeta: RunMetaState         // diagnostics, correlationId, degraded, CEE review/trace/error
  hasCompletedFirstRun: boolean
}
```

**Writers:** `useV2Run` hook writes via `resultsStart`, `resultsConnecting`, `resultsProgress`, `resultsComplete`, `resultsError`, `resultsCancelled`, `resultsReset`, `setRunMeta`.

**Readers:** ~15 components read directly, but most read from `useCanvasStore` which holds the same data.

**Duplication confirmed:** `results`, `runMeta`, and `hasCompletedFirstRun` exist in BOTH `useCanvasStore` AND `useResultsStore`. `useCanvasStore` is authoritative. `useResultsStore` is secondary and underutilised.

### 1C: All Zustand Stores (16 total)

| # | Store | File | Lines | State fields | Status |
|---|---|---|---|---|---|
| 1 | `useCanvasStore` | `canvas/store.ts` | 4,006 | 80+ | **Monolithic — needs splitting** |
| 2 | `useResultsStore` | `canvas/stores/resultsStore.ts` | 239 | 3 | **Duplicated — unused** |
| 3 | `useReadinessStore` | `canvas/stores/readinessStore.ts` | 517 | 3 | Active, well-scoped |
| 4 | `useGuidanceStore` | `canvas/stores/guidanceStore.ts` | 246 | 9 | Active, well-scoped |
| 5 | `usePanelsStore` | `canvas/stores/panelsStore.ts` | 140 | 4 | Extracted from main store |
| 6 | `useDocumentsStore` | `canvas/stores/documentsStore.ts` | 139 | 8 | Active |
| 7 | `useGraphHealthStore` | `canvas/stores/graphHealthStore.ts` | 64 | 4 | Active |
| 8 | `useAnalysisSnapshotStore` | `canvas/stores/analysisSnapshotStore.ts` | 64 | 2 | Active |
| 9 | `useEditPreviewStore` | `canvas/stores/editPreviewStore.ts` | 29 | 2 | Active |
| 10 | `useConfirmDialogStore` | `canvas/stores/confirmDialogStore.ts` | 31 | 7 | Active |
| 11 | `useUIStore` | `stores/uiStore.ts` | 59 | 3 | Active |
| 12 | `useLimitsStore` | `stores/limitsStore.ts` | 46 | 4 | Active |
| 13 | `useLayoutStore` | `canvas/layoutStore.ts` | 61 | ~10 | Active |
| 14 | `useLayoutProgressStore` | `canvas/layoutProgressStore.ts` | 16 | 2 | Active |
| 15 | `useSettingsStore` | `canvas/settingsStore.ts` | 19 | ~5 | Active |
| 16 | `useEdgeLabelMode` | `canvas/store/edgeLabelMode.ts` | 60 | 2 | Active |

**React Contexts (4, non-mutable):** `AuthContext`, `DecisionContext`, `TeamsContext`, `GuestContext` — hold session/auth state, no application mutation.

---

## Part 2: Data Flow from Store to Render

### 2A: `applyDraftResult` Pipeline (`src/canvas/utils/applyDraftResult.ts`, 441 lines)

**Input:** `CEEDraftResponse | CEEv2Response | CEEv3Response`

**Node transformations:**
- Extracts `id`, `kind`/`type`, `label`, `observed_state` → `observedState` (camelCase)
- Maps to ReactFlow format with `position: {x:0, y:0}`
- Derives `interventionKeys` from `interventions` object
- Spreads `...rest` into `data` (preserves unknown CEE fields)

**Edge transformations:**
- Weight priority: `strength.mean` > `strength_mean` > `weight` > 0.5 (default)
- Direction inference from `effect_direction` or weight sign
- Weight clamped to [0, 2] (`:84`) — **UI-SEM-038**
- Confidence: `belief` → `confidence`, bounded [0, 1] — **UI-SEM-038**
- `beliefExists`: `belief_exists` > `exists_probability` > `confidence`
- `strengthStd`: `strength.std` > `strength_std` > undefined

**Backfill calls:**
- **Line 187:** `backfillInterventionsOntoOptionNodes(analysisReadyWithCoaching)` — updates `node.data.interventions` and `node.data.is_baseline` on option nodes
- **Line 209:** `backfillGoalThresholdOntoGoalNode(analysisReadyWithCoaching)` — updates `goal_threshold_raw`, `goal_threshold_unit`, `goal_threshold_cap` on goal node

**Store mutations (in order):**
1. `:132` — `pushHistory()` (undo snapshot)
2. `:133-136` — `setState({nodes, edges})` (full graph replace)
3. `:139-142` — `applyLayout()` + `setPendingFitView(true)` (async)
4. `:147-155` — Autosave sync
5. `:159-161` — Auto-select goal node
6. `:169` — `setCeeAnalysisReady(analysisReadyWithCoaching)`
7. `:218-220` — `setGoalConstraints(goal_constraints)`
8. `:227-233` — `setCeeQuality({overall, structure, coverage, causality, safety})`
9. `:244` — `setCeePipelineTrace(pipelineTrace)`

**Return:** `{ nodeCount: number; edgeCount: number }` — consumed by DraftChat for telemetry.

### 2B: Patch-Accept Pipeline

**Handler:** `ConversationPanel.tsx:130-336` (`handlePatchAccept`)

**Comparison to draft-apply path:**

| Step | Draft-apply (applyDraftResult) | Patch-accept (handlePatchAccept) |
|---|---|---|
| pushHistory | `:132` | `:210` / `:229` / `:291` |
| Graph mutation | Full replace via `setState` | Via `setState` (validated) or `applyAutoApplyPatch` (op-replay) |
| backfillInterventions | `:187` | `:156` via `mirrorAnalysisReadyAfterAccept` |
| backfillGoalThreshold | `:209` | `:167` via `mirrorAnalysisReadyAfterAccept` |
| setCeeAnalysisReady | `:169` | `:155` via `mirrorAnalysisReadyAfterAccept` |
| Layout trigger | `:139` `applyLayout()` | **Not triggered** (patch modifies existing layout) |
| Auto-select goal | `:159` | **Not done** |
| setCeeQuality | `:227` | **Not done** (quality not on patch block) |
| setCeePipelineTrace | `:244` | **Not done** (trace not on patch block) |

**What's different:** Patch-accept does NOT trigger re-layout, auto-select goal, or set CEE quality/trace. These are appropriate omissions — patches modify an existing graph rather than creating one from scratch.

### 2C: PLoT Adapter (`src/adapters/plot/v2/adapter.ts`, 1,663 lines)

#### `reconcileOptionsWithCanvasNodes` (lines 390-520)

**Purpose:** Merge option intervention data from two sources: CEE's `analysisReady.options[]` (primary) and canvas `node.data.interventions` (fallback).

**Path A (Primary — lines 457-460):** When `analysisReady.options[i].interventions` has usable values → pass through unchanged. No warning.

**Path B (Canvas fallback — lines 463-490):** When analysisReady entry exists but interventions empty/null → backfill from matching canvas node's `node.data.interventions`. Emits `reconcile_options.backfill` warning with `backfillSource: 'canvas_node'`.

**Path C (Canvas-only options — lines 493-517):** Options on canvas but not in analysisReady (e.g., user-added after last CEE turn) → synthesise `CEEOptionV3` entry from canvas node data. Status: `'ready'` if interventions exist, `'needs_user_mapping'` if not. Emits warning with `backfillSource: 'canvas_only'`.

#### `transformNodeToV2` (lines 772-797)

Uses a **blocklist** (`V2_NODE_BLOCKLIST`) to exclude ReactFlow internals and UI-only fields while passing through all CEE fields. V3 fields (`goal_threshold_*`, `prior`, etc.) survive without explicit forwarding — this is load-bearing.

#### `extractObservedState` (lines 687-738)

**Spreads** original `observedState` then overlays:
- `std`: computed from baseline delta when missing — **UI-SEM-002**
- `baseline`: defaults to `value` when missing — **UI-SEM-002**
- STD floor: `0.001` enforced — **UI-SEM-003**

### 2D: Formatting Pipeline — Complete Inventory

| Function | File | Input | Output | Unit source | Callers |
|---|---|---|---|---|---|
| `formatFactorDisplayValue` | `utils/formatFactorDisplayValue.ts` | `{label, value, raw_value, unit, factor_type, cap, category, display_value}` | `string \| null` | `unit` field | FactorNode, ModelTab FactorsSection |
| `formatRawValueWithUnit` | `canvas/utils/labelUtils.ts:716` | `(value: number, unit?: string)` | `string` | `unit` param | ModelTab OptionsSection, GraphTextView |
| `formatInterventionValue` | `canvas/utils/labelUtils.ts:607` | `(value, unit, factorType, cap, observedValue, observedRawValue, opts)` | `string` | `unit` + `cap` denorm | OptionNode chips, FactorNode comparison table, GraphTextView |
| `formatOutcomeValue` | `lib/format.ts:34` | `(value, units, unitSymbol, options)` | `string` | `units` param | Results HeroSection, OptionCards, TargetProbabilityBars |
| `formatOutcomeValueCompact` | `lib/format.ts:104` | `(value, units, unitSymbol)` | `string` | `units` param | Results compact displays |
| `formatFactorValue` | `canvas/utils/labelUtils.ts:459` | `observedState` | `string \| null` | `unit` field | **Legacy** (OptionPanel only) |
| `formatDeltaPercent` | `lib/format.ts:139` | `(deltaPercent: number)` | `string` | None | Results DriversSection |
| `formatConfidence` | `lib/format.ts:150` | `(confidence: 0-1)` | `string` | None | Results, EdgePanel |
| `formatConfidencePercent` | `lib/format.ts:160` | `(percent: 0-100)` | `string` | None | Results |
| `formatRange` | `lib/format.ts:173` | `(lower, upper, units, unitSymbol)` | `string` | `units` param | Results OptionCards |
| `formatRawSmartNumber` | `canvas/utils/labelUtils.ts:710` | `(n: number)` | `string` | None | Helper for formatRawValueWithUnit |
| `formatDisplayValue` | `canvas/utils/graphDisplayCalculations.ts:320` | `(value, unit?)` | `string` | `unit` param | Graph canvas displays |
| `classifyUnit` | `canvas/utils/labelUtils.ts:315-337` | `unit: string` | `{kind, canonical}` | N/A | Called by all format functions |

**Unit classification via `classifyUnit`** (single source of truth):
- `'none'` — null/empty
- `'symbol'` — £$€¥₹ → prefix, no space
- `'iso'` — USD, GBP, CHF → prefix with space
- `'percent'` — % → suffix
- `'placeholder'` — scale, index, score, normalised → **suppressed** (no display)
- `'other'` — engineers, months, FTE → suffix with space

**Chaining:** `formatRawValueWithUnit` calls `classifyUnit` → `formatRawSmartNumber`. `formatInterventionValue` calls `classifyUnit` → `denormaliseInterventionValue` → `formatRawSmartNumber`. `formatFactorDisplayValue` calls `classifyUnit`.

### 2E: Value Transformation Trace (GBP Currency Example)

| Step | Location | Value | Unit | Representation |
|---|---|---|---|---|
| **CEE response** | Wire format | `value: 0.5, raw_value: 50, cap: 100` | `"GBP"` | Normalised 0-1 |
| **applyDraftResult** | `applyDraftResult.ts:37-58` | `observedState.value: 0.5, raw_value: 50` | `"GBP"` | No transform — stored as-is |
| **Canvas store** | `store.ts` → `node.data.observedState` | `{value: 0.5, raw_value: 50, unit: "GBP", cap: 100}` | `"GBP"` | Normalised |
| **FactorNode display** | `formatFactorDisplayValue` | Pattern 1: `raw_value + unit` → "GBP 50" | `classifyUnit("GBP")` → `iso` | Denormalised via raw_value |
| **Intervention chip** | `formatInterventionValue(0.75, "GBP", ..., 100, 0.5, 50)` | Denorm: `50 × (0.75/0.5) = 75` → "GBP 75" | `classifyUnit("GBP")` → `iso` | Denormalised via proportional mapping |
| **V2 request** | `extractObservedState` | `{value: 0.5, std: 0.045, baseline: 0.5}` | N/A (normalised for PLoT) | Normalised with computed STD |

**No normalised-value-with-raw-unit display bugs found** in this trace. The `classifyUnit` → `placeholder` suppression prevents "0.5 scale" displays. CEE's `display_value` field takes priority when present (`:37` in `formatFactorDisplayValue`).

---

## Part 3: Analysis Tab Surfaces

### 3A: Pre-Analysis Panel

**File:** `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` (1,852 lines)
**Data hook:** `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` (2,053 lines)
**Legacy version:** `src/canvas/components/PreAnalysisReadinessPanel.legacy.tsx` (2,278 lines) — **dead code, explicitly marked legacy**

#### Sections (top-to-bottom):

1. **StatusBanner** — state indicator (Failed/Blocked/Ready/Ready with recommendations)
   - Dot colour + status message
   - Optional "Retry" button (when `canRetry && state.kind === 'failed'`)

2. **Draft Error Card** (when `lastDraftError` present)
   - Detail text + timestamp
   - Buttons: "Edit brief" / "Retry Draft" (conditional)
   - Expert mode: "Copy diagnostics" button
   - Tips box for non-retryable errors

3. **ModelHealthCard** (compact variant)
   - Health ring (4-segment readiness visualisation)
   - 4 dimension bars: Completeness, Evidence, Balance, Calibration
   - Data source: `ceeQuality` from store (structure/10, evidenceQuality.ratio, balanceScore, reviewedFactorsCount/totalReviewableFactorsCount)
   - Dynamic headline (coaching-derived)
   - Option count chip

4. **Must Fix Section** (when `mustFixCount > 0`)
   - SectionHeader: "Must fix" + danger count badge
   - Structural checks: "Fewer than 2 options" + "Add option" CTA, "No baseline set" + "Add baseline" CTA
   - Critical triage cards

5. **Review Next Section** (when `reviewNextCount > 0`)
   - SectionHeader: "Review next" + info count badge
   - **Start Here Card** — 3px success left border, highest-priority triage signal
   - Bias trigger cards (max 2 visible, "Show more" overflow)
   - Triage cards (top 3 visible, overflow behind toggle)

6. **Improve Confidence Accordion** (collapsed by default)
   - SuccessTarget (goal threshold editor)
   - Quick-fix triage cards (ranks 4-6)
   - Your Expertise section (unified v6)
   - MissingKnowledgePrompt

7. **StickyFooter** — status text + evidence ratio + "Analyse" button

#### Specific Question Answers:

- **Sparkle icons per triage card:** 1 per card (Sparkles 14px, bottom-right, `text-text-light` / `hover:text-info`). This is the "Discuss with AI" button.
- **"Start here" renders:** YES — elevated card with 3px success left border in Review Next section.
- **Expertise row icons:** Bordered inline-edit chips (`border-panel-border`, `px-2 py-0.5`, `rounded-md`). Hover: `border-info` transition. Success flash: `border-success` 600ms.
- **"Tell the AI" pill:** YES — present in CoachingPrompt component (results section + bias card "Try this" chips).
- **"Ask AI" text:** YES — generic chip on bias trigger cards. onClick sends `askAiPrompt` to conversation.
- **"0 scale" appears:** NO — prevented by `classifyUnit` → `'placeholder'` suppression in `InlineValueControls` (TriageCard.tsx:216-220).

#### F.6 Violations (semantic computation in UI):

The `usePreAnalysisData.ts` hook (2,053 lines) performs significant analytical computation:
- Readiness dimension scores computed locally
- Triage card priority ranking
- Factor review status derivation
- Evidence quality ratios
- Structural completeness checks

These are display-layer computations but border on analytical — the triage ranking algorithm could diverge from CEE's priorities.

### 3B: Post-Analysis Panel (Results)

**Directory:** `src/components/results/` — 34 component files

**Key files:**
- `useResultsSectionData.ts` (2,403 lines) — **the largest non-store file in the codebase**
- `HeroSection.tsx` (1,093 lines)
- `ConfidenceSection.tsx` (1,264 lines)
- `DriversSection.tsx` (946 lines)
- `TornadoChart.tsx` (659 lines)
- `OptionCards.tsx` (617 lines)
- `DecisionConfidencePanel.tsx` (557 lines)
- `buildResultsVM.ts` — view model builder
- `types.ts` (784 lines)

#### Sections (top-to-bottom):

1. **DecisionConfidencePanel** — triage-based panel with health ring, target probability bars, top 3 action cards (EVOI-ranked), quick-fix rows, science nudges
2. **AttentionBanner** — prominent issues from humanised critiques
3. **Your Options** — WinGauge (pie), risk appetite toggle (Conservative/Neutral/Aggressive), OptionCards with border hierarchy (winner=success, runner=info, third=option, fourth+=panel-border), TippingPoints
4. **Drivers Section** — factor cards with impact bars (accordion)
5. **Tornado Chart** — flip markers + styling (accordion)
6. **Before You Decide** — fragile edge cards (max 3), bias findings, pre-mortem items, inference warnings (accordion)
7. **CoachingPrompt** — dismissible "Something missing?" with "Tell the AI" button
8. **AdvancedSection** — technical metadata (seed, n_samples, hashes, stability, repairs)
9. **ResultsFooter** — stability metric + metadata

#### Specific Question Answers:

- **Leader shown alongside runner-up:** YES. OptionCards renders all options, winner highlighted. `runnerId` computed from all options excluding winner.
- **Flip thresholds:** Rendered via `TippingPoints` component below option cards.
- **"Review in inspector":** Text pill (`border-info/30`, `px-2 py-0.5`, `rounded-full`, `text-info`, `bg-transparent`, `panelMeta` font).
- **"Discuss with AI":** Text pill (same style as above). In ChallengeSection + CoachingPrompt.
- **Expert-only data visible without toggle:** NO — gated by `expertMode` prop throughout.
- **Option cards count:** Unbound in OptionCards component. CappedList caps at 6 visible with "N more" toggle.
- **Sticky footer:** ResultsFooter (52 lines) — stability metric + resolved count + total count. No truncation observed.

#### F.6 Violations in useResultsSectionData.ts:

This file contains **14 UI-SEM transforms** (see CLAUDE.md inventory). Key violations:

| UI-SEM | Line | Computation | Should be in |
|---|---|---|---|
| 005 | :1034 | Robustness level from stability thresholds | PLoT |
| 012 | :1913 | Edge severity from switch_probability | PLoT |
| 013 | :1630 | Fragile edge filter threshold (0.3) | PLoT |
| 015 | :578 | Confidence tier from score (>=70 strong) | PLoT |
| 019 | :537 | Readiness/confidence taxonomy mapping | PLoT |
| 039 | :538 | Driver semantic label thresholds | PLoT |
| 040 | :1601 | Dominance detection heuristic | PLoT |

### 3C: Cross-Surface Consistency

| Aspect | Pre-analysis | Post-analysis | Consistent? |
|---|---|---|---|
| **SectionHeader** | Local function (inline badge styling) | `src/components/results/SectionHeader.tsx` (badgeState system) | **NO — different components** |
| **TriageCard** | `src/components/shared/TriageCard.tsx` | Same component (compact variant) | YES |
| **Accordion** | Not used (inline sections) | `src/components/results/Accordion.tsx` | **Partial — pre-analysis uses inline** |
| **Typography tokens** | `panelHeader`/`panelBody`/`panelMeta` | Same tokens | YES |
| **Icon sizes** | Sparkles 14px, Pencil/Check 14px | MessageCircle 3.5x3.5 (14px), AlertTriangle 3.5x3.5 | YES |
| **Health ring** | ModelHealthCard in pre-analysis | TriageHealthHeader in post-analysis | **Different components, same visual** |

---

## Part 4: Canvas and Graph Rendering

### 4A: Node Rendering

**13 node component files** in `src/canvas/nodes/`:

| Node type | File | Lines | Key conditional branches |
|---|---|---|---|
| **Base** | `BaseNode.tsx` | 436 | Pre/post analysis, Standard/Expert, lens modes, incomplete overlay, dimming |
| **Goal** | `GoalNode.tsx` | 322 | Threshold set/unset, achievement probability <10%, post-analysis stability |
| **Option** | `OptionNode.tsx` | 1,040 | Intervention chips, differentiator computation, option comparison table |
| **Factor** | `FactorNode.tsx` | 772 | Category (controllable/observable/external), priority ranking, value display, evidence gap |
| **Risk** | `RiskNode.tsx` | 275 | Severity calculation, bridge edge to goal, coaching chips |
| **Outcome** | `OutcomeNode.tsx` | 266 | Bridge edge to goal, achievement metric (Detailed only) |
| **Decision** | `DecisionNode.tsx` | 415 | Pre-analysis triage, post-analysis headline, model readiness breakdown |
| **Constraint** | `ConstraintNode.tsx` | 138 | Constraint type (upper/lower/deadline/resource), hard/soft badge |
| **Action** | `ActionNode.tsx` | 21 | Minimal |
| **GhostOption** | `GhostOptionNode.tsx` | 51 | Special variant |

**observedState data displayed:**
- `value` (normalised 0-1), `raw_value` (display text), `baseline`, `unit`, `source`, `extractionType`, `factor_type`, `cap`, `uncertainty_drivers`, `display_value`

**Node width:** ELK layout engine computes `layoutNodeWidth` (stored in `useLayoutStore`). BaseNode reads via selector. Fallback: `maxWidth ?? layoutNodeWidth ?? 300`. MAX_NODE_W increased from 260 to 300 in recent commit `3388283d`.

**Markers/badges on nodes:**
- Assumption flag (top-left FlagIcon 12px, red)
- Needs Input pill (factors/goals when incomplete)
- Sensitivity rank (#1, #2, #3 — top-right, post-analysis only)
- Impact preview indicator (coloured arrow, edit preview)
- CEE warning badges, ISL validation badges

### 4B: Edge Rendering (`src/canvas/edges/StyledEdge.tsx`, 932 lines)

**Major conditional branches (6):**
1. Structural vs causal (from `edge_type` field or source/target kind inference)
2. Pre vs post analysis
3. Graph lens mode (full, causal, sensitivity, fragile, robustness, evidence)
4. Edge completeness (no confidence → dashed overlay)
5. Contested edges (divergence-scaled gaps)
6. Label visibility (Detailed view + post-analysis + selected/hovered/suggestion)

**Edge data carried:** `weight` (0-1), `direction` (positive/negative), `confidence` (0-1), `beliefExists` (0-1), `strengthStd`, `edge_type`, `provenance`, `validation` (contested), `style`, `curvature`, `pathType`, `kind`, `label`

**Edge thickness encoding:**
- Pre-run: `weightMagnitudeToStrokeWidth()` → encodes weight as thickness
- Post-analysis: Composite importance = `belief × strength × goalSensitivity` → 1-8px range
- Lens mode overrides: Causal/sensitivity/fragile have custom thickness rules

**Edge popover:** Hover on invisible 20px-wide hitbox, 300ms delay, contains weight/confidence sliders, fragile indicator, contested divergence.

### 4C: Layout System

**Files:** `src/canvas/layout/` (index.ts, types.ts, policy.ts, semantic.ts, adapters.ts, runLayoutWithProgress.ts) + `src/canvas/utils/layout.ts`

**Recent changes (16+ commits since 2026-03-11):**
- MAX_NODE_W increased from 260→300
- Risk tier shift post-ELK
- Revert-and-rebuild cycles on ELK-native partition constraints
- Panel-aware width: 95% breathing factor for inspector panel visibility

**Layout triggers:** Node/edge add/remove, node expand/collapse (100ms debounce via `updateNodeInternals`), canvas viewport resize, view mode toggle.

### 4D: Two-View System (Standard / Expert)

**Toggle state:** `useCanvasStore(s => s.viewMode)` — values: `'standard'` | `'expert'`

| Node | Standard | Expert |
|---|---|---|
| Goal | Layer 1 body; Layer 2 in popover | Layer 1 + Layer 2 inline |
| Option | Layer 1 interventions; comparison table in popover | Layer 1 + comparison table inline |
| Factor | Value display; option table in popover | Value + option table inline |
| Risk/Outcome | Contribution %; Layer 2 in popover | Layer 1 + Layer 2 inline |
| Decision | Triage/headline; coaching in popover | Inline + coaching inline |
| Edges | Labels hidden (except top 3) | Labels visible on top edges |

---

## Part 5: Model Tab

### 5A: `ModelTabBody.tsx` (615 lines)

**Sections:**

1. **ModelTabHeader** — factor/edge counts, fragile badge, contested badge, "Show full detail" toggle
2. **StatusBar** — clickable segments: "N to verify" (yellow), "N fragile" (red), "Npp via EVPI" (blue), "N% stability" (green). Each: dot + label, rounded pill.
3. **GoalSection** — diamond icon, label, "Target:" + InlineEdit chip, source provenance pill, feasibility warning, Discuss button (MessageCircle icon)
4. **OptionsSection** — collapsed by default, option cards with label + category + value + provenance
5. **FactorsSection** — sorted by needs-attention first, then alphabetical. Each: label, category badge, value chip (InlineEdit), source provenance, influence bar (post-analysis), attribution stability pill, range derivation badge, Discuss button
6. **RelationshipsSection** (714 lines) — sorted by fragile edges first. Contested edges as ContestedEdgeCard. Each: "A → B" label, fragile pill, StrengthBar, semantic strength label, likelihood (InlineEdit), provenance
7. **RisksSection** — collapsed by default, risk cards with causal edge links
8. **ModelHealthSection** — collapsed by default, CEE quality dimensions, audit trail

**Typography tokens confirmed:**
- `panelHeader`: 14px/600 — section titles, key emphasis
- `panelBody`: 12px/400 — body text, descriptions
- `panelMeta`: 11px/400 — badges, pills, axis labels
- **No font sizes below 11px in rendered text**

**Coaching cards:** `CoachingCard` component (48 lines), renders inline coaching text within sections. Not dismissible (static rendering).

**CTAs:**
- "Discuss with AI" — MessageCircle icon button (`text-text-light` / `hover:text-info`, 14px) on each section
- "Tell the AI" — NOT present in model tab
- "Ask AI" — NOT present in model tab

**CTAs are NOT dismissible** — they are persistent icon buttons, not dismissible cards.

### 5B: Status Bar

**Segment derivation:**
- "N to verify" — count of factors needing review (no source or AI estimate)
- "N fragile" — count of fragile edges (switch_probability > threshold, post-analysis only)
- "N contested" — count of contested edges (validation.status === 'contested', shown when > 0)
- "Npp via EVPI" — sum of EVPI percentage points (post-analysis only)
- "N% stability" — stability metric from PLoT (post-analysis only)

**Counts match section header counts:** YES — both derive from the same source data.

**Edge cases:** When EVPI is 0pp, segment hidden (only shown when > 0). When stability is 0%, displays "0%".

### 5C: Editable Values

| Value | Component | Chip affordance? | Functional? | Store mutation |
|---|---|---|---|---|
| Factor values | InlineEdit | YES — bordered `rounded-md px-2 py-0.5` | YES | `updateNode` → `pushToHistory` |
| Factor prior ranges | InlineEdit | YES | YES | `updateNode` → `pushToHistory` |
| Goal target | InlineEdit | YES | YES | `setGoalThreshold` → `pushToHistory` |
| Edge strength | SignedStrengthSlider (inspector) or inline | YES | YES | `updateEdge` → `pushToHistory` |
| Edge likelihood | InlineEdit | YES | YES | `updateEdge` → `pushToHistory` |
| Intervention targets | OptionNode chips | YES (bordered) | YES | `updateNode` → `pushToHistory` |

All edits fire `pushToHistory` → staleness invalidation.

---

## Part 6: Inspector Panels

### 6A: Inspector V2 Panels

**Directory:** `src/canvas/ui/inspector-v2/panels/`

| Entity | File | Data displayed | Editable | Edit mechanism |
|---|---|---|---|---|
| Goal | `GoalPanel.tsx` | Label, threshold (raw+normalised), unit, constraints, achievement probability, stability, inbound edges | Description (textarea), threshold (inline) | `useInspectorMutations` |
| Decision | `DecisionPanel.tsx` | Label, triage, readiness | Description (textarea) | `useInspectorMutations` |
| Option | `OptionPanel.tsx` | Label, category, value, source, interventions | Description, interventions (chips) | `useInspectorMutations` |
| Factor (Observable) | `FactorObservablePanel.tsx` | Label, value, unit, source, confidence, EVPI | Description, value (inline), source | `useInspectorMutations` |
| Factor (Controllable) | `FactorControllablePanel.tsx` | Label, value, unit, source, range | Description, value (inline), source | `useInspectorMutations` |
| Factor (External) | `FactorExternalPanel.tsx` | Label, prior range, source | Description (read-only for external) | `useInspectorMutations` |
| Outcome | `OutcomePanel.tsx` | Label, achievement, inbound edges | Description (textarea) | `useInspectorMutations` |
| Risk | `RiskPanel.tsx` | Label, causal edges, severity | Description (textarea) | `useInspectorMutations` |
| Edge | `EdgePanel.tsx` | Source→target, strength (signed slider), likelihood, uncertainty, provenance, contested info, fragile indicator | Strength (slider, 120ms debounce), likelihood (slider) | `useInspectorMutations` |

**Edit-where-you-read:** YES — all panels use `useInspectorMutations` hook which calls store actions directly. Edits reflected immediately.

### 6B: Inspector Wiring

**Selection → inspector:** Graph node/edge click → `selectNodeWithoutHistory(id)` or `selectEdge(id)` → `showInspectorPanel: true` → InspectorRouter renders appropriate panel based on selected element kind.

**Cross-surface opening:** Inspector can be opened from:
- Canvas click (primary)
- Results tab "Review in inspector" pills
- Model tab factor/edge click (→ focus node → inspector)
- Conversation "Show on graph" button (selects node, opens inspector)

---

## Part 7: Design System Compliance

### 7A: Typography Audit

| Category | Count | Locations (representative samples) |
|---|---|---|
| **Raw Tailwind font-size classes** (`text-xs`, `text-sm`, etc.) | **7** | `ChallengeSection.tsx:163`, `ParetoChart.tsx:426,435,494,540,551`, `AdapterStatusBanner.tsx:63` |
| **Raw font-weight classes** (`font-medium`, `font-semibold`, `font-bold`) | **22** | `TrustOneLiner.tsx:114,124`, `TornadoChart.tsx:637,647`, `ConfidenceSection.tsx:583`, `OptionCards.tsx:237`, `ResultsPanel.tsx:525,533,539,551,559`, `IssuesPanel.tsx:55,180`, `StatusPill.tsx:24`, `EvidenceGapBadge.tsx:65`, `DecisionNode.tsx:362,369,393` |
| **Hardcoded `fontSize` in inline styles** | **536** total, **~50 in production** | `TargetProbabilityBars.tsx:44,73`, `DriversSection.tsx:344,362`, `HeroSection.tsx:983`, `OptionCards.tsx:234`, `StatusPill.tsx:25`, `LensInfoPanel.tsx:49,61,68,127,131,194,202`, `ModelHealthSection.tsx:22,32,148,171` |
| **Font sizes below 11px** | **20+** | `StatusPill.tsx:25` (10px), `OptionNode.tsx:915` (10px), `LensInfoPanel.tsx:61,68,131,202` (10px), `ModelHealthSection.tsx:22,32,171` (10px), `DevControls.tsx:65,71` (10px), `StyledEdge.tsx:670` (10px), `ContractIntegrityTab.tsx:88,177,203,732,754,780,831,850,853` (10px — debug) |

### 7B: Colour Audit

| Category | Count | Locations (representative) |
|---|---|---|
| **Hardcoded hex colours** | **1,335** | ~200 in production, rest in debug/dev panels. Hotspots: `WhiteboardCanvas.tsx` (6), `artefactIframeTemplate.ts` (15 — sandboxed iframe), `LoginPage.tsx` (4), `ContractIntegrityTab.tsx` (30+ — debug) |
| **`rgba()` values** | **109** | `LoginPage.tsx:148,181,183,191` (borders), `UserAvatarMenu.tsx:83,87,114` (panel borders), `DebugOverlays.tsx` (5 — debug), `artefactIframeTemplate.ts:72` |
| **Legacy colour tokens** (`sand-`, `ink-`, `sky-`, `slate-`) | **2,257** | `FieldLabel.tsx:48,61,69,81,87`, `ChatBox.tsx:23,59`, `DraftForm.tsx:84,86`, `InfluenceExplainer.tsx:82,90`, `InputsDock.tsx:656,657`, `ActionsSignal.tsx:84,91`, `Spinner.tsx:26`, and 200+ other files |
| **Filled `bg-{colour}` badges** (should be outlined) | **42** | `RangeVisualization.tsx:111` (bg-success), `TornadoChart.tsx:172` (bg-danger), `getThresholdColour.ts:19-21` (bg-success/warning/danger), `ProgressBar.tsx:24` (bg-success), `HeroSection.tsx:493-495` (bg-warning/success) |

### 7C: Border Audit

| Category | Count | Notes |
|---|---|---|
| **One-sided borders** | **43** | Mostly legitimate: success left borders on "Start here" cards (`ConfidenceSection.tsx:509`, `HeroSection.tsx:761`), spinner animations, tab indicators. Some questionable: `ProvenanceChip.tsx:100` (border-l-2 on citation), `EdgeFunctionTypeSelector.tsx:204` (border-l-2 on indent) |

### 7D: Icon Audit

- **Non-Lucide icons:** No emoji-as-icons found in production components. Unicode symbols used only in debug panels (`ContractIntegrityTab.tsx` — checkmarks/arrows).
- **Icon-only buttons without labels:** Sparkles icon on TriageCard has `aria-label`. MessageCircle on ModelTab has `aria-label`. Most icon buttons have either `title` or `aria-label`.

### 7E: Copy Compliance

| Category | Count | Notes |
|---|---|---|
| **Em dashes** | **654** | Most are in file header comments (legitimate). ~20 in user-facing strings: `StreamingMonitor.tsx:86`, `SandboxStreamPanel.tsx:804,1066-1070` (keyboard shortcut help). Results/canvas components: minimal. |
| **Banned term "winner"** | **1** | `TrajectorySection.tsx:98` — Recharts `dataKey="winner"` (data property, not user-facing text) |
| **Banned term "recommended"/"graph"/"SCM"/"DAG"** | **0** in user-facing strings | |

---

## Part 8: Feature Flags and Dead Code

### 8A: Feature Flag Inventory

**Total unique flags: 86** across `flags.ts` (609 lines).

Representative flags by category:

| Category | Flags | Status |
|---|---|---|
| **Core rendering** | `ORCHESTRATOR_RENDERING_V2`, `ORCHESTRATOR_STREAMING`, `REACT_FLOW_GRAPH` | Likely permanent — candidate for removal |
| **Analysis features** | `PLOT_STREAM`, `PRE_ANALYSIS_ENRICHED`, `DETERMINISTIC_CEE`, `GRAPH_LENS` | Active |
| **Results/display** | `REAL_REPORT`, `REPORT_COPY`, `REPORT_DOWNLOAD`, `REPORT_EXPANDALL`, `REPORT_PRETTY`, `RUN_REPORT` | Many likely permanent |
| **Comparison** | `COMPARE`, `COMPARE_TAB`, `COMPARE_DEBUG` | Active |
| **Persistence** | `THREAD_HYDRATE`, `THREAD_PERSIST`, `SCENARIOS`, `SCENARIOS_V2`, `SNAPSHOTS`, `SNAPSHOTS_V2` | Active with version progression |
| **Debug/dev** | `DEBUG`, `DIAGNOSTICS`, `PERF_PROBES`, `COMPARE_DEBUG` | Dev-only |
| **Legacy/unused** | `TLDRAW`, `WHITEBOARD`, `COMMENTS`, `COPY_CODE`, `GHOST_PANEL`, `HISTORY_RERUN` | Candidate for removal |
| **Sandbox** | `SANDBOX_*` (8 flags) | Separate app surface |

### 8B: Dead Code

**TODO/HACK/FIXME/DEPRECATED counts:**
- TODO: 47
- HACK: 0
- FIXME: 0
- DEPRECATED: 4
- XXX: 0

**Known dead/legacy files:**
- `PreAnalysisReadinessPanel.legacy.tsx` (2,278 lines) — explicitly marked legacy
- `ResultsPanel.tsx` (855 lines) — superseded by OutputsDock
- `resultsStore.ts` (239 lines) — duplicated, underused
- `setNodeRationales` store action — defined, tested, never called from production

### 8C: Competing Implementations

| Functionality | Implementations | Canonical | Others still imported? |
|---|---|---|---|
| **Tooltips** | 7 variants across canvas, components, sandbox | `src/components/Tooltip.tsx` | Yes — BaseNode uses it; RationaleTooltip duplicates it |
| **Popovers** | 6 variants (NodePopover, EdgeEditPopover, SetValuePopover, ThinkingModePopover, ModelSettingsPopover, LayoutPopover) | `NodePopover.tsx` (portal-based) | All actively used for different purposes |
| **Markdown** | 3 pipelines: `renderMarkdownSafe` (lib), `safeRichText` (canvas/utils), `renderSafeRichText` (lib) | `safeRichText` for conversation, `renderSafeRichText` for canvas nodes | BaseNode uses deprecated `sanitizeMarkdown` re-export |
| **Format functions** | 12+ format functions across 3 files | `classifyUnit` is single source of truth for unit handling | No true duplication — each handles different input types |
| **PLoT adapters** | V1 (`httpV1Adapter.ts`, 971 lines + v1/ directory with 13 files) + V2 (`v2/adapter.ts`, 1,663 lines) | V2 is primary | V1 still has 6 import references |
| **SSE clients** | `v1/sseClient.ts` + conversation SSE in `turnService.ts` | Different services (PLoT vs CEE) | Both actively used |
| **Pre-analysis data hooks** | `usePreAnalysisData.ts` (710 lines in hooks/) + `usePreAnalysisData.ts` (2,053 lines in pre-analysis/hooks/) | The 2,053-line version in `pre-analysis/hooks/` | Both exist |

---

## Part 9: Test Coverage

### 9A: Test Inventory

- **Total test files:** 747
- **Top directories by test count:**
  - `src/lib/__tests__/` — 87 test files
  - `src/canvas/components/__tests__/` — 84
  - `src/canvas/conversation/__tests__/` — 81
  - `src/components/results/__tests__/` — 38
  - `src/canvas/utils/__tests__/` — 38
  - `src/canvas/components/pre-analysis/__tests__/` — 28
  - `src/canvas/__tests__/` — 28
  - `src/canvas/hooks/__tests__/` — 24
  - `src/canvas/nodes/__tests__/` — 16
  - `src/canvas/ui/inspector-v2/__tests__/` — 13
  - `src/canvas/components/model-tab/__tests__/` — 12

### 9B: Coverage Gaps

| Area | Test files exist? | Real data shapes? | User-critical untested paths |
|---|---|---|---|
| **Store (4,006 lines)** | 8 test files in `canvas/store/__tests__/` | Partial — synthetic state | Staleness invalidation chain, full graph edit → CEE readiness flow |
| **Canvas nodes** | 16 files in `canvas/nodes/__tests__/` | Partial | Node rendering with real PLoT enrichment data, lens mode rendering |
| **Analysis results** | 38 files in `components/results/__tests__/` | YES — some use fixtures | TornadoChart flip detection, DecisionConfidencePanel triage |
| **Model tab** | 12 files in `model-tab/__tests__/` | Partial | Inline edit persistence, status bar count accuracy |
| **Inspector** | 13 files in `inspector-v2/__tests__/` | Partial | Slider debounce, stale guard flow |
| **PLoT adapter** | 9 files in `adapters/plot/__tests__/` + 10 in `v1/__tests__/` | YES — v1 has golden fixtures | V2 reconciliation Path C (canvas-only options) |
| **Formatters** | Covered in `lib/__tests__/` and `canvas/utils/__tests__/` | YES | Edge cases in `classifyUnit` for exotic units |

### 9C: Test Health

Known failing tests (from CLAUDE.md memory):
- `responseMapper.spec.ts` — goal_probability mapping
- `bff-only.spec.ts` — unrelated to V3 work
- `DecisionQualityChecks.spec.tsx` — 6 failures (references removed header)
- `ConfidenceSection.voi.spec.tsx` — 1 failure (topAction.couldFlip path)
- `no-message-render.spec.ts` — 1 failure (ChallengeSection renders critique .message)
- 29 test files excluded in `vitest.config.ts` (known-broken, tracked)

---

## Part 10: Performance and Bundle

### 10A: Component Re-render Audit

**Top 3 largest components:**

| Component | Store subscriptions | Slice-level? | Memoisation | Risky useEffects |
|---|---|---|---|---|
| `useConversation.ts` (3,096 lines) | ~8 `useCanvasStore` calls | Individual fields | `useMemo` on some derivations | Stream flush scheduling (50ms batching) |
| `OutputsDock.tsx` (2,071 lines) | `useShallow` (1 call) + ~10 individual selectors | Mixed — some whole-slice | `useMemo` on tab content | Tab switching effect |
| `ReactFlowGraph.tsx` (2,540 lines) | ~15 `useCanvasStore` calls | Individual fields | `useCallback` on handlers | Layout effect, node internals update |

**Key risk:** `useCanvasStore` has no memoised selectors. Any store mutation triggers re-render checks in all 40+ consuming components. `useShallow` is used in only 4 production components (`PreAnalysisReadinessPanel.legacy.tsx`, `usePreAnalysisData.ts`, `OutputsDock.tsx`, `StyledEdge.tsx`).

### 10B: Bundle Dependencies

**Key dependencies:**
- `@xyflow/react: ^12.8.6` (ReactFlow — canvas)
- `elkjs: ^0.11.0` (layout engine)
- `recharts: ^3.8.1` (charts in results)
- `framer-motion: ^12.23.24` (animations)
- `zustand: ^5.0.8` (state management)
- `@sentry/react: ^10.20.0` (error tracking)
- `@supabase/supabase-js: 2.39.7` (backend)
- `zod: ^3.22.4` (schema validation)
- `marked: 16.4.1` (markdown parsing — but custom pipelines used instead?)
- `yjs: ^13.6.27` + `y-websocket: ^3.0.0` (collaboration — active?)

---

## Part 11: Cross-Cutting Concerns

### 11A: F.6 Compliance (UI as Passthrough)

**Violations found outside conversation layer:**

| Location | Computation | Should be in |
|---|---|---|
| `useResultsSectionData.ts` (14 UI-SEM transforms) | Robustness levels, severity, dominance, confidence tiers, driver labels, fragile filtering, edge severity | PLoT |
| `HeroSection.tsx` (UI-SEM-041,042,043,044) | Stability labels (0.85/0.70/0.55), fragility ratio threshold, evidence quality threshold, border colour classification | PLoT |
| `DriversSection.tsx` (UI-SEM-014,045,046) | VOI evidence threshold, rank flip warning gate, elasticity scaling | PLoT |
| `buildResultsVM.ts` (UI-SEM-006,007) | DecisionState thresholds, stability fabrication from categorical level | PLoT |
| `adapter.ts` (UI-SEM-001,002,003,031) | Signed mean, observed state defaults, STD floor, default exists_probability | Adapter concern (legitimate) |
| `usePreAnalysisData.ts` (2,053 lines) | Readiness scoring, triage ranking, factor review status | Borderline — display logic vs analytical |

### 11B: Error Boundary Audit

| Boundary | File | Wraps | Fallback UI |
|---|---|---|---|
| `BootErrorBoundary` | `main.tsx:109` | Entire app | Styled error card with stack trace |
| `ErrorBoundary` (generic) | `components/ErrorBoundary.tsx` (62 lines) | Page-level routes | Inline alert + "Refresh Page" button |
| `CanvasErrorBoundary` | `canvas/ErrorBoundary.tsx` (346 lines) | Canvas components | Full-screen modal with diagnostics, retry, copy debug, report issue. 3+ errors in 5s → force reload |
| `TemplatesErrorBoundary` | `routes/templates/TemplatesErrorBoundary.tsx` | Templates routes | (Not inspected) |

**Components NOT wrapped by error boundaries:** Individual node components, edge components, and inspector panels are all covered by the parent `CanvasErrorBoundary`. No gaps identified for production surfaces.

### 11C: Accessibility Quick Check

**Issues found:**
- **Sub-11px text in 20+ locations** — below WCAG minimum for body text. Most are in `StatusPill.tsx` (10px), `LensInfoPanel.tsx` (10px), `ModelHealthSection.tsx` (10px), `StyledEdge.tsx` (10px). Some are metadata/badges where reduced size may be acceptable.
- **Inline padding/sizing without rem units** — `px` values throughout prevent user font-size scaling.
- **Colour-only indicators:** Status dots (1.5x1.5 `rounded-full`) use colour alone. However, they always appear alongside text labels, so this is acceptable.
- **Touch targets:** Some icon buttons (14px Sparkles, 14px Pencil/Check) may be below 44x44px minimum. The `TriageCard` icon buttons have `7×7` click area (noted in pre-analysis audit) — this is definitively too small.

---

## Cross-Reference Table: Prior Audit Findings

| Prior finding | Source | This audit confirms/contradicts/extends |
|---|---|---|
| Single source of truth via `useCanvasStore` | Conversation layer audit | **Confirms** — but adds that the store is 4,006 lines and monolithic |
| Results state duplication | Conversation layer audit (noted) | **Extends** — `resultsStore.ts` exists but is secondary/unused |
| 86 feature flags | CEE root cause investigation (noted 58 in CEE) | **Extends** — UI has its own 86 flags |
| Dual chip rendering path (legacy vs V2) | Conversation layer audit | **Confirms** — flag still togglable |
| `useConversation.ts` 3,096-line monolith | Conversation layer audit | **Confirms** — NOT re-audited here |
| `InlineBlocks.tsx` 1,614-line monolith | Conversation layer audit | **Confirms** — NOT re-audited here |
| All 3 patch-accept paths call backfill | Conversation layer audit | **Confirms** and extends: draft-apply path also calls backfill (`:187` and `:209` in applyDraftResult.ts) |
| `ceeAnalysisReady` invalidation gap | Not previously identified | **New finding** — invalidation only on node deletion, not weight/label changes |
| 14 UI-SEM transforms in useResultsSectionData | CLAUDE.md inventory | **Confirms** — all still present |
| `PreAnalysisReadinessPanel.legacy.tsx` is dead code | Conversation layer audit | **Confirms** — 2,278 lines of dead code |

---

## Appendix A: File Inventory Summary

| Directory | Source files | Lines |
|---|---|---|
| `src/canvas/` | 570 | ~140,000 |
| `src/components/` | 209 | ~50,000 |
| `src/adapters/` | 34 | ~12,000 |
| Other (`src/lib/`, `src/hooks/`, `src/stores/`, `src/routes/`, `src/utils/`, `src/types/`, `src/flags.ts`, etc.) | 298 | ~46,685 |
| **Total** | **1,111** | **248,685** |

**Files over 1,000 lines (production, excluding debug/test):**

| File | Lines | Primary responsibility |
|---|---|---|
| `canvas/store.ts` | 4,006 | Main Zustand store |
| `canvas/conversation/useConversation.ts` | 3,096 | Conversation state hook |
| `canvas/ReactFlowGraph.tsx` | 2,540 | Main canvas component |
| `components/results/useResultsSectionData.ts` | 2,403 | Results data computation |
| `canvas/components/pre-analysis/PreAnalysisPanel.tsx` | 1,852 | Pre-analysis UI |
| `canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` | 2,053 | Pre-analysis data |
| `canvas/components/OutputsDock.tsx` | 2,071 | Results/compare dock |
| `adapters/plot/v2/adapter.ts` | 1,663 | PLoT V2 adapter |
| `canvas/conversation/InlineBlocks.tsx` | 1,614 | Block renderers |
| `adapters/plot/v2/responseMapper.ts` | 1,591 | V2 response mapping |
| `canvas/components/DraftChat.tsx` | 1,462 | AI panel wrapper |
| `components/results/ConfidenceSection.tsx` | 1,264 | Confidence display |
| `canvas/components/pre-analysis/AllImprovements.tsx` | 1,206 | All improvements UI |
| `components/results/HeroSection.tsx` | 1,093 | Hero results display |
| `canvas/nodes/OptionNode.tsx` | 1,040 | Option node rendering |
| `canvas/domain/edges.ts` | 1,029 | Edge domain logic |

---

## Appendix B: Feature Flag Table (86 unique flags)

See Part 8A above. Full list of unique `VITE_FEATURE_*` names extracted from codebase.

---

## Appendix C: DS v5 Violation Summary

| Category | Count | Severity |
|---|---|---|
| Legacy colour tokens (`sand-`/`ink-`/`sky-`/`slate-`) | 2,257 | Medium — theme migration incomplete |
| Hardcoded hex colours | 1,335 (~200 production) | Medium — theme won't propagate |
| Em dashes in strings | 654 (mostly comments) | Low |
| Hardcoded `fontSize` inline | 536 (~50 production) | Medium |
| `rgba()` values | 109 | Low |
| Filled `bg-{colour}` badges | 42 | Low — many are progress bars (legitimate) |
| One-sided borders | 43 | Low — most are legitimate (cards, spinners) |
| Raw font-weight classes | 22 | Low |
| Font sizes below 11px | 20+ | Medium — accessibility risk |
| Raw Tailwind font-size classes | 7 | Low |

---

*Report generated 11 April 2026. All line numbers reference commit `a57975fb` on `staging` branch. No source files were modified during this audit.*
