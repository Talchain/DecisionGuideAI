/**
 * ROADMAP 2.449 — DOWNSIDE / TAIL-RISK SURFACE on the option card.
 *
 * THE CAPABILITY. Olumi could tell a user which option leads and how robust
 * that is, but not "and if this goes badly, how badly?" — even though ISL has
 * computed the answer since #91/#92. This suite is the user-visible end of
 * that train: PLoT now carries `option_comparison[].downside`, the V5 mapper
 * and the Results hook carry it through, and these are the sentences a reader
 * actually gets.
 *
 * WHAT IS PINNED HERE, and why each pin exists rather than being obvious:
 *
 *  1. THE NUMBERS APPEAR, BOUND TO THE OPTION THEY DESCRIBE. Assertions select
 *     the card by its `data-testid` (option id) and re-assert the exact label,
 *     and the sibling option carries DELIBERATELY DIFFERENT tail values — so no
 *     assertion can be satisfied by the wrong card (trap 19: a spec that finds
 *     an object by a value predicate passes on whichever object happens to
 *     satisfy it).
 *
 *  2. THE MEANING TRAVELS WITH THE NUMBER. A bare figure is not the product's
 *     standard. Producer jargon — "CVaR", "expected shortfall", "percentile" —
 *     must never reach the reader.
 *
 *  3. THE UN-RATIFIED TAIL CUT-OFF IS DISCLOSED. ISL marks the 0.10 tail mass
 *     `DOCTRINE-PENDING(Neil)`. A surface that renders the number without
 *     saying the cut-off is unsettled is making a claim we have not earned, so
 *     the caveat is asserted to travel with the magnitudes — not merely to
 *     exist somewhere in the DOM.
 *
 *  4. ABSENCE IS BLANK — never a zero. This is the failure this whole feature
 *     family has shipped repeatedly, most recently a "defensive" 0.0 in the
 *     regret statistic that collapsed the whole-decision EVPI bound. A zero in
 *     a downside statistic does not read as "unknown"; it reads as "there is
 *     no downside".
 *
 *  5. POSITIVE CONTROL, BOTH DIRECTIONS. Every absence assertion here renders
 *     in a tree where a SIBLING card carries the surface, so the harness is
 *     demonstrably able to see the thing it claims is missing (trap 13). And
 *     every presence assertion is paired with an absence arm, so it cannot be
 *     passing on a permanently-rendered element.
 *
 *  6. `expectedRegret` IS CARRIED AND NOT DISPLAYED. It is the per-option limb
 *     of the value-of-information family (whole-decision EVPI is exactly its
 *     minimum across options), and the estate's no-EVPI-display doctrine
 *     licenses a ranking with NO magnitudes for that family. Rendering it is a
 *     doctrine ruling; this suite pins that the ruling has not been quietly
 *     taken by a render site.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'
import {
  DOWNSIDE_HEADING_COPY,
  DOWNSIDE_TAIL_CAVEAT_COPY,
} from '../utils/downsideCopy'

const HEDGE_ID = 'opt_hedge'
const HEDGE_LABEL = 'Hedge and stage the rollout'
const BOLD_ID = 'opt_bold'
const BOLD_LABEL = 'Go big in one step'

/**
 * The two options carry DIFFERENT tail values on purpose. Every magnitude
 * asserted below is unique to one card, so a render that put the right numbers
 * on the wrong card fails here rather than in front of a user.
 */
const HEDGE_DOWNSIDE = { cvar10: 12, p05: 18, expectedRegret: 4 }
const BOLD_DOWNSIDE = { cvar10: -37, p05: -21, expectedRegret: 19 }

function makeOption(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: HEDGE_ID,
    label: HEDGE_LABEL,
    expected: 50,
    outcome: { mean: 50, p10: 20, p50: 50, p90: 80 },
    p10: 20,
    p50: 50,
    p90: 80,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.7,
    nValidSamples: 1000,
    rank: 1,
    ...overrides,
  }
}

