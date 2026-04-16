# Pre-analysis tab investigation report

**Date:** 19 March 2026
**Branch:** staging
**Scope:** Pre-analysis tab — component inventory, mutation audit, interaction gaps, section gap analysis, behavioural science, DS compliance, data availability

---

## 1. Component inventory

All pre-analysis components live under `src/canvas/components/pre-analysis/`.

| Component | File | Data sources | Actions exposed |
|-----------|------|-------------|-----------------|
| **OutputsDock** | `src/canvas/components/OutputsDock.tsx:132` | `useCanvasStore` (runMeta, nodes, edges, graphHealth, results), `useUIStore` (activeOutputTab), `useGuidanceStore` | `handleRunAnalysis()`, `cancelRun()`, `handleAutoFix()`, `addStatusQuoBaseline()`, `handleSetBaseline()`, `handleApplyThreshold()` |
| **PreAnalysisPanel** | `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:98` | `useCanvasStore` (nodes, edges, ceeAnalysisReady, repairsApplied, etc.), `usePreAnalysisData()`, `useRetryDraft()`, `useShowToast()` | Orchestrates all child callbacks; calls `updateNode`, `updateEdge`, `setGoalThreshold`, `setOutcomeNode`, `selectNodeWithoutHistory`, `focusNodeById`, `setHighlightedNodes`, `setHighlightedEdges` |
| **Header** | `src/canvas/components/pre-analysis/Header.tsx:36` | Props only: `isReady`, `isLoading`, `mustAddressCount`, `reviewCount`, `optionalCount` | None |
| **SuccessTarget** | `src/canvas/components/pre-analysis/SuccessTarget.tsx:47` | Props: `goalNode`, `goalNodes`, `successThreshold`, `thresholdProvenance`, `goalThresholdRaw`, `goalThresholdUnit`, source badge | `onGoalChange(goalId)`, `onThresholdChange(value)`, `onThresholdConfirm()`, `onThresholdEdit()` |
| **BlockersSection** | `src/canvas/components/pre-analysis/BlockersSection.tsx:43` | Props: `blockers[]`, `informationalBlockers[]`, `canRetryDraft` | `onRetryDraft()`, `onEditBrief()` |
| **OptionPreview** | `src/canvas/components/pre-analysis/OptionPreview.tsx:118` | Props: `options[]` (from `ceeAnalysisReady.options` via `usePreAnalysisData`) | `onFocusNode(optionId)`, `onHoverEnter('node', id)`, `onHoverLeave()` |
| **DecisionQualityChecks** | `src/canvas/components/pre-analysis/DecisionQualityChecks.tsx:65` | Props: `checks[]`, `goalBaselineSlot`, `totalCheckCount` | `onAction(actionString)` — routes to add_risk, add_baseline, scroll_to_assumptions, etc. |
| **GoalBaselineInput** | `src/canvas/components/pre-analysis/GoalBaselineInput.tsx:36` | Props: `currentValue`, `goalLabel`, `unit`, `hasGoalNode` | `onConfirm(value)`, `onClear()`, `onInputOpen()`, `onInputClose()` |
| **AllImprovements** | `src/canvas/components/pre-analysis/AllImprovements.tsx:65` | Props: `improvementsByCategory`, `tiers`, `reviewedCount`, `totalReviewableCount`, action handlers | Per-item: `onConfirm(nodeId)`, `onAssumption(nodeId)`, `onEdit(nodeId)`, `onAddEvidence(edgeId, evidence)`, `onResetSource(nodeId)` |
| **ModelSnapshot** | `src/canvas/components/pre-analysis/ModelSnapshot.tsx:91` | Props: `nodesByKind`, `edgeCount`, `ceeQuality`, `interventionCoverage`, `goalLabel`, `goalMeasurable` | `onFocusNode(nodeId)`, `onHoverNode('node', id)`, `onHoverClear()` |
| **WorthInvestigating** | `src/canvas/components/pre-analysis/WorthInvestigating.tsx:87` | Props: `gaps[]` (derived from `deriveEvidenceGaps(nodes, edges)`). **Behind `isPreAnalysisEnrichedEnabled()` feature flag** | `onSetValue(factorId)` — calls `selectNodeWithoutHistory` + `focusNodeById` |
| **ModelNotes** | `src/canvas/components/pre-analysis/ModelNotes.tsx:34` | Props: `notes[]` from `ceeAnalysisReady.model_critiques`. **Behind feature flag** | None — display only |
| **ModelAdjustments** | `src/canvas/components/pre-analysis/ModelAdjustments.tsx:48` | Props: `adjustments[]`, `repairActions[]`, `postRunRepairs[]` from `ceeAnalysisReady.model_adjustments` and `repairsApplied` store field | Expand/collapse per adjustment |
| **PreMortemSection** | `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:46` (inline) | Props: `preMortem` from `runMeta.m1ReviewAssumptions.pre_mortem` | Expand/collapse only |
| **StickyFooter** | `src/canvas/components/pre-analysis/StickyFooter.tsx:62` | Props: `isReady`, `hasBlockers`, `blockerCount`, `isAnalysing`, `reviewedCount`, `totalReviewableCount`, etc. | `onAnalyse()` |
| **usePreAnalysisData** | `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts` | `useCanvasStore` (nodes, edges, ceeAnalysisReady, goalThreshold, repairsApplied, runMeta) | Derives all panel data — no mutations |

