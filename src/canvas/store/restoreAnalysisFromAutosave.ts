/**
 * Restore a completed analysis from the autosave record — the canonical half
 * of the fix described in `PersistedAnalysis` (store/scenarios.ts).
 *
 * WHY A MODULE RATHER THAN INLINE IN ReactFlowGraph
 * The boot restore lives inside a `useEffect` in a 4,000-line component, which
 * makes it untestable and made the two PRE-EXISTING restore attempts there
 * (scenario `last_result_hash` lookup, then a graphHash scan over run history)
 * impossible to pin. Both of those are dead on the deployed guest path —
 * live-probed 26 Jul, `olumi-canvas-scenarios` and `olumi-canvas-run-history`
 * are both absent after a real analysis. This one is a pure function of the
 * autosave record, so a spec can drive the exact bytes the live write produced.
 *
 * ⚠ WHAT THIS FILE'S SPECS CAN AND CANNOT PROVE. They prove the record → store
 * transition. They do NOT prove ReactFlowGraph calls this on mount — jsdom
 * cannot prove the deployed path, and a store-level pass while the deployed
 * path stays broken is exactly the trap this defect was already caught by once
 * (see store.conversationRunSurvivesReload.spec.ts's own header). The wiring is
 * evidenced only by the live leave-and-return acceptance recorded in the PR.
 */

import type { AutosaveData } from './scenarios'
import type { RestorableRun } from './runHistory'

/**
 * Rehydrate `results` from `autosave.analysis`, if there is one.
 *
 * @param autosave  the record just read by `loadAutosave()`
 * @param restoreFn the store's `resultsLoadHistorical`
 * @returns true when an answer was restored — the caller uses this to skip the
 *          legacy fallbacks, so a canonical hit can never be overwritten by a
 *          graphHash guess.
 */
export function restoreAnalysisFromAutosave(
  autosave: Pick<AutosaveData, 'analysis'> | null | undefined,
  restoreFn: (run: RestorableRun) => void,
): boolean {
  const analysis = autosave?.analysis
  // Persisted JSON is not a type. Guard the one field the results surfaces
  // cannot render without, so a truncated or hand-edited record degrades to
  // "no answer" rather than a store in a state no run produces.
  if (!analysis || typeof analysis !== 'object') return false
  const report = analysis.report
  if (!report || typeof report !== 'object') return false

  const ts = Date.parse(analysis.computedAt ?? '')
  restoreFn({
    id: analysis.runId ?? `restored:${analysis.hash ?? 'unknown'}`,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    // Absent on the V5 path and never invented — see PersistedAnalysis.
    seed: analysis.seed,
    hash: analysis.hash,
    report,
    drivers: analysis.drivers,
    ceeReview: null,
    ceeTrace: null,
    ceeError: null,
  })
  return true
}
