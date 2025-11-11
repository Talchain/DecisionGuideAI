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
  },
  adapterName: 'mock'
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
    // Mock templates() to return proper structure
    mockPlot.templates.mockResolvedValue({
      items: [
        {
          id: 'pricing-v1',
          name: 'Pricing Strategy',
          description: 'Compare pricing tiers'
        }
      ]
    })

    // Mock template() to return detailed template
    mockPlot.template.mockResolvedValue({
      id: 'pricing-v1',
      name: 'Pricing Strategy',
      description: 'Compare pricing tiers',
      version: '1.0',
      default_seed: 1337,
      graph: { nodes: [], edges: [] }
    })

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

  it('shows template browser with search', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)

    expect(screen.getByPlaceholderText(/search templates/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Pricing Strategy')).toBeInTheDocument()
    })
  })

  it('filters templates by search query', async () => {
    mockPlot.templates.mockResolvedValue({
      items: [
        { id: 'pricing-v1', name: 'Pricing Strategy', description: 'Pricing' },
        { id: 'hiring-v1', name: 'Hiring Decision', description: 'Hiring' }
      ]
    })

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

  it('calls onInsertBlueprint when Insert clicked', async () => {
    const onInsertBlueprint = vi.fn()
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={onInsertBlueprint} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /insert pricing strategy/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))

    await waitFor(() => {
      expect(onInsertBlueprint).toHaveBeenCalledWith(expect.objectContaining({
        id: 'pricing-v1',
        name: 'Pricing Strategy'
      }))
    })
  })

  it('shows template about section after insert', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /insert pricing strategy/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))

    await waitFor(() => {
      expect(screen.getByText(/pricing strategy/i)).toBeInTheDocument()
    })
  })

  it('toggles dev controls', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /insert pricing strategy/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')

      fireEvent.click(toggle)

      expect(toggle).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText(/Adapter: mock/i)).toBeInTheDocument()
    })
  })
})
