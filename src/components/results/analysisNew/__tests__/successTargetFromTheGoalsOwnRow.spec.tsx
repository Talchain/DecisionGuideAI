/**
 * The Analysis tab's success-target line says "at most 400" when that is the target (red team #87 6003539060): CEE
 * stores it ONLY as the goal's own `<=` limit row, and this line read the node alone. Harness and store mock:
 * `successTargetLine.spec.tsx`. Row shape: the red team's Confirm turn, verbatim (`wire/bpw1-edit.resp.txt`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let state: Record<string, unknown> = {}
vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ goalTargetDispatchAvailable: false, captureScenarioId: () => 'scenario-1', proposeGoalTarget: vi.fn() }),
}))

import { SuccessTargetLine } from '../sections/SuccessTargetLine'

const GOAL_ID = 'monthly_cancellations'
const SERVED_ROW = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL_ID, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: 'cancellations/month', provenance: 'explicit', value_frame: 'level',
}
const TID = 'target'

beforeEach(() => {
  state = {
    nodes: [{ id: GOAL_ID, type: 'goal', data: { label: 'monthly cancellations', kind: 'goal', goal_direction: '<=', goal_threshold_unit: 'cancellations/month', goal_threshold_frame: 'level' } }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    goalConstraints: null,
    results: { status: 'idle', report: null },
    setGoalThresholdAndUpdateNode: vi.fn(),
  }
})
afterEach(cleanup)

const draw = () => render(<SuccessTargetLine goalNodeId={GOAL_ID} onCommitOutcome={vi.fn()} testId={TID} />)

describe('the success-target line reads the goal\'s own limit row', () => {
  it('PRECONDITION (the served defect): with the node alone, it asks for a target', () => {
    draw()
    expect(screen.queryByTestId(`${TID}-value`)).toBeNull()
    expect(screen.getByTestId(`${TID}-none`)).toBeInTheDocument()
  })
  it('⭐ the graph\'s row: "at most 400 cancellations/month"', () => {
    state.goalConstraints = [SERVED_ROW]
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('at most 400 cancellations/month')
  })
  it('⭐ after a Run with the graph slice cleared: the run\'s rows say it', () => {
    state.results = { status: 'complete', report: { goal_constraints: [SERVED_ROW] } }
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('at most 400 cancellations/month')
  })
  it('CONTROL — another node\'s limit: still asks', () => {
    state.goalConstraints = [{ ...SERVED_ROW, node_id: 'pause_instead_of_cancel_availability' }]
    draw()
    expect(screen.queryByTestId(`${TID}-value`)).toBeNull()
  })
})
