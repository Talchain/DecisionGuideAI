/**
 * GOAL-REACH GP (CEE #2830, CHAT-STABLE; DL option (a)): a goal chance that rests on Olumi's estimates says so in the
 * same sentence as its figure — never a bare estimate-backed point. CEE counts (`olumi_estimate_link_count`, RC4 k,
 * definitions excluded) on the GOAL_CHANCE_LICENSED record; the card says "…, using Olumi's estimates for <k> relationship(s)
 * (see Check estimates)". The card never recounts the graph. Absent / malformed count → today's sentence, byte for byte.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { goalChanceHeadline, goalChanceOptionLines } from '../goalChanceCopy'

const TARGET = { comparator: 'at_least', value: 20000, unit: '£/month' }
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['keep', 'raise'], pct_by_option: { keep: 46, raise: 45 }, target: TARGET, ...extra,
}]
const LABELS: Readonly<Record<string, string>> = { keep: 'Keep £49 Pro price', raise: '£59 Pro price at release' }
const labelOf = (id: string) => LABELS[id] ?? null
const lines = (extra: Record<string, unknown>) => goalChanceOptionLines(readGoalChanceLicence(wire(extra))!, labelOf) ?? []
const headline = (extra: Record<string, unknown>) => goalChanceHeadline(readGoalChanceLicence(wire(extra))!, labelOf)

describe('GP: an estimate-backed goal chance names Olumi’s estimates in the same sentence', () => {
  it('k = 2 → every option line carries the attribution before its full stop', () => {
    expect(lines({ olumi_estimate_link_count: 2 })).toEqual([
      "‘Keep £49 Pro price’: about 46% chance of meeting your goal, in this model, using Olumi's estimates for 2 relationships (see Check estimates).",
      "‘£59 Pro price at release’: about 45% chance of meeting your goal, in this model, using Olumi's estimates for 2 relationships (see Check estimates).",
    ])
  })

  it('k = 1 → singular "1 link"; the headline carries it too', () => {
    expect(lines({ olumi_estimate_link_count: 1 })[0]).toContain("using Olumi's estimates for 1 relationship (see Check estimates).")
    expect(headline({ olumi_estimate_link_count: 1 })).toContain("using Olumi's estimates for 1 relationship (see Check estimates):")
  })

  it('CEE #2830 r16 lockstep: never the retired word "links" / "1 link" in the clause', () => {
    for (const k of [1, 2]) expect(lines({ olumi_estimate_link_count: k }).join(' ')).not.toMatch(/Olumi's estimates for \d+ links?\b/)
  })

  it('CONTROL: no count → today’s sentences, byte for byte (no attribution words anywhere)', () => {
    expect(lines({})[0]).toBe('‘Keep £49 Pro price’: about 46% chance of meeting your goal, in this model.')
    expect(headline({})).not.toContain("Olumi's estimates")
  })

  it.each([[0], [1.5], [-1], ['2']])('a malformed count (%j) is ignored, never shown', (k) => {
    expect(lines({ olumi_estimate_link_count: k }).join(' ')).not.toContain("Olumi's estimates")
  })
})
