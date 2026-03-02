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

  // ── V14.3b: Internal-token filtering ──────────────────────────────────────

  describe('V14.3b: Internal token filtering', () => {
    const INTERNAL_PATTERNS = [
      /constraint_fac_/,
      /observed_state/,
      /intercept=/,
      /fac_[a-z_]+/,
      /blocks_analysis/,
      /node_id=/,
      /edge_id=/,
      /opt_[a-z_]+/,
      /goal_[a-z_]+/,
    ]

    it('filters out warnings containing internal ISL field names', () => {
      const mixedWarnings: Warning[] = [
        { code: 'GENERAL', message: 'Constraint "constraint_fac_customer_churn_max" targets factor node "fac_customer_churn" which has no observed_state.value.' },
        { code: 'EDGE_TYPE_INFERRED', message: '3 edges had no type specified' },
        { code: 'GENERAL', message: 'fac_customer_churn has no derivable range.' },
      ]
      render(<WarningBanner warnings={mixedWarnings} />)

      // Clean warning should render
      expect(screen.getByText('3 edges had no type specified')).toBeInTheDocument()
      // Internal-token warnings should be filtered
      expect(screen.queryByText(/constraint_fac_/)).not.toBeInTheDocument()
      expect(screen.queryByText(/observed_state/)).not.toBeInTheDocument()
      expect(screen.queryByText(/fac_customer_churn/)).not.toBeInTheDocument()
    })

    it('renders nothing when all warnings contain internal tokens', () => {
      const allInternal: Warning[] = [
        { code: 'GENERAL', message: 'constraint_fac_budget_max observed_state.value missing' },
        { code: 'GENERAL', message: 'fac_revenue intercept=0 blocks_analysis' },
      ]
      const { container } = render(<WarningBanner warnings={allInternal} />)
      expect(container.firstChild).toBeNull()
    })

    it('expanded list only shows safe warnings', () => {
      const mixedWarnings: Warning[] = [
        { code: 'EDGE_TYPE_INFERRED', message: 'Edges had no type' },
        { code: 'GENERAL', message: 'fac_competition has intercept=0' },
        { code: 'WEIGHTS_NORMALIZED', message: 'Weights normalized' },
      ]
      render(<WarningBanner warnings={mixedWarnings} />)

      // Only 2 safe warnings → "+1 more warning" (not +2)
      expect(screen.getByText('+1 more warning')).toBeInTheDocument()

      fireEvent.click(screen.getByText('+1 more warning'))

      // Clean warning in expanded list
      expect(screen.getByText('• Weights normalized')).toBeInTheDocument()
      // Internal warning NOT in expanded list
      expect(screen.queryByText(/intercept=0/)).not.toBeInTheDocument()
    })

    it('no internal tokens in any rendered text (production payloads)', () => {
      // Simulate the exact warnings from the user's screenshot
      const productionWarnings: Warning[] = [
        { code: 'GENERAL', message: 'Constraint "constraint_fac_customer_churn_max" targets factor node "fac_customer_churn" which has no observed_state.value. ISL will default to intercept=0, which may produce misleading probability results.' },
        { code: 'GENERAL', message: 'Constraint "constraint_fac_customer_churn_max" target node "fac_customer_churn" has no derivable range. Constraint value will be compared as-is by ISL.' },
        { code: 'GENERAL', message: '1 temporal constraint(s) filtered before analysis: [constraint_goal_mid_market_success_max]. Temporal constraints cannot be evaluated on a static causal graph.' },
      ]
      render(<WarningBanner warnings={productionWarnings} />)

      // All three contain internal tokens — entire banner should be hidden
      expect(screen.queryByTestId('warning-banner')).not.toBeInTheDocument()
      const textContent = document.body.textContent ?? ''
      for (const pattern of INTERNAL_PATTERNS) {
        expect(textContent, `Internal token ${pattern} leaked to DOM`).not.toMatch(pattern)
      }
    })
  })
})
