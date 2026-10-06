/**
 * ⭐⭐ SD-1 (domain 2, github-07; DL 0df0e1 6 Oct; a8 census `output/domain3-a8/reader-census.md` DGAI rows 1-6): ONE
 * SOURCE FOR WHICH SIDE OF ITS TARGET THE GOAL IS ON — the canonical goal node's `goal_direction` in CEE's current read.
 *
 * Served shape: CEE stamps a brief-stated CEILING (RT-10 #2585, `stated-by-user.ts`): `goal_threshold_raw: 400` +
 * `goal_direction: '<='` + `threshold_source: 'brief_extraction'`, beside the goal's own `<=` 400 row (the row is
 * the Confirm turn's served `gc-111d4aa6…`). Every display reader said it as a floor ("Success target ≥ 400", a bare
 * "400", a duplicate "≤ 400" pill) and every editor opened on "at least", so saving restated it as a floor.
 */
import { describe, it, expect } from 'vitest'
import {
  constraintRestatesGoalTarget, goalCardShownLimits, goalTargetBound, goalTargetComparator, goalTargetEditDirection,
  heldTargetBoundWords, resolveGoalTargetWithOwnRow,
} from '../goalOwnTargetRow'
import { savedMeasureGlyph, selectSuccessTargetGlyph, successLineGlyph } from '../../../components/results/decision-overview/DecisionOverviewCard'

const GOAL = 'monthly_cancellations'
const UNIT = 'cancellations/month'
const STAMPED_CEILING = {
  kind: 'goal', label: 'Monthly cancellations', goal_threshold_raw: 400, goal_threshold_unit: UNIT,
  goal_direction: '<=', threshold_source: 'brief_extraction',
}
const OWN_ROW = {
  constraint_id: 'gc-111d4aa6-6f70-4de4-a1af-4a8cdb35723a', node_id: GOAL, operator: '<=', value: 400,
  label: 'monthly cancellations', unit: UNIT, provenance: 'explicit', value_frame: 'level',
}
const FLOOR = { ...STAMPED_CEILING, goal_direction: '>=' }
const UNHELD = { ...STAMPED_CEILING, goal_direction: undefined }
const goalNode = (data: Record<string, unknown>) => ({ id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data })

describe('display: a goal that HOLDS a ceiling says "at most" wherever its target is said', () => {
  it('⭐ the resolved target carries the bound from the node itself (Model tab row, target line)', () => {
    const t = resolveGoalTargetWithOwnRow(STAMPED_CEILING as never, [OWN_ROW] as never, GOAL)
    expect(t?.raw).toBe(400)
    expect(goalTargetBound(t)).toBe('at most')
    expect(heldTargetBoundWords(STAMPED_CEILING as never)).toBe('at most')
    expect(heldTargetBoundWords({ ...STAMPED_CEILING, goal_direction: '<' } as never)).toBe('less than')
  })
  it.each([
    ['a held floor (a bare figure already reads as one)', FLOOR],
    ['no held side', UNHELD],
    ['a change frame (its own words)', { ...STAMPED_CEILING, goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.2 }],
  ])('CONTRAST, %s: no bound', (_n, data) => {
    expect(heldTargetBoundWords(data as never)).toBeNull()
    expect(goalTargetBound(resolveGoalTargetWithOwnRow(data as never, [], GOAL))).toBeNull()
  })
  it('the overview glyph is the held side: ≤ for a ceiling, ≥ for a floor, nothing when nothing is held', () => {
    expect(selectSuccessTargetGlyph({ nodes: [goalNode(STAMPED_CEILING)] } as never)).toBe('≤')
    expect(selectSuccessTargetGlyph({ nodes: [goalNode(FLOOR)] } as never)).toBe('≥')
    expect(selectSuccessTargetGlyph({ nodes: [goalNode(UNHELD)] } as never)).toBeNull()
    expect(successLineGlyph(null, null)).toBe('≥')
  })
  it('r1 item 1: the canonical goal WINS over a browser-saved measure; the saved one speaks only when nothing is held', () => {
    expect(successLineGlyph('≥', 'keep_below')).toBe('≥')
    expect(successLineGlyph('≤', 'increase_by_at_least')).toBe('≤')
    expect(successLineGlyph(null, 'keep_below')).toBe('≤')
  })
  it('a SAVED "keep below" measure says ≤ (it compared against a literal no measure holds); CONTRAST: floors say ≥', () => {
    expect(savedMeasureGlyph('keep_below')).toBe('≤')
    expect(savedMeasureGlyph('increase_by_at_least')).toBe('≥')
    expect(savedMeasureGlyph('reach_at_least')).toBe('≥')
  })
})

