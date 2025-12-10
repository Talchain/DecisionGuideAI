import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncedViewports } from '../useSyncedViewports'
import type { ReactFlowInstance, Viewport } from '@xyflow/react'

// Mock ReactFlowInstance
function createMockInstance(): ReactFlowInstance {
  return {
    setViewport: vi.fn(),
    fitView: vi.fn(),
    getViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
    // Add other required methods as stubs
    getNodes: vi.fn().mockReturnValue([]),
    getEdges: vi.fn().mockReturnValue([]),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    toObject: vi.fn(),
    deleteElements: vi.fn(),
    getNode: vi.fn(),
    getEdge: vi.fn(),
    viewportInitialized: true,
    screenToFlowPosition: vi.fn(),
    flowToScreenPosition: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomTo: vi.fn(),
    setCenter: vi.fn(),
    getIntersectingNodes: vi.fn(),
    isNodeIntersecting: vi.fn(),
    updateNode: vi.fn(),
    updateNodeData: vi.fn(),
    getNodesBounds: vi.fn(),
    updateEdge: vi.fn(),
    updateEdgeData: vi.fn(),
  } as unknown as ReactFlowInstance
}

describe('useSyncedViewports', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns all expected handlers', () => {
    const { result } = renderHook(() => useSyncedViewports())

    expect(result.current).toHaveProperty('setInstanceA')
    expect(result.current).toHaveProperty('setInstanceB')
    expect(result.current).toHaveProperty('onMoveEndA')
    expect(result.current).toHaveProperty('onMoveEndB')
    expect(result.current).toHaveProperty('syncToViewport')
    expect(result.current).toHaveProperty('fitBoth')
  })

  it('syncs viewport from A to B when A moves', () => {
    const { result } = renderHook(() => useSyncedViewports({ debounceMs: 10 }))
    const mockInstanceA = createMockInstance()
    const mockInstanceB = createMockInstance()

    // Set both instances
    act(() => {
      result.current.setInstanceA(mockInstanceA)
      result.current.setInstanceB(mockInstanceB)
    })

    // Simulate A moving
    const viewport: Viewport = { x: 100, y: 200, zoom: 1.5 }
    act(() => {
      result.current.onMoveEndA(null as any, viewport)
    })

    // Advance timers past debounce
    act(() => {
      vi.advanceTimersByTime(60)
    })

    // B should have received the viewport
    expect(mockInstanceB.setViewport).toHaveBeenCalledWith(viewport, { duration: 0 })
  })

  it('syncs viewport from B to A when B moves', () => {
    const { result } = renderHook(() => useSyncedViewports({ debounceMs: 10 }))
    const mockInstanceA = createMockInstance()
    const mockInstanceB = createMockInstance()

    act(() => {
      result.current.setInstanceA(mockInstanceA)
      result.current.setInstanceB(mockInstanceB)
    })

    const viewport: Viewport = { x: 50, y: 75, zoom: 0.8 }
    act(() => {
      result.current.onMoveEndB(null as any, viewport)
    })

    act(() => {
      vi.advanceTimersByTime(60)
    })

    expect(mockInstanceA.setViewport).toHaveBeenCalledWith(viewport, { duration: 0 })
  })

  it('does not sync when disabled', () => {
    const { result } = renderHook(() => useSyncedViewports({ enabled: false }))
    const mockInstanceA = createMockInstance()
    const mockInstanceB = createMockInstance()

    act(() => {
      result.current.setInstanceA(mockInstanceA)
      result.current.setInstanceB(mockInstanceB)
    })

    const viewport: Viewport = { x: 100, y: 200, zoom: 1.5 }
    act(() => {
      result.current.onMoveEndA(null as any, viewport)
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockInstanceB.setViewport).not.toHaveBeenCalled()
  })

  it('fitBoth calls fitView on both instances', () => {
    const { result } = renderHook(() => useSyncedViewports())
    const mockInstanceA = createMockInstance()
    const mockInstanceB = createMockInstance()

    act(() => {
      result.current.setInstanceA(mockInstanceA)
      result.current.setInstanceB(mockInstanceB)
    })

    act(() => {
      result.current.fitBoth()
    })

    expect(mockInstanceA.fitView).toHaveBeenCalled()
    expect(mockInstanceB.fitView).toHaveBeenCalled()
  })

  it('syncToViewport sets viewport on both instances', () => {
    const { result } = renderHook(() => useSyncedViewports())
    const mockInstanceA = createMockInstance()
    const mockInstanceB = createMockInstance()

    act(() => {
      result.current.setInstanceA(mockInstanceA)
      result.current.setInstanceB(mockInstanceB)
    })

    const viewport: Viewport = { x: 0, y: 0, zoom: 1 }
    act(() => {
      result.current.syncToViewport(viewport)
    })

    expect(mockInstanceA.setViewport).toHaveBeenCalledWith(viewport, { duration: 0 })
    expect(mockInstanceB.setViewport).toHaveBeenCalledWith(viewport, { duration: 0 })
  })
})
