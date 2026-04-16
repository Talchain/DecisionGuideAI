# Brief 4 — Pre-flight findings

**Branch:** `ui/analysis-tab-brief-4` (from `origin/staging` @ `610854a5`)
**Date:** 2026-04-16
**Purpose:** ground every Brief 4 task in the actual code and data paths before any edit.

## 1. Field-path reconciliation (brief → code)

| Brief path | Consumed via | Notes |
|---|---|---|
| `isl_response.options[].win_probability` | `data.recommendation.recommendedOption.winProbability` | Originates from `V2RunResponse.option_comparison[].win_probability` via `useResultsSectionData` mapping |
| `isl_response.options[].option_label` | `data.recommendation.options[].label` | From `V2OptionComparison.option_label` |
| `plot_enrichment.factor_sensitivity[].influence_score` | `DriverItem.normalisedInfluence` (mapped from `importance_score`) | Brief wording uses `influence_score`; code field is `importance_score` (V2) |
| `factor_sensitivity[].value_of_information` | `DriverItem.voi` / `DriverItem.evpiPercentagePoints` | Populated from `value_of_information` + `evpi_percentage_points` |
| `factor_sensitivity[].attribution_stability` | `DriverItem.attributionStability` — `useResultsSectionData.ts:318` | Enum: `'high' \| 'moderate' \| 'low' \| 'negligible'` |
| `factor_sensitivity[].flip_risk_category` | UI-side enrichment (`src/components/results/types.ts:267`) | Not a raw ISL field — UI derives |
| `isl_response.factor_evpi[]` | `data.confidence.topEvidenceGaps[].evpiPp` | Actual source is `m1_coaching.evidence_gaps[].evpi_percentage_points` via `useResultsSectionData.ts:2146-2184` — **no array named `factor_evpi` exists** |
| `isl_response.robustness.fragile_edges[]` | `data.confidence.fragileEdges[]` + `topFragileEdge` | Full shape in `V2FragileEdgeItem` |
| `isl_response.conditional_winners[]` | `data.confidence.conditionalWinners[]` (`useResultsSectionData.ts:2350`) | Raw path: `report.conditional_winners ?? report.robustness.conditional_winners` |
| `isl_response.inference_warnings[]` | `data.confidence.inferenceWarnings[]` (`useResultsSectionData.ts:2368`) | V2 flat shape: `warning.message` (not nested under `detail.message`) |
| `analysis_ready.model_adjustments[]` | `usePreAnalysisData().modelAdjustments` | Typed in `src/adapters/cee/types.ts:346-359` |
| `intervention_details[].display_value`, `.unit` | `formatValueWithUnit()` in `src/canvas/utils/formatValueWithUnit.ts` | Preformatted string preferred over raw_value |
| `guidance_items[].detail` | `GuidanceItem.detail` from `guidanceStore` | **Not the source of triage-card detail copy** — see §5 below |

**Field-name mismatches to remember during implementation:**

- `influence_score` (brief) = `importance_score` (code).
- `inference_warnings[].detail.message` (brief) = `V2Critique.message` (flat, no `detail` wrapper).
- `factor_evpi[]` (brief) = not a real array; per-factor `evpi_percentage_points` on `factor_sensitivity` + `evidence_gaps[].evpi_percentage_points`.

Prefer mapped `ResultsSectionDataReturn` fields. Raw `report.*` access only when necessary, always via existing `safeArray` / type-guard utilities in `useResultsSectionData.ts`.

---

## 2. Current truncation behaviour

### Pre-analysis triage cards

Two truncation layers stack today:

1. **Character cap in the mapper.** `src/canvas/components/pre-analysis/mapImprovementToTriageCard.ts:43-47` — `MAX_SUBTITLE_LEN = 60`, `trimSubtitle()` slices at 59 chars. Applied in `deriveSubtitle()` for edge titles and CEE hints at lines 61 and 75.
2. **CSS single-line truncate at the render layer.** `src/components/shared/TriageCard.tsx:453` — the subtitle/detail `<p>` uses `typography.panelMeta text-text-light truncate flex-1 min-w-0`. The Tailwind `truncate` utility forces single-line overflow-ellipsis regardless of the source string length.

**Task 2 must remove both layers** — the 60-char mapper cap AND the `truncate` CSS class — and replace with the new `ExpandableCoachingText` component.

### Post-analysis triage cards

`src/components/results/DecisionConfidencePanel.tsx:147` — `detail` uses `gap.suggestion` or the literal fallback `"This factor has {confidence}% confidence — improving it could change the recommendation"` (note: em dash — to be removed per cross-cutting British English rule). Rendered through the same `TriageCard` component, so inherits the CSS `truncate` problem.

### Other surfaces

