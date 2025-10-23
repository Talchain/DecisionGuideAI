import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TemplatesPanel } from '../../../src/canvas/panels/TemplatesPanel'
import * as plotAdapter from '../../../src/adapters/plot'
import * as blueprintsModule from '../../../src/templates/blueprints'

vi.mock('../../../src/adapters/plot', () => ({
  plot: {
    templates: vi.fn(),
    template: vi.fn(),
    run: vi.fn()
  }
}))

vi.mock('../../../src/templates/blueprints', () => ({
  getAllBlueprints: vi.fn(),
  getBlueprintById: vi.fn()
}))

const mockPlot = vi.mocked(plotAdapter.plot)
const mockGetAllBlueprints = vi.mocked(blueprintsModule.getAllBlueprints)
const mockGetBlueprintById = vi.mocked(blueprintsModule.getBlueprintById)

describe('TemplatesPanel', () => {
  beforeEach(() => {
    mockGetAllBlueprints.mockReturnValue([
      {
        id: 'pricing-v1',
        name: 'Pricing Strategy',
        description: 'Compare pricing tiers',
        nodes: [],
        edges: []
      }
    ])
    
    mockGetBlueprintById.mockReturnValue({
      id: 'pricing-v1',
      name: 'Pricing Strategy',
      description: 'Compare pricing tiers',
      longDescription: 'Detailed description',
      nodes: [],
      edges: []
    })
    
    mockPlot.run.mockResolvedValue({
      schema: 'report.v1',
      meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
      model_card: { response_hash: 'sha256:abc123', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 100, likely: 150, optimistic: 200 },
      confidence: { level: 'medium', why: 'test' },
      drivers: []
    })
  })

  it('renders when open', () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    expect(screen.getByRole('complementary', { name: 'Templates' })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<TemplatesPanel isOpen={false} onClose={() => {}} />)
    
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('shows template browser with search', () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    expect(screen.getByPlaceholderText(/search templates/i)).toBeInTheDocument()
    expect(screen.getByText('Pricing Strategy')).toBeInTheDocument()
  })

  it('filters templates by search query', async () => {
    mockGetAllBlueprints.mockReturnValue([
      { id: 'pricing-v1', name: 'Pricing Strategy', description: 'Pricing', nodes: [], edges: [] },
      { id: 'hiring-v1', name: 'Hiring Decision', description: 'Hiring', nodes: [], edges: [] }
    ])
    
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    const searchInput = screen.getByPlaceholderText(/search templates/i)
    fireEvent.change(searchInput, { target: { value: 'pricing' } })
    
    await waitFor(() => {
      expect(screen.getByText('Pricing Strategy')).toBeInTheDocument()
      expect(screen.queryByText('Hiring Decision')).not.toBeInTheDocument()
    })
  })

  it('calls onInsertBlueprint when Insert clicked', () => {
    const onInsertBlueprint = vi.fn()
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={onInsertBlueprint} />)
    
    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))
    
    expect(onInsertBlueprint).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pricing-v1',
      name: 'Pricing Strategy'
    }))
  })

  it('shows template about section after insert', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={() => {}} />)
    
    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))
    
    await waitFor(() => {
      expect(screen.getByText('About Pricing Strategy')).toBeInTheDocument()
      expect(screen.getByText('Detailed description')).toBeInTheDocument()
    })
  })

  it('toggles dev controls', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={() => {}} />)
    
    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))
    
    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /show dev controls/i })
      expect(toggle).toHaveAttribute('aria-checked', 'false')
      
      fireEvent.click(toggle)
      
      expect(toggle).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText(/Adapter: Mock/i)).toBeInTheDocument()
    })
  })
})
