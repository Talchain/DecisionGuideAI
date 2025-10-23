import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateCard } from '../../../src/canvas/panels/TemplateCard'

describe('TemplateCard', () => {
  const mockTemplate = {
    id: 'pricing-v1',
    name: 'Pricing Strategy',
    description: 'Compare pricing tiers and revenue impact'
  }

  it('renders template name and description', () => {
    render(<TemplateCard template={mockTemplate} onInsert={() => {}} />)
    
    expect(screen.getByText('Pricing Strategy')).toBeInTheDocument()
    expect(screen.getByText('Compare pricing tiers and revenue impact')).toBeInTheDocument()
  })

  it('calls onInsert when Insert button clicked', () => {
    const onInsert = vi.fn()
    render(<TemplateCard template={mockTemplate} onInsert={onInsert} />)
    
    fireEvent.click(screen.getByRole('button', { name: /insert pricing strategy/i }))
    
    expect(onInsert).toHaveBeenCalledWith('pricing-v1')
  })

  it('calls onLearnMore when Learn more button clicked', () => {
    const onLearnMore = vi.fn()
    render(<TemplateCard template={mockTemplate} onInsert={() => {}} onLearnMore={onLearnMore} />)
    
    fireEvent.click(screen.getByRole('button', { name: /learn more/i }))
    
    expect(onLearnMore).toHaveBeenCalledWith('pricing-v1')
  })

  it('does not render Learn more button when onLearnMore not provided', () => {
    render(<TemplateCard template={mockTemplate} onInsert={() => {}} />)
    
    expect(screen.queryByRole('button', { name: /learn more/i })).not.toBeInTheDocument()
  })
})
