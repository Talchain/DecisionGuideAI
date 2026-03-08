/**
 * ResultsTrustStrip — component tests.
 * Phase 2A: Results trust strip.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ResultsTrustStrip } from '../ResultsTrustStrip'

vi.mock('../../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

describe('ResultsTrustStrip', () => {
  it('renders with all fields', () => {
    render(
      <ResultsTrustStrip
        nSamples={1000}
        seedUsed={123456789}
        confidenceLabel="Robust"
      />,
    )

    expect(screen.getByText(/1,000 simulations/)).toBeInTheDocument()
    expect(screen.getByText(/456789/)).toBeInTheDocument() // Last 6 digits
    expect(screen.getByText(/Robust/)).toBeInTheDocument()
  })

  it('renders nothing when no data available', () => {
    const { container } = render(
      <ResultsTrustStrip nSamples={null} seedUsed={null} confidenceLabel={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders with partial data (only nSamples)', () => {
    render(<ResultsTrustStrip nSamples={500} />)
    expect(screen.getByText(/500 simulations/)).toBeInTheDocument()
  })

  it('"View model details" link present and fires callback', () => {
    const handleClick = vi.fn()
    render(
      <ResultsTrustStrip
        nSamples={1000}
        onViewModelDetails={handleClick}
      />,
    )

    const link = screen.getByText('View model details')
    expect(link).toBeInTheDocument()

    fireEvent.click(link)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders fully without onViewModelDetails (self-sufficient)', () => {
    render(
      <ResultsTrustStrip
        nSamples={1000}
        seedUsed={42}
        confidenceLabel="Moderate"
      />,
    )

    expect(screen.getByText(/1,000 simulations/)).toBeInTheDocument()
    // No "View model details" link when callback absent
    expect(screen.queryByText('View model details')).not.toBeInTheDocument()
  })

  it('truncates seed to last 6 digits', () => {
    render(<ResultsTrustStrip seedUsed={9876543210} />)
    expect(screen.getByText(/543210/)).toBeInTheDocument()
  })

  it('has accessible aria-label', () => {
    render(<ResultsTrustStrip nSamples={100} />)
    expect(screen.getByLabelText('Analysis trust summary')).toBeInTheDocument()
  })
})
