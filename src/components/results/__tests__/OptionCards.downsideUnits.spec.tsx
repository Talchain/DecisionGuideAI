/**
 * ROADMAP 2.580 member 4 — THE DOWNSIDE TAIL CARRIES ITS UNIT.
 *
 * Codex simulated-user review, 5 Aug 2026: "downside values were unitless even
 * when the user's goal was hours". Same report, same session: an explicit
 * 14-hour baseline "was stored as 'from brief' but displayed as a unitless
 * normalised range of `0.29–0.87`".
 *
 * WHERE THE UNIT COMES FROM (it is NOT in the analysis payload)
 * ------------------------------------------------------------
 * `@talchain/schemas@0.38.0` `EnrichmentOutcomeStats` carries no unit, and the
 * `downside` block is three bare numbers. The unit reaches the UI from the
 * GOAL NODE via `useResultsSectionData` (`outcomeUnit` / `outcomeUnitSymbol`),
 * which already threads it to `DriversSection` and `TornadoChart`
 * (`ResultsBody.tsx:693-694`, `:741-742`) and did NOT thread it to
 * `OptionCards`. That is the wiring this spec pins.
 *
 * THE BREADTH CASE, PINNED AS HARD AS THE HAPPY ONE (CLAUDE.md trap 22)
 * --------------------------------------------------------------------
 * On a run with no `goal_threshold_cap` the magnitudes stay on PLoT's
 * normalised 0–1 scale (`isNormalised === true`). Appending "hours" there
 * would swap a missing claim for a FALSE one. The `isNormalised` cases below
 * are therefore not edge-case garnish — they are the half of the member that a
 * careless fix gets wrong.
 *
 * RED-first: every unit assertion fails at bc997f50, where `OptionCards` has
 * no unit props at all.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

/** An option carrying a tail, on the goal's own scale. */
function optionWithTail(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: 'option-a',
    label: 'Option A',
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    p10: 20,
    p50: 50,
    p90: 80,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.7,
    rank: 1,
    downside: { p05: 12.4, cvar10: 9.8, expectedRegret: 3 },
    ...overrides,
  }
}

/** The downside sentence text for the leading option, by identity. */
function downsideText(id = 'option-a'): string {
  return screen.getByTestId(`option-downside-${id}`).textContent ?? ''
}

describe('OptionCards — downside tail states its unit (ROADMAP 2.580 member 4)', () => {
  it('renders an HOURS goal with the unit beside both tail magnitudes', () => {
    // `useResultsSectionData` classifies a free-text unit as `count` and passes
    // the raw string through as the symbol — an "hours" goal arrives exactly
    // like this. This is the reviewer's case.
    render(
      <OptionCards
        options={[optionWithTail()]}
        winnerId="option-a"
        expertMode
        outcomeUnit="count"
        outcomeUnitSymbol="hours"
        isNormalised={false}
      />,
    )

    const text = downsideText()
    expect(text).toContain('12.4 hours')
    expect(text).toContain('9.8 hours')
  })

  it('renders a CURRENCY goal with the symbol attached to the magnitude', () => {
    render(
      <OptionCards
        options={[optionWithTail({ downside: { p05: 1200, cvar10: 800, expectedRegret: 1 } })]}
        winnerId="option-a"
        expertMode
        outcomeUnit="currency"
        outcomeUnitSymbol="£"
        isNormalised={false}
      />,
    )

    const text = downsideText()
    expect(text).toContain('£1,200')
    expect(text).toContain('£800')
  })

  it('puts the minus sign OUTSIDE the currency symbol on a negative tail', () => {
    render(
      <OptionCards
        options={[optionWithTail({ downside: { p05: -1200, cvar10: -800, expectedRegret: 1 } })]}
        winnerId="option-a"
        expertMode
        outcomeUnit="currency"
        outcomeUnitSymbol="£"
        isNormalised={false}
      />,
    )

    const text = downsideText()
    expect(text).toContain('-£1,200')
    expect(text).not.toContain('£-1,200')
  })

  it('renders a PERCENT goal with a % suffix', () => {
    render(
      <OptionCards
        options={[optionWithTail({ downside: { p05: 12.4, cvar10: 9.8, expectedRegret: 1 } })]}
        winnerId="option-a"
        expertMode
        outcomeUnit="percent"
        isNormalised={false}
      />,
    )

    expect(downsideText()).toContain('12.4%')
  })

  it('DOES NOT attach the goal unit when the magnitudes are NORMALISED', () => {
    // The `0.29–0.87` state. Writing "0.29 hours" here would be a new false
    // claim, not a fix — the number is a normalised score, not hours.
    render(
      <OptionCards
        options={[optionWithTail({ downside: { p05: 0.29, cvar10: 0.21, expectedRegret: 0.1 } })]}
        winnerId="option-a"
        expertMode
        outcomeUnit="count"
        outcomeUnitSymbol="hours"
        isNormalised
      />,
    )

    const text = downsideText()
    expect(text).toContain('0.29')
    expect(text).not.toContain('hours')
  })

  it('DOES NOT attach a unit when the goal never stated one', () => {
    // Unchanged behaviour: the card prints exactly what it printed before.
    render(
      <OptionCards options={[optionWithTail()]} winnerId="option-a" expertMode />,
    )

    const text = downsideText()
    expect(text).toContain('12.4')
    expect(text).toContain('9.8')
    expect(text).not.toMatch(/hours|£|\$/)
  })

  it('binds the unit to the tail of the option it belongs to, not to any option with a tail', () => {
    // Trap 19: an assertion must bind by IDENTITY. Two options, different
    // tails — the runner-up's numbers must not satisfy the leader's assertion.
    render(
      <OptionCards
        options={[
          optionWithTail({ id: 'a', label: 'A', winProbability: 0.7, downside: { p05: 12.4, cvar10: 9.8, expectedRegret: 1 } }),
          optionWithTail({ id: 'b', label: 'B', winProbability: 0.3, isRecommended: false, downside: { p05: 44.4, cvar10: 41.1, expectedRegret: 1 } }),
        ]}
        winnerId="a"
        expertMode
        outcomeUnit="count"
        outcomeUnitSymbol="hours"
        isNormalised={false}
      />,
    )

    expect(downsideText('a')).toContain('12.4 hours')
    expect(downsideText('a')).not.toContain('44.4')
    expect(downsideText('b')).toContain('44.4 hours')
    expect(downsideText('b')).not.toContain('12.4')
  })
})
