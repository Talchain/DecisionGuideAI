/**
 * ⭐ D3 cut 6 INTERIM (Science d5 #87 6009272273 + 6009276913; DL adopted; words c6): when a compared option's goal path
 * carries Olumi's own existence assumption, CEE withholds every summary form (`each` + `summary_withheld {cause, form}`).
 * The UI reads it by identity and says c6's sentence for THAT form, once, beside the chance lines (the hero, else the
 * WinGauge goal rows). A record saying both a summary and a withheld summary is not read.
 *
 * #2747 re-scope 2 (U0, DL ruling (A)): `goalChanceSummaryWithheldLine`, `goalChanceDisclosureLines` and WinGauge are
 * deleted (their last production callers, the hero's disclosure lines and the gauge, went in C). Their rows and
 * assertions are deleted; the licence READER's rows (summary_withheld parsed by identity, contradictory/malformed records
 * refused) stay.
 */
import { describe, expect, it } from 'vitest'
import { readGoalChanceLicence } from '../goalChanceLicence'

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
  // #2747 re-scope 2 (DL ruling (A)): the "its exact sentence" assertion (goalChanceSummaryWithheldLine) deleted with the
  // function; the reader's by-identity parse and the no-contest-words negative stay.
  it.each(Object.entries(WORDS))('%s → the reader keeps the withheld form by identity; no contest words', (form, words) => {
    const l = read({ summary_withheld: { cause: 'olumi_existence_assumption', form } })
    expect(l?.summaryWithheld).toEqual({ cause: 'olumi_existence_assumption', form })
    expect(words).not.toMatch(CONTEST)
  })
  // #2747 re-scope 2 (DL ruling (A)): row 'a withheld `similar` never says "highest"' deleted — its only subject,
  // goalChanceSummaryWithheldLine, was deleted with its last production caller.
  it('a record saying BOTH a summary form and a withheld summary is at odds with itself → not read', () => {
    expect(readGoalChanceLicence([record({ form: 'highest', leader_option_id: 'a', next_option_id: 'b',
      summary_withheld: { cause: 'olumi_existence_assumption', form: 'highest' } })])).toBeNull()
  })
  it('a malformed one (unknown cause, form `each`, no form) is not read: the `each` lines stand', () => {
    for (const bad of [{ cause: 'other', form: 'highest' }, { cause: 'olumi_existence_assumption', form: 'each' }, { cause: 'olumi_existence_assumption' }, 'x']) {
      const l = read({ summary_withheld: bad })
      expect(l?.form).toBe('each')
      // #2747 re-scope 2 (DL ruling (A)): the "no sentence" assertion deleted with goalChanceSummaryWithheldLine.
    }
  })
  // #2747 re-scope 2 (DL ruling (A)): rows deleted — 'no record → no sentence (today's `each` unchanged)' and 'the
  // disclosure says the withheld sentence THEN the existence line, once' (their only subjects, goalChanceSummaryWithheldLine
  // and goalChanceDisclosureLines, were deleted with their last production callers); 'the WinGauge home carries it when the
  // hero cannot' (its only subject, WinGauge, was removed in C).
})
