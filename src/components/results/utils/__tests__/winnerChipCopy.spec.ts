/**
 * winnerChipCopy — unit tests (Brief 5.4 Phase 7).
 *
 * Covers the tier-driven copy contract in isolation from OptionCards:
 *   - Winner chip hedges for every non-strong tier (fair / needs_work / unknown / undefined).
 *   - Non-winner chip is tier-invariant ("What would make this lead?").
 *   - Prompt copy embeds the option label verbatim and is tier-invariant.
 *
 * Complements OptionCards.brief-5_1.spec.tsx (integration): that file verifies
 * the rendered chip; this file pins down the pure-function contract so a
 * regression in the helper is caught before it reaches the component tests.
 */

import { describe, it, expect } from 'vitest'
import { winnerChipLabel, winnerChipPrompt } from '../winnerChipCopy'

describe('winnerChipLabel — winner (tier-driven)', () => {
  it('returns the definitive copy for strong tier', () => {
    expect(winnerChipLabel(true, 'strong')).toBe('What makes this lead?')
  })

  it.each(['fair', 'needs_work', 'unknown'] as const)(
    'returns the hedged copy for %s tier',
    (tier) => {
      expect(winnerChipLabel(true, tier)).toBe('What makes this the current leader?')
    },
  )

  it('returns the hedged copy when tier is undefined (defensive default)', () => {
    expect(winnerChipLabel(true, undefined)).toBe('What makes this the current leader?')
  })
})

describe('winnerChipLabel — non-winner (tier-invariant)', () => {
  it.each(['strong', 'fair', 'needs_work', 'unknown', undefined] as const)(
    'returns the forward-looking copy regardless of tier (%s)',
    (tier) => {
      expect(winnerChipLabel(false, tier)).toBe('What would make this lead?')
    },
  )
})

describe('winnerChipPrompt', () => {
  it('builds a winner prompt that quotes the option label', () => {
    expect(winnerChipPrompt(true, 'Option A')).toBe(
      'What makes "Option A" the leading option? What are its key advantages?',
    )
  })

  it('builds a non-winner prompt that quotes the option label', () => {
    expect(winnerChipPrompt(false, 'Option B')).toBe(
      'What would make "Option B" lead instead? What changes would be needed?',
    )
  })

  it('embeds label text verbatim (no escaping) — UI responsibility to sanitise upstream', () => {
    expect(winnerChipPrompt(true, 'Plan — v2')).toContain('"Plan — v2"')
    expect(winnerChipPrompt(false, 'Plan — v2')).toContain('"Plan — v2"')
  })
})