**Primitives** (`src/canvas/components/pre-analysis/primitives/`): `Accordion`, `BiasIcon`, `IconBtn`, `NodeLink`, `Pill`, `TextBtn`.

---

## 2. Graph store mutation audit

### 2a. Store identity

**All three surfaces (pre-analysis panel, inspector, canvas) read from and write to the same single store: `useCanvasStore`** (`src/canvas/store.ts:888`). There is no divergence at the store level — any mutation immediately reflects across all subscribers.

### 2b. Success threshold mutation pathway — pre-analysis panel

**Entry point:** `PreAnalysisPanel.tsx` — `handleThresholdChange` callback.

Two mutations are executed in sequence:

1. **`setGoalThreshold(value)`** — `store.ts:1975`
   Sets `store.goalThreshold` (a top-level primitive). Used by `useV2Run` when building the PLoT request. Direct store write, no history entry.

2. **`updateNode(goalNode.id, { data: { success_threshold, threshold_source, threshold_confirmed } })`** — `store.ts:1091`
   Calls `pushToHistory(get, set)` first (adds undo snapshot), then merges `success_threshold`, `threshold_source`, `threshold_confirmed` into the goal node's `data` field.

**Canvas reflects change:** Yes — `nodes` array update triggers ReactFlow re-render.
**Inspector reflects change:** Yes — inspector reads from the same `nodes` array.
**PLoT validation:** None. Both writes are direct local store mutations.

### 2c. Success threshold mutation pathway — inspector

**Entry point:** `src/canvas/ui/inspector/GoalThresholdEditor.tsx` — `handleBlur` callback.

**One mutation only:**

- **`setGoalThreshold(value)`** — identical store action as above.

**Critical divergence:** The inspector does NOT call `updateNode()`. The goal node's `data.success_threshold`, `data.threshold_source`, and `data.threshold_confirmed` fields are **not updated** when the threshold is set via the inspector. This means:
- The inspector threshold edit does not produce an undo history entry.
- If the store is reset or the graph is re-serialised, the threshold set via inspector is lost.
- The pre-analysis panel and inspector use different mutation pathways for the same semantic operation.

### 2d. Factor observed state mutation — inspector

**Entry point:** `src/canvas/ui/inspector-v2/useInspectorMutations.ts:48` — `setObservedValue(value)`.

Calls `updateNode(nodeId, { data: { ...node.data, observedState: { ...existing, value } } })` — same `updateNode` path as the pre-analysis panel's node mutations, including history. This pathway is correct and symmetric.

### 2e. Fields updated on goal node when target is set via pre-analysis panel

| Field | Updated? | Value set |
|-------|----------|-----------|
| `data.success_threshold` | ✅ Yes | User input (number \| null) |
| `data.threshold_source` | ✅ Yes | `'user'` if value provided, else cleared |
| `data.threshold_confirmed` | ✅ Yes | `false` (always reset on change) |
| `data.goal_threshold_raw` | ❌ No | Not touched — read-only from CEE |
| `data.goal_threshold_unit` | ❌ No | Not touched — read-only from CEE |
| `data.observedState.value` | ❌ No | Not touched |
| `store.goalThreshold` | ✅ Yes | Normalised value for PLoT |

