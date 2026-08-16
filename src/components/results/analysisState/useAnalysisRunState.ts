/**
 * `useAnalysisRunState` — the CONSUMER SEAM for the analysis-state authority.
 *
 * ⭐⭐ THE SWAP LINE
 * -----------------
 * The migration lane's `useAnalysisState()` now EXISTS at
 * `src/canvas/state/analysisStateSelector.ts` (#737, merged into `staging` as
 * `2c72f695` — re-derived at the bytes, not inherited from an earlier draft of
 * this comment, which said it was absent and went stale the moment #737
 * landed). This hook still derives the enum from today's store slices, and the
 * swap remains ONE function body:
 *
 *     export function useAnalysisRunState(): AnalysisRunStateKind {
 *       return useAnalysisState().run_state          // ⇦ SWAP LINE
 *     }
 *
 * Everything downstream (`AnalysisStateRegion`, the composition table, every
 * test) is written against `AnalysisRunStateKind` and is unaffected by the
 * swap. That is the point of putting the region behind an enum rather than
 * behind the six derivations.
 *
 * ⚠⚠ SO WHY IS THE SWAP NOT DONE HERE? Because on the branch that is reachable
 * TODAY it would be a REGRESSION, and that is derived at #737's own bytes
 * rather than supposed:
 *
 *   "the derived branch never returns `'refused'` … no legacy signal
 *    distinguishes those, and inventing one would be exactly the fabrication
 *    this contract exists to stop"   (analysisStateSelector.ts:206-209, and
 *    again at :398-401)
 *
 * That conservatism is CORRECT in the selector — it refuses to fabricate a
 * refusal it cannot see. But this surface has a signal the selector's legacy
 * branch does not consult: CEE's typed `blocked_reason`, already in the
 * `analysisRefusalNotice` slice, which is the whole of ROADMAP 2.1163. Swapping
 * to `useAnalysisState().run_state` while CEE is still on the legacy wire would
 * therefore RE-DARK the refusal notice — and it would do so INVISIBLY, because
 * the notice self-gates on an empty slice, so an absent banner looks exactly
 * like a banner with nothing to say.
 *
 * `useAnalysisRunState.mapping.spec.ts` pins the refusal arm as a
 * discriminating pair, so that swap REDs instead of shipping. **Run it against
 * the selector before deleting this fallback**; the honest swap is either after
 * CEE emits `AnalysisStateV1` with `refused` on the wire, or as a UNION (wire
 * kind, with this slice still owning the refusal arm) — not a substitution.
 *
 * ⚠ WHAT THIS IS NOT
 * ------------------
 * It is NOT a seventh truth vocabulary. It computes no freshness, no
 * readiness and no run outcome; it READS the verdicts the existing owners
 * already publish and maps them onto the contract's state names. If a mapping
 * here disagreed with its source, the source is right and this is wrong.
 *
 * ⚠ PRECEDENCE, AND WHY REFUSAL IS FIRST
 * --------------------------------------
 * `AnalysisRefusalNotice` is today mounted UNGATED on purpose (ROADMAP 2.1163,
 * and the 20-line comment at its mount site): a refused analysis is exactly
 * the case where there are no results, so borrowing the results gates would
 * hide the notice in the state it exists to explain. Ordering refusal ABOVE
 * `never_run` preserves that: a first analysis that CEE refuses still reaches
 * the user, even though `hasCompletedFirstRun` is false.
 *
 * ⚠ `blocked` IS NEVER MINTED HERE, AND THAT IS A STATEMENT ABOUT THE WIRE
 * -----------------------------------------------------------------------
 * The contract separates `blocked` (the model cannot be analysed) from
 * `refused` (the engine declined this run). Today's wire carries ONE signal
 * for both — `analysis_ready.blocked_reason`, which is what populates the
 * refusal slice — so this fallback cannot tell them apart and never claims to.
 * They share a composition row, so nothing user-visible turns on it until
 * `AnalysisStateV1` lands.
 */
import { useCanvasStore } from '@/canvas/store'
import { resolveDisplayedFreshness } from '@/canvas/store/analysisFreshness'
import type { AnalysisRunStateKind } from './analysisStateContract'

/**
 * The pure mapping, exported so it is mutation-testable without a store.
 *
 * Every input is a value another module OWNS:
 *  - `refusalPresent`   → `analysisRefusalNotice` slice (CEE blocked_reason)
 *  - `resultsStatus`    → the results store's own status machine
 *  - `hasCompletedFirstRun` → the store's run ledger
 *  - `displayedFreshness`   → `resolveDisplayedFreshness` (the CEE verdict
 *    plus the local dirty overlay, the SAME call `AnalysisFreshnessNotice`
 *    and `OutputsDock` already make — not a re-derivation)
 */
export function mapToAnalysisRunState(input: {
  refusalPresent: boolean
  resultsStatus: string | null | undefined
  hasCompletedFirstRun: boolean
  displayedFreshness: 'fresh' | 'stale' | 'unknown' | 'none' | null | undefined
}): AnalysisRunStateKind {
  // 1. A run in flight is a run in flight whatever else is held — the strip
  //    says so, and no other banner may speak over it.
  if (
    input.resultsStatus === 'preparing' ||
    input.resultsStatus === 'connecting' ||
    input.resultsStatus === 'streaming'
  ) {
    return 'running'
  }
  // 2. Refusal outranks never_run — see the header.
  if (input.refusalPresent) return 'refused'
  // 3. No run has completed and none was refused: the pre-run surface owns
  //    this state entirely, and no truth-state banner belongs on it. Ordered
  //    ABOVE the error case on purpose, so a FIRST run that fails stays
  //    `never_run` — there is no prior result for a freshness verdict to be
  //    about, and today's surface correctly shows the error banner alone.
  if (!input.hasCompletedFirstRun) return 'never_run'
  // 4. ⭐ A RERUN THAT FAILED. Caught by `OutputsDock.rerunContinuity.spec`,
  //    and the gap was real: without this line a failed rerun inherited the
  //    RETAINED verdict from the previous run, so a held `fresh` mapped to
  //    `complete_current` — the surface would have presented the old numbers
  //    as current and suppressed the "Showing results from previous analysis"
  //    attribution, immediately after a run that did not produce them. The
  //    retained verdict describes the PREVIOUS run; it cannot vouch for a
  //    surface whose latest run errored.
  if (input.resultsStatus === 'error') return 'unknown_degraded'
  // 5. A run has completed. Its currency is the freshness owner's verdict —
  //    and an ABSENT verdict is not evidence of currency. `null`/'none' with a
  //    completed run is exactly the cannot-confirm case; claiming
  //    `complete_current` there would fabricate a guarantee.
  switch (input.displayedFreshness) {
    case 'fresh':
      return 'complete_current'
    case 'stale':
      return 'complete_stale'
    default:
      return 'unknown_degraded'
  }
}

/** Store-reading wrapper. Primitive selectors only (`ci:guard:zustand`). */
export function useAnalysisRunState(): AnalysisRunStateKind {
  const refusal = useCanvasStore((s) => s.analysisRefusalNotice)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const hasCompletedFirstRun = useCanvasStore((s) => s.hasCompletedFirstRun)
  const ceeFreshness = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)

  return mapToAnalysisRunState({
    refusalPresent: Boolean(refusal),
    resultsStatus: resultsStatus ?? null,
    hasCompletedFirstRun: Boolean(hasCompletedFirstRun),
    displayedFreshness: resolveDisplayedFreshness(ceeFreshness, freshnessDirty),
  })
}
