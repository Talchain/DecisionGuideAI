/**
 * Brief 5.8B D8 — post-analysis footer status + meta derivation.
 *
 * Pure helper underpinning the AnalysisFooter call inside OutputsDock.
 * Covers all four stability bands + the evidence-gap meta cases.
 */

import { describe, it, expect } from 'vitest'
import { derivePostFooterStatus, derivePostFooterMeta } from '../postAnalysisFooter'

describe('derivePostFooterStatus — display-safe verdict only (robustness trust fix)', () => {
  // Single-source rule (ROBUSTNESS-VERDICT-CONTRACT): the footer verdict comes
  // ONLY from the display-safe `robustnessVerdict`, never from raw
  // recommendation_stability. So the helper now takes the verdict, not a number.

  it('verdict "high" → success "Stable result" (the ONLY path to a positive verdict)', () => {
    expect(derivePostFooterStatus('high')).toEqual({
      icon: 'check',
      iconClass: 'text-success',
      label: 'Stable result',
    })
  })

  it('verdict "moderate" | "low" | "very_low" → warning "Sensitive to assumptions"', () => {
    for (const v of ['moderate', 'low', 'very_low'] as const) {
      expect(derivePostFooterStatus(v)).toEqual({
        icon: 'warning',
        iconClass: 'text-warning',
        label: 'Sensitive to assumptions',
      })
    }
  })

  it('undefined / null verdict → neutral "Robustness unknown" (matches the certified glyph)', () => {
    for (const v of [undefined, null] as const) {
      expect(derivePostFooterStatus(v)).toEqual({
        icon: 'unknown',
        iconClass: 'text-text-light',
        label: 'Robustness unknown',
      })
    }
  })

  it('trust fix: an ABSENT display-safe verdict never renders "Stable result" nor a green/check positive icon', () => {
    // This is the live-contract case today (robustnessVerdict is always
    // undefined). Previously raw stability ≥ 0.85 rendered a green "Stable
    // result" that contradicted the neutral robustness glyph.
    const status = derivePostFooterStatus(undefined)
    expect(status.label).not.toBe('Stable result')
    expect(status.icon).not.toBe('check')
    expect(status.iconClass).not.toContain('success')
    expect(status.label).toBe('Robustness unknown')
  })
})

describe('derivePostFooterMeta (Brief 5.8B D8)', () => {
  it('renders "{N}% stability · Evidence strong" when no review-card is weak', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        reviewCards: [{ confidence: 70 }, { confidence: 90 }],
      }),
    ).toBe('82% stability · Evidence strong')
  })

  it('renders "{N}% stability · Evidence gaps remain" when any review-card confidence < 50', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.6,
        reviewCards: [{ confidence: 40 }, { confidence: 80 }],
      }),
    ).toBe('60% stability · Evidence gaps remain')
  })

  it('omits the evidence segment entirely when there are no review cards', () => {
    expect(
      derivePostFooterMeta({ stability: 0.91, reviewCards: [] }),
    ).toBe('91% stability')
  })

  it('omits the stability segment when stability is missing', () => {
    expect(
      derivePostFooterMeta({
        stability: undefined,
        reviewCards: [{ confidence: 30 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when both stability and review-cards are absent', () => {
    expect(
      derivePostFooterMeta({ stability: null, reviewCards: [] }),
    ).toBeNull()
  })

  it('treats non-numeric review-card confidence as ok (no false "Evidence gaps remain")', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.95,
        reviewCards: [{ confidence: undefined }, { confidence: null }],
      }),
    ).toBe('95% stability · Evidence strong')
  })
})
