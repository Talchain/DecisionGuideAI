/**
 * `isUnquantifiedPrior` — the ONE discriminator for "this prior is ignorance,
 * not an estimate".
 *
 * ── WHY A FLAG AND NOT THE RANGE ────────────────────────────────────────────
 *
 * CEE (`cee/provenance/unquantified-factor.ts`, PR #1223) stops substituting a
 * placeholder `0.5` for a factor the brief gave no number for. The factor now
 * arrives with `prior: { distribution: 'uniform', range_min: 0, range_max: 1,
 * prior_is_unquantified: true }` — maximal uncertainty, LABELLED as ignorance.
 *
 * ⚠ A RANGE IS NOT SELF-DESCRIBING. `{0, 1}` from a genuine external prior and
 * `{0, 1}` from ignorance are BYTE-IDENTICAL and mean opposite things. Two
 * corpora, measured 30 Aug 2026, return opposite verdicts on a range predicate:
 *   · #1223's own corpus holds GENUINE `uniform(0,1)` priors (`fac_nrr`,
 *     `fac_legal_clearance`) that a range test would wrongly suppress;
 *   · a sweep of all five shipped starters found 14 priors, ALL narrowed
 *     (0.4–0.9, 0.25–0.75, 0.3–0.8 …) and NONE at exactly (0,1) — so a range
 *     discriminator would have shown zero false positives there and PASSED
 *     REVIEW.
 * No corpus can prove a range predicate unambiguous; it can only fail to have
 * found the counterexample yet. The flag is the only discriminator that can be
 * validated at all.
 *
 * ── POSITIVE EVIDENCE ONLY, AND THE BREADTH IS THE POINT ────────────────────
 *
 * Written against the SPEC — *"a prior is ignorance when, and only when, it
 * says so"* — not against the failing input. It is deliberately NOT `!== false`,
 * NOT truthiness, and NOT "has a prior": each of those is wider than the spec,
 * and a widened predicate here would suppress a genuine estimate's display.
 * This mirrors CEE's own `factorIsExplicitlyUnquantified` breadth test, which
 * refuses the same near-misses for the same reason.
 *
 * ⚠ NAMED APART FROM CEE'S TWIN ON PURPOSE (CLAUDE.md trap 21). CEE's
 * `factorIsExplicitlyUnquantified` takes a NODE and answers "may the validator
 * relax its value gate?". This takes a PRIOR and answers "may a surface present
 * this as an estimate?". Different subjects, different questions, different
 * names — so they can never be conflated into one.
 */
import { describe, it, expect } from 'vitest'
import { PRIOR_IS_UNQUANTIFIED_FIELD, isUnquantifiedPrior } from '../nodes'

/**
 * The shape CEE's `buildUnquantifiedPrior()` emits, read from
 * `cee/provenance/unquantified-factor.ts` at PR #1223 head
 * `aa330ffe62bc9ccac766f6628ad261064f976b26` (30 Aug 2026).
 * Built through the shared constant, so a spelling change cannot pass here.
 */
const IGNORANCE_PRIOR = {
  distribution: 'uniform',
  range_min: 0,
  range_max: 1,
  [PRIOR_IS_UNQUANTIFIED_FIELD]: true,
}

/**
 * The opposite-direction twin, and the whole reason this predicate exists.
 * Byte-identical to the above except for the flag. Drawn from the real
 * `fac_weather` node in `t2b-export-pristine.json` (walk-582 export fixture),
 * which is a genuine external prior at uniform(0,1) with no flag.
 */
const GENUINE_UNIFORM_0_1 = {
  distribution: 'uniform',
  range_min: 0,
  range_max: 1,
}

describe('PRIOR_IS_UNQUANTIFIED_FIELD — one spelling, declared once', () => {
  it('is the spelling CEE writes', () => {
    // The UI's pinned contract (@talchain/schemas 0.48.0) does NOT carry this
    // field — verified by unpacking the vendored tarball on 30 Aug 2026
    // (target 0 files; positive control `range_min` 13 files; fabricated
    // control 0 files). The pin must not move (CEE 0.50.0 / UI 0.48.0 skew is a
    // hard 422 on the whole turn), so the UI declares the spelling itself. This
    // assertion is what stops the two estates drifting silently.
    expect(PRIOR_IS_UNQUANTIFIED_FIELD).toBe('prior_is_unquantified')
  })
})

describe('isUnquantifiedPrior — the flag, never the range', () => {
  it('ACCEPTS the marked ignorance prior', () => {
    expect(isUnquantifiedPrior(IGNORANCE_PRIOR)).toBe(true)
  })

  it('⭐ THE TWIN — REFUSES a genuine uniform(0,1) prior that differs ONLY by the flag', () => {
    // PRECONDITION PINNED IN-TEST (trap 13b): the two fixtures must be
    // identical apart from the flag, or a green result below could be the
    // fixture's doing rather than the predicate's.
    const { [PRIOR_IS_UNQUANTIFIED_FIELD]: _flag, ...marked } = IGNORANCE_PRIOR
    expect(marked).toEqual(GENUINE_UNIFORM_0_1)

    expect(isUnquantifiedPrior(GENUINE_UNIFORM_0_1)).toBe(false)
  })

  it('REFUSES a genuine narrowed prior (positive control from the shipped starters)', () => {
    expect(isUnquantifiedPrior({ distribution: 'uniform', range_min: 0.4, range_max: 0.9 })).toBe(false)
  })

  it('REFUSES the near-miss forms — positive evidence only, never truthiness', () => {
    expect(isUnquantifiedPrior(undefined)).toBe(false)
    expect(isUnquantifiedPrior(null)).toBe(false)
    expect(isUnquantifiedPrior({})).toBe(false)
    expect(isUnquantifiedPrior(0.5)).toBe(false)
    expect(isUnquantifiedPrior('prior_is_unquantified')).toBe(false)
    // Truthy-but-not-true must NOT pass. `!== false` and truthiness are both
    // wider than the spec, and a widened gate is how this estate loses gates.
    expect(isUnquantifiedPrior({ [PRIOR_IS_UNQUANTIFIED_FIELD]: 'true' })).toBe(false)
    expect(isUnquantifiedPrior({ [PRIOR_IS_UNQUANTIFIED_FIELD]: 1 })).toBe(false)
    expect(isUnquantifiedPrior({ [PRIOR_IS_UNQUANTIFIED_FIELD]: false })).toBe(false)
  })

  it('reads the flag on the PRIOR, not on the node that carries it', () => {
    // The flag travels inside the prior it qualifies (CEE: "one owner, one
    // place") so it cannot be orphaned by a transform that moves one and not
    // the other. A node-level flag is not this predicate's subject.
    expect(isUnquantifiedPrior({ prior: IGNORANCE_PRIOR })).toBe(false)
  })
})
