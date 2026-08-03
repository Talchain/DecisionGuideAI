/**
 * mergeServerGraphOnHydrate — RED-first spec (ROADMAP 2.312 piece 3).
 *
 * Merge-on-hydrate: VALUES FROM THE SERVER, LAYOUT FROM LOCAL. The server
 * response carries no geometry at all (`layout_present` is measured false for
 * every real `scenarios.graph`), so every position on screen after this merge
 * must be the one the local canvas already held, bound to the node that held
 * it — not the first position in the array, not a re-layout, not {0,0}.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'

const A_POS = { x: 10, y: 20 }
const B_POS = { x: 300, y: 400 }

function seed(nodes: unknown[], edges: unknown[] = []): void {
  useCanvasStore.setState({
    currentScenarioId: '11111111-2222-4333-8444-555555555555',
    nodes: structuredClone(nodes) as never,
    edges: structuredClone(edges) as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    history: { past: [], future: [] },
  } as never)
}

function localNodes() {
  return [
    {
      id: 'factor-1',
      type: 'factor',
      position: { ...A_POS },
      width: 180,
      selected: false,
      data: { label: 'Spend', kind: 'factor', value: 100 },
    },
    {
      id: 'goal-1',
      type: 'goal',
      position: { ...B_POS },
      width: 200,
      selected: false,
      data: { label: 'Profit', kind: 'goal', value: 5 },
    },
  ]
}

function nodeById(id: string): any {
  return useCanvasStore.getState().nodes.find((n: any) => n.id === id)
}

beforeEach(() => {
  seed(localNodes())
})

describe('mergeServerGraphOnHydrate — values from server, layout from local', () => {
  it('hydrates server VALUES onto the local canvas', () => {
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
      ],
      edges: [],
    })
    expect(res.updatedNodeCount).toBe(2)
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('goal-1').data.value).toBe(9)
  })

  it('binds each server node to the node with the SAME ID, never the same INDEX', () => {
    // The server array is deliberately the REVERSE of the canvas array.
    //
    // ⚠ ASSERT THE VALUES, NOT ONLY THE POSITIONS. An index-matched merge was
    // written as a mutant and SURVIVED a position-only version of this test —
    // and it survived for a structural reason worth recording: `overlayNode`
    // spreads the EXISTING node first, so the position is preserved no matter
    // WHICH server node it is handed. Layout is immune to the mis-binding; the
    // VALUES are what get crossed. A position-only assertion here was therefore
    // testing the one property the defect cannot disturb.
    mergeServerGraphOnHydrate({
      nodes: [
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
      ],
      edges: [],
    })
    // Values land on the node whose ID they name…
    expect(nodeById('factor-1').data.value).toBe(250)
    expect(nodeById('factor-1').data.label).toBe('Spend')
    expect(nodeById('goal-1').data.value).toBe(9)
    expect(nodeById('goal-1').data.label).toBe('Profit')
    // …and each node keeps its own layout.
    expect(nodeById('factor-1').position).toEqual(A_POS)
    expect(nodeById('goal-1').position).toEqual(B_POS)
  })

  it('preserves every other canvas-owned root field (width, selected)', () => {
    mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
      edges: [],
    })
    expect(nodeById('factor-1').width).toBe(180)
    expect(nodeById('factor-1').selected).toBe(false)
  })

  it('MUTANT GUARD — server-supplied positions NEVER clobber local layout', () => {
    // `scenarios.graph` carries no geometry today; if a future write ever put
    // some there, it must still lose to the canvas. This is the assertion that
    // goes RED if the merge is ever rewritten to spread the server node last.
    mergeServerGraphOnHydrate({
      nodes: [
        {
          id: 'factor-1',
          kind: 'factor',
          label: 'Spend',
          value: 250,
          position: { x: -999, y: -999 },
          x: -999,
          y: -999,
        },
      ],
      edges: [],
    })
    expect(nodeById('factor-1').position).toEqual(A_POS)
  })
})

describe('mergeServerGraphOnHydrate — additive, never destructive', () => {
  it('adds a server node the canvas does not have, without re-laying-out the rest', () => {
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'factor-2', kind: 'factor', label: 'Headcount' },
      ],
      edges: [],
    })
    expect(res.addedNodeCount).toBe(1)
    expect(nodeById('factor-2')).toBeTruthy()
    expect(nodeById('factor-1').position).toEqual(A_POS)
    expect(nodeById('goal-1').position).toEqual(B_POS)
  })

  it('hydrates a FULLY EMPTY canvas from the server graph', () => {
    seed([], [])
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend' },
        { id: 'goal-1', kind: 'goal', label: 'Profit' },
      ],
      edges: [{ id: 'e1', from: 'factor-1', to: 'goal-1' }],
    })
    expect(res.addedNodeCount).toBe(2)
    expect(res.addedEdgeCount).toBe(1)
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
  })

  it('NEVER removes a local-only node — the server graph is not a deletion oracle', () => {
    // The autosave can legitimately be AHEAD of the server (guest inspector
    // edits never reach CEE at all — ROADMAP 2.304). Boot hydration removing
    // them would trade a stale value for lost work.
    const res = mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
      edges: [],
    })
    expect(res.removedNodeCount).toBe(0)
    expect(nodeById('goal-1')).toBeTruthy()
    expect(useCanvasStore.getState().nodes).toHaveLength(2)
  })

  it('records the server graph as CEE-acknowledged (authorises LATER receipt deletions)', () => {
    mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend' }],
      edges: [],
    })
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toEqual({
      nodeIds: ['factor-1'],
      edgePairs: [],
    })
  })
})

describe('mergeServerGraphOnHydrate — honest absence', () => {
  it('an EMPTY server graph is a strict no-op — the canvas stands untouched', () => {
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({ nodes: [], edges: [] })
    expect(res).toEqual({
      addedNodeCount: 0,
      addedEdgeCount: 0,
      updatedNodeCount: 0,
      updatedEdgeCount: 0,
      removedNodeCount: 0,
      removedEdgeCount: 0,
    })
    expect(useCanvasStore.getState().nodes).toBe(before)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
  })

  it('a null / non-object graph is a strict no-op', () => {
    const before = useCanvasStore.getState().nodes
    expect(mergeServerGraphOnHydrate(null).updatedNodeCount).toBe(0)
    expect(mergeServerGraphOnHydrate(undefined).updatedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
  })

  it('a server graph identical to the canvas writes NOTHING (reference-stable)', () => {
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({
      nodes: [
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
      ],
      edges: [],
    })
    expect(res.updatedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
    // …but the READ still happened, so the acknowledged set is recorded. The
    // evidence is the read, not the write: gating this on a diff would leave
    // the set stale after the most common boot of all.
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toEqual({
      nodeIds: ['factor-1', 'goal-1'],
      edgePairs: [],
    })
  })

  it('ZERO node-id overlap with a NON-EMPTY canvas is dropped, never grafted', () => {
    const before = useCanvasStore.getState().nodes
    const res = mergeServerGraphOnHydrate({
      nodes: [{ id: 'unrelated-9', kind: 'factor', label: 'Other' }],
      edges: [],
    })
    expect(res.addedNodeCount).toBe(0)
    expect(useCanvasStore.getState().nodes).toBe(before)
    // A graph REFUSED as unrelated was never observed — it must not widen what
    // a later receipt is permitted to delete.
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
  })
})

describe('mergeServerGraphOnHydrate — boot is not an edit', () => {
  it('pushes NO history entry — there is nothing to undo to on boot', () => {
    mergeServerGraphOnHydrate({
      nodes: [{ id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 }],
      edges: [],
    })
    expect(useCanvasStore.getState().history.past).toHaveLength(0)
  })
})
