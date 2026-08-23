/**
 * The store's four delete actions are the ONE chokepoint every delete gesture
 * crosses — keyboard (`useKeyboardShortcuts` → `deleteSelected`), context menu
 * (`commitValidatedMutation`'s localApply → `deleteNodeById` / `deleteSelected`
 * / `deleteEdge`) and the edge inspector (`deleteEdge`). If any one of them
 * fails to record, that gesture is silently local-only again.
 *
 * These cases bind by IDENTITY (exact node ids, exact endpoint pairs) and carry
 * their opposite-direction twins: recorded vs stood-down, restored vs left.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'

const HASH = 'f3d31f75957c5cb5'

function node(id: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }
}
function edge(id: string, source: string, target: string): Edge<EdgeData> {
  return { id, source, target, data: {} as EdgeData }
}

function seed(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    nodes: [node('goal'), node('option_a'), node('option_b'), node('factor_cost')],
    edges: [
      edge('e-0', 'option_a', 'goal'),
      edge('e-1', 'factor_cost', 'goal'),
      edge('e-2', 'factor_cost', 'option_a'),
    ],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    lastServerGraphHash: HASH,
    lastAuthoritativeGraph: null,
    pendingStructuralDeletes: [],
    _externalMutationActive: 0,
    ...overrides,
  } as never)
}

function queue() {
  return useCanvasStore.getState().pendingStructuralDeletes
}

describe('the four delete gestures each record ONE durable-removal intent', () => {
  beforeEach(() => seed())

  it('deleteSelected — a multi-select goes out as ONE intent naming both ids', () => {
    useCanvasStore.setState({
      selection: {
        nodeIds: new Set(['option_a', 'option_b']),
        edgeIds: new Set<string>(),
        anchorPosition: null,
      },
    } as never)
    useCanvasStore.getState().deleteSelected()

    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedNodeIds).toEqual(['option_a', 'option_b'])
    expect(queue()[0].baseGraphHash).toBe(HASH)
    // The cascade is CEE's: option_a's incident edges are not enumerated.
    expect(queue()[0].removedEdges).toEqual([])
  })

  it('deleteNodeById — records the exact node, not whichever node sorted first', () => {
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedNodeIds).toEqual(['option_b'])
  })

  it('deleteEdgeById — records the ENDPOINT PAIR, never the client-local edge id', () => {
    useCanvasStore.getState().deleteEdgeById('e-1')
    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
    expect(JSON.stringify(queue()[0].removedEdges)).not.toContain('e-1')
  })

  it('deleteEdge (the edge inspector) — records too, or that gesture stays local-only', () => {
    useCanvasStore.getState().deleteEdge('e-2')
    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedEdges).toEqual([{ from: 'factor_cost', to: 'option_a' }])
  })

  it('captures against the PRE-delete graph — the removed element is in `restore`', () => {
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()[0].restore.nodes.map((n) => n.id)).toEqual(['option_b'])
  })
})

describe('the stand-downs (twin: recorded vs not)', () => {
  const canonicalNoHashGestures = [
    [
      'deleteSelected',
      () => {
        useCanvasStore.setState({
          selection: {
            nodeIds: new Set(['option_b']),
            edgeIds: new Set<string>(),
            anchorPosition: null,
          },
        } as never)
        useCanvasStore.getState().deleteSelected()
      },
    ],
    ['deleteNodeById', () => useCanvasStore.getState().deleteNodeById('option_b')],
    ['deleteEdgeById', () => useCanvasStore.getState().deleteEdgeById('e-1')],
    ['deleteEdge', () => useCanvasStore.getState().deleteEdge('e-1')],
    [
      'onNodesChange remove',
      () => useCanvasStore.getState().onNodesChange([{ type: 'remove', id: 'option_b' }] as never),
    ],
    [
      'onEdgesChange remove',
      () => useCanvasStore.getState().onEdgesChange([{ type: 'remove', id: 'e-1' }] as never),
    ],
  ] as const

  it.each(canonicalNoHashGestures)(
    '%s fails closed when a canonical scenario has no current graph_hash',
    (_name, act) => {
      seed({ lastServerGraphHash: null })
      const beforeNodeIds = useCanvasStore.getState().nodes.map((n) => n.id)
      const beforeEdgeIds = useCanvasStore.getState().edges.map((e) => e.id)
      const messages: string[] = []
      const onToast = (event: Event) => {
        messages.push((event as CustomEvent<{ message?: string }>).detail?.message ?? '')
      }
      window.addEventListener('topbar:show-toast', onToast)

      act()

      window.removeEventListener('topbar:show-toast', onToast)
      expect(queue()).toEqual([])
      expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(beforeNodeIds)
      expect(useCanvasStore.getState().edges.map((e) => e.id)).toEqual(beforeEdgeIds)
      expect(messages).toContain('Sync the shared model before deleting. Nothing was removed.')
    },
  )

  it('still permits a genuinely local scratch graph while making no durability claim', () => {
    seed({
      currentScenarioId: null,
      lastAuthoritativeGraph: null,
      lastServerGraphHash: null,
    })
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()).toEqual([])
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).not.toContain('option_b')
  })

  it('records NOTHING for a producer-driven removal, so CEE never hears its own write back', () => {
    seed({ _externalMutationActive: 1 })
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()).toEqual([])
  })
})

describe('takePendingStructuralDeletes — one atomic read', () => {
  it('hands over every queued gesture and empties the queue', async () => {
    seed()
    useCanvasStore.getState().deleteNodeById('option_a')
    // A tick apart, because that is what two real gestures are — two clicks
    // cannot land in one synchronous tick, and same-tick captures are folded
    // into one payload on purpose (React Flow splits one keypress in two).
    await new Promise((r) => setTimeout(r, 0))
    useCanvasStore.getState().deleteNodeById('option_b')
    const taken = useCanvasStore.getState().takePendingStructuralDeletes()
    expect(taken.map((i) => i.removedNodeIds[0])).toEqual(['option_a', 'option_b'])
    expect(queue()).toEqual([])
    // A second take cannot re-send what the first already claimed.
    expect(useCanvasStore.getState().takePendingStructuralDeletes()).toEqual([])
  })
})

describe('applyStructuralDeleteRevert — putting back what the server refused', () => {
  it('restores the element VERBATIM, layout included — the thing CEE can never return', () => {
    seed()
    // Give the node a layout CEE has never seen, delete it, then revert.
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.map((n) => (n.id === 'option_b' ? { ...n, position: { x: 123, y: 456 } } : n)),
    } as never)
    const captured = useCanvasStore.getState().nodes.find((n) => n.id === 'option_b')!
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).not.toContain('option_b')

    useCanvasStore.getState().applyStructuralDeleteRevert({ nodes: [captured], edges: [] })
    const back = useCanvasStore.getState().nodes.find((n) => n.id === 'option_b')
    expect(back?.position).toEqual({ x: 123, y: 456 })
  })

  it('is idempotent by id — a second revert does not duplicate the element', () => {
    seed()
    const n = node('option_c')
    useCanvasStore.getState().applyStructuralDeleteRevert({ nodes: [n], edges: [] })
    useCanvasStore.getState().applyStructuralDeleteRevert({ nodes: [n], edges: [] })
    expect(useCanvasStore.getState().nodes.filter((x) => x.id === 'option_c')).toHaveLength(1)
  })

  it('dirties the freshness overlay — the restored graph is not the one just analysed', () => {
    seed({ analysisFreshnessDirty: false })
    useCanvasStore.getState().applyStructuralDeleteRevert({ nodes: [node('option_c')], edges: [] })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})

describe('setLastServerGraphHash — retain on absence', () => {
  it('records a stamped hash', () => {
    seed({ lastServerGraphHash: null })
    useCanvasStore.getState().setLastServerGraphHash('abcdef0123456789')
    expect(useCanvasStore.getState().lastServerGraphHash).toBe('abcdef0123456789')
  })

  it('an empty value NEVER clears a good base — absence is not evidence it stopped being true', () => {
    seed()
    useCanvasStore.getState().setLastServerGraphHash('')
    useCanvasStore.getState().setLastServerGraphHash(null as unknown as string)
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(HASH)
  })
})

// ---------------------------------------------------------------------------
// React Flow's BUILT-IN delete — paths 5 and 6 of the six-path manifest.
//
// ⚠ THESE EXIST BECAUSE THE ORIGINAL MANIFEST SAID FOUR AND WAS WRONG. No
// `deleteKeyCode` prop is set on `<ReactFlow>`, so its default Backspace/Delete
// binding is live, and `onEdgesChange`'s own comment already recorded that
// built-in edge removals *"reach the store ONLY through this handler — they
// never go through deleteEdgeById / deleteSelected"*. The app's own shortcut
// listener is on `window` (bubble phase) while React Flow's sits nearer the
// event target, so on a keypress React Flow's handler plausibly runs FIRST and
// `deleteSelected` then finds nothing selected. Covering both handlers removes
// the need to be right about that ordering.
// ---------------------------------------------------------------------------

describe("React Flow's built-in delete records too", () => {
  beforeEach(() => seed())

  it('onNodesChange remove — records the node, leaving the cascade to CEE', () => {
    useCanvasStore.getState().onNodesChange([{ type: 'remove', id: 'option_a' }] as never)
    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedNodeIds).toEqual(['option_a'])
    expect(queue()[0].removedEdges).toEqual([])
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).not.toContain('option_a')
  })

  it('onEdgesChange remove — records the ENDPOINT PAIR', () => {
    useCanvasStore.getState().onEdgesChange([{ type: 'remove', id: 'e-1' }] as never)
    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
  })

  it('the node half and the edge half of ONE keypress become ONE payload', () => {
    // The shape React Flow actually produces: two synchronous store callbacks
    // for one Delete press. Two intents here would mean two turns, and the
    // second is refused by construction — the first commit moves the hash.
    const store = useCanvasStore.getState()
    store.onNodesChange([{ type: 'remove', id: 'option_a' }] as never)
    store.onEdgesChange([{ type: 'remove', id: 'e-1' }] as never)

    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedNodeIds).toEqual(['option_a'])
    expect(queue()[0].removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
  })

  it('an incident edge arriving after its node went is NOT named (it would be unresolvable)', () => {
    const store = useCanvasStore.getState()
    store.onNodesChange([{ type: 'remove', id: 'option_a' }] as never)
    // e-0 is option_a→goal; its endpoint is already gone from the store.
    store.onEdgesChange([{ type: 'remove', id: 'e-0' }] as never)

    expect(queue()).toHaveLength(1)
    expect(queue()[0].removedNodeIds).toEqual(['option_a'])
    expect(queue()[0].removedEdges).toEqual([])
  })

  it('a LATER tick is a SEPARATE gesture and gets its own payload (twin: not folded)', async () => {
    useCanvasStore.getState().onNodesChange([{ type: 'remove', id: 'option_a' }] as never)
    // Let the tick close — the fold window is one synchronous tick, deliberately.
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    useCanvasStore.getState().onNodesChange([{ type: 'remove', id: 'option_b' }] as never)

    expect(queue()).toHaveLength(2)
    expect(queue()[0].removedNodeIds).toEqual(['option_a'])
    expect(queue()[1].removedNodeIds).toEqual(['option_b'])
  })

  it('a non-remove change batch records nothing', () => {
    useCanvasStore.getState().onNodesChange([{ type: 'select', id: 'option_a', selected: true }] as never)
    expect(queue()).toEqual([])
  })
})
