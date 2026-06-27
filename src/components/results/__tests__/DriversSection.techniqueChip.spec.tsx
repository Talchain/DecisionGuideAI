/**
 * DriversSection — technique-suggestion chip HIDDEN (single-source rule).
 *
 * The "Try: reference class forecasting" chip is gated on LOW confidence
 * (influence > 0.6 AND confidence < 0.5), so it is a confidence-derived signal.
 * Under the influence-only rule the driver section shows influence only and
 * hides confidence-derived signals until a display-safe driver-confidence source
 * exists (DISPLAY_SAFE_DRIVER_CONFIDENCE). This previously asserted the chip
 * rendered + dispatched; it now guards that it does not appear.
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
    factorKey: 'f1',
    factorLabel: 'Task Handling Quality',
    rawElasticity: 0.8,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'n1',
    confidence: 0.4,
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

describe('DriversSection — technique chip hidden (confidence-derived, single-source rule)', () => {
  it('does NOT render the chip even when it would qualify (influence > 0.6 AND confidence < 0.5)', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.4 })])}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('driver-technique-chip-f1')).not.toBeInTheDocument()
    expect(screen.queryByText(/reference class forecasting/i)).not.toBeInTheDocument()
  })

  it('renders no technique chip on any driver, regardless of confidence', () => {
    const d1 = makeDriver({ factorKey: 'f1', rank: 1, influenceScore: 0.8, confidence: 0.4 })
    const d2 = makeDriver({ factorKey: 'f2', rank: 2, influenceScore: 0.9, confidence: 0.3 })
    render(<DriversSection data={makeData([d1, d2])} onSendMessage={() => {}} />)
    expect(screen.queryByTestId('driver-technique-chip-f1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('driver-technique-chip-f2')).not.toBeInTheDocument()
  })
})
