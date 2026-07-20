/**
 * Post-analysis footer status + meta derivation.
 *
 * Pure helper underpinning the AnalysisFooter call inside OutputsDock. Status is
 * driven ONLY by the display-safe robustnessVerdict (single-source rule) — the
 * producer's own robustness.display_verdict enum (PLoT #202, consumed lane 35
 * fix 3: 'robust' | 'moderate' | 'fragile' | 'not_assessed') — and is
 * runtime-safe (unexpected values fall neutral); meta covers the producer
 * reason (verbatim) and the evidence-gap cases. Per F7 the "{N}% stability"
 * numeric segment is removed (it was the leader win probability mislabelled).
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

describe('derivePostFooterMeta — F7: the "{N}% stability" numeric segment is removed', () => {
  // F7 (display honesty): `stability` is the legacy `recommendation_stability`
  // field, which is in fact the LEADER'S WIN PROBABILITY, not a robustness/
  // stability measure. It must NEVER render as "{N}% stability". Only the
  // display-safe verdict/reason and evidence-gap text survive.

  it('never renders a "% stability" segment even with a determinate verdict + finite stability', () => {
    // RED pin (task spec): recommendation_stability = 0.61 must NOT produce a
    // "61%"-with-"stability" claim.
    const out = derivePostFooterMeta({
      stability: 0.61,
      robustnessVerdict: 'robust',
      reviewCards: [{ confidence: 70 }, { confidence: 90 }],
    })
    expect(out).not.toContain('stability')
    expect(out).not.toContain('61%')
    expect(out).toBe('Evidence strong')
  })

  it('renders "Evidence gaps remain" alone when any review-card confidence < 50', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.6,
        robustnessVerdict: 'moderate',
        reviewCards: [{ confidence: 40 }, { confidence: 80 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when there are no review cards and no reason (nothing but stability would have rendered)', () => {
    expect(
      derivePostFooterMeta({ stability: 0.91, robustnessVerdict: 'robust', reviewCards: [] }),
    ).toBeNull()
  })

  it('returns "Evidence gaps remain" when stability is missing (unchanged — stability never mattered)', () => {
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

  it('treats non-numeric review-card confidence as ok (no false "Evidence gaps remain", no stability)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: undefined }, { confidence: null }],
      }),
    ).toBe('Evidence strong')
  })

  it('no determinate verdict + any stability + no cards → null (stability alone can never render)', () => {
    for (const v of [undefined, null, 'not_assessed'] as const) {
      expect(
        derivePostFooterMeta({ stability: 0.59, robustnessVerdict: v, reviewCards: [] }),
      ).toBeNull()
    }
  })

  it('runtime-safe: malformed verdict values never surface a stability number', () => {
    for (const bad of [0.87, '0.87', 'unexpected', 'high', 'low', 'very_low', '', Number.NaN, true, {}, []]) {
      const out = derivePostFooterMeta({
        stability: 0.75,
        robustnessVerdict: bad as unknown as RobustnessDisplayVerdict,
        reviewCards: [],
      })
      expect(out, `verdict ${JSON.stringify(bad)} must not surface stability`).toBeNull()
    }
  })
})

describe('derivePostFooterMeta — producer reason rendered verbatim (lane 35 fix 3)', () => {
  it('the producer reason renders alone (no trailing "% stability" segment after F7)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'robust',
        robustnessVerdictReason: 'this result held up under the changes we tested',
        reviewCards: [],
      }),
    ).toBe('this result held up under the changes we tested')
  })

  it('the not_assessed reason renders alone', () => {
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

  it('an absent or blank reason renders nothing (no stability fallback)', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'fragile',
        robustnessVerdictReason: '   ',
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('reason + evidence combine with the separator; stability never appears', () => {
    expect(
      derivePostFooterMeta({
        stability: 0.82,
        robustnessVerdict: 'robust',
        robustnessVerdictReason: 'this result held up under the changes we tested',
        reviewCards: [{ confidence: 40 }],
      }),
    ).toBe('this result held up under the changes we tested · Evidence gaps remain')
  })
})
