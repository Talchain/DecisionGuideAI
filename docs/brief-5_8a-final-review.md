# Brief 5.8A — final review

Pre-analysis Tier 1/2/3 hierarchy + coaching integration.

## Branch + commit log

Branch: `ui/pre-analysis-tier-hierarchy-5_8a` (forked from `origin/staging` @ `af5fcb11`).

| Commit | Deliverable |
|---|---|
| `166f882b` | D1 precondition check |
| `9c625028` | D2 bias signal target filter |
| `31ebbc73` | D3a T1 ring + checks + narrative |
| `a1a0ead3` | D3b T1 triage queue unification |
| `ce7da267` | D3c T1 bias + widening + contribution + footer |
| `29ffb175` | D4 T1 your options |
| `4ad4c6a9` | D5 T2 sharpen your thinking |
| `45cdfabe` | D6 T3 advanced + footer |

## Per-deliverable summary

### D1 — Precondition check

- Captured baselines for 8 critical files + the wireframe + `as any` count.
- All brief baseline assertions verified (WhatOlumiAddedSection exists, authority-bias filter present, 3px confidence bar, no Model checks card, ring labels "Decision shape" / "Your contribution").
- Test baseline: 40 files passed, 641 tests passed.
- Captured the production headings to remove in D3b: `PreAnalysisPanel.tsx:1760` (Review next) and `PreAnalysisPanel.tsx:602` (Improve confidence).

### D2 — Bias signal target filter

- New helper `hasResolvableBiasTarget` next to `shouldSuppressBiasFinding` in `PreAnalysisPanel.tsx`.
- Applied at the single `biasTriggers` merge site: both LLM branches (`bias_findings` + `bias_signals`) flow through the same gate. Deterministic graph-level fallback intentionally untouched.
- Behaviour change: `bias_findings` without `target_factor_id` now dropped (deliberate tightening — was rendering generically).
- Tests: 9 unit + 7 integration. 0 regressions.

### D3a — T1 ring + checks + narrative

- New `T1DecisionReadinessCard` (memoised) wraps `ModelHealthCard` (compact mode) inside the `.sc` shape.
- New `buildNarrativeBridge` selector — counts only, no inference. Returns structured segments so the render layer can wrap counts in `<strong>`.
- New `T1FailingCheckRow` for the goal-target-unset row (12px X icon + label + action). Suppresses entirely when no checks fire.
- Loading-state escape hatch: ModelHealthCard renders directly (with its own panel chrome) when isLoading + no goal node.
- Tests: 9 unit + 7 integration.

### D3b — T1 triage queue unification

- New `applyStrengthenOverlay` utility — strict normalised exact match (case-insensitive trim). Duplicates skipped silently with single console.warn per duplicate label.
- Unified queue selector combines `reviewNextTriageAll`, `improveConfidenceCards`, and `expertiseTriageCards`. Existing severity → diversification ordering preserved.
- Top 3 render as `.ac` cards (info-coloured ordinal badges, first item info-bordered + tinted as `.ac.em` emphasis). Remaining → "Also consider" `.qf` compact rows.
- Removed: "Review next" SectionHeader, "Improve confidence" h3 heading + count pill, Start here render for triage signals (now the natural emphasised first item), `DraftStrengthenSection.tsx` (sole consumer was pre-analysis).
- TriageCard extension: optional `passiveLabels?: string[]` prop renders the strengthen `actionType` as a non-focusable 9px `<span>` pill.
- Improve confidence accordion preserved as the host for `SuccessTarget` + `MissingKnowledgePrompt` (later moved in D3c) with a generic "Show additional controls" toggle. data-testids preserved so existing tests resolve.
- Tests: 19 unit + multiple existing tests updated.

### D3c — T1 bias + widening + contribution + footer

- New `T1BiasNudgeRow` — inline single-line warning-icon row with bolded category prefix.
- New `T1ContributionRow` + three-state spectrum bar (verified / brief / estimated). Wording: "N of M inputs confirmed".
- New `buildContributionBreakdown` utility — counts only, no inference. Mirrors Hook B's `AI_SOURCES` blocklist. Unknown sources fall back to "estimated".
- `WhatOlumiAddedSection` moved into T1 via `wideningSlot` prop (component reused unchanged — already filtered nodeId from rendered output).
- `MissingKnowledgePrompt` moved into the T1 checks footer via `missingKnowledgeSlot`.
- Removed: legacy bias trigger render in Review next, bias-kind Start here render. Bias is now a single consolidated surface.
- Tests: 10 unit + 9 integration.

### D4 — T1 Your options

