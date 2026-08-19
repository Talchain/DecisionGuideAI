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
import { everyEvidenceGapAddressed } from '@/components/results/utils/evidenceGapConfidenceDisplay'
import { derivePostFooterStatus, derivePostFooterMeta } from '../postAnalysisFooter'
import type { PostFooterMetaInput } from '../postAnalysisFooter'
import type { RobustnessDisplayVerdict } from '@/components/results/types'

/**
 * FORCE the `stability` field that `PostFooterMetaInput` NO LONGER DECLARES
 * (ROADMAP 2.1273 removed it; F7 had already stopped the helper reading it).
 *
 * ⚠ WHY THESE TESTS STILL PASS A STABILITY VALUE, AND WHY THIS IS NOT A CARVE-OUT.
 * The F7 block below exists to prove a specific property: *even when a caller
 * hands this helper a finite stability number, no "{N}% stability" claim
 * reaches the footer*. Deleting `stability` from the call sites would have made
 * every one of those tests pass by NOT SUPPLYING THE INPUT — the guard would go
 * green while losing the power to see the thing it exists to catch (CLAUDE.md
 * trap 13b, "a guard agreeing with itself"). The type-level removal and the
 * runtime proof are complementary, not alternatives, so the tests keep forcing
 * the value in and the assertions are unchanged.
 *
 * The cast is deliberate, local to this file, and mirrors `withRemovedProp` in
 * `canvas/components/model-tab/__tests__/evpiSurfacesRemoved.canvas.honesty.spec.tsx`
 * — the same technique the estate already uses to prove a removed prop is inert.
 *
 * Net effect: the guarantee is now strictly STRONGER than before 2.1273. A
 * production caller cannot even name the field (compile error), and this suite
 * proves the helper ignores it if one forces it through anyway.
 */
type ForcedStability = PostFooterMetaInput & { stability?: number | null }

function derivePostFooterMetaWithForcedStability(input: ForcedStability): string | null {
  return derivePostFooterMeta(input as PostFooterMetaInput)
}

