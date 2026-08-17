/**
 * ConditionalWinnerCards — direction logic
 *
 * Verifies the "exceeds" vs "falls below" copy derivation against the
 * backend's recommended option IDENTITY (`recommendedOptionId` =
 * `report.robustness.recommended_option_id`), bound to bucket `winner_id`:
 *   - recommended id sits in low_bucket  → flip happens on the HIGH side → "exceeds {split}, {high.winner} leads instead"
 *   - recommended id sits in high_bucket → flip happens on the LOW side  → "falls below {split}, {low.winner} leads instead"
 *   - recommended id missing (or matching neither bucket) → the NEUTRAL
 *     two-sided arm — never a guessed direction (the pre-slice behaviour
 *     guessed "exceeds", which asserted a direction the producer never gave).
 *
 * Scenarios are the rows the producer attested with `winner_flips: true`;
 * label comparison decides nothing (see ConditionalWinnerCards.honesty.spec
 * for the same-label-flip and label-churn discriminators).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import type { ConditionalWinner } from '../types'

const makeWinner = (overrides: Partial<ConditionalWinner> = {}): ConditionalWinner => ({
  factor_label: 'Market size',
  factor_id: 'fac_market_size',
  split_value: 1000000,
  split_unit: undefined,
  winner_flips: true,
  high_bucket: { winner_id: 'opt_expand', winner_label: 'Expand into Europe', win_probability: 0.7 },
  low_bucket: { winner_id: 'opt_consolidate', winner_label: 'Consolidate current market', win_probability: 0.6 },
  ...overrides,
})

describe('ConditionalWinnerCards — direction derivation (ID-bound)', () => {
  it('renders "exceeds" + high-bucket winner when the recommended id sits in low_bucket', () => {
    render(
      <ConditionalWinnerCards
        winners={[makeWinner()]}
        recommendedOptionId="opt_consolidate"
      />,
    )
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/exceeds/i)
    expect(body.textContent).not.toMatch(/falls below/i)
    // The "leads instead" target should be the high-bucket winner (the alternative)
    expect(body.textContent).toMatch(/Expand into Europe leads instead/)
  })

  it('renders "falls below" + low-bucket winner when the recommended id sits in high_bucket', () => {
    render(
      <ConditionalWinnerCards
        winners={[makeWinner()]}
        recommendedOptionId="opt_expand"
      />,
    )
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/falls below/i)
    expect(body.textContent).not.toMatch(/exceeds/i)
    // The "leads instead" target should be the low-bucket winner (the alternative)
    expect(body.textContent).toMatch(/Consolidate current market leads instead/)
  })

  it('renders the neutral two-sided arm when recommendedOptionId is omitted — never a guessed direction', () => {
    render(<ConditionalWinnerCards winners={[makeWinner()]} />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/Which option leads depends on/)
    expect(body.textContent).not.toMatch(/exceeds/i)
    expect(body.textContent).not.toMatch(/falls below/i)
    expect(body.textContent).not.toMatch(/leads instead/i)
  })

  it('filters out rows the producer did not attest as flips (winner_flips false)', () => {
    const nonFlip = makeWinner({
      winner_flips: false,
      high_bucket: { winner_id: 'opt_same', winner_label: 'Same option', win_probability: 0.6 },
      low_bucket: { winner_id: 'opt_same', winner_label: 'Same option', win_probability: 0.55 },
    })
    const { container } = render(
      <ConditionalWinnerCards
        winners={[nonFlip]}
        recommendedOptionId="opt_same"
      />,
    )
    // No card, no container div — the component returns null
    expect(container.querySelector('[data-testid="conditional-winner-cards"]')).toBeNull()
  })
})
