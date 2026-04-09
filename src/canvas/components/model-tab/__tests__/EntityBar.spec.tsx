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

const makeGrouped = (counts: Partial<Record<string, number>>) => {
  const result: Record<string, Node[]> = { goal: [], decision: [], option: [], factor: [], risk: [], outcome: [] }
  for (const [kind, count] of Object.entries(counts)) {
    result[kind] = makeNodes(kind, count ?? 0)
  }
  return result
}

describe('EntityBar', () => {
  it('renders nothing when totalCount is 0', () => {
    const grouped = { goal: [], decision: [], option: [], factor: [], risk: [], outcome: [] }
    const { container } = render(<EntityBar grouped={grouped} totalCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders proportional segments and tooltip', () => {
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
    // Legend replaced with hover tooltip on the bar
    const bar = screen.getByTitle(/1 goal/)
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('title')).toContain('2 options')
    expect(bar.getAttribute('title')).toContain('5 factors')
    // Outcome has 0 — should not appear in tooltip
    expect(bar.getAttribute('title')).not.toContain('outcome')
  })

  it('shows breakdown tooltip on the bar', () => {
    const grouped = makeGrouped({ goal: 1, factor: 3, option: 2 })
    render(<EntityBar grouped={grouped} totalCount={6} />)
    const bar = screen.getByTestId('model-entity-bar').querySelector('[title]')
    expect(bar).toBeTruthy()
    expect(bar?.getAttribute('title')).toContain('1 goal')
    expect(bar?.getAttribute('title')).toContain('3 factors')
    expect(bar?.getAttribute('title')).toContain('2 options')
  })

  it('renders inline legend with colour dots below the bar', () => {
    const grouped = makeGrouped({ goal: 1, factor: 3, option: 2, risk: 1 })
    render(<EntityBar grouped={grouped} totalCount={7} />)
    const legend = screen.getByTestId('entity-bar-legend')
    expect(legend).toBeInTheDocument()
    expect(legend.textContent).toContain('1 goal')
    expect(legend.textContent).toContain('3 factors')
    expect(legend.textContent).toContain('2 options')
    expect(legend.textContent).toContain('1 risk')
    // Each legend entry has a colour dot
    const dots = legend.querySelectorAll('.rounded-full')
    expect(dots.length).toBeGreaterThanOrEqual(4)
  })
})
