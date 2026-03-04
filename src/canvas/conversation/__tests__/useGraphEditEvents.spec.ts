/**
 * Tests for useGraphEditEvents — debounced canvas edit system events
 *
 * Verifies:
 * - Single edit fires after 1.5s debounce
 * - Rapid edits within 1.5s batch into one event
 * - Position-only changes do not fire
 * - Debounce timer clears on unmount
 * - Debounce timer clears on scenario switch
 * - System event includes correct changed_node_ids and operations
 * - No event fires when flag is OFF
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGraphEditEvents } from '../useGraphEditEvents'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let flagValue = true
vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => flagValue,
}))

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockSendSystemEvent = vi.fn().mockResolvedValue(undefined)

function setStoreState(overrides: Record<string, unknown>) {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...overrides,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockSendSystemEvent.mockClear()
  flagValue = true
  setStoreState({})
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGraphEditEvents', () => {
  it('fires system event after 1.5s debounce for a single edit', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Add a node
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Test' } }] as any,
      })
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.type).toBe('direct_graph_edit')
    expect(event.payload.changed_node_ids).toContain('n1')
    expect(event.payload.operations).toContain('add')

    unmount()
  })

  it('batches rapid edits into one event', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // First edit: add node
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      })
    })

    // Second edit (within 1.5s): add another node
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B' } },
        ] as any,
      })
    })

    // Should not have fired yet
    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    // Advance past debounce from last edit
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    // Only one batched event
    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.payload.changed_node_ids).toContain('n1')
    expect(event.payload.changed_node_ids).toContain('n2')

    unmount()
  })

  it('does not fire for position-only changes', () => {
    setStoreState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Change position only (not structural data)
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 100, y: 200 }, data: { label: 'A' } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    unmount()
  })

  it('clears debounce timer on unmount', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Trigger a change
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      })
    })

    // Unmount before debounce fires
    unmount()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()
  })

  it('clears debounce timer and resets on scenario switch', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Add a node
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      })
    })

    // Switch scenario before debounce
    act(() => {
      vi.advanceTimersByTime(500)
      useCanvasStore.setState({
        currentScenarioId: 'scenario-2',
        nodes: [],
        edges: [],
      })
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // The original edit's event should not have fired
    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    unmount()
  })

  it('includes correct operations in system event', () => {
    setStoreState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 1 } }],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Remove the edge, update the node
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Updated' } }] as any,
        edges: [] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.payload.changed_node_ids).toContain('n1') // updated
    expect(event.payload.changed_edge_ids).toContain('e1') // removed
    expect(event.payload.operations).toContain('update')
    expect(event.payload.operations).toContain('remove')

    unmount()
  })

  it('does not fire when flag is OFF', () => {
    flagValue = false

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    unmount()
  })

  it('does not accumulate during external mutation (_externalMutationActive > 0)', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Simulate external mutation (e.g. patch-apply or hydration)
    act(() => {
      useCanvasStore.setState({ _externalMutationActive: 1 } as any)
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Patched' } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockSendSystemEvent).not.toHaveBeenCalled()

    // End suppression — subsequent direct edits should fire normally
    act(() => {
      useCanvasStore.setState({ _externalMutationActive: 0 } as any)
    })

    act(() => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'UserEdit' } },
        ] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    expect(mockSendSystemEvent.mock.calls[0][0].type).toBe('direct_graph_edit')

    unmount()
  })

  it('sorts changed_node_ids and changed_edge_ids alphabetically in payload', () => {
    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Add nodes with IDs that would sort differently if insertion order were used
    act(() => {
      useCanvasStore.setState({
        nodes: [
          { id: 'node-z', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Z' } },
          { id: 'node-a', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'node-m', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'M' } },
        ] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const payload = mockSendSystemEvent.mock.calls[0][0].payload
    expect(payload.changed_node_ids).toEqual(['node-a', 'node-m', 'node-z'])

    unmount()
  })
})
