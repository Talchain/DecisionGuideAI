import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { TemplatesPanel } from '../../../src/canvas/panels/TemplatesPanel'
import * as blueprintsModule from '../../../src/templates/blueprints'

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
  },
  adapterName: 'mock'
}))

vi.mock('../../../src/templates/blueprints', () => ({
  getAllBlueprints: vi.fn(),
  getBlueprintById: vi.fn()
}))

const mockGetAllBlueprints = vi.mocked(blueprintsModule.getAllBlueprints)
const mockGetBlueprintById = vi.mocked(blueprintsModule.getBlueprintById)

// Import plot to mock its methods
import * as plotAdapter from '../../../src/adapters/plot'
const mockPlot = vi.mocked(plotAdapter.plot)

describe('TemplatesPanel A11y', () => {
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
      nodes: [],
      edges: []
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

  it('has no violations with template browser', async () => {
    const { container } = render(<TemplatesPanel isOpen={true} onClose={() => {}} />)
    
    await waitFor(() => {
      expect(container.querySelector('input[placeholder*="Search"]')).toBeInTheDocument()
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('has no violations with dev controls enabled', async () => {
    const { container, getByRole } = render(<TemplatesPanel isOpen={true} onClose={() => {}} onInsertBlueprint={() => {}} />)

    // Wait for templates to load and insert button to appear
    const insertBtn = await waitFor(() => {
      const btn = container.querySelector('button[aria-label*="Insert"]')
      expect(btn).toBeInTheDocument()
      return btn
    })

    // Click insert button
    insertBtn?.click()

    // Wait for toggle to appear and click it
    await waitFor(() => {
      const toggle = getByRole('switch')
      expect(toggle).toBeInTheDocument()
      toggle.click()
    })

    // Wait for toggle to be checked
    await waitFor(() => {
      expect(container.querySelector('[aria-checked="true"]')).toBeInTheDocument()
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
