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

/**
 * ⭐⭐ THE POPULATION THE COMPONENT COULD NOT SEE — added 10 Sep 2026.
 *
 * Every case above renders with ONE value of the variable that selects the
 * harm: nothing is ever about to front the Analysis tab. That is why this file
 * went green through a round that left a fresh session silent AND a round that
 * announced twice for anyone whose run start carries a navigation.
 *
 * `willFrontAnalysisTab` is the dock's PENDING navigation intent, threaded
 * from the same `Boolean(showResultsPanel)` derivation the dock's own
 * auto-switch uses (`OutputsDock.tsx` — one derivation, not a second copy of
 * the literal, so the two cannot drift).
 *
 * ⚠ Why frontedness-now cannot stand in for it: the announcer's effect runs in
 * the SAME flush as the dock effect that moves the tab, and as a child its
 * effect runs FIRST, so its `analysisTabFronted` prop is the pre-navigation
 * render's value. The effect DOES re-run when the prop changes one commit
 * later — and hits the `isRunning === wasRunningRef.current` early return
 * (`AnalysisRunAnnouncer.tsx`), so it never re-evaluates. The stale reading is
 * the only reading the rule ever gets.
 */
describe('AnalysisRunAnnouncer: the pending-navigation population', () => {
  /**
   * POPULATION navigation-in-flight, rendered as the real two-commit sequence
   * rather than asserted: the run start arrives while the prop still says NOT
   * fronted, and the navigation lands on the NEXT render.
   *
   * Reachable on a fresh session with empty localStorage — `ReactFlowGraph.tsx`
   * ⌘Enter calls `setShowResultsPanel(true)` in the same gesture as
   * `executeCanonicalRun` — so this is not a returning-user edge case.
   */
  it('stays silent when a run start carries a pending navigation, and does NOT speak when the tab then arrives', () => {
    setResults({ status: 'idle' })
    const { rerender } = render(
      <AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={true} />,
    )
    setResults({ status: 'streaming', startedAt: Date.now() })
    // COMMIT 1 — the run-start transition, observed with the STALE prop.
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={true} />)
    expect(
      announcer(),
      'the banner mounts one commit later and speaks — announcing here is the double',
    ).toHaveTextContent('')
    // COMMIT 2 — the dock's navigation lands. Still silent: the transition is
    // spent, and re-announcing on a prop change would be its own defect.
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} willFrontAnalysisTab={true} />)
    expect(announcer()).toHaveTextContent('')
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN, and the reason this is not "always yield".
   * Same first run, same two commits, the ONE signal flipped: nothing is
   * pending, and no navigation ever lands. The announcer must speak, or this
   * is round 1's silence again.
   */
  it('announces when NO navigation is pending, and the tab never arrives', () => {
    setResults({ status: 'idle' })
    const { rerender } = render(
      <AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={false} />,
    )
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')
    // PRECONDITION, PINNED IN-TEST: no navigation lands, so the announcement
    // above is provably the only voice this run start gets.
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={false} />)
    expect(announcer()).toHaveTextContent('Analysis started.')
  })

  /**
   * A RERUN with the navigation pending — the cell `|| firstRun` never
   * covered, so the double was reachable before round 2 as well. Pinned so a
   * future reader cannot reintroduce a first-run conjunct.
   */
  it('stays silent on a RERUN start that carries a pending navigation', () => {
    setResults({ status: 'complete' })
    const { rerender } = render(
      <AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={true} />,
    )
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={true} />)
    expect(announcer()).toHaveTextContent('')
  })

  /**
   * ⚠ The SETTLE arm must not consume the new signal. A first-run settle is
   * announced by nobody else, so it speaks regardless of what the navigation
   * did at start. If a later edit threads the signal into SETTLE "for
   * symmetry", this REDs.
   */
  it('still announces a FIRST-run settle while fronted, whatever the pending navigation said', () => {
    setResults({ status: 'idle' })
    const { rerender } = render(
      <AnalysisRunAnnouncer analysisTabFronted={false} willFrontAnalysisTab={true} />,
    )
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} willFrontAnalysisTab={true} />)
    setResults({ status: 'complete' })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={true} willFrontAnalysisTab={true} />)
    expect(announcer()).toHaveTextContent('Analysis complete.')
  })
})
