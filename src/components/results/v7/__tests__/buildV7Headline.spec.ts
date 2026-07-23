/**
 * buildV7Headline — V7 Lane L4 pins for the passthrough hero headline.
 *
 * The hero copy must be composed ONLY from store values (no invented number or
 * claim), and must use the production template forms verbatim. These pins lock
 * each branch to its exact string and prove the gauge value is the winner's own
 * win probability.
 */
import { describe, it, expect } from 'vitest'
import { buildV7Headline } from '../buildV7Headline'
import type { DecisionResultData, OptionResult } from '../../types'

function opt(id: string, label: string, winProbability: number, isRecommended = false): OptionResult {
  return { id, label, winProbability, isRecommended } as unknown as OptionResult
}

function rec(partial: Partial<DecisionResultData>): DecisionResultData {
  return partial as DecisionResultData
}

describe('buildV7Headline — passthrough hero copy (V7 L4)', () => {
  it('clear winner → "{winner} performs best", gauge = winner win probability', () => {
    const winner = opt('a', 'Option A', 0.71, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.3)] }),
      'robust',
    )
    expect(model.headline).toBe('Option A performs best')
    expect(model.winProbability).toBe(0.71)
    expect(model.winnerLabel).toBe('Option A')
  })

  it('clear winner subline names the lead in points from the real runner-up gap', () => {
    const winner = opt('a', 'Option A', 0.7, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.3)] }),
      'robust',
    )
    // 0.70 − 0.30 = 40 points — derived, never fabricated.
    expect(model.subline).toBe('Leads by 40 points')
  })

  it('near-tie → "Too close to call" (from recommendation.nearTie)', () => {
    const winner = opt('a', 'Option A', 0.52, true)
    const model = buildV7Headline(
      rec({
        recommendedOption: winner,
        allOptions: [winner, opt('b', 'Option B', 0.48)],
        nearTie: { isTie: true, topOptionId: 'a', secondOptionId: 'b', tiedOptionIds: ['a', 'b'], gap: 0.04, threshold: 0.1 },
      }),
      'sensitive',
    )
    expect(model.headline).toBe('Too close to call')
    expect(model.subline).toBe('Option A leads slightly more often')
  })

  it('indeterminate decision state → "No clear leading option"', () => {
    const winner = opt('a', 'Option A', 0.34, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.33)] }),
      'indeterminate',
    )
    expect(model.headline).toBe('No clear leading option')
  })

  it('single option → "{winner} is your only option"', () => {
    const winner = opt('a', 'Option A', 0.9, true)
    const model = buildV7Headline(rec({ recommendedOption: winner, allOptions: [winner] }), 'robust')
    expect(model.headline).toBe('Option A is your only option')
  })

  it('no winner → empty headline (honest absence, hero renders nothing)', () => {
    const model = buildV7Headline(rec({ recommendedOption: null, allOptions: [] }), 'indeterminate')
    expect(model.headline).toBe('')
    expect(model.winnerLabel).toBeNull()
  })

  it('winner without a win probability → null gauge value, no fabricated number', () => {
    const winner = { id: 'a', label: 'Option A', isRecommended: true } as unknown as OptionResult
    const model = buildV7Headline(rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.3)] }), 'robust')
    expect(model.winProbability).toBeNull()
    expect(model.headline).toBe('Option A performs best')
    // No runner-up gap is claimed when the winner carries no probability.
    expect(model.subline).toBeNull()
  })
})
