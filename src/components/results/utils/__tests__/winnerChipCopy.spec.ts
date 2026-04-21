/**
 * winnerChipCopy — unit tests (Brief 5.4 Phase 7, updated QA Item 4).
 *
 * Covers the tier-driven copy contract in isolation from OptionCards.
 *
 * Hedging contract (Brief 5.4 QA Item 4 — stability gate):
 *   Hedged copy ("What makes this the current leader?") fires ONLY when
 *   BOTH conditions hold simultaneously:
 *     1. confidenceTier === 'needs_work'   (evidenceIsWeak)
 *     2. recommendationStability < 0.85    (stabilityIsWeak — null/undefined counts as weak)
 *
 *   All other tier values (strong / fair / unknown / undefined) are
 *   tier-invariant: they always return the definitive copy regardless of
 *   stability, because they do not meet the evidence-weak condition.
 *
 *   'fair' is deliberately definitive — a fair-tier result with a numeric
 *   win lead should not hedge; hedging only when evidence quality is
 *   specifically flagged as limited.
 *
 * Non-winner chip is always forward-looking and tier-invariant.
 * Prompt copy embeds the option label verbatim and is tier-invariant.
 *
 * Complements OptionCards.brief-5_1.spec.tsx (integration).
 */

import { describe, it, expect } from 'vitest'
import { winnerChipLabel, winnerChipPrompt } from '../winnerChipCopy'

// ---------------------------------------------------------------------------
// winnerChipLabel — winner copy (definitive tiers)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — winner copy (definitive tiers)', () => {
  it('returns the definitive copy for strong tier (any stability)', () => {
    expect(winnerChipLabel(true, 'strong')).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'strong', 0.50)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'strong', 0.95)).toBe('What makes this lead?')
  })

  it('returns the definitive copy for fair tier (any stability)', () => {
    expect(winnerChipLabel(true, 'fair')).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'fair', 0.50)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'fair', 0.95)).toBe('What makes this lead?')
  })

  it('returns the definitive copy for unknown tier (any stability)', () => {
    expect(winnerChipLabel(true, 'unknown')).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'unknown', 0.50)).toBe('What makes this lead?')
  })

  it('returns the definitive copy when tier is undefined (defensive default)', () => {
    expect(winnerChipLabel(true, undefined)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, undefined, 0.50)).toBe('What makes this lead?')
  })
})

// ---------------------------------------------------------------------------
// winnerChipLabel — needs_work tier (stability-gated)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — winner copy (needs_work tier, stability gate)', () => {
  it('returns the hedged copy when needs_work and stability is absent (null/undefined → weak)', () => {
    expect(winnerChipLabel(true, 'needs_work')).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', undefined)).toBe('What makes this the current leader?')
  })

  it('returns the hedged copy when needs_work and stability < 0.85', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.84)).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', 0.70)).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', 0.00)).toBe('What makes this the current leader?')
  })

  it('returns the definitive copy when needs_work but stability >= 0.85 (evidence weak; result stable)', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.85)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'needs_work', 0.90)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'needs_work', 1.00)).toBe('What makes this lead?')
  })
})

// ---------------------------------------------------------------------------
// winnerChipLabel — non-winner (tier-invariant, stability-invariant)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — non-winner (always forward-looking)', () => {
  it.each(['strong', 'fair', 'needs_work', 'unknown', undefined] as const)(
    'returns the forward-looking copy regardless of tier (%s)',
    (tier) => {
      expect(winnerChipLabel(false, tier)).toBe('What would make this lead?')
      expect(winnerChipLabel(false, tier, 0.50)).toBe('What would make this lead?')
      expect(winnerChipLabel(false, tier, 0.95)).toBe('What would make this lead?')
    },
  )
})

// ---------------------------------------------------------------------------
// winnerChipPrompt — tier-invariant label-embedding
// ---------------------------------------------------------------------------

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
