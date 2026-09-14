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
   * ⭐⭐ THE ONE CLAIM THIS OVERRIDE MAY NOT DISPLACE — and the suite taught me
   * this, expensively.
   *
   * My first implementation applied the override to the COMPOSED semantic, one
   * level up, so a single rule would cover the wire and derived branches. From
   * up there the two kinds of `'changed'` are indistinguishable, so it silently
   * displaced CEE's OWN first-hand statement and broke twelve tests across five
   * files — including `importCanvas.analysisInvalidation.spec.tsx`, the
   * cross-surface guard that pins "a CEE-STATED stale OUTRANKS the hold".
   *
   * A server statement that the model changed outranks every client belief,
   * including this one. These are the cases that must survive the override.
   */
  it('CEE-STATED stale still outranks it — the claim it may never displace', () => {
    const stated = composeAnalysisState({
      ...base,
      freshness: { freshness: 'stale' as const, freshnessReason: 'graph_changed' },
      hasCompletedFirstRun: false,
    })
    expect(stated.semantic).toBe('changed')
  })

  it('leaves CANNOT-CONFIRM alone — an honest "we cannot tell" is not a change claim', () => {
    // This arm broke 7 tests when the gate sat above it, including "THE OVER-HOLD
    // MUST NOT LIE: a held import renders cannot-confirm, never 'Model changed'".
    const held = composeAnalysisState({
      ...base,
      freshness: { freshness: 'unknown' as const, freshnessReason: 'hydrated_without_capture' },
      hasCompletedFirstRun: false,
    })
    expect(held.semantic).toBe('cannot_confirm')
  })

  it('leaves fresh and none alone on a never-run model', () => {
    const current = composeAnalysisState({
      ...base,
      freshness: { freshness: 'fresh' as const, freshnessReason: 'graph_hash_match' },
      dirty: false,
      hasCompletedFirstRun: false,
    })
    expect(current.semantic).toBe('current')

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
