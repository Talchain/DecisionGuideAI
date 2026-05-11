import { describe, it, expect, beforeEach, vi } from 'vitest'

// Bug 1 regression: undoDraft() previously called bare `saveAutosave(nodes, edges)`
// — saveAutosave wasn't imported in store.ts (TS2304 cannot find name) and the
// signature requires a single AutosaveData object, not two positional args.
// At runtime this produced a ReferenceError on every draft-undo, silently
// breaking crash-resilience for that code path.
//
// The fix routes through `scenarios.saveAutosave({ timestamp, nodes, edges })`.
// This test exercises the undoDraft path end-to-end and asserts:
//   1. Calling undoDraft() does not throw.
//   2. scenarios.saveAutosave was called once with the expected AutosaveData
//      payload shape (timestamp:number, nodes, edges from the snapshot).

// vi.mock is hoisted; declare the spy via vi.hoisted so it's available
// when the mock factory runs.
const { saveAutosaveMock } = vi.hoisted(() => ({
  saveAutosaveMock: vi.fn(),
}))
vi.mock('../store/scenarios', async () => {
  const actual = await vi.importActual<typeof import('../store/scenarios')>(
    '../store/scenarios',
  )
  return {
    ...actual,
    saveAutosave: saveAutosaveMock,
  }
})

import { useCanvasStore } from '../store'

describe('undoDraft — Bug 1 regression (saveAutosave call)', () => {
  beforeEach(() => {
    saveAutosaveMock.mockReset()
    useCanvasStore.getState().reset()
  })

  it('calls scenarios.saveAutosave with { timestamp, nodes, edges } and does not throw', () => {
    const snapshotNodes = [
      { id: 's1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Snap goal' } } as any,
      { id: 's2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Snap opt' } } as any,
    ]
    const snapshotEdges = [
      { id: 'se1', source: 's2', target: 's1', data: {} } as any,
    ]

    // Seed canvas with current (drafted) state, then attach the pre-draft snapshot.
    useCanvasStore.setState({
      nodes: [{ id: 'd1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Drafted' } } as any],
      edges: [],
      draftChatPreDraftSnapshot: { nodes: snapshotNodes, edges: snapshotEdges },
    })

    expect(() => useCanvasStore.getState().undoDraft()).not.toThrow()

    expect(saveAutosaveMock).toHaveBeenCalledTimes(1)
    const arg = saveAutosaveMock.mock.calls[0][0]
    expect(typeof arg.timestamp).toBe('number')
    expect(arg.nodes).toBe(snapshotNodes)
    expect(arg.edges).toBe(snapshotEdges)

    // Sanity: undoDraft restored the snapshot to live state.
    const restored = useCanvasStore.getState()
    expect(restored.nodes).toBe(snapshotNodes)
    expect(restored.edges).toBe(snapshotEdges)
    expect(restored.draftChatPreDraftSnapshot).toBeNull()
  })

  it('is a no-op when no pre-draft snapshot is set', () => {
    useCanvasStore.setState({ draftChatPreDraftSnapshot: null })

    expect(() => useCanvasStore.getState().undoDraft()).not.toThrow()
    expect(saveAutosaveMock).not.toHaveBeenCalled()
  })
})
