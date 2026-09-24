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
  if (resultsStatus === 'error') return { kind: 'failed' }
  return null
}
