/**
 * ⛔ R1 S4-core (CEE #2261): the Goal panel offers NO number input for a limit stated as a change from today.
 *
 * The input writes the typed figure into `value` in the row's own frame. On a `change_rel` row that frame is a
 * FRACTION of today's level: a reader typing "15" for "15% above today" would store 15 — a 1,500% rise. CEE's own
 * edit door refuses the same write by name (`limit-edit.ts`, `limit_is_a_change`) "until a change is edited as a
 * change", so the panel says the limit and points to the chat instead, and a level row keeps its input (contrast).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'

const GOAL_ID = 'goal_cloud'
const COST_ID = 'fac_cost'

const nodes = [
  { id: COST_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total monthly cloud cost', kind: 'factor' } },
  { id: GOAL_ID, type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Cut the cloud bill', kind: 'goal' } },
]

// CEE #2261 S4L fixture shape, verbatim, beside a level limit on the same factor (the contrast row).
const changeRow = { constraint_id: 'c1', node_id: COST_ID, operator: '<=', value: 0.1, value_frame: 'change_rel' }
const levelRow = { constraint_id: 'c2', node_id: COST_ID, operator: '<=', value: 60000, unit: 'GBP' }

function seed() {
  useCanvasStore.setState(
    {
      ...useCanvasStore.getState(),
      nodes,
      edges: [{ id: 'e1', source: COST_ID, target: GOAL_ID, data: { weight: 0.5, direction: 'negative' } }],
      goalConstraints: [changeRow, levelRow],
      goalThreshold: 0.6,
      results: { status: 'idle', report: null },
    } as never,
    true,
  )
}

describe('a change-framed limit in the Goal panel', () => {
  beforeEach(seed)

  it('RED: says the change, with no value input and a pointer to the chat', () => {
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByText('Total monthly cloud cost no more than 10% above today')).toBeTruthy()
    expect(screen.queryByTestId('goal-constraint-c1-value-input'), 'a change row must not offer the level input').toBeNull()
    expect(screen.getByTestId('goal-constraint-c1-change-note').textContent)
      .toBe('Set as a change from today. To change it, ask in the chat.')
  })

  it('⛔ CONTRAST: the level row on the same panel keeps its input and gets no note', () => {
    render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect((screen.getByTestId('goal-constraint-c2-value-input') as HTMLInputElement).value).toBe('60000')
    expect(screen.queryByTestId('goal-constraint-c2-change-note')).toBeNull()
  })
})
