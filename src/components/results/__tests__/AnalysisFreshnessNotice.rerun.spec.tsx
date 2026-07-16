/**
 * Wave F-B — the freshness strip is the SOLE stale owner and carries the
 * ONE Rerun action (brief §5.2), routed through the canonical runner.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { AnalysisFreshnessNotice } from '../AnalysisFreshnessNotice'
import { useCanvasStore } from '../../../canvas/store'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
} from '../../../canvas/analysis/canonicalRunRegistry'

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

describe('AnalysisFreshnessNotice — strip Rerun (Wave F-B)', () => {
  it('stale verdict → the strip carries THE Rerun action', () => {
    render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
  })

  it("unknown (cannot-confirm) also offers Rerun — the old banner covered both not-fresh states", () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'unknown', freshnessReason: null, computedAt: 1 } as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
  })

  // Parity rebuild 2026-07-13: the prototype offers Rerun in the FRESH state
  // too (rerunning against the current model is always legitimate); only
  // 'none' — nothing analysed yet — has no rerun affordance.
  it('fresh → Rerun offered; none → no Rerun affordance', () => {
    const { rerender } = render(<AnalysisFreshnessNotice state={FRESH as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
    rerender(<AnalysisFreshnessNotice state={{ freshness: 'none', freshnessReason: null, computedAt: 1 } as never} dirty={false} />)
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
  })

  it('click routes through the canonical runner (never a private pipeline)', () => {
    const runner = vi.fn(async (_opts?: import('../../../canvas/analysis/canonicalRunRegistry').CanonicalRunOptions) => ({ status: 'dispatched' as const }))
    registerCanonicalRunner(runner)
    render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    fireEvent.click(screen.getByTestId('freshness-strip-rerun'))
    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner.mock.calls[0][0]).toMatchObject({ source: 'freshness-strip' })
  })

  it('a blocked or unavailable run says WHY (no dead control)', async () => {
    const runner = vi.fn(async (_opts?: import('../../../canvas/analysis/canonicalRunRegistry').CanonicalRunOptions) => ({ status: 'blocked' as const, reason: 'Add a goal first.' }))
    registerCanonicalRunner(runner)
    render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    fireEvent.click(screen.getByTestId('freshness-strip-rerun'))
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Add a goal first.'))
  })

  it("disables while analysing — identically for V2 resultsStart and V5 resultsAnalysing ('preparing' equivalence pin)", () => {
    registerCanonicalRunner(vi.fn(async () => ({ status: 'dispatched' as const })))
    useCanvasStore.getState().resultsStart({ seed: 1 })
    const { rerender } = render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeDisabled()

    useCanvasStore.getState().resultsReset()
    useCanvasStore.getState().resultsAnalysing()
    rerender(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeDisabled()
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
