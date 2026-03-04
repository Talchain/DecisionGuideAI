/**
 * GoalNode render tests
 * T10: Stability bar, Marginal badge, threshold context
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
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
  id: 'goal-1',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderGoal = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Increase revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>
  )

describe('GoalNode', () => {
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
    renderGoal()
    expect(screen.getByText('Increase revenue')).toBeDefined()
  })

  it('shows type label as "Goal" (sentence-case)', () => {
    renderGoal()
    expect(screen.getByText('Goal')).toBeDefined()
  })

  // T10: Achievement probability
  it('shows achievement probability when available', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderGoal()
    expect(screen.getByText('73% chance')).toBeDefined()
  })

  // T10: Stability bar
  it('shows stability bar with percentage from report robustness', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.82,
              level: 'high',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.getByText('Stability')).toBeDefined()
    expect(screen.getByText('82%')).toBeDefined()
  })

  // T10: Marginal badge when stability < 60%
  it('shows Marginal badge when stability < 60%', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.45,
              level: 'low',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.getByText('Marginal')).toBeDefined()
  })

  it('does not show Marginal badge when stability >= 60%', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.75,
              level: 'high',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Marginal')).toBeNull()
  })

  // T10: Threshold context
  it('shows threshold context when goal_threshold_raw is set', () => {
    renderGoal({
      goal_threshold_raw: '500k',
      goal_threshold_unit: '£',
    })
    expect(screen.getByText(/Target:/)).toBeDefined()
    expect(screen.getByText(/500k/)).toBeDefined()
  })

  it('has displayName set', () => {
    expect(GoalNode.displayName).toBe('GoalNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <GoalNode {...baseProps} data={{ type: 'goal' }} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not show stability bar when report is null', () => {
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when report has no robustness key', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when robustness has no recommendation_stability', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { robustness: { level: 'high' } },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when results status is not complete', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'loading',
          report: { robustness: { recommendation_stability: 0.8, level: 'high' } },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show threshold context when goal_threshold_raw is absent', () => {
    renderGoal()
    expect(screen.queryByText(/Target:/)).toBeNull()
  })

  it('shows threshold without unit when goal_threshold_unit is absent', () => {
    renderGoal({ goal_threshold_raw: '200k' })
    expect(screen.getByText(/Target:/)).toBeDefined()
    expect(screen.getByText(/200k/)).toBeDefined()
  })

  it('shows threshold when goal_threshold_raw is numeric 0 (falsy)', () => {
    renderGoal({ goal_threshold_raw: 0 })
    expect(screen.getByText(/Target:/)).toBeDefined()
  })

  it('does not show achievement probability when it is null outside results mode', () => {
    renderGoal()
    expect(screen.queryByText(/% chance/)).toBeNull()
  })
})