---

## 3. Interactive reference audit

Target design requirement: **hover = canvas highlight, click = open inspector**

| Element | Component | Hover behaviour | Click behaviour | Gap |
|---------|-----------|-----------------|-----------------|-----|
| Option name | `OptionPreview` | Highlights option node on canvas (`setHighlightedNodes`, auto-clears after 3s) | Focuses option node on canvas (`focusNodeById`) — does NOT open inspector | Click should open inspector |
| Intervention factor label | `OptionPreview` | No hover behaviour | `onFocusNode(optionId)` — focuses option, not the factor | Should highlight factor node on hover; click should open factor inspector |
| Improvement item (factor) | `AllImprovements` | Highlights node on canvas (parent row `onMouseEnter`) | Confirm/Assumption/Edit buttons are separate — row click does nothing | Row click should open inspector |
| Edit action button | `AllImprovements` | N/A | Calls `onEdit(targetId)` → `focusNodeById` — focuses canvas, does NOT open inspector | Should open inspector |
| Edge reference (low-confidence edge review) | `AllImprovements` | Highlights edge on canvas | Focuses edge on canvas — no inspector | Should open edge inspector |
| WorthInvestigating factor name | `WorthInvestigating` | Sets `hoveredFromPanel` via HighlightContext (behind `isCrossHighlightEnabled()` flag) | `onSetValue(factorId)` → `selectNodeWithoutHistory(factorId)` + `focusNodeById(factorId)` | ✅ Correct — `selectNodeWithoutHistory` triggers inspector to show. Flag must be on for hover to work. |
| Goal label | `SuccessTarget` | No hover behaviour wired | Goal dropdown or static label — no click-to-inspect | Should highlight goal node on hover; click should open goal inspector |
| Node links in ModelSnapshot | `ModelSnapshot` | `onHoverNode('node', id)` → highlights on canvas (3s auto-clear) | `onFocusNode(nodeId)` → canvas focus — no inspector | Should open inspector |

**Summary:** WorthInvestigating is the only section where click correctly opens the inspector (via `selectNodeWithoutHistory`). All other node/edge references use canvas focus only. The pattern needed across the panel is `selectNodeWithoutHistory(id)` before or instead of `focusNodeById(id)`.

---

## 4. Section gap analysis

### 4a. Decision health summary

**Current:** No visual health indicator exists in the pre-analysis panel. The `Header` component shows a text status line with icon only ("✓ Ready · N to review"). The `StickyFooter` shows a coloured dot + text status. There is no ring, bar chart, or numerical health score anywhere in the implementation.

**Wireframe v2 requires:** Multi-ring SVG (outer = structure, middle = evidence, inner = calibration), numerical score (e.g. "62"), 4 dimension mini-bars (Complete, Evidence, Balance, Calibrated), and a dismissible coaching line.

**Gap:** Entire decision health ring + dimension bars component is missing. The `ceeQuality` object (`CeeQualityDimensions`) exists in the store and is passed to `ModelSnapshot`, but no component renders it as a ring or health score in the panel header area. **This is a net-new component.**

**Data source for ring:** `ceeQuality` from `usePreAnalysisData()` (populated from `store.ceeQuality`). Whether the 4 specific dimensions (Complete, Evidence, Balance, Calibrated) map to existing CEE quality fields needs verification — the `CeeQualityDimensions` type is not shown in the explored types.

### 4b. Goal and success target

**Current (`SuccessTarget.tsx`):**
- Goal label shown (clickable dropdown if multiple goals exist, static text if one).
- Success threshold shown with raw value when `goalThresholdRaw` is populated by CEE, normalised fallback.
- Source badge: "From brief" (success, `brief_extraction`) or "AI estimate" (info, `ai`/`cee_inference`).
- Inline edit: ✅ Works — expands input, saves via `onThresholdChange(value)` → `setGoalThreshold` + `updateNode`. Does persist to store.
- No-goal CTA: ✅ Yes — `BlockersSection` renders "No goal selected" blocker with "Set goal with AI" CTA when `goalNode === null`.
- Confirm button: ✅ Present — calls `onThresholdConfirm()`.

**Wireframe v2 changes vs current:**
- Wireframe shows confirmed state with a persistent checkmark action button — current implementation has this.
- Wireframe shows "Also opens in inspector for full editing" hint — not currently shown.
- Wireframe shows the goal label as clickable (hover highlights goal node on canvas) — currently no hover highlight on goal label.

