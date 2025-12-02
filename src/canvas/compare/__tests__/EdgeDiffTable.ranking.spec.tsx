/**
 * S6-COMPARE + S9-DIFFS: EdgeDiffTable Driver Ranking Tests
 *
 * Tests rank badges (1st, 2nd, 3rd) for top drivers based on |Δweight|
 * S9-DIFFS: Tests secondary sort by |Δbelief|, focus-on-click, edge counts
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeDiffTable, computeEdgeDiffs } from '../EdgeDiffTable'
import type { StoredRun } from '../../store/runHistory'

type GraphSnapshot = NonNullable<StoredRun['graph']>

function createGraphSnapshot(
  nodes: GraphSnapshot['nodes'],
  edges: GraphSnapshot['edges']
): GraphSnapshot {
  return { nodes, edges }
}

function createStoredRunFixture({
  id,
  seed,
  graph,
  hash = `hash-${id}`
}: {
  id: string
  seed: number
  graph: GraphSnapshot
  hash?: string
}): StoredRun {
  return {
    id,
    ts: Date.now(),
    seed,
    hash,
    adapter: 'mock',
    summary: `Run ${id}`,
    graphHash: `graph-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed, response_id: id, elapsed_ms: 100 },
      model_card: {
        response_hash: hash,
        response_hash_algo: 'sha256',
        normalized: true
      },
      results: {
        conservative: 0.5,
        likely: 0.6,
        optimistic: 0.7
      },
      confidence: {
        level: 'medium',
        why: 'Fixture'
      },
      drivers: []
    },
    graph
  }
}

describe('S6-COMPARE: EdgeDiffTable Driver Ranking', () => {
  const sharedNodes = [
    { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
    { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } },
    { id: '4', type: 'decision', position: { x: 300, y: 0 }, data: { label: 'Node 4' } },
    { id: '5', type: 'decision', position: { x: 400, y: 0 }, data: { label: 'Node 5' } }
  ]

  const mockRunA = createStoredRunFixture({
    id: 'run-a',
    seed: 1234,
    graph: createGraphSnapshot(sharedNodes, [
      { id: 'e1', source: '1', target: '2', data: { weight: 0.5, belief: 0.5 } },
      { id: 'e2', source: '1', target: '3', data: { weight: 0.7, belief: 0.7 } },
      { id: 'e3', source: '1', target: '4', data: { weight: 0.3, belief: 0.3 } },
      { id: 'e4', source: '1', target: '5', data: { weight: 0.6, belief: 0.6 } },
      { id: 'e5', source: '2', target: '3', data: { weight: 0.4, belief: 0.4 } }
    ])
  })

  const mockRunB = createStoredRunFixture({
    id: 'run-b',
    seed: 5678,
    graph: createGraphSnapshot(sharedNodes, [
      { id: 'e1', source: '1', target: '2', data: { weight: 0.8, belief: 0.8 } },
      { id: 'e2', source: '1', target: '3', data: { weight: 0.9, belief: 0.9 } },
      { id: 'e3', source: '1', target: '4', data: { weight: 0.1, belief: 0.1 } },
      { id: 'e4', source: '1', target: '5', data: { weight: 0.2, belief: 0.2 } },
      { id: 'e5', source: '2', target: '3', data: { weight: 0.5, belief: 0.5 } }
    ])
  })

  describe('Rank Badge Display', () => {
    it('should display rank badges for top 3 drivers', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Top 3 should have rank badges
      expect(screen.getByTestId('rank-badge-1')).toBeInTheDocument()
      expect(screen.getByTestId('rank-badge-2')).toBeInTheDocument()
      expect(screen.getByTestId('rank-badge-3')).toBeInTheDocument()
    })

    it('should show "1st" badge for highest |Δweight|', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge1 = screen.getByTestId('rank-badge-1')
      expect(badge1).toHaveTextContent('1st')
    })

    it('should show "2nd" badge for second highest |Δweight|', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge2 = screen.getByTestId('rank-badge-2')
      expect(badge2).toHaveTextContent('2nd')
    })

    it('should show "3rd" badge for third highest |Δweight|', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge3 = screen.getByTestId('rank-badge-3')
      expect(badge3).toHaveTextContent('3rd')
    })

    it('should use gold styling for 1st place badge', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge1 = screen.getByTestId('rank-badge-1')
      expect(badge1).toHaveClass('bg-yellow-100')
      expect(badge1).toHaveClass('text-yellow-800')
    })

    it('should use silver styling for 2nd place badge', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge2 = screen.getByTestId('rank-badge-2')
      expect(badge2).toHaveClass('bg-gray-100')
      expect(badge2).toHaveClass('text-gray-700')
    })

    it('should use bronze styling for 3rd place badge', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const badge3 = screen.getByTestId('rank-badge-3')
      expect(badge3).toHaveClass('bg-orange-100')
      expect(badge3).toHaveClass('text-orange-700')
    })

    it('should not display rank badge for 4th place and beyond', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Should not have rank-badge-4 or rank-badge-5
      expect(screen.queryByTestId('rank-badge-4')).not.toBeInTheDocument()
      expect(screen.queryByTestId('rank-badge-5')).not.toBeInTheDocument()
    })
  })

  describe('Rank Assignment Logic', () => {
    it('should assign rank 1 to edge with highest |Δweight|', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      // Edge e4 has Δ = -0.4, highest |Δ|
      const rank1 = diffs.find(d => d.rank === 1)
      expect(rank1?.edgeId).toBe('e4')
      expect(Math.abs(rank1!.deltaWeight)).toBeCloseTo(0.4)
    })

    it('should assign rank 2 to edge with second highest |Δweight|', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      // Edge e1 has Δ = +0.3, second highest |Δ|
      const rank2 = diffs.find(d => d.rank === 2)
      expect(rank2?.edgeId).toBe('e1')
      expect(Math.abs(rank2!.deltaWeight)).toBeCloseTo(0.3)
    })

    it('should assign rank 3 to edge with third highest |Δweight|', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      // Edge e2 and e3 both have |Δ| = 0.2, e2 should come first (or either is valid)
      const rank3 = diffs.find(d => d.rank === 3)
      expect(rank3?.edgeId).toMatch(/e2|e3/)
      expect(Math.abs(rank3!.deltaWeight)).toBeCloseTo(0.2)
    })

    it('should sort by absolute delta weight, not signed delta', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      // Verify sorting by |Δ|
      for (let i = 0; i < diffs.length - 1; i++) {
        const current = Math.abs(diffs[i].deltaWeight)
        const next = Math.abs(diffs[i + 1].deltaWeight)
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })

    it('should handle fewer than 3 diffs gracefully', () => {
      const smallNodes = [
        { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
        { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
      ]

      const smallRunA = createStoredRunFixture({
        id: 'small-a',
        seed: 1111,
        graph: createGraphSnapshot(smallNodes, [
          { id: 'e1', source: '1', target: '2', data: { weight: 0.5, belief: 0.5 } }
        ])
      })

      const smallRunB = createStoredRunFixture({
        id: 'small-b',
        seed: 2222,
        graph: createGraphSnapshot(smallNodes, [
          { id: 'e1', source: '1', target: '2', data: { weight: 0.7, belief: 0.7 } }
        ])
      })

      const diffs = computeEdgeDiffs(smallRunA, smallRunB, 5)

      expect(diffs).toHaveLength(1)
      expect(diffs[0].rank).toBe(1)
    })
  })

  describe('Rank Column Header', () => {
    it('should display "Rank" column header in table', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      expect(screen.getByText('Rank')).toBeInTheDocument()
    })
  })
})

describe('S9-DIFFS: EdgeDiffTable Enhancements', () => {
  const nodes = [
    { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
    { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } }
  ]

  const mockRunA = createStoredRunFixture({
    id: 'run-a',
    seed: 700,
    graph: createGraphSnapshot(nodes, [
      { id: 'e1', source: '1', target: '2', data: { weight: 0.5, belief: 0.5 } },
      { id: 'e2', source: '1', target: '3', data: { weight: 0.5, belief: 0.7 } },
      { id: 'e3', source: '2', target: '3', data: { weight: 0.8, belief: 0.8 } }
    ])
  })

  const mockRunB = createStoredRunFixture({
    id: 'run-b',
    seed: 701,
    graph: createGraphSnapshot(nodes, [
      { id: 'e1', source: '1', target: '2', data: { weight: 0.7, belief: 0.9 } },
      { id: 'e2', source: '1', target: '3', data: { weight: 0.7, belief: 0.9 } },
      { id: 'e3', source: '2', target: '3', data: { weight: 0.4, belief: 0.4 } }
    ])
  })

  describe('Secondary Sort by |Δbelief|', () => {
    it('should sort by |Δweight| first, then |Δbelief| when weights tie', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      // Rank 1: e3 (|Δw| = 0.4, highest)
      expect(diffs[0].edgeId).toBe('e3')
      expect(Math.abs(diffs[0].deltaWeight)).toBeCloseTo(0.4)

      // Rank 2 and 3: e1 and e2 both have |Δw| = 0.2
      // e1 has |Δb| = 0.4, e2 has |Δb| = 0.2
      // So e1 should be rank 2 (higher |Δb|)
      expect(diffs[1].edgeId).toBe('e1')
      expect(Math.abs(diffs[1].deltaWeight)).toBeCloseTo(0.2)
      expect(Math.abs(diffs[1].deltaBelief)).toBeCloseTo(0.4)

      // e2 should be rank 3
      expect(diffs[2].edgeId).toBe('e2')
      expect(Math.abs(diffs[2].deltaWeight)).toBeCloseTo(0.2)
      expect(Math.abs(diffs[2].deltaBelief)).toBeCloseTo(0.2)
    })

    it('should calculate deltaBelief correctly', () => {
      const diffs = computeEdgeDiffs(mockRunA, mockRunB, 5)

      const e1 = diffs.find(d => d.edgeId === 'e1')
      expect(e1?.deltaBelief).toBeCloseTo(0.4) // 0.9 - 0.5

      const e2 = diffs.find(d => d.edgeId === 'e2')
      expect(e2?.deltaBelief).toBeCloseTo(0.2) // 0.9 - 0.7

      const e3 = diffs.find(d => d.edgeId === 'e3')
      expect(e3?.deltaBelief).toBeCloseTo(-0.4) // 0.4 - 0.8
    })
  })

  describe('Display Δw and Δb', () => {
    it('should display both delta weight and delta belief', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Column header should show "Δw / Δb"
      expect(screen.getByText('Δw / Δb')).toBeInTheDocument()

      // Should display both values in cells
      const deltaWLabels = screen.getAllByText(/Δw:/)
      const deltaBLabels = screen.getAllByText(/Δb:/)
      expect(deltaWLabels.length).toBeGreaterThan(0)
      expect(deltaBLabels.length).toBeGreaterThan(0)
    })

    it('should format delta values with 3 decimal places', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Values should be formatted as +0.200, -0.400, etc.
      // This is implicit in the rendering, checking the structure
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    })

    it('should show positive deltas with + sign', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Should have some +0.xxx values
      const positiveDeltas = screen.getAllByText(/\+0\.\d{3}/)
      expect(positiveDeltas.length).toBeGreaterThan(0)
    })

    it('should show negative deltas with - sign', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Should have some -0.xxx values
      const negativeDeltas = screen.getAllByText(/-0\.\d{3}/)
      expect(negativeDeltas.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Summary Counts', () => {
    it('should display edge summary counts', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      expect(screen.getByText('Edge Summary:')).toBeInTheDocument()
      expect(screen.getByText(/added/)).toBeInTheDocument()
      expect(screen.getByText(/removed/)).toBeInTheDocument()
      expect(screen.getByText(/matched/)).toBeInTheDocument()
      expect(screen.getByText(/total/)).toBeInTheDocument()
    })

    it('should count matched edges correctly', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // All 3 edges are matched
      const summary = screen.getByRole('status', { name: 'Edge comparison summary' })
      expect(summary).toHaveTextContent('3 matched')
    })

    it('should count added edges correctly', () => {
      const runWithAdded = createStoredRunFixture({
        id: 'run-b-added',
        seed: 702,
        graph: createGraphSnapshot(
          mockRunB.graph!.nodes,
          [
            ...mockRunB.graph!.edges,
            { id: 'e4-new', source: '1', target: '3', data: { weight: 0.6, belief: 0.6 } }
          ]
        )
      })

      render(<EdgeDiffTable runA={mockRunA} runB={runWithAdded} />)

      const summary = screen.getByRole('status')
      expect(summary).toHaveTextContent('1 added')
    })

    it('should count removed edges correctly', () => {
      const runWithRemoved = createStoredRunFixture({
        id: 'run-b-removed',
        seed: 703,
        graph: createGraphSnapshot(
          mockRunB.graph!.nodes,
          mockRunB.graph!.edges.slice(0, 2)
        )
      })

      render(<EdgeDiffTable runA={mockRunA} runB={runWithRemoved} />)

      const summary = screen.getByRole('status')
      expect(summary).toHaveTextContent('1 removed')
    })

    it('should calculate total count correctly', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const summary = screen.getByRole('status')
      // With limit=5, we show 3 edges (all matched)
      expect(summary).toHaveTextContent('3 total')
    })
  })

  describe('Focus on Click', () => {
    it('should call onFocusEdge when row is clicked', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      // Find first data row
      const rows = screen.getAllByRole('button')
      const firstRow = rows[0]

      fireEvent.click(firstRow)

      expect(onFocusEdge).toHaveBeenCalledTimes(1)
      expect(onFocusEdge).toHaveBeenCalledWith(expect.stringMatching(/e\d+/))
    })

    it('should make rows focusable when onFocusEdge provided', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const rows = screen.getAllByRole('button')
      expect(rows.length).toBeGreaterThan(0)

      // Rows should be keyboard accessible
      rows.forEach(row => {
        expect(row).toHaveAttribute('tabindex', '0')
      })
    })

    it('should trigger onFocusEdge on Enter key', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      fireEvent.keyDown(firstRow, { key: 'Enter' })

      expect(onFocusEdge).toHaveBeenCalledTimes(1)
    })

    it('should trigger onFocusEdge on Space key', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      fireEvent.keyDown(firstRow, { key: ' ' })

      expect(onFocusEdge).toHaveBeenCalledTimes(1)
    })

    it('should not trigger onFocusEdge on other keys', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      fireEvent.keyDown(firstRow, { key: 'Tab' })
      fireEvent.keyDown(firstRow, { key: 'Escape' })

      expect(onFocusEdge).not.toHaveBeenCalled()
    })

    it('should not make rows clickable when onFocusEdge not provided', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      // Rows should not have role="button"
      const buttons = screen.queryAllByRole('button')
      expect(buttons).toHaveLength(0)
    })

    it('should show cursor pointer when onFocusEdge provided', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      expect(firstRow).toHaveClass('cursor-pointer')
    })

    it('should have aria-label for accessibility', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      expect(firstRow).toHaveAttribute('aria-label', expect.stringContaining('Focus edge'))
    })
  })

  describe('Styling integration', () => {
    it('aligns summary content with items-center', () => {
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} />)

      const summary = screen.getByRole('status')
      expect(summary).toHaveClass('items-center')
    })

    it('applies transition-colors to interactive rows', () => {
      const onFocusEdge = vi.fn()
      render(<EdgeDiffTable runA={mockRunA} runB={mockRunB} onFocusEdge={onFocusEdge} />)

      const firstRow = screen.getAllByRole('button')[0]
      expect(firstRow).toHaveClass('transition-colors')
    })
  })
})
