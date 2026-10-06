/**
 * c6 6 Oct: a chance that DISPLAYS as 0 is "less than 1%", one that displays as 100 is "more than 99%" — never "about 0%"
 * (reads as impossible) or "about 100%". Both directions, and the CONTROL in between.
 */
import { describe, expect, it } from 'vitest'
import { goalChanceOptionLines } from '../goalChanceCopy'
import type { GoalChanceLicence } from '../../utils/goalChanceLicence'

const licence = (pct: Record<string, number>): GoalChanceLicence => ({
  form: 'each', optionIds: Object.keys(pct), pctByOption: pct, withheldOptionIds: [], similarOptionIds: [], userLinkExistence: null,
  leaderOptionId: null, nextOptionId: null, target: { comparator: 'at_least', value: 100, unit: 'customers' },
})

describe('goal-chance figures at the extremes', () => {
  it('0 → "less than 1%", 100 → "more than 99%", 37 → "about 37%"', () => {
    expect(goalChanceOptionLines(licence({ a: 0, b: 100, c: 37 }), (id) => id.toUpperCase())).toEqual([
      '‘A’: less than 1% chance of meeting your goal, in this model.',
      '‘B’: more than 99% chance of meeting your goal, in this model.',
      '‘C’: about 37% chance of meeting your goal, in this model.',
    ])
  })
})