**Gap:** Goal label does not highlight goal node on hover. No hint text "Also opens in inspector for full editing" after save. These are minor additions.

### 4c. Options section

**Current (`OptionPreview.tsx`):**
- Options listed ✅ — each with name, status badge ("Ready" / "Needs mapping").
- Intervention targets shown ✅ — factor label + direction arrow + new value.
- Raw values: **Partially** — `formatInterventionDisplay()` converts normalised intervention value using `cap` + `unit` from CEE `intervention_hints`. When cap/unit available the display is "£50k". When only qualitative (no unit, no cap), shows "to high". There is no before/after display (e.g. "£30k → £50k") — only the "to £50k" form. The before-value would require `observedState.raw_value` from the factor node.
- Delta bar: Not implemented — wireframe shows a bidirectional delta bar and % change. This is missing.
- Intervention data source: `ceeAnalysisReady.options[].interventions` (canonical) or fallback to `node.data.interventions`.

**Gap:** Before-value ("£30k →") not shown. Delta percentage and bar not shown. These require `observedState.raw_value` from the factor node, which is typed on `ObservedState` and populated when CEE provides it.

### 4d. Decision quality checks

**Current (`DecisionQualityChecks.tsx` + `usePreAnalysisData.ts:1279–1423`):**

8 checks implemented (not 6 as briefed — 2 additional found):

| Check ID | Trigger condition |
|----------|-----------------|
| `no_risks` | `nodesByKind.risk.length === 0` (line 1284) |
| `no_baseline` | No explicit `is_baseline` option AND `optionNodes.length >= 2` (line 1295) |
| `goal_baseline_missing` | `goalNode` exists AND `observedState.value === null` (line 1314) |
| `all_positive_edges` | No edges with `direction === 'negative'` AND `edges.length > 0` (line 1327) |
| `same_levers` | >80% intervention factor overlap across non-baseline options (line 1339) |
| `zero_external_factors` | `factors.length >= 3` AND no `category === 'external'/'observable'` (line 1369) |
| `many_ai_estimates` | AI-sourced factors > brief-sourced factors (line 1390) |
| `no_target` | `successThreshold === null` AND (goal has quantitative hint OR user cleared it) (line 1404) |

**Category pills:** ✅ Present — "Framing" or "Verify" pill per check, rendered inline with title.
**Position:** Pill is on the same row as the check title in current implementation. Wireframe v2 shows pills on the title line — this matches.
**CTA actions:** ✅ Work — `onAction(ctaAction)` routes to handlers (e.g. `scroll_to_assumptions` scrolls to AllImprovements, `add_baseline` triggers addStatusQuoBaseline).
**Max visible:** 3 checks, collapsible "N more" toggle.

**Gap:** Check count (8 implemented vs 6 in brief) — this is a discrepancy to clarify with the team, not a bug.

### 4e. Review assumptions

**Current (`AllImprovements.tsx`, "reviewAssumptions" tier):**

- **Filter:** Factors with `source === 'cee_inference'` OR `source === 'brief_extraction'` OR `source === 'user_confirmed'` / `source === 'user_assumption'` (`usePreAnalysisData.ts:399–415`). These are shown in the "Review assumptions" tier.
- **CEE inference factors:** ✅ Yes — `source === 'cee_inference'` is included.
- **Brief extraction factors:** ✅ Yes — `source === 'brief_extraction'` is included (shown with "From brief" pill, already confirmed state).
- **Values displayed:** Raw values when available (`raw_value` + `unit` from `observedState`). Falls back to normalised value with cap context. `formatObservedStateDetail()` at `usePreAnalysisData.ts:471–509` prefers raw.
- **Progress indicator:** ✅ Present — progress bar + "N of M reviewed" text at top of tier.
- **Confidence spectrum:** Not in current implementation. Wireframe v2 shows a horizontal spectrum track (AI estimate → From brief → Verified) with dots per factor. This is a net-new component.
- **Contested cards:** Not in current implementation. Wireframe v2 shows a special card for `low_confidence_edges` with quick-select buttons (Weakly / Moderately / Strongly). Current implementation shows `low_confidence_edges` as standard improvement items without the quick-select UI.
- **Subgroup dividers:** Not in current implementation. Wireframe v2 shows "Contested (2)", "AI estimates (2)", "From your brief (1)" subgroup labels. Current implementation shows all items in a flat list within the tier, no subgroup differentiation.

