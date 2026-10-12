import { withCanonicalTestCells } from './helpers/canonicalTestCells'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { goalChanceHeadline, goalChanceOptionLines, goalChanceTargetWords } from '../goalChanceCopy'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'
import { withGoalOptionCoverage } from '../goalOptionCoverage'
import type { HeroChartModel } from '../heroTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { gateWordsOf } from './helpers/gateWords'

const TARGET = { comparator: 'at_least', value: 100, unit: '% of the feature launch', by_date: '2027-04-07' }
const LABELS: Record<string, string> = { a: 'Team A', b: 'Team B' }
const labels = (id: string) => LABELS[id] ?? null
const licence = (target = TARGET, pct = { a: 62, b: 41 }) => readGoalChanceLicence([{
  code: 'GOAL_CHANCE_LICENSED', form: 'each', option_ids: ['a', 'b'], pct_by_option: pct, target,
}])!
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
  it('point line binds the deliverable verbatim, British date and model-relative chance', () => {
    const read = licence()
    expect(goalChanceOptionLines(read, labels, gateWordsOf(read))).toEqual([
      '‘Team A’: about 62% chance of launching by 7 April 2027, in this model.',
      '‘Team B’: about 41% chance of launching by 7 April 2027, in this model.',
    ])
  })

  it('removes only the leading share marker and preserves the deliverable verbatim', () => {
    const read = licence({ ...TARGET, unit: '% of Feature Launch (v2)' })
    expect(goalChanceTargetWords(read)).toBe('Feature Launch (v2) done by 7 April 2027')
    // CEE twin: the head here is "(v2)", not "launch", so the deliverable is said verbatim with "finishing".
    expect(goalChanceOptionLines(read, labels, gateWordsOf(read))![0])
      .toBe('‘Team A’: about 62% chance of finishing Feature Launch (v2) by 7 April 2027, in this model.')
    // CONTROL (ruled words, CEE shareGoalChanceWords twin): a deliverable that is not a launch keeps "finishing <it> by", verbatim.
    // CONTROL (DL #2762 r4): "launch" only modifying the deliverable is not a launch.
    const review = licence({ ...TARGET, unit: '% of the pre-launch security review' })
    expect(goalChanceOptionLines(review, labels, gateWordsOf(review))![0])
      .toBe('‘Team A’: about 62% chance of finishing the pre-launch security review by 7 April 2027, in this model.')
    // CEE r5 twin rows: the head phrase decides.
    expect(goalChanceOptionLines(licence({ ...TARGET, unit: '% of the security review before launch' }), labels, gateWordsOf(licence({ ...TARGET, unit: '% of the security review before launch' })))![0])
      .toBe('‘Team A’: about 62% chance of finishing the security review before launch by 7 April 2027, in this model.')
    expect(goalChanceOptionLines(licence({ ...TARGET, unit: '% of the app launch in Europe' }), labels, gateWordsOf(licence({ ...TARGET, unit: '% of the app launch in Europe' })))![0])
      .toBe('‘Team A’: about 62% chance of launching by 7 April 2027, in this model.')
    // CEE r6 closed-grammar twin rows.
    expect(goalChanceOptionLines(licence({ ...TARGET, unit: '% of the security review during launch' }), labels, gateWordsOf(licence({ ...TARGET, unit: '% of the security review during launch' })))![0])
      .toBe('‘Team A’: about 62% chance of finishing the security review during launch by 7 April 2027, in this model.')
    expect(goalChanceOptionLines(licence({ ...TARGET, unit: '% of the app launch planned for Europe' }), labels, gateWordsOf(licence({ ...TARGET, unit: '% of the app launch planned for Europe' })))![0])
      .toBe('‘Team A’: about 62% chance of finishing the app launch planned for Europe by 7 April 2027, in this model.')
    const other = licence({ ...TARGET, unit: '% of Data Migration (v2)' })
    expect(goalChanceOptionLines(other, labels, gateWordsOf(other))![0])
      .toBe('‘Team A’: about 62% chance of finishing Data Migration (v2) by 7 April 2027, in this model.')
  })

  it('point extremes retain less than 1% / more than 99%, never certainty', () => {
    expect(goalChanceOptionLines(licence(TARGET, { a: 0, b: 100 }), labels, gateWordsOf(licence(TARGET, { a: 0, b: 100 })))).toEqual([
      '‘Team A’: less than 1% chance of launching by 7 April 2027, in this model.',
      '‘Team B’: more than 99% chance of launching by 7 April 2027, in this model.',
    ])
  })

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

  it('headline target words change only the parentheses in every existing template', () => {
    const read = licence()
    expect(goalChanceTargetWords(read)).toBe('the feature launch done by 7 April 2027')
    for (const form of ['each', 'highest', 'highest_all_likely_to_miss', 'all_likely_to_miss', 'similar'] as const) {
      const fields = { form, leaderOptionId: 'a', nextOptionId: 'b', similarOptionIds: ['a', 'b'] }
      const before = { ...read, ...fields, target: { comparator: 'at_least' as const, value: 100, unit: 'customers' } }
      expect(goalChanceHeadline({ ...read, ...fields }, labels, gateWordsOf({ ...read, ...fields }))).toBe(
        goalChanceHeadline(before, labels, gateWordsOf(before))!.replace('(at least 100 customers)', '(the feature launch done by 7 April 2027)'),
      )
    }
  })

  it.each([
    ['level', { comparator: 'at_least', value: 100, unit: 'customers' }, 'at least 100 customers'],
    ['change', { comparator: 'at_most', value: -10, unit: '% change in costs' }, 'at most -10% change in costs'],
  ])('%s twin: point lines and headline remain byte-identical with or without by_date', (_kind, target, targetWords) => {
    const without = licence({ ...target, by_date: undefined } as unknown as typeof TARGET)
    const withDate = licence({ ...target, by_date: TARGET.by_date })
    const expected = ['‘Team A’: about 62% chance of meeting your goal, in this model.', '‘Team B’: about 41% chance of meeting your goal, in this model.']
    expect(goalChanceOptionLines(without, labels, gateWordsOf(without))).toEqual(expected)
    expect(goalChanceOptionLines(withDate, labels, gateWordsOf(withDate))).toEqual(expected)
    const headline = `In this model, on current information, each option’s chance of meeting your goal (${targetWords}):`
    expect(goalChanceHeadline(without, labels, gateWordsOf(without))).toBe(headline)
    expect(goalChanceHeadline(withDate, labels, gateWordsOf(withDate))).toBe(headline)
  })

  it('malformed date stays absent and cannot license finishing words', () => {
    expect(goalChanceOptionLines(licence({ ...TARGET, by_date: '2027-02-30' }), labels, gateWordsOf(licence({ ...TARGET, by_date: '2027-02-30' })))![0])
      .toBe('‘Team A’: about 62% chance of meeting your goal, in this model.')
  })

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
