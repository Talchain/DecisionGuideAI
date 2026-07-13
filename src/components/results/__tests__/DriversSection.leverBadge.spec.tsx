/**
 * DriversSection — lever badge VISIBLE (D-U display residual).
 *
 * The producer stamps zero_reason='intervention_override' on factors whose
 * sensitivity is suppressed because they are directly controlled by the
 * decision options (levers). Per the D-U ruling this must be surfaced as a
 * VISIBLE badge on the factor row — not buried in a hover-only tooltip that
 * appears solely on the top driver. This is the display half of the
 * "numbers argue with each other" wound: an influence bar with no explanation
 * of why its sensitivity is absent.
 *
 * These tests assert:
 *  - a lever factor renders a visible "Controlled by your options" badge;
 *  - the badge appears on lever rows that are NOT the top driver too;
 *  - non-lever factors get no badge;
 *  - the influence column is labelled "Influence", never "Sensitivity"
 *    (per the ruling — influence_score is not sensitivity).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'f1',
    factorLabel: 'Marketing Spend',
    rawElasticity: 0.8,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    displayInfluence: 0.8,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'n1',
    confidence: 0.6,
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

describe('DriversSection — lever badge (zero_reason intervention_override) is visible', () => {
  it('renders a visible "Controlled by your options" badge on a lever factor', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ zeroReason: 'intervention_override' })])}
      />,
    )
    const badge = screen.getByTestId('driver-lever-badge-f1')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/controlled by your options/i)
  })

  it('shows the badge on a lever row even when it is NOT the top driver', () => {
    const top = makeDriver({ factorKey: 'f1', rank: 1, semanticLabel: 'biggest', influenceScore: 0.9, displayInfluence: 0.9 })
    const lever = makeDriver({
      factorKey: 'f2', rank: 2, semanticLabel: 'strong',
      factorLabel: 'Price Point', influenceScore: 0.5, displayInfluence: 0.5,
      zeroReason: 'intervention_override',
    })
    render(<DriversSection data={makeData([top, lever])} />)
    // Top (non-lever) has no badge; the second row (lever) does.
    expect(screen.queryByTestId('driver-lever-badge-f1')).not.toBeInTheDocument()
    expect(screen.getByTestId('driver-lever-badge-f2')).toBeInTheDocument()
  })

  it('does NOT render a lever badge on a factor without a zero_reason', () => {
    render(<DriversSection data={makeData([makeDriver({ zeroReason: undefined })])} />)
    expect(screen.queryByTestId('driver-lever-badge-f1')).not.toBeInTheDocument()
  })

  it('labels the influence column "Influence", never "Sensitivity"', () => {
    render(<DriversSection data={makeData([makeDriver({ zeroReason: 'intervention_override' })])} />)
    const list = screen.getByTestId('drivers-list')
    expect(within(list).getByText('Influence')).toBeInTheDocument()
    expect(within(list).queryByText('Sensitivity')).not.toBeInTheDocument()
  })
})
