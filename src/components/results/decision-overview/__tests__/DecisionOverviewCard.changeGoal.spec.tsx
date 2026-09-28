/**
 * ⭐ R1 S4-core (MG 5879952291): the brief bar's Goal chip and the hero selector say a target stated as a CHANGE from
 * today as the change — "Success target: down 15% from today" — never "≥ -0.15 GBP/month". The node is CEE's
 * `admitStatedGoalChange` shape (`mg/r1-s4-goal-frame` @ `1fbf0c6c`): frame, raw r, the METRIC's unit.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { computeSuccessState } from '../../../../canvas/components/pre-analysis-v3/selectors/computeSuccessState'
import { computeGraphFacts } from '../../../../canvas/components/pre-analysis-v3/selectors/graphFacts'

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }

const goalNode = (data: Record<string, unknown>) => ({
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Cut the monthly cloud bill', ...data },
})
const CHANGE = goalNode({ goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month' })
const LEVEL = goalNode({ goal_threshold_raw: 38000, goal_threshold_unit: 'GBP' })

function resetCanvas(overrides: Record<string, unknown> = {}) {
  localStorage.setItem('feature.decisionOverview', '1')
  useCanvasStore.setState({
    ceeAnalysisReady: null, goalThreshold: null, nodes: [], goalConstraints: null,
    currentBriefText: null, graphHealth: null, ...overrides,
  } as never)
}

function goalChipText(): string {
  const bar = screen.getByTestId('brief-bar')
  if (bar.getAttribute('aria-expanded') === 'false') fireEvent.click(bar)
  return screen.getByTestId('brief-dim-goal').textContent ?? ''
}

describe('a change goal on the hero selector and the brief bar', () => {
  beforeEach(() => resetCanvas())

  it('RED: computeSuccessState says the change', () => {
    const success = computeSuccessState(computeGraphFacts([CHANGE] as never).goalNode, READY as never, null, null)
    expect(success.isSet).toBe(true)
    expect(success.displayText).toBe('down 15% from today')
  })

  it('RED: the Goal chip reads "down 15% from today" with no "≥" and no fraction', () => {
    resetCanvas({ ceeAnalysisReady: READY, nodes: [CHANGE] })
    render(<DecisionOverviewCard title="t" />)
    const text = goalChipText()
    expect(text).toContain('down 15% from today')
    expect(text).not.toMatch(/≥|0\.15|GBP/)
  })

  it('⛔ CONTRAST: a level target keeps its "≥" and its figure', () => {
    resetCanvas({ ceeAnalysisReady: READY, nodes: [LEVEL] })
    render(<DecisionOverviewCard title="t" />)
    const text = goalChipText()
    expect(text).toContain('38,000')
    expect(text).not.toContain('from today')
  })
})
