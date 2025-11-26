/**
 * S6-COMPARE: WhatChangedChip Tests
 *
 * Tests the "What changed" chip that shows graph differences from previous run
 * Requirements: ≥8 test assertions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WhatChangedChip } from '../WhatChangedChip'
import { useCanvasStore } from '../../store'
import * as runHistoryModule from '../../store/runHistory'
import type { Node, Edge } from '@xyflow/react'
import type { StoredRun } from '../../store/runHistory'

// Mock loadRuns from runHistory
vi.mock('../../store/runHistory', () => ({
  loadRuns: vi.fn()
}))

describe('S6-COMPARE: WhatChangedChip', () => {
  const mockLoadRuns = vi.mocked(runHistoryModule.loadRuns)

  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      edges: []
    })

    // Reset mock
    mockLoadRuns.mockReturnValue([])
  })

  describe('Visibility Conditions', () => {
    it('should not render when there are fewer than 2 runs', () => {
      // Only 1 run in history
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now(),
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        }
      ])

      const { container } = render(<WhatChangedChip />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when there are no changes between runs', () => {
      const sameGraph = {
        nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }] as Node[],
        edges: [{ id: 'e1', source: '1', target: '2' }] as Edge[]
      }

      // Two runs with identical graphs
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: sameGraph
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: sameGraph
        }
      ])

      // Set current graph to match history
      useCanvasStore.setState({
        nodes: sameGraph.nodes,
        edges: sameGraph.edges
      })

      const { container } = render(<WhatChangedChip />)
      expect(container.firstChild).toBeNull()
    })

    it('should render when there are changes between current and previous run', () => {
      // Previous run had 1 node
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        }
      ])

      // Current graph has 2 nodes (matches run-2)
      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByTestId('what-changed-chip')).toBeInTheDocument()
    })
  })

  describe('Node Changes Display', () => {
    it('should show added nodes', () => {
      // Previous run: 1 node
      // Current run: 2 nodes (1 added)
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Nodes: \+1/)).toBeInTheDocument()
    })

    it('should show removed nodes', () => {
      // Previous run: 2 nodes
      // Current run: 1 node (1 removed)
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Nodes: -1/)).toBeInTheDocument()
    })

    it('should show modified nodes', () => {
      // Previous run: 1 node with label "Old Label"
      // Current run: Same node with label "New Label" (modified)
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Old Label' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'New Label' } }],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'New Label' } }],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Nodes: ~1/)).toBeInTheDocument()
    })

    it('should show combined node changes', () => {
      // Previous run: nodes 1, 2, 3
      // Current run: nodes 1 (modified), 3, 4 (node 2 removed, node 4 added, node 1 modified)
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1 Old' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
              { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } }
            ],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1 New' } },
              { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } },
              { id: '4', type: 'decision', position: { x: 300, y: 0 }, data: { label: 'Node 4' } }
            ],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1 New' } },
          { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } },
          { id: '4', type: 'decision', position: { x: 300, y: 0 }, data: { label: 'Node 4' } }
        ],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Nodes: \+1, -1, ~1/)).toBeInTheDocument()
    })
  })

  describe('Edge Changes Display', () => {
    it('should show added edges', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2' }]
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: [{ id: 'e1-2', source: '1', target: '2' }]
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Edges: \+1/)).toBeInTheDocument()
    })

    it('should show modified edges', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.5 } }]
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.8 } }]
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.8 } }]
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Edges: ~1/)).toBeInTheDocument()
    })

    it('should show combined node and edge changes', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
              { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } }
            ],
            edges: [
              { id: 'e1-2', source: '1', target: '2' },
              { id: 'e2-3', source: '2', target: '3' }
            ]
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } },
          { id: '3', type: 'decision', position: { x: 200, y: 0 }, data: { label: 'Node 3' } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' },
          { id: 'e2-3', source: '2', target: '3' }
        ]
      })

      render(<WhatChangedChip />)
      const chip = screen.getByTestId('what-changed-chip')
      expect(chip).toHaveTextContent(/Nodes: \+1/)
      expect(chip).toHaveTextContent(/Edges: \+2/)
    })
  })

  describe('Accessibility and UI', () => {
    it('should have correct ARIA label', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      render(<WhatChangedChip />)
      const chip = screen.getByTestId('what-changed-chip')
      expect(chip).toHaveAttribute('role', 'status')
      expect(chip).toHaveAttribute('aria-label', 'Graph changed: Nodes: +1')
    })

    it('should have correct test ID', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByTestId('what-changed-chip')).toBeInTheDocument()
    })

    it('should display change icon', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: []
      })

      const { container } = render(<WhatChangedChip />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('w-3.5', 'h-3.5')
    })
  })

  describe('Edge Cases', () => {
    it('should handle position changes as modifications', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } }],
            edges: []
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [{ id: '1', type: 'goal', position: { x: 100, y: 50 }, data: { label: 'Node 1' } }],
            edges: []
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [{ id: '1', type: 'goal', position: { x: 100, y: 50 }, data: { label: 'Node 1' } }],
        edges: []
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Nodes: ~1/)).toBeInTheDocument()
    })

    it('should handle belief changes in edges as modifications', () => {
      mockLoadRuns.mockReturnValue([
        {
          id: 'run-1',
          timestamp: Date.now() - 1000,
          hash: 'hash-1',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.5, belief: 0.5 } }]
          }
        },
        {
          id: 'run-2',
          timestamp: Date.now(),
          hash: 'hash-2',
          seed: 1234,
          graph: {
            nodes: [
              { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
              { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
            ],
            edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.5, belief: 0.8 } }]
          }
        }
      ])

      useCanvasStore.setState({
        nodes: [
          { id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
          { id: '2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Node 2' } }
        ],
        edges: [{ id: 'e1-2', source: '1', target: '2', data: { weight: 0.5, belief: 0.8 } }]
      })

      render(<WhatChangedChip />)
      expect(screen.getByText(/Edges: ~1/)).toBeInTheDocument()
    })
  })
})
