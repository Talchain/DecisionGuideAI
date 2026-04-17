/**
 * ConditionalWinnerCards — direction logic
 *
 * Verifies the "exceeds" vs "falls below" copy derivation against the
 * recommended option label:
 *   - recommended sits in low_bucket  → flip happens on the HIGH side → "exceeds {split}, {high.winner} leads instead"
 *   - recommended sits in high_bucket → flip happens on the LOW side  → "falls below {split}, {low.winner} leads instead"
 *   - recommended label missing       → defaults to "exceeds" / high_bucket.winner_label (safe, monotone assumption)
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
  high_bucket: { winner_label: 'Expand into Europe', win_probability: 0.7 },
  low_bucket: { winner_label: 'Consolidate current market', win_probability: 0.6 },
  ...overrides,
})

describe('ConditionalWinnerCards — direction derivation', () => {
  it('renders "exceeds" + high-bucket winner when recommended sits in low_bucket', () => {
    render(
      <ConditionalWinnerCards
        winners={[makeWinner()]}
        recommendedLabel="Consolidate current market"
      />,
    )
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/exceeds/i)
    expect(body.textContent).not.toMatch(/falls below/i)
    // The "leads instead" target should be the high-bucket winner (the alternative)
    expect(body.textContent).toMatch(/Expand into Europe/)
  })

  it('renders "falls below" + low-bucket winner when recommended sits in high_bucket', () => {
    render(
      <ConditionalWinnerCards
        winners={[makeWinner()]}
        recommendedLabel="Expand into Europe"
      />,
    )
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/falls below/i)
    expect(body.textContent).not.toMatch(/exceeds/i)
    // The "leads instead" target should be the low-bucket winner (the alternative)
    expect(body.textContent).toMatch(/Consolidate current market/)
  })

  it('defaults to "exceeds" + high-bucket winner when recommendedLabel is omitted', () => {
    render(<ConditionalWinnerCards winners={[makeWinner()]} />)
    const body = screen.getByTestId('conditional-winner-cards')
    expect(body.textContent).toMatch(/exceeds/i)
    expect(body.textContent).toMatch(/Expand into Europe/)
  })

  it('filters out entries where both buckets share the same winner', () => {
    const nonFlip = makeWinner({
      high_bucket: { winner_label: 'Same option', win_probability: 0.6 },
      low_bucket: { winner_label: 'Same option', win_probability: 0.55 },
    })
    const { container } = render(
      <ConditionalWinnerCards
        winners={[nonFlip]}
        recommendedLabel="Same option"
      />,
    )
    // No card, no container div — the component returns null
    expect(container.querySelector('[data-testid="conditional-winner-cards"]')).toBeNull()
  })
})
