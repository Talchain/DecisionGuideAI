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
  it('records NOTHING when CEE has stamped no graph_hash — no fabricated base', () => {
    seed({ lastServerGraphHash: null })
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()).toEqual([])
    // …and the deletion still happened locally: the fallback is preserved.
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).not.toContain('option_b')
  })

  it('records NOTHING for a producer-driven removal, so CEE never hears its own write back', () => {
    seed({ _externalMutationActive: 1 })
    useCanvasStore.getState().deleteNodeById('option_b')
    expect(queue()).toEqual([])
  })
})

describe('takePendingStructuralDeletes — one atomic read', () => {
  it('hands over every queued gesture and empties the queue', () => {
    seed()
    useCanvasStore.getState().deleteNodeById('option_a')
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
