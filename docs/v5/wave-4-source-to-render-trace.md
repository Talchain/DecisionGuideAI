# Wave 4 — Source-to-render trace for V5 results panel

P0 V5 golden-path integration repair, Wave 4. Brief requires a source-to-render trace before any UI fix or fallback copy. This document captures the trace.

**Conclusion in one line**: no mapping or hydration bugs found. The remaining null-render risks are partial source coverage (handled with completeness qualifier), UI-SEM fabrication masking (kept as display floor, surfaced as completeness state), and optional enrichment (handled with curated fallback block).

## Trace targets

Six result fields, end to end:

1. Winning option / recommended option
2. Option win probabilities / scores
3. Expected value / outcome (per-option p10/p50/p90 + expected_outcome)
4. Key drivers / factors (labels + sensitivity / importance)
5. Robustness / fragility / stability
6. Decision review / coaching

## Anchor fixture

`src/__fixtures__/resultsPanelV7.rich.hook.ts` — three options, five factors, complete data set. Where individual fields are sparser in production (PLoT degraded, ISL absent), the table below classifies the fall-back behaviour.

## Per-field trace summary

| # | Field | Source location | Hydration site | Selector | Render site | Bug class | Action |
|---|-------|-----------------|----------------|----------|-------------|-----------|--------|
| 1 | Winning option | `ReportV1.robustness.recommended_option_id` (`src/adapters/plot/types.ts`) | `resultsComplete` (`src/canvas/store.ts:~2402`) | `useResultsSectionData.ts:954-962` (4-source fallback chain) | `src/components/results/OptionCards.tsx:352-358` | Always present (with fallback) | Ship as-is |
| 2 | Win probabilities | `ReportV1.option_probabilities[id].win_probability` (`src/adapters/plot/types.ts:7-12`) | `resultsComplete` writes `report` verbatim | `useResultsSectionData.ts:984-1055` (no fabrication when missing) | `OptionCards.tsx:509-512` | Partial coverage when PLoT omits | Curated copy when all options lack |
| 3 | p10/p50/p90 + expected | `ReportV1.option_probabilities[id].outcome` | `resultsComplete` verbatim | `useResultsSectionData.ts:996-1023` (4-source fallback for each band) | `OptionCards.tsx:418` | Always present (multi-layer fallback) | Ship as-is |
| 4 | Drivers / sensitivity | `V2Response.factor_sensitivity[]` or `enrichment.sensitivity_analysis.factors` (`src/adapters/plot/v2/responseMapper.ts:238-294`) | `resultsComplete` accepts `drivers` separately (`store.ts:~2404`) | `useResultsSectionData.ts:200-700` `getRawElasticity` (3-source fallback to null) | `DriversSection.tsx:175-212` | Partial coverage; UI-SEM-039 fabricates rank labels | Surface partial-completeness when all sensitivity fields absent |
| 5 | Robustness / stability | `ReportV1.robustness.{level,recommendation_stability,fragile_edges}` | `resultsComplete` verbatim | `useResultsSectionData.ts:1106-1160` (UI-SEM-005 derives level from stability) | `HeroQualifier.tsx`, `HeroSection.tsx:175-259` | UI-SEM fabrication masking (UI-SEM-005, -006, -016, -041, -044) | Surface as partial-completeness; keep fabrication as display floor |
| 6 | Decision review / coaching | `analysis_result.enrichment.decision_review.m1_coaching` (CEE native) | `applyV5State.ts:39` extracts; `setRunMeta({ ceeReviewV1 })` | `useResultsSectionData.ts:1229-1289` (sanitised pass-through) | `OptionCards.tsx`, `ResultsBody.tsx`, `DecisionConfidencePanel.tsx` | Optional enrichment, may be legitimately absent | Curated fallback block when absent |

Bug-class legend per Wave 4 brief:

- **(a) Mapping bug** — source data present, adapter drops it. **Found: none.**
- **(b) Hydration bug** — store action drops or mis-applies. **Found: none.**
- **(c) Component-adapter bug** — selector produces null on non-null input. **Found: none. The selectors implement multi-source fallback chains and surface null only when ALL sources are absent.**
- **(d) UI-SEM fabrication masking** — silent default substitution. **Found in Field 5 (robustness) — UI-SEM-005, -006, -016, -041, -044.** Keep fabrications as display floor; surface partial-completeness alongside so the user sees the qualifier rather than fabricated values presented as truth.
- **(e) Genuinely missing** — PLoT/ISL/CEE didn't emit. **Found in Fields 2 (win_probability), 4 (sensitivity), 6 (coaching).** Curated fallback copy is the right answer.
- **(f) Always present** — fully wired. **Fields 1 and 3 fall here; their fallback chains never silently fabricate values, only fall through to alternative legitimate sources or to null.**

## What Wave 4 implements

Given the trace shows no mapping or hydration bugs, the Wave 4 implementation is:

1. **`src/components/results/copy/freshnessReasons.ts`** — curated reason→copy table covering both freshness reason codes (Wave 3 selector) and completeness reason codes (Wave 4). British English, sentence case, DS v4/v5 voice. Unknown codes route through a safe generic fallback. Internal codes never reach the DOM.

2. **`src/components/results/useResultCompleteness.ts`** — pure derivation that computes `{ status: 'full' | 'partial' | 'failed', missing: ReadonlyArray<MissingFieldKey>, reasons: ReadonlyArray<ReasonCode> }` from the SOURCE fields (PLoT/CEE) BEFORE any UI-SEM fabrication. Drives qualifier text and fallback panels without removing the existing fabrications (display layout floor stays).

3. **`HeroSection.tsx` qualifier line** — when completeness is `partial`, render a one-line qualifier under the headline using `reasonCopy(reason)`. When `failed`, render an empty-state-with-CTA panel.

4. **`ResultsBody.tsx` fallback coaching** — when decision review is structurally unavailable, render a curated fallback block instead of the existing silent omission.

5. **Tests** — pin the trace: a fixture with full source → status=full; a fixture with missing sensitivity → status=partial with the right `missing[]` keys; a fixture with structurally-unavailable decision review → fallback coaching renders; assert no internal codes reach the DOM and no forbidden terms.

## What Wave 4 does NOT implement

- Removal of UI-SEM-005/006/016/041/044 fabrications. Removing them would break layout and is out of scope (large blast radius across HeroSection / DriversSection / buildResultsVM thresholds). Wave 4 surfaces completeness state honestly without removing the floor.
- Any PLoT/ISL change. The trace confirmed the missing data originates upstream; the Wave 4 fix is purely UI consumption.
- Any CEE wire-field change. `analysis_ready.freshness` and `analysis_ready.freshness_reason` already carry what the curated copy table needs.

## Cross-references

- Pre-existing UI-SEM table: `CLAUDE.md` (UI-SEM-001 through UI-SEM-049).
- Wave 3 selector: `src/lib/analysisFreshnessState.ts`, `src/lib/useAnalysisFreshnessState.ts`.
- Test pinning: `src/components/results/__tests__/useResultsSectionData.spec.ts`, `buildResultsVM.spec.ts`.
