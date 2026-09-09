/**
 * A MODEL THAT HAS NEVER BEEN ANALYSED IS NOT AN OUT-OF-DATE ONE.
 *
 * MEASURED on deployed staging `fa95cf65`, driven as a guest through the saved
 * example "Customer Data Platform Selection" with `hasCompletedFirstRun: false`:
 * THREE surfaces asserted the model had changed, on the first screen a visitor
 * reads —
 *   · the Reasoning tab said "No analysis has run yet for this model." and,
 *     five lines below it, "Model changed. Results may be out of date."
 *   · `ReanalyseBar` rendered that same sentence (it renders only for a
 *     'changed' semantic, so its presence IS the semantic);
 *   · the composer placeholder read "Model changed. Ask or rerun…".
 *
 * All three read ONE authority — `useAnalysisTrust().semantic`, i.e. the
 * composed semantic below — so the defect is upstream of all three and the fix
 * belongs here rather than in any surface. (Fixing it in `ReanalyseBar` alone
 * would leave the other two lying and is why that approach failed a
 * cross-surface spec.)
 *
 * ROOT CAUSE: neither `analysisFreshness.ts` nor `analysisStateSelector.ts`
 * referenced `hasCompletedFirstRun` AT ALL — zero occurrences in both, against
 * a contrast control of 26 and 17 for `dirty`. Every branch of the freshness
 * reasoning presupposes a prior run ("the user has edited since CEE last
 * spoke"). With no run, "changed" is not merely unproven, it is category-false.
 *
 * ⚠ THE SUPPRESSION IS DELIBERATELY NARROW — only the 'changed' claim, which is
 * the only semantic that ASSERTS a prior run. 'none', 'current' and
 * 'cannot_confirm' are untouched, so an empty canvas keeps behaving exactly as
 * it did. The second test below is the opposite-direction twin that proves this:
 * a guard that suppressed everything would pass the first test and fail this one.
 */
import { describe, it, expect } from 'vitest'
import { composeAnalysisState } from '../analysisStateSelector'
import { VERDICT_ABSENT_FROM_PAYLOAD } from '../../store/analysisFreshness'

/** The exact state the deployed never-run saved example was measured in. */
const base = {
  analysisState: null,
  freshness: { freshness: 'unknown' as const, freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD },
  dirty: true,
  source: null,
  resultsStatus: 'complete',
  resultsStartedAt: undefined,
  importHold: false,
  hasReport: true,
  ceeAnalysisReadyStatus: undefined,
  aiPanelV2On: true,
}

describe('a never-run model is not an out-of-date one', () => {
  it('does NOT claim the model changed when no run has ever completed', () => {
    const state = composeAnalysisState({ ...base, hasCompletedFirstRun: false })
    expect(state.semantic).not.toBe('changed')
    expect(state.semantic).toBe('never_run')
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Same payload, one field flipped. If the
   * guard suppressed the claim generally rather than only where it is false,
   * this goes red — which is the whole point of writing it.
   */
  it('CONTROL: still says the model changed on a run that DID complete', () => {
    const state = composeAnalysisState({ ...base, hasCompletedFirstRun: true })
    expect(state.semantic).toBe('changed')
  })

  /**
   * ⭐ THE NARROWNESS IS A CLAIM, SO IT IS TESTED RATHER THAN ASSERTED. The
   * override displaces `'changed'` ONLY. A blanket
   * `!hasCompletedFirstRun ? 'never_run' : …` would satisfy both tests above and
   * silently clobber every other member — including `'none'`, which is what an
   * empty canvas reads and which decides whether this bar appears there at all.
   */
  it('leaves a NON-changed semantic alone on a never-run model', () => {
    const cannotConfirm = composeAnalysisState({
      ...base,
      freshness: { freshness: 'unknown' as const, freshnessReason: 'hydrated_without_capture' },
      hasCompletedFirstRun: false,
    })
    expect(cannotConfirm.semantic).toBe('cannot_confirm')

    const none = composeAnalysisState({
      ...base,
      freshness: null,
      dirty: false,
      hasReport: false,
      resultsStatus: undefined,
      hasCompletedFirstRun: false,
    })
    expect(none.semantic).toBe('none')
  })
})
