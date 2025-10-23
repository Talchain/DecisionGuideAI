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
  }
}))

vi.mock('../../../src/templates/blueprints', () => ({
  getAllBlueprints: vi.fn(),
  getBlueprintById: vi.fn()
}))

const mockGetAllBlueprints = vi.mocked(blueprintsModule.getAllBlueprints)
const mockGetBlueprintById = vi.mocked(blueprintsModule.getBlueprintById)

describe('TemplatesPanel A11y', () => {
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
    
    await waitFor(() => {
      const insertBtn = container.querySelector('button[aria-label*="Insert"]')
      insertBtn?.click()
    })
    
    await waitFor(() => {
      const toggle = getByRole('switch')
      toggle.click()
    })
    
    await waitFor(() => {
      expect(container.querySelector('[aria-checked="true"]')).toBeInTheDocument()
    })
    
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
