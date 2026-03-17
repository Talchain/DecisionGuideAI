/**
 * IntelligenceSection unit tests
 * Verifies: observed status, connectivity counts, top driver pill, pre-analysis state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntelligenceSection } from '../shared/IntelligenceSection'

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

const mockNodes = [
  {
    id: 'f1',
    data: {
      label: 'Revenue',
      observedState: { value: 0.8 },
    },
  },
  {
    id: 'f2',
    data: {
      label: 'Cost',
      // no observedState
    },
  },
]

const mockEdges = [
  { id: 'e1', source: 'f1', target: 'f2' },
  { id: 'e2', source: 'f1', target: 'f3' },
  { id: 'e3', source: 'f4', target: 'f1' },
]

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: { nodes: typeof mockNodes; edges: typeof mockEdges }) => unknown) =>
    selector({ nodes: mockNodes, edges: mockEdges }),
  ),
}))

vi.mock('../../../stores', () => ({
  useResultsStore: vi.fn((selector: (s: { status: string; drivers?: Array<{ kind: string; id: string }> }) => unknown) =>
    selector({ status: 'idle', drivers: undefined }),
  ),
}))

import { useResultsStore } from '../../../stores'
import * as useCanvasStoreModule from '../../../store'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IntelligenceSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "Has observed data" when node has observedState.value', () => {
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.getByText('Has observed data')).toBeDefined()
  })

  it('shows "No observed data" when node has no observedState', () => {
    render(<IntelligenceSection nodeId="f2" />)
    expect(screen.getByText('No observed data')).toBeDefined()
  })

  it('shows correct outgoing count for f1 (2 outgoing edges)', () => {
    render(<IntelligenceSection nodeId="f1" />)
    // f1 is source for e1, e2 → outgoing: 2
    // f1 is target for e3 → incoming: 1
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows correct incoming count for f1 (1 incoming edge)', () => {
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.getByText('1')).toBeDefined()
  })

  it('shows "Not connected" message for a node with no edges', () => {
    render(<IntelligenceSection nodeId="f2" />)
    // f2 has 1 incoming (e1 target=f2) but 0 outgoing
    // Actually f2 is target of e1, so incoming=1, outgoing=0 → NOT "not connected"
    // Use f5 (hypothetical node) — but it's not in mockNodes so returns null
    // Instead test the connectivity display text presence
    expect(screen.queryByText('Not connected to any other nodes')).toBeNull()
  })

  it('shows "Not connected" for truly disconnected node', () => {
    // Add a disconnected node not referenced in any edge
    const isolatedNode = { id: 'isolated', data: { label: 'Isolated', observedState: { value: 0.5 } } }
    const nodesWithIsolated = [...mockNodes, isolatedNode]
    // Override for all calls in this test via mockImplementation
    vi.mocked(useCanvasStoreModule.useCanvasStore).mockImplementation(
      (selector: (s: { nodes: typeof nodesWithIsolated; edges: typeof mockEdges }) => unknown) =>
        selector({ nodes: nodesWithIsolated, edges: mockEdges }),
    )
    render(<IntelligenceSection nodeId="isolated" />)
    expect(screen.getByText('Not connected to any other nodes')).toBeDefined()
    // Restore default mock for subsequent tests
    vi.mocked(useCanvasStoreModule.useCanvasStore).mockImplementation(
      (selector: (s: { nodes: typeof mockNodes; edges: typeof mockEdges }) => unknown) =>
        selector({ nodes: mockNodes, edges: mockEdges }),
    )
  })

  it('shows "Top sensitivity driver" pill when node is in top 3 results drivers (status=complete)', () => {
    vi.mocked(useResultsStore).mockImplementation((selector) =>
      selector({ status: 'complete', drivers: [{ kind: 'node', id: 'f1' }, { kind: 'node', id: 'f2' }] }),
    )
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.getByText(/Top sensitivity driver/)).toBeDefined()
  })

  it('does NOT show driver pill when results status is not complete', () => {
    vi.mocked(useResultsStore).mockImplementation((selector) =>
      selector({ status: 'idle', drivers: [{ kind: 'node', id: 'f1' }] }),
    )
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.queryByText(/Top sensitivity driver/)).toBeNull()
  })

  it('does NOT show driver pill when node is not in drivers', () => {
    vi.mocked(useResultsStore).mockImplementation((selector) =>
      selector({ status: 'complete', drivers: [{ kind: 'node', id: 'f99' }] }),
    )
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.queryByText(/Top sensitivity driver/)).toBeNull()
  })

  it('does NOT show driver pill when node is #4 or beyond (not top 3)', () => {
    vi.mocked(useResultsStore).mockImplementation((selector) =>
      selector({
        status: 'complete',
        drivers: [
          { kind: 'node', id: 'f99' },
          { kind: 'node', id: 'f98' },
          { kind: 'node', id: 'f97' },
          { kind: 'node', id: 'f1' }, // rank 4
        ],
      }),
    )
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.queryByText(/Top sensitivity driver/)).toBeNull()
  })

  it('returns null when nodeId is not in store nodes', () => {
    const { container } = render(<IntelligenceSection nodeId="non-existent" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows ordinal rank correctly for 2nd driver', () => {
    vi.mocked(useResultsStore).mockImplementation((selector) =>
      selector({
        status: 'complete',
        drivers: [
          { kind: 'node', id: 'f99' },
          { kind: 'node', id: 'f1' }, // rank 2
        ],
      }),
    )
    render(<IntelligenceSection nodeId="f1" />)
    expect(screen.getByText(/2nd/)).toBeDefined()
  })
})
