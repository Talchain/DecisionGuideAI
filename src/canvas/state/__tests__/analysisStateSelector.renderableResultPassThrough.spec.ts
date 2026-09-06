/**
 * ⭐ THE SELECTOR MUST ACTUALLY FORWARD `hasRenderableResult` — and this file
 * exists because a mutant proved nothing was checking that it does.
 *
 * `deriveAnalysisDisplayState` gained a branch so that "Analysis complete" can
 * no longer be said over a report with nothing renderable in it (measured on
 * build `acd3db4d`: 5/5 factors and 3/3 options `unmatched`, no PLoT or ISL
 * leg). Three mutants against the mapper bit immediately.
 *
 * A FOURTH SURVIVED: hard-coding the selector's own
 * `hasRenderableResult` to `true` left every test green. The mapper was
 * correct, fully tested, and completely unreachable — the estate's
 * built-but-not-plugged-in defect, one level below the surface it was written
 * to fix, and invisible to every test that only exercised the pure function.
 *
 * So this pins the WIRING, not the rule: the same inputs, differing only in
 * `hasRenderableResult`, must produce different display states THROUGH
 * `composeAnalysisState`.
 */

import { describe, it, expect } from 'vitest'
import { composeAnalysisState } from '../analysisStateSelector'

/**
 * A completed, current, unedited run — the exact situation in which the old
 * code said "Analysis complete" unconditionally. Everything here is held
 * constant across the pair below so `hasRenderableResult` is the only variable.
 */
const COMPLETED_RUN = {
  analysisState: null,
  freshness: 'fresh' as const,
  dirty: false,
  source: 'legacy' as const,
  resultsStatus: 'complete',
  resultsStartedAt: 1_760_000_000_000,
  importHold: false,
  hasReport: true,
  ceeAnalysisReadyStatus: 'ready',
  aiPanelV2On: true,
}

describe('composeAnalysisState — the renderable-result flag reaches the headline', () => {
  it('⭐ a report with nothing renderable does NOT reach "Analysis complete"', () => {
    const out = composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: false } as never)
    expect(out.displayState.state).toBe('ran_without_result')
    expect(out.displayState.headline).toBe('Analysis finished without a result')
  })

  it('⭐ THE TWIN: the identical run WITH a renderable result is complete', () => {
    const out = composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: true } as never)
    expect(out.displayState.state).toBe('complete')
    expect(out.displayState.headline).toBe('Analysis complete')
  })

  it('the pair actually DIFFER — the discrimination is asserted, not assumed', () => {
    // Without this, both cases could return the same value and each test above
    // would still be readable as "passing". The property under test is that the
    // flag CHANGES the answer; assert that directly.
    const empty = composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: false } as never)
    const full = composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: true } as never)
    expect(empty.displayState.state).not.toBe(full.displayState.state)
    expect(empty.displayState.headline).not.toBe(full.displayState.headline)
  })

  it('omitting the flag preserves the previous behaviour for callers that do not pass it', () => {
    const out = composeAnalysisState({ ...COMPLETED_RUN } as never)
    expect(out.displayState.state).toBe('complete')
  })
})
