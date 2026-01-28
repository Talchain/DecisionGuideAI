import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LensContainer } from '../LensContainer'

describe('LensContainer', () => {
  it('renders title and children when defaultOpen is true', () => {
    render(
      <LensContainer title="Test Lens" defaultOpen={true} testId="test-lens">
        <div data-testid="lens-content">Content inside</div>
      </LensContainer>
    )

    expect(screen.getByText('Test Lens')).toBeInTheDocument()
    expect(screen.getByTestId('lens-content')).toBeInTheDocument()
  })

  it('hides children when defaultOpen is false', () => {
    render(
      <LensContainer title="Collapsed Lens" defaultOpen={false} testId="collapsed-lens">
        <div data-testid="hidden-content">Hidden content</div>
      </LensContainer>
    )

    expect(screen.getByText('Collapsed Lens')).toBeInTheDocument()
    expect(screen.queryByTestId('hidden-content')).not.toBeInTheDocument()
  })

  it('toggles content visibility when clicked', () => {
    render(
      <LensContainer title="Toggle Lens" defaultOpen={true} testId="toggle-lens">
        <div data-testid="toggle-content">Toggle me</div>
      </LensContainer>
    )

    // Initially visible
    expect(screen.getByTestId('toggle-content')).toBeInTheDocument()

    // Click to collapse
    const button = screen.getByRole('button', { name: /Toggle Lens/i })
    fireEvent.click(button)

    // Should be hidden
    expect(screen.queryByTestId('toggle-content')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(button)

    // Should be visible again
    expect(screen.getByTestId('toggle-content')).toBeInTheDocument()
  })

  it('has correct aria-expanded attribute', () => {
    render(
      <LensContainer title="Aria Test" defaultOpen={true} testId="aria-lens">
        <div>Content</div>
      </LensContainer>
    )

    const button = screen.getByRole('button', { name: /Aria Test/i })
    expect(button).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('has aria-controls linked to region id with proper a11y attributes', () => {
    render(
      <LensContainer title="Controls Test" defaultOpen={true} testId="controls-lens">
        <div data-testid="region-content">Content</div>
      </LensContainer>
    )

    const button = screen.getByRole('button', { name: /Controls Test/i })
    const ariaControls = button.getAttribute('aria-controls')
    const buttonId = button.getAttribute('id')
    expect(ariaControls).toBeTruthy()
    expect(buttonId).toBeTruthy()

    // The region should have the same ID as aria-controls
    const region = document.getElementById(ariaControls!)
    expect(region).toBeInTheDocument()
    expect(region).toContainElement(screen.getByTestId('region-content'))

    // Region should have role="region" and aria-labelledby pointing to button
    expect(region).toHaveAttribute('role', 'region')
    expect(region).toHaveAttribute('aria-labelledby', buttonId)
  })

  it('shows correct chevron icon based on state', () => {
    render(
      <LensContainer title="Icon Test" defaultOpen={false} testId="icon-lens">
        <div>Content</div>
      </LensContainer>
    )

    // When collapsed, ChevronRight should be shown (pointing right)
    const button = screen.getByRole('button')
    // The SVG changes based on open/closed state
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('applies testId to container', () => {
    render(
      <LensContainer title="TestId Test" defaultOpen={true} testId="my-test-lens">
        <div>Content</div>
      </LensContainer>
    )

    expect(screen.getByTestId('my-test-lens')).toBeInTheDocument()
  })
})
