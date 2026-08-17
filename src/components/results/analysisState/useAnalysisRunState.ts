/**
 * `useAnalysisRunState` — the CONSUMER SEAM for the analysis-state authority.
 *
 * ⭐⭐ THE SWAP IS DONE, AND IT IS A UNION — NOT A SUBSTITUTION
 * ------------------------------------------------------------
 * This hook now consumes `useAnalysisState()`
 * (`src/canvas/state/analysisStateSelector.ts`, #737) as the authority for the
 * run state, and keeps exactly ONE local limb: the refusal signal.
 *
 * The earlier draft of this file proposed the swap as a one-liner —
 * `return useAnalysisState().run_state` — and then argued against it. That
 * argument was right, and it is why this is a union. Restated, because it is the
 * whole design:
 *
 *   "the derived branch never returns `'refused'` … no legacy signal
 *    distinguishes those, and inventing one would be exactly the fabrication
 *    this contract exists to stop"   (analysisStateSelector.ts:206-209, :398-401)
 *
 * That conservatism is CORRECT in the selector. But this surface has a signal the
 * selector's legacy branch does not consult: CEE's typed `blocked_reason`, in the
 * `analysisRefusalNotice` slice (ROADMAP 2.1163). A plain substitution would
 * therefore re-dark the refusal notice on every legacy turn, and do it
 * INVISIBLY, because the notice self-gates on an empty slice — an absent banner
 * looks exactly like a banner with nothing to say.
 * `useAnalysisRunState.mapping.spec.ts` REDs on that substitution.
 *
 * ⭐ THE PRECEDENCE ORDER, AND WHY EACH STEP SITS WHERE IT DOES
 * ------------------------------------------------------------
 *   1. A LOCAL RUN IN FLIGHT, above the wire. Not cosmetic: the selector's own
 *      run-pair note records the defect this prevents — "local streaming with a
 *      wire verdict of `complete_current` → `isRunning` false → the run cover is
 *      torn down MID-RUN". The wire describes the turn CEE composed it for; the
 *      results slice knows about a run dispatched since, and being wrong toward
 *      "still running" costs a moment of chrome while being wrong toward
 *      "finished" tears down a live run. Steps 1 and 2 together reproduce the
 *      selector's `isRunning` DISJUNCTION for the kind.
 *   2. THE WIRE VERDICT. The ratified precedence rule: when the wire carries
 *      `analysis_state` it is the authority and beats every local derivation.
 *   3. THE LOCAL REFUSAL — reachable ONLY when the wire was silent, which is
 *      precisely the case the selector cannot answer.
 *   4-6. The legacy derivation, unchanged and still pinned arm by arm.
 *
 * ⚠⚠ THE ONE GENUINELY AMBIGUOUS CELL, DECIDED AND DISCLOSED
 * ----------------------------------------------------------
 * Wire verdict present AND local refusal present, with the wire NOT stating a
 * refusal. The two sources disagree, and the brief for this change did not say
 * which wins. Resolved in favour of the WIRE, on a derived asymmetry in their
 * LIFETIMES rather than on taste:
 *
 *   · `analysisStateV1` is CLEAR-ON-ABSENCE by deliberate design — "silence must
 *     clear or the authority claim becomes a lie about which turn spoke"
 *     (applyV5State.ts). A present wire verdict is therefore guaranteed to be
 *     about THIS turn.
 *   · The refusal slice is three-valued — set / clear / RETAIN — and "a
 *     conversational turn RETAINS the notice" (applyV5State.ts). A present
 *     refusal may be several turns old.
 *
 * So in the conflict cell the wire is the fresher fact and the refusal is the
 * possibly-stale one. 0.47.0's cross-checks (CC-A…CC-F) additionally refuse the
 * internally-incoherent verdicts, so a wire verdict that parses cannot itself be
 * claiming completion and blocked-ness at once.
 *
 * RESIDUAL RISK, STATED RATHER THAN HIDDEN: if CEE ever emits a non-refusal
 * `analysis_state` while a genuine refusal is still in force, this ordering
 * hides the refusal notice. That requires the producer to contradict itself
 * across two fields of one turn. `mapping.spec.ts` pins the cell explicitly, so
 * the decision is visible and reversible in one line if CEE's behaviour makes it
 * wrong.
 *
 * ⚠ WHAT THIS IS NOT
 * ------------------
 * It is NOT a seventh truth vocabulary, and it is now one derivation SHORTER
 * than it was: the private `resolveDisplayedFreshness(...)` call and its two
 * store subscriptions are GONE, replaced by the selector's own
 * `displayedFreshness`. This hook had been the second reader of the freshness
 * slice; it is no longer a reader of it at all.
 *
 * ⚠ `blocked` IS MINTED ONLY FROM THE WIRE, AND THAT IS A STATEMENT ABOUT THE WIRE
 * -------------------------------------------------------------------------------
 * The contract separates `blocked` (the model cannot be analysed) from `refused`
 * (the engine declined this run). The legacy wire carries ONE signal for both —
 * `analysis_ready.blocked_reason` — so the local limb cannot separate them and
 * never claims to; it mints `refused` only. The wire limb passes `blocked`
 * through when CEE states it. They share a composition row, so nothing
 * user-visible turned on the distinction until `AnalysisStateV1` landed.
 */
import { useCanvasStore } from '@/canvas/store'
import { useAnalysisState } from '@/canvas/state/analysisStateSelector'
import type { AnalysisRunStateKind } from './analysisStateContract'

