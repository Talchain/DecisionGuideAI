/**
 * EntityBar — unit tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EntityBar } from '../EntityBar'
import type { Node } from '@xyflow/react'

const makeNodes = (kind: string, count: number): Node[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${kind}-${i}`,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label: `${kind} ${i}`, kind },
  }))

describe('EntityBar', () => {
  it('renders nothing when totalCount is 0', () => {
    const grouped = { goal: [], decision: [], option: [], factor: [], risk: [], outcome: [] }
    const { container } = render(<EntityBar grouped={grouped} totalCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders proportional segments and legend', () => {
    const grouped = {
      goal: makeNodes('goal', 1),
      decision: makeNodes('decision', 1),
      option: makeNodes('option', 2),
      factor: makeNodes('factor', 5),
      risk: makeNodes('risk', 1),
      outcome: makeNodes('outcome', 0),
    }
    render(<EntityBar grouped={grouped} totalCount={10} />)
    expect(screen.getByTestId('model-entity-bar')).toBeInTheDocument()
    expect(screen.getByText('1 goal')).toBeInTheDocument()
    expect(screen.getByText('2 options')).toBeInTheDocument()
    expect(screen.getByText('5 factors')).toBeInTheDocument()
    // Outcome has 0 — should not appear
    expect(screen.queryByText(/outcome/)).not.toBeInTheDocument()
  })
})
