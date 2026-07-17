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

function setResults(results: MockResults) {
  mockCanvasState = {
    ...mockCanvasState,
    results,
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

  it('stays silent at a FIRST-run start (the dock auto-switch fronts the Analysis tab in the same breath)', () => {
    // Pre-run status idle: the I.1 auto-switch is about to front the
    // Analysis tab, whose furniture speaks. The announcer must not race it.
    const { rerender } = render(<AnalysisRunAnnouncer analysisTabFronted={false} />)
    setResults({ status: 'streaming', startedAt: Date.now() })
    rerender(<AnalysisRunAnnouncer analysisTabFronted={false} />)
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
})
