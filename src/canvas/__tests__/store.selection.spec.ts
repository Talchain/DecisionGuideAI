import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

function seed() {
  useCanvasStore.setState({
    nodes: [
      { id: 'a', type: 'factor', position: { x: 0, y: 0 }, width: 180, height: 60, data: { label: 'A' } } as any,
      { id: 'b', type: 'factor', position: { x: 300, y: 0 }, width: 180, height: 60, data: { label: 'B' } } as any,
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', data: {} } as any,
    ],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    history: { past: [], future: [] },
    nextNodeId: 3,
    nextEdgeId: 2,
  })
}

describe('Canvas store — selection reconciliation + history gating', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    seed()
  })

  it('does not push history on node select-only change', () => {
    const before = useCanvasStore.getState().history.past.length
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'select', selected: true },
    ])
    expect(useCanvasStore.getState().history.past.length).toBe(before)
  })

  it('does not push history on edge select-only change', () => {
    const before = useCanvasStore.getState().history.past.length
    useCanvasStore.getState().onEdgesChange([
      { id: 'e1', type: 'select', selected: true },
    ])
    expect(useCanvasStore.getState().history.past.length).toBe(before)
  })

  it('still pushes history on node removal', () => {
    const before = useCanvasStore.getState().history.past.length
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'remove' },
    ])
    expect(useCanvasStore.getState().history.past.length).toBeGreaterThan(before)
  })

  it('reconciles selection.nodeIds from node.selected flags', () => {
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'select', selected: true },
    ])
    const sel = useCanvasStore.getState().selection
    expect([...sel.nodeIds]).toEqual(['a'])
    expect(sel.edgeIds.size).toBe(0)
  })

  it('reconciles selection.edgeIds from edge.selected flags', () => {
    useCanvasStore.getState().onEdgesChange([
      { id: 'e1', type: 'select', selected: true },
    ])
    const sel = useCanvasStore.getState().selection
    expect([...sel.edgeIds]).toEqual(['e1'])
    expect(sel.nodeIds.size).toBe(0)
  })

  it('computes anchorPosition for single-node selection in onNodesChange', () => {
    useCanvasStore.getState().onNodesChange([
      { id: 'b', type: 'select', selected: true },
    ])
    const { anchorPosition } = useCanvasStore.getState().selection
    // b is at x=300, y=0, 180x60 → right-center = (480, 30)
    expect(anchorPosition).toEqual({ x: 480, y: 30 })
  })

  it('computes anchorPosition for single-edge selection in onEdgesChange', () => {
    useCanvasStore.getState().onEdgesChange([
      { id: 'e1', type: 'select', selected: true },
    ])
    const { anchorPosition } = useCanvasStore.getState().selection
    // edge midpoint between a-center (90, 30) and b-center (390, 30) = (240, 30)
    expect(anchorPosition).toEqual({ x: 240, y: 30 })
  })

  it('clears anchorPosition when multi-selecting', () => {
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'select', selected: true },
      { id: 'b', type: 'select', selected: true },
    ])
    const { anchorPosition, nodeIds } = useCanvasStore.getState().selection
    expect(nodeIds.size).toBe(2)
    expect(anchorPosition).toBeNull()
  })

  it('clears selection.nodeIds when node is deselected', () => {
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'select', selected: true },
    ])
    useCanvasStore.getState().onNodesChange([
      { id: 'a', type: 'select', selected: false },
    ])
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
  })
})
