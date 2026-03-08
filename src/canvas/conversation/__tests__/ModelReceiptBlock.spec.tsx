/**
 * ModelReceiptBlock — component tests.
 * Phase 2B: Pre-analysis enrichment.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModelReceiptBlock } from '../ModelReceiptBlock'
import type { ModelReceiptData } from '../../adapters/modelCardAdapter'

vi.mock('../../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

const fullData: ModelReceiptData = {
  factorCount: 5,
  edgeCount: 8,
  optionCount: 2,
  goalLabel: 'Revenue growth',
  topInsight: 'Missing time horizon may affect accuracy.',
  topEvidenceGap: 'Marketing spend: no observed data',
  readiness: 'ready',
  adjustments: [
    { label: 'Strength of relationship', action: 'Floored', before: '0', after: '0.01' },
    { label: 'Baseline of node', action: 'Defaulted' },
  ],
}

describe('ModelReceiptBlock', () => {
  it('renders with full data', () => {
    render(<ModelReceiptBlock data={fullData} />)

    expect(screen.getByText('Model generated')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText(/5 factors/)).toBeInTheDocument()
    expect(screen.getByText(/8 relationships/)).toBeInTheDocument()
    expect(screen.getByText(/Revenue growth/)).toBeInTheDocument()
    expect(screen.getByText(/Missing time horizon/)).toBeInTheDocument()
    expect(screen.getByText(/Marketing spend/)).toBeInTheDocument()
  })

  it('renders with partial data without crashing', () => {
    render(
      <ModelReceiptBlock
        data={{
          factorCount: 2,
          edgeCount: 3,
          optionCount: 0,
          goalLabel: null,
          topInsight: null,
          topEvidenceGap: null,
          readiness: 'unknown',
          adjustments: [],
        }}
      />,
    )

    expect(screen.getByText('Model generated')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText(/2 factors/)).toBeInTheDocument()
    // No insight or gap text
    expect(screen.queryByText(/Missing/)).not.toBeInTheDocument()
  })

  it('renders adjustments collapsed by default', () => {
    render(<ModelReceiptBlock data={fullData} />)

    const adjustBtn = screen.getByText(/2 adjustments/)
    expect(adjustBtn).toBeInTheDocument()

    // Details not visible initially
    expect(screen.queryByText('Floored')).not.toBeInTheDocument()
  })

  it('expands adjustments on click', () => {
    render(<ModelReceiptBlock data={fullData} />)

    fireEvent.click(screen.getByText(/2 adjustments/))

    expect(screen.getByText('Floored')).toBeInTheDocument()
    expect(screen.getByText('Defaulted')).toBeInTheDocument()
  })

  it('shows readiness pills with text labels', () => {
    const { rerender } = render(
      <ModelReceiptBlock data={{ ...fullData, readiness: 'blocked' }} />,
    )
    expect(screen.getByText('Blocked')).toBeInTheDocument()

    rerender(
      <ModelReceiptBlock data={{ ...fullData, readiness: 'incomplete' }} />,
    )
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('has accessible test-id', () => {
    render(<ModelReceiptBlock data={fullData} />)
    expect(screen.getByTestId('model-receipt-block')).toBeInTheDocument()
  })
})
