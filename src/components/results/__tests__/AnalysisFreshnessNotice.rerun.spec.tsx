/**
 * Anchor-run-control (Paul, 21-Jul) — the freshness strip is INFORMATIONAL: it
 * states fresh/stale/unknown but carries NO Rerun. The one Rerun lives in the
 * bottom anchor AnalysisFooter (see OutputsDock.rerunSingleOwner.spec.tsx).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import { AnalysisFreshnessNotice } from '../AnalysisFreshnessNotice'
import { useCanvasStore } from '../../../canvas/store'
import { __resetCanonicalRunnerForTests } from '../../../canvas/analysis/canonicalRunRegistry'

const showToast = vi.fn()
vi.mock('../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => showToast,
}))

const STALE = { freshness: 'stale' as const, freshnessReason: 'graph_changed', computedAt: 1 }
const FRESH = { freshness: 'fresh' as const, freshnessReason: null, computedAt: 1 }

beforeEach(() => {
  __resetCanonicalRunnerForTests()
  showToast.mockClear()
  useCanvasStore.getState().resultsReset()
  useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
})
afterEach(() => __resetCanonicalRunnerForTests())

describe('AnalysisFreshnessNotice — informational only (anchor-run-control)', () => {
  // The strip states freshness; the Rerun moved to the bottom anchor footer.
  // MUTATION-CHECK: reintroduce the `freshness-strip-rerun` button in
  // AnalysisFreshnessNotice and these go RED (a second Rerun owner is back).
  it.each(['stale', 'unknown', 'fresh', 'none'] as const)(
    '%s verdict → the strip carries NO Rerun button',
    (freshness) => {
      render(<AnalysisFreshnessNotice state={{ freshness, freshnessReason: null, computedAt: 1 } as never} dirty={false} />)
      expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
    },
  )

  it('renders the freshness copy for a held verdict (still communicates state)', () => {
    render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveAttribute('data-freshness', 'stale')
    expect(notice).toHaveTextContent('Model changed since this analysis. Re-run to update.')
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
  })

  it('never renders a Rerun even while analysing (no dead control, no duplicate owner)', () => {
    useCanvasStore.getState().resultsStart({ seed: 1 })
    const { rerender } = render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
    // FRESH still has nothing to click either.
    rerender(<AnalysisFreshnessNotice state={FRESH as never} dirty={false} />)
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
  })
})

describe('AnalysisFreshnessNotice — completion toast agrees with the strip (acceptance: they can never disagree)', () => {
  // The toast copy derives from the SAME classification the strip renders.
  // Pre-fix the toast said "Analysis rerun completed with the current model"
  // purely on the running→complete transition while the same component's
  // render showed "Model changed since this analysis." for a retained stale
  // verdict — the brief line-17 bonus contradiction.
  const REPORT = { model_card: { response_hash: 'h-new' } } as never

  function completeRun() {
    act(() => {
      useCanvasStore.getState().resultsStart({ seed: 1 })
    })
    act(() => {
      useCanvasStore.getState().resultsComplete({ report: REPORT, hash: 'h-new' })
    })
  }

  it('retained stale verdict → NEUTRAL completion toast, never "with the current model"', () => {
    act(() => {
      useCanvasStore.setState({
        analysisFreshness: { freshness: 'stale', freshnessReason: 'analysed_options_diverged' },
        analysisFreshnessDirty: false,
      })
    })
    render(<AnalysisFreshnessNotice />)
    completeRun()
    expect(showToast).toHaveBeenCalledWith('Analysis rerun completed')
    expect(showToast).not.toHaveBeenCalledWith('Analysis rerun completed with the current model')
    // ...while the strip in the same render carries the stale claim: the two
    // surfaces no longer contradict.
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'stale')
  })

  it('fresh verdict → the "with the current model" toast is still earned', () => {
    act(() => {
      useCanvasStore.setState({
        analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        analysisFreshnessDirty: false,
      })
    })
    render(<AnalysisFreshnessNotice />)
    completeRun()
    expect(showToast).toHaveBeenCalledWith('Analysis rerun completed with the current model')
  })

  it('self-contradictory stale (identical hashes) → neutral toast, matching the cannot-confirm strip', () => {
    act(() => {
      useCanvasStore.setState({
        analysisFreshness: {
          freshness: 'stale',
          freshnessReason: 'analysed_options_diverged',
          graphHashAtRun: '595d1a7b7ec9272b',
          currentGraphHash: '595d1a7b7ec9272b',
        },
        analysisFreshnessDirty: false,
      })
    })
    render(<AnalysisFreshnessNotice />)
    completeRun()
    expect(showToast).toHaveBeenCalledWith('Analysis rerun completed')
    expect(showToast).not.toHaveBeenCalledWith('Analysis rerun completed with the current model')
  })
})

/**
 * /simplify item 10 — the C6 whisper contract, pinned on the COUNTERPARTY.
 *
 * runAnnouncementForTransition encodes "a FIRST-run settle does NOT yield,
 * because nothing else announces it". That rule was pinned only on the pure
 * function's own side, where it passes by construction. The claim it rests
 * on is about THIS surface: the completion toast mounts post-settle with
 * wasRunningRef = false, so it stays silent on a first run.
 *
 * If this surface ever started toasting a first-run settle, the announcer's
 * non-yield would become a DOUBLE announcement — and nothing would catch it.
 */
describe('C6 counterparty — the completion toast is silent on a FIRST-run settle', () => {
  const FIRST_RUN_REPORT = { model_card: { response_hash: 'h-first' } } as never

  it('mounting AFTER the settle fires no toast — the first run is this surface’s blind spot', () => {
    act(() => {
      useCanvasStore.setState({
        analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        analysisFreshnessDirty: false,
      })
    })
    // The entire run happens before this surface exists — exactly the first-run
    // case, where the dock's auto-switch fronts the Analysis tab and the notice
    // mounts onto an already-settled store.
    act(() => {
      useCanvasStore.getState().resultsStart({ seed: 1 })
    })
    act(() => {
      useCanvasStore.getState().resultsComplete({ report: FIRST_RUN_REPORT, hash: 'h-first' })
    })

    render(<AnalysisFreshnessNotice />)

    expect(showToast).not.toHaveBeenCalled()
  })

  it('positive control: the SAME harness does toast when the notice watched the run', () => {
    act(() => {
      useCanvasStore.setState({
        analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
        analysisFreshnessDirty: false,
      })
    })
    render(<AnalysisFreshnessNotice />)
    act(() => {
      useCanvasStore.getState().resultsStart({ seed: 1 })
    })
    act(() => {
      useCanvasStore.getState().resultsComplete({ report: FIRST_RUN_REPORT, hash: 'h-first' })
    })
    expect(showToast).toHaveBeenCalled()
  })
})
