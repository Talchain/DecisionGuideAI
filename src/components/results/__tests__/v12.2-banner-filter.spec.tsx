/**
 * V12.2 Fix 2: Banner runtime guard against internal pattern leaks
 * Tests AttentionBanner filtering of raw critique text
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionBanner } from '../AttentionBanner'
import type { HumanisedCritique } from '../utils/humaniseCritique'

describe('Fix 2: AttentionBanner runtime guard', () => {
  it('filters out items containing constraint_fac_ pattern', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'Good item',
        description: 'This should render',
        suggestion: 'Review this',
        factorId: 'factor_1',
      },
      {
        title: 'constraint_fac_customer_churn_max is invalid',
        description: 'This should be filtered',
        suggestion: 'Check this',
        factorId: 'fac_customer_churn',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.getByText('Good item')).toBeInTheDocument()
    expect(screen.queryByText(/constraint_fac_customer_churn_max/)).not.toBeInTheDocument()
  })

  it('filters out items containing observed_state pattern', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'observed_state.value is missing',
        description: 'Internal leak',
        factorId: 'factor_1',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument()  // Banner hidden when all items filtered
  })

  it('filters out items containing intercept= pattern', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'Factor has issue',
        description: 'intercept=0 for fac_churn',
        factorId: 'fac_churn',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument()
  })

  it('filters out items containing raw fac_ IDs in title', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'fac_engineering_capacity_max needs review',
        description: 'Check this factor',
        factorId: 'fac_engineering_capacity',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument()
  })

  it('filters out items containing blocks_analysis pattern', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'This blocks_analysis from completing',
        description: 'Internal error message',
        factorId: 'factor_1',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument()
  })

  it('filters out items containing node_id= or edge_id= patterns', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'Error with node_id=fac_revenue',
        description: 'Internal reference',
        factorId: 'fac_revenue',
      },
      {
        title: 'Issue on edge_id=e123',
        description: 'Edge problem',
        factorId: 'factor_2',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.queryByTestId('attention-banner')).not.toBeInTheDocument()
  })

  it('allows clean humanised critiques to pass through', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'Customer Churn Rate has no estimate set',
        description: 'Results may be unreliable without a current value for this constraint.',
        suggestion: 'Set estimate →',
        factorId: 'fac_customer_churn',
      },
    ]

    render(<AttentionBanner items={items} />)

    expect(screen.getByText('Customer Churn Rate has no estimate set')).toBeInTheDocument()
    expect(screen.getByText('Results may be unreliable without a current value for this constraint.')).toBeInTheDocument()
  })

  it('filters expanded items in "+N more" collapse', () => {
    const items: HumanisedCritique[] = [
      {
        title: 'First item (clean)',
        description: 'This renders',
        factorId: 'factor_1',
      },
      {
        title: 'Second item (clean)',
        description: 'This also renders',
        factorId: 'factor_2',
      },
      {
        title: 'Third item with constraint_fac_ leak',
        description: 'This should be filtered',
        factorId: 'fac_bad',
      },
      {
        title: 'Fourth item (clean)',
        description: 'This renders',
        factorId: 'factor_4',
      },
    ]

    const { container } = render(<AttentionBanner items={items} />)

    // Should show first clean item inline
    expect(screen.getByText('First item (clean)')).toBeInTheDocument()

    // Should show "and 2 more" (not 3, because one was filtered)
    expect(screen.getByText('and 2 more')).toBeInTheDocument()

    // Leak should not appear anywhere
    expect(container.textContent).not.toMatch(/constraint_fac_/)
  })
})
