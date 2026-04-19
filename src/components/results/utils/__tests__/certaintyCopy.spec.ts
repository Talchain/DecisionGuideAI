/**
 * certaintyCopy decision table (Brief 5.1 Task 4).
 *
 * Locks the full post-analysis tier matrix so regressions trip the suite.
 * Each case corresponds to a row in the table documented at the top of
 * certaintyCopy.ts.
 */

import { describe, it, expect } from 'vitest'
import { buildCertaintyCopy } from '../certaintyCopy'

const WINNER = 'Option A'

describe('buildCertaintyCopy — Brief 5.1 Task 4 decision table', () => {
  it('row 2: partial analysis overrides all tier inputs', () => {
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
    })
  })

  it('row 1: stability < 0.70 produces the canonical no-clear-leader headline', () => {
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
    })
  })

  it('row 1 boundary: stability exactly 0.70 is considered stable', () => {
    const result = buildCertaintyCopy({
      winnerLabel: WINNER,
      recommendationStability: 0.70,
      confidenceTier: 'fair',
    })
    expect(result.headline).toBe(`${WINNER} currently leads`)
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
    })
  })

  describe('row 4 — weak evidence path (tier or readiness)', () => {
    it('tier needs_work → caveat attached', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        coachingReadiness: 'ready',
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBe(
        'Result depends on factors with limited evidence. See Top evidence value.',
      )
    })

    it.each([
      ['needs_evidence'],
      ['needs_framing'],
      ['low'],
      ['not_ready'],
    ] as const)('weak readiness %s → caveat attached', (readiness) => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: readiness,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBe(
        'Result depends on factors with limited evidence. See Top evidence value.',
      )
    })
  })

  describe('row 5 — fair / close call', () => {
    it('tier fair, readiness ready → no caveat', () => {
      expect(
        buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'fair',
          coachingReadiness: 'ready',
        }),
      ).toEqual({
        headline: `${WINNER} currently leads`,
        sub: null,
        caveat: null,
      })
    })

    it('readiness close_call → currently leads, no caveat', () => {
      expect(
        buildCertaintyCopy({
          winnerLabel: WINNER,
          confidenceTier: 'unknown',
          coachingReadiness: 'close_call',
        }).headline,
      ).toBe(`${WINNER} currently leads`)
    })
  })

  it('row 6: strong + ready → is the leading option (only path allowed to claim it)', () => {
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
    })
  })

  it('row 7 fallback: absent tier + absent readiness → currently leads', () => {
    expect(buildCertaintyCopy({ winnerLabel: WINNER })).toEqual({
      headline: `${WINNER} currently leads`,
      sub: null,
      caveat: null,
    })
  })

  it('row 7 fallback: strong but missing readiness does NOT claim is the leading option', () => {
    // Guards against the pre-fix bug where any recommendation silently
    // claimed "is the leading option" regardless of evidence.
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        confidenceTier: 'strong',
      }).headline,
    ).toBe(`${WINNER} currently leads`)
  })

  describe('precedence policy', () => {
    // Brief 5.1 follow-up Imp #3. Locks the decision-table ordering so
    // future copy changes don't silently re-prioritise. The table is
    // evaluated top-down, first match wins — the tests below pin the
    // winners of each realistic conflict.

    it('unstable (stability < 0.70) wins over weak tier — canonical unstable headline, no caveat', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
      })
      // Row 1 fires. User sees the unstable-specific framing; the
      // weak-tier caveat is suppressed because the stability line
      // already communicates sensitivity more directly.
      expect(result.headline).toBe(
        'no clear leading option, the result is sensitive to your estimates',
      )
      expect(result.sub).toBe(`${WINNER} leads slightly more often`)
      expect(result.caveat).toBeNull()
    })

    it('partial analysis wins over unstable wins over weak tier (full chain)', () => {
      // partial beats stability < 0.70 beats needs_work.
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

    it('stability exactly 0.70 falls through to weak-tier branch (caveat attaches)', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.70,
        confidenceTier: 'needs_work',
        coachingReadiness: 'ready',
      })
      // 0.70 is not < 0.70, so Row 1 does NOT fire. Row 4 wins —
      // "currently leads" + evidence caveat.
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('single option wins over weak tier (no caveat attaches because there is no alternative to compare)', () => {
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
    // Brief §Operating principles: no em dashes in UI copy.
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
})
