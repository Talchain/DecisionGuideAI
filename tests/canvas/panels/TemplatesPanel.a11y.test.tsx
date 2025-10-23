import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { TemplatesPanel } from '../../../src/canvas/panels/TemplatesPanel'
import * as plotAdapter from '../../../src/adapters/plot'

configureAxe({
  rules: {
    'color-contrast': { enabled: false }
  }
})

vi.mock('../../../src/adapters/plot', () => ({
  plot: {
    templates: vi.fn(),
    template: vi.fn(),
    run: vi.fn()
  }
}))

const mockPlot = vi.mocked(plotAdapter.plot)

describe('TemplatesPanel A11y', () => {
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

  it('has no accessibility violations when open', async () => {
    const { container } = render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    await waitFor(() => {
      expect(container.querySelector('[role="complementary"]')).toBeInTheDocument()
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('has no violations with dev controls enabled', async () => {
    const { container, getByRole } = render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    await waitFor(() => {
      expect(container.querySelector('[role="complementary"]')).toBeInTheDocument()
    })
    
    // Enable dev controls
    const toggle = getByRole('switch')
    toggle.click()
    
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
