/**
 * F9 (UI brief 2026-07-16 item 3): AnalysisRunAnnouncer — THE single
 * aria-live region for run start/settle outside the Analysis tab.
 *
 * The dock mounts this ONCE, so a run dispatched while Compare, Model or
 * Olumi is fronted is still announced; per-surface treatments (banner,
 * skeleton) stay silent. While the Analysis tab is fronted the announcer
 * yields, because that tab's own furniture already speaks: the running
 * banner's narration div at start (the #329 trap: adding a second start
 * announcement there double-announces) and the completion toast / error
 * alert at settle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

interface MockResults {
  status: string
  startedAt?: number
  report?: unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCanvasState: any

vi.mock('../../store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCanvasStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))

import { AnalysisRunAnnouncer } from '../AnalysisRunAnnouncer'

/**
 * A report carrying a REAL probability — what "a run completed" means.
 *
 * ⚠ WHY THIS EXISTS. The announcer now consults `selectHasAnyRealProbability`,
 * because "a report arrived" and "the report contains anything" are different
 * questions and only the second licenses the word complete. Every fixture below
 * that sets `status: 'complete'` means an ORDINARY completed run, so it needs a
 * report with something in it — otherwise these tests would silently start
 * exercising the empty-result path and assert the wrong copy.
 */
const COMPLETED_REPORT = { option_comparison: [{ id: 'opt-a', win_probability: 0.62 }] }

function setResults(results: MockResults) {
  mockCanvasState = {
    ...mockCanvasState,
    // A 'complete' status with no explicit report means "an ordinary completed
    // run". A test that wants the EMPTY-result case passes `report` itself, and
    // that explicit value always wins.
    results:
      results.status === 'complete' && !('report' in results)
        ? { ...results, report: COMPLETED_REPORT }
        : results,
  }
}

beforeEach(() => {
  mockCanvasState = {
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    results: { status: 'idle' },
    currentScenarioId: null,
    v5AnalysisFact: null,
    selection: { nodeIds: new Set() },
  }
})

const announcer = () => screen.getByTestId('analysis-run-announcer')

describe('F9: AnalysisRunAnnouncer', () => {
  it('renders one polite, visually hidden live region, initially silent', () => {
    render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    const region = announcer()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveClass('sr-only')
    expect(region).toHaveTextContent('')
  })

  it('announces a rerun start when the Analysis tab is not fronted', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')
  })

  /**
   * ⚠⚠ INVERTED 9 Sep 2026 — THE THIRD RECORD OF ONE GAP, AND THE REASON THE
   * FIX HAD TO SWEEP EVERY READER OF THE PREDICATE RATHER THAN ONE CALL SITE.
   *
   * This case read `stays silent at a FIRST-run start (the dock auto-switch
   * fronts the Analysis tab in the same breath)`, and its comment said *"the
   * I.1 auto-switch is about to front the Analysis tab, whose furniture
   * speaks. The announcer must not race it."* Both were true when written.
   *
   * The default-tab ruling deleted the auto-switch
   * (`navigatesToAnalysisTab = Boolean(showResultsPanel)` in `OutputsDock.tsx`),
   * so on a fresh unchosen session nothing fronts the Analysis tab and nothing
   * speaks: `AnalysisRunStateCover` is visual-only by ruling (UI #1198) and the
   * tab-name live region does not change. The silence this case pinned became
   * a first run that assistive technology never hears until SETTLE.
   *
   * `runAnnouncementForTransition`'s START arm now yields on
   * `analysisTabFronted` alone. The rerun-while-fronted case directly below is
   * unchanged and is the discriminating twin: frontedness still silences the
   * announcer, so this is a narrowing of the yield, not its removal.
   */
  it('announces a FIRST-run start when the Analysis tab is NOT fronted (nothing fronts it any more)', () => {
    // Pre-run status idle marks the first run, and the tab is not fronted —
    // exactly the fresh-session journey the default-tab ruling makes ordinary.
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN, added with the inversion above: a FIRST run
   * started while the Analysis tab IS fronted must stay silent, because its
   * running banner is a real live region there. Without this, "announce a first
   * run" could be satisfied by an unconditional START arm, which would speak
   * the same start twice.
   */
  it('stays silent at a FIRST-run start while the Analysis tab IS fronted (its banner announces there)', () => {
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    expect(announcer()).toHaveTextContent('')
  })

  it('stays silent at a rerun start while the Analysis tab is fronted (its narration div already announces)', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    expect(announcer()).toHaveTextContent('')
  })

  it('announces completion when the Analysis tab is not fronted', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'complete' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis complete.')
  })

  it('stays silent at settle while the Analysis tab is fronted (the completion toast already announces)', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'complete' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    expect(announcer()).toHaveTextContent('')
  })

  it('announces failure honestly (never a completion claim) when not fronted', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'error' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis failed.')
  })

  it('does not re-announce when the user switches tabs mid-run', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')

    // Front the Analysis tab, then leave again: no state transition, so the
    // message must not change (a change would re-announce to screen readers).
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')
  })

  it('does not retroactively announce a start it never observed (mid-run mount)', () => {
    setResults({ status: 'streaming', startedAt: Date.now() })
    render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent('')
  })

  it('is the ONLY aria-live element it contributes (no nested duplicate regions)', () => {
    const { container } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  // Review-folds C2: a settle that restored the OLD report (abort/timeout —
  // results.settledWithoutNewReport) must never claim completion.
  it('announces the honest resultless-settle copy, never "Analysis complete.", when the run ended without new results', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    mockCanvasState = {
      ...mockCanvasState,
      results: { status: 'complete', settledWithoutNewReport: true },
    }
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    expect(announcer()).toHaveTextContent(
      'The run ended without new results. Showing your previous analysis.',
    )
    expect(announcer()).not.toHaveTextContent('Analysis complete.')
  })

  // Review-folds C6: nothing else announces a FIRST-run settle (the
  // freshness toast only fires on reruns), so the announcer must speak even
  // though the auto-switch fronted the Analysis tab.
  it('announces a FIRST-run settle even while the Analysis tab is fronted (nothing else speaks there)', () => {
    // preRunStatus idle marks the first run.
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    // Start yields because the tab is FRONTED and its running banner speaks
    // there. (This read "the auto-switch furniture speaks" until 9 Sep 2026;
    // the auto-switch is gone, the yield here is not — it never depended on
    // it, because `analysisTabFronted` is true on this path.)
    expect(announcer()).toHaveTextContent('')
    setResults({ status: 'complete' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    expect(announcer()).toHaveTextContent('Analysis complete.')
  })

  it('still yields a RERUN settle while the Analysis tab is fronted (the completion toast speaks there)', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    setResults({ status: 'complete' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} />)
    expect(announcer()).toHaveTextContent('')
  })
})
