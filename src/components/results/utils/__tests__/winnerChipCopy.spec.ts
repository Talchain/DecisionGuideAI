/**
 * winnerChipCopy — unit tests (Brief 5.5 §2.7 lock).
 *
 * Covers the tier × stability copy contract via the shared
 * shouldSoftenPhrasing helper imported by winnerChipLabel.
 *
 * Softening gate (Brief 5.5 §2.7):
 *   Hedged copy ("What makes this the current leader?") fires ONLY when BOTH:
 *     1. confidenceTier ∈ {'needs_work', 'fair'}
 *     2. recommendationStability < 0.85  (null/undefined treated as weak)
 *   coachingReadiness is NOT a softening trigger (spec correction — the
 *   Brief 5.4 version could soften a strong tier via weak readiness; the
 *   corrected spec disallows that).
 *
 * All strong / unknown / undefined tiers, and fair / needs_work with
 * stability ≥ 0.85, render the definitive copy.
 *
 * Non-winner chip is always forward-looking and tier-invariant.
 * Prompt copy embeds the option label verbatim and is tier-invariant.
 *
 * Complements OptionCards.brief-5_1.spec.tsx (integration).
 */

import { describe, it, expect } from 'vitest'
import { winnerChipLabel, winnerChipPrompt } from '../winnerChipCopy'

// ---------------------------------------------------------------------------
// winnerChipLabel — winner copy (definitive paths)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — winner copy (definitive paths)', () => {
  it('returns the definitive copy for strong tier regardless of stability', () => {
    expect(winnerChipLabel(true, 'strong')).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'strong', 0.50)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'strong', 0.95)).toBe('What makes this lead?')
  })

  it('returns the definitive copy for unknown tier regardless of stability', () => {
    expect(winnerChipLabel(true, 'unknown')).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'unknown', 0.50)).toBe('What makes this lead?')
  })

  it('returns the definitive copy when tier is undefined (defensive default)', () => {
    expect(winnerChipLabel(true, undefined)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, undefined, 0.50)).toBe('What makes this lead?')
  })

  it('returns the definitive copy for fair tier when stability ≥ 0.85 (stability override)', () => {
    expect(winnerChipLabel(true, 'fair', 0.85)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'fair', 0.95)).toBe('What makes this lead?')
  })

  it('returns the definitive copy for needs_work when stability ≥ 0.85 (stability override)', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.85)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'needs_work', 0.90)).toBe('What makes this lead?')
    expect(winnerChipLabel(true, 'needs_work', 1.00)).toBe('What makes this lead?')
  })
})

// ---------------------------------------------------------------------------
// winnerChipLabel — winner copy (soft paths: tier × stability)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — winner copy (soft paths)', () => {
  it('returns the hedged copy for needs_work when stability is absent', () => {
    expect(winnerChipLabel(true, 'needs_work')).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', undefined)).toBe('What makes this the current leader?')
  })

  it('returns the hedged copy for needs_work when stability < 0.85', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.84)).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', 0.70)).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'needs_work', 0.00)).toBe('What makes this the current leader?')
  })

  it('returns the hedged copy for fair when stability is absent (new per Brief 5.5 §2.7)', () => {
    expect(winnerChipLabel(true, 'fair')).toBe('What makes this the current leader?')
  })

  it('returns the hedged copy for fair when stability < 0.85 (new per Brief 5.5 §2.7)', () => {
    expect(winnerChipLabel(true, 'fair', 0.84)).toBe('What makes this the current leader?')
    expect(winnerChipLabel(true, 'fair', 0.50)).toBe('What makes this the current leader?')
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
    expect(winnerChipPrompt(true, 'Plan - v2')).toContain('"Plan - v2"')
    expect(winnerChipPrompt(false, 'Plan - v2')).toContain('"Plan - v2"')
  })
})
