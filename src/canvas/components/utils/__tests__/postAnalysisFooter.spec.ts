/**
 * Brief 5.8B D8 — post-analysis footer status + meta derivation.
 *
 * Pure helper underpinning the AnalysisFooter call inside OutputsDock.
 * Covers all four stability bands + the evidence-gap meta cases.
 */

import { describe, it, expect } from 'vitest'
import { derivePostFooterStatus, derivePostFooterMeta } from '../postAnalysisFooter'

describe('derivePostFooterStatus (Brief 5.8B D8)', () => {
  it('≥0.85 → success "Stable result"', () => {
    expect(derivePostFooterStatus(0.85)).toEqual({
      icon: 'check',
      iconClass: 'text-success',
      label: 'Stable result',
    })
    expect(derivePostFooterStatus(0.92)).toEqual({
      icon: 'check',
      iconClass: 'text-success',
      label: 'Stable result',
    })
  })

  it('0.60..0.84 → warning "Sensitive to assumptions"', () => {
    expect(derivePostFooterStatus(0.60)).toMatchObject({
      icon: 'warning',
      label: 'Sensitive to assumptions',
    })
    expect(derivePostFooterStatus(0.84)).toMatchObject({
      icon: 'warning',
      label: 'Sensitive to assumptions',
    })
  })

  it('<0.60 → danger "Provisional result"', () => {
    expect(derivePostFooterStatus(0.59)).toMatchObject({
      icon: 'danger',
      label: 'Provisional result',
    })
    expect(derivePostFooterStatus(0)).toMatchObject({
      icon: 'danger',
      label: 'Provisional result',
    })
  })

  it('missing / NaN / non-finite → danger "Fragile result" fallback', () => {
    expect(derivePostFooterStatus(undefined)).toMatchObject({ label: 'Fragile result' })
    expect(derivePostFooterStatus(null)).toMatchObject({ label: 'Fragile result' })
    expect(derivePostFooterStatus(Number.NaN)).toMatchObject({ label: 'Fragile result' })
    expect(derivePostFooterStatus(Number.POSITIVE_INFINITY)).toMatchObject({ label: 'Fragile result' })
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
