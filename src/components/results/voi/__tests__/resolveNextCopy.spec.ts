/**
 * resolveNextCopy — the one-copy guarantee and the register's hygiene.
 *
 * ⭐ THE DRIFT GUARD HAS BEEN RESOLVED BY DELETION, not weakened — declared
 * here because a guard that quietly stops existing is the failure this file was
 * written about.
 *
 * Paul's 14-Aug ruling put the Resolve-next surface on a SECOND host, so the
 * ratified sentences were briefly rendered from two decks: this register, and
 * `v7/v7LensCopy.ts` for the "Alt view" host. Copying ratified copy is the
 * hand-maintained mirror (CLAUDE.md trap 12) and its drift is SILENT, so this
 * file opened with a byte-identity guard between the two decks plus a positive
 * control proving the comparison could fail. The V7 retirement DELETED the
 * second deck. There is now exactly ONE deck, which is the fold that guard was
 * written to make safe — so the guard is removed rather than reconstructed as
 * an equality against itself.
 *
 * WHAT REMAINS, AND WHY IT IS THE LOAD-BEARING HALF: hygiene the V7 deck never
 * had. `analysis-hero/__tests__/copyHygiene.spec.tsx` scans `HERO_COPY` only,
 * and the hero host reads this register DIRECTLY rather than through `HERO_COPY`
 * (see the em-dash note below), so without this file the register would be
 * unscanned by any glossary/trust sweep.
 */
import { describe, expect, it } from 'vitest'
import { findBannedTerm } from '@/test/glossaryBannedTerms'
import { RESOLVE_NEXT_COPY as R } from '../resolveNextCopy'
import {
  NO_EFFECT_CLAIM_PHRASES,
  HISTORICAL_NO_EFFECT_OVERCLAIM,
} from '../../__tests__/helpers/refutedEvpiClaimMatchers'

/** Every user-facing string the register can produce, templates applied. */
const ALL_STRINGS: ReadonlyArray<readonly [string, string]> = [
  ['tab', R.tab],
  ['note', R.note],
  ['lead', R.lead],
  ['then', R.then],
  ['below', R.below('Customer churn rate, Enterprise market demand')],
  ['partial', R.partial],
  ['gate', R.gate],
  ['noneAboveResolution', R.noneAboveResolution],
  ['decisionNotZero', R.decisionNotZero],
  ['decisionZero', R.decisionZero],
]

