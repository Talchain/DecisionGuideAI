# Lane UI-W5 — disclosure, blocked-status, testability (branch `claude-lane19/disclosure-blocked-testability`)

**Date:** 2026-07-07 · **Base:** `origin/staging` @ `e9832126` (includes #237 / lane UI-W4) · **Repo:** DecisionGuideAI (writes confined here)
**Producers consumed:** PLoT staging `sensitivity_reference_option_id` (lane PLoT-W4 passthrough of the ISL 9a22a1a+ envelope disclosure). PLoT `display_verdict` deliberately NOT consumed (lands next round per lane brief).
**Doctrine:** UI renders, never invents; producers own semantics. New wording tagged `provisional_doctrine_v0`. All boundary-adjacent changes ADDITIVE.

## Commits

| Commit | Feature |
|---|---|
| `3b70a852` | C — harness testability selectors (SuccessTargetRow + Analysis-tab rerun affordances) |
| `5d2c2477` | A — reference-option disclosure (`sensitivity_reference_option_id` consumption + caption) |
| `15d19d15` | B — blocked-status handling (verified trace, blocked fixture coverage, one rendering fix) |

## A — Reference-option disclosure

PLoT `/v2/run` now emits root-level `sensitivity_reference_option_id` — the option the edge/factor sensitivities and fragile-edge classification were computed against (ISL uses the FIRST request option; verified against PLoT staging `src/routes/v2/run.ts` + `src/types/engine-v3.ts`, which also document: omitted when the deployed ISL did not disclose it — honest absence, and excluded from `response_hash`).

**Data path (traced producer → validator → consumer):** PLoT `/v2/run` root `sensitivity_reference_option_id` → `V2RunResponse.sensitivity_reference_option_id` (new OPTIONAL field, `src/adapters/plot/v2/types.ts`) → `mapV2ResponseToReportV1` ADDITIVE pass-through guarded to non-empty strings (survives save + hydrate; same pattern as `flip_thresholds` / `decision_brief`; typed on `ResultsReport`) → `useResultsSectionData`: narrow raw-slot extraction (`rawSensitivityReferenceOptionId`, never subscribes to the whole raw response), mapped-report-preferred precedence, id → label via the canvas options list (`nodeLabelMap`) → `sensitivityReference: { optionId, optionLabel } | null` on the hook return → `ResultsBody` → both render surfaces.

**Caption:** one shared component `SensitivityReferenceCaption` ("Sensitivities computed against `<option label>`", `provisional_doctrine_v0`) rendered where sensitivities / fragile edges render: **DriversSection** (under the ranking explainer) and **StressTestSection** (top of the section content, above sensitive-assumptions + fragile-factors). Panel typography only (`panelMeta text-text-light`), no new colour/idiom.

**Fail-closed contract (pinned):** absent producer field → no caption on either surface; empty-string / non-string wire value → mapper omits the key; id that no longer resolves to a canvas label (deleted node, recovered session) → `optionLabel: null` → caption suppressed rather than leaking an internal node id as user copy.

## B — Blocked-status handling (CEE #358 defensive leg)

CEE synthesises `analysis_ready = { status:'blocked', goal_node_id:'', options:[], bias_findings:[] }` + `computed_at` + `freshness:'unknown'` + `freshness_reason` (`legacy_fact_missing_hash` | `current_graph_hash_unavailable`) at the ENVELOPE ROOT on legacy/unparseable reloads (verified against CEE staging `src/orchestrator-v5/compose/analysis-ready-emit.ts` + `response-finaliser.ts`).

**Exact current behaviour, traced on the live V5 path (`applyV5State` step 4) and pinned with the exact wire shape:**

1. `setAnalysisFreshness(raw)` runs FIRST (before shape validation) → freshness slice takes the verdict: `{ freshness:'unknown', freshnessReason, computedAt }` → display semantic `cannot_confirm`. The blocked/unknown state is NOT silently dropped.
2. `normaliseV5AnalysisReady` REJECTS the payload on two independent grounds (empty `goal_node_id`, empty `options`) → `setCeeAnalysisReady(null)` clears the readiness slice (READINESS_CLEAR_FIELDS incl. sessionStorage) and the rejection is honestly reported as deferred `analysis_ready_invalid_shape`. No crash.
3. Results panels: this path never touches `results.report`. On the legacy-reload scenario the report is null → no results body, no completeness claim; `deriveAnalysisDisplayState` (status undefined after the clear, no report) → `not_ready` ("Set up your model"), CTA null. sessionStorage restore of a blocked-shaped payload is independently rejected by `validateCeeAnalysisReady` (`empty_options`).
4. Freshness surfaces: `AnalysisFreshnessNotice` renders "Cannot confirm whether this analysis is current." (technical reason on `data-freshness-reason` only, never user copy). The OutputsDock `graph-stale-banner` shows the cannot-confirm variant ONLY when a report exists (`analysisNotConfirmedFresh && !isError && report`) — correct for the empty-reload case (no report → no banner, pre-run state instead).

**ONE violation found and FIXED (rendering-level only):** `deriveAnalysisDisplayState.EXPLICIT_NOT_READY_STATUSES` did not include `'blocked'`. The empty-options synthesis never reaches it (rejected upstream), but CEE's Ep2 readiness path can emit `status:'blocked'` WITH populated options, which the deliberately-lenient V5 normaliser passes through to the store — with a prior report held, that state rendered green **"Analysis complete"**. RED→GREEN pinned: `blocked` + prior report now derives `not_ready` (headline "Set up your model", never "Analysis complete"); `blocked` without report unchanged (`not_ready`, no run CTA). Existing behaviours (ready/needs_* transitions, unknown-freshness neutral completion fact) pinned unchanged in the same suite.

**Not changed (explicitly):** the lenient V5 normaliser, the freshness reducer, and run gating (`usePreRunValidation` / `wouldPassStrictAttachContract` narrow on `status === 'ready'`, so blocked never enables Run) — all already honest; only the display mapping needed the fix.

## C — Harness testability

The Playwright acceptance harness could not reach the SuccessTargetRow "Set target" affordance. Test-support attributes only, zero behaviour change (pinned with render tests that also assert the commit path and `isRunning` disable still work):

| Selector | Element | Status |
|---|---|---|
| `success-target-row` | SuccessTargetRow container (both branches) | pre-existing, kept |
| `success-target-set-button` | "Set target" button | **added** |
| `success-target-input` | target input (aria-label "Edit success target value" KEPT) | **added** |
| `graph-stale-banner` (+ `data-banner-variant`) | Analysis-tab stale banner | pre-existing, kept |
| `graph-stale-rerun-button` | Rerun button inside the stale banner | **added** |
| `results-analysis-footer-action` | AnalysisFooter action button (derives `` `${testId}-action` ``) | **added** |

## Tests & verification

RED→GREEN stash-verified on this worktree for A and B (implementation stashed → failures; restored → green). C is render-only pins per the brief.

| Feature | RED | GREEN | Suites |
|---|---|---|---|
| A | mapper positive case failed + 6/6 selector cases failed with impl stashed | 81/81 (incl. full responseMapper suite) | `responseMapper.spec` (UI-W5 describe: verbatim/absent/empty/non-string), `sensitivityReference.selector.spec` (report-preferred, raw fallback, label resolution, fail-closed), `SensitivityReferenceCaption.spec` (component + both surface pins) |
| B | 1 failure (blocked + prior report claimed "Analysis complete") | 19/19 + 4/4 | `deriveAnalysisDisplayState.spec` (+blocked describe), `applyV5State.blockedAnalysisReady.spec` (exact CEE wire shape through the live ingestion path + freshness surface render) |
| C | n/a (render pins) | 6/6 + 2/2 | `SuccessTargetRow.testability.spec`, `OutputsDock.testability.spec` |

- Final focused sweep across every touched surface + direct dependents: **22 files / 275 tests passed** (incl. `applyV5State.test`, `analysisFreshness.spec`, `AnalysisFreshnessNotice.spec`, `useAnalysisDisplayState(.orphanGate).spec`, StressTest/Drivers suites, `influence-warnings.wire-to-selector.spec`).
- Pre-analysis directory sweep (display-state consumers): 1151 passed / 13 skipped, 0 failures.
- **Typecheck:** `pnpm run typecheck` (tsconfig.ci) clean after every feature. `npx tsc -p tsconfig.app.json --noEmit` error count **2331 == pristine-tree baseline 2331** (stash-compared; the only textual diffs are pre-existing TS2739 fixture lines whose message now lists `sensitivityReference` alongside the already-missing `completeness, autoNoiseProvenance` — same errors, same locations).
- **Lint:** 0 errors on all 19 changed files; 6 warnings, all pre-existing (none on lines this lane added).

### Pre-existing failures NOT introduced by this lane (verified on the pristine base)
- `OutputsDock.analysis-run.spec.tsx` fails on a clean `e9832126` checkout in this environment (8/8, `useConversationContext must be called inside <ConversationProvider>` — aiPanelV2 defaults ON and the suite renders without the provider). Identical with and without this lane's changes; the new `OutputsDock.testability.spec` uses the provider-free legacy-host pattern from `OutputsDock.conversationSingleton.spec` instead.
- `.env.local` copied from the main checkout into the worktree (gitignored, NOT committed) so supabase-importing suites can run at all — same local-env situation lanes 9/12 recorded.

## Boundary audit (additive-only rule)

- `V2RunResponse.sensitivity_reference_option_id` — new OPTIONAL field; nothing existing narrowed.
- Mapper pass-through — conditional spread; key absent when producer omits it.
- `ResultsReport.sensitivity_reference_option_id`, `ResultsSectionDataReturn.sensitivityReference` — additive.
- `DriversSectionProps.sensitivityReferenceLabel`, `StressTestSectionProps.sensitivityReferenceLabel` — new OPTIONAL props; existing callers unchanged (pinned).
- `deriveAnalysisDisplayState` — one status ADDED to a UI-internal display set (rendering-level; no wire shape touched).
- data-testid attributes — presentation-only.
- PLoT `display_verdict` NOT consumed (explicit lane exclusion). No non-additive boundary change was needed; nothing to STOP on.

## Follow-ups (recorded, not done)
1. Consume PLoT `display_verdict` when it lands next round (explicitly out of scope here).
2. If the reference option should ALSO be named on the tornado / flip-thresholds surface, that's a product wording call (flip thresholds are per-factor probes, not the same quantity) — needs doctrine review alongside the `provisional_doctrine_v0` caption wording.
3. Pre-existing red `OutputsDock.analysis-run.spec.tsx` (provider-less render under aiPanelV2 default-ON) deserves its own small fix lane; not touched here to keep the lane additive.
4. CEE `analysis_ready.status` union in `src/adapters/cee/types.ts` still doesn't name `'blocked'` (UI tolerates via the lenient normaliser + widened checks); typing it is a contract-level change best done alongside an olumi-schemas update, not unilaterally in the UI.
