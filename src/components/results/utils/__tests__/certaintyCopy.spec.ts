/**
 * certaintyCopy decision table (Brief 5.5 §2.7 lock).
 *
 * Locks the corrected post-analysis tier × stability matrix. Key changes
 * versus Brief 5.4 QA Item 3:
 *   - Rule 4 (soft headline) now gates on (tier ∈ {needs_work, fair}) AND
 *     stability < 0.85. coachingReadiness is NOT a softening trigger; a
 *     strong tier with weak readiness must never soften.
 *   - Rule 4 caveat remains scoped to `needs_work` (fair is not an
 *     evidence-weak signal; its soft-headline fires without the caveat).
 *   - Rule 5 (close_call) retains the definitive leader headline (re-anchored)
 *     headline, conservative: true. Fair / close_call share the Brief 5.2
 *     coaching-override block.
 *   - Rule 7 fallback: with gap emits "{winner} leads by N points"; without
 *     gap emits the definitive leader headline (avoids bare "leads")
 *     (the word "currently" is the softening marker and no longer appears
 *     in confident paths).
 *
 * The (tier × stability) cross-product with readiness is exercised below to
 * demonstrate that readiness cannot soften a strong or high-stability run.
 */

import { describe, it, expect } from 'vitest'
import { buildCertaintyCopy, shouldSoftenPhrasing } from '../certaintyCopy'
import { NO_CLAIM_VERDICT, type DecisionVerdict } from '../../../../lib/decisionVerdict'

const WINNER = 'Option A'

/**
 * ⭐ SUPERSEDED EXPECTATION — re-anchoring, 2026-07-31 (the #547 disclosure
 * pattern: the old expectation is named and explained, not silently swapped).
 *
 * These rows used to expect `"{WINNER} is the leading option"`. That sentence
 * is RETIRED under Paul's ruling: an endorsement noun with no stated basis
 * and no number, which a reader cannot argue with. The DECISION TABLE IS
 * UNCHANGED — every row still fires exactly where it fired before, and each
 * row still asserts "the definitive, non-softened leader headline fires
 * here". Only the wording of that headline moved, to the house comparative
 * register.
 *
 * ⚠ THIS COMMENT PREVIOUSLY SAID "the magnitude-bearing arm is covered
 * separately below". THAT WAS FALSE — there was no such coverage, and (F4)
 * there is now no such arm: it was dead on the live path, since the sole
 * caller passes only `winProbabilityGap` and never the absolute probability.
 * It has been deleted rather than wired, because Paul's ruling demotes the
 * comparative number and a magnitude-free sentence here is the CORRECT
 * behaviour. A spec comment advertising coverage that does not exist is the
 * same defect class as a register that drifts from its callers, so it is
 * corrected in place rather than quietly dropped.
 *
 * `buildCertaintyCopy` therefore emits exactly one form of this sentence.
 */
const AHEAD = `${WINNER} came out ahead most often across simulated scenarios`

// SINGLE VERDICT helpers — the shape `deriveDecisionVerdict` returns. Built by
// hand here ONLY because this is a unit spec of the copy function; the
// cross-surface spec (singleVerdict.crossSurface.spec.tsx) drives the real
// derivation from a real PLoT report so these shapes cannot drift unnoticed.
const tiedVerdict = (): DecisionVerdict => ({
  leaderId: 'opt_a', separation: 'tied', hasLeadingOption: false, gapPp: 3, source: 'producer_near_tie',
})
const clearVerdict = (): DecisionVerdict => ({
  leaderId: 'opt_a', separation: 'clear', hasLeadingOption: true, gapPp: 52, source: 'producer_near_tie',
})

// ROADMAP 1.267 — WHY EVERY CASE BELOW NOW NAMES A VERDICT.
//
// `verdict` used to be OPTIONAL and most of this table omitted it. That was
// not a tidy default: with no verdict the withheld branch could not fire, so
// each of these cases silently exercised the leader-ASSERTING rules while
// documenting nothing about the precondition that entitles them. The
// parameter is required now, and the tier × stability table is the copy for a
// run where a leading option EXISTS — so `clearVerdict()` states that
// precondition at every call site rather than leaving it to a default.
//
// The cases that are ABOUT a withheld, tied or single-option run pass their
// own verdict (rows 2, 3b, 3c and the tie tests) and are untouched: they were
// already explicit, which is exactly why they were the only ones that could
// see the defect.

