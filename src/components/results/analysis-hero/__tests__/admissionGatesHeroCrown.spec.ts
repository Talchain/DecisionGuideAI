/**
 * ⭐ THE HERO'S CROWN OBEYS THE MODEL'S LICENCE — arms E/F/G of the admission gate.
 *
 * These live HERE, not beside the hook's arms, because `inertness.spec.ts`
 * enforces that nothing outside this directory imports `buildHeroModel`. The
 * guard is correct — the hero is meant to be inert — so the arms moved to it
 * rather than the guard being widened to admit a test. The fixture is shared
 * with the hook's arms via `__tests__/helpers/admissionGatesHarness`.
 *
 * ⚠ THESE ARMS ASSERT `leaders`, NOT AN INTERNAL FLAG. A first draft asserted
 * `hero.designationsWithheld`; it passed AND a mutant reddened it, but
 * `HeroModel` does not DECLARE that property, so the typecheck gate caught an
 * assertion reaching into a shape the type says cannot exist. `leaders` is the
 * typed, user-visible outcome — `Record<HeroLens, string | null>` — nulled when
 * the designation is withheld. Bind to the crown the user sees.
 *
 * ⭐ ARMS H/I ADDED — the CROWN was not the only thing that names a leader.
 * Arms E/F/G bind to `leaders` and were ALL GREEN while the HEADLINE named an
 * option and asserted it came out ahead, on exactly the turn arm E proves the
 * crown is withheld. A file that asserts one surface says nothing about the
 * other, and this file had ZERO headline assertions. `headline` is likewise
 * typed and user-visible, so the new arms bind to it directly.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { admission, setStore, resetStore, OPT_HEDGE, OPT_HEDGE_LABEL } from '../../__tests__/helpers/admissionGatesHarness'
import { leaderDesignationPermitted } from '../../leaderDesignation'
import { HERO_COPY } from '../heroCopy'

const heroHeadline = (data: ReturnType<typeof useResultsSectionData>) => {
  const hero = buildHeroModel(data)
  // Same vacuity guard as `heroLeaders`: an arm of the union without `headline`
  // would make every assertion below pass by testing nothing.
  expect('headline' in hero, 'the hero returned a shape with no `headline` — arm is vacuous').toBe(true)
  return (hero as Extract<typeof hero, { headline: unknown }>).headline
}

const heroLeaders = (data: ReturnType<typeof useResultsSectionData>) => {
  const hero = buildHeroModel(data)
  // The union has arms without `leaders`; reaching one would make every
  // assertion below vacuous, so it is a hard failure rather than a skip.
  expect('leaders' in hero, 'the hero returned a shape with no `leaders` — arm is vacuous').toBe(true)
  return (hero as Extract<typeof hero, { leaders: unknown }>).leaders
}

describe('the hero crown obeys the model licence', () => {
  beforeEach(resetStore)

  it('ARM E — the HERO withholds its crown when the model refuses', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    const r = renderHook(() => useResultsSectionData())
    const rec = r.result.current.recommendation
    expect(rec?.allOptions?.length, 'harness precondition').toBe(2)
    // Precondition pinned IN-ARM: Q2 is still TRUE, so a withheld crown below is
    // the MODEL's refusal and not a tied result.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must still be TRUE, or this arm tests Q2').toBe(true)

    const leaders = heroLeaders(r.result.current)
    expect(Object.values(leaders).filter(Boolean),
      'the hero still crowns an option the model does not license').toEqual([])
  })

  it('ARM F — the HERO still crowns when both permit (ARM E is not vacuous)', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    // Bound by IDENTITY to the option the fixture separates, not to "some leader".
    expect(Object.values(heroLeaders(r.result.current))).toContain(OPT_HEDGE)
  })

  it('ARM H — the HEADLINE withholds the leader claim when the model refuses', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    const r = renderHook(() => useResultsSectionData())
    const rec = r.result.current.recommendation
    expect(rec?.allOptions?.length, 'harness precondition').toBe(2)
    // Preconditions pinned IN-ARM, so a silent headline below is the MODEL's
    // refusal and not a tied or unseparated result. Without these the arm would
    // pass on a fixture that simply had no leader to name.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must still be TRUE, or this arm tests Q2').toBe(true)
    expect(leaderDesignationPermitted(rec!), 'the model must be REFUSING, or this arm is vacuous').toBe(false)

    const headline = heroHeadline(r.result.current)
    // Bound to the option's LABEL, because that is what the headline renders — an
    // earlier draft asserted on the id and could therefore NEVER fail, which is
    // precisely the vacuous-guard defect these arms exist to catch.
    expect(headline, 'the headline names the option the model refuses to designate').not.toContain(OPT_HEDGE_LABEL)
    // And the neutral arm is SILENCE, never a denial — `noClearLeader` ("No option
    // is clearly ahead.") stays reserved for a producer TIE call.
    expect(headline).toBe(HERO_COPY.headline.noLeader)
  })

  it('ARM I — the HEADLINE still names the leader when both permit (ARM H is not vacuous)', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    const r = renderHook(() => useResultsSectionData())
    const rec = r.result.current.recommendation
    expect(rec?.allOptions?.length, 'harness precondition').toBe(2)
    expect(leaderDesignationPermitted(rec!), 'this arm requires the model to PERMIT').toBe(true)
    // The positive twin: on the permitted turn the SAME fixture does name the
    // option, so ARM H is observing the gate rather than a fixture that never
    // names anyone.
    expect(heroHeadline(r.result.current)).toContain(OPT_HEDGE_LABEL)
  })

  it('ARM G — the HERO is unchanged when the producer has not spoken', () => {
    setStore({ separated: true })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    expect(Object.values(heroLeaders(r.result.current)),
      'absence must keep today\u2019s behaviour on every surface, not just the hook').toContain(OPT_HEDGE)
  })
})
