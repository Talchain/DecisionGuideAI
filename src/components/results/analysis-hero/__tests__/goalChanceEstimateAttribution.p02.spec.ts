/**
 * GOAL-REACH GP (CEE #2830, CHAT-STABLE; DL option (a)): a goal chance that rests on Olumi's estimates says so in the
 * same sentence as its figure — never a bare estimate-backed point. CEE counts (`olumi_estimate_link_count`, RC4 k,
 * definitions excluded) on the GOAL_CHANCE_LICENSED record; the card says "…, using Olumi's estimates for <k> relationship(s)
 * (see Check estimates)". The card never recounts the graph. Absent / malformed count → today's sentence, byte for byte.
 *
 * #2747 re-scope 2 round 2: the per-option lines (`goalChanceOptionLines`) are deleted (each option's cell is CEE's served
 * face, which carries its own provisional clause), so these rows now read the one UI sentence left, the headline over
 * CEE's chance words. The "every option line carries the attribution" half of the k = 2 row went with the lines.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { goalChanceHeadline } from '../goalChanceCopy'

const TARGET = { comparator: 'at_least', value: 20000, unit: '£/month' }
const WORDS = 'chance of reaching at least £20,000 / month'
const wire = (extra: Record<string, unknown>) => [{
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
  option_ids: ['keep', 'raise'], pct_by_option: { keep: 46, raise: 45 }, target: TARGET, ...extra,
}]
const headline = (extra: Record<string, unknown>) => goalChanceHeadline(readGoalChanceLicence(wire(extra))!, WORDS)

describe('GP: an estimate-backed goal chance names Olumi’s estimates in the same sentence', () => {
  it('k = 2 → the headline carries the attribution before its colon', () => {
    expect(headline({ olumi_estimate_link_count: 2 })).toBe(
      `In this model, on current information, each option’s ${WORDS}, using Olumi's estimates for 2 relationships (see Check estimates):`,
    )
  })

  it('k = 1 → singular "1 relationship"', () => {
    expect(headline({ olumi_estimate_link_count: 1 })).toContain("using Olumi's estimates for 1 relationship (see Check estimates):")
  })

  it('CEE #2830 r16 lockstep: never the retired word "links" / "1 link" in the clause', () => {
    for (const k of [1, 2]) expect(headline({ olumi_estimate_link_count: k })).not.toMatch(/Olumi's estimates for \d+ links?\b/)
  })

  it('CONTROL: no count → today’s sentence, byte for byte (no attribution words anywhere)', () => {
    expect(headline({})).toBe(`In this model, on current information, each option’s ${WORDS}:`)
  })

  it.each([[0], [1.5], [-1], ['2']])('a malformed count (%j) is ignored, never shown', (k) => {
    expect(headline({ olumi_estimate_link_count: k })).not.toContain("Olumi's estimates")
  })

  it('round 2 (rule C): with no served chance words there is no headline to carry it', () => {
    expect(goalChanceHeadline(readGoalChanceLicence(wire({ olumi_estimate_link_count: 2 }))!, null)).toBeNull()
  })
})
