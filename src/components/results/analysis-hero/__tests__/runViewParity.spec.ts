/**
 * RunView PR 1: the Run's per-option lines, worded from the Run's one view, are byte-identical to the lines worded from
 * the licence read directly (C3 captured record, scenario 23b1495c, CEE 2334956288d3a87eaece7a5ab3d948b20a5f9dfb).
 */
import { describe, expect, it } from 'vitest'
import { runViewOf } from '../../../../canvas/runView/runView'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { goalChanceOptionLines } from '../goalChanceCopy'

const C3 = {
  code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info', message: 'licensed',
  target: { unit: '£/month', value: 20000, comparator: 'at_least' },
  option_ids: ['keep_pro_at_49', 'raise_pro_to_59'], pct_by_option: { keep_pro_at_49: 0, raise_pro_to_59: 0 },
}
const LABELS: Record<string, string> = { keep_pro_at_49: 'Keep Pro at £49', raise_pro_to_59: 'Raise Pro to £59' }
const labelOf = (id: string) => LABELS[id] ?? null

describe('RunView parity with the direct licence read', () => {
  it('C3: the option lines are byte-identical, and the view\'s figure words are the lines\' figure words', () => {
    const view = runViewOf({ inference_warnings: [C3] })
    const lines = goalChanceOptionLines(view.goalChance!, labelOf)!
    expect(lines).toEqual(goalChanceOptionLines(readGoalChanceLicence([C3])!, labelOf))
    for (const id of C3.option_ids) {
      const chance = view.chanceOf(id)
      expect(chance.kind).toBe('figure')
      expect(lines.some((l) => l.startsWith(`‘${LABELS[id]}’: ${chance.kind === 'figure' ? chance.words : ''} `))).toBe(true)
    }
  })
})
