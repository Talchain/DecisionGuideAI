import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReproduceShareCard } from '../../../../src/routes/templates/components/ReproduceShareCard'
import type { ReportV1, TemplateDetail } from '../../../../src/adapters/plot'

const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
  model_card: { 
    response_hash: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    response_hash_algo: 'sha256',
    normalized: true 
  },
  results: { conservative: 100, likely: 150, optimistic: 200 },
  confidence: { level: 'medium', why: 'test' },
  drivers: []
}

const mockTemplate: TemplateDetail = {
  id: 'pricing-v1',
  name: 'Pricing Strategy',
  version: '1.0',
  description: 'Test template',
  default_seed: 1337,
  graph: {}
}

describe('ReproduceShareCard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  it('displays template info and seed', () => {
    render(<ReproduceShareCard report={mockReport} template={mockTemplate} seed={1337} />)
    
    expect(screen.getByText(/pricing strategy @ 1.0/i)).toBeInTheDocument()
    expect(screen.getByText('1337')).toBeInTheDocument()
  })

  it('formats verification hash with ellipsis', () => {
    render(<ReproduceShareCard report={mockReport} template={mockTemplate} seed={1337} />)
    
    // Hash is formatted as first8…last8
    expect(screen.getByText(/sha256:a…34567890/)).toBeInTheDocument()
  })

  it('calls onCopySeed when copy seed clicked', () => {
    const onCopySeed = vi.fn()
    render(<ReproduceShareCard report={mockReport} template={mockTemplate} seed={1337} onCopySeed={onCopySeed} />)
    
    fireEvent.click(screen.getByRole('button', { name: /copy seed/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1337')
    expect(onCopySeed).toHaveBeenCalled()
  })

  it('calls onAddToNote when add button clicked', () => {
    const onAddToNote = vi.fn()
    render(<ReproduceShareCard report={mockReport} template={mockTemplate} seed={1337} onAddToNote={onAddToNote} />)
    
    fireEvent.click(screen.getByRole('button', { name: /add to decision note/i }))
    expect(onAddToNote).toHaveBeenCalled()
  })
})
