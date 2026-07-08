/**
 * Post-analysis footer status + meta derivation.
 *
 * Pure helper underpinning the AnalysisFooter call inside OutputsDock. Status is
 * driven ONLY by the display-safe robustnessVerdict (single-source rule) — the
 * producer's own robustness.display_verdict enum (PLoT #202, consumed lane 35
 * fix 3: 'robust' | 'moderate' | 'fragile' | 'not_assessed') — and is
 * runtime-safe (unexpected values fall neutral); meta covers the producer
 * reason (verbatim), the neutral "{N}% stability" and the evidence-gap cases.
 */

import { describe, it, expect } from 'vitest'
import { derivePostFooterStatus, derivePostFooterMeta } from '../postAnalysisFooter'
import type { RobustnessDisplayVerdict } from '@/components/results/types'

describe('derivePostFooterStatus — display-safe verdict only (robustness trust fix)', () => {
  // Single-source rule (ROBUSTNESS-VERDICT-CONTRACT): the footer verdict comes
  // ONLY from the display-safe `robustnessVerdict`, never from raw
  // recommendation_stability. So the helper takes the verdict, not a number.

  it('verdict "robust" → success "Stable result" (the ONLY path to a positive verdict)', () => {
    expect(derivePostFooterStatus('robust')).toEqual({
      icon: 'check',
      iconClass: 'text-success',
      label: 'Stable result',
    })
  })

  it('verdict "moderate" | "fragile" → warning "Sensitive to assumptions"', () => {
    for (const v of ['moderate', 'fragile'] as const) {
      expect(derivePostFooterStatus(v)).toEqual({
        icon: 'warning',
        iconClass: 'text-warning',
        label: 'Sensitive to assumptions',
      })
    }
  })

  it('verdict "not_assessed" → neutral "Robustness not assessed" (the producer\'s own stated absence, never "Sensitive")', () => {
    expect(derivePostFooterStatus('not_assessed')).toEqual({
      icon: 'unknown',
      iconClass: 'text-text-light',
      label: 'Robustness not assessed',
    })
  })

  it('undefined / null verdict → neutral "Robustness unknown" (older PLoT builds; matches the certified glyph)', () => {
    for (const v of [undefined, null] as const) {
      expect(derivePostFooterStatus(v)).toEqual({
        icon: 'unknown',
        iconClass: 'text-text-light',
        label: 'Robustness unknown',
      })
    }
  })

  it('trust fix: an ABSENT display-safe verdict never renders "Stable result" nor a green/check positive icon', () => {
    // Previously raw stability ≥ 0.85 rendered a green "Stable result" that
    // contradicted the neutral robustness glyph.
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
    // The RETIRED pre-#202 UI vocabulary must not sneak back in as a verdict.
    ['retired token "high"', 'high'],
    ['retired token "low"', 'low'],
    ['retired token "very_low"', 'very_low'],
    ['empty string', ''],
    ['NaN', Number.NaN],
    ['boolean true', true],
    ['object', {}],
    ['array', []],
  ]
  it.each(UNEXPECTED)('%s → neutral "Robustness unknown", no verdict / no positive styling', (_label, value) => {
    const status = derivePostFooterStatus(value as unknown as RobustnessDisplayVerdict)
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
  // A determinate display-safe verdict is required for the stability segment
  // to render at all (stability-honesty suppression, tested separately below).
  it('renders "{N}% stability · Evidence strong" when no review-card is weak (verdict determinate)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'robust',
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
      derivePostFooterMeta({ stability: 0.91, robustnessVerdict: 'robust', reviewCards: [] }),
    ).toBe('91% stability')
  })

  it('omits the stability segment when stability is missing', () => {
    expect(
      derivePostFooterMeta({
        stability: undefined,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: 30 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when both stability and review-cards are absent', () => {
    expect(
      derivePostFooterMeta({ stability: null, robustnessVerdict: 'robust', reviewCards: [] }),
    ).toBeNull()
  })

  it('treats non-numeric review-card confidence as ok (no false "Evidence gaps remain")', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: undefined }, { confidence: null }],
      }),
    ).toBe('95% stability · Evidence strong')
  })
})

describe('derivePostFooterMeta — producer reason rendered verbatim (lane 35 fix 3)', () => {
  it('the producer reason leads the meta line, verbatim, before the stability segment', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'robust',
        robustnessVerdictReason: 'this result held up under the changes we tested',
        reviewCards: [],
      }),
    ).toBe('this result held up under the changes we tested · 82% stability')
  })

  it('the not_assessed reason renders alone (stability stays suppressed beside a non-determinate verdict)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: 'not_assessed',
        robustnessVerdictReason: 'robustness was not assessed for this run',
        reviewCards: [],
      }),
    ).toBe('robustness was not assessed for this run')
  })

  it('a reason without any verdict is never rendered (no orphaned robustness prose)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: undefined,
        robustnessVerdictReason: 'small changes could flip this result',
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('an absent or blank reason renders nothing extra', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'fragile',
        robustnessVerdictReason: '   ',
        reviewCards: [],
      }),
    ).toBe('82% stability')
  })
})

describe('derivePostFooterMeta — stability honesty: no "{N}% stability" without a determinate verdict', () => {
  // Display-coherence hotfix: the footer status said "Robustness unknown"
  // while the meta line rendered "59% stability" beside it — and that raw
  // recommendation_stability is numerically the leader's win probability,
  // not a robustness verdict. The segment must be SUPPRESSED (never
  // relabelled) whenever the display-safe verdict is absent or non-determinate.

  it('undefined verdict suppresses the stability segment (older PLoT builds)', () => {
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

  it('not_assessed suppresses the stability segment ("not assessed · 59% stability" would contradict itself)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.59,
        robustnessVerdict: 'not_assessed',
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
    for (const bad of [0.87, '0.87', 'unexpected', 'high', 'low', 'very_low', '', Number.NaN, true, {}, []]) {
      expect(
        derivePostFooterMeta({
          stability: 0.75,
          robustnessVerdict: bad as unknown as RobustnessDisplayVerdict,
          reviewCards: [],
        }),
        `verdict ${JSON.stringify(bad)} must not unlock the stability segment`,
      ).toBeNull()
    }
  })

  it('every determinate display-safe verdict unlocks the segment (and nothing else does)', () => {
    for (const v of ['robust', 'moderate', 'fragile'] as const) {
      expect(
        derivePostFooterMeta({ stability: 0.59, robustnessVerdict: v, reviewCards: [] }),
      ).toBe('59% stability')
    }
  })
})