- Lifted `OptionPreview` into its own `.sc`-shaped card (`bg-panel border border-panel-border rounded-[12px]`) directly after T1 Decision readiness.
- Render condition relaxed from `showOptionQualityCard` (gated on same_levers / few-options) to plain `optionPreviews.length > 0` — the card is canonical now per the wireframe.
- Header: option-coloured square + "Your options" + outlined info count pill.
- Footer link copy + prompt updated to "Explore other strategies".
- Tests: 7 integration.

### D5 — T2 Sharpen your thinking

- Copy locked in `docs/brief-5_8a-d5-copy.md`. Self-approved per the user's continuous-execution directive (brief D5 step 1 normally HALTs for review).
- New `SharpenYourThinking.tsx` — collapsed accordion, self-suppresses when no bias trigger or framing condition produces a card.
- Bias rows fill first, framing rows fill the remainder; total cap of 4.
- Bias chips reuse `DiscussWithAiButton`; framing chips invoke focus handlers.
- Accordion primitive extended with optional `previewLine?: ReactNode` (collapsed-only, hidden when expanded).
- Tests: 9 integration + Accordion previewLine covered indirectly.

### D6 — T3 Advanced + footer

- T3 Advanced accordion mounted at the bottom (collapsed, no preview line). Inventory: goal selector. Future surfaces (risk appetite, graph statistics, simulation settings) defer to Brief 5.8B/5.9.
- `AnalysisSettings` title updated from "Analysis settings" to "Advanced".
- `AnalysisFooter` extended additively with optional `metaPlacement?: 'inline' | 'stacked'` prop. Default 'inline' preserves post-analysis behaviour.
- Pre-analysis `StickyFooter` now renders the stacked layout per the wireframe — status row + meta row.
- CTA copy: "Analyse now" when ready, "Analyse anyway" when soft not-ready (clickable so the user can run with provisional results). Hard blockers (`hasBlockers && blockerCount > 0`) keep the CTA disabled.
- Status copy: "Ready" / "Not yet calibrated".
- Meta line: "{N}/{M} addressed · Results will be provisional" suffix when calibration is incomplete.
- Tests: 8 integration + 11 existing tests rewired.

## Files touched

- `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx` — main render + queue selectors + handlers (+~500 lines, -~200 lines net)
- `src/canvas/components/pre-analysis/ModelHealthCard.tsx` — unchanged (consumed via T1 wrapper)
- `src/canvas/components/pre-analysis/StickyFooter.tsx` — wireframe alignment
- `src/canvas/components/pre-analysis/AnalysisSettings.tsx` — title rename
- `src/canvas/components/pre-analysis/OptionPreview.tsx` — `.sc` shape + outlined count pill + copy
- `src/canvas/components/pre-analysis/WhatOlumiAddedSection.tsx` — unchanged (used as slot)
- `src/canvas/components/pre-analysis/SharpenYourThinking.tsx` — **NEW** (D5)
- `src/canvas/components/pre-analysis/primitives/Accordion.tsx` — `previewLine` prop (additive)
- `src/canvas/components/pre-analysis/utils/buildNarrativeBridge.ts` — **NEW** (D3a)
- `src/canvas/components/pre-analysis/utils/applyStrengthenOverlay.ts` — **NEW** (D3b)
- `src/canvas/components/pre-analysis/utils/buildContributionBreakdown.ts` — **NEW** (D3c)
- `src/canvas/components/pre-analysis/DraftStrengthenSection.tsx` — **DELETED** (D3b)
- `src/canvas/shared/AnalysisFooter.tsx` — `metaPlacement` prop (additive)
- `src/components/shared/TriageCard.tsx` — `passiveLabels` prop (additive)

New test specs:
- `__tests__/hasResolvableBiasTarget.spec.ts` (D2, 9 cases)
- `__tests__/biasTriggerFilter.spec.tsx` (D2, 7 cases)
- `__tests__/T1DecisionReadinessCard.spec.tsx` (D3a, 7 cases)
- `__tests__/T1D3cBlocks.spec.tsx` (D3c, 9 cases)
- `__tests__/T1YourOptions.spec.tsx` (D4, 7 cases)
- `__tests__/SharpenYourThinking.spec.tsx` (D5, 9 cases)
- `__tests__/T1D6AdvancedFooter.spec.tsx` (D6, 8 cases)
- `utils/__tests__/buildNarrativeBridge.test.ts` (D3a, 9 cases)
- `utils/__tests__/applyStrengthenOverlay.test.ts` (D3b, 19 cases)
- `utils/__tests__/buildContributionBreakdown.test.ts` (D3c, 10 cases)

