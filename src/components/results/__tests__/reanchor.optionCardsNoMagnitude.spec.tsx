/**
 * OptionCards — the winner's comparative sentence must never FABRICATE a
 * magnitude (adversarial-review finding F1).
 *
 * THE DEFECT THIS PINS, and it was introduced by the re-anchoring itself.
 * The winner's description was re-anchored to the house comparative register
 * and written as:
 *
 *   COMPARATIVE_COPY.phrase(
 *     formatProbabilityWithResolution(option.winProbability ?? 0, …)
 *   )
 *
 * The `?? 0` turns an ABSENT comparative probability into a measured one.
 * `formatProbabilityWithResolution` then applies the simulation-resolution
 * floor, so the winner's card reads "Came out ahead in <0.1% of simulated
 * scenarios" — a precise-looking, entirely invented measurement, on the one
 * card the user trusts most.
 *
 * ⚠ IT IS REACHABLE. The `decisionState` arm at the render site calls
 * `hingeAwareDescription` with no presence check on `winProbability` (the
 * sibling arm below it DOES check, which is what made this easy to miss).
 * A run that designates a leader but carries no per-option comparative
 * probability — exactly what the null-gauge branch of `buildV7Headline`
 * already handles honestly — lands here.
 *
 * This is the same class as the two defects the previous pass fixed: a
 * placeholder or a default rendered where a quantity belongs. The machinery
 * to say it correctly already exists — `COMPARATIVE_COPY.phraseNoMagnitude`.
 *
 * RED-first: the first test below fails on `34b04846`.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import { COMPARATIVE_COPY } from '../utils/goalAnchorCopy'

/**
 * A designated winner carrying NO comparative probability, plus a sibling so
 * the card set is a comparison. `nValidSamples` is present and large, which
 * is what makes the fabricated value read as a confident "<0.1%" rather than
 * an obvious placeholder.
 */
const WINNER_WITHOUT_WIN_PROB: OptionResult = {
  id: 'opt-a',
  label: 'Option A',
  expected: 70,
  outcome: { mean: 70, p10: 60, p50: 70, p90: 80 },
  winProbability: null,
  nValidSamples: 5000,
} as unknown as OptionResult

const SIBLING: OptionResult = {
  id: 'opt-b',
  label: 'Option B',
  expected: 40,
  outcome: { mean: 40, p10: 30, p50: 40, p90: 50 },
  winProbability: null,
  nValidSamples: 5000,
} as unknown as OptionResult

function renderCards() {
  return render(
    <OptionCards
      options={[WINNER_WITHOUT_WIN_PROB, SIBLING]}
      winnerId="opt-a"
      hasLeadingOption
      // The arm that reaches `hingeAwareDescription` with no presence check.
      decisionState="robust"
    />,
  )
}

describe('OptionCards — an absent comparative probability is never rendered as 0', () => {
  it('does not fabricate a measured share on the winner card', () => {
    const { container } = renderCards()
    const text = container.textContent ?? ''
    // The two shapes `?? 0` produces once the resolution floor is applied.
    expect(text).not.toContain('Came out ahead in 0% of simulated scenarios')
    expect(text).not.toContain('Came out ahead in <0.1% of simulated scenarios')
    // And nothing else that reads as a measured share.
    expect(text).not.toMatch(/Came out ahead in [<>]?[\d.]+% of simulated scenarios/)
  })

  it('says the claim WITHOUT a magnitude instead of dropping it', () => {
    renderCards()
    // Over-suppression control: the leader claim is still made — this is a
    // wording fix, not a suppression. Reusing the register the previous pass
    // built for exactly this case rather than inventing a third form.
    expect(
      screen.getByText(new RegExp(COMPARATIVE_COPY.phraseNoMagnitude, 'i')),
    ).toBeInTheDocument()
  })

  it('still renders the magnitude when the run actually carries one', () => {
    // ANTI-VACUITY: proves the assertions above can SEE a present magnitude,
    // so "no fabricated share" is not passing because nothing renders at all.
    const { container } = render(
      <OptionCards
        options={[
          { ...WINNER_WITHOUT_WIN_PROB, winProbability: 0.66 } as OptionResult,
          SIBLING,
        ]}
        winnerId="opt-a"
        hasLeadingOption
        decisionState="robust"
      />,
    )
    expect(container.textContent ?? '').toMatch(
      /Came out ahead in .+ of simulated scenarios/,
    )
  })
})

describe('OptionCards — the hinge variants carry no un-anchored superlative (F2)', () => {
  it.each([
    ['fragile_edge', { reason: 'fragile_edge', label: 'Hiring rate' }],
    ['voi', { reason: 'voi', label: 'Hiring rate' }],
  ])('the %s hinge variant is re-anchored', (_name, hinge) => {
    const { container } = render(
      <OptionCards
        options={[
          { ...WINNER_WITHOUT_WIN_PROB, winProbability: 0.66 } as OptionResult,
          SIBLING,
        ]}
        winnerId="opt-a"
        hasLeadingOption
        decisionState="robust"
        hinge={hinge as never}
      />,
    )
    const text = container.textContent ?? ''
    // The retired un-anchored superlative family — "highest ... likelihood"
    // names no basis and carries no number.
    expect(text).not.toMatch(/highest leading-option likelihood/i)
    // The re-anchored claim is present, with its magnitude, and still names
    // the hinge factor the variant exists to surface.
    expect(text).toMatch(/came out ahead in .+ of simulated scenarios/i)
    expect(text).toContain('Hiring rate')
  })
})

describe('The lens "unchanged" sentence must not assert a goal ranking that does not exist (F3)', () => {
  /**
   * The re-anchoring replaced the un-anchored noun "the overall
   * recommendation" with "the goal ranking above" in three lens sentences.
   * That is the right register — but it is UNCONDITIONAL, and on a run with
   * no success target there IS no goal ranking: ISL computes a goal
   * probability only against a threshold. The sentence then asserts the
   * existence of something the panel is simultaneously offering to unlock.
   *
   * This is my own no-target-branch rule (WinGauge, the ring, the V7 goal
   * lens all have one) not applied to these three strings.
   */
  const noGoal = [
    { ...WINNER_WITHOUT_WIN_PROB, winProbability: 0.66, goalProbability: null } as OptionResult,
    { ...SIBLING, winProbability: 0.34, goalProbability: null } as OptionResult,
  ]
  const withGoal = [
    { ...WINNER_WITHOUT_WIN_PROB, winProbability: 0.66, goalProbability: 0.8 } as OptionResult,
    { ...SIBLING, winProbability: 0.34, goalProbability: 0.2 } as OptionResult,
  ]

  it('OptionCards lens crown: no goal numbers ⇒ no goal-ranking claim', () => {
    const { container } = render(
      <OptionCards options={noGoal} winnerId="opt-a" hasLeadingOption lensActive lensHighlightedId="opt-a" />,
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain('goal ranking')
    // Over-suppression control: the lens sentence is still made.
    expect(text).toMatch(/Ahead on this outcome view/)
    expect(text).toMatch(/ranking above is unchanged/)
  })

  it('OptionCards lens crown: goal numbers present ⇒ the goal-ranking claim stands', () => {
    const { container } = render(
      <OptionCards options={withGoal} winnerId="opt-a" hasLeadingOption lensActive lensHighlightedId="opt-a" />,
    )
    expect(container.textContent ?? '').toContain('The goal ranking above is unchanged.')
  })
})
