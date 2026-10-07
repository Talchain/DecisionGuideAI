/**
 * ⭐ D3 cut 6 INTERIM (Science d5 #87 6009272273 + 6009276913; DL adopted; words c6): when a compared option's goal path
 * carries Olumi's own existence assumption, CEE withholds every summary form (`each` + `summary_withheld {cause, form}`).
 * The UI reads it by identity and says c6's sentence for THAT form, once, beside the chance lines (the hero, else the
 * WinGauge goal rows). A record saying both a summary and a withheld summary is not read.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { goalChanceDisclosureLines, goalChanceSummaryWithheldLine, readGoalChanceLicence } from '../goalChanceLicence'
import { WinGauge } from '../../WinGauge'

const record = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'x', form: 'each', option_ids: ['a', 'b'], pct_by_option: { a: 50, b: 35 },
  target: { comparator: 'at_least', value: 20000, unit: '£' }, ...extra })
const read = (extra: Record<string, unknown>) => readGoalChanceLicence([record(extra)])
const WORDS = {
  highest: 'Olumi isn’t naming the option with the highest chance, because that could depend on its own assumption that some links might not hold.',
  highest_all_likely_to_miss: 'Olumi isn’t saying whether every option is more likely to miss your goal than meet it, or naming the option with the highest chance, because both could depend on its own assumption that some links might not hold.',
  all_likely_to_miss: 'Olumi isn’t saying whether every option is more likely to miss your goal than meet it, because that could depend on its own assumption that some links might not hold.',
  similar: 'Olumi isn’t saying whether the options have similar chances of meeting your goal, because that could depend on its own assumption that some links might not hold.',
} as const
const CONTEST = /\b(leader|leads|leading|ahead|beats|wins|winner|best)\b/i

describe('summary_withheld: c6\'s sentence for the withheld form', () => {
  it.each(Object.entries(WORDS))('%s → its exact sentence; no contest words', (form, words) => {
    const l = read({ summary_withheld: { cause: 'olumi_existence_assumption', form } })
    expect(l?.summaryWithheld).toEqual({ cause: 'olumi_existence_assumption', form })
    expect(goalChanceSummaryWithheldLine(l)).toBe(words)
    expect(words).not.toMatch(CONTEST)
  })
  it('a withheld `similar` never says "highest"', () => {
    expect(goalChanceSummaryWithheldLine(read({ summary_withheld: { cause: 'olumi_existence_assumption', form: 'similar' } }))).not.toMatch(/highest/)
  })
  it('a record saying BOTH a summary form and a withheld summary is at odds with itself → not read', () => {
    expect(readGoalChanceLicence([record({ form: 'highest', leader_option_id: 'a', next_option_id: 'b',
      summary_withheld: { cause: 'olumi_existence_assumption', form: 'highest' } })])).toBeNull()
  })
  it('a malformed one (unknown cause, form `each`, no form) is not read: the `each` lines stand, no sentence', () => {
    for (const bad of [{ cause: 'other', form: 'highest' }, { cause: 'olumi_existence_assumption', form: 'each' }, { cause: 'olumi_existence_assumption' }, 'x']) {
      const l = read({ summary_withheld: bad })
      expect(l?.form).toBe('each')
      expect(goalChanceSummaryWithheldLine(l)).toBeNull()
    }
  })
  it('no record → no sentence (today\'s `each` unchanged)', () => {
    expect(goalChanceSummaryWithheldLine(read({}))).toBeNull()
  })
  it('the disclosure says the withheld sentence THEN the existence line, once', () => {
    const l = read({ summary_withheld: { cause: 'olumi_existence_assumption', form: 'highest' }, user_link_existence: { links: 2, one_in: 5 } })
    expect(goalChanceDisclosureLines(l)).toBe(`${WORDS.highest} These chances also count Olumi’s own assumption that each of your links might not hold (a 1-in-5 chance each).`)
  })
  it('the WinGauge home carries it when the hero cannot', () => {
    const l = read({ summary_withheld: { cause: 'olumi_existence_assumption', form: 'similar' } })!
    const goal = [{ id: 'a', label: 'Raise', goalProbability: 0.5 }, { id: 'b', label: 'Starter', goalProbability: 0.35 }]
    render(<WinGauge shares={[]} goalShares={goal} goalChanceLicence={l} goalChanceDisclosure={goalChanceDisclosureLines(l)} />)
    expect(screen.getByTestId('win-gauge-goal-existence').textContent).toBe(WORDS.similar)
  })
})
