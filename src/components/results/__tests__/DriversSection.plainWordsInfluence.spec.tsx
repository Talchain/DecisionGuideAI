/**
 * Plain words first, numbers on request — the drivers ("What's driving this")
 * section.
 *
 * Served defect (signed-in journey, 4 Oct 2026): each row printed its exact
 * influence percentage by default ("100%", "8%"), and the caption named the
 * figure too. The default view states influence as a plain-word band with the
 * bar as its indicator; the exact percentage needs the advanced view or the
 * section's "Show details" disclosure.
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'price_rise',
    factorLabel: 'Existing price change from today',
    rawElasticity: 1.0,
    normalisedInfluence: 1.0,
    influenceScore: 1.0,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'strong',
    canFocus: true,
    matchedNodeId: 'price_rise',
    displayInfluence: 1.0,
    displayProvenance: 'influence_score',
    ...overrides,
  }
}

// The two rows of the served run: 100% and 8%.
const DATA: DriversSectionData = {
  drivers: [
    makeDriver(),
    makeDriver({
      factorKey: 'starter_tier',
      factorLabel: 'Starter tier availability',
      rawElasticity: 0.08,
      normalisedInfluence: 0.08,
      influenceScore: 0.08,
      displayInfluence: 0.08,
      rank: 2,
      semanticLabel: 'minor',
      matchedNodeId: 'starter_tier',
    }),
  ],
  topDrivers: [],
  driversStatus: 'computed',
  totalCount: 2,
  hasMagnitudeData: true,
}

const RAW_PERCENT = /\d+(?:\.\d+)?\s*%/

describe('DriversSection: influence in plain words by default', () => {
  it('default view shows each band and bar, and no percentage anywhere', () => {
    const { container } = render(<DriversSection data={DATA} goalLabel="MRR" />)

    expect(screen.getByTestId('driver-influence-pill-price_rise')).toHaveTextContent('High-impact driver')
    expect(screen.getByTestId('driver-influence-pill-starter_tier')).toHaveTextContent('Lower influence')
    // The visual indicator stays, named in the same words as the band.
    expect(screen.getByRole('progressbar', { name: 'Existing price change from today influence: High-impact driver' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Starter tier availability influence: Lower influence' })).toBeInTheDocument()

    // The scale caption no longer names a figure the reader cannot see.
    expect(screen.getByTestId('influence-scale-caption')).toHaveTextContent(
      'Influence is relative to the strongest factor. The strongest factor always fills the bar.',
    )

    expect(container.textContent).not.toMatch(RAW_PERCENT)
    for (const bar of screen.getAllByRole('progressbar')) {
      expect(bar.getAttribute('aria-label')).not.toMatch(RAW_PERCENT)
    }
  })

  it('"Show details" reveals the exact percentages, and hides them again', () => {
    const { container } = render(<DriversSection data={DATA} goalLabel="MRR" />)
    const toggle = screen.getByTestId('influence-details-toggle')
    expect(toggle).toHaveTextContent('Show details')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    const list = within(screen.getByTestId('drivers-list'))
    expect(list.getByText('100%')).toBeInTheDocument()
    expect(list.getByText('8%')).toBeInTheDocument()
    expect(toggle).toHaveTextContent('Hide details')
    expect(screen.getByTestId('influence-scale-caption')).toHaveTextContent(
      'Influence is relative to the strongest factor. The strongest factor always shows 100%.',
    )
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // The band is still there beside the figure.
    expect(screen.getByTestId('driver-influence-pill-starter_tier')).toHaveTextContent('Lower influence')

    fireEvent.click(toggle)
    expect(container.textContent).not.toMatch(RAW_PERCENT)
  })

  it('advanced view shows the exact percentages with no disclosure to press', () => {
    render(<DriversSection data={DATA} goalLabel="MRR" expertMode />)
    const list = within(screen.getByTestId('drivers-list'))
    expect(list.getByText('100%')).toBeInTheDocument()
    expect(list.getByText('8%')).toBeInTheDocument()
    expect(screen.queryByTestId('influence-details-toggle')).not.toBeInTheDocument()
  })
})
