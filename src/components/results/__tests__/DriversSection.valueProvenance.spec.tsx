/**
 * Track S — factor value provenance: normalize survival, no-DOM-leak, and
 * debug-only exposure.
 *
 * Covers (DGAI/UI passthrough brief):
 * - normalizeFactorSensitivity maps snake_case value_* → camelCase value* and
 *   preserves only-when-present (explicit false kept; absent stays absent;
 *   non-conforming types ignored).
 * - The values are NEVER rendered to the DOM in normal mode (no user-facing
 *   copy or badges) — uses sentinel strings to rule out coincidental matches.
 * - The values ARE surfaced in the existing window.__OLUMI_DEBUG diagnostic
 *   (verification-only) and are strictly gated behind that flag.
 *
 * End-to-end survival into `data.drivers` (normalize → DriverItem build) is
 * proven separately in useResultsSectionData.spec.ts; mapper survival in
 * test/__tests__/invariants/ui/value-provenance-preservation.test.ts.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import { normalizeFactorSensitivity } from '../useResultsSectionData'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    confidence: 0.5,
    ...overrides,
  }
}

function makeDriversData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

describe('Track S value provenance — normalizeFactorSensitivity', () => {
  const emptyLabels = new Map<string, string>()

  it('maps snake_case value_* to camelCase and preserves value_defaulted=true', () => {
    const n = normalizeFactorSensitivity(
      {
        factor_id: 'fac_a',
        elasticity: 0.5,
        value_source: 'brief_extraction',
        value_extraction_type: 'inferred',
        value_defaulted: true,
      },
      emptyLabels,
    )

    expect(n.valueSource).toBe('brief_extraction')
    expect(n.valueExtractionType).toBe('inferred')
    expect(n.valueDefaulted).toBe(true)
  })

  it('preserves an explicit value_defaulted=false (no coercion)', () => {
    const n = normalizeFactorSensitivity(
      { factor_id: 'fac_a', elasticity: 0.5, value_defaulted: false },
      emptyLabels,
    )
    expect(n.valueDefaulted).toBe(false)
  })

  it('leaves absent provenance fields absent (never coerced)', () => {
    const n = normalizeFactorSensitivity({ factor_id: 'fac_a', elasticity: 0.5 }, emptyLabels)
    expect(n.valueSource).toBeUndefined()
    expect(n.valueExtractionType).toBeUndefined()
    expect(n.valueDefaulted).toBeUndefined()
  })

  it('ignores non-conforming types via guarded extraction', () => {
    const n = normalizeFactorSensitivity(
      { factor_id: 'fac_a', elasticity: 0.5, value_source: 99, value_defaulted: 'true' },
      emptyLabels,
    )
    expect(n.valueSource).toBeUndefined()
    expect(n.valueDefaulted).toBeUndefined()
  })
})

describe('Track S value provenance — no user-facing DOM leak', () => {
  it('does not render raw provenance values as visible text or markup in normal mode', () => {
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        valueSource: 'SENTINEL_SOURCE',
        valueExtractionType: 'SENTINEL_EXTRACTION',
        valueDefaulted: true,
      }),
    ])

    const { container } = render(<DriversSection data={data} goalLabel="test" />)

    // Sanity: the section rendered. (The drivers-list wrapper is always present;
    // the Confidence header is hidden under the influence-only rule.)
    expect(screen.getByTestId('drivers-list')).toBeInTheDocument()
    // No visible text leak.
    expect(screen.queryByText(/SENTINEL_SOURCE/)).toBeNull()
    expect(screen.queryByText(/SENTINEL_EXTRACTION/)).toBeNull()
    // And no leak into markup either — title/aria-label/data-* attributes are not
    // text nodes, so this guards against a future regression that queryByText misses.
    expect(container.innerHTML).not.toContain('SENTINEL_SOURCE')
    expect(container.innerHTML).not.toContain('SENTINEL_EXTRACTION')
  })
})

describe('Track S value provenance — debug-only exposure (window.__OLUMI_DEBUG)', () => {
  afterEach(() => {
    delete (window as Window & { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG
    vi.restoreAllMocks()
  })

  const data = makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Factor A',
      valueSource: 'SENTINEL_SOURCE',
      valueExtractionType: 'SENTINEL_EXTRACTION',
      valueDefaulted: true,
    }),
  ])

  it('surfaces provenance in the diagnostic when the debug flag is on', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(window as Window & { __OLUMI_DEBUG?: boolean }).__OLUMI_DEBUG = true

    render(<DriversSection data={data} goalLabel="test" />)

    expect(warnSpy).toHaveBeenCalledWith(
      '[DriversSection] Data diagnostic:',
      expect.objectContaining({
        provenance: expect.arrayContaining([
          expect.objectContaining({
            factorKey: 'fac_a',
            valueSource: 'SENTINEL_SOURCE',
            valueExtractionType: 'SENTINEL_EXTRACTION',
            valueDefaulted: true,
          }),
        ]),
      }),
    )
  })

  it('emits nothing when the debug flag is off (strictly gated)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // __OLUMI_DEBUG left unset

    render(<DriversSection data={data} goalLabel="test" />)

    expect(warnSpy).not.toHaveBeenCalledWith(
      '[DriversSection] Data diagnostic:',
      expect.anything(),
    )
  })
})
