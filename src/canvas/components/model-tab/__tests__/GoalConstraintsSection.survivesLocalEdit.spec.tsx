/**
 * A6 — a local factor-value edit (0.8→0.7, no network) must not remove the
 * goal limit from the Model tab's "Constraints" section.
 *
 * ROOT CAUSE: `ModelTabBody.tsx` passes the store's PRE-analysis
 * `goalConstraints` slice as this component's `constraints` prop.
 * `invalidateAnalysisReady` clears that slice (via `READINESS_CLEAR_FIELDS`)
 * on every edit that invalidates readiness — including a bare factor-value
 * edit with no network call — while `results.report.goal_constraints` (the
 * last completed run's own carried data) is untouched by that same clear.
 * `useNodeConstraints` (the per-node badge hook) already falls back to that
 * report field for the identical reason; this section did not.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { useCanvasStore } from '../../../store'
import {
  GoalConstraintsSection,
  GOAL_CONSTRAINTS_SECTION_TESTID,
  type DisplayGoalConstraint,
} from '../GoalConstraintsSection'

const NODES = [{ id: 'goal_nrr', data: { kind: 'goal', label: 'NRR goal' } }]

const CONSTRAINT: DisplayGoalConstraint = {
  constraint_id: 'c1',
  node_id: 'goal_nrr',
  label: 'NRR goal',
  operator: '>=',
  value: 1.1,
}

beforeEach(() => {
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
})

afterEach(cleanup)

describe('GoalConstraintsSection — A6 survives a local edit that nulls the pre-analysis slice', () => {
  it('POSITIVE CONTROL: renders from the `constraints` prop when supplied', () => {
    render(<GoalConstraintsSection constraints={[CONSTRAINT]} nodes={NODES} />)
    expect(screen.getByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)).toBeInTheDocument()
  })

  it('POSITIVE CONTROL: renders nothing when the prop is empty AND the report carries none either', () => {
    render(<GoalConstraintsSection constraints={null} nodes={NODES} />)
    expect(screen.queryByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)).toBeNull()
  })

  it('RED/A6: the prop is null (post-edit, readiness cleared) but a completed run\'s report still carries the constraint — the section must still render', () => {
    // The exact reproduction: a completed run recorded the constraint, then a
    // local factor-value edit invalidated readiness and nulled the
    // PRE-analysis slice `ModelTabBody` reads into `constraints`. Nothing
    // about the completed run's own report changed.
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report: { goal_constraints: [CONSTRAINT] } },
    } as never)
    render(<GoalConstraintsSection constraints={null} nodes={NODES} />)
    expect(screen.getByTestId(GOAL_CONSTRAINTS_SECTION_TESTID)).toBeInTheDocument()
    expect(screen.getByText(/NRR goal/)).toBeInTheDocument()
  })

  it('a non-empty prop is never second-guessed by the report fallback', () => {
    const propOnly: DisplayGoalConstraint = { ...CONSTRAINT, constraint_id: 'c-prop', label: 'Prop constraint' }
    const reportOnly: DisplayGoalConstraint = { ...CONSTRAINT, constraint_id: 'c-report', label: 'Report constraint' }
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report: { goal_constraints: [reportOnly] } },
    } as never)
    render(<GoalConstraintsSection constraints={[propOnly]} nodes={NODES} />)
    expect(screen.getByText(/Prop constraint/)).toBeInTheDocument()
    expect(screen.queryByText(/Report constraint/)).toBeNull()
  })
})
