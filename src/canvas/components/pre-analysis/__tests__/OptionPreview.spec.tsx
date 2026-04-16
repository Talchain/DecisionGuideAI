import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OptionPreview } from '../OptionPreview'
import type { OptionPreviewData } from '../hooks/usePreAnalysisData'

function makeOption(overrides: Partial<OptionPreviewData> & { interventions: OptionPreviewData['interventions'] }): OptionPreviewData {
  return {
    id: 'opt1',
    label: 'Option A',
    status: 'ready',
    isBaseline: false,
    ...overrides,
  }
}

// Helper: OptionPreview defaults to collapsed (isExpanded=false).
// Tests that need intervention content must expand first.
function expandOptionPreview() {
  fireEvent.click(screen.getByTestId('option-preview-toggle'))
}

describe('OptionPreview — intervention display', () => {
  it('interventions are visible after expanding the section', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Product-Market Fit',
            interventionValue: 0.8,
            currentValue: 0.5,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to very high')).toBeInTheDocument()
  })

  it('shows qualitative level for cap=1, unit="" intervention (0.8 → "to very high")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Product-Market Fit',
            interventionValue: 0.8,
            currentValue: 0.5,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to very high')).toBeInTheDocument()
  })

  it('shows qualitative level for cap=1, unit="" intervention (0.5 → "to moderate")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Integration Complexity',
            interventionValue: 0.5,
            currentValue: 0.3,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to moderate')).toBeInTheDocument()
  })

  it('shows numeric for cap=1, unit="" with out-of-range value (5000 → "to 5000")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Large Factor',
            interventionValue: 5000,
            currentValue: null,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to 5000')).toBeInTheDocument()
  })

  it('shows qualitative for null cap and null unit (existing behaviour)', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Score',
            interventionValue: 0.3,
            currentValue: null,
            direction: 'down',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to low')).toBeInTheDocument()
  })

  // Task 1: boundary value tests for the 5-level qualitative scale
  it.each([
    [0, 'to very low'],
    [0.19, 'to very low'],
    [0.2, 'to low'],
    [0.39, 'to low'],
    [0.4, 'to moderate'],
    [0.59, 'to moderate'],
    [0.6, 'to high'],
    [0.79, 'to high'],
    [0.8, 'to very high'],
    [1, 'to very high'],
  ])('qualitative boundary: %f → "%s"', (interventionValue, expectedLabel) => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Factor',
            interventionValue,
            currentValue: null,
            direction: 'up',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
      />,
    )
    expandOptionPreview()
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('shows raw + unit when cap and unit are meaningful', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Timeline',
            interventionValue: 0.5,
            currentValue: null,
            direction: 'up',
            cap: 18,
            unit: 'months',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to 9 months')).toBeInTheDocument()
  })
})

describe('OptionPreview — collapsed state (UI-BUG-3)', () => {
  it('shows option names without expanding', () => {
    render(
      <OptionPreview
        options={[
          makeOption({ id: 'opt1', label: 'Hire Now', interventions: [] }),
          makeOption({ id: 'opt2', label: 'Outsource', interventions: [] }),
        ]}
      />,
    )
    const nameList = screen.getByTestId('option-preview-collapsed-names')
    expect(nameList).toBeInTheDocument()
    expect(screen.getByText('Hire Now')).toBeInTheDocument()
    expect(screen.getByText('Outsource')).toBeInTheDocument()
  })

  it('hides option names after expanding (expanded state shows full detail)', () => {
    render(
      <OptionPreview
        options={[makeOption({ id: 'opt1', label: 'Hire Now', interventions: [] })]}
      />,
    )
    expandOptionPreview()
    expect(screen.queryByTestId('option-preview-collapsed-names')).not.toBeInTheDocument()
  })
})

describe('OptionPreview — click-to-inspector', () => {
  it('calls onFocusNode with the factor node id when a factor label is clicked', () => {
    const onFocusNode = vi.fn()
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac_market',
            factorLabel: 'Market Size',
            interventionValue: 0.7,
            currentValue: null,
            direction: 'up',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
        onFocusNode={onFocusNode}
      />,
    )

    // Factor labels are inside the expanded content — expand first
    expandOptionPreview()
    fireEvent.click(screen.getByText('Market Size'))
    expect(onFocusNode).toHaveBeenCalledTimes(1)
    expect(onFocusNode).toHaveBeenCalledWith('fac_market')
  })

  it('calls onFocusNode with the option id when the option name is clicked (collapsed state)', () => {
    const onFocusNode = vi.fn()
    const option = makeOption({
      id: 'opt_expand',
      label: 'Expand Now',
      interventions: [],
    })
    render(
      <OptionPreview options={[option]} onFocusNode={onFocusNode} />,
    )

    // Option names are visible in collapsed state (UI-BUG-3 fix)
    fireEvent.click(screen.getByText('Expand Now'))
    expect(onFocusNode).toHaveBeenCalledWith('opt_expand')
  })
})
