/**
 * ⭐ MONEY IS WRITTEN ONE WAY ON ONE BOARD (canvas audit 27 Sep 2026,
 * paul-models POM-9; board 08bf9a1f, and 17d1 / 90b8).
 *
 * On screen at once, 08bf: `Pro plan price £49 / month` · `Feature development
 * spend 0 GBP over 6 months` · option row `0 GBP over 6 months → 20,000 GBP over
 * 6 months` · outcome `Limit ≤ GBP 20,000` · goal pill `≤GBP 20,000`. 17d1/90b8:
 * `Other MRR growth 1,000 GBP MRR added / month` beside `£49 / month`.
 *
 * Two owners, both fixed at the owner so every surface follows:
 *   · `compactUnitParts` (utils/unitClassifier) — the factor card, the option
 *     rows' "from" and "to", the goal target and now the limit text all read it;
 *   · `goalConstraintText` — the limit pill and the outcome's limit line.
 *
 * Every changed row has an unchanged control beside it.
 */
import { describe, it, expect } from 'vitest'
import { compactUnitParts, compactCarriedReading, joinCompactUnitParts } from '../unitClassifier'
import { formatGoalTarget } from '../../components/results/utils/formatGoalTarget'
import { goalConstraintShortText, goalConstraintText } from '../../canvas/utils/goalConstraintText'

const compact = (figure: string, unit: string) => {
  const p = compactUnitParts(figure, unit)
  return p === null ? null : joinCompactUnitParts(p)
}

describe('compactUnitParts — a currency-led unit carries the glyph on the figure', () => {
  it.each([
    ['0', 'GBP over 6 months', '£0 over 6 months'],
    ['20,000', 'GBP over 6 months', '£20,000 over 6 months'],
    ['1,000', 'GBP MRR added per month', '£1,000 MRR added / month'],
    ['100,000', 'GBP MRR', '£100,000 MRR'],
    ['5', 'USD ARR', '$5 ARR'],
    ['7', '€ saved per week', '€7 saved / week'],
    ['1,000', 'GBP MRR/month', '£1,000 MRR/month'],
  ])('%s %s → %s', (figure, unit, expected) => {
    expect(compact(figure, unit)).toBe(expected)
  })

  it.each([
    // The rate arm's own shapes — unchanged.
    ['49', 'GBP per month', '£49 / month'],
    ['39,000', 'GBP/year', '£39,000 / year'],
    ['20', 'subscribers per month', '20 subscribers / month'],
  ])('CONTROL (rate arm, unchanged) %s %s → %s', (figure, unit, expected) => {
    expect(compact(figure, unit)).toBe(expected)
  })

  it.each([
    // No glyph for the code, a negative figure, a compound head: today's output.
    ['0', 'CHF over 6 months', null],
    ['-500', 'GBP over 6 months', null],
    ['9', 'GBP MRR per seat per month', null],
    ['12', 'months', null],
  ])('CONTROL (declined, unchanged) %s %s → %s', (figure, unit, expected) => {
    expect(compact(figure, unit)).toBe(expected)
  })

  it("the producer's own reading, exactly `<figure> <carried unit>`, re-spells the same way (option row \"to\")", () => {
    expect(compactCarriedReading('20,000 GBP over 6 months', 'GBP over 6 months')).toBe('£20,000 over 6 months')
    // CONTROL: prose that is not the carried unit stays verbatim (null → caller keeps it).
    expect(compactCarriedReading('about £20k', 'GBP over 6 months')).toBeNull()
  })

  it('a caller of the shared owner, pinned: the goal target reads £100,000 MRR (was "100,000 GBP MRR")', () => {
    expect(formatGoalTarget(100000, 'GBP MRR')).toBe('£100,000 MRR')
    // CONTROL: the rate form the target already compacted.
    expect(formatGoalTarget(20000, 'GBP per month')).toBe('£20,000 / month')
  })
})

describe('goalConstraintText — a limit in GBP reads £, like every other money figure', () => {
  const LIMIT = { constraint_id: 'c_spend', node_id: 'fac_spend', operator: '<=', value: 20000, unit: 'GBP', provenance: 'explicit', label: 'Feature development spend' }

  it('the pill reads ≤£20,000 and the full sentence ≤ £20,000 (was ≤GBP 20,000 / ≤ GBP 20,000)', () => {
    expect(goalConstraintShortText(LIMIT as never, [])).toContain('≤£20,000')
    expect(goalConstraintShortText(LIMIT as never, [])).not.toContain('GBP')
    expect(goalConstraintText(LIMIT as never, [])).toContain('£20,000')
    expect(goalConstraintText(LIMIT as never, [])).not.toContain('GBP')
  })

  it('a compound money unit on a limit reads through the same owner', () => {
    expect(goalConstraintShortText({ ...LIMIT, unit: 'GBP over 6 months' } as never, [])).toContain('≤£20,000 over 6 months')
  })

  it('CONTROLS — a percent limit, a symbol limit and a code with no glyph are unchanged', () => {
    expect(goalConstraintShortText({ ...LIMIT, value: 4, unit: '%' } as never, [])).toContain('≤4%')
    expect(goalConstraintShortText({ ...LIMIT, unit: '£' } as never, [])).toContain('≤£20,000')
    expect(goalConstraintShortText({ ...LIMIT, unit: 'CHF' } as never, [])).toContain('≤CHF 20,000')
  })
})
