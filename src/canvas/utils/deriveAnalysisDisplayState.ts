/**
 * ⚠ COLLAPSED (analysis-state authority, step 5). One of the six derivations
 * composed by `canvas/state/analysisStateSelector.ts`. The selector calls this
 * mapper for the `displayState` member of its verdict, feeding it wire-derived
 * inputs when CEE stated an `analysis_state` — so the copy table below stays
 * the single source of that copy and is not restated anywhere.
 *
 * ⚠ THE SENTENCE THAT USED TO SIT HERE WAS FALSE, and it is worth recording
 * because it is the exact shape this codebase keeps paying for. It read:
 * *"`useAnalysisDisplayState` inherits wire authority automatically, because
 * the `analysisChanged` input it computes comes from `useAnalysisTrust()`."*
 * It did not. That hook recomputed `analysisChanged` LOCALLY as
 * `semantic === 'changed' || trust.orphaned`, which silently discards the
 * selector's `wireForcesStale` rule — so a refused turn rendered a green
 * "Analysis complete" while the selector said "outdated". A docstring asserting
 * a wiring that does not exist is worse than no docstring: it stops the next
 * reader checking.
 *
 * `useAnalysisDisplayState` now READS `useAnalysisState().displayState` and
 * derives nothing, so the claim is true by construction rather than by comment.
 *
 * deriveAnalysisDisplayState — canonical mapper from raw analysis state
 * (CEE readiness + populated report + canvas-store staleness flag) to the
 * display state the user sees in the pre-analysis hero, the debug bundle,
 * and any other surface that needs a shared interpretation.
 *
 * The bug this fixes: the UI previously conflated `analysis_ready.status
 * === 'ready'` (CEE: "structurally ready to analyse") with "analysis is
 * complete". This helper enforces that "complete" requires a populated
 * report AND that the graph hasn't changed since the run. Anything else
 * is `ready_to_analyse`, `results_stale`, or `not_ready`.
 *
 * Pure function — no hooks, no side effects. Use the
 * `useAnalysisDisplayState` hook to consume from a component.
 */

import { ANALYSIS_READY_STATUSES } from '../../adapters/cee/types'

export type AnalysisDisplayState =
  | 'not_ready'
  | 'ready_to_analyse'
  | 'complete'
  | 'ran_without_result'
  | 'results_stale'

export interface DeriveAnalysisDisplayStateInput {
  /** ceeAnalysisReady.status wire value, or undefined when the slice is null. */
  ceeAnalysisReadyStatus: string | undefined
  /** True when results.report is non-null (populated run response). */
  hasReport: boolean
  /**
   * True when the analysis is DEFINITELY out of date — the shared CEE freshness
   * display semantic (`classifyFreshnessForDisplay`) is 'changed' (CEE 'stale'
   * OR a retained-fresh-now-dirtied by a local edit). Sourced via the hook from
   * the CEE freshness slice + dirty overlay, NOT the local `graphEditedSinceLastRun`
   * flag — so 'cannot_confirm' (CEE-unknown) never fabricates a 'Results may be
   * outdated' claim here (it falls through to the neutral 'complete' completion fact).
   */
  analysisChanged: boolean
  /**
   * ⭐ True when the report carries at least one FINITE renderable probability —
   * `hasAnyRealProbability`, the guard already written for exactly this and,
   * until now, consumed by three surfaces and not by this one, the canonical
   * headline.
   *
   * MEASURED, NOT HYPOTHETICAL. In Paul's manual test on build `acd3db4d` the
   * product displayed `Analysis complete` while every analytic value the UI
   * rendered was `unmatched`: 5 of 5 factors `influence_source: "unmatched"`,
   * 3 of 3 options `win_probability_source: "unmatched"`, no PLoT or ISL leg in
   * the bundle at all (`isl_data_source: "none"`), and CEE's own
   * `leader_claim.permitted: false / separation_unavailable`.
   *
   * `hasReport` cannot catch that: a report can be POPULATED and carry
   * all-null probabilities, which is an engine "I tried and failed" state, not
   * a result. The docstring above already promised that 'complete' requires a
   * populated report; this makes it require a populated report WITH SOMETHING
   * IN IT.
   *
   * Optional, defaulting to `true`, so an existing caller that cannot yet
   * supply it keeps its current behaviour rather than silently degrading every
   * completed run to the new state.
   */
  hasRenderableResult?: boolean
}

export interface AnalysisDisplayCTA {
  kind: 'primary' | 'secondary'
  label: 'Run analysis' | 'Rerun analysis'
}

export interface AnalysisDisplayStateView {
  state: AnalysisDisplayState
  /** Sentence-case British English headline shown in the hero/banner. */
  headline: string
  /** Lucide icon name. The component imports the icon component itself. */
  iconName: 'Play' | 'Check' | 'RefreshCw' | 'AlertCircle'
  /** Tailwind class applied to headline + icon. */
  textColorClass: 'text-info' | 'text-success' | 'text-warning' | 'text-text-light'
  /** CTA shown alongside the headline; null when no CTA applies. */
  cta: AnalysisDisplayCTA | null
}

