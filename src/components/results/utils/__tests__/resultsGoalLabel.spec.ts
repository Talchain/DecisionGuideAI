/**
 * ⛔ BAN HIT #8 (red team #87 6004182580, UI 254d0274; DL 0df0e1): the Results goal label wrapped a one-word goal as
 * "the best outcome for {label}", and the hero served "Olumi doesn't hold today's level of ‘the best outcome for
 * no-shows’": "best" (never a winner) and nonsense (the level of an outcome). The goal's own label, verbatim.
 */
import { describe, expect, it } from 'vitest'
import { resultsGoalLabel } from '../resultsGoalLabel'
import { HERO_COPY } from '../../analysis-hero/heroCopy'

describe('the Results goal label is the goal’s own label, verbatim', () => {
  it('RED: the dental fixture (one-word goal) → today’s level of ‘no-shows’, never "best"', () => {
    const label = resultsGoalLabel(undefined, 'no-shows')
    expect(label).toBe('no-shows')
    const served = HERO_COPY.lensUnavailable.outcomeNoTodayLevel(label, null)
    expect(served).toContain('today\'s level of ‘no-shows’')
    expect(served).not.toMatch(/\bbest\b/i)
    expect(served).not.toContain('the best outcome for')
  })

  it.each([
    ['MRR', 'MRR'],
    ['Churn', 'Churn'],
    ['Increase monthly recurring revenue', 'Increase monthly recurring revenue'],
  ])('a goal labelled %s is spoken of as %s (no wrapper, whatever its word count)', (raw, want) => {
    expect(resultsGoalLabel(undefined, raw)).toBe(want)
  })

  it('the framing goal outranks the goal node’s label', () => {
    expect(resultsGoalLabel('Cut no-shows', 'no-shows')).toBe('Cut no-shows')
  })

  it('CONTROL: no label at all → "your goal"', () => {
    expect(resultsGoalLabel(undefined, undefined)).toBe('your goal')
    expect(resultsGoalLabel('', 42)).toBe('your goal')
  })
})
