/**
 * N1: Edge Diff Tests
 * Tests for EdgeDiffTable component
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgeDiffTable, computeEdgeDiffs } from '../EdgeDiffTable'
import type { StoredRun } from '../../store/runHistory'

describe('EdgeDiffTable', () => {
  const mockRunA: Partial<StoredRun> = {
    id: 'run-a',
    seed: 1337,
    graphHash: 'hash-a',
    adapter: 'auto',
    summary: '',
    ts: Date.now(),
    report: {} as any,
    graph: {
      nodes: [],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5, belief: 0.6 } },
        { id: 'e2', source: 'n2', target: 'n3', data: { weight: 0.8, belief: 0.7, provenance: 'Source A' } }
      ] as any
    }
  }

  const mockRunB: Partial<StoredRun> = {
    id: 'run-b',
    seed: 1338,
    graphHash: 'hash-b',
    adapter: 'auto',
    summary: '',
    ts: Date.now(),
    report: {} as any,
    graph: {
      nodes: [],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.7, belief: 0.8 } },
        { id: 'e3', source: 'n3', target: 'n4', data: { weight: 0.9, belief: 0.9, provenance: 'Source B' } }
      ] as any
    }
  }

  it('renders matched edges with signed deltas', () => {
    render(<EdgeDiffTable runA={mockRunA as StoredRun} runB={mockRunB as StoredRun} />)

    // Should show matched edge with delta
    expect(screen.getByText('n1 → n2')).toBeInTheDocument()
    expect(screen.getByText('+0.200')).toBeInTheDocument() // weight delta: 0.7 - 0.5
  })

  it('marks added edges correctly', () => {
    render(<EdgeDiffTable runA={mockRunA as StoredRun} runB={mockRunB as StoredRun} />)

    // Edge e3 exists in B but not A
    expect(screen.getByText('n3 → n4')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('marks removed edges correctly', () => {
    render(<EdgeDiffTable runA={mockRunA as StoredRun} runB={mockRunB as StoredRun} />)

    // Edge e2 exists in A but not B
    expect(screen.getByText('n2 → n3')).toBeInTheDocument()
    expect(screen.getByText('−')).toBeInTheDocument()
  })

  it('shows belief context (w/b format)', () => {
    render(<EdgeDiffTable runA={mockRunA as StoredRun} runB={mockRunB as StoredRun} />)

    // Should display weight/belief for both runs
    expect(screen.getByText('0.50')).toBeInTheDocument() // weight A
    expect(screen.getByText('0.60')).toBeInTheDocument() // belief A
  })

  it('displays provenance badges when present', () => {
    render(<EdgeDiffTable runA={mockRunA as StoredRun} runB={mockRunB as StoredRun} />)

    expect(screen.getByText(/Source A/)).toBeInTheDocument()
    expect(screen.getByText(/Source B/)).toBeInTheDocument()
  })

  it('sorts by absolute delta descending', () => {
    const diffs = computeEdgeDiffs(mockRunA as StoredRun, mockRunB as StoredRun, 5)

    // Largest delta should be first
    expect(diffs[0].deltaWeight).toBeGreaterThanOrEqual(Math.abs(diffs[1]?.deltaWeight ?? 0))
  })

  it('limits results to top N', () => {
    const diffs = computeEdgeDiffs(mockRunA as StoredRun, mockRunB as StoredRun, 2)
    expect(diffs.length).toBeLessThanOrEqual(2)
  })

  it('handles empty graphs gracefully', () => {
    const emptyRunA = { ...mockRunA, graph: { nodes: [], edges: [] } }
    const emptyRunB = { ...mockRunB, graph: { nodes: [], edges: [] } }

    render(<EdgeDiffTable runA={emptyRunA as StoredRun} runB={emptyRunB as StoredRun} />)
    expect(screen.getByText('No edge differences found')).toBeInTheDocument()
  })
})
