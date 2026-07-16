/**
 * F9 (UI brief 2026-07-16 item 3): the Compare tab must SHOW a run in
 * flight. Before this change it had zero isRunning handling: dispatching a
 * run with Compare fronted left the empty state (or retained snapshots)
 * frozen on screen with no in-flight signal at all.
 *
 * Pins:
 *  - run in flight, nothing retained (<2 snapshots): skeleton, not the
 *    empty state (positive control proves the empty state is visible when
 *    idle, so its absence here is meaningful);
 *  - run in flight, snapshots retained: running banner ABOVE the retained
 *    content, content marked busy, never blanked;
 *  - settle (complete or error): treatment gone, honest state back, never
 *    skeleton-forever;
 *  - the body contributes NO aria-live region of its own (the dock-level
 *    announcer is the single voice).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { AnalysisSnapshot } from '../types'

const TWO_SNAPSHOTS = [
  { runNumber: 1, winnerId: 'opt-a', winnerProbability: 65, runnerUpProbability: 35 },
  { runNumber: 2, winnerId: 'opt-a', winnerProbability: 65, runnerUpProbability: 35 },
] as unknown as AnalysisSnapshot[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCanvasState: any
let mockSnapshots: AnalysisSnapshot[] = []

vi.mock('../../store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCanvasStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))
vi.mock('../../stores/analysisSnapshotStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAnalysisSnapshotStore: (selector: (s: any) => unknown) => selector({ snapshots: mockSnapshots }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectSnapshots: (s: any) => s.snapshots,
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector({ activeOutputTab: 'compare' }),
    { getState: () => ({ setActiveOutputTab: vi.fn() }) },
  ),
}))
vi.mock('../deriveTransitions', () => ({
  deriveTransitions: () => [],
  buildCumulativeTransition: () => null,
}))
// Stub the heavy child tree; Hero stands in for "retained content".
vi.mock('../Hero', () => ({ Hero: () => <div data-testid="compare-content" /> }))
vi.mock('../TabHeader', () => ({ TabHeader: () => null }))
vi.mock('../RunSelector', () => ({ RunSelector: () => null }))
vi.mock('../TrajectorySection', () => ({ TrajectorySection: () => null }))
vi.mock('../TransitionsSection', () => ({ TransitionsSection: () => null }))
vi.mock('../CompareFooter', () => ({ CompareFooter: () => null }))
vi.mock('../EmptyState', () => ({ EmptyState: () => <div data-testid="compare-empty-state" /> }))

import { CompareTabBody } from '../CompareTabBody'

function setRun(status: string, startedAt?: number) {
  mockCanvasState = {
    ...mockCanvasState,
    results: { status, startedAt },
  }
}

beforeEach(() => {
  mockSnapshots = []
  mockCanvasState = {
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    results: { status: 'idle' },
    currentScenarioId: null,
    v5AnalysisFact: null,
    selection: { nodeIds: new Set() },
  }
})

describe('F9: CompareTabBody run-state coverage', () => {
  it('positive control: idle with no snapshots shows the empty state and no run treatment', () => {
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(screen.getByTestId('compare-empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('run in flight with nothing retained: skeleton replaces the empty state', () => {
    setRun('streaming', Date.now())
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(screen.getByTestId('analysis-run-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('compare-empty-state')).not.toBeInTheDocument()
  })

  it('run in flight with snapshots retained: banner above content, content marked busy, never blanked', () => {
    mockSnapshots = TWO_SNAPSHOTS
    setRun('streaming', Date.now())
    const { container } = render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.getByTestId('compare-content')).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('settle: the treatment is gone and retained content is unmarked', () => {
    mockSnapshots = TWO_SNAPSHOTS
    setRun('complete')
    const { container } = render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('compare-content')).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('error with nothing retained: honest empty state, never skeleton-forever', () => {
    setRun('error')
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('compare-empty-state')).toBeInTheDocument()
  })

  it('contributes no aria-live region of its own (the dock announcer is the single voice)', () => {
    mockSnapshots = TWO_SNAPSHOTS
    setRun('streaming', Date.now())
    const { container } = render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0)
  })
})
