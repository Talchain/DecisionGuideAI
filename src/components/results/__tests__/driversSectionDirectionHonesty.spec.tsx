/**
 * R3 (ROADMAP 2.234 review) — the fix must reach the ONLY LIVE driver surface.
 *
 * 2.234 stopped the V5 mapper and `useResultsSectionData` FABRICATING a
 * direction. But the justification for "neutral renders honestly" named
 * `KeyDriversPanel`, `DriverChips` and `InsightsPanel` — and **all three have
 * zero non-test JSX mounts**. The one surface a tester actually sees is
 * `DriversSection` (`ResultsBody.tsx:559`), and its tooltip read
 *
 *     const sign = driver.direction === 'negative' ? '-' : ''
 *
 * so `mixed`, `unknown` and absent all produced "Higher values tend to shift
 * outcome by 12%" — an unsigned figure that reads as a rise, identical to
 * `positive`. The producer's refusal to assert a direction was still being
 * rendered as an assertion. **A fix that stops at the mapper is a fix the user
 * never receives.**
 *
 * CLAIM TYPE: text-level assertions on the rendered tooltip string. jsdom
 * cannot prove visibility (trap 3); nothing here is a layout claim.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriversSection, elasticityShiftCopy } from '../DriversSection'
import type { DriverItem } from '../types'

function driver(direction: DriverItem['direction']): DriverItem {
  return {
    factorKey: 'n_market',
    factorLabel: 'Market size',
    rawElasticity: 1.2,
    normalisedInfluence: 1,
    displayInfluence: 1,
    displayProvenance: 'normalised_elasticity',
    direction,
    semanticLabel: 'biggest',
    rank: 1,
  } as unknown as DriverItem
}

describe('elasticityShiftCopy — only a real direction gets a signed claim (ROADMAP 2.234, R3)', () => {
  it.each(['mixed', 'unknown', null, undefined] as const)(
    'producer direction %s → the shift is NOT presented as a rise',
    (d) => {
      const copy = elasticityShiftCopy(driver(d as DriverItem['direction'])) ?? ''
      expect(copy).toContain('direction not reported')
      // The bare positive form is exactly what `mixed` used to render.
      expect(copy).not.toBe('Higher values tend to shift outcome by 12%')
      expect(copy).not.toContain('-12%')
    },
  )

  it('CONTROL — `positive` keeps its wording, byte-identical to before', () => {
    expect(elasticityShiftCopy(driver('positive'))).toBe(
      'Higher values tend to shift outcome by 12%',
    )
  })

  it('CONTROL — `negative` keeps its explicit minus sign, byte-identical to before', () => {
    expect(elasticityShiftCopy(driver('negative'))).toBe(
      'Higher values tend to shift outcome by -12%',
    )
  })

  it('POSITIVE CONTROL — the magnitude survives for a non-directional driver (data is not suppressed)', () => {
    expect(elasticityShiftCopy(driver('mixed'))).toContain('12%')
  })

  it('the BINARY variant is gated the same way (a second call site cannot drift)', () => {
    const binary = { ...driver('mixed'), factorLabel: 'Hire a CTO (0/1)' } as DriverItem
    expect(elasticityShiftCopy(binary)).toBe(
      'When true, outcome tends to shift by 12% — direction not reported',
    )
    const binaryPos = { ...driver('positive'), factorLabel: 'Hire a CTO (0/1)' } as DriverItem
    expect(elasticityShiftCopy(binaryPos)).toBe('When true, outcome tends to shift by 12%')
  })

  it('below the elasticity floor there is no sentence at all (unchanged)', () => {
    const tiny = { ...driver('positive'), rawElasticity: 0 } as DriverItem
    expect(elasticityShiftCopy(tiny)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⚠ THE WIRING PIN — added because the RULE pin above did not cover it.
//
// Reverting `const tooltipElasticityCopy = elasticityShiftCopy(driver)` back to
// the old inline sign-fabricating expression — THE EXACT USER-VISIBLE DEFECT —
// left 284 files / 5,294 tests GREEN. Every test above calls the pure function
// directly; not one rendered `DriversSection`. A repo-wide NUL-safe search for
// "tends to shift" hits exactly two files (the component and that spec), and
// none of the 14 specs that DO render `<DriversSection` assert the tooltip.
//
// That is trap 11 on the one item where it matters most: R3's defect WAS "the
// fix never reaches the user", so pinning only the rule leaves precisely that
// defect free to recur. A correct function nobody calls is the same nothing as
// a correct comment nobody reads.
//
// CLAIM TYPE: text/presence on rendered output after a real click. jsdom cannot
// prove visibility (trap 3) — nothing here is a layout claim. The tooltip is
// opened through its actual affordance (the "More information" button, which
// carries `aria-expanded`), so this exercises the path a user takes.
// ─────────────────────────────────────────────────────────────────────────────
describe('DriversSection — the honest string reaches the RENDERED tooltip (ROADMAP 2.234, R3 wiring)', () => {
  function renderDrivers(direction: DriverItem['direction']) {
    return render(
      <DriversSection
        data={{
          // ⚠ `enrichment` is REQUIRED for the tooltip to exist at all.
          // `hasTooltipContent` has three arms and two are dead constants
          // (`DISPLAY_SAFE_DRIVER_CONFIDENCE = false`,
          // `SHOW_FRAGILITY_IN_DRIVER_SECTION = false`), so `hasEnrichment` is
          // the only live path — i.e. this copy reaches a user only on an
          // ENRICHED driver. Discovered while writing this pin; recorded because
          // it bounds who the R3 defect could ever have reached.
          drivers: [{ ...driver(direction), enrichment: { observations: ['obs'] } }],
          driversStatus: 'computed',
          hasMagnitudeData: true,
          islError: null,
          hiddenZeroImpactCount: 0,
        } as never}
      />,
    )
  }

  function openTooltip() {
    // The real affordance: `hasTooltipContent && isTopDriver` renders this
    // button, and `index === 0` makes our single driver the top one.
    const trigger = screen.getByRole('button', { name: 'More information' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  }

  it.each(['mixed', 'unknown', null] as const)(
    'producer direction %s → the OPEN tooltip says the direction is not reported',
    (d) => {
      const { container } = renderDrivers(d as DriverItem['direction'])
      openTooltip()
      const text = container.textContent ?? ''
      expect(text).toContain('direction not reported')
      // The fabricated form must be absent from the rendered DOM, not merely
      // from the function's return value.
      expect(text).not.toContain('Higher values tend to shift outcome by 12%,')
      expect(text).not.toMatch(/shift outcome by -12%/)
    },
  )

  it('CONTROL — `positive` still renders its signed-free rise wording in the open tooltip', () => {
    const { container } = renderDrivers('positive')
    openTooltip()
    const text = container.textContent ?? ''
    expect(text).toContain('Higher values tend to shift outcome by 12%')
    expect(text).not.toContain('direction not reported')
  })

  it('CONTROL — `negative` still renders its minus sign in the open tooltip', () => {
    const { container } = renderDrivers('negative')
    openTooltip()
    expect(container.textContent ?? '').toContain('-12%')
  })

  it('POSITIVE CONTROL — the tooltip is genuinely CLOSED before the click', () => {
    // Without this, the assertions above could pass against a tooltip that was
    // always open, and the click would be proving nothing.
    const { container } = renderDrivers('mixed')
    expect(container.textContent ?? '').not.toContain('direction not reported')
    openTooltip()
    expect(container.textContent ?? '').toContain('direction not reported')
  })
})
