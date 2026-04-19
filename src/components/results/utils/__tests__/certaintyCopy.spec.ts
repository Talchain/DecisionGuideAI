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
