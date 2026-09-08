/**
 * ⭐⭐ PERMISSION IS NOT INFERRED FROM SEPARATION.
 *
 * `leaderDesignationPermitted` is the ONE reader every designation site on the
 * panel uses, and it composes TWO questions:
 *
 *   Q1  does the MODEL license a comparative claim?   `permitted_analysis_mode`
 *   Q2  did THIS RESULT separate the arms?            `verdict.hasLeadingOption`
 *
 * `useResultsSectionData` conjoins them and publishes the answer as
 * `leaderDesignationPermitted`. When that field is ABSENT the reader used to
 * fall back to `verdict?.hasLeadingOption` — Q2 alone, which is precisely the
 * one-conjunct read the module exists to abolish, wearing the composed answer's
 * name.
 *
 * ⚠ THE OLD DOCSTRING JUSTIFIED THE FALLBACK IN ONE DIRECTION ONLY, and the
 * missing direction is the unsafe one. It argued (correctly) that a fixture
 * carrying `verdict: { hasLeadingOption: false }` and no composed field must
 * keep WITHHOLDING. It never stated the mirror: on `hasLeadingOption: true` the
 * same fallback hands back an unearned `true` — a LICENCE derived from
 * separation, on an object that never answered Q1 at all.
 *
 * THE RULE THIS SPEC PINS, and it is asymmetric on purpose:
 *
 *   Q2 alone may WITHHOLD.  Q2 alone may never LICENSE.
 *
 * ⚠⚠ WHY `undefined` AND NOT `false` FOR THE UNLICENSED CASE. Returning `false`
 * would manufacture a WITHHOLDING where the old code manufactured a LICENCE —
 * the mirror defect, not a fix — and it would align three consumer idioms that
 * `ResultsBody.tsx` documents as deliberately different (`=== false` permissive,
 * `=== true` conservative, raw pass-through). That file's own words: "the remedy
 * is naming, not aligning". `undefined` is the documented third state — NO
 * AUTHORITY AT ALL — and it leaves each consumer's absence arm exactly as it
 * was.
 *
 * ⚠ NOT USER-REACHABLE TODAY, AND THAT IS THE POINT OF THE PRODUCER ARM in
 * `useResultsSectionData.admissionGatesLeader.spec.ts`: the hook emits `verdict`
 * and `leaderDesignationPermitted` as siblings of one object literal, so no
 * production payload reaches the fallback carrying a verdict. Nothing pinned
 * that. This module is one call away from being live — `deriveRunLeaderVerdict`
 * (canvas/stores/analysisSnapshotFactory.ts) returns a `DecisionVerdict` with no
 * admission anywhere near it, so `leaderDesignationPermitted({ verdict })`
 * typechecks today and, before this change, answered `true`. A lane wiring the
 * Compare tab through this reader would have shipped a gate that changes
 * nothing and reads as licensed.
 */
import { describe, it, expect } from 'vitest'
import { leaderDesignationPermitted } from '../leaderDesignation'

/** The shape a caller outside `useResultsSectionData` can hand this reader. */
type Rec = {
  leaderDesignationPermitted?: boolean
  verdict?: { hasLeadingOption?: boolean }
}

/**
 * PRECONDITION HELPER. Every arm below that claims to test the ABSENT composed
 * field asserts it in-arm — otherwise a future edit that adds the key turns the
 * arm into a test of the composed path while still passing, which is how a
 * guard stops discriminating without going red.
 */
const assertComposedFieldAbsent = (rec: Rec) => {
  expect(
    Object.prototype.hasOwnProperty.call(rec, 'leaderDesignationPermitted'),
    'this arm tests the ABSENT composed answer; with the key present it tests the composed path instead',
  ).toBe(false)
}

