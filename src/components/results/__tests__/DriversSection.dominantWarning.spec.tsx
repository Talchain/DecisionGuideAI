/**
 * DriversSection: Dominant-factor warning (Fix 3)
 *
 * When the top driver's influence score is ≥ 0.8, a persistent warning
 * callout appears above the driver list alerting the user that the result
 * depends heavily on one factor.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

// Mock canvas focus helpers
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'factor-1',
    factorLabel: 'Customer Churn',
    rawElasticity: 0.8,
    normalisedInfluence: 1.0,
    influenceScore: 0.9,
    rank: 1,
    direction: 'negative',
    semanticLabel: 'biggest',
    canFocus: false,
    ...overrides,
  }
}

function makeData(drivers: DriverItem[], overrides: Partial<DriversSectionData> = {}): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
    ...overrides,
  }
}

describe('DriversSection: dominant-factor warning', () => {
  it('shows warning when top driver influence ≥ 0.8', () => {
    const driver = makeDriver({ influenceScore: 0.95, factorLabel: 'Market Size' })
    render(<DriversSection data={makeData([driver])} />)

    const warning = screen.getByTestId('dominant-factor-warning')
    expect(warning).toBeInTheDocument()
    expect(warning).toHaveAttribute('role', 'alert')
    expect(warning.textContent).toContain('Your result depends heavily on one factor')
    expect(warning.textContent).toContain('Market Size')
    expect(warning.textContent).toContain('95%')
  })

  it('shows warning at exactly 0.8 threshold', () => {
    const driver = makeDriver({ influenceScore: 0.8, factorLabel: 'Pricing' })
    render(<DriversSection data={makeData([driver])} />)

    expect(screen.getByTestId('dominant-factor-warning')).toBeInTheDocument()
    expect(screen.getByTestId('dominant-factor-warning').textContent).toContain('80%')
  })

  it('does not show warning when top driver influence < 0.8', () => {
    const driver = makeDriver({ influenceScore: 0.79 })
    render(<DriversSection data={makeData([driver])} />)

    expect(screen.queryByTestId('dominant-factor-warning')).not.toBeInTheDocument()
  })

  it('uses dominantFactorLabel from data when available', () => {
    const driver = makeDriver({ influenceScore: 0.9, factorLabel: 'Raw Label' })
    render(
      <DriversSection
        data={makeData([driver], { dominantFactorLabel: 'CEE Dominant Label' })}
      />,
    )

    const warning = screen.getByTestId('dominant-factor-warning')
    expect(warning.textContent).toContain('CEE Dominant Label')
  })

  it('clamps influence to 100% when > 1.0', () => {
    const driver = makeDriver({ influenceScore: 1.5, factorLabel: 'Overfit Factor' })
    render(<DriversSection data={makeData([driver])} />)

    const warning = screen.getByTestId('dominant-factor-warning')
    expect(warning.textContent).toContain('100%')
    expect(warning.textContent).not.toContain('150%')
  })

  it('does not show warning when drivers list is empty', () => {
    render(<DriversSection data={makeData([])} />)

    expect(screen.queryByTestId('dominant-factor-warning')).not.toBeInTheDocument()
  })

  it('does not show warning when status is not computed', () => {
    const driver = makeDriver({ influenceScore: 0.95 })
    render(
      <DriversSection
        data={makeData([driver], { driversStatus: 'unavailable' })}
      />,
    )

    expect(screen.queryByTestId('dominant-factor-warning')).not.toBeInTheDocument()
  })
})
