/**
 * HighlightContext tests
 * Verifies: state updates, canvas store integration, large-graph guardrail,
 * clearHighlight, provider/consumer boundary, no-op defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { HighlightProvider, useHighlightContext } from '../HighlightContext'

// ---------------------------------------------------------------------------
// Mock canvas store
// ---------------------------------------------------------------------------

const mockSetHighlightedNodes = vi.fn()
let mockNodeCount = 5

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: { nodes: { length: number } }) => unknown) =>
    selector({ nodes: { length: mockNodeCount } }),
  ),
}))

// Patch getState to control store actions
const { useCanvasStore } = await import('../../store')
vi.mocked(useCanvasStore).getState = vi.fn(() => ({
  nodes: Array.from({ length: mockNodeCount }),
  setHighlightedNodes: mockSetHighlightedNodes,
} as unknown as ReturnType<typeof useCanvasStore.getState>))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <HighlightProvider>{children}</HighlightProvider>
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HighlightContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNodeCount = 5
    vi.mocked(useCanvasStore).getState = vi.fn(() => ({
      nodes: Array.from({ length: mockNodeCount }),
      setHighlightedNodes: mockSetHighlightedNodes,
    } as unknown as ReturnType<typeof useCanvasStore.getState>))
  })

  it('initial hoveredElementId is null', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    expect(result.current.hoveredElementId).toBeNull()
  })

  it('setHoveredFromPanel updates hoveredElementId', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('node-1')
    })
    expect(result.current.hoveredElementId).toBe('node-1')
  })

  it('setHoveredFromPanel(null) clears hoveredElementId', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('node-1')
      result.current.setHoveredFromPanel(null)
    })
    expect(result.current.hoveredElementId).toBeNull()
  })

  it('setHoveredFromCanvas updates hoveredElementId', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromCanvas('node-2')
    })
    expect(result.current.hoveredElementId).toBe('node-2')
  })

  it('setHoveredFromPanel calls setHighlightedNodes on canvas store (small graph)', () => {
    mockNodeCount = 5
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('node-1')
    })
    expect(mockSetHighlightedNodes).toHaveBeenCalledWith(['node-1'])
  })

  it('setHoveredFromPanel(null) always calls setHighlightedNodes([]) for cleanup', () => {
    mockNodeCount = 100 // large graph
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel(null)
    })
    expect(mockSetHighlightedNodes).toHaveBeenCalledWith([])
  })

  it('setHoveredFromPanel skips setHighlightedNodes when graph has >50 nodes', () => {
    mockNodeCount = 51
    vi.mocked(useCanvasStore).getState = vi.fn(() => ({
      nodes: Array.from({ length: 51 }),
      setHighlightedNodes: mockSetHighlightedNodes,
    } as unknown as ReturnType<typeof useCanvasStore.getState>))
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('node-1')
    })
    // setHighlightedNodes should NOT have been called with an id (only cleanup calls are allowed)
    expect(mockSetHighlightedNodes).not.toHaveBeenCalledWith(['node-1'])
  })

  it('setHoveredFromCanvas does NOT call setHighlightedNodes', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromCanvas('node-3')
    })
    expect(mockSetHighlightedNodes).not.toHaveBeenCalled()
  })

  it('clearHighlight sets hoveredElementId to null and calls setHighlightedNodes([])', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('node-1')
      result.current.clearHighlight()
    })
    expect(result.current.hoveredElementId).toBeNull()
    expect(mockSetHighlightedNodes).toHaveBeenLastCalledWith([])
  })

  it('provider renders children without crashing', () => {
    render(
      <HighlightProvider>
        <div data-testid="child">hello</div>
      </HighlightProvider>,
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('useHighlightContext returns safe no-op defaults outside provider (no crash)', () => {
    const { result } = renderHook(() => useHighlightContext())
    expect(result.current.hoveredElementId).toBeNull()
    // Calling setters outside provider should not throw
    expect(() => {
      result.current.setHoveredFromPanel('x')
      result.current.setHoveredFromCanvas('x')
      result.current.clearHighlight()
    }).not.toThrow()
  })

  it('last-write-wins: setHoveredFromCanvas after setHoveredFromPanel takes precedence', () => {
    const { result } = renderHook(() => useHighlightContext(), { wrapper })
    act(() => {
      result.current.setHoveredFromPanel('panel-id')
      result.current.setHoveredFromCanvas('canvas-id')
    })
    expect(result.current.hoveredElementId).toBe('canvas-id')
  })
})
