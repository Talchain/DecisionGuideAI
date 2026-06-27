/**
 * DriversSection Brief 5 Task 2: column-header + card alignment.
 *
 * Regression protection for the Phase 3 restructure: headers and rows now
 * live inside one `data-testid="drivers-list"` wrapper with the same grid
 * class string, so column positions are structural (not visual approximation).
 * Also verifies the factor title button carries both `title` and
 * `aria-label` for DS v5 "icon+text with truncation" a11y parity.
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
    factorLabel: 'Dedicated Design Expertise',
    rawElasticity: 0.5,
    normalisedInfluence: 0.7,
    influenceScore: 0.7,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'major',
    confidenceScore: 0.8,
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

describe('DriversSection: Brief 5 Task 2 — column alignment + title a11y', () => {
  it('wraps headers and rows in a single drivers-list container', () => {
    render(<DriversSection data={makeData([makeDriver()])} goalLabel="Win rate" />)

    const list = screen.getByTestId('drivers-list')
    expect(list).toBeInTheDocument()

    // Headers and rows live under the same wrapper. The Confidence column
    // header is hidden (influence-only driver section), so only the Influence
    // header remains alongside the row.
    expect(list).toHaveTextContent('Influence')
    expect(list).not.toHaveTextContent('Confidence')
    expect(list).toHaveTextContent('Dedicated Design Expertise')
  })

  it('header grid and first-row grid share the same grid-cols class so columns align structurally', () => {
    render(<DriversSection data={makeData([makeDriver()])} goalLabel="Win rate" />)

    const list = screen.getByTestId('drivers-list')

    // Header row = first child (grid wrapper). Row grids are inside each DriverRow.
    const headerGrid = list.querySelector(':scope > .grid')
    expect(headerGrid).toBeTruthy()

    // Find the first row's inner grid (the one wrapping factor name + bars).
    const firstRowGrid = list.querySelector('.space-y-2 > div .grid')
    expect(firstRowGrid).toBeTruthy()

    // Both must carry the identical grid-cols token — this is the property
    // that keeps the "Influence" header above the sensitivity bar and the
    // "Confidence" header above the confidence bar.
    const headerCols = (headerGrid!.className.match(/grid-cols-\[[^\]]+\]/) ?? [])[0]
    const rowCols = (firstRowGrid!.className.match(/grid-cols-\[[^\]]+\]/) ?? [])[0]
    expect(headerCols).toBeTruthy()
    expect(rowCols).toBeTruthy()
    expect(headerCols).toBe(rowCols)
  })

  it('factor title button has both title (tooltip) and aria-label (DS v5 a11y parity)', () => {
    const longLabel = 'A very long factor label that will almost certainly truncate to two lines under line-clamp'
    render(<DriversSection data={makeData([makeDriver({ factorLabel: longLabel })])} goalLabel="Win rate" />)

    const titleButton = screen.getByRole('button', { name: new RegExp(`^Focus on ${longLabel} in model$`) })
    expect(titleButton).toHaveAttribute('title', longLabel)
    expect(titleButton).toHaveAttribute('aria-label', `Focus on ${longLabel} in model`)
    // Truncation token is applied so long labels clamp visually.
    expect(titleButton.className).toContain('line-clamp-2')
  })
})
