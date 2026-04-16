# UI Data Alignment Audit v1

**Date:** 2026-03-23
**Scope:** Every UI surface — canvas graph, inspector panels, pre-analysis tab, post-analysis results, model tab
**Method:** Source-level trace of every data field from canonical store to rendered pixel
**Verdict:** Scientific model is correct; **4 critical cross-surface inconsistencies** and **4 medium-severity visual divergences** identified

---

## Table of Contents

1. [Canvas Graph](#1-canvas-graph)
2. [Node Inspector Panels](#2-node-inspector-panels)
3. [Edge Inspector Panel](#3-edge-inspector-panel)
4. [Pre-Analysis Tab](#4-pre-analysis-tab)
5. [Post-Analysis Tab](#5-post-analysis-tab)
6. [Model Tab](#6-model-tab)
7. [Cross-Surface Consistency](#7-cross-surface-consistency)
8. [Threshold Inventory](#8-threshold-inventory)

---

## 1. Canvas Graph

### 1.1 Node Border Colour

**Source:** Entity kind → `nodeColors` map (`src/canvas/nodes/colors.ts`)
**Applied at:** `BaseNode.tsx:228` via `${colors.border}`

| Node Kind | Border Colour Token | Encoding Channel |
|-----------|-------------------|-----------------|
| goal | `border-goal` | Entity kind (shape channel) |
| decision | `border-info` | Entity kind |
| option | `border-option` | Entity kind |
| outcome | `border-success` | Entity kind |
| factor | `border-factor` | Entity kind |
| risk | `border-danger` | Entity kind |

**Post-analysis override (GoalNode only):** `GoalNode.tsx:69-76`
- `robustnessData.level === 'moderate'` → `border-info border-dashed`
- `robustnessData.level === 'low'` → `border-danger border-dashed`
- `'high'` or absent → no override (entity colour, solid)

**Factor controllability border style:** `graphDisplayCalculations.ts:190-206`
- `controllable` → `border-solid`
- `observable` → `border-dashed`
- `external` → `border-dotted`
- `partial` → `border-dashed`
- `unknown` → `border-solid` (P1 hotfix: no visual distinction)

**Border width:** `BaseNode.tsx:190-193`
- Factors without category: `border` (1px)
- All other nodes: `border-2` (2px)

**Verdict:** Correct. Border colour encodes entity kind (shape channel), border style encodes controllability (sub-channel of shape), post-analysis GoalNode border encodes robustness level. No colour channel collision.

---

### 1.2 Confidence Glyph Badges

**There is no single "confidence glyph" on nodes.** Multiple badge systems exist:

1. **UnifiedStatusBadge** (`src/canvas/components/UnifiedStatusBadge.tsx:49`)
   - Derives from `readiness` + `quality` score
   - Thresholds: quality ≥ 0.7 → success (checkmark), ≥ 0.5 → warning (triangle), else error (X)
   - **UI-SEM-018**: Fabricates numeric confidence from categorical labels (high=0.8, medium=0.5, low=0.3)

2. **NodeBadge** (`src/canvas/components/NodeBadge.tsx`)
   - CEE structural warnings (orphan, cycle, logic issues)
   - Max 2 badges, sorted by priority
   - Top-right inside node, coloured circles

3. **EvidenceGapBadge** (`src/canvas/nodes/EvidenceGapBadge.tsx`)
   - Shows when factor has no observed data
   - Bottom-right outside node wrapper
   - Escalation: `none` → warning border, `warning` → pulsing warning, `critical` → pulsing danger

4. **Pre-run "?" badge** (`BaseNode.tsx:134-154`)
   - Goal without threshold → blue "?" circle, title "Set a success threshold"

**Verdict:** No single confidence glyph. Multiple independent badge systems with different data sources. UnifiedStatusBadge's fabricated scores (UI-SEM-018) should be removed when PLoT provides numeric confidence.

---

### 1.3 On-Node Values

**FactorNode** (`src/canvas/nodes/FactorNode.tsx:88-109`):
- Shows `formatFactorValue(observedState)` — prefers `raw_value` + unit, falls back to normalised `value` with cap-based denormalisation
- Qualitative factors (no unit, no cap): value=0 → "Not used", value=1 → "Very high"
- External factors: shows `Variable: {min}–{max}` from `prior.range_min/range_max` (`FactorNode.tsx:111-117`)
- Pills: "estimated" (extractionType=inferred) or "assumed" (source=default)

**GoalNode** (`src/canvas/nodes/GoalNode.tsx:81-138`):
- Achievement probability: `{Math.round(achievementProbability * 100)}% chance` (green)
- Stability bar: numeric % + DataBar coloured by robustness level
- Threshold: `≥ {formatted value}` with currency prefix or unit suffix
- Constraint badges: pre-analysis (info border), post-analysis (coloured by probability ≥0.7/≥0.4)
- "Marginal" badge when `stabilityValue < 0.6` (GoalNode.tsx:95) — **unlisted threshold, not in UI-SEM table**

**OptionNode / OutcomeNode / RiskNode:**
- OptionNode: win probability + progress bar
- OutcomeNode: achievement percentage (green)
- RiskNode: severity badge (Low/Medium/High/Critical) + signed mean + existence probability %

**Verdict:** Correct data sources. GoalNode "Marginal" badge at 0.6 is an unlisted threshold — should be added to UI-SEM inventory or derived from `constants.ts`.

---

### 1.4 External Factor Visual Distinction

- **Border style:** `border-dotted` via `getControllabilityBorderStyle('external')` (`graphDisplayCalculations.ts:198`)
- **Icon:** Cloud icon in header (`FactorNode.tsx` header, category-based)
- **Value display:** Prior range instead of observed state (`FactorNode.tsx:111-117`)
- **No "estimated"/"assumed" pills** (external factors use prior, not observed state)

**Verdict:** Correct. External factors are visually distinct through border style, icon, and value display.

---

### 1.5 Goal Threshold on Canvas

- **Present:** `GoalNode.tsx:118-138` shows `≥ {threshold}` with unit formatting
- **Missing threshold:** Shows italic coaching "Set a success target to enable probability calculations"
- **Pre-run overlay:** `BaseNode.tsx:134-154` shows dashed border + "?" badge

**Verdict:** Correct. Threshold is visible and provides coaching when absent.

---

### 1.6 Edge Thickness

**Pre-analysis** (`StyledEdge.tsx:186-189`):
```
weightMagnitudeToStrokeWidth(computeSignedMean(edgeData))
```
- `graphDisplayCalculations.ts:129-131`: `1 + |signedMean| * 4` → 1–5px
- `computeSignedMean` defaults: weight=0.5, direction=positive → signed=0.5

**Post-analysis** (`StyledEdge.tsx:190-236`):
```
importance = belief × |strength| × goalSensitivity
```
- `calculateEdgeImportance` defaults: belief=**1.0**, strength=**1.0**, goalSensitivity=1.0
- Scaled to 1–8px via `importanceToStrokeWidth(importance, maxImportance)`

**FINDING (Medium):** Pre-run defaults weight to **0.5** (`computeSignedMean`), post-run defaults to **1.0** (`calculateEdgeImportance` at `graphDisplayCalculations.ts:34` and `StyledEdge.tsx:162,229`). An edge with missing weight looks thinner pre-analysis and thicker post-analysis. Also, `StyledEdge.tsx:162` reads `edgeData?.weight ?? 1.0` while `computeSignedMean` reads `data.weight ?? 0.5`.

**Graph lens overrides** (`StyledEdge.tsx:459-478`):
- Causal: `weightMagnitudeToStrokeWidth(mean)`
- Evidence: uniform 1.5px
- Robustness/Fragile: fragile 3px, non-fragile 1px
- Sensitivity: Q3+ → 3px, Q1- → 1px, Q1-Q3 → 1.5px

---

### 1.7 Edge Colour

**Direction-based** (`StyledEdge.tsx:238-261`):
- Positive + weight>0 → green (#a7f3d0 light, #bbf7d0 dark)
- Negative + weight>0 → red (#ef4444 light, #FF6B6B dark)
- Direction undefined + weight undefined → yellow (`var(--goal)`)
- Direction undefined + weight defined → grey (#d4d4d8 light)
- Weight === 0 → grey

**Uses:** `edge.data.direction` field. Does NOT use `sign(strength.mean)` — direction is a separate field.

**Verdict:** Correct. Direction is the explicit field, not derived from sign.

---

### 1.8 Edge Dash Pattern (exists_probability)

**Source:** `graphDisplayCalculations.ts:110-122` via `StyledEdge.tsx:270-273`
- `existsProbability > 0.7` → solid
- `existsProbability >= 0.4` → dashed (`6,4`)
- `existsProbability < 0.4` → dotted (`2,4`)
- `undefined` → solid (treated as high confidence)

**Edge opacity** (`StyledEdge.tsx:507-516`):
- `>= 0.8` → full opacity
- `>= 0.5` → 0.7 opacity
- `< 0.5` → 0.4 opacity
- `undefined` → full opacity

**FINDING (Low):** Dash thresholds (0.4/0.7) and opacity thresholds (0.5/0.8) use different boundaries. An edge at 0.45 is dashed (medium confidence) but nearly full opacity (0.7). An edge at 0.75 is solid but slightly reduced opacity (0.7 at StyledEdge level — wait, 0.75 ≥ 0.5 → 0.7 opacity, but > 0.7 → solid dash). This creates a "solid but slightly dim" band from 0.7–0.8 that may be intentional layered encoding but could confuse users.

---

### 1.9 Fragile Edge Highlighting

**Detection:** `fragileEdgeMatch.ts:28-48` via `isEdgeFragile()`
- Matches by edge_id or source/target pair
- **Filter:** `switch_probability > 0.3` (UI-SEM-013)

**Visual signal:**
- Badge: orange warning triangle + "Fragile · X%" text (`StyledEdge.tsx:602-627`)
- No line colour/dash override (stays direction-coloured)
- In robustness/fragile lens: 3px stroke, non-fragile 1px

**Verdict:** Canvas correctly applies 0.3 threshold. But see Section 7 for cross-surface mismatch.

---

### 1.10 Structural vs Causal Edge Distinction

**Structural edges** (decision→option, option→factor):
- Hover popover: "Structural link — not analysed" (`StyledEdge.tsx:752-777`)
- No weight/strength display
- Hidden entirely in causal lens

**Causal edges** (factor→factor, factor→outcome/risk, outcome→goal):
- Full styling (thickness, colour, dash, labels, fragile badge)

**Verdict:** Correct distinction. Structural edges are read-only and simplified.

---

## 2. Node Inspector Panels

### 2.1 Goal Panel (`src/canvas/ui/inspector-v2/panels/GoalPanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | Yes (textarea) | `node.data.description` |
| goal_threshold | Yes (rounded) | Via GoalThresholdEditor | `node.data.goal_threshold_raw` |
| goal_threshold_unit | Yes | Via editor | `node.data.goal_threshold_unit` |
| Constraints | Yes (pre + post) | Yes (add/remove/edit value) | `preAnalysisConstraints` / `report.goal_constraints` |
| Constraint probability | Yes (post-analysis) | No | `constraint.probability` |
| probability_of_goal | Yes (arc viz) | No | Report field |
| probability_of_joint_goal | Yes (optional) | No | Report field |
| Inbound connections | Yes | No | outcome/risk → goal edges |
| observed_state | N/A | N/A | Goals don't have observed state |

**Verdict:** Complete for goal nodes.

---

### 2.2 Option Panel (`src/canvas/ui/inspector-v2/panels/OptionPanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | Yes (textarea) | `node.data.description` |
| Interventions per factor | Yes | Yes (value input) | `node.data.interventions` Record |
| Baseline value per factor | Yes | No | Factor's `observedState.value` or `raw_value` |
| Delta % | Yes | No | Computed: `(current - baseline) / |baseline| * 100` |
| Win probability | Yes (post-analysis) | No | `option_comparison[].win_probability` |
| Story headline | Yes (post-analysis) | No | `story_headlines[nodeId]` |
| Add intervention | Yes | Yes (dropdown: controllable factors only) | Canvas edges |
| Tech mode: normalised value | Yes | No | Model value |

**FINDING (Critical):** Win probability missing-value handling — `OptionPanel.tsx:116` defaults to `0` when `win_probability` is absent: `typeof o.win_probability === 'number' ? Math.round(o.win_probability * 100) : 0`. This shows "0%" for a genuinely absent value.

---

### 2.3 Factor Panels

#### Controllable (`src/canvas/ui/inspector-v2/panels/FactorControllablePanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| factorType badge | Yes | No | `node.data.observedState.factor_type` |
| Source badge | Yes | No | `getExtractionLabel(source)` |
| Value | Yes (`raw_value` preferred) | Yes (input + unit) | `observedState.raw_value` ?? `observedState.value` |
| Tech mode: normalised value | Yes | No | `observedState.value` |
| Provenance | Yes | No | `getProvenanceLabel(source)` |
| uncertainty_drivers | Yes (warning pills) | No | `observedState.uncertainty_drivers[]` |
| Sensitivity rank | Yes (post-analysis) | No | `displayMetadata.sensitivityRank` |
| Value of Information | Yes (DataBar) | No | `displayMetadata.valueOfInformation` |
| Set by options | Yes | No | Options with interventions on this factor |
| Influences (outbound edges) | Yes | No | ConnectionRow with weight+direction |
| category | Implicit (via panel selection) | No | `node.data.category` |
| cap | Not displayed | — | `observedState.cap` stored but hidden |
| range_derivation_source | Tech mode only | No | Via RangeDerivationPill |

#### Observable (`src/canvas/ui/inspector-v2/panels/FactorObservablePanel.tsx`)

Same as controllable except:
- Value is **read-only** (not editable)
- No uncertainty_drivers section (lighter than controllable)
- No "Set by options" section (not intervened on)
- Provenance emphasises data recency

#### External (`src/canvas/ui/inspector-v2/panels/FactorExternalPanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | Yes (textarea) | `node.data.description` |
| Quick-set estimate | Yes | Yes (Low/Moderate/High/Uncertain buttons) | Maps to `prior.range_min/max` |
| Range bar | Yes | No | Gradient fill from prior range |
| Tech mode: range_min/max | Yes | Yes (number inputs) | `node.data.prior.range_min/max` |
| observed_state | Not displayed | — | External factors use prior, not observed state |

**Verdict:** All factor panels are complete and appropriate for their category.

---

### 2.4 Outcome Panel (`src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | No | `node.data.description` |
| Predicted range by option | Yes (post-analysis) | No | `option_comparison[]` per option |
| Goal contribution bar | Yes | No | outcome→goal edge weight (%) |
| Inbound factors | Yes (disclosure) | No | Factor edges with category + strength |
| p10/p50/p90 per outcome | Not displayed individually | — | Only shown in option_comparison |
| observed_state | N/A | — | Outcomes are aggregated, not measured |

---

### 2.5 Risk Panel (`src/canvas/ui/inspector-v2/panels/RiskPanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | No | `node.data.description` |
| Risk exposure by option | **Placeholder** | — | `RiskPanel.tsx:68-78` — "will be displayed when available" |
| Goal drag bar | **Hardcoded 15%** | — | `RiskPanel.tsx:80` — TODO: wire to real data |
| Inbound factors | Yes (disclosure) | No | Factor edges with category + strength |

**FINDING:** Risk panel has placeholder data. Goal drag bar is hardcoded to 15% — not wired to real risk exposure.

---

### 2.6 Decision Panel (`src/canvas/ui/inspector-v2/panels/DecisionPanel.tsx`)

| Field | Displayed? | Editable? | Source |
|-------|-----------|-----------|--------|
| Description | Yes | Yes (textarea) | `node.data.description` |
| Decision framing | Optional | No | `brief.who`, `brief.timeframe`, `brief.constraint` |
| Options list | Yes | No | decision→option edges |
| Per-option win probability | Yes (post-analysis) | No | `optionComparison.find(o => o.option_id === target)?.win_probability` |
| isBaseline badge | Yes | No | `option.data.isBaseline` |
| Per-option intervention count | Yes | No | `option.data.interventions` count |

**FINDING (Critical):** Win probability shows as `undefined` when absent (not rendered), diverging from OptionPanel which shows "0%". See Section 7.

---

## 3. Edge Inspector Panel

**File:** `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx`

### 3.1 Strength (mean)

| Aspect | Detail |
|--------|--------|
| Format | Unsigned weight [0,2] + direction → computed signed [-1,+1] |
| Display (user mode) | QuickSetButtons + SignedStrengthSlider with UncertaintyBand overlay |
| Display (tech mode) | Signed decimal ±X.XX (`EdgePanel.tsx:287-291`) |
| Default | weight=0.5, direction='positive' (UI-SEM-029, `EdgePanel.tsx:150`) |
| Editable | Yes — slider + quick-set buttons |
| Impact preview | `useEditImpactPreview` hook — debounced real-time simulation |

### 3.2 Strength STD

| Aspect | Detail |
|--------|--------|
| Displayed | Yes — slider range [0.01, 0.5] step 0.01 (`EdgePanel.tsx:338-344`) |
| Display (user mode) | "Precise" to "Uncertain" label |
| Display (tech mode) | "std: X.XX" (`EdgePanel.tsx:346-349`) |
| Default | 0.15 (`EdgePanel.tsx:154`) |
| Visual | UncertaintyBand overlay on strength slider (±std at 20% opacity) |
| Editable | Yes |

### 3.3 Exists Probability

| Aspect | Detail |
|--------|--------|
| Displayed | Yes — slider 0–1, step 0.05 (`EdgePanel.tsx:307-315`) |
| Colour coding | ≥0.7 success, ≥0.4 warning, <0.4 danger (UI-SEM-010, `EdgePanel.tsx:104-108`) |
| Display (user mode) | "Unlikely" to "Very likely" |
| Display (tech mode) | Percentage + system label (`EdgePanel.tsx:321-325`) |
| Default | `EDGE_CONSTRAINTS.beliefExists.default` = 0.7 |
| Editable | Yes |

### 3.4 Effect Direction

| Aspect | Detail |
|--------|--------|
| Displayed | Implicitly via signed strength + direction arrow indicator |
| Not shown as standalone field | Baked into signed weight calculation |
| Editable | Yes (via strength slider sign) |

### 3.5 Label (Causal Claim)

| Aspect | Detail |
|--------|--------|
| Displayed | Yes — within CausalClaimsSection (`EdgePanel.tsx:432-501`) |
| Feature-flagged | `isCausalClaimsEnabled()` must be true |
| Per claim | `claim_type` badge, `statement`, optional `source` |
| Max visible | 3 (MAX_CLAIMS_VISIBLE), with "and N more" expandable |

### 3.6 Validation Metadata

| Aspect | Detail |
|--------|--------|
| Displayed | **No** — validation metadata (agreed/contested, pass1/pass2 values) is not surfaced in the inspector |
| Contested visual | Only shown on canvas edges via contested dash pattern (`StyledEdge.tsx:275-295`) |

**FINDING:** Validation metadata is not accessible to users in the inspector. Users can see a contested edge on the canvas but cannot view the underlying pass1/pass2 values.

### 3.7 Structural Edge Treatment

- **Organisational** (decision→option): "Organisational link — does not affect analysis" (`EdgePanel.tsx:238-244`)
- **Intervention** (option→factor): "Intervention link — affects analysis" (`EdgePanel.tsx:245-251`)
- Both are read-only — no sliders shown

### 3.8 Fragility Section (Post-Analysis)

- Shown when edge matches `robustness.fragile_edges` (`EdgePanel.tsx:375-399`)
- Shows `switch_probability` as "N% flip risk"
- **Note:** EdgePanel implements its own matching logic (`EdgePanel.tsx:162-173`) — a third implementation alongside `fragileEdgeMatch.ts` and `edgeIdentity.ts`

---

## 4. Pre-Analysis Tab

**Primary hook:** `usePreAnalysisData()` at `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts`

### 4.1 Decision Health Ring

- **Source:** `usePreAnalysisData.ts:248` → `balanceScore: number` (0–1)
- **Derivation:** Graph structure + CEE readiness assessment
- **Verdict:** Single-source, no cross-surface concern

### 4.2 Goal Section

- **Goal label:** `goal node.data.label`
- **Threshold:** `ceeAnalysisReady.threshold` or `goal node.data.goal_threshold_raw` (`usePreAnalysisData.ts:201-206`)
- **Unit:** `goal_threshold_unit`
- **Confirmed flag:** `isGoalConfirmed` (user-set)
- **Source pill:** via `getProvenanceLabel()`

### 4.3 Options Section

- **Source:** `ceeAnalysisReady.options[]` → `optionPreviews: OptionPreviewData[]` (`usePreAnalysisData.ts:231-232`)
- **Interventions:** Primary `ceeAnalysisReady.options[].interventions`, fallback `node.data.interventions`
- **Delta bars:** Computed from factor baseline vs intervention value
- **Delta percentages:** `((interventionValue - baseline) / |baseline|) * 100`
- **Verdict:** Deltas computed from raw values (not normalised) — correct

### 4.4 Decision Quality Section

- **Source:** `usePreAnalysisData.ts:233-234` → `qualityChecks: QualityCheck[]`
- **Categories:** Framing, Verify, Bias
- **Derived from:** Graph structure (connectivity), CEE coaching data, baseline detection
- **NOT from:** PLoT critiques (those are post-analysis only) or local computation of structural validity

### 4.5 Your Expertise Section

- **Evidence quality:** `usePreAnalysisData.ts:131-141` → ratio of non-AI factors / total reviewable factors
- **AI source blocklist:** `['ai', 'cee_inference', 'inferred']` (`usePreAnalysisData.ts:306`)
- **Reviewed factors:** `['user_confirmed', 'user_assumption', 'user_override']` (`usePreAnalysisData.ts:320`)
- **Contested edges:** From CEE validation data (if present)

### 4.6 Worth Investigating Section

- **"Drives N%":** From post-analysis `factor_sensitivity` when available, otherwise from CEE pre-analysis hints
- **Source:** `resultsReport?.enrichment?.sensitivity_analysis?.factors[]` or `resultsReport?.factor_sensitivity[]`
- **EVOI:** Not directly shown in pre-analysis — VoI appears post-analysis in results panel

### 4.7 Footer Readiness Status

- **Ready flag:** `ceeAnalysisReady.status` (`usePreAnalysisData.ts:190`)
- **Blocker count:** `usePreAnalysisData.ts:193-194` → `hasBlockers`, `blockerCount`
- **"N/M contributed":** Enriched blockers from `usePreRunValidation()` (`usePreAnalysisData.ts:213-214`)

---

## 5. Post-Analysis Tab (Results Panel)

**Primary hook:** `useResultsSectionData()` at `src/components/results/useResultsSectionData.ts`

### 5.1 Hero Section (`src/components/results/HeroSection.tsx`)

**Headline:**
- Winner determination: `report?.recommendation?.option_id` or `.selected_option` (`useResultsSectionData.ts:896-897`)
- Fallback: deterministic tie-breaker (p50 → mean → alphabetical) via `determineWinnerSelection()` (`useResultsSectionData.ts:56-112`)
- `WinnerDeterminedBy` enum: 'win_probability' | 'expected_outcome' | 'unknown'

**Condition card:**
- Stability tier: `getStabilityTier(recommendationStability)` (`HeroSection.tsx:165-211`)
- Thresholds: ≥0.85 "Stable result", ≥0.70 "Mostly stable", ≥0.55 "Sensitive to assumptions", else "Highly sensitive" (UI-SEM-041)
- Trust level: `deriveTrustLevel(readiness, robustnessLevel)` (`HeroSection.tsx:219-226`)
- Trust reason: `deriveTrustReason(...)` — priority: default estimates > fragile ratio >0.7 > evidence <0.5 > "review model assumptions"

**Narrative summary:**
- From report coaching data, sanitised via `sanitizeCoachingText()`
- Suppressed if contradicts low robustness (UI-SEM-021, `HeroSection.tsx:276-279`)

**Hero border:** `getHeroBorderClass()` (`HeroSection.tsx:261-271`)
- Prefers categorical robustnessLevel, falls back to numeric stability (0.7/0.4 thresholds, UI-SEM-044)

### 5.2 Outcomes Section

**Option cards:**
- `win_probability`: from `report.option_comparison[].win_probability` (`useResultsSectionData.ts:984`)
- `outcome mean`: from `report.option_comparison[].outcome?.mean` or `.expected` (multi-field fallback chain, `useResultsSectionData.ts:932-963`)
- `outcome range`: p10/p50/p90 from `report.option_comparison[].outcome` or `report.results` or `report.run.bands`
- **"Recommended" badge:** Driven by `isRecommended` flag on winning option (from `determineWinnerSelection`)

**Goal probability:**
- Field: `probability_of_goal` (not `probability_of_joint_goal`) for primary display
- `probability_of_joint_goal` shown separately when present

**Constraint breakdown:**
- From `report.goal_constraints[]` with per-constraint `probability`
- Colour thresholds: same as GoalNode (≥0.7 success, ≥0.4 warning, else danger)

### 5.3 Trust Section

**Robustness gauge:**
- Level: `report.robustness.level` (explicit) or derived via `deriveRobustnessLevel(recommendation_stability)` (UI-SEM-005, `useResultsSectionData.ts:1059-1065`)
- Derivation thresholds: ≥0.8 high, ≥0.5 moderate, ≥0.3 low, else very_low
- Display: `ROBUSTNESS_LEVEL_DISPLAY` in `constants.ts:71-77` → high="Robust"/green, moderate="Moderate"/amber, low="Fragile"/orange, very_low="Very Fragile"/red

**Fragile edge cards:**
- Source: `report.robustness.fragile_edges[]`
- Filter: `switch_probability > 0.3` (UI-SEM-013) — applied in `useResultsSectionData`
- Display limit: 3 (LIMITS.FRAGILE_EDGES_DISPLAY)
- Sorting: by `switch_probability` descending
- Label resolution: 3-tier fallback (PLoT label → canvas node lookup → "Not attributed: {id}")
- Severity derivation (UI-SEM-012): >0.7 'critical', >0.5 'error', else 'warning'

**Recommendation stability:**
- Shown as numeric percentage when present
- Source: `report.robustness.recommendation_stability` (`useResultsSectionData.ts:1037-1041`)

### 5.4 Drivers Section (`src/components/results/DriversSection.tsx`)

**Driver list data:**
- Raw elasticity: `getRawElasticity()` priority chain (`useResultsSectionData.ts:222-251`): elasticity → sensitivity_score (skip if 0 with importance_score > 0) → sensitivity → importance_score (if > 0) → contribution → 0
- Normalised influence: `computeNormalisedInfluences()` (`useResultsSectionData.ts:336-363`) — top factor = 100%, others proportional to absolute elasticity
- **Bar width** driven by normalised influence (0–1)

**Confidence per driver:**
- Source: `factor.confidence` (0–1) from `factor_sensitivity[]`
- Alternative: ISL bootstrap `confidence_components.sampling_stability`
- **Known issue:** Confidence field from PLoT may be unreliable (placeholder values)

**Direction:**
- Source: `factor_sensitivity[].direction` or inferred from elasticity sign (`useResultsSectionData.ts:270-272`)

**VoI hint:**
- Source: `displayMetadata.valueOfInformation` or `m1Coaching.evidence_gaps[].voi_score`
- Threshold: >0.05 shows hint (UI-SEM-014, `DriversSection.tsx:259`)

**Semantic labels** (UI-SEM-039, `useResultsSectionData.ts:538`):
- ≥0.50 normalised influence → "strong"
- ≥0.20 → "moderate"
- else → "minor"

### 5.5 Actions Section

**Evidence gaps:**
- Source: `m1Coaching?.evidence_gaps[]` (`useResultsSectionData.ts:2095-2134`)
- Sorted by: EVPI (ISL) descending, fallback to `voi_score`
- Top 3 shown, rest behind "See all"

**Model critiques:**
- Source: `report?.run?.critique[]` filtered by severity (`useResultsSectionData.ts:1660-1683`)
- Humanised via `humaniseCritique()` utility

**Coaching narrative:**
- From M1 coaching (CEE), not M2 (PLoT)
- Sanitised via `sanitizeCoachingText()`

### 5.6 Tornado Chart

- **Bar lengths:** Driven by normalised driver influence from `useResultsSectionData.drivers` — same data as driver list
- **Direction:** Positive (right) vs negative (left) from driver direction field
- **NOT** from raw elasticity, importance_score, or sensitivity_score directly — uses the normalised pipeline

---

## 6. Model Tab

**File:** `src/canvas/components/ModelTabBody.tsx`

### 6.1 Per-Node Data

- Label, kind, category
- `observedState.value` or `raw_value` with unit
- Source badge: `SOURCE_LABELS` mapping ('brief_extraction' → 'From brief', 'cee_inference' → 'AI estimate', 'user' → 'User edited')
- External factors: `prior.range_min/max`

### 6.2 Per-Edge Data

- Weight (0–2 unsigned magnitude)
- Direction ('positive'/'negative')
- `beliefExists` (0–1, displayed as %)
- Evidence/provenance metadata
- Causal claims (if feature-flagged)

### 6.3 Edge Table

- Sorted by weight descending (default)
- Columns: source, target, weight, direction, beliefExists, provenance

### 6.4 Health Summary

- Connectivity ratio: connected nodes / total nodes
- Evidence coverage: edges with provenance / total edges

### 6.5 Attention Banner (Post-Analysis)

- Fragile edges, missing sources, default values surfaced from critique data
- Uses `buildFragileEdgeLookup()` from `edgeIdentity.ts` — **no 0.3 threshold applied**

### 6.6 Quality/Connectivity Scoring

- Node count breakdown by kind (colour bar)
- Connectivity + evidence percentage metrics

---

## 7. Cross-Surface Consistency

### 7.1 Edge Strength

| Surface | Source | Transform | Default |
|---------|--------|-----------|---------|
| Canvas thickness (pre-run) | `edge.data.weight` + `direction` | `computeSignedMean()` → `weightMagnitudeToStrokeWidth()` | weight=**0.5** |
| Canvas thickness (post-run) | `edge.data.weight` + `beliefExists` + sensitivity | `calculateEdgeImportance()` → `importanceToStrokeWidth()` | weight=**1.0** |
| Inspector EdgePanel | `edge.data.weight` + `direction` | signed = direction==='negative' ? -weight : weight | weight=**0.5** (UI-SEM-029) |
| ConnectionRow (all panels) | `strength.weight` + `strength.direction` | Same signed computation | Only if prop provided |
| Model tab | `edge.data.weight` | Direct read for sort | missing → -Infinity |
| Pre-analysis EdgeSummarySection | `edge.data` | `computeSignedMean()` → `Math.abs()` | weight=**0.5** |

**Consistent?** PARTIAL — all surfaces read from `edge.data.weight` + `direction`, but the **default when missing** diverges: 0.5 in most places, 1.0 in post-run importance calculation. **Medium severity.**

### 7.2 Edge Confidence (exists_probability)

| Surface | Source | Transform | Default |
|---------|--------|-----------|---------|
| Canvas opacity | `edge.data.beliefExists` | ≥0.8 full, ≥0.5 → 0.7, <0.5 → 0.4 | undefined → full |
| Canvas dash | `edge.data.beliefExists` | >0.7 solid, ≥0.4 dashed, <0.4 dotted | undefined → solid |
| Inspector slider | `edge.data.beliefExists` | Direct display 0–1 | **0.7** (EDGE_CONSTRAINTS) |
| Post-run importance | `edge.data.beliefExists` | Multiplied into importance | **1.0** |
| Model tab sort | `edge.data.beliefExists` | Direct read | null → end of sort |
| EdgeSummarySection | `edge.data.beliefExists` | <0.8 → "most uncertain" | undefined → excluded |

**Consistent?** PARTIAL — canonical field is the same, but defaults diverge: undefined→solid/full-opacity on canvas (looks confident), 0.7 in inspector (looks "likely"), 1.0 in importance calc (maximum weight). **Medium severity.**

### 7.3 Factor Value

| Surface | Source | Transform |
|---------|--------|-----------|
| Canvas FactorNode | `observedState` | `formatFactorValue()` — raw_value preferred, fallback value+cap |
| Inspector panels | `observedState.raw_value` ?? `.value` | Direct read, separate tech mode for normalised |
| Pre-analysis interventions | Factor baseline vs intervention | Delta from raw values |
| Model tab | `observedState` | Sub-component rendering |

**Consistent?** YES — all surfaces use the same `observedState` from `node.data`, with consistent raw_value preference.

### 7.4 Win Probability

| Surface | Source | Default when missing |
|---------|--------|---------------------|
| Results hero | `option_comparison[].win_probability` | undefined (not displayed) |
| Results option cards | Same | undefined |
| Inspector OptionPanel | Same | **0** (shows "0%") |
| Inspector DecisionPanel | Same | **undefined** (hidden) |
| Inspector OutcomePanel | Same | Guarded: only rendered if `!= null` |

**Consistent?** **NO — CRITICAL.** OptionPanel shows "0%" for missing data while DecisionPanel hides it and OutcomePanel guards correctly. A user viewing the same option in different panels sees contradictory information.

### 7.5 Robustness / Stability

| Surface | Source | Threshold Set | Labels |
|---------|--------|---------------|--------|
| useResultsSectionData (UI-SEM-005) | `recommendation_stability` | 0.8 / 0.5 / 0.3 | high / moderate / low / very_low |
| HeroSection (UI-SEM-041) | `recommendationStability` | 0.85 / 0.70 / 0.55 | Stable / Mostly stable / Sensitive / Highly sensitive |
| buildResultsVM (UI-SEM-006) | stability + gap | 0.80 / 0.55 (+ gap 0.10) | robust / sensitive / indeterminate |
| HeroSection border (UI-SEM-044) | `robustnessLevel` or stability | 0.7 / 0.4 (fallback) | success / info / factor border |
| enrichment (UI-SEM-016) | numeric score | 0.7 / 0.4 | robust / moderate / fragile |
| GoalNode bar colour | `robustness.level` | categorical mapping | success / goal / warning |
| GoalNode "Marginal" badge | `stabilityValue` | **0.6** (unlisted) | "Marginal" text |
| constants.ts | STABILITY_MODERATE | **0.6** (unused in deriveRobustnessLevel) | — |
| debug data (useDebugData) | stability | 0.85 / 0.65 | Robust / Moderate / Fragile |

**Consistent?** **NO — CRITICAL.** Five different threshold sets produce contradictory labels. Example at stability = 0.72:

| Surface | Label/State | Colour |
|---------|-------------|--------|
| robustnessLevel (UI-SEM-005) | **moderate** (below 0.8) | amber |
| HeroSection tier (UI-SEM-041) | **Mostly stable** (above 0.70) | text-success (green!) |
| DecisionState (UI-SEM-006) | **sensitive** (below 0.80, above 0.55) | — |
| Hero border (UI-SEM-044) | **border-info/30** (categorical 'moderate') | blue |
| enrichment (UI-SEM-016) | **robust** (above 0.7) | — |
| GoalNode | No "Marginal" badge (above 0.6) | goal colour |

The user sees "Mostly stable" in green (hero), "Moderate" in amber (badge), and the enrichment layer calls it "robust" — three different assessments of the same number.

### 7.6 Driver Ranking

| Surface | Source | Normalisation |
|---------|--------|--------------|
| Results DriversSection | `getRawElasticity()` → `computeNormalisedInfluences()` | Max-based: top=100%, others proportional |
| Tornado chart | Same `useResultsSectionData.drivers` | Same normalised values |
| FactorNode sensitivity bar | `displayMetadata.influence` + raw re-normalisation | **Min-max with 25% floor**: `0.25 + (|current|-min)/(max-min) * 0.75` |
| Pre-analysis "Drives N%" | `enrichment.sensitivity_analysis.factors` sorted by `|elasticity|` | Raw absolute elasticity |

**Consistent?** PARTIAL — Tornado and driver list use identical pipeline. But FactorNode applies a **different normalisation** (min-max with floor) that could make a mid-ranked factor's bar look disproportionately large compared to its driver list position. **Medium severity.**

### 7.7 Fragile Edges

| Surface | Matching Function | 0.3 Threshold Applied? |
|---------|------------------|----------------------|
| Canvas StyledEdge | `isEdgeFragile()` (`fragileEdgeMatch.ts`) | **YES** |
| Canvas context menu | `isEdgeFragile()` (`fragileEdgeMatch.ts`) | **YES** |
| Canvas lens filter | `isEdgeFragile()` (`fragileEdgeMatch.ts`) | **YES** |
| Model tab | `buildFragileEdgeLookup()` (`edgeIdentity.ts`) | **NO** |
| Inspector EdgePanel | Own matching impl (`EdgePanel.tsx:162-173`) | **NO** |
| Results trust section | `useResultsSectionData` fragile pipeline | **YES** (in the data hook) |

**Consistent?** **NO — CRITICAL.** An edge with `switch_probability = 0.25`:
- Canvas: **no fragile indicator** (filtered out by 0.3 threshold)
- Model tab: **listed as fragile** (no threshold applied in `buildFragileEdgeLookup`)
- Inspector: **shows fragility section** (no threshold in EdgePanel matching)
- Results panel: **not shown** (filtered in useResultsSectionData)

Three implementations of the same matching logic, only one applies the threshold consistently.

---

## 8. Threshold Inventory

### 8.1 Robustness / Stability

| ID | Location | File:Line | Threshold | Effect | Matches ISL/PLoT? |
|----|----------|-----------|-----------|--------|-------------------|
| UI-SEM-005 | deriveRobustnessLevel | useResultsSectionData.ts:1059-1065 | ≥0.8 high, ≥0.5 moderate, ≥0.3 low, else very_low | Categorical level derivation | Fallback — PLoT sometimes provides level |
| UI-SEM-006 | deriveDecisionState | buildResultsVM.ts:30-36,98-113 | GAP=0.10, ROBUST=0.80, SENSITIVE=0.55 | Tri-state classification | UI-only derivation |
| UI-SEM-041 | getStabilityTier | HeroSection.tsx:175-211 | ≥0.85 Stable, ≥0.70 Mostly stable, ≥0.55 Sensitive | Hero label + colour | UI-only derivation |
| UI-SEM-044 | getHeroBorderClass | HeroSection.tsx:261-271 | ≥0.7 success, ≥0.4 info (fallback) | Hero card border | Fallback for missing level |
| UI-SEM-016 | enrichment | enrichment.ts:279 | ≥0.7 robust, ≥0.4 moderate, else fragile | Enrichment label | UI-only derivation |
| UI-SEM-017 | httpV1Adapter | httpV1Adapter.ts:87 | ≥0.7 high, ≥0.4 medium, else low | V1 confidence level | UI-only derivation |
| UNLISTED | GoalNode "Marginal" | GoalNode.tsx:95 | <0.6 | "Marginal" badge | Not in UI-SEM table |
| UNUSED | STABILITY_MODERATE | constants.ts:23 | 0.6 | Not used by deriveRobustnessLevel | Dead constant |
| DEBUG | useDebugData | useDebugData.ts:1896-1905 | ≥0.85 Robust, ≥0.65 Moderate | Debug display labels | Debug-only |

### 8.2 Edge Confidence / Existence

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| — | existenceCertaintyToLineStyle | graphDisplayCalculations.ts:110-122 | >0.7 solid, ≥0.4 dashed, <0.4 dotted | Canvas edge dash pattern |
| — | Edge opacity | StyledEdge.tsx:511-516 | ≥0.8 full, ≥0.5 → 0.7, <0.5 → 0.4 | Canvas edge opacity |
| UI-SEM-010 | EdgePanel threshold colour | EdgePanel.tsx:104-108 | ≥0.7 success, ≥0.4 warning, <0.4 danger | Inspector slider colour |
| UI-SEM-011 | Default belief | useGraphReadiness.ts:323 | 0.7 default | CEE coaching default |
| — | DEFAULT_EDGE_DATA | edges.ts:263 | beliefExists: 0.7 | New edge creation |
| — | Most uncertain gate | EdgeSummarySection.tsx:167 | <0.8 | Pre-analysis "most uncertain" |

### 8.3 Edge Strength

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| — | getStrengthLabel (inspector) | inspectorStrings.ts:99-104 | ≥0.60 "Very strong", ≥0.25 "Strong", ≥0.05 "Moderate", else "Slight" | 4-tier labels |
| — | EdgeSummarySection | EdgeSummarySection.tsx:64-65 | ≥0.6 "strong", ≥0.25 "moderate", else "weak" | 3-tier labels |
| — | Pre-run stroke width | graphDisplayCalculations.ts:129-131 | `1 + |mean| * 4` → 1-5px | Linear scale |
| — | Post-run stroke width | graphDisplayCalculations.ts:49-59 | Normalised to 1-8px | Importance-based |
| UI-SEM-029 | EdgePanel default | EdgePanel.tsx:150 | weight=0.5, direction='positive' | Inspector default |

### 8.4 Fragile Edges

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| UI-SEM-013 | isEdgeFragile | fragileEdgeMatch.ts:37 | >0.3 | Canvas fragile filter |
| UI-SEM-012 | Edge severity | useResultsSectionData.ts:1913 | >0.7 critical, >0.5 error, else warning | Results severity badge |
| — | THRESHOLDS.FRAGILE_EDGE_FILTER | constants.ts:19 | 0.3 | Canonical constant |
| — | LIMITS.FRAGILE_EDGES_DISPLAY | constants.ts:36 | 3 | Max cards shown |

### 8.5 Drivers / Sensitivity

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| UI-SEM-039 | Semantic labels | useResultsSectionData.ts:538 | ≥0.50 strong, ≥0.20 moderate, else minor | Driver category labels |
| UI-SEM-040 | Dominance detection | useResultsSectionData.ts:1601 | >0.5 influence AND >2:1 ratio | Dominant factor flag |
| UI-SEM-045 | Rank flip warning | DriversSection.tsx:175 | >0.3 | Warning gate |
| UI-SEM-046 | Elasticity display | DriversSection.tsx:212 | ×10, floor 1 | Display scaling |
| UI-SEM-014 | VoI hint | DriversSection.tsx:259 | >0.05 | Hint visibility |
| UNLISTED | sensitivityTierLabel | labelUtils.ts:36-39 | ≥0.7 "High", ≥0.4 "Med", else "Low" | FactorNode bar label |
| UNLISTED | evidenceTierLabel | labelUtils.ts:54-57 | ≥0.7 "Strong", ≥0.4 "Fair", else "Weak" | FactorNode bar label |
| — | Factor zero impact | constants.ts:27 | <0.01 | Excluded from default display |

### 8.6 Confidence / Quality

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| UI-SEM-015 | Confidence tier | useResultsSectionData.ts:578 | ≥70 strong, ≥40 fair, else needs_work | Readiness score fallback |
| UI-SEM-018 | UnifiedStatusBadge | UnifiedStatusBadge.tsx:49 | quality ≥0.7 success, ≥0.5 warning | Node quality badge |
| UI-SEM-019 | Readiness taxonomy | useResultsSectionData.ts:537 | Varied PLoT labels → strong/fair/needs_work | Label normalisation |
| UI-SEM-047 | Confidence clamp | DriversSection.tsx:356 | [0, 1] | Normalisation |

### 8.7 Risk

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| — | calculateRiskSeverity | graphDisplayCalculations.ts:77-98 | <0.5 low, <1.5 medium, <3 high, ≥3 critical | Risk severity band |

### 8.8 Other

| ID | Location | File:Line | Threshold | Effect |
|----|----------|-----------|-----------|--------|
| UI-SEM-008 | Probability cap | format.ts:61 | Cap at 99% | Display formatting |
| UI-SEM-009 | p15/p85 fabrication | DecisionSummary.tsx:239 | Interpolated from p10/p50/p90 | Confidence band |
| UI-SEM-021 | Suppress coaching | HeroSection.tsx:276 | Matches "robust"/"ready to proceed" text | Contradictory copy suppression |
| UI-SEM-042 | Fragility ratio | HeroSection.tsx:246 | >0.7 fragile/total edges | Trust reason |
| UI-SEM-043 | Evidence quality | HeroSection.tsx:252 | <0.5 | Trust reason |
| UNLISTED | Evidence gap escalation | FactorNode.tsx:176-180 | >0.20 + top-3 → critical, >0.05 → warning | EvidenceGapBadge level |
| — | Baseline delta epsilon | constants.ts:24 | <0.05 | "Same as baseline" display |

### 8.9 Clamping / Normalisation

| ID | Location | File:Line | Range | Effect |
|----|----------|-----------|-------|--------|
| UI-SEM-023 | Weight clamp | DraftChat.tsx:519 | [0, 2] | Magnitude clamp |
| UI-SEM-024 | Belief clamp | DraftChat.tsx:543 | [0, 1] | Confidence clamp |
| UI-SEM-025 | belief_exists clamp | DraftChat.tsx:553 | [0, 1] | Existence clamp |
| UI-SEM-026 | CEE weight clamp | cee/client.ts:255 | [0, 1] | CEE normalisation |
| UI-SEM-027 | CEE belief clamp | cee/client.ts:261 | [0, 1] | CEE normalisation |
| UI-SEM-028 | CEE belief_exists clamp | cee/client.ts:307 | [0, 1] | CEE normalisation |
| UI-SEM-035 | Signed mean clamp | useConversation.ts:1086 | [-1, +1] | Format conversion |
| UI-SEM-038 | Alt path clamps | applyDraftResult.ts:74 | [0,2] / [0,1] / [0,1] | Duplicate of 023/024/025 |

---

## Summary of Findings

### Critical (contradictory data shown to user)

| # | Finding | Surfaces Affected | Root Cause |
|---|---------|------------------|------------|
| C1 | **Fragile edge threshold mismatch** | Canvas vs Model tab vs Inspector | `isEdgeFragile()` applies 0.3 threshold; `buildFragileEdgeLookup()` and EdgePanel do not |
| C2 | **Win probability missing-value divergence** | OptionPanel vs DecisionPanel vs OutcomePanel | OptionPanel defaults to 0, DecisionPanel hides, OutcomePanel guards correctly |
| C3 | **Robustness threshold proliferation** | Hero label vs badge vs border vs enrichment vs GoalNode | 5+ incompatible threshold sets for the same numeric stability score |
| C4 | **STABILITY_MODERATE dead constant** | constants.ts vs deriveRobustnessLevel | `constants.ts` defines 0.6, actual derivation uses 0.5 — false sense of single source of truth |

### Medium (visual inconsistency, not directly contradictory)

| # | Finding | Surfaces Affected | Root Cause |
|---|---------|------------------|------------|
| M1 | **Edge weight default divergence** | Canvas pre-run (0.5) vs post-run (1.0) | `computeSignedMean` defaults 0.5; `calculateEdgeImportance` defaults 1.0 |
| M2 | **Strength band label divergence** | Inspector (4-tier) vs EdgeSummarySection (3-tier) | `getStrengthLabel`: Very strong/Strong/Moderate/Slight vs strong/moderate/weak |
| M3 | **FactorNode bar normalisation** | Canvas factor bars vs driver list bars | Min-max with 25% floor vs max-based proportional |
| M4 | **GoalNode "Marginal" unlisted threshold** | GoalNode badge at 0.6 | Not in UI-SEM table, no counterpart in any other threshold set |

### Low / Informational

| # | Finding | Note |
|---|---------|------|
| L1 | Opacity vs dash threshold boundary mismatch (0.5/0.8 vs 0.4/0.7) | Likely intentional layered encoding |
| L2 | Validation metadata not accessible in inspector | Users see contested edge on canvas but can't view pass1/pass2 values |
| L3 | Risk panel placeholder data | Goal drag bar hardcoded to 15%, risk exposure placeholder |
| L4 | `observedState.cap` stored but never displayed | Stored field with no UI surface |
| L5 | Three separate fragile edge matching implementations | `fragileEdgeMatch.ts`, `edgeIdentity.ts`, `EdgePanel.tsx` — maintenance risk |

### Missing Data That Should Be Displayed

| Data | Available From | Currently Shown? | Recommended Surface |
|------|---------------|-----------------|-------------------|
| Edge validation pass1/pass2 | CEE validation metadata | No (only contested dash on canvas) | Inspector EdgePanel |
| Risk exposure per option | PLoT (when available) | No (placeholder) | RiskPanel |
| `observedState.cap` | Canvas store | No | Tech mode in factor panels |
| `range_derivation_source` | Canvas store | Tech mode only | Could surface in provenance section |
| ISL `edge_e_values[]` | New ISL field | No | Inspector EdgePanel / Model tab |
| ISL `conditional_winners[]` | New ISL field | No | Results trust section |
| ISL `inference_warnings[]` | New ISL field | No | Results actions section |
| `response_hash` on meta | New field | No | Debug panel |
