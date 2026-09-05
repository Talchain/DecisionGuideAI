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
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { OPT_HEDGE, admission, resetStore, setStore } from '../../__tests__/helpers/admissionGatesHarness'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { genuineDecision } from './analysisNewFixtures'
import { buildHeroModel } from '../../analysis-hero/buildHeroModel'

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

/**
 * ⭐⭐ THE SAME PREDICATE, AT THE SITE THAT IS ACTUALLY MOUNTED.
 *
 * ⚠ A REVIEWER FOUND THE ASYMMETRY AND IT RAN THE WRONG WAY. Reverting the
 * hardening at `buildHeroModel.ts:325` left **4175/4175 GREEN across 260
 * files** — nothing pinned it — while reverting the `buildAnalysisNewViewModel`
 * site RED-ed immediately. And the hero MOUNTS UNCONDITIONALLY, whereas
 * `ModelImplication` has ZERO production importers.
 *
 * So the fix was pinned on the surface nobody sees and unpinned on the one
 * everybody does, and a future tidy-up would have reverted the live half
 * silently.
 *
 * ⚠ THE HERO NEEDS A REAL PAYLOAD, NOT A HAND-BUILT ONE. A first draft passed
 * the `analysisNew` fixture straight to `buildHeroModel` and the vacuity guard
 * fired: the hero returned an arm with no `leaders` at all, so all three cells
 * would have asserted on nothing. The store harness produces the shape the
 * hero actually consumes; the verdict is then patched on top of it, which is
 * the only way to reach `hasLeadingOption: undefined` — the store cannot
 * express it, and that cell is the fail-open.
 */
describe('the hero withholds on the same cells — the MOUNTED site', () => {
  beforeEach(resetStore)

  const heroLeaders = (patch: Record<string, unknown>) => {
    const r = renderHook(() => useResultsSectionData())
    const data = r.result.current
    expect(data.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    const hero = buildHeroModel({
      ...data,
      recommendation: { ...data.recommendation, ...patch },
    } as typeof data)
    expect('leaders' in hero, 'hero returned a shape with no `leaders` — arm is vacuous').toBe(true)
    return Object.values((hero as Extract<typeof hero, { leaders: unknown }>).leaders).filter(Boolean)
  }

  it('the control — an entitled run DOES crown, so an empty list means withheld', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    expect(heroLeaders({}).length).toBeGreaterThan(0)
  })

  it('⚠ verdict present, hasLeadingOption UNDEFINED → WITHHOLDS (the fail-open cell)', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    // The store cannot express this; it is patched on. `=== false` returned
    // false here and left the crown on.
    expect(heroLeaders({ verdict: { leaderId: OPT_HEDGE }, leaderDesignationPermitted: undefined })).toEqual([])
  })

  it('composed FALSE while Q2 is TRUE → WITHHOLDS', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    expect(heroLeaders({})).toEqual([])
  })
})
