/**
 * Post-analysis footer status + meta derivation.
 *
 * Pure helper underpinning the AnalysisFooter call inside OutputsDock. Status is
 * driven ONLY by the display-safe robustnessVerdict (single-source rule), and
 * is runtime-safe (unexpected values fall neutral); meta covers the neutral
 * "{N}% stability" + evidence-gap cases.
 */

import { describe, it, expect } from 'vitest'
import { derivePostFooterStatus, derivePostFooterMeta } from '../postAnalysisFooter'
import type { RobustnessLevel } from '@/components/results/types'

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

describe('derivePostFooterStatus — runtime-safe: unexpected values fall NEUTRAL (not a verdict)', () => {
  // Type safety is necessary but NOT sufficient. If a raw stability number
  // (e.g. 0.87), a stringified number, or any malformed value accidentally
  // reaches the helper at runtime, it must fall neutral — NEVER fabricate a
  // "Sensitive to assumptions"/"Stable result" claim from an uncertified source.
  const NEUTRAL = { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' } as const
  const UNEXPECTED: Array<[string, unknown]> = [
    ['raw number 0.87', 0.87],
    ['raw number 0.5', 0.5],
    ['raw number 1', 1],
    ['stringified number "0.87"', '0.87'],
    ['unknown string "unexpected"', 'unexpected'],
    ['empty string', ''],
    ['NaN', Number.NaN],
    ['boolean true', true],
    ['object', {}],
    ['array', []],
  ]
  it.each(UNEXPECTED)('%s → neutral "Robustness unknown", no verdict / no positive styling', (_label, value) => {
    const status = derivePostFooterStatus(value as unknown as RobustnessLevel)
    expect(status).toEqual(NEUTRAL)
    expect(status.label).not.toBe('Stable result')
    expect(status.label).not.toBe('Sensitive to assumptions')
    expect(status.icon).not.toBe('check')
    expect(status.icon).not.toBe('warning')
    expect(status.iconClass).not.toContain('success')
    expect(status.iconClass).not.toContain('warning')
  })
})

describe('derivePostFooterMeta (Brief 5.8B D8)', () => {
  // A known display-safe verdict is required for the stability segment to
  // render at all (stability-honesty suppression, tested separately below).
  it('renders "{N}% stability · Evidence strong" when no review-card is weak (verdict known)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'high',
        reviewCards: [{ confidence: 70 }, { confidence: 90 }],
      }),
    ).toBe('82% stability · Evidence strong')
  })

  it('renders "{N}% stability · Evidence gaps remain" when any review-card confidence < 50', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.6,
        robustnessVerdict: 'moderate',
        reviewCards: [{ confidence: 40 }, { confidence: 80 }],
      }),
    ).toBe('60% stability · Evidence gaps remain')
  })

  it('omits the evidence segment entirely when there are no review cards', () => {
    expect(
      derivePostFooterMeta({ stability: 0.91, robustnessVerdict: 'high', reviewCards: [] }),
    ).toBe('91% stability')
  })

  it('omits the stability segment when stability is missing', () => {
    expect(
      derivePostFooterMeta({
        stability: undefined,
        robustnessVerdict: 'high',
        reviewCards: [{ confidence: 30 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when both stability and review-cards are absent', () => {
    expect(
      derivePostFooterMeta({ stability: null, robustnessVerdict: 'high', reviewCards: [] }),
    ).toBeNull()
  })

  it('treats non-numeric review-card confidence as ok (no false "Evidence gaps remain")', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.95,
        robustnessVerdict: 'high',
        reviewCards: [{ confidence: undefined }, { confidence: null }],
      }),
    ).toBe('95% stability · Evidence strong')
  })
})

describe('derivePostFooterMeta — stability honesty: no "{N}% stability" while the verdict is unknown', () => {
  // Display-coherence hotfix: the footer status said "Robustness unknown"
  // (robustnessVerdict is undefined in the live contract today) while the
  // meta line rendered "59% stability" beside it — and that raw
  // recommendation_stability is numerically the leader's win probability,
  // not a robustness verdict. The segment must be SUPPRESSED (never
  // relabelled) whenever the display-safe verdict is unknown/undefined.

  it('undefined verdict suppresses the stability segment (the live-contract case)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: undefined,
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('null verdict suppresses the stability segment', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.87,
        robustnessVerdict: null,
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('evidence text still renders on its own when the verdict is unknown (only stability is suppressed)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: undefined,
        reviewCards: [{ confidence: 40 }],
      }),
    ).toBe('Evidence gaps remain')
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: undefined,
        reviewCards: [{ confidence: 90 }],
      }),
    ).toBe('Evidence strong')
  })

  it('runtime-safe: malformed verdict values suppress like the status falls neutral (allowlist, not catch-all)', () => {
    for (const bad of [0.87, '0.87', 'unexpected', '', Number.NaN, true, {}, []]) {
      expect(
        derivePostFooterMeta({
          stability: 0.75,
          robustnessVerdict: bad as unknown as RobustnessLevel,
          reviewCards: [],
        }),
        `verdict ${JSON.stringify(bad)} must not unlock the stability segment`,
      ).toBeNull()
    }
  })

  it('every known display-safe verdict unlocks the segment (and nothing else does)', () => {
    for (const v of ['high', 'moderate', 'low', 'very_low'] as const) {
      expect(
        derivePostFooterMeta({ stability: 0.59, robustnessVerdict: v, reviewCards: [] }),
      ).toBe('59% stability')
    }
  })
})
