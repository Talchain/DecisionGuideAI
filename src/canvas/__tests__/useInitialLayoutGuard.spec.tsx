import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useInitialLayoutGuard } from '../hooks/useInitialLayoutGuard'

function n(id: string, x: number, y: number, locked = false): Node {
  return {
    id,
    type: 'factor',
    position: { x, y },
    data: locked ? { locked: true, label: id } : { label: id },
  } as Node
}

function e(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge
}

function stackedNodes(ids: string[]): Node[] {
  return ids.map((id) => n(id, 0, 0))
}

function spreadNodes(ids: string[]): Node[] {
  return ids.map((id, i) => n(id, i * 300, 0))
}

function seed(state: {
  nodes: Node[]
  edges?: Edge[]
  currentScenarioId?: string | null
  pendingLayout?: boolean
  layoutInProgress?: boolean
}) {
  act(() => {
    useCanvasStore.setState({
      nodes: state.nodes,
      edges: state.edges ?? [],
      currentScenarioId: state.currentScenarioId ?? null,
      pendingLayout: state.pendingLayout ?? false,
      layoutInProgress: state.layoutInProgress ?? false,
    } as never)
  })
}

describe('useInitialLayoutGuard', () => {
  let setPendingLayoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    setPendingLayoutSpy = vi.spyOn(useCanvasStore.getState(), 'setPendingLayout')
  })

  afterEach(() => {
    setPendingLayoutSpy.mockRestore()
  })

  it('fires once when an existing scenario hydrates with stacked nodes', () => {
    seed({ nodes: stackedNodes(['a', 'b', 'c']), currentScenarioId: 'scA' })
    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
    expect(setPendingLayoutSpy).toHaveBeenCalledWith(true)
    // Re-render without state change — must not re-fire.
    rerender()
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('does not fire when an existing scenario has meaningful saved positions', () => {
    seed({ nodes: spreadNodes(['a', 'b', 'c']), currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()
  })

  it('same scenario id with changed graph structure fires once for the new structural key', () => {
    seed({ nodes: stackedNodes(['a', 'b']), currentScenarioId: 'scA', edges: [e('e1', 'a', 'b')] })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)

    // Same scenario id, different node/edge set, still stacked.
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      currentScenarioId: 'scA',
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    })
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(2)
  })

  it('spread positions are not "consumed" — the same graph can fire later if it becomes stacked', () => {
    // Start meaningful — guard does not fire, and does not mark the key as fired.
    seed({
      nodes: spreadNodes(['a', 'b', 'c']),
      currentScenarioId: 'scA',
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()

    // Same identity key, but now stacked. Guard must still recover.
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      currentScenarioId: 'scA',
      edges: [e('e1', 'a', 'b'), e('e2', 'b', 'c')],
    })
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('scenario A→B switch fires for B when B is stacked, even if A was meaningful', () => {
    seed({ nodes: spreadNodes(['a', 'b']), currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()

    seed({ nodes: stackedNodes(['x', 'y', 'z']), currentScenarioId: 'scB' })
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('does not fire while pendingLayout is already true (does not compete)', () => {
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      currentScenarioId: 'scA',
      pendingLayout: true,
    })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()
  })

  it('does not fire while layoutInProgress is true', () => {
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      currentScenarioId: 'scA',
      layoutInProgress: true,
    })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()
  })

  it('does not re-fire after the requested layout completes and nodes spread', () => {
    seed({ nodes: stackedNodes(['a', 'b', 'c']), currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)

    // Simulate the measurement pipeline running applyLayout and committing
    // spread positions. The guard must not re-fire for the same identity.
    act(() => {
      useCanvasStore.setState({
        nodes: spreadNodes(['a', 'b', 'c']) as never,
        pendingLayout: false,
        layoutInProgress: false,
        layoutVersion: useCanvasStore.getState().layoutVersion + 1,
      } as never)
    })
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('never fires for an empty graph', () => {
    seed({ nodes: [], currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()
  })

  it('does not fire when every node is locked (predicate ignores locked nodes)', () => {
    const lockedAll = ['a', 'b', 'c'].map((id) => n(id, 0, 0, true))
    seed({ nodes: lockedAll, currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).not.toHaveBeenCalled()
  })

  it('fires when locked + unlocked are both stacked (unlocked drives decision)', () => {
    const mixed: Node[] = [
      n('locked-1', 0, 0, true),
      n('locked-2', 0, 0, true),
      n('free-1', 0, 0),
      n('free-2', 0, 0),
    ]
    seed({ nodes: mixed, currentScenarioId: 'scA' })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('fires for a draft graph (no scenario id) when stacked', () => {
    seed({ nodes: stackedNodes(['a', 'b']), currentScenarioId: null })
    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
    rerender()
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })

  it('handles edges without an explicit id via source->target fallback (stable key)', () => {
    const edgesNoId: Edge[] = [
      { source: 'a', target: 'b' } as Edge,
      { source: 'b', target: 'c' } as Edge,
    ]
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      edges: edgesNoId,
      currentScenarioId: 'scA',
    })
    renderHook(() => useInitialLayoutGuard())
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)

    // Same edges, same structure — must not refire just because we re-seeded.
    seed({
      nodes: stackedNodes(['a', 'b', 'c']),
      edges: edgesNoId,
      currentScenarioId: 'scA',
    })
    expect(setPendingLayoutSpy).toHaveBeenCalledTimes(1)
  })
})