**Actions (confirm/query/edit):**
- Confirm ✅: `onConfirm(nodeId)` → `updateNode` → sets `source: 'user_confirmed'`, `user_confirmed: true`, invalidates `ceeAnalysisReady`.
- Query/Ask AI ✅: Routes to AI chat prompt.
- Edit ✅: `onEdit(nodeId)` → `selectNodeWithoutHistory` + `focusNodeById` → opens inspector (same pattern as WorthInvestigating).

**Gap:** Confidence spectrum, contested card with quick-select, and subgroup dividers are all missing — these are significant new UI pieces.

### 4f. Worth investigating

**Current (`WorthInvestigating.tsx`):**

- Factors with `observedState.value === null` appear here.
- Ranking: by in-degree (edges targeting factor), then alphabetically. Comment in code: "Replace with pipeline VOI when available."
- "Set value" button: Opens inspector via `selectNodeWithoutHistory(factorId)` + `focusNodeById(factorId)`. ✅ Correct behaviour per target design.
- "Ask AI to research" button: Not implemented — `WorthInvestigating` has no AI-submission action. There is no `onAskAI` prop or equivalent.
- **Inline editor:** Not implemented. Wireframe v2 shows "Set value" opening an inline editor inside the card. Currently it opens the inspector instead.
- **Influence percentage:** Not shown. `connectivityScore` (raw edge count) is derived but not displayed as a "Drives N%" label. Requires VOI data from PLoT.
- Feature flag: Behind `isPreAnalysisEnrichedEnabled()`.

