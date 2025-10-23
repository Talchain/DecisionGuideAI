import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateAbout } from '../../../src/canvas/panels/TemplateAbout'
import type { Blueprint } from '../../../src/templates/blueprints/types'

describe('TemplateAbout', () => {
  const mockBlueprint: Blueprint = {
    id: 'pricing-v1',
    name: 'Pricing Strategy',
    description: 'Short description',
    longDescription: 'Detailed description of the template',
    expectedInputs: ['Base price', 'Premium price'],
    assumptions: ['Market size constant'],
    nodes: [],
    edges: []
  }

  it('renders template name and long description', () => {
    render(<TemplateAbout blueprint={mockBlueprint} />)
    
    expect(screen.getByText('About Pricing Strategy')).toBeInTheDocument()
    expect(screen.getByText('Detailed description of the template')).toBeInTheDocument()
  })

  it('renders expected inputs', () => {
    render(<TemplateAbout blueprint={mockBlueprint} />)
    
    expect(screen.getByText('Expected inputs:')).toBeInTheDocument()
    expect(screen.getByText('Base price, Premium price')).toBeInTheDocument()
  })

  it('renders assumptions', () => {
    render(<TemplateAbout blueprint={mockBlueprint} />)
    
    expect(screen.getByText('Assumptions:')).toBeInTheDocument()
    expect(screen.getByText('Market size constant')).toBeInTheDocument()
  })

  it('falls back to description when longDescription not provided', () => {
    const blueprint = { ...mockBlueprint, longDescription: undefined }
    render(<TemplateAbout blueprint={blueprint} />)
    
    expect(screen.getByText('Short description')).toBeInTheDocument()
  })
})
