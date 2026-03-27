/**
 * useGraphEditEvents — fields_changed enhancement tests
 *
 * Verifies:
 * - Editing a single field produces fields_changed with element ID as key
 * - Editing multiple fields on same element during one debounce window aggregates them
 * - Editing different elements produces separate keys in fields_changed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGraphEditEvents } from '../useGraphEditEvents'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../flags', () => ({
  isOrchestratorV2Enabled: () => true,
  isJourneyTabEnabled: () => false,
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
  setStoreState({})
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGraphEditEvents — fields_changed', () => {
  it('editing a single field produces fields_changed with element ID and field name', () => {
    // Start with a node that has initial data
    setStoreState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget', weight: 0.5 } }],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Edit the label field only
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing Budget', weight: 0.5 } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.payload.fields_changed).toBeDefined()
    expect(event.payload.fields_changed['n1']).toContain('label')
    // weight didn't change, so it should NOT be in the list
    expect(event.payload.fields_changed['n1']).not.toContain('weight')

    unmount()
  })

  it('editing multiple fields on the same element aggregates them', () => {
    setStoreState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget', observedState: { value: 0.5 } } }],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // First edit: change label
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'New Label', observedState: { value: 0.5 } } }] as any,
      })
    })

    // Second edit within debounce: change observedState
    act(() => {
      vi.advanceTimersByTime(500)
    })
    act(() => {
      useCanvasStore.setState({
        nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'New Label', observedState: { value: 0.8 } } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    const fields = event.payload.fields_changed['n1']
    expect(fields).toContain('label')
    expect(fields).toContain('observedState')

    unmount()
  })

  it('editing different elements produces separate keys', () => {
    setStoreState({
      nodes: [
        { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B' } },
      ],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Edit both nodes within debounce window
    act(() => {
      useCanvasStore.setState({
        nodes: [
          { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A-updated' } },
          { id: 'n2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B-updated' } },
        ] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.payload.fields_changed['n1']).toContain('label')
    expect(event.payload.fields_changed['n2']).toContain('label')
    // Keys should be separate
    expect(Object.keys(event.payload.fields_changed)).toHaveLength(2)

    unmount()
  })

  it('edge field changes also tracked in fields_changed', () => {
    setStoreState({
      nodes: [
        { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'n2', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'B' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5, direction: 'positive' } }],
    })

    const { unmount } = renderHook(() => useGraphEditEvents(mockSendSystemEvent))

    // Change edge weight
    act(() => {
      useCanvasStore.setState({
        edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.8, direction: 'positive' } }] as any,
      })
    })

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(mockSendSystemEvent).toHaveBeenCalledTimes(1)
    const event = mockSendSystemEvent.mock.calls[0][0]
    expect(event.payload.fields_changed['e1']).toContain('weight')
    expect(event.payload.fields_changed['e1']).not.toContain('direction')

    unmount()
  })
})