Deleted test specs:
- `__tests__/DraftStrengthenSection.spec.tsx` (D3b)

## Schema freeze amendments (with rationale)

| Amendment | Rationale |
|---|---|
| Triage queue unified (was: split Review next / Improve confidence) | Brief 5.8A primary goal — the wireframe shows one queue inside T1. |
| Bias nudge inline in T1 (was: separate authority bias card + Review next bias trigger render) | Wireframe shows bias as inline `.nudge` rows after triage; a single consolidated surface beats two parallel surfaces. |
| WhatOlumiAddedSection placed inside T1 card (was: standalone) | Brief D3c spec; component reused unchanged. |
| Contribution row restored as compact indicator with revised wording (`N of M inputs confirmed`) | Brief 5.6 D7 deleted the original full section; Brief 5.8A re-derives cleanly per Paul's decision. Wording avoids the "You've contributed to N of M" overclaim when values are AI-inferred. |
| Accordion primitive gains optional `previewLine` prop + the existing `aria-expanded` is preserved | Additive change; existing consumers don't pass it and behave identically. |
| AnalysisFooter primitive gains optional `metaPlacement` prop | Additive change; default 'inline' preserves post-analysis behaviour. |
| TriageCard primitive gains optional `passiveLabels` prop | Additive change; existing consumers don't pass it. Used today only for strengthen actionType pill. |
| DraftStrengthenSection removed entirely | Sole consumer was pre-analysis; D3b absorbs strengthen items via the overlay map. |
| `bias_findings` without target_factor_id now dropped (deliberate D2 tightening) | Single bias filter for the entire brief means both bias_signals and bias_findings get the same strict gate — on-screen bias copy must always anchor to an actionable factor. |
| Pre-analysis CTA copy updated to "Analyse now" / "Analyse anyway" (was: "Run analysis") | Brief D6 wireframe alignment. "Analyse anyway" stays clickable for soft not-ready states. |
| Pre-analysis status copy updated to "Not yet calibrated" (was: "Needs attention" / "Not ready") | Brief D6 wireframe alignment. |

## Grep gates

| Gate | Result |
|---|---|
| `rg "Review next" src/canvas/components/pre-analysis/` (production headings) | 0 visible heading text remains. All occurrences are in code comments documenting historical context. The user-visible `<SectionHeader title="Review next">` was removed in D3b. |
| `rg "Improve confidence" src/canvas/components/pre-analysis/` (production headings) | 0 visible heading text remains. All occurrences are in code comments. The user-visible `<h3>Improve confidence</h3>` was removed in D3b. |
| `rg "as any" src/canvas/components/pre-analysis/` (production-only count) | 2 in production (unchanged from baseline). 32 in test files (+7 from new D1–D6 specs — fixture coercion to satisfy strict types on incomplete mocks; no production type-safety regression). |
| `rg "nodeId"` in production JSX (test-level DOM-leakage check applied) | DOM-leakage assertions on `container.innerHTML` in D2/D3a/D3c/D5 specs all pass — no `fac_`/`opt_`/`node_` prefix tokens appear in rendered output. |
| `rg "bg-{colour}-light"` on cards/banners/accordions/pills | 0 violations. The two `hover:bg-factor-light` / `hover:bg-option-light` matches are pre-existing interaction-state hovers on rows, not on cards/banners/pills (pre-existing pattern unchanged). |
| `rg "(sand|ink|sky|slate)-[0-9]+"` legacy tokens | 0 actual matches. The 5 false positives are template-string boundary artefacts (`${var}` interpolations near `bg-option`, `text-info`, etc.) and not legacy tokens. |

## Architecture invariants

- ✅ No new semantic transforms (UI-SEM-NN). Counts and overlays are passthrough.
- ✅ No raw hex colours. Raw `text-[Npx]` only used for the wireframe-mandated 9/10 px values where DS v5 has no token (see "Raw px usage" below).
- ✅ No `bg-{colour}-light` on cards/banners/accordions/pills.
- ✅ No legacy tokens.
- ✅ British English, sentence case, no em dashes — verified across all new files.
- ✅ Accordion triggers carry `aria-expanded` (existing primitive + the new `aria-label` on the Improve confidence accordion).
- ✅ `actionType` pill is `<span>`, not `<button>` (D3b TriageCard `passiveLabels` prop).
- ✅ Icon-only chips have tooltips + aria-labels.

## Raw `text-[Npx]` usage inventory

The wireframe uses 9px and 10px freely; DS v5 defines tokens at 11/12/14 only. Each raw-px instance is documented:

