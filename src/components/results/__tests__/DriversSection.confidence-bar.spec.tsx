/**
 * DriversSection Confidence Bar DOM Tests
 *
 * Verifies the confidence bar renders correctly at edge values (0.0, 0.5, 1.0)
 * now that PLoT's unified formula can produce any value in [0,1].
 * Previously confidence was hardcoded to 0.8 for all factors.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
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

describe('DriversSection confidence bar rendering', () => {
  it('renders 0% for confidence: 0.0 without layout breakage', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_zero', factorLabel: 'Zero confidence', confidence: 0.0 }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)

    const bar = screen.getByRole('progressbar', { name: /zero confidence confidence/i })
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders 50% for confidence: 0.5 (new common default)', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_half', factorLabel: 'Half confidence', confidence: 0.5 }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)

    const bar = screen.getByRole('progressbar', { name: /half confidence confidence/i })
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('renders 100% for confidence: 1.0 (full width)', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_full', factorLabel: 'Full confidence', confidence: 1.0 }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)

    const bar = screen.getByRole('progressbar', { name: /full confidence confidence/i })
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('renders dash when confidence is undefined', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_none', factorLabel: 'No confidence' }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)

    // No confidence progressbar should exist
    expect(screen.queryByRole('progressbar', { name: /no confidence confidence/i })).not.toBeInTheDocument()
    // Dash placeholder should be rendered
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
