/**
 * winnerChipCopy — unit tests (Brief 5.5 §2.7 lock).
 *
 * Covers the tier × stability copy contract via the shared
 * shouldSoftenPhrasing helper imported by winnerChipLabel.
 *
 * Softening gate (Brief 5.5 §2.7):
 *   Hedged copy ("What makes this best supported?") fires ONLY when BOTH:
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
    expect(winnerChipLabel(true, 'strong')).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'strong', 0.50)).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'strong', 0.95)).toBe('What makes this the best-supported option?')
  })

  it('returns the definitive copy for unknown tier regardless of stability', () => {
    expect(winnerChipLabel(true, 'unknown')).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'unknown', 0.50)).toBe('What makes this the best-supported option?')
  })

  it('returns the definitive copy when tier is undefined (defensive default)', () => {
    expect(winnerChipLabel(true, undefined)).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, undefined, 0.50)).toBe('What makes this the best-supported option?')
  })

  it('returns the definitive copy for fair tier when stability ≥ 0.85 (stability override)', () => {
    expect(winnerChipLabel(true, 'fair', 0.85)).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'fair', 0.95)).toBe('What makes this the best-supported option?')
  })

  it('returns the definitive copy for needs_work when stability ≥ 0.85 (stability override)', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.85)).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'needs_work', 0.90)).toBe('What makes this the best-supported option?')
    expect(winnerChipLabel(true, 'needs_work', 1.00)).toBe('What makes this the best-supported option?')
  })
})

// ---------------------------------------------------------------------------
// winnerChipLabel — winner copy (soft paths: tier × stability)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — winner copy (soft paths)', () => {
  it('returns the hedged copy for needs_work when stability is absent', () => {
    expect(winnerChipLabel(true, 'needs_work')).toBe('What makes this best supported?')
    expect(winnerChipLabel(true, 'needs_work', undefined)).toBe('What makes this best supported?')
  })

  it('returns the hedged copy for needs_work when stability < 0.85', () => {
    expect(winnerChipLabel(true, 'needs_work', 0.84)).toBe('What makes this best supported?')
    expect(winnerChipLabel(true, 'needs_work', 0.70)).toBe('What makes this best supported?')
    expect(winnerChipLabel(true, 'needs_work', 0.00)).toBe('What makes this best supported?')
  })

  it('returns the hedged copy for fair when stability is absent (new per Brief 5.5 §2.7)', () => {
    expect(winnerChipLabel(true, 'fair')).toBe('What makes this best supported?')
  })

  it('returns the hedged copy for fair when stability < 0.85 (new per Brief 5.5 §2.7)', () => {
    expect(winnerChipLabel(true, 'fair', 0.84)).toBe('What makes this best supported?')
    expect(winnerChipLabel(true, 'fair', 0.50)).toBe('What makes this best supported?')
  })
})

// ---------------------------------------------------------------------------
// winnerChipLabel — non-winner (tier-invariant, stability-invariant)
// ---------------------------------------------------------------------------

describe('winnerChipLabel — non-winner (always forward-looking)', () => {
  it.each(['strong', 'fair', 'needs_work', 'unknown', undefined] as const)(
    'returns the forward-looking copy regardless of tier (%s)',
    (tier) => {
      expect(winnerChipLabel(false, tier)).toBe('What would make this better supported?')
      expect(winnerChipLabel(false, tier, 0.50)).toBe('What would make this better supported?')
      expect(winnerChipLabel(false, tier, 0.95)).toBe('What would make this better supported?')
    },
  )
})

// ---------------------------------------------------------------------------
// winnerChipPrompt — tier-invariant label-embedding
// ---------------------------------------------------------------------------

describe('winnerChipPrompt', () => {
  it('builds a winner prompt that quotes the option label', () => {
    expect(winnerChipPrompt(true, 'Option A')).toBe(
      'What makes "Option A" the best-supported option? What are its key advantages?',
    )
  })

  it('builds a non-winner prompt that quotes the option label', () => {
    expect(winnerChipPrompt(false, 'Option B')).toBe(
      'What would make "Option B" better supported instead? What changes would be needed?',
    )
  })

  it('embeds label text verbatim (no escaping) — UI responsibility to sanitise upstream', () => {
    expect(winnerChipPrompt(true, 'Plan - v2')).toContain('"Plan - v2"')
    expect(winnerChipPrompt(false, 'Plan - v2')).toContain('"Plan - v2"')
  })
})

// ---------------------------------------------------------------------------
// Structural guards on the register itself (added 8 Sep 2026 with the
// no-contest re-frame of the definitive arm)
// ---------------------------------------------------------------------------

describe('winnerChipCopy — structural guards', () => {
  /**
   * ⛔ THE ANTI-COLLAPSE GUARD, and it is the reason this block exists.
   *
   * Every "definitive path" assertion above compares a returned string to a
   * literal. If a later edit gave both winner arms the SAME wording — which is
   * the tempting shape, because the two are near-synonyms — all 12 definitive
   * assertions AND all 7 hedged assertions would keep passing against a
   * function that had stopped consulting `shouldSoftenPhrasing` at all. The
   * softening gate (the 0.85 boundary, the stability override, the
   * tier membership) would be entirely untested, and the suite would read
   * green for the wrong reason.
   *
   * This is CLAUDE.md trap 13b: a guard whose discrimination depends on a fact
   * nothing pins. The fact is "the two arms are different strings", so it is
   * pinned here rather than left as a property of whatever wording is current.
   */
  it('keeps the two winner arms as DISTINCT strings, or the softening gate is untested', () => {
    const hedged = winnerChipLabel(true, 'needs_work', 0.5)
    const definitive = winnerChipLabel(true, 'strong', 0.95)
    expect(hedged).not.toBe(definitive)
  })

  /**
   * ⭐ THE LABEL AND THE MESSAGE ARE ONE VOICE — pinned because they came apart
   * once and nothing noticed.
   *
   * #1281 moved `winnerChipLabel`'s non-winner arm to "better supported" and
   * left `winnerChipPrompt`'s non-winner arm saying "lead instead", so the chip
   * offered one question and sent another. Both directions are asserted: the
   * winner pair share "the best-supported option", the non-winner pair share
   * "better supported". A future edit to either function alone REDs here.
   */
  it('the winner label and the winner prompt share their noun phrase', () => {
    expect(winnerChipLabel(true, 'strong', 0.95)).toContain('the best-supported option')
    expect(winnerChipPrompt(true, 'Option A')).toContain('the best-supported option')
  })

  it('the non-winner label and the non-winner prompt share their wording', () => {
    expect(winnerChipLabel(false, 'strong')).toContain('better supported')
    expect(winnerChipPrompt(false, 'Option B')).toContain('better supported')
  })

  /**
   * ⭐ THE RULING ITSELF, asserted over every reachable combination rather than
   * over the arms this session happened to change. Paul, on a ruling he notes
   * he has given numerous times: "There's never a winner."
   *
   * The enumeration is the full cross-product the two exported functions can
   * produce, so a SIXTH string added to either function is covered the day it
   * arrives — not the day someone remembers to extend a list.
   */
  it('no reachable chip string frames the decision as a contest', () => {
    const RACE = /\bwinners?\b|\bleaders?\b|\bleads?\b|\bahead\b|\bbeats?\b|\boutperform/i
    const tiers = ['strong', 'fair', 'needs_work', 'unknown', undefined] as const
    const strings: string[] = []
    for (const tier of tiers) {
      for (const stability of [undefined, 0.0, 0.84, 0.85, 0.95]) {
        for (const isWinner of [true, false]) {
          for (const hasLeadingOption of [true, false, undefined]) {
            strings.push(winnerChipLabel(isWinner, tier, stability, hasLeadingOption))
            strings.push(winnerChipPrompt(isWinner, 'Option A', hasLeadingOption))
          }
        }
      }
    }
    // Positive control on the corpus itself: an empty or tiny enumeration would
    // pass this test by testing almost nothing (CLAUDE.md trap 13).
    expect(strings.length).toBe(300)
    expect(new Set(strings).size).toBeGreaterThan(1)
    expect(strings.filter((s) => RACE.test(s))).toEqual([])
  })
})
