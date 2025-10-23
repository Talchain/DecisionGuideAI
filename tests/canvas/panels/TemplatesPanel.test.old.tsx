import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TemplatesPanel } from '../../../src/canvas/panels/TemplatesPanel'
import * as plotAdapter from '../../../src/adapters/plot'

vi.mock('../../../src/adapters/plot', () => ({
  plot: {
    templates: vi.fn(),
    template: vi.fn(),
    run: vi.fn()
  }
}))

const mockPlot = vi.mocked(plotAdapter.plot)

describe('TemplatesPanel', () => {
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

  it('renders when open', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    expect(screen.getByRole('complementary', { name: 'Templates' })).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<TemplatesPanel isOpen={false} onClose={() => {}} />)
    
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<TemplatesPanel isOpen={true} onClose={onClose} />)
    
    const closeButton = screen.getByRole('button', { name: /close templates panel/i })
    fireEvent.click(closeButton)
    
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles dev controls', async () => {
    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    const toggle = screen.getByRole('switch', { name: /show dev controls/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    
    fireEvent.click(toggle)
    
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })
    
    expect(screen.getByText(/Adapter: Mock/i)).toBeInTheDocument()
  })

  it('runs template and shows results', async () => {
    mockPlot.run.mockResolvedValue({
      schema: 'report.v1',
      meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
      model_card: { response_hash: 'sha256:abc123', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 100, likely: 150, optimistic: 200 },
      confidence: { level: 'medium', why: 'test' },
      drivers: []
    })

    render(<TemplatesPanel isOpen={true} onClose={() => {}} />)

    // Enable dev controls
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument()
    })
  })

  it('calls onPinToCanvas when pin button clicked', async () => {
    mockPlot.run.mockResolvedValue({
      schema: 'report.v1',
      meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
      model_card: { response_hash: 'sha256:abc123', response_hash_algo: 'sha256', normalized: true },
      results: { conservative: 100, likely: 150, optimistic: 200 },
      confidence: { level: 'medium', why: 'test' },
      drivers: []
    })

    const onPinToCanvas = vi.fn()
    render(<TemplatesPanel isOpen={true} onClose={() => {}} onPinToCanvas={onPinToCanvas} />)

    // Enable dev controls and run
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => {
      expect(screen.getByText(/Pin to Canvas/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/Pin to Canvas/i))

    expect(onPinToCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'pricing-v1',
        seed: 1337,
        response_hash: 'sha256:abc123',
        likely_value: 150
      })
    )
  })
})
