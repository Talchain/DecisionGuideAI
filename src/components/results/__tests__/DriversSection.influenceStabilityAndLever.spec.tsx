/**
 * THE DRIVERS PANEL SAYS THE FIGURE DOES NOT MOVE, AND WHICH KIND OF ROW IT IS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS PINS THAT THE UNIT SPEC CANNOT
 * ═══════════════════════════════════════════════════════════════════════════
 * `influenceStabilityAndLeverCopy.spec.ts` pins the two functions. A function
 * returning the right string proves nothing about a panel that never calls it —
 * that is CLAUDE.md trap 3b, where a whole feature shipped dark twice because
 * every test was bound to a component the deployed flags did not mount. So this
 * suite renders the real `DriversSection` and binds by TEST ID.
 *
 * ⚠ THE FIXTURES CARRY `importanceBasis`, WHICH IS THE POINT. Both new
 * sentences are gated on the producer's own stamp resolving to `confirmed`, so
 * a fixture that omitted the stamp would render NEITHER — and every assertion
 * below would then be passing for the wrong reason. The unstamped case is
 * therefore an explicit negative case rather than an accident of the fixtures.
 *
 * ⚠ AND THE LEVER FIXTURE'S NUMBERS ARE NOT DECORATIVE. A demoted lever carries
 * `influence_score` at the top of the set with its sensitivity suppressed to
 * zero — witnessed in `live-influence-score-one-2026-08-23.json`, where
 * "Monthly Payroll Burn" is `influence_score: 1` with `elasticity: 0`. The
 * fixture reproduces that shape so the row clears the >= 0.01 visibility filter
 * exactly as the real one does.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import {
  INFLUENCE_STABILITY_DISCLOSURE,
  INFLUENCE_LEVER_DISCLOSURE,
  IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
} from '../influenceScaleCopy'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

const STABILITY = 'influence-stability-caption'
const LEVER = 'influence-lever-caption'
const QUANTITY = 'influence-quantity-caption'
const SCALE = 'influence-scale-caption'

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeData(drivers: DriverItem[], hasMagnitudeData = true): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData,
  }
}

/** The ordinary structural run: producer basis, stamp confirmed, no lever. */
function structuralConfirmed(): DriversSectionData {
  return makeData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Hiring and Salary Cost',
      normalisedInfluence: 1,
      influenceScore: 1,
      displayInfluence: 1,
      displayProvenance: 'influence_score',
      importanceBasis: IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
    }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Onboarding and Ramp Time',
      normalisedInfluence: 0.77,
      influenceScore: 0.77,
      displayInfluence: 0.77,
      displayProvenance: 'influence_score',
      importanceBasis: IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
      rank: 2,
      semanticLabel: 'moderate',
    }),
  ])
}

/** The same run with the top row a suppressed, option-controlled lever. */
function structuralWithLever(): DriversSectionData {
  const data = structuralConfirmed()
  return makeData([
    { ...data.drivers[0], rawElasticity: 0, zeroReason: 'intervention_override' },
    data.drivers[1],
  ])
}

/** Legacy / cached payload: the producer stamped no basis at all. */
function structuralUnstamped(): DriversSectionData {
  const data = structuralConfirmed()
  return makeData(data.drivers.map(d => ({ ...d, importanceBasis: undefined })))
}

/** A run the producer stamped with a basis this code cannot name. */
function structuralUnrecognised(): DriversSectionData {
  const data = structuralConfirmed()
  return makeData(data.drivers.map(d => ({ ...d, importanceBasis: 'isl_uncertainty' })))
}

/** The fallback basis: this app's own normalisation, not run-invariant. */
function fallbackBasis(): DriversSectionData {
  return makeData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Hiring and Salary Cost',
      normalisedInfluence: 1,
      displayInfluence: 1,
      displayProvenance: 'normalised_elasticity',
      importanceBasis: IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
    }),
  ])
}

