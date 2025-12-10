/**
 * WarningBanner Unit Tests
 *
 * Tests for the warning banner component that displays
 * API response warnings (edge type inferred, weights normalized, etc.)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WarningBanner, type Warning } from '../WarningBanner'

describe('WarningBanner', () => {
  const mockWarnings: Warning[] = [
    {
      code: 'EDGE_TYPE_INFERRED',
      message: '3 edges had no type specified',
      affected_ids: ['e1', 'e2', 'e3'],
    },
    {
      code: 'WEIGHTS_NORMALIZED',
      message: 'Weights auto-normalized to sum to 1.0',
    },
    {
      code: 'PRIMARY_OUTCOME_INFERRED',
      message: 'Primary outcome was inferred from graph structure',
    },
  ]

  it('renders nothing when warnings array is empty', () => {
    const { container } = render(<WarningBanner warnings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('displays first warning message', () => {
    render(<WarningBanner warnings={mockWarnings} />)
    expect(screen.getByText('3 edges had no type specified')).toBeInTheDocument()
  })

  it('has correct ARIA attributes for accessibility', () => {
    render(<WarningBanner warnings={mockWarnings} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('shows expand button when multiple warnings exist', () => {
    render(<WarningBanner warnings={mockWarnings} />)
    expect(screen.getByText('+2 more warnings')).toBeInTheDocument()
  })

  it('shows singular "warning" when only one additional warning', () => {
    const twoWarnings = mockWarnings.slice(0, 2)
    render(<WarningBanner warnings={twoWarnings} />)
    expect(screen.getByText('+1 more warning')).toBeInTheDocument()
  })

  it('expands to show all warnings when expand button is clicked', () => {
    render(<WarningBanner warnings={mockWarnings} />)

    // Initially hidden
    expect(
      screen.queryByText('• Weights auto-normalized to sum to 1.0')
    ).not.toBeInTheDocument()

    // Click expand
    fireEvent.click(screen.getByText('+2 more warnings'))

    // Now visible
    expect(
      screen.getByText('• Weights auto-normalized to sum to 1.0')
    ).toBeInTheDocument()
    expect(
      screen.getByText('• Primary outcome was inferred from graph structure')
    ).toBeInTheDocument()
  })

  it('collapses warnings when clicking expand button again', () => {
    render(<WarningBanner warnings={mockWarnings} />)

    // Expand
    fireEvent.click(screen.getByText('+2 more warnings'))
    expect(
      screen.getByText('• Weights auto-normalized to sum to 1.0')
    ).toBeInTheDocument()

    // Collapse
    fireEvent.click(screen.getByText('+2 more warnings'))
    expect(
      screen.queryByText('• Weights auto-normalized to sum to 1.0')
    ).not.toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<WarningBanner warnings={mockWarnings} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByLabelText('Dismiss warning'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not show dismiss button when onDismiss is not provided', () => {
    render(<WarningBanner warnings={mockWarnings} />)
    expect(screen.queryByLabelText('Dismiss warning')).not.toBeInTheDocument()
  })

  it('calls onViewAffected with affected_ids when view link is clicked', () => {
    const onViewAffected = vi.fn()
    render(
      <WarningBanner warnings={mockWarnings} onViewAffected={onViewAffected} />
    )

    fireEvent.click(screen.getByText('View 3 affected items'))
    expect(onViewAffected).toHaveBeenCalledWith(['e1', 'e2', 'e3'])
  })

  it('shows singular "item" when only one affected item', () => {
    const singleAffectedWarning: Warning[] = [
      {
        code: 'EDGE_TYPE_INFERRED',
        message: '1 edge had no type specified',
        affected_ids: ['e1'],
      },
    ]
    const onViewAffected = vi.fn()

    render(
      <WarningBanner
        warnings={singleAffectedWarning}
        onViewAffected={onViewAffected}
      />
    )

    expect(screen.getByText('View 1 affected item')).toBeInTheDocument()
  })

  it('does not show view link when no affected_ids', () => {
    const warningWithoutAffected: Warning[] = [
      {
        code: 'WEIGHTS_NORMALIZED',
        message: 'Weights auto-normalized to sum to 1.0',
      },
    ]
    const onViewAffected = vi.fn()

    render(
      <WarningBanner
        warnings={warningWithoutAffected}
        onViewAffected={onViewAffected}
      />
    )

    expect(screen.queryByText(/View.*affected/)).not.toBeInTheDocument()
  })

  it('does not show view link when onViewAffected is not provided', () => {
    render(<WarningBanner warnings={mockWarnings} />)
    expect(screen.queryByText(/View.*affected/)).not.toBeInTheDocument()
  })

  it('renders with data-testid for integration testing', () => {
    render(<WarningBanner warnings={mockWarnings} />)
    expect(screen.getByTestId('warning-banner')).toBeInTheDocument()
  })

  it('handles empty affected_ids array', () => {
    const warningEmptyAffected: Warning[] = [
      {
        code: 'EDGE_TYPE_INFERRED',
        message: 'Some edges had no type',
        affected_ids: [],
      },
    ]
    const onViewAffected = vi.fn()

    render(
      <WarningBanner
        warnings={warningEmptyAffected}
        onViewAffected={onViewAffected}
      />
    )

    expect(screen.queryByText(/View.*affected/)).not.toBeInTheDocument()
  })

  it('handles single warning without expand option', () => {
    const singleWarning = mockWarnings.slice(0, 1)
    render(<WarningBanner warnings={singleWarning} />)

    expect(screen.getByText('3 edges had no type specified')).toBeInTheDocument()
    expect(screen.queryByText(/more warning/)).not.toBeInTheDocument()
  })
})