/**
 * CEE statuses that explicitly mean "structure is not analysable". These
 * MUST override a prior populated report — when the model is no longer
 * analysable (e.g. user deleted the goal node), the old report is
 * meaningless and showing "Analysis complete" would mislead the user.
 *
 * `undefined` and `'missing'` are NOT in this set: those represent absent
 * readiness (CEE response in flight, slice transiently null during scenario
 * load). A genuinely complete prior result should remain visible during
 * those windows.
 *
 * 'blocked' (Lane UI-W5, CEE #358 defensive leg): CEE's documented
 * semantics are "validation failure prevents analysis — invalid graph
 * structure". The empty-options synthesis on legacy/unparseable reloads is
 * rejected by the V5 normaliser before it reaches this helper (store slice
 * cleared → status undefined), but the Ep2 readiness path can emit
 * 'blocked' WITH populated options, which the lenient normaliser passes
 * through — without this entry that state would render green "Analysis
 * complete" whenever a prior report is held. Rendering-level mapping only.
 */
/**
 * DERIVED, not hand-listed: every producer status except the one that means
 * "analysable". Spelling the negatives out was a fifth copy of CEE's
 * `AnalysisReadyStatus` — the copy family that shipped the `blocked` defect in
 * `usePreRunValidation`. Deriving the complement also fails toward DETECTION:
 * a member CEE adds later is not-ready here by default, rather than silently
 * rendering a green "Analysis complete".
 */
const EXPLICIT_NOT_READY_STATUSES: ReadonlySet<string> = new Set(
  ANALYSIS_READY_STATUSES.filter(status => status !== 'ready'),
)

function isExplicitNotReady(status: string | undefined): boolean {
  return status !== undefined && EXPLICIT_NOT_READY_STATUSES.has(status)
}

/**
 * Precedence (first match wins):
 *   1. Explicit non-ready CEE status (needs_encoding / needs_user_mapping /
 *      needs_user_input) → 'not_ready' even when a prior report exists.
 *   2. hasReport && !analysisChanged → 'complete'
 *      Works even when readiness is briefly absent (undefined / 'missing'),
 *      because a populated report stands on its own — readiness gating only
 *      matters before a successful run lands. 'Analysis complete' is a completion
 *      fact, not a currentness claim, so this is also the correct neutral
 *      fallback for the CEE-unknown 'cannot_confirm' case (which is NOT 'changed').
 *   3. hasReport && analysisChanged → 'results_stale'
 *   4. ceeAnalysisReadyStatus === 'ready' (no report) → 'ready_to_analyse'
 *   5. else (no report, no readiness signal) → 'not_ready'
 *
 * Note rule (2) is keyed on `hasReport`, not on the run-status enum. A
 * stale enum value with a cleared report (e.g. results.status='complete'
 * left over after a new draft cleared `report` to null) must NEVER
 * produce 'complete'. Without a populated report there is nothing to
 * display.
 */
export function deriveAnalysisDisplayState(
  input: DeriveAnalysisDisplayStateInput,
): AnalysisDisplayStateView {
  const { ceeAnalysisReadyStatus, hasReport, analysisChanged } = input
  const hasRenderableResult = input.hasRenderableResult ?? true

  if (isExplicitNotReady(ceeAnalysisReadyStatus)) {
    return {
      state: 'not_ready',
      headline: 'Set up your model',
      iconName: 'AlertCircle',
      textColorClass: 'text-text-light',
      cta: null,
    }
  }

  if (hasReport && !analysisChanged && !hasRenderableResult) {
    // The run finished and returned a report with nothing renderable in it.
    // That is neither 'complete' (there is no result) nor 'results_stale' (it
    // is not out of date) nor 'ready_to_analyse' (it already ran) — a fourth
    // situation that had no state, which is why it was being reported as the
    // nearest one and reading as success.
    return {
      state: 'ran_without_result',
      headline: 'Analysis finished without a result',
      iconName: 'AlertCircle',
      textColorClass: 'text-warning',
      cta: { kind: 'secondary', label: 'Rerun analysis' },
    }
  }

  if (hasReport && !analysisChanged) {
    return {
      state: 'complete',
      headline: 'Analysis complete',
      iconName: 'Check',
      textColorClass: 'text-success',
      cta: null,
    }
  }

  if (hasReport && analysisChanged) {
    return {
      state: 'results_stale',
      headline: 'Results may be outdated',
      iconName: 'RefreshCw',
      textColorClass: 'text-warning',
      cta: { kind: 'secondary', label: 'Rerun analysis' },
    }
  }

  if (ceeAnalysisReadyStatus === 'ready') {
    return {
      state: 'ready_to_analyse',
      headline: 'Ready to analyse',
      iconName: 'Play',
      textColorClass: 'text-info',
      cta: { kind: 'primary', label: 'Run analysis' },
    }
  }

  return {
    state: 'not_ready',
    headline: 'Set up your model',
    iconName: 'AlertCircle',
    textColorClass: 'text-text-light',
    cta: null,
  }
}
