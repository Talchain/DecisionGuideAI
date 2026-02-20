import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
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

describe('OptionPreview — intervention display', () => {
  it('shows qualitative level for cap=1, unit="" intervention (0.8 → "to high")', () => {
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

    expect(screen.getByText('to high')).toBeInTheDocument()
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

    expect(screen.getByText('to low')).toBeInTheDocument()
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

    expect(screen.getByText('to 9 months')).toBeInTheDocument()
  })
})
