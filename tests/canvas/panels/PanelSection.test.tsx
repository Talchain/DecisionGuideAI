import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelSection } from '../../../src/canvas/panels/_shared/PanelSection'

describe('PanelSection', () => {
  it('renders with title and children', () => {
    render(
      <PanelSection title="Section Title">
        <div>Section content</div>
      </PanelSection>
    )

    expect(screen.getByText('Section Title')).toBeInTheDocument()
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })

  it('renders as semantic section element', () => {
    const { container } = render(
      <PanelSection title="Test Section">
        <div>Content</div>
      </PanelSection>
    )

    const section = container.querySelector('section')
    expect(section).toBeInTheDocument()
  })

  it('renders help element when provided', () => {
    const helpElement = <button data-testid="help-button">?</button>
    render(
      <PanelSection title="Section with Help" help={helpElement}>
        <div>Content</div>
      </PanelSection>
    )

    expect(screen.getByTestId('help-button')).toBeInTheDocument()
  })

  it('does not render help when not provided', () => {
    render(
      <PanelSection title="Section without Help">
        <div>Content</div>
      </PanelSection>
    )

    expect(screen.queryByTestId('help-button')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <PanelSection title="Custom Section" className="custom-class">
        <div>Content</div>
      </PanelSection>
    )

    const section = container.querySelector('section')
    expect(section).toHaveClass('custom-class')
  })

  it('has default styling classes', () => {
    const { container } = render(
      <PanelSection title="Styled Section">
        <div>Content</div>
      </PanelSection>
    )

    const section = container.querySelector('section')
    expect(section).toHaveClass('border', 'border-gray-200', 'rounded-xl', 'p-3', 'bg-white')
  })

  it('title has correct styling', () => {
    render(
      <PanelSection title="Test Title">
        <div>Content</div>
      </PanelSection>
    )

    const title = screen.getByText('Test Title')
    expect(title.tagName).toBe('H4')
    expect(title).toHaveClass('text-[12px]', 'font-medium', 'text-gray-600', 'uppercase', 'tracking-wide')
  })

  it('renders multiple children', () => {
    render(
      <PanelSection title="Multiple Children">
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </PanelSection>
    )

    expect(screen.getByText('Child 1')).toBeInTheDocument()
    expect(screen.getByText('Child 2')).toBeInTheDocument()
    expect(screen.getByText('Child 3')).toBeInTheDocument()
  })

  it('renders complex content', () => {
    render(
      <PanelSection title="Complex Section">
        <div data-testid="complex-content">
          <p>Paragraph 1</p>
          <button>Action Button</button>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      </PanelSection>
    )

    expect(screen.getByTestId('complex-content')).toBeInTheDocument()
    expect(screen.getByText('Paragraph 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('combines custom className with default classes', () => {
    const { container } = render(
      <PanelSection title="Combined Classes" className="my-custom-class">
        <div>Content</div>
      </PanelSection>
    )

    const section = container.querySelector('section')
    // Should have both default and custom classes
    expect(section).toHaveClass('my-custom-class')
    expect(section).toHaveClass('border', 'border-gray-200', 'rounded-xl', 'p-3', 'bg-white')
  })
})