describe('register hygiene', () => {
  it.each(ALL_STRINGS)('%s contains no canonical glossary banned term', (_name, copy) => {
    const hit = findBannedTerm(copy)
    expect(hit, `"${copy}" contains banned term "${hit}"`).toBeNull()
  })

  it('positive control: the glossary scanner fires on bad copy', () => {
    expect(findBannedTerm('the recommended winner uses the graph')).not.toBeNull()
  })

  /**
   * The trust/banding vocabulary no UI-authored copy may contain — the same list
   * `analysis-hero/__tests__/copyHygiene.spec.tsx` applies to `HERO_COPY`. A
   * register rendered on the hero surface answers to the hero's rules.
   */
  const TRUST_FORBIDDEN = [
    'trust', 'provisional', 'firm', 'moderate', 'fragile',
    'confidence', 'stability', 'stable', 'robust',
  ]

  it.each(TRUST_FORBIDDEN)('authors no trust/banding word: %s', (term) => {
    const re = new RegExp(`\\b${term}\\b`, 'i')
    expect(`a ${term} b`, `regex for "${term}" must fire`).toMatch(re)
    for (const [name, copy] of ALL_STRINGS) {
      expect(copy, `${name} should not contain "${term}"`).not.toMatch(re)
    }
  })

  it.each(ALL_STRINGS)('%s uses no all-caps word', (_name, copy) => {
    expect(copy).not.toMatch(/\b[A-Z]{2,}\b/)
  })

  it.each(ALL_STRINGS)('%s contains NO DIGIT', (_name, copy) => {
    // The structural no-magnitude guarantee, asserted at the source as well as
    // at the DOM: `evppi` and `decision_evpi` are in OUTCOME units with no
    // licensed display, so no sentence in this register may ever carry a number.
    expect(copy).not.toMatch(/\d/)
  })

  it.each(ALL_STRINGS)('%s makes no L61 no-effect claim', (_name, copy) => {
    for (const phrase of NO_EFFECT_CLAIM_PHRASES) {
      expect(copy.toLowerCase(), `contains banned no-effect phrase "${phrase}"`).not.toContain(phrase)
    }
  })

  it('POSITIVE CONTROL — the no-effect sweep would fail the historical overclaim', () => {
    expect(
      NO_EFFECT_CLAIM_PHRASES.some((p) => HISTORICAL_NO_EFFECT_OVERCLAIM.toLowerCase().includes(p)),
      'the sweep must be capable of failing the sentence it exists to keep out',
    ).toBe(true)
  })

  /**
   * ⚠ ADDED AFTER A SURVIVING MUTANT, and the survivor is worth recording.
   *
   * Deleting `'would change the recommendation'` from `NO_EFFECT_CLAIM_PHRASES`
   * left every sweep in this lane GREEN. Cause: the control above is a
   * `.some()`, and the historical overclaim happens to contain TWO banned
   * phrases — so removing one still satisfied it. The control proved that SOME
   * phrase discriminates, never that the LIST is intact, and a list that can be
   * silently shortened is the hand-maintained mirror one level up (trap 12).
   *
   * The fix is the honest one for a doctrine list: pin the EXACT set, so the
   * suite REDs if it grows OR shrinks (trap 22f). Growing is not a failure to
   * fear — it is a change that should be seen and argued for, which is precisely
   * what an assertion on the exact set forces.
   */
  it('the L61 phrase list is EXACTLY these eight phrases (it cannot be silently shortened)', () => {
    expect([...NO_EFFECT_CLAIM_PHRASES].sort()).toEqual(
      [
        'would change the recommendation',
        'no single unknown',
        "wouldn't change",
        'would not change',
        'makes no difference',
        'not worth',
        'no value',
        'zero value',
      ].sort(),
    )
  })

  /**
   * ⭐⭐ THE HONESTY CEILING, PINNED POSITIVELY — the other surviving mutant.
   *
   * Paraphrasing `decisionNotZero` left the render assertions GREEN, because
   * they compare the rendered text with THIS SAME CONSTANT: a guard agreeing
   * with itself (trap 13b). Those assertions are still the right ones — their
   * threat model is a COMPONENT that renders a paraphrase — but they leave the
   * WORDS themselves unpinned, and the words are where the whole scientific
   * claim lives.
   *
   * So this test binds the DOCTRINE rather than the literal: any rewording that
   * keeps the licensed framing passes, and the specific overclaims cannot appear.
   *
   * WHY THESE ARE THE OVERCLAIMS. `decision_evpi` arrives with no noise floor,
   * no CI and no `n_samples` of its own, so a small positive value is not
   * distinguishable from estimator noise. "The run did not come back at zero" is
   * a statement about the returned value and is supported. "There is value in
   * learning more" is a significance claim the wire cannot support — it needs a
   * decision-level precision handle that does not exist yet, and inventing one
   * from `factor_evppi.noise_floor` would substitute a different estimand.
   * Nothing in the glossary, trust-word, digit or L61 sweeps above would catch
   * that sentence; only this test would.
   */
  const UNLICENSED_SIGNIFICANCE_CLAIMS = [
    /there (?:is|may be|could be) (?:real )?value/i,
    /worth learning more/i,
    /would improve/i,
    /significant/i,
    /material(?:ly)?\b/i,
    /you should (?:resolve|learn|investigate)/i,
    /more precision would/i,
    /(?:high|low|moderate) (?:value|information)/i,
  ]

  it.each(UNLICENSED_SIGNIFICANCE_CLAIMS)(
    'the decision-level sentences make no unlicensed significance claim: %s',
    (pattern) => {
      // Control: the pattern must be able to fire on a sentence we would reject.
      expect(
        'Measured for the decision as a whole, there is value in learning more.',
        'at least one pattern must match the exemplar overclaim',
      ).toSatisfy((s: string) => UNLICENSED_SIGNIFICANCE_CLAIMS.some((p) => p.test(s)))
      expect(R.decisionNotZero).not.toMatch(pattern)
      expect(R.decisionZero).not.toMatch(pattern)
    },
  )

  it('the not-zero sentence keeps its LICENSED framing (the absence of a zero measurement)', () => {
    // The load-bearing clause. It says what the producer returned, framed as the
    // absence of the zero measurement — deliberately weaker than "there is
    // value". A rewrite that drops this framing has changed the claim, not the
    // prose, and must be argued for rather than slipped in.
    expect(R.decisionNotZero.toLowerCase()).toContain('did not come back at zero')
    // And it states the SCOPE of the per-factor ranking it sits beneath —
    // licensed verbatim by the pinned schema's factor-EVPPI absence rule
    // ("a factor absent from this array was not assessed — a lever an option
    // intervenes on"). This is what stops the ranking reading as exhaustive.
    expect(R.decisionNotZero.toLowerCase()).toContain('one at a time')
    expect(R.decisionNotZero.toLowerCase()).toContain('an option already controls')
  })

  it('the zero sentence claims a MEASURED zero, never an absence', () => {
    // The contract: "Absence means NOT COMPUTED — never 0. A measured 0 is a
    // real result." This sentence may only ever describe the second.
    expect(R.decisionZero.toLowerCase()).toContain('came back at zero')
    expect(R.decisionZero.toLowerCase()).toContain('would leave the same choice')
    // It must never hedge into absence vocabulary, which would merge the two
    // states the contract says the wire cannot distinguish for us.
    //
    // ⚠ "unknown" IS DELIBERATELY ABSENT FROM THIS PATTERN — my first version
    // included it and the test correctly failed on the sentence's own
    // "learning every unknown". `unknown(s)` is this product's word for an
    // UNCERTAIN FACTOR ("tell these unknowns apart"), not for a missing value, so
    // banning the bare token would have banned the domain vocabulary. The pattern
    // now names the absence PHRASES only. (Trap 13d in miniature: an invariant
    // has to be written against the spec's actual vocabulary, not against a
    // plausible-looking approximation of it.)
    expect(R.decisionZero.toLowerCase()).not.toMatch(
      /not computed|unavailable|no data|value unknown|unknown value|could not be computed/,
    )
  })

  it('both sentences attribute the measurement to THE DECISION AS A WHOLE', () => {
    // The estimand distinction that makes the line worth rendering at all:
    // `factor_evppi` answers "what is one unknown worth on its own",
    // `decision_evpi` answers "what is resolving everything worth". A sentence
    // that dropped the scope would read as a claim about the listed factors.
    for (const s of [R.decisionNotZero, R.decisionZero]) {
      expect(s.toLowerCase()).toContain('for the decision as a whole')
    }
  })

  /**
   * ⚠ THE ONE DELIBERATE EXCEPTION TO THE HERO DECK'S STYLE RULES, STATED.
   *
   * `heroCopy.ts` bans em dashes and `copyHygiene.spec.tsx` enforces it over
   * `HERO_COPY`. Four of these sentences contain one, because they were ratified
   * for the V7 host first and `v7LensCopy.ts` already recorded the same
   * judgement for the same strings: "the wording is ratified elsewhere and
   * mirroring it inexactly is worse".
   *
   * That is why the hero component reads this register DIRECTLY instead of
   * re-exporting it through `HERO_COPY`: routing ratified shared copy through the
   * hero's own deck would either misfile it as hero-authored or force a carve-out
   * in a general style guard — and a style guard with a carve-out is a guard that
   * widens. The exception is pinned to the EXACT strings here, so it cannot creep.
   */
  it('the em dash exception is pinned to exactly these sentences', () => {
    const withEmDash = ALL_STRINGS.filter(([, copy]) => copy.includes('—')).map(([name]) => name)
    expect(withEmDash.sort()).toEqual(
      ['decisionNotZero', 'decisionZero', 'noneAboveResolution', 'note'].sort(),
    )
  })
})
