# Canvas & Decision Graph — Comprehensive Audit v1

**Date:** 2026-04-14
**Branch:** staging
**Scope:** Investigation-only. No code changes. Ground-truth establishment before further implementation.

All findings cite exact `file:line`. Surprises are flagged **🚩**. Claims reflect code read at audit time.

---

## Part 1 — Data flow: CEE response → canvas node

### 1A: `display_value` consumption

**Grep inventory (10 files):**

| # | File | Role |
|---|------|------|
| 1 | `src/utils/formatFactorDisplayValue.ts:42` | Interface field on `FactorDisplayInput` |
| 2 | `src/utils/formatFactorDisplayValue.ts:49-50` | First-priority return (verbatim) |
| 3 | `src/canvas/nodes/FactorNode.tsx:37` | `ObservedState` interface field |
| 4 | `src/canvas/nodes/FactorNode.tsx:231` | Passed into `formatFactorDisplayValue` |
| 5 | `src/canvas/utils/labelUtils.ts` | Referenced in inventory comments |
| 6 | `src/canvas/utils/__tests__/applyDraftResult.spec.ts:649-669` | Preservation test |
| 7 | `src/canvas/utils/__tests__/observedStateHelpers.spec.ts:5-49` | `factorNeedsInput` predicate test |
| 8 | `src/canvas/utils/observedStateHelpers.ts:86-92` | `factorNeedsInput` checks display_value |
| 9 | `src/components/debug/utils/exportBundle.ts` | Debug export passthrough |
| 10 | `src/test/fixtures/golden-path-staging-2026-04-05.json:54,127,150,241` | Real fixture samples |

**Render path (FactorNode body text):**
- `src/canvas/nodes/FactorNode.tsx:221-233` — `valueDisplay` useMemo calls `formatFactorDisplayValue({label, value, raw_value, unit, factor_type, cap, category, display_value})`.
- `src/utils/formatFactorDisplayValue.ts:45-50` — checks `display_value` first, returns verbatim if non-empty, before any heuristic.

**Pipeline preservation:**
- `src/canvas/utils/applyDraftResult.ts:37-57` — `observed_state` (with display_value) passed through on node.data.
- `src/canvas/utils/applyDraftResult.ts:290-378` — `backfillInterventionsOntoOptionNodes` only touches `interventions`/`is_baseline` on **option nodes**; does not affect factor `display_value`.
- `src/adapters/plot/v2/adapter.ts:747-797` — `observedState` is on `V2_NODE_BLOCKLIST` (line 755), but `display_value` survives via the passthrough mechanism (lines 780-785).

**Conclusion:** `display_value` infrastructure is fully wired end-to-end and rendered with absolute priority. **🚩 Gap:** render-matrix tests never set `display_value` in fixtures (see Part 9).

### 1B: Intervention data shape

- `src/adapters/cee/types.ts:259-289` — `CEEOptionV3.interventions: Record<string, CEEInterventionV3>` where `CEEInterventionV3 = { value, source, target_match?, value_confidence?, reasoning? }`. Not a plain number map.
- **🚩 `intervention_details` does not exist** anywhere in `src/`. Zero grep matches.
- Factor comparison popover: `src/canvas/nodes/FactorNode.tsx:143-207` — reads from `ceeAnalysisReady.options[id].interventions` (primary) or `opt.data.interventions` (fallback), unwraps via `unwrapInterventionValue` (line 151), formats via `formatInterventionValue` (line 199). **Does not use `display_value` from the factor.**

### 1C: `is_baseline` consumption

- Type: `src/adapters/cee/types.ts:288` — `is_baseline?: boolean | null`.
- Backfill: `src/canvas/utils/applyDraftResult.ts:314-318, 358` — writes `is_baseline` to `node.data` via direct `setState`, **bypassing history** (see 5B).
- UI reads:
  - `src/canvas/nodes/FactorNode.tsx:155-162` — explicit flag + epsilon status-quo check.
  - `src/canvas/nodes/OptionNode.tsx:52-53` — explicit flag OR `detectBaseline(label)` regex fallback.
