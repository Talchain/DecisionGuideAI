/**
 * Mid-flight supersession tests (post-Round-3 P0).
 *
 * The pre-await stale guard in applyLayout is not enough. While
 * `await layoutGraph(...)` is suspended, store.nodes can change (a new
 * draft, patch, or import inserts nodes) and a fresh setPendingLayout(true)
 * can bump layoutRequestId. The in-flight request must:
 *
 *   1. NOT commit its (stale) layoutedNodes — `set({ nodes: layoutedNodes })`
 *      is a full replace; it would wipe any node added during the await.
 *   2. NOT bump layoutVersion — that would trigger a spurious fitView for
 *      the wrong (stale) graph.
 *   3. NOT clear pendingLayout — the newer request's signal must survive
 *      so the measurement effect picks it up after layoutInProgress clears.
 *
 * These tests live in their own file because vitest's module cache makes
 * `vi.doMock('../utils/layout', ...)` unreliable when a previous test in
 * the same file has already imported the real module (the layout module
 * is loaded into cache on first applyLayout call and `vi.doUnmock` does
 * not reliably re-invalidate it for subsequent doMock calls in the same
 * file/module-graph). Keeping these mock-heavy tests isolated dodges the
 * problem without resorting to brittle resetModules dances.
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

describe('applyLayout — mid-flight supersession (post-await stale guards)', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('post-await stale-commit guard — superseded request does not overwrite live nodes, leaves pendingLayout=true, does not bump layoutVersion', async () => {
    const newNodeC = nodeAt('c', 0, 0, 'factor')
    vi.doMock('../utils/layout', () => ({
      // Mock simulates supersession from INSIDE layoutGraph: while
      // applyLayout awaits us, we mutate the live store (insert 'c',
      // bump layoutRequestId). Then we return positions for the OLD
      // snapshot — exactly the data-loss scenario.
      layoutGraph: async (nodes: ReturnType<typeof nodeAt>[]) => {
        const live = useCanvasStore.getState()
        useCanvasStore.setState({ nodes: [...live.nodes, newNodeC] })
        useCanvasStore.getState().setPendingLayout(true)
        return {
          nodes: nodes.map((n) => ({ ...n, position: { x: 100, y: 100 } })),
          layoutNodeWidth: 320,
        }
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
    }))
    try {
      useCanvasStore.setState({
        nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
        edges: [],
        layoutRequestId: 1,
      })
      const v0 = useCanvasStore.getState().layoutVersion

      await useCanvasStore
        .getState()
        .applyLayout({ skipHistory: true, requestId: 1 })

      const after = useCanvasStore.getState()

      // Live graph still has 'c' — request 1 did NOT overwrite it.
      expect(after.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
      // layoutVersion did NOT bump (no spurious fitView for stale layout).
      expect(after.layoutVersion).toBe(v0)
      // Newer request's signal survived: pendingLayout true,
      // layoutInProgress cleared in finally so the effect can pick up rid=2.
      expect(after.pendingLayout).toBe(true)
      expect(after.layoutInProgress).toBe(false)
      expect(after.layoutRequestId).toBe(2)
    } finally {
      vi.doUnmock('../utils/layout')
    }
  })

  // Round-4 P0: the post-await guard must protect manual calls too. A user
  // clicking "Re-layout" (toolbar/command palette) calls applyLayout() with
  // no requestId. If a CEE draft arrives during that manual layout's
  // `await layoutGraph`, it calls setPendingLayout(true) — bumping the rid
  // and inserting new nodes. Without a generation snapshot, the manual
  // layout would commit its stale layoutedNodes (wiping the new nodes),
  // bump layoutVersion (spurious fitView for the wrong graph), and clear
  // pendingLayout (auto-trigger's signal lost).
  it('post-await stale-commit guard — manual applyLayout() (no requestId) is also protected from mid-flight supersession', async () => {
    const newNodeC = nodeAt('c', 0, 0, 'factor')
    vi.doMock('../utils/layout', () => ({
      layoutGraph: async (nodes: ReturnType<typeof nodeAt>[]) => {
        // While the manual layout is "running", a draft arrives:
        // store.nodes grows and setPendingLayout(true) bumps the rid.
        const live = useCanvasStore.getState()
        useCanvasStore.setState({ nodes: [...live.nodes, newNodeC] })
        useCanvasStore.getState().setPendingLayout(true)
        return {
          nodes: nodes.map((n) => ({ ...n, position: { x: 100, y: 100 } })),
          layoutNodeWidth: 320,
        }
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
    }))
    try {
      useCanvasStore.setState({
        nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
        edges: [],
        layoutRequestId: 0,
      })
      const v0 = useCanvasStore.getState().layoutVersion

      // Manual call — no opts.requestId.
      await useCanvasStore.getState().applyLayout()

      const after = useCanvasStore.getState()

      // 'c' (inserted during the await) survived the manual layout.
      expect(after.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
      // No spurious fitView for the stale manual layout.
      expect(after.layoutVersion).toBe(v0)
      // Auto-trigger's pendingLayout=true survived.
      expect(after.pendingLayout).toBe(true)
      expect(after.layoutInProgress).toBe(false)
      // Generation bumped by the mid-flight setPendingLayout(true).
      expect(after.layoutRequestId).toBe(1)
    } finally {
      vi.doUnmock('../utils/layout')
    }
  })

  it('post-await stale-rejection — superseded request that rejects must not clear pendingLayout', async () => {
    vi.doMock('../utils/layout', () => ({
      layoutGraph: async () => {
        useCanvasStore.getState().setPendingLayout(true)
        throw new Error('boom in flight')
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
    }))
    try {
      useCanvasStore.setState({
        nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
        edges: [],
        layoutRequestId: 1,
      })

      await expect(
        useCanvasStore
          .getState()
          .applyLayout({ skipHistory: true, requestId: 1 }),
      ).rejects.toThrow('boom in flight')

      // Newer request's pendingLayout=true must survive the failed older
      // request's catch path. Without the isCurrent() guard in catch,
      // pendingLayout would be cleared and the newer request would never run.
      expect(useCanvasStore.getState().pendingLayout).toBe(true)
      expect(useCanvasStore.getState().layoutInProgress).toBe(false)
      expect(useCanvasStore.getState().layoutRequestId).toBe(2)
    } finally {
      vi.doUnmock('../utils/layout')
    }
  })

  // Synchronous-call race (Round-5 hardening): the re-entry guard reads
  // layoutInProgress, then the function awaits two dynamic imports before
  // reaching `set({ layoutInProgress: true })`. During that import yield,
  // a second synchronous applyLayout() call would also pass the guard and
  // race against the first. Both would push history, run layoutGraph, and
  // commit — double-bumping layoutVersion.
  //
  // The fix claims layoutInProgress=true SYNCHRONOUSLY (in the same tick
  // as the guard read), before any await. This test verifies that two
  // back-to-back synchronous calls only execute layoutGraph once and only
  // bump layoutVersion once.
  it('synchronous-race — second back-to-back applyLayout call is dropped before doing any work', async () => {
    let layoutGraphCalls = 0
    vi.doMock('../utils/layout', () => ({
      layoutGraph: async (nodes: ReturnType<typeof nodeAt>[]) => {
        layoutGraphCalls += 1
        return {
          nodes: nodes.map((n) => ({ ...n, position: { x: 50, y: 50 } })),
          layoutNodeWidth: 320,
        }
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
    }))
    try {
      useCanvasStore.setState({
        nodes: [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option')],
        edges: [],
      })
      const v0 = useCanvasStore.getState().layoutVersion

      // Two synchronous calls. The second must observe layoutInProgress=true
      // from the first's synchronous claim and short-circuit immediately.
      const call1 = useCanvasStore.getState().applyLayout()
      const call2 = useCanvasStore.getState().applyLayout()

      await Promise.all([call1, call2])

      expect(layoutGraphCalls).toBe(1)
      expect(useCanvasStore.getState().layoutVersion).toBe(v0 + 1)
      expect(useCanvasStore.getState().layoutInProgress).toBe(false)
    } finally {
      vi.doUnmock('../utils/layout')
    }
  })
})
