import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { OPT_HEDGE, admission, resetStore, setStore } from '../../__tests__/helpers/admissionGatesHarness'

/**
 * ⚠ THIS FILE EXISTS BECAUSE OF A BOUNDARY, AND THE BOUNDARY IS RIGHT.
 *
 * These cells started life inside `analysisNew`'s truth-table spec, so that one
 * predicate's table sat in one file. That import RED-ed `inertness.spec.ts`:
 * only `ResultsBody` may import the analysis hero, and the hero is fenced on
 * purpose. The table is therefore split BY SITE, each half inside its own
 * fence, with this comment as the join.
 *
 * ⚠ AND IT ONLY SURFACED IN CI. A focused local run cannot see a repo-wide
 * import guard, so the cells below were verified locally and reported as done
 * while the file was failing at the import gate before reaching them — the
 * same subset-versus-named-gate trap that took this PR's sibling red earlier
 * the same night.
 */

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
