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

  it('groups decision and option labels by kind', () => {
    const nodesByKind = makeNodesByKind({
      decision: [
        {
          id: 'dec1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: { label: 'Mid-Market Expansion Strategy' },
        } as Node,
      ],
      option: [
        {
          id: 'opt1',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Acquire Smaller Competitor' },
        } as Node,
        {
          id: 'opt2',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Organic Growth' },
        } as Node,
      ],
    })

    render(<ModelSnapshot nodesByKind={nodesByKind} edgeCount={3} />)

    // Expand the accordion
    fireEvent.click(screen.getByTestId('model-snapshot-accordion'))

    // Decision label should be present
    expect(screen.getByText('Mid-Market Expansion Strategy')).toBeInTheDocument()
    // Option labels should be present
    expect(screen.getByText('Acquire Smaller Competitor')).toBeInTheDocument()
    expect(screen.getByText('Organic Growth')).toBeInTheDocument()
    // Both kind headers should render
    expect(screen.getByText('Decisions')).toBeInTheDocument()
    expect(screen.getByText('Options')).toBeInTheDocument()
  })

  it('shows decision nodes only in Decisions section, not in Options', () => {
    const nodesByKind = makeNodesByKind({
      decision: [
        {
          id: 'dec1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: { label: 'Expand to Europe' },
        } as Node,
      ],
      option: [
        {
          id: 'opt1',
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Expand to Europe via Acquisition' },
        } as Node,
      ],
    })

    render(<ModelSnapshot nodesByKind={nodesByKind} edgeCount={2} />)
    fireEvent.click(screen.getByTestId('model-snapshot-accordion'))

    // Both section headers should appear
    expect(screen.getByText('Decisions')).toBeInTheDocument()
    expect(screen.getByText('Options')).toBeInTheDocument()

    // Decision label appears only in the Decisions section
    expect(screen.getByText('Expand to Europe')).toBeInTheDocument()
    // Option label appears separately
    expect(screen.getByText('Expand to Europe via Acquisition')).toBeInTheDocument()

    // Decision label must NOT appear in the Options section — verify by checking
    // that there is exactly one element with this label text
    expect(screen.getAllByText('Expand to Europe')).toHaveLength(1)
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
