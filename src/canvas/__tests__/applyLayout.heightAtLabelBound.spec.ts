/**
 * `applyLayout` MUST HAND THE LAYOUT THE HEIGHTS MEASURED AT THE BOUND.
 *
 * ⭐ THIS FILE EXISTS BECAUSE A MUTANT SURVIVED. The layout-side invariants in
 * `layoutHeightAtLabelBound.spec.ts` are sensitive and bind by identity, and a
 * mutant that simply STOPPED PASSING `heightAtLabelBound` from the store left
 * all ten of them GREEN — because they call `layoutGraph` directly. A guard on
 * the callee proves nothing about the wiring, and the wiring is the whole fix.
 *
 * ⚠ Mock-heavy, so it lives in its own file: vitest's module cache makes
 * `vi.doMock('../utils/layout', …)` unreliable once a sibling test in the same
 * file has already imported the real module (see
 * `applyLayout.staleCommit.spec.ts`'s header for the same reasoning).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../store'

function nodeAt(id: string, x: number, y: number, type = 'factor') {
  return { id, type, position: { x, y }, data: { label: id, kind: type } } as never
}

describe('applyLayout — the bound heights reach layoutGraph', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    vi.resetModules()
  })

  it('passes the map returned by measureNodeHeightsAtLabelBound to layoutGraph, by identity', async () => {
    // A DISTINCT SENTINEL MAP, not a value predicate another map could satisfy
    // (CLAUDE.md trap 19): the assertion is that THIS object arrived.
    const sentinel = new Map<string, number>([['a', 4321], ['b', 1234]])
    const seen: Array<Map<string, number> | undefined> = []

    vi.doMock('../utils/measureNodeHeightsAtLabelBound', () => ({
      measureNodeHeightsAtLabelBound: () => sentinel,
    }))
    vi.doMock('../utils/layout', () => ({
      layoutGraph: async (
        nodes: ReturnType<typeof nodeAt>[],
        _edges: unknown,
        options: { heightAtLabelBound?: Map<string, number> },
      ) => {
        seen.push(options?.heightAtLabelBound)
        return { nodes, edges: [], layoutNodeWidth: 230 }
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
      solveLayoutNodeWidth: () => 230,
    }))

    useCanvasStore.setState({ nodes: [nodeAt('a', 0, 0), nodeAt('b', 0, 0)] as never })
    await useCanvasStore.getState().applyLayout({ skipHistory: true })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(sentinel)
  })

  it('does not fabricate a map when the measurer has nothing to report', async () => {
    // The opposite-direction twin. An empty map must arrive AS an empty map —
    // never as `undefined` silently, and never as a map of zeroes, because a
    // zero height becomes a 40 px floor in `getNodeDimensions` and would
    // collapse every row.
    const empty = new Map<string, number>()
    const seen: Array<Map<string, number> | undefined> = []

    vi.doMock('../utils/measureNodeHeightsAtLabelBound', () => ({
      measureNodeHeightsAtLabelBound: () => empty,
    }))
    vi.doMock('../utils/layout', () => ({
      layoutGraph: async (
        nodes: ReturnType<typeof nodeAt>[],
        _edges: unknown,
        options: { heightAtLabelBound?: Map<string, number> },
      ) => {
        seen.push(options?.heightAtLabelBound)
        return { nodes, edges: [], layoutNodeWidth: 230 }
      },
      groupByYRow: () => new Map(),
      applyCollisionGuard: () => undefined,
      normaliseTierRows: () => undefined,
      solveLayoutNodeWidth: () => 230,
    }))

    useCanvasStore.setState({ nodes: [nodeAt('a', 0, 0)] as never })
    await useCanvasStore.getState().applyLayout({ skipHistory: true })

    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe(empty)
    expect(seen[0]?.size).toBe(0)
  })
})
