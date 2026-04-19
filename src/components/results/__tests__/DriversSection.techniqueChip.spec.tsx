/**
 * DriversSection — Brief 5.1 Task 7.5 technique suggestion chip.
 *
 * The "Try: reference class forecasting" suggestion used to render only
 * inside the driver tooltip — a decorative dead-end. Task 7.5 promotes it
 * to a visible button on the card body that, when clicked, sends a scoped
 * prompt into the chat so the user can act on the suggestion.
 *
 * Chip visibility rule (mirrors the existing techniqueSuggestion selector
 * inside DriverRow): influence > 0.6 AND confidence < 0.5.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('DriversSection — Brief 5.1 Task 7.5 technique chip', () => {
  it('renders the clickable technique chip when influence > 0.6 and confidence < 0.5', () => {
    const onSendMessage = vi.fn()
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.4 })])}
        onSendMessage={onSendMessage}
      />,
    )

    const chip = screen.getByTestId('driver-technique-chip-f1')
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveTextContent('Try: reference class forecasting')
    expect(chip.tagName).toBe('BUTTON')
  })

  it('clicking the chip dispatches an onSendMessage call with factor context', () => {
    const onSendMessage = vi.fn()
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.4, factorLabel: 'Customer Churn' })])}
        onSendMessage={onSendMessage}
      />,
    )

    fireEvent.click(screen.getByTestId('driver-technique-chip-f1'))

    expect(onSendMessage).toHaveBeenCalledTimes(1)
    const prompt = onSendMessage.mock.calls[0][0] as string
    expect(prompt).toContain('Try: reference class forecasting')
    expect(prompt).toContain('Customer Churn')
  })

  it('omits the chip when confidence is high enough (no suggestion)', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.8 })])}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('driver-technique-chip-f1')).not.toBeInTheDocument()
  })

  it('omits the chip when influence is too low to warrant the suggestion', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.3, confidence: 0.3 })])}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('driver-technique-chip-f1')).not.toBeInTheDocument()
  })

  it('omits the chip when no onSendMessage handler is wired (defensive)', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.4 })])}
      />,
    )
    expect(screen.queryByTestId('driver-technique-chip-f1')).not.toBeInTheDocument()
  })

  it('chip exposes an accessible label that names the technique and factor', () => {
    render(
      <DriversSection
        data={makeData([makeDriver({ influenceScore: 0.8, confidence: 0.4, factorLabel: 'Churn Rate' })])}
        onSendMessage={() => {}}
      />,
    )

    const chip = screen.getByTestId('driver-technique-chip-f1')
    const label = chip.getAttribute('aria-label') ?? ''
    expect(label).toContain('reference class forecasting')
    expect(label).toContain('Churn Rate')
  })
})
