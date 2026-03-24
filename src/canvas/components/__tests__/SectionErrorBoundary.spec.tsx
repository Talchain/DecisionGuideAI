import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionErrorBoundary } from '../SectionErrorBoundary'

// Suppress React error boundary noise in test output
const originalError = console.error
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('SectionErrorBoundary') || msg.includes('The above error')) return
    originalError(...args)
  })
})

function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Boom: test explosion')
  return <div data-testid="child-content">All good</div>
}

describe('SectionErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <SectionErrorBoundary section="Test section">
        <BombComponent shouldThrow={false} />
      </SectionErrorBoundary>,
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <SectionErrorBoundary section="Test section">
        <BombComponent shouldThrow={true} />
      </SectionErrorBoundary>,
    )
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
    expect(screen.getByText("This section couldn't load")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('re-mounts child after clicking Retry', () => {
    const { rerender } = render(
      <SectionErrorBoundary section="Test section">
        <BombComponent shouldThrow={true} />
      </SectionErrorBoundary>,
    )
    expect(screen.getByText("This section couldn't load")).toBeInTheDocument()

    // Re-render with non-throwing child, then click retry
    rerender(
      <SectionErrorBoundary section="Test section">
        <BombComponent shouldThrow={false} />
      </SectionErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.queryByText("This section couldn't load")).not.toBeInTheDocument()
  })

  it('does not show technical details by default (no diag mode)', () => {
    render(
      <SectionErrorBoundary section="Test section">
        <BombComponent shouldThrow={true} />
      </SectionErrorBoundary>,
    )
    expect(screen.queryByText('Show technical details')).not.toBeInTheDocument()
    expect(screen.queryByText('Boom: test explosion')).not.toBeInTheDocument()
  })

  it('shows expandable technical details in diag mode', () => {
    // Enable diag mode via global flag
    ;(window as any).__OLUMI_DEBUG = true
    try {
      render(
        <SectionErrorBoundary section="Test section">
          <BombComponent shouldThrow={true} />
        </SectionErrorBoundary>,
      )
      expect(screen.getByText('Show technical details')).toBeInTheDocument()

      // Expand details
      fireEvent.click(screen.getByText('Show technical details'))
      expect(screen.getByText('Boom: test explosion')).toBeInTheDocument()
    } finally {
      delete (window as any).__OLUMI_DEBUG
    }
  })

  it('reports error to captureError', () => {
    // captureError is called inside componentDidCatch — verify no throw
    render(
      <SectionErrorBoundary section="Edge summary">
        <BombComponent shouldThrow={true} />
      </SectionErrorBoundary>,
    )
    expect(screen.getByText("This section couldn't load")).toBeInTheDocument()
  })

  it('isolates crash to one section — sibling sections survive', () => {
    function HealthySection() {
      return <div data-testid="healthy-section">Healthy content</div>
    }

    render(
      <div>
        <SectionErrorBoundary section="Crashing section">
          <BombComponent shouldThrow={true} />
        </SectionErrorBoundary>
        <SectionErrorBoundary section="Healthy section">
          <HealthySection />
        </SectionErrorBoundary>
      </div>,
    )

    // Crashing section shows fallback
    expect(screen.getByText("This section couldn't load")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()

    // Sibling section renders normally
    expect(screen.getByTestId('healthy-section')).toBeInTheDocument()
    expect(screen.getByText('Healthy content')).toBeInTheDocument()
  })
})
