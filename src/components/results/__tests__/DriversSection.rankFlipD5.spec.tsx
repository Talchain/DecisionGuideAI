/**
 * DriversSection — Brief 5.8B D5 visible "Ranking may shift {N}%" row.
 *
 * Promotes the previously tooltip-only rankFlipRate signal to a visible
 * row beneath the driver's interpretation tag. Gated on
 * `rankFlipRate >= 0.15` so we only call attention to genuinely
 * shift-prone factors.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'factor-1',
    factorLabel: 'Top driver',
    rawElasticity: 1,
    normalisedInfluence: 1,
    influenceScore: 1,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node-1',
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

describe('DriversSection — "Ranking may shift" row hidden (fragility → fragile-factors section)', () => {
  it('does NOT render the row even when rankFlipRate >= 0.15', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ rankFlipRate: 0.32 })])}
      />,
    )
    // "Ranking may shift" is a fragility/ranking-shift claim; per the
    // single-source rule it belongs in the fragile-factors section, not the
    // influence-only driver section (SHOW_FRAGILITY_IN_DRIVER_SECTION). So the
    // row stays hidden even when rankFlipRate >= 0.15.
    expect(screen.queryByTestId('driver-ranking-shift-factor-1')).not.toBeInTheDocument()
    expect(screen.queryByText(/Ranking may shift/i)).not.toBeInTheDocument()
  })

  it('omits the row when rankFlipRate < 0.15', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ rankFlipRate: 0.05 })])}
      />,
    )
    expect(screen.queryByTestId('driver-ranking-shift-factor-1')).not.toBeInTheDocument()
  })

  it('omits the row when rankFlipRate is undefined', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ rankFlipRate: undefined })])}
      />,
    )
    expect(screen.queryByTestId('driver-ranking-shift-factor-1')).not.toBeInTheDocument()
  })
})