describe('buildCertaintyCopy — decision table', () => {
  it('row 1: partial analysis overrides all tier inputs', () => {
    expect(
      buildCertaintyCopy({
        verdict: clearVerdict(),
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

  // SINGLE VERDICT (2026-07-25): row 2 used to fire on
  // `recommendationStability < 0.70`. That denied a leading option because the
  // result was FRAGILE, which is a different fact — on the reported staging run
  // it printed "no clear leading option / leads slightly more often" about a
  // 52-point lead while the canvas badged the same option "Leading option".
  // The tie call now belongs to `deriveDecisionVerdict` (src/lib), which reads
  // PLoT's own `robustness.near_tie`. These two tests pin BOTH directions.
  it('row 2: a TIED verdict produces the canonical no-clear-leader headline', () => {
    expect(
      buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
        verdict: tiedVerdict(),
      }),
    ).toEqual({
      headline: 'no clear leading option, the result is sensitive to your estimates',
      // ROADMAP 1.223: a denial does not get a leader for a companion.
      sub: null,
      caveat: null,
      conservative: true,
    })
  })

  it('row 2 REGRESSION PIN: low stability alone must NOT deny a leading option', () => {
    // The exact journey run: 72% vs 20% (a 52-point lead) with stability 0.55.
    const result = buildCertaintyCopy({
      winnerLabel: WINNER,
      recommendationStability: 0.55,
      confidenceTier: 'strong',
      coachingReadiness: 'ready',
      winProbabilityGap: 52,
      verdict: clearVerdict(),
    })
    expect(result.headline).not.toContain('no clear leading option')
    expect(result.headline).not.toContain('slightly more often')
    expect(result.headline).toContain(WINNER)
  })

  it('row 2 boundary: stability exactly 0.70 is considered stable (Rule 4 fires for needs_work)', () => {
    const result = buildCertaintyCopy({
      verdict: clearVerdict(),
      winnerLabel: WINNER,
      recommendationStability: 0.70,
      confidenceTier: 'needs_work',
    })
    expect(result.headline).toBe(`${WINNER} currently leads`)
    expect(result.caveat).toContain('limited evidence')
  })

  // ROADMAP 1.223 REGRESSION GUARD — the ordering bug this suite was blind to.
  //
  // `deriveDecisionVerdict` returns the `unknown` verdict for TWO reasons: the
  // producer withheld the leader claim, AND "fewer than two comparable
  // options" — which every healthy single-option run satisfies. The first cut
  // of 1.223 put the withheld branch ABOVE the single-option branch, so a
  // perfectly good one-option run rendered "the analysis did not put an option
  // forward" — untrue there; nothing was withheld.
  //
  // Every other verdict test in this file passes optionCount 3 or omits it, so
  // none of them could see this. This one pins the ORDER.
  it('row 3b: a single-option run keeps its own copy even though its verdict is `unknown`', () => {
    const singleOptionVerdict: DecisionVerdict = {
      leaderId: null, separation: 'unknown', hasLeadingOption: false, gapPp: null, source: 'none',
    }
    const result = buildCertaintyCopy({
      winnerLabel: WINNER,
      optionCount: 1,
      confidenceTier: 'strong',
      coachingReadiness: 'ready',
      verdict: singleOptionVerdict,
    })
    expect(result.headline).toBe(`${WINNER} is your only option`)
    expect(result.headline).not.toBe('the analysis did not put an option forward')
  })

  // Positive control for the guard above: the SAME `unknown` verdict on a
  // MULTI-option run must still produce the withheld copy. Without this, the
  // guard could be satisfied by deleting the withheld branch entirely.
  it('row 3c: the same `unknown` verdict on a multi-option run IS the withheld copy', () => {
    const withheldVerdict: DecisionVerdict = {
      leaderId: 'opt_a', separation: 'unknown', hasLeadingOption: false, gapPp: 35, source: 'none',
    }
    const result = buildCertaintyCopy({
      winnerLabel: WINNER,
      optionCount: 3,
      confidenceTier: 'strong',
      coachingReadiness: 'ready',
      verdict: withheldVerdict,
    })
    expect(result.headline).toBe('the analysis did not put an option forward')
  })

  it('row 3: single option renders its own copy before any tier check', () => {
    expect(
      buildCertaintyCopy({
        verdict: clearVerdict(),
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

  describe('row 4 — soft headline path (tier ∈ {needs_work, fair} AND stability < 0.85)', () => {
    it('needs_work + absent stability → soft headline + evidence caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      // Brief 5.8B D2b unified the queue and removed the legacy
      // evidence-gaps sub-header. Caveat copy updated to drop the
      // dead cross-reference; meaning preserved.
      expect(result.caveat).toBe(
        'Result depends on factors with limited evidence.',
      )
      expect(result.conservative).toBe(true)
    })

    it('needs_work + stability 0.84 → soft headline + caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.84,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('fair + absent stability → soft headline, NO caveat (fair is not evidence-weak)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'fair',
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBeNull()
      expect(result.conservative).toBe(true)
    })

    it('fair + stability 0.84 → soft headline, NO caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        recommendationStability: 0.84,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBeNull()
    })
  })

  describe('stability override (tier ∈ {needs_work, fair} AND stability ≥ 0.85)', () => {
    it('needs_work + 0.85 → confident fallback the definitive leader headline (re-anchored), no caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.85,
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.caveat).toBeNull()
      expect(result.conservative).toBe(true)
    })

    it('needs_work + 0.95 → confident fallback', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        recommendationStability: 0.95,
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.caveat).toBeNull()
    })

    it('fair + 0.87 → confident fallback, no caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        recommendationStability: 0.87,
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.caveat).toBeNull()
    })
  })

  describe('readiness cross-products — coachingReadiness never softens (Brief 5.5 §2.7 correction)', () => {
    it.each([
      ['needs_evidence'],
      ['needs_framing'],
      ['low'],
      ['not_ready'],
    ] as const)('strong + weak readiness %s + stability 0.75 → confident the definitive leader headline (re-anchored) (readiness never softens strong)', (readiness) => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: readiness,
        recommendationStability: 0.75,
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.caveat).toBeNull()
    })

    it('needs_work + readiness=ready + stability 0.75 → soft (readiness does not rescue)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        coachingReadiness: 'ready',
        recommendationStability: 0.75,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('needs_work + readiness=needs_evidence + stability 0.90 → confident (stability override beats weak readiness)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
        recommendationStability: 0.90,
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.caveat).toBeNull()
    })

    it('fair + readiness=not_ready + stability 0.80 → soft (unambiguous soft path)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        coachingReadiness: 'not_ready',
        recommendationStability: 0.80,
      })
      expect(result.headline).toBe(`${WINNER} currently leads`)
      expect(result.caveat).toBeNull()
    })
  })

  describe('row 5 — close_call (orthogonal to the tier × stability gate)', () => {
    it('close_call + unknown tier → definitive the definitive leader headline (re-anchored), conservative: true', () => {
      expect(
        buildCertaintyCopy({
          verdict: clearVerdict(),
          winnerLabel: WINNER,
          confidenceTier: 'unknown',
          coachingReadiness: 'close_call',
        }),
      ).toEqual({
        headline: AHEAD,
        sub: null,
        caveat: null,
        conservative: true,
      })
    })

    it('close_call wins over needs_work + high stability (tier path would reach confident fallback first, but Rule 4 soft gate applies only when stability is weak — so close_call precedence is tested via a tier that does not trigger Rule 4)', () => {
      // Rule 4 takes precedence when applicable. Use a non-soft tier to isolate close_call.
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'close_call',
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.conservative).toBe(true)
    })
  })

  it('row 6: strong + ready → the definitive leader headline (re-anchored) (only path allowing coaching override)', () => {
    expect(
      buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }),
    ).toEqual({
      headline: AHEAD,
      sub: null,
      caveat: null,
      conservative: false,
    })
  })

  describe('row 7 — confident fallback', () => {
    it('no tier + no readiness + no gap → the definitive leader headline (re-anchored) (avoids bare "leads")', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER })).toEqual({
        headline: AHEAD,
        sub: null,
        caveat: null,
        conservative: true,
      })
    })

    it('strong + no readiness + no gap → the definitive leader headline (re-anchored)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
      })
      expect(result.headline).toBe(AHEAD)
      expect(result.conservative).toBe(true)
    })
  })

  describe('precedence policy', () => {
    it('a TIED verdict wins over weak tier — canonical unstable headline, no caveat', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        confidenceTier: 'needs_work',
        coachingReadiness: 'needs_evidence',
        verdict: tiedVerdict(),
      })
      expect(result.headline).toBe(
        'no clear leading option, the result is sensitive to your estimates',
      )
      // ROADMAP 1.223: the contradictory companion sentence is gone.
      expect(result.sub).toBeNull()
      expect(result.caveat).toBeNull()
    })

    it('partial analysis wins over unstable wins over weak tier (full chain)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
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

    it('single option wins over weak tier (no caveat — no alternative to compare)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
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
    // ROADMAP 1.267: the em-dash sweep now covers BOTH verdict states, so a
    // withheld-run string can never slip an em dash past it. The permitted
    // rows carry `clearVerdict()`; the withheld row carries the no-claim
    // verdict and exercises the branch the other eight cannot reach.
    const cases: Parameters<typeof buildCertaintyCopy>[0][] = [
      { verdict: clearVerdict(), winnerLabel: WINNER },
      { verdict: clearVerdict(), winnerLabel: WINNER, analysisStatus: 'partial' },
      { verdict: clearVerdict(), winnerLabel: WINNER, recommendationStability: 0.55 },
      { verdict: clearVerdict(), winnerLabel: WINNER, optionCount: 1 },
      { verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'needs_work' },
      { verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'fair' },
      { verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'strong', coachingReadiness: 'ready' },
      { verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'unknown', coachingReadiness: 'close_call' },
      { verdict: NO_CLAIM_VERDICT, winnerLabel: WINNER, optionCount: 3 },
      { verdict: tiedVerdict(), winnerLabel: WINNER, optionCount: 3 },
    ]
    for (const input of cases) {
      const result = buildCertaintyCopy(input)
      for (const field of [result.headline, result.sub ?? '', result.caveat ?? '']) {
        expect(field).not.toContain('—')
      }
    }
  })

  describe('Brief 5.2 Task 1 — winProbabilityGap suffix', () => {
    it('soft path (needs_work + low stability): appends " by N points"', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        winProbabilityGap: 95,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 95 points`)
      expect(result.caveat).toContain('limited evidence')
    })

    it('soft path (fair + low stability): appends suffix, NO caveat', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'fair',
        winProbabilityGap: 7,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 7 points`)
      expect(result.caveat).toBeNull()
      expect(result.conservative).toBe(true)
    })

    it('close_call: does NOT append suffix — reserved definitive phrasing', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'unknown',
        coachingReadiness: 'close_call',
        winProbabilityGap: 5,
      })
      expect(result.headline).toBe(AHEAD)
    })

    it('row 6 (strong + ready): does NOT append suffix — reserved definitive phrasing', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
        winProbabilityGap: 50,
      })
      expect(result.headline).toBe(AHEAD)
    })

    it('confident fallback: appends suffix as "{winner} leads by N points"', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        winProbabilityGap: 3,
      })
      expect(result.headline).toBe(`${WINNER} leads by 3 points`)
    })

    it('singular point uses "point" not "points" (soft path)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'needs_work',
        winProbabilityGap: 1,
      })
      expect(result.headline).toBe(`${WINNER} currently leads by 1 point`)
    })

    it('rounds fractional gaps to the nearest whole point (confident fallback)', () => {
      const result = buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        winProbabilityGap: 4.6,
      })
      expect(result.headline).toBe(`${WINNER} leads by 5 points`)
    })

    it('omits suffix when gap is 0, negative, or non-finite — confident fallback emits the definitive leader headline (re-anchored)', () => {
      for (const gap of [0, -1, NaN, Infinity, -Infinity]) {
        // Use confident fallback path. No gap → no suffix → the definitive leader headline (re-anchored).
        const result = buildCertaintyCopy({
          verdict: clearVerdict(),
          winnerLabel: WINNER,
          winProbabilityGap: gap,
        })
        expect(result.headline).toBe(AHEAD)
      }
    })

    it('row 2 (tied) ignores gap — canonical unstable copy is preserved', () => {
      const result = buildCertaintyCopy({
        winnerLabel: WINNER,
        recommendationStability: 0.55,
        winProbabilityGap: 95,
        verdict: tiedVerdict(),
      })
      expect(result.headline).toBe(
        'no clear leading option, the result is sensitive to your estimates',
      )
    })
  })

  describe('conservative flag — Brief 5.2 follow-up invariant', () => {
    it('row 1 (partial analysis) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER, analysisStatus: 'partial' }).conservative)
        .toBe(true)
    })

    it('row 2 (stability < 0.70) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER, recommendationStability: 0.55 }).conservative)
        .toBe(true)
    })

    it('row 3 (single option) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER, optionCount: 1 }).conservative).toBe(true)
    })

    it('row 4 (needs_work + low stability) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'needs_work' }).conservative)
        .toBe(true)
    })

    it('row 4 (fair + low stability) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER, confidenceTier: 'fair' }).conservative)
        .toBe(true)
    })

    it('row 5 (close_call) is conservative', () => {
      expect(buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        coachingReadiness: 'close_call',
      }).conservative).toBe(true)
    })

    it('row 6 (strong + ready) is NOT conservative — only path allowing coaching override', () => {
      expect(buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
        coachingReadiness: 'ready',
      }).conservative).toBe(false)
    })

    it('row 7 fallback (no tier / no readiness) is conservative', () => {
      expect(buildCertaintyCopy({ verdict: clearVerdict(), winnerLabel: WINNER }).conservative).toBe(true)
    })

    it('row 7 (strong but missing readiness) is conservative — strong alone does not opt in', () => {
      expect(buildCertaintyCopy({
        verdict: clearVerdict(),
        winnerLabel: WINNER,
        confidenceTier: 'strong',
      }).conservative).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// shouldSoftenPhrasing — direct helper coverage (importable by winnerChipCopy)
// ---------------------------------------------------------------------------

describe('shouldSoftenPhrasing — tier × stability gate', () => {
  it('returns true for needs_work + absent/low stability', () => {
    expect(shouldSoftenPhrasing('needs_work', undefined)).toBe(true)
    expect(shouldSoftenPhrasing('needs_work', 0.70)).toBe(true)
    expect(shouldSoftenPhrasing('needs_work', 0.84)).toBe(true)
  })

  it('returns true for fair + absent/low stability (new per §2.7)', () => {
    expect(shouldSoftenPhrasing('fair', undefined)).toBe(true)
    expect(shouldSoftenPhrasing('fair', 0.50)).toBe(true)
    expect(shouldSoftenPhrasing('fair', 0.84)).toBe(true)
  })

  it('returns false for any tier at stability ≥ 0.85 (override)', () => {
    expect(shouldSoftenPhrasing('needs_work', 0.85)).toBe(false)
    expect(shouldSoftenPhrasing('needs_work', 1.0)).toBe(false)
    expect(shouldSoftenPhrasing('fair', 0.85)).toBe(false)
    expect(shouldSoftenPhrasing('fair', 0.95)).toBe(false)
  })

  it('returns false for strong at any stability (readiness never softens)', () => {
    expect(shouldSoftenPhrasing('strong', undefined)).toBe(false)
    expect(shouldSoftenPhrasing('strong', 0.10)).toBe(false)
    expect(shouldSoftenPhrasing('strong', 0.95)).toBe(false)
  })

  it('returns false for unknown or undefined tier at any stability', () => {
    expect(shouldSoftenPhrasing('unknown', 0.50)).toBe(false)
    expect(shouldSoftenPhrasing(undefined, 0.50)).toBe(false)
    expect(shouldSoftenPhrasing(undefined, undefined)).toBe(false)
  })
})
