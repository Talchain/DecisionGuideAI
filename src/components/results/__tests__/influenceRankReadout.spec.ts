/**
 * ⭐⭐ THE RANKED INFLUENCE READOUT — the guards the readout shipped without.
 *
 * ⛔⛔ THIS SPEC HAS NEVER BEEN EXECUTED. Written under a hard no-install /
 * no-test-run constraint: no vitest, no tsc, no node_modules. Every expectation
 * below is derived by reading `influenceScaleCopy.ts` at this branch's tip, and
 * CI is the authority on whether it passes. Treat a green claim about it from
 * this lane as unsupported — there is none.
 *
 * ## The absence this closes, with its contrast control
 *
 * Swept at `2a433f99` with `rg -a`, the PR's four changed files and nothing
 * else:
 *
 *   target   `influenceRankReadout`   → 3 files, ALL SOURCE, 0 test
 *   target   `influenceSetSize`       → 2 files, ALL SOURCE, 0 test
 *   contrast `influenceBasisNoun`     → 10 files, including 5 dedicated specs
 *
 * The contrast fires hard in the same sweep, so the zero is a real absence and
 * not a blind probe (CLAUDE.md trap 13e). Concretely: at that tip
 * `influenceRankReadout` could be deleted from both of its call sites and
 * NOTHING in the suite would have gone red. A new user-facing readout with no
 * guard is the one thing this estate's delivery pipeline does not permit.
 *
 * ## What this file proves, and what it deliberately does not
 *
 * PROVES: the refusal arms, the ordinal construction, and the containment
 * invariant between the visible strings and the announced one.
 *
 * DOES NOT PROVE: that either call site consumes any of it. A pure-function
 * spec cannot see a deleted call site — `FactorNode.influenceRanking.spec.tsx`
 * is what REDs on that, and the two are not redundant.
 */
import { describe, it, expect } from 'vitest'
import {
  influenceRankReadout,
  influenceRankExplanation,
  influenceExplanation,
} from '../influenceScaleCopy'

describe('influenceRankReadout — the claim is made only where it is licensed', () => {
  it('rank 1 reads as the leader, and names the set it leads', () => {
    const r = influenceRankReadout(1, 5)
    expect(r).not.toBeNull()
    expect(r!.caption).toBe('Most influential')
    expect(r!.setSizeText).toBe('of 5')
    expect(r!.phrase).toBe('Most influential of 5 factors compared in this model')
  })

  it('ranks 2 and 3 take the ordinal, and the ordinal is not the rank digit alone', () => {
    expect(influenceRankReadout(2, 5)!.caption).toBe('2nd most influential')
    expect(influenceRankReadout(3, 5)!.caption).toBe('3rd most influential')
  })

  /**
   * ⚠ WRITTEN AGAINST THE SPEC, NOT AGAINST TODAY'S CAP (CLAUDE.md trap 13d).
   * `MAX_BADGED_RANK` is 3, so nothing above 3 is reachable at this tip and
   * these cases are about a cap that has already moved once. An invariant
   * written to the failure mode in hand rather than to the function's declared
   * domain is a guard agreeing with the code; `ordinalSuffix` declares itself
   * general, so it is tested generally.
   */
  it('the ordinal is correct at the 11/12/13 exception the cap will eventually reach', () => {
    expect(influenceRankReadout(11, 20)!.caption).toBe('11th most influential')
    expect(influenceRankReadout(12, 20)!.caption).toBe('12th most influential')
    expect(influenceRankReadout(13, 20)!.caption).toBe('13th most influential')
    // …and the ordinary cases either side of it, so the exception is proven to
    // be an exception rather than a blanket 'th'.
    expect(influenceRankReadout(21, 30)!.caption).toBe('21st most influential')
    expect(influenceRankReadout(22, 30)!.caption).toBe('22nd most influential')
    expect(influenceRankReadout(23, 30)!.caption).toBe('23rd most influential')
  })

  describe('every refusal arm — each is a state the product can actually be in', () => {
    it('no rank (tie gate withheld it, or below the badged depth) says nothing', () => {
      expect(influenceRankReadout(null, 5)).toBeNull()
      expect(influenceRankReadout(undefined, 5)).toBeNull()
    })

    it('no denominator degrades to silence, never to a guess', () => {
      expect(influenceRankReadout(1, null)).toBeNull()
      expect(influenceRankReadout(1, undefined)).toBeNull()
    })

    it('a set of one has a maximum, not a ranking', () => {
      expect(influenceRankReadout(1, 1)).toBeNull()
      expect(influenceRankReadout(1, 0)).toBeNull()
      // NON-VACUITY for the boundary: two IS a comparison, so the refusal above
      // is a threshold and not a blanket refusal.
      expect(influenceRankReadout(1, 2)).not.toBeNull()
    })

    it('an incoherent pair says nothing rather than reasoning about it', () => {
      expect(influenceRankReadout(6, 5)).toBeNull()
      expect(influenceRankReadout(0, 5)).toBeNull()
      expect(influenceRankReadout(-1, 5)).toBeNull()
    })

    it('a non-integer is refused — a rank of 1.5 is not a position', () => {
      expect(influenceRankReadout(1.5, 5)).toBeNull()
      expect(influenceRankReadout(1, 5.5)).toBeNull()
      expect(influenceRankReadout(Number.NaN, 5)).toBeNull()
      expect(influenceRankReadout(1, Number.NaN)).toBeNull()
      expect(influenceRankReadout(Number.POSITIVE_INFINITY, 5)).toBeNull()
    })
  })
})

