/**
 * A CHANGE ABOUT A NODE THIS STORE DOES NOT HOLD MUST NOT CHURN THE NODES ARRAY.
 *
 * ⭐ WHAT THIS IS PINNING, AND WHY IT IS NOT A PERFORMANCE TEST.
 *
 * The canvas injects four nodes DOWNSTREAM of this store — the reasoning-frontier
 * doors `__ghost-option__`, `__ghost-factor__`, `__ghost-risk__`, `__ghost-outcome__`,
 * built in `ReactFlowGraph.tsx`'s `nodesWithGhost` memo. React Flow measures them
 * like any other node and reports `dimensions` changes for them. Those changes
 * arrive at `onNodesChange` addressed to ids this store has never held.
 *
 * `applyNodeChanges` ALWAYS returns a NEW ARRAY (`@xyflow/react@12.10.2`,
 * `dist/esm/index.mjs:591-666`), whether or not any member changed. So a batch
 * that changed nothing still minted a new `nodes` identity, the `s => s.nodes`
 * selector re-rendered the canvas, the memo rebuilt the injected door OBJECTS,
 * and `adoptUserNodes` discarded React Flow's measurement of them
 * (`@xyflow/system@0.0.76:1620-1626` rebuilds `measured` from the user node, which
 * carries none). `nodeHasDimensions` then read false and React Flow painted
 * `visibility: hidden` (`index.mjs:2237`) — and re-observed, which produced the
 * next measurement, which produced the next change. A livelock.
 *
 * Measured in a real browser at `a0b77f6c` (vendor-selection starter): 1,660
 * ResizeObserver callbacks and 1,668 re-observations of four elements whose box
 * never changed, in ~3 seconds — with all four doors reading `visibility: hidden`
 * in all 12 samples while 19 of 19 real nodes read visible. So the doors were
 * never seen by a sighted user, while remaining focusable in the accessibility
 * tree. The visibility half of that claim is NOT assertable here — jsdom cannot
 * prove visibility (CLAUDE.md trap 3) — and is pinned by
 * `e2e/geometry/ghostDoorVisibility.measure.ts` in Chromium instead. What IS
 * assertable here is the mechanism: array identity.
 *
 * ⚠ THE PAIR IS THE POINT, AND ONE HALF ALONE PROVES NOTHING. A test that only
 * asserts "unknown id ⇒ same reference" is satisfied by a handler that ignores
 * every change ever sent to it. Its twin — "known id ⇒ new reference, value
 * applied" — is what makes the first one a statement about DISCRIMINATION rather
 * than about deafness (CLAUDE.md trap 19: bind by identity, and prove the guard
 * distinguishes rather than merely fires).
 *
 * ⚠ AND IT DOES NOT NAME A GHOST ID. This store must not know the canvas injects
 * anything; a hand-maintained list of foreign ids here is the hand-maintained
 * mirror this estate pays for most often (trap 12). The property is stated
 * without one: a batch that changed none of our nodes must not change our nodes'
 * identity. `__unowned__` below is deliberately NOT a ghost id, so the test
 * cannot pass because somebody special-cased the prefix.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { NodeChange } from '@xyflow/react'
import { useCanvasStore } from '../../store'

const seed = () => {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    nodes: [
      { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'fac_b', type: 'factor', position: { x: 200, y: 0 }, data: { label: 'B' } },
    ],
    edges: [],
  })
}

describe('onNodesChange — array identity', () => {
  beforeEach(seed)

  it('keeps the SAME nodes reference when every change addresses an id it does not hold', () => {
    const before = useCanvasStore.getState().nodes
    expect(before.map((n) => n.id)).toEqual(['opt_a', 'fac_b'])

    const changes: NodeChange[] = [
      { id: '__unowned__', type: 'dimensions', dimensions: { width: 132, height: 64 }, resizing: false } as NodeChange,
    ]
    useCanvasStore.getState().onNodesChange(changes)

    const after = useCanvasStore.getState().nodes
    // Reference equality, not deep equality: the injected doors' measurement
    // survives ONLY if this exact object comes back, because that is what
    // `adoptUserNodes`' `checkEquality` compares.
    expect(after).toBe(before)
  })

  it('mints a NEW nodes reference, and applies the value, when the change addresses a node it does hold', () => {
    const before = useCanvasStore.getState().nodes

    const changes: NodeChange[] = [
      { id: 'fac_b', type: 'dimensions', dimensions: { width: 230, height: 251 }, resizing: false } as NodeChange,
    ]
    useCanvasStore.getState().onNodesChange(changes)

    const after = useCanvasStore.getState().nodes
    expect(after).not.toBe(before)
    const measured = (after.find((n) => n.id === 'fac_b') as { measured?: { width?: number; height?: number } }).measured
    expect(measured).toEqual({ width: 230, height: 251 })
    // The untouched member is still the very same object — `applyNodeChanges`
    // copies only what it changed, which is what makes the reference test above
    // a precise question rather than an approximation.
    expect(after.find((n) => n.id === 'opt_a')).toBe(before.find((n) => n.id === 'opt_a'))
  })

  it('mints a new reference for a mixed batch — one unowned id must not mask a real change', () => {
    const before = useCanvasStore.getState().nodes

    useCanvasStore.getState().onNodesChange([
      { id: '__unowned__', type: 'dimensions', dimensions: { width: 132, height: 64 }, resizing: false },
      { id: 'opt_a', type: 'position', position: { x: 42, y: 7 } },
    ] as NodeChange[])

    const after = useCanvasStore.getState().nodes
    expect(after).not.toBe(before)
    expect(after.find((n) => n.id === 'opt_a')?.position).toEqual({ x: 42, y: 7 })
  })

  it('still applies a selection change, and still reconciles the store selection', () => {
    const before = useCanvasStore.getState().nodes

    useCanvasStore.getState().onNodesChange([
      { id: 'opt_a', type: 'select', selected: true },
    ] as NodeChange[])

    const after = useCanvasStore.getState().nodes
    expect(after).not.toBe(before)
    expect(after.find((n) => n.id === 'opt_a')?.selected).toBe(true)
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['opt_a'])
  })
})
