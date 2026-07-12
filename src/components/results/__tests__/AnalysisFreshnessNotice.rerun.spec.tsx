/**
 * Wave F-B — the freshness strip is the SOLE stale owner and carries the
 * ONE Rerun action (brief §5.2), routed through the canonical runner.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { AnalysisFreshnessNotice } from '../AnalysisFreshnessNotice'
import { useCanvasStore } from '../../../canvas/store'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
} from '../../../canvas/analysis/canonicalRunRegistry'

const STALE = { freshness: 'stale' as const, freshnessReason: 'graph_changed', computedAt: 1 }
const FRESH = { freshness: 'fresh' as const, freshnessReason: null, computedAt: 1 }

beforeEach(() => {
  __resetCanonicalRunnerForTests()
  useCanvasStore.getState().resultsReset()
})
afterEach(() => __resetCanonicalRunnerForTests())

describe('AnalysisFreshnessNotice — strip Rerun (Wave F-B)', () => {
  it('stale verdict → the strip carries THE Rerun action', () => {
    render(<AnalysisFreshnessNotice state={STALE as never} dirty={false} />)
    expect(screen.getByTestId('freshness-strip-rerun')).toBeInTheDocument()
  })

  it('fresh / none → no Rerun affordance on the strip', () => {
    const { rerender } = render(<AnalysisFreshnessNotice state={FRESH as never} dirty={false} />)
    expect(screen.queryByTestId('freshness-strip-rerun')).not.toBeInTheDocument()
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
