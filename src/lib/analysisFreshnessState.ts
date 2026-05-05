/**
 * Single source of truth for "how should the UI describe analysis
 * freshness right now" (P0 V5 golden-path repair, Wave 3).
 *
 * Pre-Wave-3, four UI surfaces derived this independently from
 * `analysisStateReady`, `graphEditedSinceLastRun`, and `results.status`:
 *   - pre-analysis panel
 *   - results panel header / hero
 *   - chat composer (rerun chip gating)
 *   - debug overlay
 *
 * They could disagree (the run completes, the canvas is edited mid-render,
 * one surface re-renders before another). Wave 3 introduces this single
 * pure derivation that consumes both the wire-side freshness signal and
 * the local edit signal, and exposes a memoised hook the surfaces share.
 *
 * Distinct from `analysisDisplayState.ts` in this same folder, which
 * gates outcome rendering when BLOCKER-level issues exist (a different
 * concern). Both can be true at once: a stale analysis with a blocking
 * issue would render this freshness state AND the blocking gate.
 *
 * Order of precedence:
 *   1. Wire freshness wins. CEE's `analysis_ready.freshness` is computed
 *      against the canonical hash of the graph at the time the analysis
 *      ran — it's the authoritative answer.
 *   2. Local `graphEditedSinceLastRun` is a fallback when the wire signal
 *      is absent or `unknown`. It mirrors what the canvas saw between
 *      turns; useful when no CEE response has arrived yet but the user
 *      has already edited.
 *   3. `inputsMissing` is non-empty whenever the derivation could not
 *      draw a confident conclusion. Consumers either render a
 *      `continue_editing` neutral state or surface the missing inputs
 *      in the debug bundle — never silently substitute.
 *
 * Pure function. No store reads, no side effects. Tests are table-driven.
 */

import type { CEEAnalysisReady } from '../adapters/cee/types'
import type { ResultsState } from '../canvas/store'

export type AnalysisFreshnessVerdict = 'fresh' | 'stale' | 'none' | 'unknown'

export type AnalysisRecommendedAction =
  | 'run_analysis'
  | 'rerun_analysis'
  | 'view_results'
  | 'continue_editing'
  | 'add_options'
  | null

export type AnalysisFreshnessState = {
  freshness: AnalysisFreshnessVerdict
  /**
   * Stable code from CEE (`analysis_ready.freshness_reason`) when the wire
   * signal won. `local_graph_edited` / `local_results_match` /
   * `no_options_yet` / `no_successful_run_yet` / `cee_freshness_unknown`
   * when the local fallback decided. `null` when no input was
   * informative. Consumers that show user-facing copy MUST map this
   * through the curated reason-copy table (Wave 4) — never echo it
   * directly to a user.
   */
  reason: string | null
  recommendedAction: AnalysisRecommendedAction
  /**
   * Inputs the derivation could not read. Non-empty when the result is
   * uncertain. Surfaced in the debug bundle (Wave 5) and used by Wave 4
   * to render curated "we don't know yet" copy instead of silently
   * picking a default.
   */
  inputsMissing: ReadonlyArray<keyof AnalysisFreshnessInputs>
}

export type AnalysisFreshnessInputs = {
  /**
   * Most recent `analysis_ready` block from a CEE turn response. May be
   * null when the user is still building the model and no CEE turn has
   * carried analysis state yet.
   */
  ceeAnalysisReady: CEEAnalysisReady | null
  /**
   * Local signal: set true on any structural graph edit and reset to
   * false on a successful analysis run. Used as a fallback when the wire
   * freshness is absent or `unknown`.
   */
  graphEditedSinceLastRun: boolean
  /**
   * Local results lifecycle. Drives whether we have a successful local
   * report to surface as "view_results", and gates "Run analysis" when
   * a run is already in flight.
   */
  resultsStatus: ResultsState['status']
  /**
   * True when at least two options + a goal exist in the canvas. False
   * means the model isn't ready to analyse regardless of freshness.
   */
  hasOptions: boolean
  /**
   * True when a non-failed `results.report` is present in the local
   * store. Used together with `graphEditedSinceLastRun` to decide
   * stale-vs-none in the wire-absent fallback.
   */
  hasSuccessfulAnalysisResult: boolean
}

const NEUTRAL: AnalysisFreshnessState = {
  freshness: 'unknown',
  reason: null,
  recommendedAction: 'continue_editing',
  inputsMissing: [],
}

/**
 * Pure derivation. Inputs in, verdict out.
 */
export function deriveAnalysisFreshnessState(
  inputs: AnalysisFreshnessInputs,
): AnalysisFreshnessState {
  // Step 1 — wire freshness wins when present and informative.
  const wireFreshness = inputs.ceeAnalysisReady?.freshness
  const wireReason = inputs.ceeAnalysisReady?.freshness_reason ?? null

  if (wireFreshness === 'fresh') {
    return {
      freshness: 'fresh',
      reason: wireReason,
      recommendedAction: 'view_results',
      inputsMissing: [],
    }
  }
  if (wireFreshness === 'stale') {
    return {
      freshness: 'stale',
      reason: wireReason,
      recommendedAction: 'rerun_analysis',
      inputsMissing: [],
    }
  }

  // wireFreshness in {undefined, 'none', 'unknown'} → fall back to
  // local signals. 'unknown' is CEE saying "I couldn't decide" (legacy
  // fact, missing hash, derivation_failed). The local signal can
  // sometimes resolve that; if it can't, keep `unknown` and surface
  // inputsMissing.
  const inputsMissing: Array<keyof AnalysisFreshnessInputs> = []
  if (wireFreshness === 'unknown') {
    inputsMissing.push('ceeAnalysisReady')
  }

  // Step 2 — local fallback. Need to know whether a successful run
  // happened locally; if not, the answer is 'none', not 'stale'.
  if (inputs.hasSuccessfulAnalysisResult) {
    if (inputs.graphEditedSinceLastRun) {
      return {
        freshness: 'stale',
        reason: 'local_graph_edited',
        recommendedAction: 'rerun_analysis',
        inputsMissing: [],
      }
    }
    return {
      freshness: 'fresh',
      reason: 'local_results_match',
      recommendedAction: 'view_results',
      inputsMissing: [],
    }
  }

  // No prior analysis result locally and no wire freshness saying
  // otherwise. Distinguish "model isn't ready yet" from "ready and
  // waiting" so the recommended action is concrete.
  if (!inputs.hasOptions) {
    return {
      freshness: wireFreshness === 'unknown' ? 'unknown' : 'none',
      reason:
        wireReason ??
        (wireFreshness === 'unknown' ? 'cee_freshness_unknown' : 'no_options_yet'),
      recommendedAction: 'add_options',
      inputsMissing,
    }
  }

  // Has options, no successful local report.
  if (wireFreshness === 'none' || wireFreshness === undefined) {
    return {
      freshness: 'none',
      reason: wireReason ?? 'no_successful_run_yet',
      recommendedAction:
        inputs.resultsStatus === 'running' ? null : 'run_analysis',
      inputsMissing,
    }
  }

  // wireFreshness === 'unknown' AND has options AND no successful local
  // report. We can recommend running, but we can't claim freshness.
  return {
    ...NEUTRAL,
    freshness: 'unknown',
    reason: wireReason ?? 'cee_freshness_unknown',
    recommendedAction: inputs.resultsStatus === 'running' ? null : 'run_analysis',
    inputsMissing,
  }
}
