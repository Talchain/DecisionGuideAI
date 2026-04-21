/**
 * certaintyCopy decision table (Brief 5.1 Task 4, updated Brief 5.4 QA Item 3).
 *
 * Locks the full post-analysis tier matrix so regressions trip the suite.
 * Each case corresponds to a row in the table documented at the top of
 * certaintyCopy.ts.
 *
 * Brief 5.4 QA changes:
 * - Rule 4 (weak evidence): now gated on stability < 0.85 in addition to tier.
 *   needs_work + high stability → no caveat, falls through to fallback.
 * - Rule 5 (fair / close_call): now returns "is the leading option"
 *   (conservative: false) rather than "currently leads" (conservative: true).
 * - Caveat text updated: "See Top evidence value." → "See Highest-value evidence gaps."
 */

import { describe, it, expect } from 'vitest'
import { buildCertaintyCopy } from '../certaintyCopy'

const WINNER = 'Option A'

describe('buildCertaintyCopy — decision table', () => {
  it('row 1: partial analysis overrides all tier inputs', () => {
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        analysisStatus: 'partial',
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
        recommendationStability: 0.95,
      }),
    ).toEqual({
      headline: 'Some analysis steps did not complete',
      sub: 'Results are partial',
      caveat: null,
      conservative: true,
    })
  })

  it('row 2: stability < 0.70 produces the canonical no-clear-leader headline', () => {
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }),
    ).toEqual({
      headline: 'no clear leading option, the result is sensitive to your estimates',
      sub: `${WINNER} leads slightly more often`,
      caveat: null,
      conservative: true,
    })
  })

  it('row 2 boundary: stability exactly 0.70 is considered stable (falls through)', () => {
    const result = buildCertaintyCopy({
      winnerLabel: WINNER,
      recommendationStability: 0.70,
      confidenceTier: 'needs_work',
    })
    // 0.70 is not < 0.70 so Rule 2 does not fire.
    // needs_work + 0.70 stability (< 0.85) → Rule 4 fires (caveat).
    expect(result.headline).toBe(`${WINNER} currently leads`)
    expect(result.caveat).toContain('limited evidence')
  })

  it('row 3: single option renders its own copy before any tier check', () => {
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        optionCount: 1,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }),
    ).toEqual({
      headline: `${WINNER} is your only option`,
      sub: null,
      caveat: null,
      conservative: true,
    })
  })

  describe('row 4 — weak evidence path (tier or readiness, AND stability < 0.85)', () => {
    it('tier needs_work + absent stability → caveat attached', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        coachingReadiness: 'ready',
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBe(
        'Result depends on factors with limited evidence. See Highest-value evidence gaps.',
      )
    })

    it('tier needs_work + stability 0.84 (< 0.85) → caveat attached', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.84,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('tier needs_work + stability 0.85 (threshold) → caveat suppressed (fallback)', () => {
      // High numeric stability overrides the weak-evidence caveat.
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.85,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBeNull()
    })

    it('tier needs_work + stability 0.95 → caveat suppressed (fallback)', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.95,
      })
      expect(result.caveat).toBeNull()
    })

    it.each([
      ['needs_evidence'],
      ['needs_framing'],
      ['low'],
      ['not_ready'],
    ] as const)('weak readiness %s + absent stability → caveat attached', (readiness) => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: readiness,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBe(
        'Result depends on factors with limited evidence. See Highest-value evidence gaps.',
      )
    })

    it.each([
      ['needs_evidence'],
      ['needs_framing'],
      ['low'],
      ['not_ready'],
    ] as const)('weak readiness %s + high stability (0.90) → caveat suppressed', (readiness) => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: readiness,
        recommendationStability: 0.90,
      })
      // Strong tier + weak readiness + high stability → evidenceIsWeak but !stabilityIsWeak
      // Rule 4 does not fire. Rule 5 (strong+ready) — readiness is weak, not ready → skip.
      // Fallback → "currently leads", no caveat.
      expect(result.caveat).toBeNull()
      expect(result.headline).toBe(`${WINNER} currently leads`)
    })
  })

  describe('row 5 — fair / close call (definitive headline, still conservative)', () => {
    it('tier fair, readiness ready → is the leading option (conservative: true per Brief 5.2)', () => {
      // Brief 5.4 QA: headline changes from "currently leads" to "is the leading option".
      // conservative: true preserved — coaching overrides are still blocked (Brief 5.2 invariant).
      expect(
        buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'fair',
          coachingReadiness: 'ready',
        }),
      ).toEqual({
        headline: `${WINNER} is the leading option`,
        sub: null,
        caveat: null,
        conservative: true,
      })
    })

    it('tier fair, no readiness → is the leading option (fair tier alone is sufficient)', () => {
      expect(
        buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'fair',
        }),
      ).toEqual({
        headline: `${WINNER} is the leading option`,
        sub: null,
        caveat: null,
        conservative: true,
      })
    })

    it('readiness close_call → is the leading option, conservative: true', () => {
      expect(
        buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'unknown',
          coachingReadiness: 'close_call',
        }),
      ).toEqual({
        headline: `${WINNER} is the leading option`,
        sub: null,
        caveat: null,
        conservative: true,
      })
    })
  })

  it('row 6: strong + ready → is the leading option (only path requiring both signals)', () => {
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }),
    ).toEqual({
      headline: `${WINNER} is the leading option`,
      sub: null,
      caveat: null,
      conservative: false,
    })
  })

  it('row 7 fallback: absent tier + absent readiness → currently leads (conservative)', () => {
    expect(buildCertaintyCopy({ winnerLabel: WINNER })).toEqual({
      headline: `${WINNER} currently leads`,
      sub: null,
      caveat: null,
      conservative: true,
    })
  })

  it('row 7 fallback: strong but missing readiness → currently leads (not over-confident)', () => {
    // strong tier alone is not sufficient — strong + ready is required for Rule 6.
    // Without readiness, falls through to fallback.
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
      }).headline,
    ).toBe(`${WINNER} currently leads`)
  })

  describe('precedence policy', () => {
    it('unstable (stability < 0.70) wins over weak tier — canonical unstable headline, no caveat', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
      })
      expect(result.headline).toBe(
        'no clear leading option, the result is sensitive to your estimates',
      )
      expect(result.sub).toBe(`${WINNER} leads slightly more often`)
      expect(result.caveat).toBeNull()
    })

    it('partial analysis wins over unstable wins over weak tier (full chain)', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        analysisStatus: 'partial',
        recommendationStability: 0.55,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
      })
      expect(result.headline).toBe('Some analysis steps did not complete')
      expect(result.sub).toBe('Results are partial')
      expect(result.caveat).toBeNull()
    })

    it('stability 0.70 + needs_work → caveat attaches (0.70 is above the no-clear-leader gate but below the stability-strong gate)', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.70,
        confidenceTier: 'needs_work',
        coachingReadiness: 'ready',
      })
      // 0.70 is not < 0.70 → Rule 2 skipped. needs_work + 0.70 < 0.85 → Rule 4 fires.
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('single option wins over weak tier (no caveat — no alternative to compare)', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        optionCount: 1,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
      })
      expect(result.headline).toBe(`${WINNER} is your only option`)
      expect(result.caveat).toBeNull()
    })
  })

  it('UI copy compliance: no em dashes in any returned string', () => {
    const cases: Parameters<typeof buildCertaintyCopy>[0][] = [
      { winnerLabel: WINNER },
      { winnerLabel: WINNER, analysisStatus: 'partial' },
      { winnerLabel: WINNER, recommendationStability: 0.55 },
      { winnerLabel: WINNER, optionCount: 1 },
      { winnerLabel: WINNER, confidenceTier: 'needs_work' },
      { winnerLabel: WINNER, confidenceTier: 'fair' },
      { winnerLabel: WINNER, confidenceTier: 'strong', coachingReadiness: 'ready' },
    ]
    for (const input of cases) {
      const result = buildCertaintyCopy(input)
      for (const field of [result.headline, result.sub ?? '', result.caveat ?? '']) {
        expect(field).not.toContain('—')
      }
    }
  })

  describe('Brief 5.2 Task 1 — winProbabilityGap suffix', () => {
    it('row 4 (weak tier + low stability): appends " by N points" when gap provided', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        winProbabilityGap: 95,
        // no stability → stabilityIsWeak = true → Rule 4 fires
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 95 points`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('row 4 (weak readiness + low stability): appends suffix', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        coachingReadiness: 'needs_evidence',
        winProbabilityGap: 12,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 12 points`)
    })

    it('row 5 (fair tier): headline is "is the leading option" — no suffix (definitive phrasing, conservative: true)', () => {
      // Brief 5.4 QA: fair now returns definitive copy; the gap suffix is not
      // appended to "is the leading option" because the phrasing is already confident.
      // conservative: true means coaching overrides are still blocked (Brief 5.2 invariant).
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        winProbabilityGap: 7,
      })
      expect(result.headline).toBe(`${WINNER} is the leading option`)
      expect(result.caveat).toBeNull()
      expect(result.conservative).toBe(true)
    })

    it('row 6 (strong + ready): does NOT append suffix — reserved phrasing', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
        winProbabilityGap: 50,
      })
      expect(result.headline).toBe(`${WINNER} is the leading option`)
    })

    it('row 7 fallback: appends suffix when gap provided', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        winProbabilityGap: 3,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 3 points`)
    })

    it('singular point uses "point" not "points"', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        winProbabilityGap: 1,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 1 point`)
    })

    it('rounds fractional gaps to the nearest whole point', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        winProbabilityGap: 4.6,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 5 points`)
    })

    it('omits suffix when gap is 0, negative, or non-finite', () => {
      for (const gap of [0, -1, NaN, Infinity, -Infinity]) {
        const result = buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'needs_work',
          winProbabilityGap: gap,
        })
        expect(result.headline).toBe(`${WINNER} currently leads`)
      }
    })

    it('row 2 (unstable) ignores gap — canonical unstable copy is preserved', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        winProbabilityGap: 95,
      })
      expect(result.headline).toBe(
        'no clear leading option, the result is sensitive to your estimates',
      )
    })
  })

  describe('Brief 5.2 follow-up — conservative flag scopes coaching overrides', () => {
    it('row 1 (partial analysis) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        analysisStatus: 'partial',
      }).conservative).toBe(true)
    })

    it('row 2 (stability < 0.70) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
      }).conservative).toBe(true)
    })

    it('row 3 (single option) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        optionCount: 1,
      }).conservative).toBe(true)
    })

    it('row 4 (weak tier + low stability) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
      }).conservative).toBe(true)
    })

    it.each([
      ['needs_evidence' as const],
      ['needs_framing' as const],
      ['low' as const],
      ['not_ready' as const],
    ])('row 4 (weak readiness %s + low stability) is conservative', (readiness) => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        coachingReadiness: readiness,
      }).conservative).toBe(true)
    })

    it('row 5 (fair tier) is conservative — definitive headline but coaching override still blocked (Brief 5.2 invariant)', () => {
      // Brief 5.4 QA changes the HEADLINE for fair (currently leads → is the leading option)
      // but keeps conservative: true so coaching overrides remain blocked. Only strong+ready
      // (Rule 6) opts in to coaching overrides.
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        coachingReadiness: 'ready',
      }).conservative).toBe(true)
    })

    it('row 5 (close_call readiness) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        coachingReadiness: 'close_call',
      }).conservative).toBe(true)
    })

    it('row 6 (strong + ready) is NOT conservative — only path allowing coaching override', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }).conservative).toBe(false)
    })

    it('row 7 (fallback) is conservative', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
      }).conservative).toBe(true)
    })

    it('row 7 (strong but missing readiness) is conservative — strong alone does not opt in', () => {
      expect(buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
      }).conservative).toBe(true)
    })
  })
})