**Gap:** "Ask AI to research" not implemented. Inline editor not implemented (opens inspector instead — arguably acceptable but doesn't match wireframe). Influence percentage not shown (no VOI data available yet).

### 4g. More improvements

**Current (`AllImprovements.tsx`, "optional" tier):**

- Default state: **Collapsed** (`config.defaultExpanded = false`). Zero items visible until expanded.
- Within it, `add_evidence` items have their own sub-collapse ("View all" toggle), also collapsed by default.
- Sorting: Items sorted by `strength` field when available (influence proxy). Falls back to label sort.

**Gap:** Wireframe v2 shows items sorted by influence percentage. This requires VOI/sensitivity data from PLoT which is not yet available in the pre-analysis context. The sort order is currently heuristic.

### 4h. Draft notes

**Current (`ModelAdjustments.tsx`):**

This is not a "draft notes" section — it is the **model adjustments / auto-repairs** component, which corresponds to what the wireframe calls "Draft notes".

- **Constraints shown:** Derived from `ceeAnalysisReady.model_adjustments`. Labels are human-readable: resolved by looking up the target node's label, then title-casing the `target` field.
- **Auto-fixes:** Shown as adjustment cards with `reason` text from CEE.
- **Format:** Prose sentences (e.g. "Moved 'Monthly Churn Rate' to external"), not JSON paths.

**Gap:** Wireframe v2 shows a collapsible "Draft notes" row with two sub-sections ("Constraints applied" and "Auto-fixes applied"). Current `ModelAdjustments` is an accordion card but does not separate constraints from auto-fixes — all adjustments are shown in a flat list with a shared expand/collapse. The "Constraints applied" sub-label is missing.

### 4i. Model snapshot

**Current (`ModelSnapshot.tsx`):**

- **Format:** Accordion-style tree per node kind (goal, decision, option, factor, risk, outcome). Not a flow diagram. Collapsed by default.
- **Quality scores:** ✅ Shown — from `ceeQuality` field. Score thresholds: ≥7 = success colour, ≥4 = warning, <4 = danger.
- **Items clickable:** ✅ Node name links are clickable — call `onFocusNode(nodeId)` (canvas focus, not inspector open).
- **Metrics shown:** Node count per kind, edge count, intervention coverage (when feature flag on), goal measurability.

**Gap:** Wireframe v2 shows a mini flow diagram (Options → Factors → Outcomes → Goal with dot nodes) which is different from the current tree layout. The flow diagram is a net-new visual component. Wireframe also shows a "Connectivity: 9 of 9 · Evidence: 1 of 13 · Quality: 8/10" stats row — current implementation shows per-kind quality scores but not these aggregate connectivity/evidence stats.

### 4j. Sticky footer

**Current (`StickyFooter.tsx`):**

- **States:** Checking (spinner), Updating draft (spinner), Ready (checkmark + success colour), Blocked (X + danger colour), Not ready (alert triangle + body colour).
- **Analyse button:** Disabled (visual only — no `disabled` attribute, just style changes) when `hasBlockers`. Enabled when ready.
- **Review count:** ✅ `{reviewedCount}/{totalReviewableCount} reviewed` — matches "Review assumptions" tier count via same `reviewedCount`/`totalReviewableCount` props from `usePreAnalysisData`.
- **Tooltip:** Shows evidence source breakdown on hover ("All AI-estimated", "Most from brief", etc.).

**Gap:** Wireframe v2 shows the footer meta text as "· 1/5 reviewed" (same as current). No functional gap here. Minor: wireframe shows a "Fix N issue" text in blocked state — current implementation shows "{blockerCount} to address" which is equivalent.

---

## 5. Behavioural science / bias guidance audit

### 5a. Deterministic decision quality checks

8 checks are implemented (see section 4d). The brief stated 6 — the two additional are `zero_external_factors` and `no_target`. All checks are deterministic (computed from graph state, no AI involvement).

### 5b. CEE-provided bias_findings

- `CEEBiasFinding` interface is defined in `src/adapters/cee/types.ts:148–157`.
- `bias_findings` lives on `CEEInsightsResponse` (`src/adapters/cee/types.ts:159–167`) — a **separate response type** from `CEEv3Response`/`CEEAnalysisReady`.
- `CEEAnalysisReady` (the object stored in `store.ceeAnalysisReady` and consumed by the panel) does **not have a `bias_findings` field**.
- **Conclusion:** `bias_findings` is architecturally isolated from the pre-analysis panel's data pathway. It cannot be surfaced without either: (a) adding `bias_findings` to `CEEAnalysisReady` and having CEE emit it there, or (b) a separate API call that fetches `CEEInsightsResponse`.
- **Current UI:** Not surfaced anywhere in the pre-analysis panel or elsewhere in the app. `GuidancePanel.tsx` and `InsightsTab.tsx` reference `bias_findings` in imports but do not render it.

### 5c. Five pre-analysis behavioural triggers

A search for the "5 pre-analysis behavioural triggers from the canvas experience spec" found no matching implementation. The relevant coaching mechanisms currently in use are:

- `coachingSummary` string from `ceeAnalysisReady.coaching_summary` — displayed as dismissible coaching line in panel.
- `isMinimalGraph` coaching card in `PreAnalysisPanel` — alerts when model has <3 nodes or <2 edges.
- `useGraphReadiness.ts` — used for pre-draft validation (CEE coaching triggers), separate from the pre-analysis panel.
- Guidance strip (`GuidanceStrip.tsx`) — shows top-priority `guidanceItems` from orchestrator envelope.

No evidence of 5 specific named triggers implemented as a distinct system within the pre-analysis panel.

### 5d. Overlap / contradiction assessment

The quality checks (section 4d) and the guidance/coaching system (GuidanceStrip, coachingSummary) could surface overlapping messages. For example, `many_ai_estimates` quality check and a CEE `coaching_summary` about AI estimates could both appear simultaneously. No deduplication logic observed.

---

## 6. DS v5 compliance spot-check

Findings limited to `src/canvas/components/pre-analysis/` components.

| Violation | Location | Severity |
|-----------|----------|----------|
| Raw typography: `text-xs` | `AllImprovements.tsx:805` | Medium |
| Raw typography: `text-sm` | `GoalBaselineInput.tsx:166` | Medium |
| Raw typography: `font-medium` | `ModelAdjustments.tsx:214` | Medium |
| Square corners on CTAs: `rounded-md` | `AllImprovements.tsx:542, 547, 593, 606` (and 20+ instances across panel files) | Medium |
| Square corners on CTAs: `rounded-md` | `DecisionQualityChecks.tsx:55`, `PreAnalysisPanel.tsx:674` | Medium |
| Unicode checkmark `'✓'` as icon | `AllImprovements.tsx:156`, `Header.tsx:84` | Low — should be `<Check>` Lucide icon |
| Emoji-adjacent: inline SVG in PreMortemSection | `PreAnalysisPanel.tsx:50` — uses `border-t-warning` for accent, no emoji | ✅ Pass |
| Filled backgrounds on pills | None found — all pills use `bg-transparent border-{colour}/30` | ✅ Pass |
| Coloured fill on cards | None found — all cards use `bg-panel` or `bg-panel-hover` | ✅ Pass |
| All-caps headers | None found — all section labels are sentence case | ✅ Pass |

**Summary:** The main DS violations are `rounded-md` CTAs (should be `rounded-full` / `border-radius: 999px` per DS spec) and scattered raw typography utilities. No major colour or structural violations. Approximately 25+ CTA/button elements use `rounded-md` instead of `rounded-full`.

---

## 7. Data availability check

Based on type definitions (`src/adapters/cee/types.ts`) and the fixture at `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json`.

| Field | Typed? | Populated in fixture? | Notes |
|-------|--------|----------------------|-------|
| `observedState.raw_value` | ✅ `ObservedState:25` | ✅ Yes (e.g. `raw_value: 49`) | Available now |
| `observedState.raw_unit` | ❌ Not in `ObservedState` type | ✅ Present in fixture as `unit` field | `unit` is typed; `raw_unit` is not a distinct field — same field |
| `observedState.source` | ✅ `ObservedState:28` (as `string`) | ✅ Yes (`'brief_extraction'`, etc.) | No enum — string union |
| `observedState.uncertainty_drivers` | ❌ Not in `ObservedState` type | ✅ Present in fixture as array of strings | Type gap — cast as `any` or accessed via `[key: string]: unknown` |
| `observedState.unit` | ✅ `ObservedState:27` | ✅ Yes (e.g. `"£"`, `"%"`) | Available now |
| `observedState.cap` | ❌ Not in `ObservedState` type | ✅ Present in fixture | Accessed via spread/unknown |
| `analysis_ready.options[].interventions` with target values | ✅ `CEEOptionV3:276` | ✅ Yes — `Record<string, CEEInterventionV3>` with value | `CEEInterventionV3` has `value`, `source`, `value_confidence` |
| `CEEInterventionV3.raw_value` (before-value for £30k→£50k) | ❌ Not typed | ❌ Not in fixture | Before-value must come from factor node `observedState.raw_value`, not intervention |
| `quality.overall` | ✅ `CEEv2Response:71` as `quality_overall` | ✅ Yes | Field name is `quality_overall`, not `quality.overall` |
| `quality.structure`, `.causality`, `.coverage`, `.safety` | Depends on `CeeQualityDimensions` type (not explored in detail) | Unknown | Need to check `CeeQualityDimensions` type definition |
| `goal_threshold_raw` | ✅ `CEEAnalysisReady:322` | Unknown (fixture is orchestrator-level, not raw CEE) | Typed and should be available when CEE V3 provides it |
| `goal_threshold_unit` | ✅ `CEEAnalysisReady:324` | Unknown | Typed and should be available |
| `bias_findings` | ✅ `CEEInsightsResponse:161` | Not on `CEEAnalysisReady` pathway | Cannot reach pre-analysis panel without CEE contract change |
| `trace.pipeline.strp.mutations` | Partial — `CeePipelineTrace` type exists, exact field uncertain | Unknown | `model_adjustments` on `CEEAnalysisReady` is the current equivalent |
| `trace.pipeline.repair_summary.deterministic_repairs` | ✅ `repairActions` field derived in `usePreAnalysisData` | Unknown | Surfaced in `ModelAdjustments` |

**Key data gaps for wireframe v2:**
1. **`observedState.uncertainty_drivers`** — not formally typed on `ObservedState`. Present in fixture data. Need type update.
2. **Before-value for option intervention display** (e.g. "£30k →") — must come from factor `observedState.raw_value`; `CEEInterventionV3` does not carry the before-value. Workable today using existing data.
3. **`bias_findings`** — requires CEE contract change to include on `CEEAnalysisReady`.
4. **VOI / influence percentages** — not available in pre-analysis context; `WorthInvestigating` uses graph connectivity heuristic as placeholder. Requires PLoT sensitivity analysis output.
5. **`CeeQualityDimensions` sub-fields** — need to verify which dimensions map to the wireframe's Complete / Evidence / Balance / Calibrated axes.

---

## 8. Summary: blocking issues

Prioritised list of issues that must be resolved before implementing the wireframe v2 design:

### P0 — Blocking (must fix before any wireframe v2 work)

1. **Inspector mutation divergence** — `GoalThresholdEditor` in the inspector calls only `setGoalThreshold()`, not `updateNode()`. The pre-analysis panel calls both. These pathways must be unified or the threshold will be lost on graph serialisation when set via inspector. Fix: make `GoalThresholdEditor` also call `updateNode` with the same fields as the pre-analysis panel, or extract a shared `setThreshold(value)` action.

2. **Click does not open inspector for most node/edge references** — Only `WorthInvestigating` and `AllImprovements` edit action correctly open the inspector via `selectNodeWithoutHistory`. Option names, goal label, ModelSnapshot node links, and improvement item row clicks all use canvas focus only. The wireframe requires click = inspector everywhere. Fix: replace `focusNodeById(id)` with `selectNodeWithoutHistory(id); focusNodeById(id)` as the pattern for all node/edge references in the panel.

### P1 — Required for wireframe v2 completeness

3. **Decision health ring component is entirely missing** — No ring, no score, no dimension bars exist. This is the most visually prominent new element in wireframe v2. Requires: (a) defining which `ceeQuality` fields map to the 4 dimensions, (b) building the SVG ring component, (c) integrating into the panel header area.

4. **Confidence spectrum is missing** — The horizontal spectrum track (AI estimate → From brief → Verified with per-factor dots) in the Review assumptions section is not implemented. This is a net-new visual component.

5. **Contested edge quick-select cards are missing** — `low_confidence_edges` from CEE are currently shown as standard improvement items. Wireframe v2 requires a dedicated card with quick-select buttons (Weakly / Moderately / Strongly) and "drives N% of the outcome" context. This requires access to edge sensitivity/influence data (not currently available in pre-analysis context — may need to be supplied by CEE).

6. **`observedState.uncertainty_drivers` is not typed** — Field is present in fixture data and referenced in code via spread, but not on the `ObservedState` interface. Update `src/adapters/cee/types.ts:ObservedState` to add `uncertainty_drivers?: string[]`.

7. **WorthInvestigating "Ask AI to research" not implemented** — Button exists in wireframe but has no implementation. Requires AI chat message submission pathway similar to quality check CTAs.

8. **Before-value missing from intervention display** — OptionPreview shows "to £50k" but not "£30k →". Factor `observedState.raw_value` provides the before-value; this just needs to be plumbed into `OptionPreview` via `optionPreviews` data in `usePreAnalysisData`.

### P2 — Polish / DS compliance

9. **~25+ CTA buttons use `rounded-md` instead of `rounded-full`** — DS v5 requires pill-shaped buttons (`border-radius: 999px`). Systematic find-replace across all pre-analysis panel files.

10. **Unicode checkmark `'✓'` used as icon** — Replace with `<Check>` from `lucide-react` in `AllImprovements.tsx:156` and `Header.tsx:84`.

11. **Subgroup dividers missing in Review assumptions** — Wireframe v2 shows "Contested (2)", "AI estimates (2)", "From your brief (1)" sub-labels within the tier. Currently flat list. Requires grouping logic in `AllImprovements` or `usePreAnalysisData`.

12. **ModelSnapshot uses tree layout, not mini flow diagram** — Wireframe v2 shows a horizontal flow (Options → Factors → Outcomes → Goal). Current implementation is a vertical per-kind tree. Low priority — current form is functional but visually different.

### P3 — Requires CEE contract changes (not implementable today)

13. **`bias_findings` not on `CEEAnalysisReady` pathway** — `bias_findings` lives on `CEEInsightsResponse`, a separate type. Cannot be surfaced in the pre-analysis panel without CEE adding it to the `analysis_ready` block or a new API call.

14. **VOI / influence percentages not available pre-analysis** — "Drives 22%" labels in WorthInvestigating and "More improvements" sorting require sensitivity analysis output from PLoT. Currently replaced with graph connectivity heuristics. Not implementable until PLoT provides pre-analysis VOI.

15. **`CeeQualityDimensions` sub-fields need verification** — Confirm which fields map to the wireframe's Complete / Evidence / Balance / Calibrated dimensions before building the health ring.
