/**
 * Recovery Batch C (UI) item 4 on the Model tab: the "Limits" list never lists one of the goal's TARGETS (C CEE
 * `role: 'goal_target'`; Paul's marketing "at least 20 new customers AND a conversion rate above 15%"). The goal's OTHER
 * targets are listed under "Targets" (#2747 r1: never lost from the tab); its own row restates the target the outline's
 * goal row states. Bound by row identity, with the real spend limit as the control in the same render.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../store'
import { GOAL_CONSTRAINT_ROW_TESTID, GOAL_CONSTRAINTS_SECTION_TESTID, GOAL_TARGET_ROW_TESTID, GOAL_TARGETS_SECTION_TESTID, GoalConstraintsSection } from '../GoalConstraintsSection'
import { MARKETING_TARGET_ROWS } from '../../../../components/results/__tests__/helpers/batchCGoalChance'

const NODES = [
  { id: 'new_customers', data: { kind: 'goal', label: 'New customers' } },
  { id: 'conversion_rate', data: { kind: 'factor', label: 'Conversion rate' } },
  { id: 'annual_spend', data: { kind: 'factor', label: 'Annual spend' } },
]
const SPEND_LIMIT = { constraint_id: 'limit:spend', node_id: 'annual_spend', operator: '<=', value: 100000, unit: 'GBP', value_frame: 'level', provenance: 'explicit' }

beforeEach(() => { useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never) })
afterEach(cleanup)

describe('Model tab "Limits": the goal\'s targets are not listed as limits', () => {
  it('lists the spend limit and neither target row; the other target is under "Targets"', () => {
    render(<GoalConstraintsSection constraints={[...MARKETING_TARGET_ROWS, SPEND_LIMIT] as never} nodes={NODES} />)
    expect(screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('limit:spend'))).toHaveTextContent('Annual spend ≤ £100,000')
    expect(screen.queryByTestId(GOAL_CONSTRAINT_ROW_TESTID('target:new_customers'))).toBeNull()
    expect(screen.queryByTestId(GOAL_CONSTRAINT_ROW_TESTID('target:conversion_rate'))).toBeNull()
    expect(screen.getByTestId(GOAL_TARGET_ROW_TESTID('target:conversion_rate'))).toHaveTextContent('Target: Conversion rate above 15%')
    // The goal's own row restates the target the outline's goal row states.
    expect(screen.queryByTestId(GOAL_TARGET_ROW_TESTID('target:new_customers'))).toBeNull()
  })

  it('the same holds for the completed Run\'s carried rows (the fallback after a local edit)', () => {
    useCanvasStore.setState({ results: { status: 'complete', progress: 100, report: { goal_constraints: [...MARKETING_TARGET_ROWS, SPEND_LIMIT] } } } as never)
    render(<GoalConstraintsSection constraints={null} nodes={NODES} />)
    expect(screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('limit:spend'))).toBeInTheDocument()
    expect(screen.queryByTestId(GOAL_CONSTRAINT_ROW_TESTID('target:conversion_rate'))).toBeNull()
  })

  it('targets only: no "Limits" section, the other target still listed (CONTROL: without the role they are limits)', () => {
    render(<GoalConstraintsSection constraints={MARKETING_TARGET_ROWS as never} nodes={NODES} />)
    expect(screen.queryByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)).toBeNull()
    expect(screen.getByTestId(GOAL_TARGETS_SECTION_TESTID)).toHaveTextContent('Targets')
    expect(screen.getByTestId(GOAL_TARGET_ROW_TESTID('target:conversion_rate'))).toBeInTheDocument()
    cleanup()
    render(<GoalConstraintsSection constraints={MARKETING_TARGET_ROWS.map(({ role: _r, ...row }) => row) as never} nodes={NODES} />)
    expect(screen.getByTestId(GOAL_CONSTRAINT_ROW_TESTID('target:conversion_rate'))).toBeInTheDocument()
  })
})