describe('DriversSection — the figure discloses that it does not move', () => {
  it('POSITIVE CONTROL: the panel mounts and its existing captions still render', () => {
    // Every absence assertion below is worthless if the panel rendered nothing.
    render(<DriversSection data={structuralConfirmed()} />)
    expect(screen.getByTestId(SCALE)).toBeInTheDocument()
    expect(screen.getByTestId(QUANTITY)).toBeInTheDocument()
  })

  it('renders the stability sentence on a confirmed structural run', () => {
    render(<DriversSection data={structuralConfirmed()} />)
    expect(screen.getByTestId(STABILITY)).toHaveTextContent(INFLUENCE_STABILITY_DISCLOSURE)
  })

  /**
   * ⭐⭐ THE ADDITIVE PROPERTY. Four captions answer four different questions
   * and a run can owe the reader all of them (trap 21). A later tidy-up that
   * folded any into another would silently drop an answer, so the presence of
   * the pre-existing two is asserted alongside the new one rather than assumed.
   */
  it('does not displace the scale or quantity captions', () => {
    render(<DriversSection data={structuralConfirmed()} />)
    for (const id of [SCALE, QUANTITY, STABILITY]) {
      expect(screen.getByTestId(id), `${id} missing`).toBeInTheDocument()
    }
  })

  it.each([
    ['an unstamped run', structuralUnstamped],
    ['an unrecognised stamp', structuralUnrecognised],
    ['the fallback basis', fallbackBasis],
  ])('withholds the stability sentence on %s', (_label, build) => {
    render(<DriversSection data={build()} />)
    expect(screen.queryByTestId(STABILITY)).not.toBeInTheDocument()
  })

  it('WITHHOLDS the stability sentence while the quantity sentence still renders', () => {
    /**
     * ⭐ THE ASSERTION THAT PROVES THE PANEL USES TWO GATES AND NOT ONE.
     *
     * On an unstamped run the quantity caption is present and the stability
     * caption is absent, in the SAME render. A single shared predicate cannot
     * produce this, so a refactor collapsing them REDs here — and it REDs on
     * the render, not merely on the helper the unit spec covers.
     */
    render(<DriversSection data={structuralUnstamped()} />)
    expect(screen.getByTestId(QUANTITY)).toBeInTheDocument()
    expect(screen.queryByTestId(STABILITY)).not.toBeInTheDocument()
  })
})

describe('DriversSection — a top-ranked lever says which kind of row it is', () => {
  it('renders the lever sentence when a visible row is option-controlled', () => {
    render(<DriversSection data={structuralWithLever()} />)
    expect(screen.getByTestId(LEVER)).toHaveTextContent(INFLUENCE_LEVER_DISCLOSURE)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR AT THE RENDER, BOUND BY IDENTITY.
   *
   * The two fixtures differ in ONE field, `zeroReason`, and the numbers, labels
   * and stamps are otherwise identical. So a caption that appeared on both
   * would prove the panel is not reading the stamp at all, and one that
   * appeared on neither would prove the wiring is dead. Only the pair pins it.
   */
  it('withholds the lever sentence on the same run with no lever row', () => {
    render(<DriversSection data={structuralConfirmed()} />)
    expect(screen.queryByTestId(LEVER)).not.toBeInTheDocument()
  })

  it('shows the lever badge and the lever sentence together', () => {
    /**
     * The sentence tells the reader to look for a badge. If the badge were not
     * rendered on the same row, the sentence would point at nothing — a defect
     * neither element's own spec could see, because each is correct alone.
     */
    render(<DriversSection data={structuralWithLever()} />)
    expect(screen.getByTestId(LEVER)).toBeInTheDocument()
    expect(screen.getByTestId('driver-lever-badge-fac_a')).toBeInTheDocument()
  })

  it.each([
    ['an unstamped run', structuralUnstamped],
    ['an unrecognised stamp', structuralUnrecognised],
  ])('withholds the lever sentence on %s even if a lever is present', (_label, build) => {
    const base = build()
    const data = makeData([
      { ...base.drivers[0], rawElasticity: 0, zeroReason: 'intervention_override' },
      ...base.drivers.slice(1),
    ])
    render(<DriversSection data={data} />)
    expect(screen.queryByTestId(LEVER)).not.toBeInTheDocument()
  })
})
