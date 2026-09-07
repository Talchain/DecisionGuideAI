/**
 * ⭐⭐ THE SURFACE A USER ACTUALLY HEARS SAY "COMPLETE" MUST NOT SAY IT OVER AN
 * EMPTY RESULT — and this file pins the STORE READ, not just the rule.
 *
 * WHY IT EXISTS. An earlier change added an empty-result branch to
 * `deriveAnalysisDisplayState` and pinned it with a pass-through spec that
 * claimed to test the WIRING. It did not: it exercised `composeAnalysisState`,
 * the pure function ONE LAYER BELOW the wiring, so replacing the hook's
 * `useCanvasStore(selectHasAnyRealProbability)` with a hard-coded `true` left
 * every spec green. An independent seat found that, and it was right.
 *
 * ⚠ AND THE HEADLINE IT FIXED REACHES NO USER. Derived at the bytes:
 * `analysis_display_headline` is emitted ONLY by `exportBundle.ts` (the debug
 * bundle), and `StickyFooter` — the sole product consumer of
 * `useAnalysisDisplayState` — reads ONLY `view.cta?.label` and `view.cta?.kind`.
 * The `.headline` is never rendered.
 *
 * The string a user meets is `runAnnouncementForTransition`'s
 * **"Analysis complete."** (note the full stop — a DIFFERENT string from the
 * headline's "Analysis complete"), announced through this component's
 * `role="status"` region. That announcer gated on `settledWithoutNewReport`,
 * which answers "did a NEW report arrive" — never "does it CONTAIN anything".
 *
 * These tests render the real component against a mocked store, so a mutant
 * that hard-codes the store read REDs here.
 *
 * SCOPE (CLAUDE.md trap 3): jsdom text assertions on a live region. They prove
 * the announced STRING, not audibility, timing or screen-reader behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisRunAnnouncer } from '../AnalysisRunAnnouncer'
import {
  runAnnouncementForTransition,
  RUN_FINISHED_WITHOUT_RESULT_COPY,
  RUN_ENDED_WITHOUT_NEW_RESULTS_COPY,
} from '../analysisRunStatus'

/** A report that is POPULATED but carries no renderable probability. */
const EMPTY_REPORT = { option_comparison: [{ id: 'a', win_probability: null }] }
/** The same shape with a real number — the discriminating twin. */
const FULL_REPORT = { option_comparison: [{ id: 'a', win_probability: 0.62 }] }

let isRunningMock = false
vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ isRunning: isRunningMock }),
}))

let storeState: Record<string, unknown> = {}
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

// ─── the pure rule ────────────────────────────────────────────────────────────
describe('runAnnouncementForTransition — a settle with nothing in it', () => {
  const base = {
    transition: 'settle' as const,
    settledStatus: 'complete',
    preRunStatus: 'streaming',
    analysisTabFronted: false,
    settledWithoutNewReport: false,
  }

  it('⭐ an empty result does NOT announce completion', () => {
    expect(runAnnouncementForTransition({ ...base, hasRenderableResult: false }))
      .toBe(RUN_FINISHED_WITHOUT_RESULT_COPY)
  })

  it('⭐ THE TWIN: the identical settle WITH a result announces completion', () => {
    expect(runAnnouncementForTransition({ ...base, hasRenderableResult: true }))
      .toBe('Analysis complete.')
  })

  it('the pair actually DIFFER — the discrimination is asserted, not assumed', () => {
    const empty = runAnnouncementForTransition({ ...base, hasRenderableResult: false })
    const full = runAnnouncementForTransition({ ...base, hasRenderableResult: true })
    expect(empty).not.toBe(full)
  })

  it('a restored-previous settle keeps ITS OWN copy — the two states are not merged', () => {
    // `settledWithoutNewReport` is the more specific statement and outranks.
    // Merging them would tell a user with nothing that their previous analysis
    // is showing, which is false.
    expect(runAnnouncementForTransition({
      ...base, settledWithoutNewReport: true, hasRenderableResult: false,
    })).toBe(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
    expect(RUN_FINISHED_WITHOUT_RESULT_COPY).not.toBe(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
  })

  it('an omitted flag defaults to true — an existing caller is unchanged', () => {
    expect(runAnnouncementForTransition(base)).toBe('Analysis complete.')
  })
})

// ─── the WIRING, which is what the earlier spec failed to pin ────────────────
describe('AnalysisRunAnnouncer — the STORE READ reaches the announcement', () => {
  beforeEach(() => { vi.clearAllMocks(); isRunningMock = false })

  /**
   * Drives a real running→complete transition and returns the ANNOUNCED TEXT,
   * unmounting before it returns.
   *
   * ⚠ The unmount is not tidiness. Without it a second call leaves two live
   * regions in the document and `getByTestId` throws "found multiple elements"
   * — which is how the first cut of the third case below failed. Returning the
   * string rather than the element also stops a later assertion reading an
   * element that has since been torn down.
   */
  const announceOnSettle = (report: unknown): string => {
    isRunningMock = true
    storeState = { results: { status: 'streaming', report: null, settledWithoutNewReport: false } }
    const view = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    isRunningMock = false
    storeState = { results: { status: 'complete', report, settledWithoutNewReport: false } }
    view.rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    const text = screen.getByTestId('analysis-run-announcer').textContent ?? ''
    view.unmount()
    return text
  }

  it('⭐ a settle whose report has no real probability announces the honest copy', () => {
    // A mutant hard-coding `hasRenderableResult = true` in the component REDs
    // here and NOWHERE in the pure-rule block above. That is the whole point of
    // this second describe.
    expect(announceOnSettle(EMPTY_REPORT)).toBe(RUN_FINISHED_WITHOUT_RESULT_COPY)
  })

  it('⭐ THE TWIN: the same settle with a real probability announces completion', () => {
    expect(announceOnSettle(FULL_REPORT)).toBe('Analysis complete.')
  })

  it('the rendered pair DIFFER — the store read is load-bearing', () => {
    const empty = announceOnSettle(EMPTY_REPORT)
    const full = announceOnSettle(FULL_REPORT)
    expect(empty).not.toBe(full)
  })
})