- `line-clamp-{n}` found in a handful of components (not Analysis-tab critical).
- No existing reusable "expand/collapse" primitive. Task 2 introduces one.

---

## 3. Expert-mode gating audit

`expertMode` is a prop threaded top-down via `ResultsBody` → children. There is no central `isExpertField()` utility today (Task 3 will add one).

### Correctly gated (no leak)

| Location | Behaviour |
|---|---|
| `AdvancedSection.tsx:251` | `{expertMode && (...)}` wraps the entire section including `nSamples`/`fragileEdgeCount` rows (`:263-272`) |
| `ChallengeSection.tsx:253` | `edge.e_value != null && expertMode` — e-values gated |
| `OptionCards.tsx:397` | `{expertMode && (...)}` — `p10/p90` range bars gated |
| `DriversSection.tsx` | Elasticity numeric text hidden in standard view; bar display retained |

### Leaks (fix in Task 3)

| Location | Leak | Fix |
|---|---|---|
| `HeroSection.tsx:1072-1083` | `nSamples` + `fragileEdgeCount` rendered inside the "More detail" expand WITHOUT an `expertMode` guard. Any user clicking the disclosure sees simulation counts. | Wrap the `<dl>` in `expertMode && (...)` |
| `useResultsSectionData.ts:318-319` | `attributionStability` / `rankFlipRate` extracted and passed into `DriverItem`. If any render site shows them without a gate, that's a leak. | Audit `DriversSection.tsx` and related — gate any render that exposes `attributionStability` / `rankFlipRate` directly |

### Summary of fix scope for Task 3

- Add `src/components/results/utils/isExpertField.ts` with canonical field list.
- Wrap `HeroSection.tsx:1065-1084` expert-only `<dl>` in `expertMode &&`.
- Audit and gate `DriversSection.tsx` for elasticity / attribution_stability / rank_flip_rate numeric renders.

---

## 4. `recommendationStability * 100` render map

Every current render site for the post-analysis "stability percentage":

| File | Line | Context | Brief 4 action |
|---|---|---|---|
| `src/components/results/DecisionConfidencePanel.tsx` | 487 | `overrideScore` passed to `TriageHealthHeader` ring | **Task 1 target** — replace with `winner.winProbability * 100` |
| `src/components/results/HeroSection.tsx` | 407 | Narrative / stability computation | Keep — legitimate stability context |
| `src/components/results/TrustOneLiner.tsx` | 65 | One-liner trust display | Keep — legitimate stability display |
| `src/canvas/compare-tab/TrajectorySection.tsx` | 37 | Compare tab trajectory chart | Out of scope |
| `src/canvas/components/model-tab/StatusBar.tsx` | 94 | Model tab status bar label | Out of scope |
| `src/canvas/components/model-tab/ModelHealthSection.tsx` | 120, 225 | Model tab health section | Out of scope |

**Only `DecisionConfidencePanel.tsx:487` changes in Task 1.** All other sites continue to show stability (appropriately labelled) and are not part of the hero-disambiguation problem.

---

## 5. Task 2 source map — which CEE field reaches the triage cards?

The brief says `guidance_items[].detail` is being clipped. The actual data flow tells a different story:

### Pre-analysis triage cards

Source: **`verification_prompts`** (CEE analysis_ready), not `guidance_items[].detail`.

Trace:
- `src/canvas/components/pre-analysis/hooks/usePreAnalysisData.ts:767` — `const verificationPrompts = ceeAnalysisReady?.verification_prompts ?? {}`
- `:792` — `const verificationPrompt = verificationPrompts[factor.id]`
- `:847` — `const hint = verificationPrompt || undefined`
- `:870` — `hint` is written to the `ImprovementItem`
- `src/canvas/components/pre-analysis/mapImprovementToTriageCard.ts:75` — `if (item.hint) return trimSubtitle(item.hint)`

`guidance_items[].detail` is consumed by the GuidanceStrip / Inspector surface, not the triage cards.

### Post-analysis triage cards

Source: **`m1_coaching.evidence_gaps[].suggestion`**.

Trace:
- `src/components/results/useResultsSectionData.ts:2146-2184` — maps `m1Coaching.evidence_gaps[]` to `evidenceGaps` with a `suggestion` field on each.
- `src/components/results/DecisionConfidencePanel.tsx:147` — `detail: gap.suggestion || "..."`.

### Real-world string lengths

From inspection of the debug bundles referenced in the brief (mid-market + hiring):

- `verification_prompts[factorId]` strings: typically 30–80 chars ("Has the current baseline been verified against recent data?" style questions). Many are short (<40 chars); some approach 100.
- `evidence_gaps[].suggestion`: typically 60–180 chars (richer, multi-clause coaching). This is the surface where truncation is most destructive.
- `guidance_items[].detail`: 100–160 chars (brief's estimate was in the right range, but this field isn't what triage cards display).

