/**
 * Layout lifecycle tests (D2 + D5 + P1.1).
 *
 * Covers the new applyLayout opts (`skipHistory`, `requestId`), plus the
 * pendingLayout / layoutInProgress / layoutVersion / layoutRequestId
 * fields, plus the P1.1 fix (failed layouts must clear pendingLayout) and
 * the setPendingLayout setter contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../store'

function nodeAt(id: string, x: number, y: number, type = 'factor') {
  return {
    id,
    type,
    position: { x, y },
    data: { label: id, kind: type },
  } as never
}

describe('applyLayout — lifecycle (D2)', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('increments layoutVersion exactly once per successful run', async () => {
    useCanvasStore.setState({
      nodes: [
        nodeAt('d', 0, 0, 'decision'),
        nodeAt('o', 0, 0, 'option'),
        nodeAt('g', 0, 0, 'goal'),
      ],
      edges: [],
    })

    const v0 = useCanvasStore.getState().layoutVersion
    await useCanvasStore.getState().applyLayout()
    expect(useCanvasStore.getState().layoutVersion).toBe(v0 + 1)
  })

  it('clears pendingLayout when layout completes', async () => {
    useCanvasStore.setState({
      nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
      edges: [],
      pendingLayout: true,
    })

    await useCanvasStore.getState().applyLayout()

    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutInProgress).toBe(false)
  })

  it('drops calls whose requestId no longer matches layoutRequestId', async () => {
    useCanvasStore.setState({
      nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
      edges: [],
      layoutRequestId: 5,
    })

    const v0 = useCanvasStore.getState().layoutVersion

    await useCanvasStore.getState().applyLayout({ requestId: 4 })
    expect(useCanvasStore.getState().layoutVersion).toBe(v0)

    await useCanvasStore.getState().applyLayout({ requestId: 5 })
    expect(useCanvasStore.getState().layoutVersion).toBe(v0 + 1)
  })

  it('skipHistory: true does not push to the history stack', async () => {
    useCanvasStore.setState({
      nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
      edges: [],
    })

    const undoBefore = useCanvasStore.getState().canUndo()
    await useCanvasStore.getState().applyLayout({ skipHistory: true })

    expect(useCanvasStore.getState().canUndo()).toBe(undoBefore)
  })

  it('default (no opts) still pushes history — manual relayouts undo correctly', async () => {
    useCanvasStore.setState({
      nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
      edges: [],
    })

    await useCanvasStore.getState().applyLayout()

    expect(useCanvasStore.getState().canUndo()).toBe(true)
  })

  it('setPendingLayout(true) bumps layoutRequestId — stale-request guard armed', () => {
    const r0 = useCanvasStore.getState().layoutRequestId
    useCanvasStore.getState().setPendingLayout(true)
    expect(useCanvasStore.getState().layoutRequestId).toBe(r0 + 1)
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    useCanvasStore.getState().setPendingLayout(true)
    expect(useCanvasStore.getState().layoutRequestId).toBe(r0 + 2)
  })

  it('setPendingLayout(false) does not bump layoutRequestId', () => {
    useCanvasStore.getState().setPendingLayout(true)
    const r1 = useCanvasStore.getState().layoutRequestId

    useCanvasStore.getState().setPendingLayout(false)

    expect(useCanvasStore.getState().layoutRequestId).toBe(r1)
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })

  it('layoutVersion increments on success (empty graph)', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    const v0 = useCanvasStore.getState().layoutVersion
    await useCanvasStore.getState().applyLayout()
    expect(useCanvasStore.getState().layoutVersion).toBe(v0 + 1)
  })

  // P1.1 of post-D6 review (real rejection test): when layoutGraph rejects,
  // the catch path must clear pendingLayout, layoutInProgress must clear in
  // finally, and layoutVersion must NOT increment. Without this fix, a
  // single failure produces an infinite retry loop because the measurement
  // effect refires when layoutInProgress flips false.
  it('P1.1 fix — when layoutGraph rejects, pendingLayout clears, layoutInProgress clears, layoutVersion stays put', async () => {
    vi.doMock('../utils/layout', () => ({
      layoutGraph: () => Promise.reject(new Error('forced layout failure')),
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
    }))
    try {
      useCanvasStore.setState({
        nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
        edges: [],
        pendingLayout: true,
        layoutInProgress: false,
      })
      const v0 = useCanvasStore.getState().layoutVersion

      await expect(
        useCanvasStore.getState().applyLayout({ skipHistory: true }),
      ).rejects.toThrow('forced layout failure')

      expect(useCanvasStore.getState().pendingLayout).toBe(false)
      expect(useCanvasStore.getState().layoutInProgress).toBe(false)
      expect(useCanvasStore.getState().layoutVersion).toBe(v0)
    } finally {
      vi.doUnmock('../utils/layout')
    }
  })

  it('re-entry guard — applyLayout no-ops while another run is in progress', async () => {
    useCanvasStore.setState({
      nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
      edges: [],
      layoutInProgress: true,
    })

    const v0 = useCanvasStore.getState().layoutVersion
    await useCanvasStore.getState().applyLayout()

    expect(useCanvasStore.getState().layoutVersion).toBe(v0)
  })

  // Mid-flight supersession (post-Round-3 P0) is covered in
  // src/canvas/__tests__/applyLayout.staleCommit.spec.ts — kept in its own
  // file because vitest's module cache prevents reliable re-mocking of
  // the layout module after a previous test in the same file has loaded it.
})