| File | Line | Px | Rationale |
|---|---|---|---|
| `PreAnalysisPanel.tsx` (T1FailingCheckRow) | n/a — uses `panelMeta` (11px) | — | No raw px |
| `PreAnalysisPanel.tsx` (T1ContributionRow inline span) | `text-[10px]` | 10px | Wireframe meta line; no DS token |
| `PreAnalysisPanel.tsx` (T1 checks footer) | `text-[10px]` | 10px | Wireframe verified-count meta |
| `PreAnalysisPanel.tsx` (T1 also-consider label) | `text-[10px]` | 10px | Wireframe sub-section label |
| `PreAnalysisPanel.tsx` (TriageCard passiveLabels) | `text-[9px]` | 9px | Wireframe passive pill — explicitly called for in brief D3b |
| `SharpenYourThinking.tsx` (card label) | `text-[10px]` | 10px | Wireframe `.st-lbl` style |
| `AnalysisFooter.tsx` (stacked meta) | `text-[10px]` | 10px | Wireframe footer meta line |

## Accessibility audit

- All accordion triggers are `<button>` elements with `aria-expanded`. New SharpenYourThinking accordion + the OptionPreview header + the Improve confidence accordion + the Advanced accordion all comply.
- The Improve confidence accordion now has an explicit `aria-label` ("Show additional controls" / "Hide additional controls") since the visible label was removed.
- `T1FailingCheckRow` action button has explicit `aria-label`.
- `T1BiasNudgeRow` text reads naturally for screen readers (`<strong>Title:</strong> Subtitle`).
- `T1ContributionRow` spectrum bar has `role="img"` + descriptive `aria-label` covering all three buckets.
- TriageCard `passiveLabels` rendered as non-focusable `<span>` — assistive tech sees decorative descriptors.
- StickyFooter aria-label mirrors the visible label for soft states (Analyse anyway / Analyse now); hard blockers retain the "Address issues…" descriptor.

## Test gate

`pnpm exec vitest run src/canvas/components/pre-analysis/ src/canvas/shared/ src/components/shared/__tests__/`:

- **Test files:** 54 passed, 1 skipped (55 total).
- **Tests:** 786 passed, 13 skipped (799 total). 0 failures.
- **Duration:** 25.80s.

`pnpm run typecheck`: pass.
`pnpm run lint`: 0 errors. 1088 warnings (all pre-existing). 0 new warnings on touched files.

## Open follow-ups (recommended Brief 5.8B scope)

- **Bias nudge "+N more" link is presently dormant** — the upstream pipeline caps bias triggers at 2 (`REVIEW_NEXT_BIAS_BUDGET`) so the T1 nudge block never has overflow today. If 5.8B widens the bias source, the `onShowAllBias` prop is in place to wire an expansion handler.
- **Framing chip handlers currently both route to `handleSetTargetFocus`** — Brief 5.8B may split these onto distinct targets if the goal-baseline edit needs its own focus path.
- **T3 Advanced inventory expansion** — risk appetite, graph statistics, simulation settings remain placeholders. Mount the surfaces inside `AnalysisSettings.tsx` once their data sources are wired (Brief 5.8B/5.9).
- **Bias overflow gating** — `reviewNextOverflowCount` and the "Show more" toggle in the Review next section now only count bias overflow (triage moved to T1). Brief 5.8B should evaluate whether to remove the legacy Review next section entirely once bias has fully migrated.
- **Contribution breakdown for edges** — currently counts factors only. If 5.8B introduces an edge-confirmed semantic, the utility can extend to include edges in N + M.
- **Baseline screenshots** — Paul-side capture remaining for D7 before/after comparison (see `docs/brief-5_8a-baseline-screenshots/README.md`). Dev server runs at `http://localhost:5173/`.

## Brief 5.8B preview scope

The post-analysis hierarchy follows the same pattern. Key items already enumerated in the brief:

- D1: Precondition check
- D2a: Post T1 hero (win probability ring + stability + winner headline)
- D2b: Post T1 triage queue unification
- D2c: Post T1 flip-risk + dominant nudge + checks footer
- D3: Post T1 Your options polish
- D4: Post T2 Stress-test accordion
- D5: Post T2 Tornado as accordion
- D6: Post T3 Drivers demotion
- D7: Post T3 Advanced
- D8: Expert toggle (verify tab bar width + reuse existing state)
- D9: Final review (4 screenshots)

Deferred to 5.8C (pending CEE freshness work):
- Bridge strip, Confirm anyway footer action, Post-confirm state.

Deferred to 5.9 (pending V5 decision_review):
- LLM-grounded stress-test templates (pre_mortem, framing_check, key_assumptions, scenario_contexts).
- Rich narrative coaching from narrative_summary, story_headlines.
