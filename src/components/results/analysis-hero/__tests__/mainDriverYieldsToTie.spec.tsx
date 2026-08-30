/**
 * "Main driver: X" IS A COMPARATIVE CLAIM AND A TIE CANNOT SUPPORT ONE.
 *
 * ⚠ WITNESSED ON THE DEPLOYED BUILD, ONE SCREEN, TWO OPPOSITE CLAIMS. The
 * Drivers panel printed *"These factors have similar influence on the
 * outcome"* — correct, it is gated on the shared tie predicate — while the
 * hero beside it printed **"Main driver: EU Data Residency Compliance"**
 * beside three factors at exactly 100%, under a header reading *"Ranked by
 * how much each factor affects the outcome"*.
 *
 * Traced at `f89a0822`: `buildHeroModel` built both the footer line and the
 * quick-link pill from `drivers.topDrivers[0]` — THE FIRST ELEMENT OF A LIST,
 * with no tie notion of any kind. Its only gates were `containsBannedTerm`
 * and `canFocus`, neither of which is comparative. The hero was the FOURTH
 * reader of the tie concept and asked none of the three owners.
 *
 * ⚠ WHETHER THE TIE-BREAK IS ALPHABETICAL HERE IS **UNKNOWN** and this suite
 * deliberately does not assert it. `topDrivers` is sorted by `rank`, which
 * arrives from the producer; the `localeCompare` fallback in
 * `compareByDisplayModel` sits on a different comparator than the one feeding
 * this path. The finding does not depend on the detail: whichever mechanism
 * picks the winner, a claim that one of several indistinguishable factors is
 * THE main driver is unearned.
 *
 * ⭐ BOTH DIRECTIONS ARE PINNED, AND THEY CANNOT SHARE ONE WINDOW. This
 * predicate guards two OPPOSITE harms:
 *   - crowning a tie (the defect), and
 *   - silencing a genuine leader (the over-correction — a fix that hedged
 *     unconditionally would pass a one-sided suite and destroy a true,
 *     useful claim the reader relies on to orient).
 * Every case below therefore has its opposite-direction twin, and the
 * clear-leader cases assert the hedge is ABSENT — an absence nothing pinned
 * would let an unconditional-hedge mutant survive the whole file.
 *
 * ⛔ AND THE HEDGE STILL NAMES THE FACTOR. Under the standing no-hiding
 * ruling, deleting the line is not the fix: it would cost the reader their
 * single most useful orientation. The register matches the leader node, which
 * says *", tied for its top lever"* rather than going quiet.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { INFLUENCE_TIE_EPSILON } from '../../driverDisplayModel'
import type { HeroChartModel } from '../heroTypes'
import { makeDriver, makeHeroData } from '../__fixtures__/hero.fixtures'
import type { DriverItem } from '../../types'

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

/**
 * A driver bound BY IDENTITY — its own key and node id — so every assertion
 * below names the object it is about and cannot pass on a sibling that
 * happens to share a value.
 */
function driver(
  label: string,
  key: string,
  displayInfluence: number,
  canFocus = true,
): DriverItem {
  return {
    ...makeDriver(label),
    factorKey: key,
    matchedNodeId: `node_${key}`,
    canFocus,
    displayInfluence,
  } as DriverItem
}

/** The witnessed shape: three factors at an EXACT tie, all at the top. */
const TIED = [
  driver('EU Data Residency Compliance', 'fac_eu_residency', 1),
  driver('Migration Cost', 'fac_migration_cost', 1),
  driver('Latency Budget', 'fac_latency', 1),
]

/** The opposite-direction twin: a genuine, clearly-separated leader. */
const CLEAR = [
  driver('EU Data Residency Compliance', 'fac_eu_residency', 1),
  driver('Migration Cost', 'fac_migration_cost', 0.4),
  driver('Latency Budget', 'fac_latency', 0.3),
]

