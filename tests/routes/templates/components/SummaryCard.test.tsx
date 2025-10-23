import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryCard } from '../../../../src/routes/templates/components/SummaryCard'
import type { ReportV1 } from '../../../../src/adapters/plot'

const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
  model_card: { response_hash: 'sha256:abc123def456', response_hash_algo: 'sha256', normalized: true },
  results: { conservative: 120, likely: 150, optimistic: 180, units: 'percent', unitSymbol: '%' },
  confidence: { level: 'medium', why: 'Limited data available' },
  drivers: []
}

describe('SummaryCard', () => {
  it('renders likely value prominently', () => {
    render(<SummaryCard report={mockReport} />)
    
    expect(screen.getByTestId('summary-likely')).toHaveTextContent('150%')
  })

  it('displays conservative and optimistic values', () => {
    render(<SummaryCard report={mockReport} />)
    
    expect(screen.getByTestId('summary-conservative')).toHaveTextContent('Conservative: 120%')
    expect(screen.getByTestId('summary-optimistic')).toHaveTextContent('Optimistic: 180%')
  })

  it('shows confidence badge with tooltip', () => {
    render(<SummaryCard report={mockReport} />)
    
    const badge = screen.getByTestId('confidence-badge')
    expect(badge).toHaveTextContent('Medium Confidence')
    expect(badge).toHaveAttribute('title', 'Why: Limited data available')
  })

  it('shows verification hash pill when hash exists', () => {
    render(<SummaryCard report={mockReport} />)
    
    expect(screen.getByTestId('hash-pill')).toBeInTheDocument()
  })

  it('calls onCopyHash when hash pill clicked', () => {
    const onCopyHash = vi.fn()
    render(<SummaryCard report={mockReport} onCopyHash={onCopyHash} />)
    
    fireEvent.click(screen.getByTestId('hash-pill'))
    expect(onCopyHash).toHaveBeenCalled()
  })
})
