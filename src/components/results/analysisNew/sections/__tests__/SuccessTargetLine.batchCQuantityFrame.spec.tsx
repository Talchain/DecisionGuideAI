/**
 * #2747 Codex round 2 (BLOCKING, reproduced): React rendered "Success: 10" for a `change_abs` 10% target, for
 * `quantity_frame: 'level'` and `'change'` alike. `SuccessTargetLine` called `formatGoalTarget` without the goal's quantity
 * frame; the formatter (rightly) returned null, and the line printed the bare stored number.
 *
 * The one rule for target text (re-scope (b)): the quantity frame is passed, so the line says the target in its own frame
 * (capacity, a level: percentage points; hiring, a change: % of today), and a target that cannot be said is never a bare
 * number. Bound to the mounted line's own text by its test id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let state: Record<string, unknown> = {}
vi.mock('../../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})
vi.mock('../../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: false,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget: vi.fn(() => 'dispatched' as const),
  }),
}))

import { SuccessTargetLine } from '../SuccessTargetLine'

const TID = 'target'
/** CHECK-C-ui-r2's reproduction: a 10% change_abs target, the quantity frame the only difference. */
const GOAL = { goal_threshold_frame: 'change_abs', goal_threshold_raw: 10, goal_threshold_unit: '%', goal_direction: '>=' }
const lineText = (data: Record<string, unknown>, store: { goalThreshold?: number | null; goalThresholdRepresentation?: string | null } = {}): string => {
  state = { nodes: [{ id: 'g1', type: 'goal', data }], goalThreshold: store.goalThreshold ?? null,
    goalThresholdRepresentation: store.goalThresholdRepresentation ?? null, setGoalThresholdAndUpdateNode: vi.fn() }
  render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={() => {}} testId={TID} />)
  return screen.getByTestId(TID).textContent ?? ''
}
/** "10" with nothing after it that says what it is: the defect. */
const BARE_TEN = /(^|[^\d.])10(?![\d.]|%|\s*percentage point)/

beforeEach(() => { state = {} })
afterEach(() => cleanup())

describe('#2747 r2: the Success line says the target in its quantity frame, never a bare number', () => {
  it('capacity (level): "up 10 percentage points from today", never "Success: 10"', () => {
    const text = lineText({ ...GOAL, label: 'Capacity', quantity_frame: 'level' })
    expect(text).toContain('up 10 percentage points from today')
    expect(text).not.toMatch(BARE_TEN)
  })

  it('hiring (change): "up 10% from today", never "Success: 10"', () => {
    const text = lineText({ ...GOAL, label: 'Productivity', quantity_frame: 'change' })
    expect(text).toContain('up 10% from today')
    expect(text).not.toMatch(BARE_TEN)
  })

  it('no quantity frame: no size is said ("10%" and "10 points" are both guesses), and never the bare 10', () => {
    const text = lineText({ ...GOAL, label: 'Capacity' })
    expect(text).not.toMatch(/10%|percentage point/)
    expect(text).not.toMatch(BARE_TEN)
  })
})

describe('#2747 r2 (BLOCKING 6): the store\'s scalar alone is never said as the target', () => {
  it('the checker\'s reproduction: goalThreshold 10 (raw) with no target on the goal node is not "Success: 10"', () => {
    const text = lineText({ label: 'Capacity', goal_direction: '>=' }, { goalThreshold: 10, goalThresholdRepresentation: 'raw' })
    expect(text).not.toMatch(BARE_TEN)
    expect(text).toContain('Target not captured')
  })
  it('CONTROL: the same scalar with the node\'s own level target says the node\'s target', () => {
    const text = lineText({ label: 'Capacity', goal_threshold_raw: 10, goal_threshold_unit: '%', goal_direction: '>=', quantity_frame: 'level' },
      { goalThreshold: 10, goalThresholdRepresentation: 'raw' })
    expect(text).toMatch(/10%/)
  })
})