describe('limits: the ceiling row that restates the held target is not a second limit', () => {
  it('⭐ the goal\'s own "≤ 400" row restates a held "at most 400": no duplicate pill', () => {
    expect(constraintRestatesGoalTarget(OWN_ROW as never, GOAL, { raw: 400, unit: UNIT, comparator: '<=' })).toBe(true)
    expect(goalCardShownLimits([OWN_ROW] as never, GOAL, STAMPED_CEILING as never, false)).toEqual([])
  })
  it('CONTRAST: the same row beside a held FLOOR at 400 is a real limit and stays', () => {
    expect(constraintRestatesGoalTarget(OWN_ROW as never, GOAL, { raw: 400, unit: UNIT, comparator: '>=' })).toBe(false)
    expect(goalCardShownLimits([OWN_ROW] as never, GOAL, FLOOR as never, false)).toEqual([OWN_ROW])
  })
  it('UNCHANGED: a ">= 400" row restates an unheld target, as before', () => {
    expect(constraintRestatesGoalTarget({ ...OWN_ROW, operator: '>=' } as never, GOAL, { raw: 400, unit: UNIT })).toBe(true)
  })
  it('r1 item 2: a DEADLINE row at the target\'s own figure and unit is a time limit, never the target restated', () => {
    const deadlineAtTarget = { ...OWN_ROW, deadline_metadata: { as_stated: 'within 9 months' } }
    expect(constraintRestatesGoalTarget(deadlineAtTarget as never, GOAL, { raw: 400, unit: UNIT, comparator: '<=' })).toBe(false)
  })
  it('r1 item 2: a stricter "< 400" row beside an inclusive held "at most 400" is a different limit and stays', () => {
    const strict = { ...OWN_ROW, operator_as_stated: '<' }
    expect(constraintRestatesGoalTarget(strict as never, GOAL, { raw: 400, unit: UNIT, comparator: '<=' })).toBe(false)
    expect(constraintRestatesGoalTarget(strict as never, GOAL, { raw: 400, unit: UNIT, comparator: '<' })).toBe(true)
  })
  it('CONTRAST: a deadline row on the ceiling goal is a limit, not the target', () => {
    const deadline = { ...OWN_ROW, constraint_id: 'gc-deadline', value: 9, unit: 'months', deadline_metadata: { as_stated: 'within 9 months' } }
    expect(goalCardShownLimits([OWN_ROW, deadline] as never, GOAL, STAMPED_CEILING as never, false)).toEqual([deadline])
  })
})

describe('editors: open on the side the goal holds, so saving never flips a ceiling to a floor', () => {
  it.each([
    ['stamped ceiling', STAMPED_CEILING, [OWN_ROW], '<=', 'at_most'],
    ['card ceiling (no node target, its own "≤" row)', { kind: 'goal', label: 'x', goal_threshold_unit: UNIT, goal_direction: '<=' }, [OWN_ROW], '<=', 'at_most'],
    ['strict ceiling', { ...STAMPED_CEILING, goal_direction: '<' }, [], '<', 'at_most'],
    ['r1 item 3: held "<=" with no node figure beside a first own ">=" row', { kind: 'goal', label: 'x', goal_threshold_unit: UNIT, goal_direction: '<=' }, [{ ...OWN_ROW, operator: '>=' }], '<=', 'at_most'],
    ['CONTRAST: floor', FLOOR, [], '>=', 'at_least'],
    ['CONTRAST: nothing held', UNHELD, [], null, 'at_least'],
  ])('%s', (_n, data, rows, comparator, direction) => {
    const held = goalTargetComparator(data as never, rows as never, GOAL)
    expect(held).toBe(comparator)
    expect(goalTargetEditDirection(held)).toBe(direction)
  })
})
