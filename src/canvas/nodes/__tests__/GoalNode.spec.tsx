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
  lens: { _dimmedNodeIds: new Set() },
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
    // Displays "≥ £500k" (no "Target:" prefix, no "modelled range")
    expect(screen.getByText(/≥/)).toBeDefined()
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
    // No ≥ sign, shows coaching prompt instead
    expect(screen.queryByText(/≥/)).toBeNull()
    expect(screen.getByText(/Set a success target/)).toBeDefined()
  })

  it('shows threshold without unit when goal_threshold_unit is absent', () => {
    renderGoal({ goal_threshold_raw: '200k' })
    expect(screen.getByText(/≥/)).toBeDefined()
    expect(screen.getByText(/200k/)).toBeDefined()
  })

  // Task 2: Non-currency units must suffix, not prefix
  it('formats non-currency unit as suffix: "≥ 200 customers"', () => {
    renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: 'customers' })
    const el = screen.getByText(/≥/)
    expect(el.textContent).toContain('200')
    expect(el.textContent).toContain('customers')
    // Ensure it's "200 customers" not "customers200"
    expect(el.textContent).toMatch(/200\s+customers/)
  })

  it('formats currency unit as prefix: "≥ £200"', () => {
    renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: '£' })
    const el = screen.getByText(/≥/)
    // "£200" prefix style (no space between symbol and number)
    expect(el.textContent).toContain('£')
    expect(el.textContent).toContain('200')
    // Must not be "200 £"
    expect(el.textContent).not.toMatch(/200\s+£/)
  })

  it('shows threshold when goal_threshold_raw is numeric 0 (falsy)', () => {
    renderGoal({ goal_threshold_raw: 0 })
    expect(screen.getByText(/≥/)).toBeDefined()
  })

  // P1.4: null and empty string must NOT display threshold — show coaching prompt instead
  it('shows coaching prompt when goal_threshold_raw is null', () => {
    renderGoal({ goal_threshold_raw: null })
    expect(screen.queryByText(/≥/)).toBeNull()
    expect(screen.getByText(/Set a success target/)).toBeDefined()
  })

  it('shows coaching prompt when goal_threshold_raw is empty string', () => {
    renderGoal({ goal_threshold_raw: '' })
    expect(screen.queryByText(/≥/)).toBeNull()
    expect(screen.getByText(/Set a success target/)).toBeDefined()
  })

  it('shows coaching prompt when goal_threshold_raw is whitespace-only', () => {
    renderGoal({ goal_threshold_raw: '   ' })
    expect(screen.queryByText(/≥/)).toBeNull()
    expect(screen.getByText(/Set a success target/)).toBeDefined()
  })

  // P0.3: Provenance pill renders for brief_extraction source
  it('shows provenance pill for brief_extraction source', () => {
    renderGoal({ observedState: { source: 'brief_extraction' } })
    expect(screen.getByText('Generated from your brief')).toBeDefined()
  })

  it('does not show provenance pill for user source', () => {
    renderGoal({ observedState: { source: 'user' } })
    expect(screen.queryByText('Generated from your brief')).toBeNull()
  })

  it('does not show provenance pill when observedState is absent', () => {
    renderGoal()
    expect(screen.queryByText('Generated from your brief')).toBeNull()
  })

  it('does not show achievement probability when it is null outside results mode', () => {
    renderGoal()
    expect(screen.queryByText(/% chance/)).toBeNull()
  })

  // V5: Stability bar uses goal yellow (not info blue)
  it('stability bar uses bg-goal for moderate level', () => {
    const { container } = render(
      <ReactFlowProvider>
        <GoalNode
          {...baseProps}
          data={{ label: 'Increase revenue', type: 'goal' }}
        />
      </ReactFlowProvider>
    )
    // Set up with moderate robustness (no high/low)
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: { recommendation_stability: 0.65, level: 'moderate' },
          },
        },
      }) as any)
    )
    const { container: c2 } = render(
      <ReactFlowProvider>
        <GoalNode
          {...baseProps}
          data={{ label: 'Increase revenue', type: 'goal' }}
        />
      </ReactFlowProvider>
    )
    // The filled bar div should have bg-goal class
    const filledBar = c2.querySelector('.bg-goal')
    expect(filledBar).not.toBeNull()
    // Must NOT use bg-info (old colour)
    expect(c2.querySelector('.bg-info')).toBeNull()
    void container // suppress unused var
  })

  // V4: Marginal badge uses text-text-body (not text-warning) for WCAG AA contrast
  it('Marginal badge uses text-text-body class', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: { recommendation_stability: 0.45, level: 'low' },
          },
        },
      }) as any)
    )
    const { container } = renderGoal()
    const badge = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent === 'Marginal'
    )
    expect(badge).toBeDefined()
    expect(badge?.className).toContain('text-text-body')
    expect(badge?.className).not.toContain('text-warning')
  })

  // P1.3 (feedback): full goal threshold unit matrix — all specified unit permutations
  describe('goal threshold unit matrix', () => {
    it('$ currency — prefix format: "≥ $200"', () => {
      renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: '$' })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toContain('$')
      expect(el.textContent).toContain('200')
      expect(el.textContent).not.toMatch(/200\s+\$/)
    })

    it('% — percent format: "≥ 85%"', () => {
      renderGoal({ goal_threshold_raw: 85, goal_threshold_unit: '%' })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toContain('85%')
    })

    it('months — suffix format: "≥ 6 months"', () => {
      renderGoal({ goal_threshold_raw: 6, goal_threshold_unit: 'months' })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toMatch(/6\s+months/)
      expect(el.textContent).not.toContain('months6')
    })

    it('engineers — suffix format: "≥ 10 engineers"', () => {
      renderGoal({ goal_threshold_raw: 10, goal_threshold_unit: 'engineers' })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toMatch(/10\s+engineers/)
    })

    it('unitless — plain number: "≥ 500"', () => {
      renderGoal({ goal_threshold_raw: 500 })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toContain('500')
      // No stray unit text
      expect(el.textContent).not.toMatch(/500\s+\w/)
    })

    it('count unit (explicit) — plain number format', () => {
      renderGoal({ goal_threshold_raw: 100, goal_threshold_unit: 'count' })
      const el = screen.getByText(/≥/)
      expect(el.textContent).toContain('100')
      expect(el.textContent).not.toContain('count')
    })
  })
})
