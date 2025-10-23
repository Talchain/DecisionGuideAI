import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WhyPanel } from '../../../../src/routes/templates/components/WhyPanel'
import type { ReportV1 } from '../../../../src/adapters/plot'

const mockReportWithDrivers: ReportV1 = {
  schema: 'report.v1',
  meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
  model_card: { response_hash: 'hash', response_hash_algo: 'sha256', normalized: true },
  results: { conservative: 100, likely: 150, optimistic: 200 },
  confidence: { level: 'medium', why: 'test' },
  drivers: [
    { label: 'Market demand increasing', polarity: 'up', strength: 'high' },
    { label: 'Competition rising', polarity: 'down', strength: 'medium', action: 'Differentiate offering' },
    { label: 'Costs stable', polarity: 'neutral', strength: 'low' }
  ]
}

describe('WhyPanel', () => {
  it('renders drivers as accessible list', () => {
    render(<WhyPanel report={mockReportWithDrivers} />)
    
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByText('Market demand increasing')).toBeInTheDocument()
    expect(screen.getByText('Competition rising')).toBeInTheDocument()
  })

  it('shows action buttons when driver has action', () => {
    render(<WhyPanel report={mockReportWithDrivers} />)
    
    expect(screen.getByRole('button', { name: /differentiate offering/i })).toBeInTheDocument()
  })

  it('returns null when no drivers', () => {
    const emptyReport = { ...mockReportWithDrivers, drivers: [] }
    const { container } = render(<WhyPanel report={emptyReport} />)
    
    expect(container.firstChild).toBeNull()
  })
})
