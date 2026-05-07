/**
 * Verifies that applyClarifierGraph defers layout via the new measurement-
 * aware lifecycle (P1.3 of post-D6 review): instead of calling
 * `handleLayoutWithRecovery(applyLayout, ...)` directly, it flips
 * `pendingLayout=true`. The actual ELK invocation happens in
 * ReactFlowGraph's measure-then-layout effect once nodes are measured;
 * failure surfacing for auto-triggered layouts lives at that layer (the
 * effect wraps applyLayout in handleLayoutWithRecovery — see I1 of
 * post-D6 review).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('applyClarifierGraph layout deferral', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
      pendingLayout: false,
      layoutInProgress: false,
      layoutRequestId: 0,
    } as never)
  })

  it('flips pendingLayout=true and bumps layoutRequestId on preview insertion', () => {
    const r0 = useCanvasStore.getState().layoutRequestId

    const graph = {
      nodes: [{ id: 'n1', kind: 'decision', label: 'A' }],
      edges: [],
    }
    useCanvasStore.getState().applyClarifierGraph(graph, { preview: true })

    expect(useCanvasStore.getState().pendingLayout).toBe(true)
    expect(useCanvasStore.getState().layoutRequestId).toBe(r0 + 1)
  })

  it('flips pendingLayout=true on finalize insertion', () => {
    const r0 = useCanvasStore.getState().layoutRequestId

    const graph = {
      nodes: [{ id: 'n1', kind: 'decision', label: 'A' }],
      edges: [],
    }
    useCanvasStore.getState().applyClarifierGraph(graph, { preview: false })

    expect(useCanvasStore.getState().pendingLayout).toBe(true)
    expect(useCanvasStore.getState().layoutRequestId).toBe(r0 + 1)
  })
})
