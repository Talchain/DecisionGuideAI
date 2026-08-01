/**
 * buildV7Headline — V7 Lane L4 pins for the passthrough hero headline.
 *
 * The hero copy must be composed ONLY from store values (no invented number or
 * claim), and must use the production template forms verbatim. These pins lock
 * each branch to its exact string and prove the gauge value is the winner's own
 * win probability.
 */
import { describe, it, expect } from 'vitest'
import { COMPARATIVE_COPY, GOAL_ANCHOR_COPY } from '../../utils/goalAnchorCopy'
import { SUB_ONE_PERCENT_READOUT, formatGoalProbability } from '../../utils/displayFloors'
import { buildV7Headline } from '../buildV7Headline'
import type { DecisionResultData, OptionResult } from '../../types'

/**
 * ⭐ SUPERSEDED EXPECTATION — re-anchoring, 2026-07-31.
 *
 * Every row below used to expect `"{winner} performs best"`. §6.2c RETIRES
 * that sentence: an unqualified superlative with no stated basis and no
 * number, and the closest thing in the product to "choose this". Which BRANCH
 * fires is unchanged — the SINGLE VERDICT gate, the indeterminate-state rule
 * and the null-gauge rule all behave exactly as before. Only the sentence the
 * clear-winner branch emits moved.
 *
 * With no goal probability in these fixtures the headline takes the
 * comparative arm; with no comparative probability either, it states the
 * absence rather than inventing a claim.
 */
const AHEAD = (pct: string) => `Option A ${COMPARATIVE_COPY.clause(pct)}`
const NO_RANKING = `Option A — ${COMPARATIVE_COPY.unavailableClause}`

function opt(id: string, label: string, winProbability: number, isRecommended = false): OptionResult {
  return { id, label, winProbability, isRecommended } as unknown as OptionResult
}

function rec(partial: Partial<DecisionResultData>): DecisionResultData {
  return partial as DecisionResultData
}

describe('buildV7Headline — passthrough hero copy (V7 L4)', () => {
  it('clear winner → the re-anchored comparative headline with its magnitude, gauge = winner win probability (SUPERSEDED: was "{winner} performs best" — a bare superlative naming no basis, retired 2026-07-31)', () => {
    const winner = opt('a', 'Option A', 0.71, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.3)] }),
      'robust',
    )
    expect(model.headline).toBe(AHEAD('71%'))
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
    // ROADMAP 1.223: the subline used to read "Option A leads slightly more
    // often" — a leader claim printed directly beneath a denial of one, and
    // the exact contradictory pair `decisionVerdict`'s header cites as the
    // original defect. The headline was fixed then and the subline was not.
    // A denial does not get a leader for a companion.
    expect(model.subline).toBeNull()
  })

  // Legacy path (no shared verdict supplied): both historic denials intact.
  it('indeterminate decision state → "No clear leading option" (no-verdict legacy path)', () => {
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
    // No comparative probability ⇒ the headline states the ABSENCE rather
    // than inventing a claim. (Was `"{winner} performs best"`, which asserted
    // a verdict on a run that produced no number to back it.)
    expect(model.headline).toBe(NO_RANKING)
    // No runner-up gap is claimed when the winner carries no probability.
    expect(model.subline).toBeNull()
  })
})

// ─── SINGLE VERDICT (2026-07-25) ────────────────────────────────────────────
// This headline used to hold TWO independent denials of a leading option:
// the producer's `nearTie.isTie` (correct) and `decisionState ===
// 'indeterminate'` (which folds in stability thresholds, so a genuinely clear
// lead was denied for being FRAGILE — the same category error the results
// panel made, and the co-visible contradiction the journey lane caught).
// Both are now one gate on the shared verdict.
describe('buildV7Headline — SINGLE VERDICT gate', () => {
  const clearVerdict = { leaderId: 'a', separation: 'clear' as const, hasLeadingOption: true, gapPp: 40, source: 'producer_near_tie' as const }
  const tiedVerdict = { leaderId: 'a', separation: 'tied' as const, hasLeadingOption: false, gapPp: 3, source: 'producer_near_tie' as const }

  it('does NOT deny a leading option merely because decisionState is indeterminate', () => {
    const winner = opt('a', 'Option A', 0.70, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.30)], verdict: clearVerdict }),
      'indeterminate',
    )
    expect(model.headline).not.toContain('No clear leading option')
    expect(model.headline).toBe(AHEAD('70%'))
  })

  it('DOES deny one when the shared verdict says the top two are tied', () => {
    const winner = opt('a', 'Option A', 0.52, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.48)], verdict: tiedVerdict }),
      'robust',
    )
    expect(model.headline).toBe('No clear leading option')
  })

  it('with no verdict (older fixtures) the historic producer-near-tie behaviour is unchanged', () => {
    const winner = opt('a', 'Option A', 0.52, true)
    const model = buildV7Headline(
      rec({
        recommendedOption: winner,
        allOptions: [winner, opt('b', 'Option B', 0.48)],
        nearTie: { isTie: true, topOptionId: 'a', secondOptionId: 'b', tiedOptionIds: [], gap: 0.04, threshold: 0.1 },
      }),
      'robust',
    )
    expect(model.headline).toBe('Too close to call')
  })
})

// ─── THE SUB-1% DISPLAY FLOOR (UI-SEM-057) ──────────────────────────────────
//
// The re-anchored goal headline formats its magnitude with
// `formatPercent(v, { fromDecimal: true })` and NO floor, so a 0.4% goal
// probability produced "Option A has the highest chance of hitting your goal:
// 0%" — a headline that crowns an option on a number it simultaneously prints
// as zero, while the option card for the same option says "< 1%". Every other
// goal surface (OptionCards, the V7 goal lens, the analysis hero) routes
// through `SUB_ONE_PERCENT_FLOOR`.
//
// RED-first: the "< 1%" assertion fails on `48adda75` (it reads "0%").
describe('buildV7Headline — the goal magnitude honours the shared sub-1% floor', () => {
  function goalWinner(goalProbability: number): OptionResult {
    return {
      id: 'a',
      label: 'Option A',
      winProbability: 0.71,
      isRecommended: true,
      goalProbability,
      goalFitIsSubstitutedJoint: false,
    } as unknown as OptionResult
  }

  it('renders a non-zero sub-1% goal probability as "< 1%", never a bare "0%"', () => {
    const winner = goalWinner(0.004)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.29)] }),
      'robust',
    )
    expect(model.headline).toBe(
      GOAL_ANCHOR_COPY.headline('Option A', SUB_ONE_PERCENT_READOUT, false),
    )
    expect(model.headline).not.toContain(': 0%')
  })

  it('uses the SAME floored formatter the sibling goal surfaces use', () => {
    for (const v of [0.004, 0.0099, 0.01, 0.5]) {
      const winner = goalWinner(v)
      const model = buildV7Headline(
        rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.29)] }),
        'robust',
      )
      expect(model.headline).toBe(
        GOAL_ANCHOR_COPY.headline('Option A', formatGoalProbability(v), false),
      )
    }
  })

  it('CONTROL — the top of the range is unchanged: no ceiling rule the siblings do not have', () => {
    const winner = goalWinner(0.995)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.29)] }),
      'robust',
    )
    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option A', '100%', false))
  })
})