/** Both cards, downside present on both unless overridden. */
function twoOptions(
  hedge: Partial<OptionResult> = {},
  bold: Partial<OptionResult> = {},
): OptionResult[] {
  return [
    makeOption({ id: HEDGE_ID, label: HEDGE_LABEL, downside: { ...HEDGE_DOWNSIDE }, ...hedge }),
    makeOption({
      id: BOLD_ID,
      label: BOLD_LABEL,
      isRecommended: false,
      rank: 2,
      winProbability: 0.35,
      downside: { ...BOLD_DOWNSIDE },
      ...bold,
    }),
  ]
}

/**
 * Select a CARD by identity: the option id addresses it, and the visible label
 * is re-asserted so a card carrying the right numbers under the wrong identity
 * cannot satisfy anything below.
 */
function cardByIdentity(optionId: string, optionLabel: string): HTMLElement {
  const card = screen.getByTestId(`option-card-${optionId}`)
  expect(card.textContent, `identity: card ${optionId} must show "${optionLabel}"`).toContain(
    optionLabel,
  )
  return card
}

describe('2.449 — option card downside/tail-risk surface', () => {
  // =========================================================================
  // 1 — the numbers reach the reader, on the right card
  // =========================================================================

  it('shows EACH option its OWN tail numbers, with the meaning attached', () => {
    render(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)

    const hedge = within(cardByIdentity(HEDGE_ID, HEDGE_LABEL)).getByTestId(
      `option-downside-${HEDGE_ID}`,
    )
    const bold = within(cardByIdentity(BOLD_ID, BOLD_LABEL)).getByTestId(
      `option-downside-${BOLD_ID}`,
    )

    // The magnitudes, each on its own card and nowhere else.
    expect(hedge.textContent).toContain('18')
    expect(hedge.textContent).toContain('12')
    expect(bold.textContent).toContain('-21')
    expect(bold.textContent).toContain('-37')
    // Cross-check the binding explicitly: neither card carries the other's
    // numbers. Without this, "contains 18" would still pass if both cards
    // rendered the same block.
    expect(hedge.textContent).not.toContain('-37')
    expect(bold.textContent).not.toContain('18')

    // MEANING ATTACHED — the frequency framing, not a bare figure.
    expect(hedge.textContent).toContain(DOWNSIDE_HEADING_COPY)
    expect(hedge.textContent).toMatch(/worst 1 in 20 simulated runs/i)
    expect(hedge.textContent).toMatch(/worst 1 in 10 average/i)
  })

  it('never puts producer jargon in front of the reader', () => {
    render(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)
    const surface = screen.getByTestId(`option-downside-${HEDGE_ID}`).textContent ?? ''
    // POSITIVE CONTROL for this assertion: the surface is non-empty and
    // carries a number, so "contains no jargon" is not passing on empty text.
    expect(surface.length).toBeGreaterThan(0)
    expect(surface).toMatch(/\d/)
    for (const banned of [
      'CVaR',
      'cvar',
      'conditional value at risk',
      'expected shortfall',
      'percentile',
      'p05',
      'expected_regret',
      'EVPI',
      'tail mass',
      'Monte Carlo',
    ]) {
      expect(surface.toLowerCase()).not.toContain(banned.toLowerCase())
    }
  })

  // =========================================================================
  // 2 — the un-ratified cut-off is disclosed WITH the numbers
  // =========================================================================

  it('ships the unsettled-cut-off caveat on the same card as the numbers', () => {
    render(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)

    const card = cardByIdentity(HEDGE_ID, HEDGE_LABEL)
    const caveat = within(card).getByTestId(`option-downside-caveat-${HEDGE_ID}`)
    expect(caveat.textContent).toBe(DOWNSIDE_TAIL_CAVEAT_COPY)
    // It must not read as settled practice.
    expect(caveat.textContent).toMatch(/not settled|working choice/i)
    // And it must travel WITH the magnitudes — a caveat rendered on a card
    // that shows no number is decoration, and a number on a card that shows
    // no caveat is the claim we have not earned.
    expect(within(card).getByTestId(`option-downside-${HEDGE_ID}`).textContent).toMatch(/\d/)
  })

  it('POSITIVE CONTROL — the caveat is absent exactly when the numbers are', () => {
    // Hedge keeps its block; bold has none. If the caveat were rendered
    // unconditionally, the second assertion would fail — which is what makes
    // the first assertion meaningful.
    render(
      <OptionCards options={twoOptions({}, { downside: undefined })} winnerId={HEDGE_ID} expertMode />,
    )
    expect(screen.getByTestId(`option-downside-caveat-${HEDGE_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`option-downside-caveat-${BOLD_ID}`)).toBeNull()
  })

  // =========================================================================
  // 3 — HONEST ABSENCE: blank, never a zero
  // =========================================================================

  it('renders NOTHING for an option with no downside — no zero, no placeholder', () => {
    render(
      <OptionCards options={twoOptions({}, { downside: undefined })} winnerId={HEDGE_ID} expertMode />,
    )

    // PRECONDITION PIN + POSITIVE CONTROL: the sibling DOES render the
    // surface, so this harness is demonstrably able to see it. Without this,
    // "queryByTestId is null" would also pass if the whole feature were gone.
    expect(screen.getByTestId(`option-downside-${HEDGE_ID}`)).toBeInTheDocument()

    const boldCard = cardByIdentity(BOLD_ID, BOLD_LABEL)
    expect(within(boldCard).queryByTestId(`option-downside-${BOLD_ID}`)).toBeNull()
    // No fabricated stand-in of any kind on the card that has no data.
    expect(boldCard.textContent).not.toContain(DOWNSIDE_HEADING_COPY)
    expect(boldCard.textContent).not.toMatch(/worst 1 in 20/i)
    expect(boldCard.textContent).not.toMatch(/not available|no downside|n\/a/i)
  })

  it('renders a GENUINE negative tail as itself — a measured value, not a floor', () => {
    // The bold option's tail is negative: the reader must see that the worst
    // runs lose value, not a clamped 0.
    render(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)
    const bold = screen.getByTestId(`option-downside-${BOLD_ID}`)
    expect(bold.textContent).toContain('-37')
    expect(bold.textContent).not.toMatch(/\b0\b(?!\.)/)
  })

  // =========================================================================
  // 4 — expected_regret is carried but NOT displayed (doctrine)
  // =========================================================================

  it('does NOT render the regret magnitude — value-of-information doctrine', () => {
    // Values chosen so a leaked regret magnitude is unmistakable: 4 and 19
    // appear nowhere else in these fixtures' rendered tail text.
    render(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)

    const hedge = screen.getByTestId(`option-downside-${HEDGE_ID}`)
    const bold = screen.getByTestId(`option-downside-${BOLD_ID}`)

    // POSITIVE CONTROL first: the surface is rendering numbers at all, so the
    // absence below is about THIS number and not about an empty element.
    expect(hedge.textContent).toContain('18')
    expect(bold.textContent).toContain('-37')

    expect(hedge.textContent).not.toMatch(/\b4\b/)
    expect(bold.textContent).not.toMatch(/\b19\b/)
    // And no prose that would make the "worth X" claim by another route.
    expect(hedge.textContent).not.toMatch(/worth|perfect information|regret/i)
  })

  // =========================================================================
  // 5 — progressive disclosure (P5): depth only where depth was asked for
  // =========================================================================

  it('is expert-mode only — the default card is unchanged', () => {
    const { rerender } = render(
      <OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode={false} />,
    )
    expect(screen.queryByTestId(`option-downside-${HEDGE_ID}`)).toBeNull()

    // POSITIVE CONTROL: the SAME options in expert mode do render it, so the
    // assertion above is about the mode and not about missing data.
    rerender(<OptionCards options={twoOptions()} winnerId={HEDGE_ID} expertMode />)
    expect(screen.getByTestId(`option-downside-${HEDGE_ID}`)).toBeInTheDocument()
  })
})
