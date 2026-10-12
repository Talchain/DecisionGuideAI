/**
 * Recovery Batch C (UI) item 2 on the option card: the low-chance badge says the licence's own words for what the chance
 * is a chance OF (Paul's hiring: a change from today), never the generic "chance of meeting your goal" (which reads a
 * change as a level). `ResultsBody` passes the words from RunView (`goalChanceDetail().chance_words`); with none, the
 * badge is byte-identical to before (CONTROL).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import { HIRING_WORDS } from './helpers/batchCGoalChance'

const option = (id: string, label: string, goalProbability: number, winProbability: number, isRecommended: boolean): OptionResult => ({
  id, label, expected: 10, outcome: { mean: 10, p10: 7, p50: 10, p90: 13 }, p10: 7, p50: 10, p90: 13,
  isRecommended, winProbability, goalProbability, rank: isRecommended ? 1 : 2, nValidSamples: 10000,
})
const OPTIONS = [option('hire_a_tech_lead', 'Hire a tech lead', 0.46, 0.55, true), option('hire_two_developers', 'Hire two developers', 0.06, 0.4, false)]

afterEach(() => cleanup())

describe('Batch C item 2: the option card\'s low-chance badge in the licence\'s words', () => {
  it('says "About 6% chance of ‘Productivity’ being at least 10% higher than today at three months"', () => {
    render(<OptionCards options={OPTIONS} winnerId="hire_a_tech_lead" hasGoalThreshold goalChanceWords={HIRING_WORDS} />)
    expect(screen.getByTestId('low-goal-warning-hire_two_developers').textContent)
      .toBe('About 6% chance of ‘Productivity’ being at least 10% higher than today at three months')
    expect(document.body.textContent).not.toMatch(/chance of meeting your goal/)
  })

  it('CONTROL: with no licence words the badge is as before ("About 6% chance of meeting your goal")', () => {
    render(<OptionCards options={OPTIONS} winnerId="hire_a_tech_lead" hasGoalThreshold />)
    expect(screen.getByTestId('low-goal-warning-hire_two_developers').textContent).toBe('About 6% chance of meeting your goal')
  })
})