/**
 * The pure mapping, exported so it is mutation-testable without a store.
 *
 * Every input is a value another module OWNS:
 *  - `wireRunStateKind`  → `useAnalysisState()`'s wire verdict (`null` when this
 *    turn carried none). ⚠ It is the WIRE's own kind, never the selector's
 *    composed `runStateKind` — see the store binding below for why.
 *  - `refusalPresent`    → `analysisRefusalNotice` slice (CEE blocked_reason)
 *  - `resultsStatus`     → the results store's own status machine
 *  - `hasCompletedFirstRun` → the store's run ledger
 *  - `displayedFreshness`   → `useAnalysisState().displayedFreshness`
 */
export function mapToAnalysisRunState(input: {
  /**
   * The WIRE's own `run_state.kind`, or `null` when this turn carried no
   * `analysis_state`. REQUIRED, not optional: an optional field is one a call
   * site can forget, and forgetting this one silently reverts the whole union to
   * the legacy-only behaviour with no test anywhere going red.
   */
  wireRunStateKind: AnalysisRunStateKind | null
  refusalPresent: boolean
  resultsStatus: string | null | undefined
  hasCompletedFirstRun: boolean
  displayedFreshness: 'fresh' | 'stale' | 'unknown' | 'none' | null | undefined
}): AnalysisRunStateKind {
  // 1. A run in flight is a run in flight whatever else is held — the strip
  //    says so, and no other banner may speak over it. ABOVE the wire limb on
  //    purpose: see the header's step 1.
  if (
    input.resultsStatus === 'preparing' ||
    input.resultsStatus === 'connecting' ||
    input.resultsStatus === 'streaming'
  ) {
    return 'running'
  }
  // 2. THE WIRE LIMB — the producer's composed verdict for THIS turn outranks
  //    every derivation below it, including a retained local refusal. When the
  //    wire itself states a refusal it also supplies the more precise member
  //    (`blocked` vs `refused`), which the local slice cannot distinguish.
  //
  //    ⚠ RUNTIME FLOOR — `!= null`, NOT `!== null`, and the difference is a
  //    real defect this caught. The field is typed REQUIRED, so `undefined`
  //    should be unreachable; but the first draft of this line used `!== null`,
  //    and `undefined !== null` is TRUE — so a caller omitting the field
  //    returned `undefined` AS THE RUN-STATE KIND, which then flows into
  //    `TRUTH_BANNER_BY_RUN_STATE[undefined]` at the banner selector. The
  //    existing totality sweep in `mapping.spec.ts` is what found it. A missing
  //    verdict must degrade to the legacy limb, never to a kind that does not
  //    exist.
  if (input.wireRunStateKind != null) return input.wireRunStateKind
  // 3. THE LOCAL REFUSAL LIMB — the half of the union the selector cannot
  //    supply. Refusal outranks never_run so a refused FIRST analysis still
  //    reaches the user; see the header.
  if (input.refusalPresent) return 'refused'
  // 4. No run has completed and none was refused: the pre-run surface owns
  //    this state entirely, and no truth-state banner belongs on it. Ordered
  //    ABOVE the error case on purpose, so a FIRST run that fails stays
  //    `never_run` — there is no prior result for a freshness verdict to be
  //    about, and today's surface correctly shows the error banner alone.
  if (!input.hasCompletedFirstRun) return 'never_run'
  // 5. ⭐ A RERUN THAT FAILED. Caught by `OutputsDock.rerunContinuity.spec`,
  //    and the gap was real: without this line a failed rerun inherited the
  //    RETAINED verdict from the previous run, so a held `fresh` mapped to
  //    `complete_current` — the surface would have presented the old numbers
  //    as current and suppressed the "Showing results from previous analysis"
  //    attribution, immediately after a run that did not produce them. The
  //    retained verdict describes the PREVIOUS run; it cannot vouch for a
  //    surface whose latest run errored.
  //
  //    ⚠ THIS IS ALSO WHY THE SELECTOR'S OWN LEGACY KIND IS NOT CONSUMED HERE.
  //    `deriveRunStateKindFromLegacy` has no error arm, so on an errored rerun
  //    with a retained `fresh` verdict it returns `complete_current`. Passing
  //    `composed.runStateKind` through on the derived branch would re-open
  //    exactly this defect.
  if (input.resultsStatus === 'error') return 'unknown_degraded'
  // 6. A run has completed. Its currency is the freshness owner's verdict —
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
  const composed = useAnalysisState()
  const refusal = useCanvasStore((s) => s.analysisRefusalNotice)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const hasCompletedFirstRun = useCanvasStore((s) => s.hasCompletedFirstRun)

  return mapToAnalysisRunState({
    // ⚠⚠ THE WIRE'S OWN KIND, GATED ON `authority` — NOT `composed.runStateKind`
    // unconditionally. That unconditional read IS the naive substitution: on a
    // legacy turn `runStateKind` is the selector's CONSERVATIVE legacy
    // derivation, which never mints `refused` and has no error arm, so the
    // refusal notice would go dark AND an errored rerun would inherit a stale
    // `complete_current`. Pinned in `mapping.spec.ts`.
    wireRunStateKind: composed.authority === 'wire' ? composed.runStateKind : null,
    refusalPresent: Boolean(refusal),
    resultsStatus: resultsStatus ?? null,
    hasCompletedFirstRun: Boolean(hasCompletedFirstRun),
    // The selector's value, not a second `resolveDisplayedFreshness` call. On
    // the derived branch (the only branch that reaches step 6) it is that same
    // function's output, with the orphan fold applied — and the fold can only
    // ever produce 'unknown', which step 6 already routes to `unknown_degraded`,
    // so the substitution is behaviour-preserving by construction.
    displayedFreshness: composed.displayedFreshness,
  })
}