/**
 * ⭐⭐ THE VISIBLE WORDS AND THE ANNOUNCED WORDS ARE THE SAME WORDS.
 *
 * The row paints `caption` and `setSizeText` and announces `phrase`. #1688
 * engineered prefix-containment on a neighbouring surface the same day for
 * exactly this reason.
 *
 * ⚠ SCOPE, STATED PRECISELY SO IT IS NOT OVERCLAIMED: the row publishes
 * `role="img"`, so WCAG 2.5.3 *Label in Name* does not strictly bite and NO
 * compliance claim is made here. What is asserted is the estate's own ruling
 * and the plain requirement that two channels describing one row agree.
 *
 * ⚠ DERIVED, NOT MIRRORED. Asserting `phrase` contains the OTHER TWO FIELDS
 * OF THE SAME OBJECT is a structural property that survives any copy edit; a
 * hand-copied expected string would drift the first time the wording moved and
 * would be re-pinned rather than re-checked.
 */
describe('containment: the visible text is inside the announced name', () => {
  for (const [rank, setSize] of [[1, 5], [2, 5], [3, 12], [2, 2]] as const) {
    it(`rank ${rank} of ${setSize}: caption and figure both appear verbatim in the phrase`, () => {
      const r = influenceRankReadout(rank, setSize)
      expect(r).not.toBeNull()
      expect(r!.phrase).toContain(r!.caption)
      expect(r!.phrase).toContain(r!.setSizeText)
      // The caption is the OPENING of the announced name, not merely present
      // somewhere inside it — that is what makes the two read as one sentence.
      expect(r!.phrase.startsWith(r!.caption)).toBe(true)
    })
  }

  it('NON-VACUITY: the containment is a real constraint, not true of any string', () => {
    // The pre-fix wording ('The most influential of the 5 factors compared in
    // this model') satisfied neither clause. Pinned as a negative control so
    // the assertions above are shown to discriminate.
    const historical = 'The most influential of the 5 factors compared in this model'
    const r = influenceRankReadout(1, 5)!
    expect(historical).not.toContain(r.caption)
    expect(historical).not.toContain(r.setSizeText)
  })
})

/**
 * ⭐⭐ THE PERCENTAGE IS DEMOTED, NOT DELETED — and this is the guard that keeps
 * the difference honest.
 *
 * Taking `100%` off the face of the card is the point of the change. Taking the
 * figure away from a reader who wants it would be hiding a finding, which this
 * estate's NO-HIDING ruling forbids. So the number must be in the disclosure,
 * stated with the scale that makes it meaningful.
 */
describe('influenceRankExplanation — the figure survives, with its scale attached', () => {
  it('carries the percentage', () => {
    const r = influenceRankReadout(1, 5)!
    expect(influenceRankExplanation(r, 100, 'normalised_elasticity', null)).toContain('100%')
    expect(influenceRankExplanation(r, 62, 'normalised_elasticity', null)).toContain('62%')
  })

  it('opens with the ranked phrase, so the tooltip and the row say the same thing first', () => {
    const r = influenceRankReadout(2, 5)!
    expect(influenceRankExplanation(r, 62, 'influence_score', null).startsWith(r.phrase)).toBe(true)
  })

  /**
   * ⚠ THE SCALE SENTENCE IS NOT RE-MINTED HERE, AND THAT IS THE MECHANISM.
   * `influenceRankExplanation` appends `influenceExplanation` verbatim, so this
   * row cannot drift from the pill or the Drivers panel. Asserted by COMPOSING
   * the other function rather than by pinning its text, so a future reword of
   * the shared sentence lands in both places or REDs here.
   */
  it('appends the shared scale sentence verbatim, for every provenance', () => {
    const r = influenceRankReadout(1, 5)!
    for (const p of ['normalised_elasticity', 'influence_score', null] as const) {
      expect(influenceRankExplanation(r, 100, p, null)).toContain(influenceExplanation(p, null))
    }
  })

  it('NON-VACUITY: the three provenances do not all produce the same sentence', () => {
    // If they did, the loop above would be one assertion wearing three hats —
    // sameness across inputs that ought to differ is evidence about the probe,
    // not about the world (CLAUDE.md trap 20).
    const relative = influenceExplanation('normalised_elasticity', null)
    const generic = influenceExplanation(null, null)
    expect(relative).not.toBe(generic)
  })
})
