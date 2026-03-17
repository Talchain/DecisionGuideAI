import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeThicknessLegend } from '../EdgeThicknessLegend'

describe('EdgeThicknessLegend', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders 3 line samples with labels when visible', () => {
    render(<EdgeThicknessLegend visible />)

    expect(screen.getByTestId('edge-thickness-legend')).toBeInTheDocument()
    expect(screen.getByText('Weak influence')).toBeInTheDocument()
    expect(screen.getByText('Moderate influence')).toBeInTheDocument()
    expect(screen.getByText('Strong influence')).toBeInTheDocument()

    // 3 SVG line elements for the samples (plus 1 for the Lucide X icon = 4 total)
    const lines = screen.getByTestId('edge-thickness-legend').querySelectorAll('svg line')
    expect(lines).toHaveLength(3)
  })

  it('is not rendered when visible=false', () => {
    render(<EdgeThicknessLegend visible={false} />)

    expect(screen.queryByTestId('edge-thickness-legend')).not.toBeInTheDocument()
  })

  it('dismiss button hides legend', () => {
    render(<EdgeThicknessLegend visible />)

    expect(screen.getByTestId('edge-thickness-legend')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /dismiss legend/i }))

    expect(screen.queryByTestId('edge-thickness-legend')).not.toBeInTheDocument()
  })

  it('is not rendered after dismiss even if visible remains true', () => {
    const { rerender } = render(<EdgeThicknessLegend visible />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss legend/i }))
    expect(screen.queryByTestId('edge-thickness-legend')).not.toBeInTheDocument()

    // Re-render with same props — should stay dismissed (component-local state)
    rerender(<EdgeThicknessLegend visible />)
    expect(screen.queryByTestId('edge-thickness-legend')).not.toBeInTheDocument()
  })

  it('has correct aria attributes', () => {
    render(<EdgeThicknessLegend visible />)

    const legend = screen.getByTestId('edge-thickness-legend')
    expect(legend).toHaveAttribute('role', 'figure')
    expect(legend).toHaveAttribute('aria-label', 'Edge thickness legend')
  })
})
