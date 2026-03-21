import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelErrorBoundary } from '../PanelErrorBoundary'

// Mock monitoring to verify Sentry integration
const mockCaptureError = vi.fn()
vi.mock('../../../lib/monitoring', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}))

// Suppress console.error from error boundaries in test output
const originalError = console.error
beforeEach(() => {
  vi.clearAllMocks()
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

// Component that throws on render
function Thrower({ message }: { message: string }): JSX.Element {
  throw new Error(message)
}

// Component that renders normally
function Happy(): JSX.Element {
  return <div data-testid="happy">All good</div>
}

describe('PanelErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <PanelErrorBoundary panel="Test">
        <Happy />
      </PanelErrorBoundary>
    )
    expect(screen.getByTestId('happy')).toBeInTheDocument()
  })

  it('catches render error and shows fallback UI with panel name', () => {
    render(
      <PanelErrorBoundary panel="Results">
        <Thrower message="boom" />
      </PanelErrorBoundary>
    )
    expect(screen.getByText('Results encountered an error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByTestId('happy')).not.toBeInTheDocument()
  })

  it('reports error to Sentry via captureError', () => {
    render(
      <PanelErrorBoundary panel="Inspector">
        <Thrower message="sentry test" />
      </PanelErrorBoundary>
    )
    expect(mockCaptureError).toHaveBeenCalledTimes(1)
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'sentry test' }),
      expect.objectContaining({ label: 'PanelErrorBoundary:Inspector' })
    )
  })

  it('re-mounts children on retry click (recovery flow)', () => {
    let shouldThrow = true
    function Conditional(): JSX.Element {
      if (shouldThrow) throw new Error('first render')
      return <div data-testid="recovered">Recovered</div>
    }

    const { rerender } = render(
      <PanelErrorBoundary panel="Test">
        <Conditional />
      </PanelErrorBoundary>
    )

    // Verify error state
    expect(screen.getByText('Test encountered an error')).toBeInTheDocument()

    // Fix the error condition, then retry
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    // Force re-render to pick up the new shouldThrow value
    rerender(
      <PanelErrorBoundary panel="Test">
        <Conditional />
      </PanelErrorBoundary>
    )

    expect(screen.getByTestId('recovered')).toBeInTheDocument()
    expect(screen.queryByText('Test encountered an error')).not.toBeInTheDocument()
  })

  it('shows error message details in DEV mode', () => {
    // import.meta.env.DEV is true in vitest (jsdom) environment
    render(
      <PanelErrorBoundary panel="Test">
        <Thrower message="debug error info" />
      </PanelErrorBoundary>
    )
    // In DEV mode, error message IS shown for debugging
    expect(screen.getByText('debug error info')).toBeInTheDocument()
    // Panel name should always be shown
    expect(screen.getByText('Test encountered an error')).toBeInTheDocument()
  })
})
