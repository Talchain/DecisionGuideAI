/**
 * DriversSection V11 Phase D: Driver #1 microline tests
 *
 * Tests that the "If wrong, {alternativeWinnerLabel} overtakes" microline
 * appears below driver #1 when fragile edge conditions are met.
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

function makeData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

describe('DriversSection: V11 driver #1 microline', () => {
  it('shows microline when driver #1 has fragile edge with switchProbability > 0 and alternativeWinnerLabel', () => {
    const driver = makeDriver({
      fragileEdgeInfo: {
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Option B',
      },
    })
    render(<DriversSection data={makeData([driver])} goalLabel="Revenue" />)

    const microline = screen.getByTestId('driver-microline')
    expect(microline).toBeInTheDocument()
    expect(microline.textContent).toBe('If wrong, Option B overtakes')
    expect(microline.className).toContain('text-danger')
  })

  it('hides microline when driver #1 has no fragileEdgeInfo', () => {
    const driver = makeDriver()
    render(<DriversSection data={makeData([driver])} goalLabel="Revenue" />)

    expect(screen.queryByTestId('driver-microline')).not.toBeInTheDocument()
  })

  it('hides microline when switchProbability is 0', () => {
    const driver = makeDriver({
      fragileEdgeInfo: {
        switchProbability: 0,
        alternativeWinnerLabel: 'Option B',
      },
    })
    render(<DriversSection data={makeData([driver])} goalLabel="Revenue" />)

    expect(screen.queryByTestId('driver-microline')).not.toBeInTheDocument()
  })

  it('hides microline when alternativeWinnerLabel is missing', () => {
    const driver = makeDriver({
      fragileEdgeInfo: {
        switchProbability: 0.5,
      },
    })
    render(<DriversSection data={makeData([driver])} goalLabel="Revenue" />)

    expect(screen.queryByTestId('driver-microline')).not.toBeInTheDocument()
  })

  it('only shows microline on first driver, not second', () => {
    const driver1 = makeDriver({
      factorKey: 'factor-1',
      fragileEdgeInfo: {
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Option B',
      },
    })
    const driver2 = makeDriver({
      factorKey: 'factor-2',
      factorLabel: 'Market Size',
      rank: 2,
      normalisedInfluence: 0.8,
      influenceScore: 0.7,
      semanticLabel: 'strong',
      fragileEdgeInfo: {
        switchProbability: 0.4,
        alternativeWinnerLabel: 'Option C',
      },
    })
    render(<DriversSection data={makeData([driver1, driver2])} goalLabel="Revenue" />)

    const microlines = screen.getAllByTestId('driver-microline')
    expect(microlines).toHaveLength(1)
    expect(microlines[0].textContent).toBe('If wrong, Option B overtakes')
  })
})