- 13-keyword fallback: `src/canvas/utils/baselineDetection.ts:27-41` — `['keep', 'maintain', 'do nothing', 'status quo', 'current', 'existing', 'no change', 'stay', 'continue', 'as is', 'as-is', 'baseline', 'default']`.
- **🚩 Double-detection:** Both explicit flag and regex fallback run in OR; if CEE reliably emits `is_baseline`, the regex can be retired.

---

## Part 2 — Formatting pipeline

### 2A: Formatter inventory

| # | Function | File:Line | Inputs | Returns | Checks `display_value`? | Callers |
|---|----------|-----------|--------|---------|-------------------------|---------|
| 1 | `formatFactorDisplayValue` | `src/utils/formatFactorDisplayValue.ts:45` | `FactorDisplayInput` | `string \| null` | **YES (first)** | FactorNode:223, OptionNode:191 (via formatChipValue) |
| 2 | `formatInterventionValue` | `src/canvas/utils/labelUtils.ts:607` | (value, unit, factorType, cap, observedValue, observedRawValue, opts) | `string` | NO | FactorNode:199, OptionNode:127,201, GraphTextView:222,233 |
| 3 | `formatChipValue` (local) | `src/canvas/nodes/OptionNode.tsx:184` | chip struct | `string` | Indirect (calls #1 first) | OptionNode intervention chips |
| 4 | `formatRawValueWithUnit` | `src/canvas/utils/labelUtils.ts:716` | (value, unit) | `string` | NO | `OptionsSection.tsx` (model-tab) |
| 5 | `formatFactorValue` (legacy) | `src/canvas/utils/labelUtils.ts:459` | observedState | `string \| null` | NO | `inspector-v2/panels/OptionPanel.tsx` only |
| 6 | `cleanFactorLabel` | `src/canvas/utils/labelUtils.ts:65` | label | `string` | n/a | FactorNode:44,224, OptionNode:115 |
| 7 | `compactFactorLabel` | `src/canvas/utils/labelUtils.ts:124` | (label, maxLength=15) | `string` | n/a | OptionNode:115,127 |
| 8 | `qualitativeTierLabel` | `src/canvas/utils/labelUtils.ts:210` | value | `string` | n/a | formatInterventionValue:682, formatFactorValue:534 |
| 9 | `classifyUnit` | `src/canvas/utils/labelUtils.ts:315` | unit | `{kind, canonical}` | n/a | All unit-aware formatters |
| 10 | `unwrapInterventionValue` | `src/canvas/utils/labelUtils.ts:575` | raw | `number \| null` | n/a | 20+ callers |
| 11 | `stripFactorSuffixes` (local) | `src/canvas/nodes/OptionNode.tsx:24-28` | label | `string` | n/a | Local to OptionNode |
| 12 | `stripEcho` (local) | `src/canvas/nodes/OptionNode.tsx:173-181` | (label, displayValue) | `string` | n/a | **🚩 ZERO callers — dead code** |

### 2B: Call graph

```
formatFactorDisplayValue (no outbound formatter calls; primary decision tree)
formatInterventionValue ──► classifyUnit, qualitativeTierLabel
formatChipValue ──► formatFactorDisplayValue (primary) ──► formatInterventionValue (fallback)
formatRawValueWithUnit ──► classifyUnit
formatFactorValue (legacy) ──► classifyUnit, qualitativeTierLabel
```

No cycles. `classifyUnit` is the convergence point for all unit-aware formatting.

### 2C: `display_value` short-circuit analysis

- `formatFactorDisplayValue`: already short-circuits — no change.
- `formatInterventionValue`: **different data domain** (deltas, not observed state) — keep separate.
- `formatChipValue`: already respects display_value via #1.
- `formatRawValueWithUnit`: could short-circuit if a display_value were threaded in, but low payoff — already small.
- `formatFactorValue`: legacy and duplicated; **deprecate regardless**.

---

## Part 3 — Node rendering

### 3A: `FactorNode.tsx` (772 lines)

Primary flags:
- `isPostAnalysis` (line 54), `isDetailed` (line 55), `isHighPriority` (line 97), `isLowPriority` (line 98)
- `needsInput` (line 257), `isInferred` (line 253), `isExplicit` (line 254), `nodeCategory === 'external'` (line 259)
- `valueDisplay !== null` (line 605), `display_value` present (line 231-232)

Distinct render segments (lines): readiness popover (717–728), low-priority table popover (738–749), needs-input popover (via factorChips, 349–379), detailed inline (674), post-analysis popover (383–408), synthesised coaching (630–645), external "what if worsens" (649–663), anchoring coaching card (677–684), MetricPills (666–671), BiasNote (518–525), EvidenceGapBadge (538), ConstraintBadge (539), intervention hover box (541–545), science icons (551–569), action icons (702–709).

**Estimated distinct render outcomes: 18–24**, driven by product of phase × priority × state type × value presence.

### 3B: `OptionNode.tsx` (1040 lines)

Primary flags:
- `isPostAnalysis` (line 241), `isDetailed` (line 262), `isRecommended` (line 243-257)
- `closeCallGapPp` (line 268-294), `isBaselineOption` (line 372-376), `hasInterventions` (line 349-356)
- `structuredDeltas.length > 0` (line 405-451), `differentiatorLabel` (line 461-466), `behindReason` (line 520-576), `winsVia` (line 481-509), goalProbability < 0.10 (line 512-517)

Key branches: Leading-option badge & "Wins via" link (839–887), close-call warning (892–896), behind-reason (899–903), baseline pre/post (938–942, 945–956), delta pills (909–926), differentiator sentence (931–935), intervention list popover (771–817), detailed inline (681–756), completeness assessment (820–823), win probability bar (858–871), science icons (848–854).

**Estimated distinct render outcomes: 25–35.**

### 3C: `DecisionNode.tsx` (415 lines)

Flags: `isPostAnalysis` (112), `isDetailed` (113), `headline` (188-202), `optionCount > 0` (118-124), `showRunAnalysis` (129), `triageLine` (132-185), `stabilityDisplay` (264-276), `biggestRisk` (205-226).

Key branches: post-analysis headline + risk (301–328), detailed stability inline (322–327), popover stability (383–408), biggest-risk link (304–316), pre-analysis triage (334–338), run-analysis CTA (343–347), readiness breakdown popover (361–376).

**Distinct outcomes: 6–8.**

### 3D: OutcomeNode / RiskNode / GoalNode

- `OutcomeNode.tsx` (266 lines): `isPostAnalysis` (24), `isDetailed` (25), `bridgeEdgeData` (34-47), `inboundConnections` (49-50). ~4–6 paths.
- `RiskNode.tsx` (275 lines): adds severity tier (line 22 derived from p×impact), bridge edge (42-55). ~4–6 paths.
- `GoalNode.tsx` (322 lines): `hasThreshold` (57), robustness data (45-53), low-probability warning, dashed border override (90-98). ~6–8 paths.

---

## Part 4 — Edge rendering (`StyledEdge.tsx`, 932 lines)

**File:** `src/canvas/edges/StyledEdge.tsx`

- **Stroke width** (lines 197–247): pre-run `weightMagnitudeToStrokeWidth`, post-run `importanceToStrokeWidth`, lens modes (causal/evidence/robustness/sensitivity), hover/highlight overrides.
- **Stroke colour** (lines 249–272): uninitialised → yellow, partial → grey, positive → emerald-200, negative → #ef4444, weight=0 → grey.
- **Dash pattern** (lines 274–307): structural solid, contested tight/variable, pre-run dashed "6 3", existence-certainty trigraph (solid/dashed/dotted).
- **Opacity / lens** (lines 580–599): dimmed/highlighted per lens.
- **Label visibility** (line 518): compound gate requiring detailed + results mode + non-structural + (selected|hovered|suggestion|first|top-strength).

**`isStructuralEdge` (lines 418–446):**
1. Explicit `data.edge_type === 'structural'` → structural (422-430); any other explicit value → not structural (435).
2. Inference by node kind: `decision→option` → structural (439); `option→factor` → structural (442); else not (445).

**Structural edges render at fixed 1px solid grey (#B8B8B8, line 52)**, suppressing causal encoding.

**Estimated render paths: 40–60** (combinatorial across lens, hover, highlight, selection, structural classification).

---

## Part 5 — Store schema

### 5A: Top-level graph state (`src/canvas/store.ts`)

| Field | Line | Type |
|-------|------|------|
| `nodes` | 1032 | `Node[]` |
| `edges` | 1033 | `Edge<EdgeData>[]` |
| `results` | 1044-1047 | `ResultsState` |
| `runMeta` | 1048 | `RunMetaState` |
| `ceeAnalysisReady` | 1082 | `CEEAnalysisReady \| null` |
| `ceeAnalysisReadyNodeIds` | 1083 | `string[] \| null` |
| `goalConstraints` | 1085 | `CEEGoalConstraint[] \| null` |
| `ceePipelineTrace` | 1087 | `CeePipelineTrace \| null` |
| `nodeRationales` | 1089 | `Record<string, string>` |
| `ceeQuality` | 1091 | `CeeQualityDimensions \| null` |
| `ceeExtendedWarnings` | 1093 | `CEEDraftWarning[] \| null` |
| `ceeGoalConnectivity` | 1094 | `CEEGoalConnectivity \| null` |
| `ceeModelQualityFactors` | 1095 | `CEEModelQualityFactors \| null` |
| `ceeInterventionHints` | 1096 | `Record<string, CEEInterventionHint> \| null` |
| `preAnalysisSensitivity` | 1097 | `PreAnalysisSensitivity \| null` |

**Factor node data:** `ObservedState` is declared **inline** in `src/canvas/nodes/FactorNode.tsx:26-38` (includes `display_value?: string | null` at line 37). The Zod schema at `src/canvas/domain/nodes.ts:94-100` **does not** declare `observedState`. **🚩 Schema drift:** runtime shape not validated at store boundary.

**Option node data:** `src/canvas/domain/nodes.ts:67-69` declares only `{ type: 'option' }`. Fields `is_baseline`, `interventions`, and `intervention_details` are **not in the schema**; they are written as untyped extras.

### 5B: Mutations

Node: `addNode` (1184), `addNodeWithEdge` (1197), `updateNode` (447), `updateNodeLabel` (446), `deleteNodeById` (464), `deleteSelected` (463), `duplicateSelected` (466), `onNodesChange` (450), `selectNodeWithoutHistory` (453), `selectNodes` (455), `pasteClipboard` (468), `cutSelected` (469), `reseedIds` (481).

Edge: `addEdge` (457), `updateEdge` (448), `updateEdgeData` (449), `deleteEdgeById` (465), `onEdgesChange` (451), `selectEdgeWithoutHistory` (454), `updateEdgeEndpoints` (483), `beginReconnect` (484), `completeReconnect` (485).

CEE-scoped setters (556–565): `setCeeAnalysisReady`, `setGoalConstraints`, `setCeePipelineTrace`, `setCeeQuality`, `setCeeExtendedWarnings`, `setCeeGoalConnectivity`, `setCeeModelQualityFactors`, `setCeeInterventionHints`, `setPreAnalysisSensitivity`.

**🚩 `backfillInterventionsOntoOptionNodes`** (`src/canvas/utils/applyDraftResult.ts:290-378`, line 364) calls `useCanvasStore.setState({ nodes })` **directly**, bypassing `pushToHistory`. Intervention and `is_baseline` updates are invisible to undo/redo.

---

## Part 6 — Cross-surface terminology

| Term | Key locations | Phrasing variants | Flag |
|------|---------------|-------------------|------|
| "estimated"/"estimate" | `inspectorStrings.ts:76` ("Estimated by Olumi"); `DecisionNode.tsx:364` ("Estimated: N"); render-matrix.spec:225 ("Olumi estimated this from your brief"); `DriversSection.tsx:659-662,930` ("Default estimate — not yet validated"); `TriageCard.tsx:26,29` ("AI estimate. Does this match?"); `DecisionConfidencePanel.tsx:126` ("AI estimate") | Passive ("Estimated by Olumi") vs active ("Olumi estimated...") vs labels ("AI estimate", "Default estimate") | **🚩 Inconsistent voice/phrasing across surfaces** |
| "generated automatically" | `inspector-v2/coachingConfig.ts:15` only | single canonical use | OK |
| "inferred" | `adapters/cee/types.ts:232` (source enum); `blueprints/types.ts:20`; `inspectorStrings.ts:66` ("estimated because it wasn't stated explicitly"); `ProvenanceBadge.tsx:58`; `PreAnalysisPanel.tsx:64` | data-model vs user-facing | Internal/external split clear |
| "outside your control" | `RiskNode.tsx:120` (comment); `ModelAdjustments.tsx:61-64`; `DraftNotes.tsx:31,49`; `observedStateHelpers.ts:92` | 4 variants in ModelAdjustments all consistent | OK |
| "needs input" | `observedStateHelpers.ts:86,89` (predicate only); `FactorNode.spec.tsx:575` (comment) | **🚩 No rendered user-facing copy — internal predicate name** | Surface mismatch |
| "high influence" / "low confidence" | `FactorNode.tsx:324` ("High influence, low confidence."); `NodeInspector.tsx:375` ("High influence but low confidence. Consider gathering more data..."); `DriversSection.tsx:698` (chat prompt) | comma vs "but" | Threshold: influence ≥70%, confidence ≤40%. Minor phrasing drift |
| "gather evidence" | `HeroSection.tsx:619`; `DriversSection.tsx:930`; `humaniseCritique.ts:50` ("Add data or expert estimates") | "gather" / "gathering" / "add data" | **🚩 No canonical phrasing** |
| "validate"/"validation" | `services/coachingReview.ts:91-93`; `conversation/validateAnalysisReadyContract.ts`; `inspectorStrings.ts:66` ("not yet validated with evidence"); `FactorNode.spec.tsx:1123` ("What evidence supports this?") | technical term; user-facing equivalent is "evidence supports this" / "not yet validated" | Split intentional but inconsistent user copy |

---

## Part 7 — ELK layout parameters

**File:** `src/canvas/utils/layout.ts`

- **Line 30:** `const MAX_NODE_W = 300` — recent change from 260 in commit `3388283d` ("increase MAX_NODE_W from 260 to 300"). Prior baseline 260 established in `e35e54c1` (2026-04-05).
- **Line 29:** `MIN_NODE_W = 140`.
- **Line 31:** `MIN_GAP = 30`.
- **Lines 56-57:** `sizePaddingX = 24`, `sizePaddingY = 16`.
- **Lines 99-146:** Viewport-constrained width (85% of canvas) with multi-row splitting.
- **ELK config (lines 177-196):** `layered` algorithm, `LAYER_SWEEP` crossing minimisation, `NETWORK_SIMPLEX` node placement, `elk.spacing.edgeNode=40`, `elk.spacing.edgeEdge=20`.
- **Tier map (lines 8-17):** decision=0, option=1, factor/action/constraint=2, outcome/risk=3, goal=4.

**Re-layout triggers (callers of `applyLayout`):**
1. `DraftChat.tsx` — after draft insertion.
2. `ReactFlowGraph.tsx` — Cmd+Shift+L shortcut.
3. `contextMenu/useMenuItems.ts` — menu action.
4. `applyDraftResult.ts` — after clarifier patches.
5. `store.ts` — `setViewMode` with 150ms debounce (Standard ↔ Detailed).
6. `store.ts` — `applyClarifierGraph`.
7. `conversation/utils/applyPatch.ts` — after patch.
8. `layout/runLayoutWithProgress.ts` — progress-tracked runner.

---

## Part 8 — Dead code & competing implementations

- **`src/canvas/nodes/ConstraintNode.tsx`:** registered at `src/canvas/nodes/registry.ts:15` but **🚩 never rendered** — CEE emits constraints as badge data on GoalNode per registry line 30 comment.
- **`stripEcho`** (`src/canvas/nodes/OptionNode.tsx:173-181`): **🚩 zero callers — dead code.**
- **`formatFactorValue`** (`src/canvas/utils/labelUtils.ts:459`): legacy; only caller is `inspector-v2/panels/OptionPanel.tsx`. Candidate for deprecation.
- **`formatFactorDisplayValue`:** active; 2 callers (FactorNode, OptionNode via formatChipValue). Not superseded.
- **Popover implementations:** unified. All node hover popovers route through `src/canvas/nodes/shared/NodePopover.tsx` + `usePopoverHover` hook (FactorNode:2×, OptionNode:1×, GoalNode:1×, RiskNode:2×). Edge uses a separate `src/canvas/edges/EdgeEditPopover.tsx` (fixed-position, not portal) for inline editing — intentional. **No competing implementations.**
- **Symbol search:**
  - `ResultsPanel`: imported by `src/routes/PlotWorkspace.tsx` (legacy route); `src/components/ResultsPanel.tsx` still active in legacy sandbox path.
  - `PreAnalysisReadinessPanel`, `PreAnalysisReadinessPanel.legacy`, `NodeInspectorCompact`, `InspectorPopover`, `EdgeInspectorCompact`: **🚩 not referenced anywhere** — stale names.

---

## Part 9 — Test coverage reality

**Primary matrix:** `src/canvas/nodes/__tests__/render-matrix.spec.tsx` (899 lines, ~39 cases).

| Node × Phase × View | Cases |
|---------------------|-------|
| FactorNode | 5 (coverage skewed toward high-priority + inferred) |
| OptionNode | 10 (close-call logic **only in Standard post**) |
| DecisionNode | 4 (one per phase×view) |
| GoalNode | 4 |
| OutcomeNode | 4 |
| RiskNode | 4 |
| Health/meta | 8 |

**🚩 Zero-coverage combinations:**
1. OptionNode × **Detailed × close-call** thresholds (3pp, 1pp, sub-1pp) — only Standard post tested.
2. Multi-inferred ranking ranks 2–3 (only rank 1 and rank 4 asserted).
3. Detailed pre-analysis differentiator arithmetic (only gate assertion).
4. Lens/dimming edge interactions entirely out of matrix scope.

**Fixtures:**
- Render-matrix uses **synthetic inline data** (minimal fields only). Example: `render-matrix.spec.tsx:162-174` has no `uncertainty_drivers`, no `encoding_map`, no caps.
- Real-shape fixture `src/test/fixtures/golden-path-staging-2026-04-05.json` (full CEE+ISL flow, includes `display_value: "No acquisition pursued"` at line 54, "12 months" at 150) is **not used by the render matrix** — integration-only.

**🚩 `display_value` in test fixtures:**
- Direct unit tests: `src/utils/__tests__/formatFactorDisplayValue.spec.ts:75-89`, `src/canvas/utils/__tests__/applyDraftResult.spec.ts:649-669` ("£49"), `src/canvas/utils/__tests__/observedStateHelpers.spec.ts:5-49`.
- **Never set in render-matrix fixtures.** 125 FactorNode/render-matrix assertions, zero exercise the `display_value` → rendered body path. Regression risk for the `{value: 0, display_value: 'No X in place'}` case.

---

## Part 10 — Inspector ↔ graph consistency

### 10A: Factor panel

- Inspector (`src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx:50-90`): reads `observedState.{value, raw_value, cap, unit, source}`, `uncertainty_drivers`. **🚩 Does not read `display_value`.**
- Graph (`src/canvas/nodes/FactorNode.tsx:42, 221-233`): reads the same fields **and** `display_value`, routed through `formatFactorDisplayValue`.
- **Divergence:** FactorNode displays CEE-verbatim text (e.g. "£49k"); inspector renders numeric-only.

### 10B: Option panel

- Inspector (`src/canvas/ui/inspector-v2/panels/OptionPanel.tsx:35-100`): reads `interventions` (as `Record<string, unknown>`, line 73).
- Graph (`src/canvas/nodes/OptionNode.tsx:52, ~201`): reads `is_baseline` and renders "No changes" when true; checks `detectBaseline` fallback.
- **🚩 Divergence:** OptionPanel does **not** indicate baseline status visually.

### 10C: Edge panel vs popover

- `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:126-150`: reads `edge.data.weight`, `edge.data.belief`; exposes confidence, direction, and uncertainty band.
- `src/canvas/edges/EdgeEditPopover.tsx:19-20`: reads same `weight` and `belief`.
- **Consistent core data.** Inspector is richer (confidence + direction + uncertainty); popover is minimal edit-only.

### 10D: Coaching strings

- Central config: `src/canvas/ui/inspector-v2/coachingConfig.ts` (keys: edgeWeight, decisionOptions, optionCoverage, factorControllableEvidence, factorObservableData, factorExternalUncertainty, outcomeCompleteness, riskControlLevers, goalConnections, goalEvidence, goalNoTarget).
- Graph chips (FactorNode, OptionNode, BaseNode): **do not render coaching text**. `BaseNode.tsx:~40` renders type descriptions only.
- **No divergence because graph does not attempt coaching.** By design — coaching is inspector-only.

---

## Summary of surprises (🚩)

1. **`intervention_details` does not exist** — the field name the audit brief assumed. CEE uses `CEEInterventionV3` objects inline on `interventions`.
2. **`stripEcho` is dead code** in OptionNode.tsx.
3. **`ConstraintNode` never renders** — registered but CEE emits constraints as GoalNode badges.
4. **Schema drift:** `observedState`, `display_value`, `is_baseline`, `interventions` live outside the Zod schema in `canvas/domain/nodes.ts` — no validation at store boundary.
5. **`backfillInterventionsOntoOptionNodes` bypasses history** — intervention/`is_baseline` mutations are invisible to undo/redo.
6. **Inspector does not read `display_value`** (FactorControllablePanel) — inconsistent with FactorNode rendering.
7. **Inspector does not indicate `is_baseline`** (OptionPanel) — inconsistent with OptionNode.
8. **Render-matrix never sets `display_value`** — 125 FactorNode assertions, zero exercise the CEE verbatim path.
9. **Close-call logic only tested in Standard × post** — Detailed close-call gating untested.
10. **Terminology drift:** "estimated" variants (passive/active/"AI estimate"/"Default estimate") not reconciled across surfaces. "gather evidence" has three phrasings. "needs input" is an internal predicate only — no user-facing rendered copy.
11. **13-keyword baseline regex fallback** still runs in OR with explicit `is_baseline` flag — double-detection.
12. **Stale symbols** `PreAnalysisReadinessPanel`, `NodeInspectorCompact`, `InspectorPopover`, `EdgeInspectorCompact` not imported anywhere.
13. **`MAX_NODE_W` changed 260 → 300** in the most recent layout commit (`3388283d`).

---

*End of audit — investigation only, no code changes made.*
