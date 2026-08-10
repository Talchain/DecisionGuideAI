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

  /**
   * ⭐ SUPERSEDED EXPECTATION — the gap subline is RETIRED (2026-08-10).
   *
   * This asserted `'Leads by 40 points'`: the percentage-point DIFFERENCE
   * between two win frequencies, printed beneath a correct statement of the
   * leader's own probability. The ratified rule is that no user-facing surface
   * states that gap — a difference of two Monte-Carlo estimates is less
   * reliable than either of them and was being rendered as the most precise
   * number on the screen. The subline now names the runner-up and states ITS
   * OWN probability, same formatter as the headline.
   */
  it('clear winner subline names the RUNNER-UP and its OWN probability — never the gap', () => {
    const winner = opt('a', 'Option A', 0.7, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.3)] }),
      'robust',
    )
    expect(model.subline).toBe('Next: Option B, 30%')
    expect(model.subline).not.toMatch(/leads?\s+by\s+\d+\s+points?/i)
  })

  it('names the STRONGEST rival, by identity, when there are several', () => {
    const winner = opt('a', 'Option A', 0.6, true)
    const model = buildV7Headline(
      rec({
        recommendedOption: winner,
        allOptions: [winner, opt('b', 'Option B', 0.11), opt('c', 'Option C', 0.29)],
      }),
      'robust',
    )
    // Option C (0.29) outranks Option B (0.11); the label, not the value,
    // is what pins the subject.
    expect(model.subline).toBe('Next: Option C, 29%')
  })

  it('rivals TIED at the top of the field → silence (naming one would be an arbitrary ordering claim)', () => {
    const winner = opt('a', 'Option A', 0.6, true)
    const model = buildV7Headline(
      rec({
        recommendedOption: winner,
        allOptions: [winner, opt('b', 'Option B', 0.2), opt('c', 'Option C', 0.2)],
      }),
      'robust',
    )
    expect(model.subline).toBeNull()
  })

  /**
   * ⭐⭐ THE GUARD THAT USED TO RIDE ON THE GAP (review F1, 2026-08-10).
   *
   * Retiring the gap subline was a REPLACEMENT, not a deletion, and the old
   * `leadSubline(points)` had been silently carrying a second job: it returned
   * null whenever `points <= 0`, which covered the state where the DESIGNATED
   * WINNER IS NOT THE WIN-PROBABILITY MAXIMUM. The replacement only checked
   * ties among RIVALS, so it began asserting "Next: {rival}" above a rival
   * whose probability EXCEEDS the winner's — an ordering the two numbers on
   * screen contradict.
   *
   * NOT hypothetical, and bounded at the PRODUCER rather than from a fixture:
   * `determineWinnerSelection` returns the backend `recommended_option_id`
   * verbatim with no argmax comparison, and `src/lib/decisionVerdict.ts:305`
   * says it outright — "PLoT may recommend an option that is not the
   * win-probability argmax, and a leader-minus-rival subtraction would then go
   * NEGATIVE". `separation` is measured on the ACTUAL top two, so
   * `hasLeadingOption` is TRUE in that state and the early return never fires.
   *
   * The suite missed it because all four corpus cases placed the rival BELOW
   * the winner — the corpus shared the code's assumption (traps 22 / 13d).
   */
  it('F1: a rival ABOVE the designated winner gets NO subline — never an ordering the numbers contradict', () => {
    const winner = opt('a', 'Option A', 0.4, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.55)] }),
      'robust',
    )
    expect(model.subline).toBeNull()
  })

  it('F1 TWIN: with the winner genuinely ahead, the subline DOES render (the guard suppresses only the inverted state)', () => {
    const winner = opt('a', 'Option A', 0.55, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.4)] }),
      'robust',
    )
    expect(model.subline).toBe('Next: Option B, 40%')
  })

  it('F1: a rival EQUAL to the winner gets no subline either', () => {
    const winner = opt('a', 'Option A', 0.5, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.5)] }),
      'robust',
    )
    expect(model.subline).toBeNull()
  })

  it('F1: a lead too small to survive rounding gets no subline — MONOTONE with the pre-PR build, which was also silent here', () => {
    const winner = opt('a', 'Option A', 0.404, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.4)] }),
      'robust',
    )
    expect(model.subline).toBeNull()
  })

  it('a rival below the display floor keeps the floored readout, never a bare "0%"', () => {
    const winner = opt('a', 'Option A', 0.99, true)
    const model = buildV7Headline(
      rec({ recommendedOption: winner, allOptions: [winner, opt('b', 'Option B', 0.001)] }),
      'robust',
    )
    expect(model.subline).toBe(`Next: Option B, ${SUB_ONE_PERCENT_READOUT}`)
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
//
// ⭐ FIXTURES COMPLETED + ONE EXPECTATION SUPERSEDED, 2026-08-01 (ROADMAP 2.233).
//
// TWO changes, and the distinction matters when reading this block.
//
// (1) THE FIXTURES WERE INCOMPLETE, and that incompleteness is exactly what
//     hid the crowning defect. Every case gave the goal probability to the
//     RECOMMENDED option ALONE and set no `goalThreshold`, so no rival could
//     ever contradict the superlative and the audit's disagreement case was
//     unreachable from this file. The rows now carry a user target and a goal
//     value for BOTH options — which is what `selectGoalLeader` requires
//     before it will crown anything at all.
//
// (2) THE SUB-1% EXPECTATION IS SUPERSEDED. This block used to assert that a
//     0.4% goal probability produces "…highest chance of hitting your goal:
//     < 1%". Rendering "< 1%" instead of "0%" was the right fix to the
//     FORMATTING half, and that half is unchanged and still pinned below. But
//     crowning at all in that state was the wrong answer to a question this
//     block was not asking: the sibling hero (`buildHeroModel`, same
//     UI-SEM-057 floor) WITHHOLDS the crown when nothing clears the floor and
//     switches to its no-option-on-track headline. The two render on the same
//     screen, so a crown here was a fresh contradiction of the kind 2.233
//     exists to remove. The withheld behaviour is pinned in
//     `buildV7Headline.goalLeader.spec.ts`; what remains here is the FORMATTER
//     claim, tested across the range where a crown is legitimately earned.
describe('buildV7Headline — the goal magnitude honours the shared sub-1% floor', () => {
  /** A complete goal fixture: both options measured, A ahead, user target set. */
  function goalRun(winnerGoal: number, rivalGoal = 0.001): DecisionResultData {
    const winner = {
      id: 'a',
      label: 'Option A',
      winProbability: 0.71,
      isRecommended: true,
      goalProbability: winnerGoal,
      goalFitIsSubstitutedJoint: false,
    } as unknown as OptionResult
    const rival = {
      id: 'b',
      label: 'Option B',
      winProbability: 0.29,
      goalProbability: rivalGoal,
      goalFitIsSubstitutedJoint: false,
    } as unknown as OptionResult
    return rec({
      recommendedOption: winner,
      allOptions: [winner, rival],
      goalThreshold: 100,
    })
  }

  it('SUPERSEDED — a sub-1% maximum is no longer crowned at all (it is not re-labelled "0%" either)', () => {
    const model = buildV7Headline(goalRun(0.004, 0.001), 'robust')
    // The old expectation was GOAL_ANCHOR_COPY.headline('Option A', '< 1%', false).
    expect(model.headline).not.toContain('highest chance')
    // The defect the original test was written against stays dead: no bare
    // "0%" is printed for a non-zero probability anywhere in this headline.
    expect(model.headline).not.toContain(': 0%')
    expect(model.headline).not.toContain('0%')
  })

  it('uses the SAME floored formatter the sibling goal surfaces use, across the crownable range', () => {
    // 0.01 is the floor itself (inclusive — `value < FLOOR` is the predicate).
    for (const v of [0.01, 0.012, 0.5, 0.9]) {
      const model = buildV7Headline(goalRun(v), 'robust')
      expect(model.headline).toBe(
        GOAL_ANCHOR_COPY.headline('Option A', formatGoalProbability(v), false),
      )
    }
  })

  it('CONTROL — the readout constant is still reachable from the shared formatter', () => {
    // The "< 1%" string has not been deleted or re-defined; it is simply no
    // longer something a HEADLINE can crown on. Proving the constant and the
    // formatter still agree keeps the supersession above honest — the claim is
    // "not crowned", not "the floor was removed".
    expect(formatGoalProbability(0.004)).toBe(SUB_ONE_PERCENT_READOUT)
  })

  it('CONTROL — the top of the range is unchanged: no ceiling rule the siblings do not have', () => {
    const model = buildV7Headline(goalRun(0.995), 'robust')
    expect(model.headline).toBe(GOAL_ANCHOR_COPY.headline('Option A', '100%', false))
  })
})
