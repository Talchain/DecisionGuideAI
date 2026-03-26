/**
 * OutcomeNode render tests
 * T9: Bridge edge data — contribution % + qualitative direction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'outcome-1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOutcome = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} data={{ label: 'Revenue growth', type: 'outcome', ...data }} />
    </ReactFlowProvider>
  )

describe('OutcomeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    })
  })

  it('renders label', () => {
    renderOutcome()
    expect(screen.getByText('Revenue growth')).toBeDefined()
  })

  it('shows type label as "Outcome" (sentence-case)', () => {
    renderOutcome()
    expect(screen.getByText('Outcome')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OutcomeNode.displayName).toBe('OutcomeNode')
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows bridge edge impact on goal in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            data: { weight: 0.75, direction: 'positive', beliefExists: null },
          },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.getByText('75% contribution to goal')).toBeDefined()
    expect(screen.getByText(/Very strong/)).toBeDefined()
  })

  it('does not show certainty even when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 },
          },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no matching edge found', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          // edge goes the wrong way
          { id: 'e1', source: 'goal-1', target: 'outcome-1', data: {} },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } }],
        edges: [],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows achievement probability when available', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.68,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderOutcome()
    expect(screen.getByText('68% chance')).toBeDefined()
  })
})
