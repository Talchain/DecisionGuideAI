/**
 * ⭐ T12 row 2 on the goal CARD (MG F1 spec §1; schemas 0.69.0): the period and horizon, as stated, muted on the
 * resting row; absent says nothing; the unit string is never read for a period.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null, goalConstraints: [], nodes: [], edges: [],
  ceeAnalysisReady: null, viewMode: 'expert',
})
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

function renderGoal(id: string, data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode id={id} type="goal" data={{ type: 'goal', ...data } as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </ReactFlowProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

describe('T12 row 2 — the goal card shows its period and horizon', () => {
  it('⭐ "per quarter · within 6 months" sits on the resting row', () => {
    const { container } = renderGoal('g1', { label: 'Grow ARR', goal_period: 'quarter', goal_horizon: { months: 6 } })
    const line = container.querySelector('[data-testid="goal-period-horizon-g1"]')
    expect(line?.textContent).toBe('per quarter · within 6 months')
    expect(container.querySelector('[data-testid="goal-node-resting-state"]')!.contains(line)).toBe(true)
  })

  it('CONTROL: no period or horizon → no line, even with a per-month unit on the target', () => {
    const { container } = renderGoal('g2', { label: 'Grow ARR', success_threshold: 12, threshold_source: 'user', goal_threshold_unit: 'GBP per month' })
    expect(container.querySelector('[data-testid="goal-period-horizon-g2"]')).toBeNull()
    expect(container.querySelector('[data-testid="goal-node-resting-state"]')).not.toBeNull()
  })
})
