import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { CanvasPage } from '../../../src/routes/canvas/CanvasPage'
import * as plotAdapter from '../../../src/adapters/plot'

vi.mock('../../../src/adapters/plot', () => ({
  plot: {
    templates: vi.fn(),
    template: vi.fn(),
    run: vi.fn()
  }
}))

const mockPlot = vi.mocked(plotAdapter.plot)

describe('CanvasPage Route', () => {
  beforeEach(() => {
    mockPlot.templates.mockResolvedValue({
      schema: 'templates.list.v1',
      items: [{ id: 'pricing-v1', name: 'Pricing Strategy', version: '1.0' }]
    })
    
    mockPlot.template.mockResolvedValue({
      id: 'pricing-v1',
      name: 'Pricing Strategy',
      version: '1.0',
      description: 'Test template',
      default_seed: 1337,
      graph: {}
    })
  })

  it('renders the canvas page with dev toolbar', async () => {
    render(
      <HashRouter>
        <CanvasPage />
      </HashRouter>
    )
    
    expect(screen.getByText('Templates Canvas')).toBeInTheDocument()
    expect(screen.getByText(/Adapter: Mock/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Template')).toBeInTheDocument()
    expect(screen.getByLabelText('Seed')).toBeInTheDocument()
  })

  it('runs template and shows summary card', async () => {
    mockPlot.run.mockResolvedValue({
      schema: 'report.v1',
      meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
      model_card: { response_hash: 'sha256:abc123', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 100, likely: 150, optimistic: 200 },
      confidence: { level: 'medium', why: 'test' },
      drivers: []
    })

    render(
      <HashRouter>
        <CanvasPage />
      </HashRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument()
    })
  })
})
