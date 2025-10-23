import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { axe, configureAxe } from 'vitest-axe'
import { CanvasPage } from '../../../src/routes/canvas/CanvasPage'
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

describe('CanvasPage A11y', () => {
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

  it('has no accessibility violations', async () => {
    const { container } = render(
      <HashRouter>
        <CanvasPage />
      </HashRouter>
    )
    
    await waitFor(() => {
      expect(container.querySelector('select')).toBeInTheDocument()
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
