/**
 * ⛔ THE CONDITIONAL-SCENARIO CARD PRINTED `split_unit` RAW: "flips at 0.5binary".
 *
 * `ConditionalWinnerCards` builds its threshold as
 * `${split_value}${split_unit ?? ''}` with no filter. `split_unit` is ISL's
 * `node.observed_state.unit` (`robustness_analyzer_v2.py:6086-6090`, ISL
 * `staging` `c00f5077`) — a field that can carry the factor-TYPE descriptor
 * "binary", not a unit. PLoT passes it through untouched and so does
 * `useResultsSectionData`. The Reasoning tab's split insight was fixed for the
 * same field on this branch (`anInternalTypeIsNeverAUnit.spec.tsx`,
 * `buildKeyInsights`); this card is the sibling surface that still printed it.
 *
 * The rule is the owner's (`isSuppressedUnit`, `canvas/utils/labelUtils.ts`): a
 * suppressed descriptor takes the unit-less form an absent unit already has.
 *
 * ⭐ BOTH ARMS. The neutral arm ("Which option leads depends on …") and the
 * directional arm ("When … exceeds …") each interpolate the same threshold.
 *
 * ⭐ THE CONTRAST: a fix that dropped every `split_unit` would pass the binary
 * half, so a real unit ('£') must still reach the card. This pins that the unit
 * PRINTS, not where it sits — placement is not this fix.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import type { ConditionalWinner } from '../types'

const BINARY = /binary/i

const row = (splitUnit: string | undefined): ConditionalWinner => ({
  factor_label: 'Enterprise tier availability',
  factor_id: 'n_enterprise',
  split_value: 0.5,
  split_unit: splitUnit,
  winner_flips: true,
  high_bucket: { winner_id: 'opt_raise', winner_label: 'Raise price', win_probability: 0.6 },
  low_bucket: { winner_id: 'opt_hold', winner_label: 'Hold price', win_probability: 0.4 },
})

/** The card's own sentence, by the arm the component says it rendered. */
function renderCard(splitUnit: string | undefined, recommendedOptionId?: string) {
  render(<ConditionalWinnerCards winners={[row(splitUnit)]} recommendedOptionId={recommendedOptionId} />)
  const body = screen.getByTestId('conditional-winner-cards')
  const card = body.querySelector('[data-cw-arm]')
  expect(card, 'precondition: the scenario card is rendered at all').not.toBeNull()
  const sentence = card!.querySelector('p')?.textContent ?? ''
  expect(sentence, 'precondition: the threshold sentence names the factor').toContain(
    'Enterprise tier availability',
  )
  return { arm: card!.getAttribute('data-cw-arm'), sentence, text: body.textContent ?? '' }
}

afterEach(cleanup)

describe('ConditionalWinnerCards — a factor-type descriptor is never a unit', () => {
  it('⛔ neutral arm: a binary-typed split states the value, never "binary"', () => {
    const { arm, sentence, text } = renderCard('binary')
    expect(arm).toBe('neutral')
    expect(text).not.toMatch(BINARY)
    // By identity: exactly the sentence an absent unit yields.
    expect(sentence).toBe(
      'Which option leads depends on Enterprise tier availability — the analysis flips at 0.5.',
    )
  })

  it('⛔ directional arm: the same rule', () => {
    // recommended id in the LOW bucket -> the flip is on the HIGH side.
    const { arm, sentence, text } = renderCard('binary', 'opt_hold')
    expect(arm).toBe('high-alt')
    expect(text).not.toMatch(BINARY)
    expect(sentence).toBe('When Enterprise tier availability exceeds 0.5, Raise price leads instead.')
  })

  it('⛔ the descriptor is suppressed whatever its case', () => {
    expect(renderCard('Binary').text).not.toMatch(BINARY)
  })

  it('⭐ CONTRAST: a real unit still prints, on both arms', () => {
    const neutral = renderCard('£')
    expect(neutral.arm).toBe('neutral')
    expect(neutral.sentence).toContain('£')
    cleanup()
    const directional = renderCard('£', 'opt_hold')
    expect(directional.arm).toBe('high-alt')
    expect(directional.sentence).toContain('£')
    expect(directional.sentence).toContain('Raise price leads instead')
  })
})
