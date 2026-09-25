/**
 * What happened to the LATEST run attempt, when it did not produce the result
 * on screen — derived from the same authorities the Results tab reads, never
 * from a second reading of them.
 *
 *   - `runState` is `useAnalysisRunState()`, the dock's one mapper
 *     (`analysisState/useAnalysisRunState.ts`), whose precedence already puts
 *     `running` above `refused` above `never_run`.
 *   - `refusal` is CEE's typed refusal slice; its reason goes through the SAME
 *     `describeAnalysisRefusalReason` the Results tab's notice uses, and an
 *     unmapped code gets the generic, never the raw code.
 *   - `resultsStatus === 'error'` is the failed-run fact. It is read directly
 *     because `unknown_degraded` also covers "freshness unknown", which is not
 *     a failure.
 *
 * ⚠ The note is a sentence in this tab's own status slots, never a second
 * `AnalysisRefusalNotice` mount: `analysisStateRegion.mountSites.spec.ts` pins
 * that component to one file.
 */
import type { AnalysisRunStateKind } from '../analysisState/analysisStateContract'
import {
  ANALYSIS_REFUSAL_GENERIC_REASON,
  describeAnalysisRefusalReason,
  type AnalysisRefusalNotice,
} from '../../../canvas/store/analysisRefusalNotice'

export type LatestRunNote =
  | { readonly kind: 'did_not_run'; readonly reason: string }
  | { readonly kind: 'failed' }
  /**
   * The WIRE says the analysis is blocked, with no typed refusal held for a
   * run attempt. Review 5820019088: `blocked` without the refusal slice is a
   * reachable state of the mapper (`useAnalysisRunState.mapping.spec.ts`), and
   * it fell through to silence. It is stated as the model needing a change,
   * never as a run that was attempted and stopped.
   */
  | { readonly kind: 'blocked' }

export function deriveLatestRunNote(input: {
  runState: AnalysisRunStateKind
  refusal: AnalysisRefusalNotice | null
  resultsStatus: string | undefined
  isBusy: boolean
}): LatestRunNote | null {
  const { runState, refusal, resultsStatus, isBusy } = input
  // A run in flight supersedes any note about a finished attempt.
  if (isBusy || runState === 'running') return null
  if ((runState === 'refused' || runState === 'blocked') && refusal) {
    return {
      kind: 'did_not_run',
      reason: describeAnalysisRefusalReason(refusal.blockedReason) ?? ANALYSIS_REFUSAL_GENERIC_REASON,
    }
  }
  if (runState === 'blocked') return { kind: 'blocked' }
  // ⚠ THE WIRE'S PRECEDENCE HOLDS: a legacy 'error' status is a failed attempt
  // only where the mapper itself did not settle the run (it maps 'error' to
  // `unknown_degraded` after a first run, and leaves `never_run` before one).
  // A wire `complete_current` / `complete_stale` beats a stale error flag.
  if (resultsStatus === 'error' && (runState === 'unknown_degraded' || runState === 'never_run')) {
    return { kind: 'failed' }
  }
  return null
}
