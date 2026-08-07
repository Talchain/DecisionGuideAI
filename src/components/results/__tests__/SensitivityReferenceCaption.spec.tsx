/**
 * Lane UI-W5 (feature A): reference-option disclosure caption.
 *
 * PLoT /v2/run discloses `sensitivity_reference_option_id` — the option the
 * edge/factor sensitivities and fragile-edge classification were computed
 * against. One caption component is reused across the surfaces where those
 * render (DriversSection, StressTestSection).
 *
 * Contract under test:
 *  - caption renders "Sensitivities computed against <label>" when a label
 *    resolves (provisional_doctrine_v0 wording);
 *  - fail-closed: no label (absent producer field, unresolvable id) → no
 *    caption — never an invented baseline, never a leaked internal id;
 *  - both surfaces render it from the same shared component.
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { SensitivityReferenceCaption } from '../SensitivityReferenceCaption'
import { DriversSection } from '../DriversSection'
import { StressTestSection } from '../StressTestSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(() => true),
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

describe('SensitivityReferenceCaption (shared component)', () => {
  it('renders the disclosure copy with the resolved option label', () => {
    render(<SensitivityReferenceCaption optionLabel="Hire a contractor" />)
    const caption = screen.getByTestId('sensitivity-reference-caption')
    expect(caption).toHaveTextContent('Sensitivities computed against Hire a contractor')
  })

  it('renders nothing when the label is null (absent producer field)', () => {
    render(<SensitivityReferenceCaption optionLabel={null} />)
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })

  it('renders nothing when the label is undefined', () => {
    render(<SensitivityReferenceCaption />)
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })

  it('renders nothing for a whitespace-only label (fail-closed)', () => {
    render(<SensitivityReferenceCaption optionLabel="   " />)
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })
})

describe('DriversSection surface', () => {
  it('shows the caption when a reference label is provided', () => {
    render(
      <DriversSection
        data={makeData([makeDriver()])}
        goalLabel="Revenue"
        sensitivityReferenceLabel="Hire a contractor"
      />,
    )
    expect(screen.getByTestId('sensitivity-reference-caption')).toHaveTextContent(
      'Sensitivities computed against Hire a contractor',
    )
  })

  it('shows no caption when the label is null (absent field → no caption)', () => {
    render(
      <DriversSection
        data={makeData([makeDriver()])}
        goalLabel="Revenue"
        sensitivityReferenceLabel={null}
      />,
    )
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })

  it('shows no caption when the prop is omitted entirely (older callers unchanged)', () => {
    render(<DriversSection data={makeData([makeDriver()])} goalLabel="Revenue" />)
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })
})

describe('StressTestSection surface', () => {
  it('shows the caption when a reference label is provided', () => {
    render(
      <StressTestSection
        drivers={[makeDriver()]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
        designationsWithheld={false}
        sensitivityReferenceLabel="Hire a contractor"
      />,
    )
    expect(screen.getByTestId('sensitivity-reference-caption')).toHaveTextContent(
      'Sensitivities computed against Hire a contractor',
    )
  })

  it('shows no caption when the label is null', () => {
    render(
      <StressTestSection
        drivers={[makeDriver()]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
        designationsWithheld={false}
        sensitivityReferenceLabel={null}
      />,
    )
    expect(screen.queryByTestId('sensitivity-reference-caption')).not.toBeInTheDocument()
  })
})
