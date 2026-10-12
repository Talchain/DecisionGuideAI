import { withCanonicalTestCells } from './helpers/canonicalTestCells'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'
import { withGoalOptionCoverage } from '../goalOptionCoverage'
import type { HeroChartModel } from '../heroTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const TARGET = { comparator: 'at_least', value: 100, unit: '% of the feature launch', by_date: '2027-04-07' }
const LABELS: Record<string, string> = { a: 'Team A', b: 'Team B' }
const labels = (id: string) => LABELS[id] ?? null
const ENTRY = {
  kind: 'stated_time', basis: 'stated_time', quantity: 'months_to_finish',
  low: 0.23, high: 0.9, low_pct: 23, high_pct: 90,
  from: 'team_part', to: 'goal', among: 'all', stated_estimate: { low: 3, high: 6, unit: 'months' },
}
const range = (entry = ENTRY, warnings: Record<string, unknown>[] = []) => readGoalChanceRange([{
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: ['a'],
  target: TARGET, range_by_option: { a: entry },
}, ...warnings])
const line = (estimate: string, bounds = '23% and 90%') =>
  `‘Team A’: between ${bounds} chance of launching by 7 April 2027, in this model, from the slow end of your ${estimate} to the fast end.`

// #2747 re-scope 2 (U2): the range line says CEE's served face verbatim and composes nothing; this is a stated-time face as
// CEE serves it (SELF-AUTHORED here, in CEE's words), so the rows below pin that the line says it, whole.
const SERVED_FACE = line('3–6 months')
const faceOfA = (id: string) => (id === 'a' ? SERVED_FACE : null)

afterEach(cleanup)

describe('share-by-date chance: the same words as CEE chat', () => {
  // #2747 re-scope 2 (U0): the decision matrix is removed in C, so its cell and "Goal:" line are no longer pinned here.
  // #2747 re-scope 2 round 2: row deleted — "point line binds the deliverable verbatim". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  // #2747 re-scope 2 round 2: row deleted — "removes only the leading share marker". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  // #2747 re-scope 2 round 2: row deleted — "point extremes retain less than 1%". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  it('a stated-time range line says CEE\'s served face whole, with no link action and no link-dependence words', () => {
    render(<GoalChanceRangeLines range={range()} faceOf={faceOfA} />)
    expect(screen.getByTestId('goal-chance-range-line').textContent).toBe(SERVED_FACE)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByTestId('goal-chance-range-lines').textContent).not.toContain('It depends most on')
  })

  it('a range CEE served no face for says nothing (the bounds are never worded here)', () => {
    render(<GoalChanceRangeLines range={range()} faceOf={() => null} />)
    expect(screen.queryByTestId('goal-chance-range-line')).toBeNull()
  })

  it('hero coverage recognises the stated-time figure without treating its endpoints as links', () => {
    const model = { lenses: ['goal'], rows: ['a', 'b'].map(id => ({ id, label: labels(id), goal: { value: null } })) } as unknown as HeroChartModel
    const data = { goalChanceRange: range(), goalChanceDriverNames: { labelOf: labels }, recommendation: { goalThreshold: 100, allOptions: ['a', 'b'].map(id => ({ id, label: labels(id) })) } } as unknown as ResultsSectionDataReturn
    expect(withGoalOptionCoverage(model, withCanonicalTestCells(data, null, { a: SERVED_FACE })).goalOptionCoverage).toEqual({
      hasFigures: true, withheldLines: [{ id: 'b', line: '‘Team B’: not shown yet in this model.' }],
    })
  })

  // #2747 re-scope 2 (U2): the range's extreme words (less than 1% / more than 99%) are CEE's, in its served face.

  // #2747 re-scope 2 round 2: row deleted — "headline target words change only the parentheses". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  // #2747 re-scope 2 round 2: row deleted — "%s twin: point lines and headline remain byte-identical with or without by_date". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  // #2747 re-scope 2 round 2: row deleted — "malformed date stays absent". Its only subject was the UI's own share-by-date chance words (goalChanceOptionLines / goalChanceTargetWords), deleted: the UI composes no chance sentence (rule C) and says the licence target in no words of its own (D).

  it('share approximation permits the range; an unrelated option withhold bars it', () => {
    const compatible = range(ENTRY, [{ code: 'GOAL_FIGURES_SHARE_APPROXIMATION', option_ids: ['a'] }])
    render(<GoalChanceRangeLines range={compatible} faceOf={faceOfA} />)
    expect(screen.getByTestId('goal-chance-range-line').textContent).toBe(SERVED_FACE)
    cleanup()
    const barred = range(ENTRY, [{ code: 'GOAL_FIGURES_PRODUCT_NOT_READ', option_ids: ['a'] }])
    expect(barred).toBeNull()
    render(<GoalChanceRangeLines range={barred} faceOf={faceOfA} />)
    expect(screen.queryByTestId('goal-chance-range-line')).toBeNull()
  })
})
