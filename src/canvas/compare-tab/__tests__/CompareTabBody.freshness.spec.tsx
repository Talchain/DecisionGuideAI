/**
 * CompareTabBody — freshness → compareState wiring at the component boundary.
 *
 * deriveCompareState (pure) and classifyFreshnessForDisplay (pure) are unit-tested
 * separately; this locks the wiring CompareTabBody adds: graphIsStale is sourced
 * from classifyFreshnessForDisplay(analysisFreshness, analysisFreshnessDirty) ===
 * 'changed', NOT graphEditedSinceLastRun. The heavy child tree is stubbed; Hero
 * echoes the `state` prop so we can assert the derived CompareState.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AnalysisSnapshot } from '../types'

// Two snapshots, same winner, 30pp margin → non-stale path resolves to 'improving'.
const SNAPSHOTS = [
  { runNumber: 1, winnerId: 'opt-a', winnerProbability: 65, runnerUpProbability: 35 },
  { runNumber: 2, winnerId: 'opt-a', winnerProbability: 65, runnerUpProbability: 35 },
] as unknown as AnalysisSnapshot[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCanvasState: any = { analysisFreshness: null, analysisFreshnessDirty: false, selection: { nodeIds: new Set() } }

vi.mock('../../store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCanvasStore: (selector: (s: any) => unknown) => selector(mockCanvasState),
}))
vi.mock('../../stores/analysisSnapshotStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAnalysisSnapshotStore: (selector: (s: any) => unknown) => selector({ snapshots: SNAPSHOTS }),
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
// Stub the heavy child tree; Hero echoes the derived compareState.
vi.mock('../Hero', () => ({ Hero: ({ state }: { state: string }) => <div data-testid="compare-state">{state}</div> }))
vi.mock('../TabHeader', () => ({ TabHeader: () => null }))
vi.mock('../RunSelector', () => ({ RunSelector: () => null }))
vi.mock('../TrajectorySection', () => ({ TrajectorySection: () => null }))
vi.mock('../TransitionsSection', () => ({ TransitionsSection: () => null }))
vi.mock('../CompareFooter', () => ({ CompareFooter: () => null }))
vi.mock('../EmptyState', () => ({ EmptyState: () => null }))

import { CompareTabBody } from '../CompareTabBody'

const stateText = () => screen.getByTestId('compare-state').textContent

beforeEach(() => {
  mockCanvasState = { analysisFreshness: null, analysisFreshnessDirty: false, selection: { nodeIds: new Set() } }
})

describe('CompareTabBody — freshness drives the stale compare state (CEE-sourced)', () => {
  it('CEE stale verdict → compareState "stale"', () => {
    mockCanvasState.analysisFreshness = { freshness: 'stale' }
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(stateText()).toBe('stale')
  })

  it('fresh verdict dirtied by a local edit (changed) → compareState "stale"', () => {
    mockCanvasState.analysisFreshness = { freshness: 'fresh' }
    mockCanvasState.analysisFreshnessDirty = true
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(stateText()).toBe('stale')
  })

  it('CEE-sourced unknown (cannot-confirm) → NOT "stale" (no fabrication)', () => {
    mockCanvasState.analysisFreshness = { freshness: 'unknown' }
    mockCanvasState.analysisFreshnessDirty = true
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(stateText()).not.toBe('stale')
  })

  it('confirmed-fresh verdict (clean) → NOT "stale"', () => {
    mockCanvasState.analysisFreshness = { freshness: 'fresh' }
    mockCanvasState.analysisFreshnessDirty = false
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(stateText()).not.toBe('stale')
  })

  it('no freshness verdict (null) → NOT "stale"', () => {
    mockCanvasState.analysisFreshness = null
    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    expect(stateText()).not.toBe('stale')
  })
})
