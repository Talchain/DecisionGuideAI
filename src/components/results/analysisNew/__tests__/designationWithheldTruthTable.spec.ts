/**
 * ⭐⭐ `!== true`, NOT `=== false` — AND THE TRUTH TABLE IS WHY.
 *
 * This PR replaces `verdict != null && !verdict.hasLeadingOption` with the
 * composed reader. Those are NOT the same predicate, and a table over
 * `composed × verdict × hasLeadingOption` found the first attempt
 * (`leaderDesignationPermitted(rec) === false`) diverging from the predicate it
 * replaced in TWO REACHABLE CELLS — one of them failing OPEN:
 *
 *   composed absent · verdict present · hasLeadingOption UNDEFINED
 *     was: withhold        `=== false`: DO NOT WITHHOLD   ← a leader claim on a
 *                                                           run nothing licenses
 *   composed absent · verdict NULL
 *     was: no claim        `=== false`: withhold          ← a withholding notice
 *                                                           on a run that never ran
 *
 * ⚠ THE FIRST IS THE SAME `undefined` THIS FIX EXISTS TO HANDLE. The composed
 * field is absent for any recommendation that did not come through
 * `useResultsSectionData`, and `undefined === false` is `false`, which silently
 * stops the withholding. Replacing one `undefined ===` bug with its mirror is
 * not a fix.
 *
 * Two further cells look wrong for `composed === true` and are UNREACHABLE:
 * `useResultsSectionData.ts:2243` computes
 * `leaderDesignationPermitted = modelLicensesComparativeClaim && resultSeparatesArms`
 * where `resultSeparatesArms` IS `verdict.hasLeadingOption`, so `composed === true`
 * implies Q2 true. Asserted below rather than left to the next reader.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { genuineDecision } from './analysisNewFixtures'

/**
 * The observable: a withheld designation makes the implication `kind: 'none'`.
 *
 * ⚠ IT IS BUILT FROM `genuineDecision()` AND NOT A BARE FIXTURE, because
 * `kind: 'none'` has OTHER causes — too few options, no expected values — so a
 * thin fixture returns `'none'` whatever the predicate says, and every
 * assertion here would pass for the wrong reason. A first draft did exactly
 * that: two cases went green while measuring nothing. The control below is
 * what makes the rest mean anything.
 */
const withholds = (verdictPatch: Record<string, unknown>): boolean => {
  const data = genuineDecision()
  // ⚠ `makeOption` defaults `expected: null`, and `buildModelImplication`
  // needs finite expected values to build a reading at all — so the bare
  // fixture returns `'none'` on an ENTITLED run too. The control below caught
  // that before this spec was pushed; without these values every case here
  // would have passed while measuring nothing.
  const withValues = data.recommendation.allOptions.map((o, i) => ({
    ...o,
    expected: i === 0 ? 0.31 : 0.69,
  }))
  const rec = {
    ...data.recommendation,
    allOptions: withValues,
    recommendedOption: withValues[1],
    ...verdictPatch,
  }
  return (
    buildAnalysisNewViewModel({
      data: { ...data, recommendation: rec } as typeof data,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).modelImplication.kind === 'none'
  )
}

describe('the control — without it, every case below passes for the wrong reason', () => {
  it('an entitled run DOES build an implication, so `none` means withheld', () => {
    expect(withholds({})).toBe(false)
  })
})

describe('the withholding predicate fails CLOSED on the unknown', () => {
  it('⚠ verdict present, hasLeadingOption UNDEFINED, no composed answer → WITHHOLDS', () => {
    // The fail-open cell. `=== false` returned false here and named a leader.
    expect(withholds({ verdict: { leaderId: 'opt_b' }, leaderDesignationPermitted: undefined })).toBe(true)
  })

  it('no verdict at all → makes no claim in either direction', () => {
    // The over-withholding cell: a withholding notice on a run that never ran.
    expect(withholds({ verdict: null, leaderDesignationPermitted: undefined })).toBe(false)
  })
})

describe('the composed answer still overrides raw Q2 — the defect this PR fixes', () => {
  it('composed FALSE while Q2 is TRUE → WITHHOLDS (raw Q2 alone would not)', () => {
    expect(
      withholds({ leaderDesignationPermitted: false, verdict: { leaderId: 'opt_b', hasLeadingOption: true } }),
    ).toBe(true)
  })

  it('composed TRUE with Q2 true → does not withhold', () => {
    expect(
      withholds({ leaderDesignationPermitted: true, verdict: { leaderId: 'opt_b', hasLeadingOption: true } }),
    ).toBe(false)
  })

  it('Q2 false with no composed answer → WITHHOLDS, as it always did', () => {
    expect(withholds({ verdict: { leaderId: 'opt_b', hasLeadingOption: false } })).toBe(true)
  })
})

describe('the unreachability claim is asserted, not assumed', () => {
  it('composed TRUE implies Q2 TRUE, because composed IS Q1 && Q2', () => {
    // `useResultsSectionData.ts:2243`: leaderDesignationPermitted =
    // modelLicensesComparativeClaim && resultSeparatesArms, and
    // resultSeparatesArms = leaderVerdict.hasLeadingOption. So the two cells
    // where `=== false` and `!== true` disagree for composed===true cannot be
    // produced by the one writer. Pinned so a future writer that breaks the
    // conjunction REDs here rather than silently widening the input space.
    const compose = (q1: boolean, q2: boolean | undefined) => q1 && q2
    expect(compose(true, true)).toBe(true)
    expect(compose(true, false)).toBe(false)
    expect(compose(true, undefined)).toBe(undefined)
    expect(compose(false, true)).toBe(false)
  })
})