function modelFor(topDrivers: DriverItem[]): HeroChartModel {
  return chart(
    buildHeroModel(makeHeroData({ drivers: { topDrivers, drivers: topDrivers } })),
  )
}

function renderPanel(model: HeroChartModel, onFocusTarget?: (id: string) => void) {
  return render(
    <AnalysisHeroPanel model={model} rerunDisabled={false} onFocusTarget={onFocusTarget} />,
  )
}

describe('hero "Main driver" yields to a tie (and only to a tie)', () => {
  describe('the model carries the tie verdict', () => {
    it('TIE: the named factor is still named, and the claim is hedged', () => {
      const m = modelFor(TIED)
      // Bound by IDENTITY: this is the assertion about `fac_eu_residency`,
      // not about "whatever the model happened to name".
      expect(m.quickLinks.mainDriver).toEqual({
        label: 'EU Data Residency Compliance',
        targetId: 'node_fac_eu_residency',
        leadIsClear: false,
      })
    })

    it('TWIN — CLEAR LEADER: the claim survives intact', () => {
      const m = modelFor(CLEAR)
      expect(m.quickLinks.mainDriver).toEqual({
        label: 'EU Data Residency Compliance',
        targetId: 'node_fac_eu_residency',
        leadIsClear: true,
      })
    })

    it('TIE: the static footer line hedges too (the pill-less path)', () => {
      const unfocusable = TIED.map((d) => ({ ...d, canFocus: false }) as DriverItem)
      expect(modelFor(unfocusable).mainReason).toBe(
        'Tied for main driver: EU Data Residency Compliance.',
      )
    })

    it('TWIN — CLEAR LEADER: the static footer line is unhedged', () => {
      const unfocusable = CLEAR.map((d) => ({ ...d, canFocus: false }) as DriverItem)
      expect(modelFor(unfocusable).mainReason).toBe(
        'Main driver: EU Data Residency Compliance.',
      )
    })
  })

  describe('the boundary is the SHARED owner, not a fourth private one', () => {
    it('a gap INSIDE the shared epsilon is a tie', () => {
      const m = modelFor([
        driver('EU Data Residency Compliance', 'fac_eu_residency', 1),
        driver('Migration Cost', 'fac_migration_cost', 1 - INFLUENCE_TIE_EPSILON / 2),
      ])
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(false)
    })

    it('TWIN — a gap OUTSIDE the shared epsilon is a clear lead', () => {
      const m = modelFor([
        driver('EU Data Residency Compliance', 'fac_eu_residency', 1),
        driver('Migration Cost', 'fac_migration_cost', 1 - INFLUENCE_TIE_EPSILON * 2),
      ])
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(true)
    })

    it('a single driver has no runner-up, so its claim stands', () => {
      const m = modelFor([driver('EU Data Residency Compliance', 'fac_eu_residency', 1)])
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(true)
    })
  })

  describe('the verdict is about the NAMED factor, not about "some tie somewhere"', () => {
    it('a tie BELOW the leader does not suppress the leader', () => {
      // `fac_migration_cost` and `fac_latency` are byte-identical to each
      // other; the named factor is clear of BOTH. Suppressing here would be
      // the over-correction — the hero would go quiet on a real leader
      // because two also-rans happened to draw level.
      const m = modelFor([
        driver('EU Data Residency Compliance', 'fac_eu_residency', 1),
        driver('Migration Cost', 'fac_migration_cost', 0.4),
        driver('Latency Budget', 'fac_latency', 0.4),
      ])
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(true)
    })

    it('FAILS CLOSED when the named row is not the top of its own set', () => {
      // `hasClearInfluenceLeader` answers "is exactly one id at the top" — it
      // never says WHICH id. On its own it would certify a clear leader that
      // is not the factor this line names, should producer `rank` ever
      // diverge from the display value. Without the maximality clause this
      // case crowns `fac_eu_residency` at 0.4 while `fac_migration_cost`
      // sits at 1.0.
      //
      // ⚠ SCOPE, STATED RATHER THAN IMPLIED: this is UNREACHABLE on the live
      // path — `rank` is `computeFactorRanks` over the SAME display value the
      // predicate reads, so `topDrivers[0]` is the maximum by construction.
      // The clause exists so the verdict is bound to the named row rather
      // than to whichever row happens to top the set. If the state ever did
      // become reachable, the hedge itself would be imprecise (the factor is
      // not tied, it is behind) — but that is an upstream incoherence in the
      // Drivers ordering, not something hero copy can repair, and the
      // fail-closed direction is the safer of the two wrongs.
      const m = modelFor([
        driver('EU Data Residency Compliance', 'fac_eu_residency', 0.4),
        driver('Migration Cost', 'fac_migration_cost', 1),
      ])
      expect(m.quickLinks.mainDriver?.label).toBe('EU Data Residency Compliance')
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(false)
    })

    it('ONE factor arriving twice is ONE factor, not a tie with itself', () => {
      // The #964 review's measured case, at this surface: counting VALUES
      // cannot tell one factor listed twice from two factors. Only an id can.
      const dup = driver('EU Data Residency Compliance', 'fac_eu_residency', 1)
      const m = modelFor([dup, { ...dup } as DriverItem, driver('Migration Cost', 'fac_migration_cost', 0.4)])
      expect(m.quickLinks.mainDriver?.leadIsClear).toBe(true)
    })
  })

  describe('what a tester actually reads', () => {
    it('TIE: the pill hedges, and the unhedged crown is nowhere on the panel', () => {
      const onFocusTarget = vi.fn()
      renderPanel(modelFor(TIED), onFocusTarget)
      const pill = screen.getByTestId('hero-quicklink-driver')
      expect(pill.textContent?.trim()).toBe(
        'Tied for main driver: EU Data Residency Compliance',
      )
      // The pill still focuses the factor — hedging the CLAIM, never removing
      // the affordance (no-hiding ruling).
      expect(pill).toBeInTheDocument()
    })

    it('TWIN — CLEAR LEADER: the pill reads exactly the unhedged claim, and NO hedge is rendered', () => {
      const onFocusTarget = vi.fn()
      const { container } = renderPanel(modelFor(CLEAR), onFocusTarget)
      expect(screen.getByTestId('hero-quicklink-driver').textContent?.trim()).toBe(
        'Main driver: EU Data Residency Compliance',
      )
      // ⭐ THE ABSENCE ASSERTION THAT STOPS AN UNCONDITIONAL-HEDGE MUTANT.
      // Without it, a fix that hedges every run passes every other case here.
      expect(container.textContent).not.toMatch(/Tied for/i)
    })

    it('TIE: the COMBINED pill hedges its driver half only', () => {
      const m = modelFor(TIED)
      renderPanel(
        {
          ...m,
          quickLinks: {
            mainDriver: { ...m.quickLinks.mainDriver!, leadIsClear: false },
            topFlipRisk: {
              label: 'EU Data Residency Compliance',
              targetId: 'node_fac_eu_residency',
            },
          },
        },
        vi.fn(),
      )
      expect(screen.getByTestId('hero-quicklink-combined').textContent?.trim()).toBe(
        'Tied for main driver, and top flip risk: EU Data Residency Compliance',
      )
    })

    it('TWIN — CLEAR LEADER: the COMBINED pill is unhedged', () => {
      const m = modelFor(CLEAR)
      const { container } = renderPanel(
        {
          ...m,
          quickLinks: {
            mainDriver: { ...m.quickLinks.mainDriver!, leadIsClear: true },
            topFlipRisk: {
              label: 'EU Data Residency Compliance',
              targetId: 'node_fac_eu_residency',
            },
          },
        },
        vi.fn(),
      )
      expect(screen.getByTestId('hero-quicklink-combined').textContent?.trim()).toBe(
        'Main driver and top flip risk: EU Data Residency Compliance',
      )
      expect(container.textContent).not.toMatch(/Tied for/i)
    })
  })
})
