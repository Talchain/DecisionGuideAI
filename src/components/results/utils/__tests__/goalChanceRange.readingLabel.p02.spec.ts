import { describe, expect, it } from 'vitest'
import { readGoalChanceRange } from '../goalChanceRange'

const ENTRY = {
  low_pct: 23, high_pct: 90, low_rounding: 'whole', high_rounding: 'nearest_5',
  kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
}
const RANGE = {
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range',
  option_ids: ['starter', 'pro'], range_by_option: { starter: ENTRY, pro: ENTRY },
}
const LICENCE = {
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
  option_ids: ['starter', 'pro'], pct_by_option: { starter: 62, pro: 41 },
  target: { comparator: 'at_least', value: 20000, unit: '£' },
}
const READING_LABEL = {
  v: 1, source: 'olumi_reading', goal: { id: 'revenue', label: 'MRR' },
  factors: [{ id: 'price', label: 'Pro plan price' }, { id: 'subscribers', label: 'Pro paying subscribers' }],
  addends: [{ id: 'churn', label: 'MRR lost to price-driven churn', sign: 'less' }],
}

describe('P02 GR2: an unconfirmed reading cannot leave bare goal-chance ranges', () => {
  it.each([
    ['valid', READING_LABEL],
    ['malformed', { ...READING_LABEL, factors: READING_LABEL.factors.slice(0, 1) }],
    ['null', null],
  ])('bars every range for a %s reading_label without the typed warning', (_name, reading_label) => {
    expect(readGoalChanceRange([RANGE, { ...LICENCE, reading_label }])).toBeNull()
  })

  it('bars every range for an unscoped reading-unconfirmed code without a label', () => {
    expect(readGoalChanceRange([RANGE, LICENCE, { code: 'GOAL_FIGURES_READING_UNCONFIRMED' }])).toBeNull()
  })

  it('a scoped reading warning cannot retain a bare sibling range under a label', () => {
    expect(readGoalChanceRange([
      RANGE, { ...LICENCE, reading_label: READING_LABEL },
      { code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['starter'],
        withheld_claims: ['goal_probability', 'joint_probability'] },
    ])).toBeNull()
  })

  it('a typed-only scoped joint warning is still a report-level reading fact for every range', () => {
    expect(readGoalChanceRange([
      RANGE, LICENCE,
      { code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['starter'], withheld_claims: ['joint_probability'] },
    ])).toBeNull()
  })

  it('fails closed for an unreadable typed reading-unconfirmed option scope', () => {
    expect(readGoalChanceRange([
      RANGE, LICENCE,
      { code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['other', null] },
    ])).toBeNull()
  })

  it('keeps the no-label range byte-identical, including compatible point-figure withholds', () => {
    const expected = {
      optionIds: ['starter', 'pro'], horizonLine: null,
      rangeByOption: { starter: {
        lowPct: 23, highPct: 90, lowRounding: 'whole', highRounding: 'nearest_5',
        kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
      }, pro: {
        lowPct: 23, highPct: 90, lowRounding: 'whole', highRounding: 'nearest_5',
        kind: 'link_strength', from: 'price', to: 'revenue', among: 'all',
      } },
    }
    expect(readGoalChanceRange([RANGE, LICENCE])).toEqual(expected)
    expect(readGoalChanceRange([
      RANGE, LICENCE, { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', option_ids: ['starter'] },
    ])).toEqual(expected)
  })
})