describe('leaderDesignationPermitted — Q2 alone may WITHHOLD, never LICENSE', () => {
  /**
   * ⭐ THE DISCRIMINATING PAIR. Both arms are the SAME shape with ONE bit
   * flipped, so together they pin the ASYMMETRY rather than a direction. Either
   * alone is satisfied by a wrong function: arm 1 alone by `() => undefined`,
   * arm 2 alone by the unfixed `??` fallback.
   */
  it('LICENCE — a Q2-only recommendation whose result DID separate does NOT license a designation', () => {
    const rec: Rec = { verdict: { hasLeadingOption: true } }
    assertComposedFieldAbsent(rec)
    expect(
      rec.verdict?.hasLeadingOption,
      'Q2 must be TRUE here, or this arm is testing Q2 refusing rather than Q1 being unknown',
    ).toBe(true)
    expect(leaderDesignationPermitted(rec)).toBeUndefined()
  })

  it('WITHHOLDING — the same shape whose result did NOT separate still withholds (the documented regression stays closed)', () => {
    const rec: Rec = { verdict: { hasLeadingOption: false } }
    assertComposedFieldAbsent(rec)
    expect(rec.verdict?.hasLeadingOption, 'Q2 must be FALSE here or this arm is the pair’s twin').toBe(false)
    // `undefined === false` is `false`, so a reader that dropped this arm would
    // stop withholding on every fixture-driven test of the withheld path.
    expect(leaderDesignationPermitted(rec)).toBe(false)
  })

  /**
   * ⭐ THE LEGITIMATE PERMISSION PATH. Without these arms the rule above is
   * satisfied by a function that never licenses anything — which is the MIRROR
   * of the defect and the one this lane was warned about: `leaderDesignation`
   * gates eleven call sites, so an over-broad fix withholds leaders on runs that
   * ARE licensed.
   */
  it('PERMITS — the composed answer `true` still licenses, with a verdict present', () => {
    expect(
      leaderDesignationPermitted({ leaderDesignationPermitted: true, verdict: { hasLeadingOption: true } }),
    ).toBe(true)
  })

  it('PERMITS — the composed answer `true` licenses even when the object carries no verdict', () => {
    expect(leaderDesignationPermitted({ leaderDesignationPermitted: true })).toBe(true)
  })

  it('REFUSES — a composed `false` beats a TRUE Q2: the model’s refusal is final and is not fallen through', () => {
    // The arm that would break under a truthiness check (`rec.x ? … : …`)
    // instead of `!= null`: a composed `false` must be returned as `false`, not
    // discarded in favour of the very Q2 the model refused to license.
    expect(
      leaderDesignationPermitted({ leaderDesignationPermitted: false, verdict: { hasLeadingOption: true } }),
    ).toBe(false)
  })

  /**
   * NO AUTHORITY AT ALL keeps its own third state. Collapsing any of these to
   * `false` would turn the pre-run render — `useResultsSectionData`'s early exit
   * carries neither field — into an ACTIVE withholding on a state every user
   * passes through.
   */
  it('SILENCE — no authority at all stays `undefined`, never coerced to a refusal', () => {
    expect(leaderDesignationPermitted(null)).toBeUndefined()
    expect(leaderDesignationPermitted(undefined)).toBeUndefined()
    expect(leaderDesignationPermitted({})).toBeUndefined()
    // A verdict object that never answered Q2 either.
    expect(leaderDesignationPermitted({ verdict: {} })).toBeUndefined()
  })

  /**
   * ⚠ THE SHAPE THAT MADE THIS PROSPECTIVE DEFECT CONCRETE. `deriveRunLeaderVerdict`
   * hands back a full `DecisionVerdict` built from `option_probabilities`,
   * `robustness` and `decision_brief` — no admission is in scope on that path at
   * all — and the whole `src/canvas/compare-tab/` directory reads zero of the
   * licence symbols. Passing that verdict here typechecks. Pinned by VALUE, and
   * the precondition pins that the input really is the un-composed shape.
   */
  it('COMPARE-TAB SHAPE — a snapshot verdict routed through this reader is not silently licensed', () => {
    const snapshotLikeVerdict = { hasLeadingOption: true, leaderId: 'opt_bold', separation: 'clear' as const }
    const rec: Rec = { verdict: snapshotLikeVerdict }
    assertComposedFieldAbsent(rec)
    expect(snapshotLikeVerdict.hasLeadingOption, 'the snapshot verdict must claim a leader, or this arm is vacuous').toBe(true)
    expect(leaderDesignationPermitted(rec)).not.toBe(true)
  })
})
