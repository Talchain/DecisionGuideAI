/**
 * "AT MOST 400" IS A STATED TARGET (red team #87 6003539060; DL 0df0e1; RT-10 a8). The user set the goal to "at most
 * 400" in the Model panel; CEE stores that ONLY as the goal's own `<=` goal_constraints row (it never stamps
 * `goal_threshold_raw` for `<=`). Every reader of the node alone said "Not set". CEE's ONE rule
 * (`stated-goal-target.ts` `goalOwnLimitRow`, CEE staging ba4759af): with no target on the node, the goal's OWN
 * non-deadline limit row IS its target.
 *
 * The shapes are the served ones, verbatim: the goal node from CEE's rt10b fixture (`bprime-rt10b.json`
 * `graph_with_target`, the served rt10b graph) and the row from the red team's Confirm turn
 * (`red-team/github-87` `wire/bpw1-edit.resp.txt`, constraint `gc-111d4aa6…`).
 */
import { describe, expect, it } from 'vitest'
import { goalOwnLimitRow, goalTargetBound, resolveGoalTargetWithOwnRow } from '../goalOwnTargetRow'
import { toModelRows } from '../../model-tab-v2/adapters'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const GOAL_ID = 'monthly_cancellations'
/** CEE rt10b `graph_with_target` goal node (no goal_threshold_raw: never stamped for `<=`). */
const GOAL_DATA = {
  label: 'monthly cancellations', kind: 'goal', goal_direction: '<=',
  goal_threshold_unit: 'cancellations/month', goal_threshold_frame: 'level', goal_deadline_as_stated: '6 months',
}
/** The Confirm turn's row, verbatim (bpw1-edit.resp.txt). */
const SERVED_ROW: CEEGoalConstraint = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL_ID, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: 'cancellations/month', provenance: 'explicit', value_frame: 'level',
} as unknown as CEEGoalConstraint
const row = (over: Record<string, unknown>) => ({ ...SERVED_ROW, constraint_id: `gc-${Math.random()}`, ...over }) as unknown as CEEGoalConstraint

describe('CEE\'s rule: the goal\'s own non-deadline limit row is its target when the node holds none', () => {
  it('⭐ the served "at most 400" row is the target, by identity', () => {
    expect(goalOwnLimitRow([SERVED_ROW], GOAL_ID)?.constraint_id).toBe('gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a')
    const target = resolveGoalTargetWithOwnRow(GOAL_DATA, [SERVED_ROW], GOAL_ID)
    expect(target).toMatchObject({ raw: 400, unit: 'cancellations/month' })
    expect(goalTargetBound(target)).toBe('at most')
  })
  it('the comparator the row STATES ("below 400" is stored `<=` + `operator_as_stated: \'<\'`): "less than"', () => {
    expect(goalTargetBound(resolveGoalTargetWithOwnRow(GOAL_DATA, [row({ operator_as_stated: '<' })], GOAL_ID))).toBe('less than')
    expect(goalTargetBound(resolveGoalTargetWithOwnRow(GOAL_DATA, [row({ operator: '>=' })], GOAL_ID))).toBe('at least')
  })
  it('the first own row in stored order, as CEE reads it', () => {
    expect(goalOwnLimitRow([row({ node_id: 'other' }), SERVED_ROW, row({ value: 300 })], GOAL_ID)).toBe(SERVED_ROW)
  })
})

describe('CONTROLS — what does NOT count (a8)', () => {
  it('a DEADLINE row on the goal ("within 6 months") is a time limit, not the target', () => {
    expect(goalOwnLimitRow([row({ deadline_metadata: { as_stated: 'within 6 months' } })], GOAL_ID)).toBeNull()
  })
  it('another node\'s limit is never the goal\'s target', () => {
    expect(goalOwnLimitRow([row({ node_id: 'pause_instead_of_cancel_availability' })], GOAL_ID)).toBeNull()
  })
  it('a row with no finite figure', () => {
    expect(goalOwnLimitRow([row({ value: Number.NaN })], GOAL_ID)).toBeNull()
  })
  it('no rows, or no goal id: nothing', () => {
    expect(resolveGoalTargetWithOwnRow(GOAL_DATA, null, GOAL_ID)).toBeNull()
    expect(resolveGoalTargetWithOwnRow(GOAL_DATA, [SERVED_ROW], null)).toBeNull()
  })
  // SD-1 #2544 (DL 0df0e1, 6 Oct: every reader says the side the goal node HOLDS): moved from "carries no bound". The
  // node's own target still wins over the row; it now says the node's own `goal_direction`, and a node holding no
  // side still says none.
  it('the node\'s own target wins, and says the side the node holds, never the row\'s', () => {
    const target = resolveGoalTargetWithOwnRow({ ...GOAL_DATA, goal_threshold_raw: 500 }, [SERVED_ROW], GOAL_ID)
    expect(target).toMatchObject({ raw: 500 })
    expect(goalTargetBound(target)).toBe('at most')
    const { goal_direction: _held, ...unheld } = GOAL_DATA
    const unheldTarget = resolveGoalTargetWithOwnRow({ ...unheld, goal_threshold_raw: 500 }, [SERVED_ROW], GOAL_ID)
    expect(unheldTarget).toMatchObject({ raw: 500 })
    expect(goalTargetBound(unheldTarget)).toBeNull()
  })
  it('a node frame this UI cannot read: no target, even with a row (fail-closed, unchanged)', () => {
    expect(resolveGoalTargetWithOwnRow({ ...GOAL_DATA, goal_threshold_frame: 'ratio_of_something' }, [SERVED_ROW], GOAL_ID)).toBeNull()
  })
})

describe('the Model tab\'s goal row says it', () => {
  const nodes = [{ id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: GOAL_DATA }] as never
  const goalRow = (goalConstraints: CEEGoalConstraint[] | null) =>
    toModelRows({ nodes, edges: [], goalThreshold: null, goalConstraints }).find((r) => r.id === GOAL_ID)
  it('PRECONDITION (the served defect): with the node alone, the row has no value ("Not set")', () => {
    expect(goalRow(null)?.primaryValue).toBeNull()
    expect(goalRow(null)?.attention).toContain('no-value')
  })
  it('⭐ with the served row: "at most 400 cancellations/month", and no missing-value attention', () => {
    expect(goalRow([SERVED_ROW])?.primaryValue).toBe('at most 400 cancellations/month')
    expect(goalRow([SERVED_ROW])?.attention).toEqual([])
  })
  it('CONTROL — only a deadline row on the goal: still "Not set"', () => {
    expect(goalRow([row({ deadline_metadata: { as_stated: 'within 6 months' } })])?.primaryValue).toBeNull()
  })
})