describe('derivePostFooterStatus — display-safe verdict only (robustness trust fix)', () => {
  // Single-source rule (ROBUSTNESS-VERDICT-CONTRACT): the footer verdict comes
  // ONLY from the display-safe `robustnessVerdict`, never from raw
  // recommendation_stability. So the helper takes the verdict, not a number.

  it('verdict "robust" → success "Stable ranking" (the ONLY path to a positive verdict)', () => {
    expect(derivePostFooterStatus('robust')).toEqual({
      icon: 'check',
      iconClass: 'text-success',
      label: 'Stable ranking',
    })
  })

  it('verdict "moderate" | "fragile" → warning "Ranking sensitive to assumptions"', () => {
    for (const v of ['moderate', 'fragile'] as const) {
      expect(derivePostFooterStatus(v)).toEqual({
        icon: 'warning',
        iconClass: 'text-warning',
        label: 'Ranking sensitive to assumptions',
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

  it('trust fix: an ABSENT display-safe verdict never renders "Stable ranking" nor a green/check positive icon', () => {
    // Previously raw stability ≥ 0.85 rendered a green "Stable ranking" that
    // contradicted the neutral robustness glyph.
    const status = derivePostFooterStatus(undefined)
    expect(status.label).not.toBe('Stable ranking')
    expect(status.icon).not.toBe('check')
    expect(status.iconClass).not.toContain('success')
    expect(status.label).toBe('Robustness unknown')
  })
})

describe('derivePostFooterStatus — runtime-safe: unexpected values fall NEUTRAL (not a verdict)', () => {
  // Type safety is necessary but NOT sufficient. If a raw stability number
  // (e.g. 0.87), a stringified number, or any malformed value accidentally
  // reaches the helper at runtime, it must fall neutral — NEVER fabricate a
  // "Ranking sensitive to assumptions"/"Stable ranking" claim from an uncertified source.
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
    expect(status.label).not.toBe('Stable ranking')
    expect(status.label).not.toBe('Ranking sensitive to assumptions')
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
    const out = derivePostFooterMetaWithForcedStability({
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
      derivePostFooterMetaWithForcedStability({
        stability: 0.6,
        robustnessVerdict: 'moderate',
        reviewCards: [{ confidence: 40 }, { confidence: 80 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when there are no review cards and no reason (nothing but stability would have rendered)', () => {
    expect(
      derivePostFooterMetaWithForcedStability({ stability: 0.91, robustnessVerdict: 'robust', reviewCards: [] }),
    ).toBeNull()
  })

  it('returns "Evidence gaps remain" when stability is missing (unchanged — stability never mattered)', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: undefined,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: 30 }],
      }),
    ).toBe('Evidence gaps remain')
  })

  it('returns null when both stability and review-cards are absent', () => {
    expect(
      derivePostFooterMetaWithForcedStability({ stability: null, robustnessVerdict: 'robust', reviewCards: [] }),
    ).toBeNull()
  })

  /**
   * ⭐ CORRECTED — this test used to assert 'Evidence strong' for exactly this
   * input, and it was pinning the defect rather than a behaviour.
   *
   * `useResultsSectionData` maps a gap with no stated `confidence` to `null`
   * DELIBERATELY, and `evidenceGapConfidenceDisplay`'s contract is that
   * "Callers must SUPPRESS the figure and anything derived from it". The old
   * predicate (`some(g => typeof g.confidence === 'number' && g.confidence < 50)`)
   * derived from it anyway: unstated was "not weak", so the footer printed an
   * all-clear — "Evidence strong" — about gaps whose strength the producer had
   * never stated. "No false 'Evidence gaps remain'" was the wrong thing to
   * protect; the false claim was in the other direction.
   *
   * The gaps are real producer findings and none of them is known to be
   * addressed, so "Evidence gaps remain" is the licensed reading.
   */
  it('never says "Evidence strong" about gaps whose confidence the producer never stated', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: undefined }, { confidence: null }],
      }),
    ).toBe('Evidence gaps remain')
  })

  /**
   * CONTROL — the fix is "stop minting an all-clear", NOT "delete the
   * all-clear". Every gap stated at or above the threshold still earns it.
   */
  it('still says "Evidence strong" when EVERY gap carries a stated confidence >= 50', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: 50 }, { confidence: 90 }],
      }),
    ).toBe('Evidence strong')
  })

  /** A single unstated gap in an otherwise strong list is enough to withdraw it. */
  it('one unstated confidence in a strong list withdraws the all-clear', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: 90 }, { confidence: null }],
      }),
    ).toBe('Evidence gaps remain')
  })

  /**
   * A non-finite number is not a stated figure either — `NaN`/`Infinity` are
   * the shapes a `?? 0`-style fabrication leaves behind, and
   * `resolveEvidenceGapConfidenceDisplay` already refuses them.
   */
  it('a non-finite confidence is not a stated figure', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.95,
        robustnessVerdict: 'robust',
        reviewCards: [{ confidence: Number.NaN }],
      }),
    ).toBe('Evidence gaps remain')
  })

  /**
   * ⭐ CROSS-SURFACE SINGLE PREDICATE (correction 3). This footer and the
   * results panel's "What we checked" tick are fed the SAME list by
   * `OutputsDock`, and they used to carry byte-identical copies of the same
   * defective predicate. They now share ONE, so a change to it cannot fix one
   * surface and leave the other lying.
   */
  it('agrees with the results-panel predicate on every confidence state', () => {
    const cases: Array<{ confidence: number | null | undefined }> = [
      { confidence: undefined }, { confidence: null }, { confidence: Number.NaN },
      { confidence: 0 }, { confidence: 49 }, { confidence: 50 }, { confidence: 90 },
    ]
    for (const c of cases) {
      const meta = derivePostFooterMetaWithForcedStability({
        stability: 0.95, robustnessVerdict: 'robust', reviewCards: [c],
      })
      expect(
        meta === 'Evidence strong',
        `confidence=${String(c.confidence)} → footer said "${meta}"`,
      ).toBe(everyEvidenceGapAddressed([c]))
    }
  })

  it('no determinate verdict + any stability + no cards → null (stability alone can never render)', () => {
    for (const v of [undefined, null, 'not_assessed'] as const) {
      expect(
        derivePostFooterMetaWithForcedStability({ stability: 0.59, robustnessVerdict: v, reviewCards: [] }),
      ).toBeNull()
    }
  })

  it('runtime-safe: malformed verdict values never surface a stability number', () => {
    for (const bad of [0.87, '0.87', 'unexpected', 'high', 'low', 'very_low', '', Number.NaN, true, {}, []]) {
      const out = derivePostFooterMetaWithForcedStability({
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
      derivePostFooterMetaWithForcedStability({
        stability: 0.82,
        robustnessVerdict: 'robust',
        robustnessVerdictReason: 'this result held up under the changes we tested',
        reviewCards: [],
      }),
    ).toBe('this result held up under the changes we tested')
  })

  it('the not_assessed reason renders alone', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.59,
        robustnessVerdict: 'not_assessed',
        robustnessVerdictReason: 'robustness was not assessed for this run',
        reviewCards: [],
      }),
    ).toBe('robustness was not assessed for this run')
  })

  it('a reason without any verdict is never rendered (no orphaned robustness prose)', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.59,
        robustnessVerdict: undefined,
        robustnessVerdictReason: 'small changes could flip this result',
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('an absent or blank reason renders nothing (no stability fallback)', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.82,
        robustnessVerdict: 'fragile',
        robustnessVerdictReason: '   ',
        reviewCards: [],
      }),
    ).toBeNull()
  })

  it('reason + evidence combine with the separator; stability never appears', () => {
    expect(
      derivePostFooterMetaWithForcedStability({
        stability: 0.82,
        robustnessVerdict: 'robust',
        robustnessVerdictReason: 'this result held up under the changes we tested',
        reviewCards: [{ confidence: 40 }],
      }),
    ).toBe('this result held up under the changes we tested · Evidence gaps remain')
  })
})
