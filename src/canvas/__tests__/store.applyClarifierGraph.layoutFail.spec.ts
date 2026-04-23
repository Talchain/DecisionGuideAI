/**
 * Verifies that when applyClarifierGraph's internal applyLayout rejects,
 * the failure is surfaced via useLayoutProgressStore.fail() with a retry
 * closure (rather than being swallowed with console.warn only).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'

describe('applyClarifierGraph layout failure surfacing', () => {
  beforeEach(() => {
    // Reset layout progress store to idle.
    useLayoutProgressStore.setState({ status: 'idle', message: null, canRetry: false, retry: null })
    // Reset canvas store nodes/edges/clarifier preview tracking.
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
    } as any)
  })

  it('routes applyLayout rejection through layoutProgressStore.fail with a retry that re-invokes applyLayout', async () => {
    const originalApplyLayout = useCanvasStore.getState().applyLayout
    const applyLayoutSpy = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('forced failure')))
      .mockImplementationOnce(() => Promise.resolve())

    // Replace the action on the store.
    useCanvasStore.setState({ applyLayout: applyLayoutSpy } as any)

    try {
      const graph = {
        nodes: [{ id: 'n1', kind: 'decision', label: 'A' }],
        edges: [],
      }
      useCanvasStore.getState().applyClarifierGraph(graph, { preview: true })

      await vi.waitFor(() => {
        expect(useLayoutProgressStore.getState().status).toBe('error')
      })

      const state = useLayoutProgressStore.getState()
      expect(state.status).toBe('error')
      expect(state.message).toBe('Layout failed. Try again.')
      expect(state.canRetry).toBe(true)
      expect(typeof state.retry).toBe('function')
      expect(applyLayoutSpy).toHaveBeenCalledTimes(1)

      // pendingFitView should NOT be set when layout fails (it's in onSuccess)
      expect(useCanvasStore.getState().pendingFitView).toBe(false)

      state.retry!()
      await vi.waitFor(() => {
        expect(applyLayoutSpy).toHaveBeenCalledTimes(2)
      })
      await vi.waitFor(() => {
        expect(useLayoutProgressStore.getState().status).toBe('idle')
      })
    } finally {
      useCanvasStore.setState({ applyLayout: originalApplyLayout } as any)
    }
  })
})