### Threading the correct field

For Task 2, the fix is the same regardless of source: remove the 60-char cap and the CSS `truncate`. Both pre-analysis and post-analysis triage cards will render whatever string arrives, expand/collapse when it overflows two lines.

**No per-surface re-routing is required** — both surfaces already consume the richest field they have access to today. If richer detail is wanted on pre-analysis, that's a CEE change (out of scope for Brief 4).

---

## 6. `ChallengeSection` inference-warnings behaviour (`:394`)

Nuance that matters for Task 12:

`src/components/results/ChallengeSection.tsx:413-424` splits `inferenceWarnings` into two groups:

- **`rootWarnings`** — `code === 'MISSING_ROOT_VALUE'`. Rendered inside the "Model structure" sub-section (`:465-467`) via `RootNodeWarningCard`. Visually groups with fragile edges as structural problems.
- **`otherWarnings`** — everything else. Rendered in "Scientific notes" sub-section (`:422`).

Meanwhile `ConfidenceSection.tsx:945` renders **all** warnings together via `InferenceWarningCard`.

**This is not a pure duplicate — it is a categorised render vs. a consolidated render.** Task 12 deletes the ConfidenceSection instance (or relocates it to trust narrative per the brief) and leaves the ChallengeSection categorisation alone, because losing the `MISSING_ROOT_VALUE` → "Model structure" grouping would regress structural-problem visibility.

Revised Task 12 approach:
- **Move** `<InferenceWarningCard />` from ConfidenceSection into the trust-narrative region (below Evidence/Robustness/Framing bars, above the "simplified structural causal model…" paragraph), capped at 3 + "Show all".
- **Keep** ChallengeSection's split categorisation as-is — it provides distinct signal.
- The brief's instruction to "delete the ChallengeSection duplicate" applies to the `InferenceWarningCard` rendering only, which is not present in ChallengeSection anyway. ChallengeSection renders warnings via its own `RootNodeWarningCard` / scientific-notes pathway. Leave those alone.

---

## 7. ModelAdjustments surface audit

Grepped `ModelAdjustments` across `src/`:

- **Component:** `src/canvas/components/pre-analysis/ModelAdjustments.tsx` (single definition).
- **Imports:** two test files (`design-contracts.spec.tsx`, `ModelAdjustments.spec.tsx`). **No other production render surface.**
- **Call sites:** only `PreAnalysisPanel` (pre-analysis). Not rendered post-analysis, not in Model tab, not in Analysis results.

**Confirmation: ModelAdjustments has a single surface today (pre-analysis).** Task 11 refactors that component in-place per Paul's guidance; no third surface is introduced. The post-analysis one-liner from Task 11 lives inside the trust-narrative region (next to inference warnings in Task 12), **not as a separate card**.

---

## 8. Hooks (Brief 2 dependency confirmation)

- `useResolvedSignals` — `src/canvas/components/pre-analysis/useResolvedSignals.ts` ✓ production-ready
- `filterRedundantBlockers` — `src/canvas/components/pre-analysis/filterRedundantBlockers.ts` ✓ production-ready

No changes needed here; Brief 4 does not modify these hooks.

---

## 9. Shared primitives already in place

- `typography.panelHeader` / `panelBody` / `panelMeta` — `src/styles/typography.ts`
- `Accordion` — `src/canvas/components/pre-analysis/primitives/Accordion.tsx`
- `Pill` — `src/canvas/components/pre-analysis/primitives/Pill.tsx` (outlined variants per DS v5)
- `ExpertBlock` — `src/components/results/ExpertBlock.tsx` (thin wrapper; not conditional itself)
- `formatValueWithUnit` — `src/canvas/utils/formatValueWithUnit.ts`
- `StaleGuardBanner` — `src/canvas/ui/inspector-v2/shared/StaleGuardBanner.tsx`
- `TriageHealthHeader` + `DecisionHealthRing` — to be extended with `mode: 'composite' | 'single'` in Task 1

Reuse everywhere. Do not fork.

---

## 10. Outstanding assumptions to verify on staging

- **Task 6 Model-tab deep link** — the current OutputsDock tab switch is a query-param update (`?tab=model`). Not a deep-link scroll to factor list. Phase 7 must manually verify clicking the "Your expertise" row lands on the Model tab correctly.
- **Task 13 stale-banner top-level wrap** — wrapping `ResultsBody` in a single top-level `StaleGuardBanner` may conflict with per-section guards if they remain. Phase 6 must remove or reconcile the per-section usages.
- **Task 8 factor_sensitivity access pre-analysis** — currently `usePreAnalysisData` may not expose `factor_sensitivity` to the triage-card mapper. Phase 4 may need to thread it through.

All three are resolved during implementation.
