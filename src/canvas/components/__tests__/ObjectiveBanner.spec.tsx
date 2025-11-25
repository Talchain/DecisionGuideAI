import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveBanner } from '../ObjectiveBanner'

describe('ObjectiveBanner', () => {
  it('renders with maximize goal direction', () => {
    render(
      <ObjectiveBanner
        objectiveText="Increase customer satisfaction"
        goalDirection="maximize"
      />
    )

    expect(screen.getByTestId('objective-banner')).toBeInTheDocument()
    expect(screen.getByText(/Your objective/i)).toBeInTheDocument()
    expect(screen.getByText(/Increase customer satisfaction/i)).toBeInTheDocument()
    expect(screen.getByText(/Maximize/i)).toBeInTheDocument()
  })

  it('renders with minimize goal direction', () => {
    render(
      <ObjectiveBanner
        objectiveText="Reduce operational costs"
        goalDirection="minimize"
      />
    )

    expect(screen.getByText(/Reduce operational costs/i)).toBeInTheDocument()
    expect(screen.getByText(/Minimize/i)).toBeInTheDocument()
  })

  it('displays Target icon', () => {
    const { container } = render(
      <ObjectiveBanner
        objectiveText="Test objective"
        goalDirection="maximize"
      />
    )

    // Check for Target icon (lucide-react renders as svg)
    const icons = container.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('displays trending up icon for maximize', () => {
    const { container } = render(
      <ObjectiveBanner
        objectiveText="Test"
        goalDirection="maximize"
      />
    )

    // Should have 2 icons: Target + TrendingUp
    const icons = container.querySelectorAll('svg')
    expect(icons.length).toBe(2)
  })

  it('displays trending down icon for minimize', () => {
    const { container } = render(
      <ObjectiveBanner
        objectiveText="Test"
        goalDirection="minimize"
      />
    )

    // Should have 2 icons: Target + TrendingDown
    const icons = container.querySelectorAll('svg')
    expect(icons.length).toBe(2)
  })

  it('has proper accessibility attributes', () => {
    render(
      <ObjectiveBanner
        objectiveText="Test objective"
        goalDirection="maximize"
      />
    )

    const banner = screen.getByTestId('objective-banner')
    expect(banner).toHaveAttribute('role', 'region')
    expect(banner).toHaveAttribute('aria-label', 'Objective')
  })

  it('handles long objective text without breaking layout', () => {
    const longText = 'This is a very long objective text that should wrap properly without breaking the layout or causing overflow issues in the banner component'

    render(
      <ObjectiveBanner
        objectiveText={longText}
        goalDirection="maximize"
      />
    )

    expect(screen.getByText(longText)).toBeInTheDocument()
  })

  it('uses sky color scheme', () => {
    const { container } = render(
      <ObjectiveBanner
        objectiveText="Test"
        goalDirection="maximize"
      />
    )

    const banner = screen.getByTestId('objective-banner')
    expect(banner.className).toContain('bg-sky-50')
    expect(banner.className).toContain('border-sky-200')
  })
})
