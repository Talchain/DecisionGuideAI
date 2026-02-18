/**
 * Focused tests for ModelSnapshot component.
 * Verifies factor label encoding notation is stripped via stripEncodingNotation.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import type { NodesByKind } from '../hooks/usePreAnalysisData'

// Use dynamic import to avoid hoisting issues
const { ModelSnapshot } = await import('../ModelSnapshot')

function makeNodesByKind(overrides: Partial<NodesByKind> = {}): NodesByKind {
  return {
    goal: [],
    decision: [],
    option: [],
    factor: [],
    risk: [],
    outcome: [],
    ...overrides,
  }
}

describe('ModelSnapshot', () => {
  it('strips encoding notation from factor labels', () => {
    const nodesByKind = makeNodesByKind({
      factor: [
        {
          id: 'fac_cash_runway',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Cash Runway (0–1, share of 18 months)' },
        } as Node,
        {
          id: 'fac_hired',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Tech Lead Hired (0/1)' },
        } as Node,
      ],
    })

    render(<ModelSnapshot nodesByKind={nodesByKind} edgeCount={2} />)

    // Expand the accordion
    fireEvent.click(screen.getByTestId('model-snapshot-accordion'))

    // Cleaned labels should render
    expect(screen.getByText('Cash Runway')).toBeInTheDocument()
    expect(screen.getByText('Tech Lead Hired')).toBeInTheDocument()
    // Raw labels with encoding notation should NOT appear
    expect(screen.queryByText('Cash Runway (0–1, share of 18 months)')).not.toBeInTheDocument()
    expect(screen.queryByText('Tech Lead Hired (0/1)')).not.toBeInTheDocument()
  })

  it('preserves non-factor labels without stripping', () => {
    const nodesByKind = makeNodesByKind({
      goal: [
        {
          id: 'goal1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Reach 200 customers (mid-market)' },
        } as Node,
      ],
    })

    render(<ModelSnapshot nodesByKind={nodesByKind} edgeCount={0} />)

    fireEvent.click(screen.getByTestId('model-snapshot-accordion'))

    // Goal label with parentheses should remain intact (not a factor)
    expect(screen.getByText('Reach 200 customers (mid-market)')).toBeInTheDocument()
  })
})
