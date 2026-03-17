/**
 * WorthInvestigating — component + derivation tests.
 * Phase 2B: Pre-analysis enrichment (Task 4b).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WorthInvestigating, deriveEvidenceGaps } from '../WorthInvestigating'

vi.mock('../../../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

describe('deriveEvidenceGaps', () => {
  it('identifies factors without observed data', () => {
    const nodes = [
      { id: 'f1', data: { kind: 'factor', label: 'Revenue' } },
      { id: 'f2', data: { kind: 'factor', label: 'Cost', observedState: { value: 100 } } },
      { id: 'f3', data: { kind: 'factor', label: 'Churn' } },
    ] as any[]
    const edges = [
      { id: 'e1', source: 'f1', target: 'f3' },
      { id: 'e2', source: 'f2', target: 'f3' },
    ] as any[]

    const gaps = deriveEvidenceGaps(nodes, edges)
    expect(gaps).toHaveLength(2) // Revenue and Churn (Cost has data)
    expect(gaps.map(g => g.factorLabel)).toContain('Revenue')
    expect(gaps.map(g => g.factorLabel)).toContain('Churn')
  })

  it('ranks by connectivity (in-degree), then alphabetically', () => {
    const nodes = [
      { id: 'f1', data: { kind: 'factor', label: 'Zzz' } },
      { id: 'f2', data: { kind: 'factor', label: 'Aaa' } },
    ] as any[]
    const edges = [
      { id: 'e1', source: 'x', target: 'f2' },
      { id: 'e2', source: 'y', target: 'f2' },
      { id: 'e3', source: 'x', target: 'f1' },
    ] as any[]

    const gaps = deriveEvidenceGaps(nodes, edges)
    // f2 has in-degree 2, f1 has in-degree 1 → f2 first
    expect(gaps[0].factorLabel).toBe('Aaa')
    expect(gaps[1].factorLabel).toBe('Zzz')
  })

  it('returns empty array when all factors have data', () => {
    const nodes = [
      { id: 'f1', data: { kind: 'factor', label: 'A', observedState: { value: 5 } } },
    ] as any[]
    expect(deriveEvidenceGaps(nodes, [])).toEqual([])
  })
})

describe('WorthInvestigating component', () => {
  it('hides entirely if zero gaps', () => {
    const { container } = render(<WorthInvestigating gaps={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders max 3 visible gaps', () => {
    const gaps = [
      { factorId: '1', factorLabel: 'A', description: 'Desc', connectivityScore: 3 },
      { factorId: '2', factorLabel: 'B', description: 'Desc', connectivityScore: 2 },
      { factorId: '3', factorLabel: 'C', description: 'Desc', connectivityScore: 1 },
      { factorId: '4', factorLabel: 'D', description: 'Desc', connectivityScore: 0 },
    ]

    render(<WorthInvestigating gaps={gaps} />)

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.queryByText('D')).not.toBeInTheDocument()
    expect(screen.getByText('and 1 more')).toBeInTheDocument()
  })

  it('expands to show all gaps', () => {
    const gaps = [
      { factorId: '1', factorLabel: 'A', description: 'Desc', connectivityScore: 2 },
      { factorId: '2', factorLabel: 'B', description: 'Desc', connectivityScore: 1 },
      { factorId: '3', factorLabel: 'C', description: 'Desc', connectivityScore: 1 },
      { factorId: '4', factorLabel: 'D', description: 'Desc', connectivityScore: 0 },
    ]

    render(<WorthInvestigating gaps={gaps} />)

    fireEvent.click(screen.getByText('and 1 more'))
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('fires onSetValue callback with factorId', () => {
    const onSetValue = vi.fn()
    const gaps = [
      { factorId: 'f42', factorLabel: 'Revenue', description: 'Desc', connectivityScore: 1 },
    ]

    render(<WorthInvestigating gaps={gaps} onSetValue={onSetValue} />)

    fireEvent.click(screen.getByText('Set value'))
    expect(onSetValue).toHaveBeenCalledWith('f42')
  })

  it('has accessible section label', () => {
    const gaps = [{ factorId: '1', factorLabel: 'A', description: 'D', connectivityScore: 0 }]
    render(<WorthInvestigating gaps={gaps} />)
    expect(screen.getByLabelText('Worth investigating')).toBeInTheDocument()
  })
})
