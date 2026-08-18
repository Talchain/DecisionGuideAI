/**
 * structuralDelete — the durable removal's pure core.
 *
 * Every case here binds by IDENTITY (exact id, exact endpoint pair), never by a
 * value predicate another element could satisfy, and every behaviour carries its
 * OPPOSITE-DIRECTION TWIN: a delete that must be honoured beside one that must
 * be refused, a hash that is present beside one that is absent, a receipt that
 * proves beside one that refutes.
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import {
  STRUCTURAL_DELETE_NOTICE,
  buildStructuralDeleteWirePayload,
  captureStructuralDelete,
  isCanonicalEndpointId,
  readStructuralDeleteReceipt,
  revertStructuralDelete,
  type StructuralDeleteIntent,
} from '../structuralDelete'
import type { EdgeData } from '../../domain/edges'

const HASH = 'f3d31f75957c5cb5'

function node(id: string): Node {
  return { id, type: 'factor', position: { x: 10, y: 20 }, data: { label: id } }
}
function edge(id: string, source: string, target: string): Edge<EdgeData> {
  return { id, source, target, data: {} as EdgeData }
}

/** goal ← option_a, goal ← factor_cost, option_a ← factor_cost */
function graph(): { nodes: Node[]; edges: Edge<EdgeData>[] } {
  return {
    nodes: [node('goal'), node('option_a'), node('option_b'), node('factor_cost')],
    edges: [
      edge('e-0', 'option_a', 'goal'),
      edge('e-1', 'factor_cost', 'goal'),
      edge('e-2', 'factor_cost', 'option_a'),
    ],
  }
}

function capture(over: Partial<Parameters<typeof captureStructuralDelete>[0]> = {}) {
  const g = graph()
  return captureStructuralDelete({
    nodesBefore: g.nodes,
    edgesBefore: g.edges,
    removedNodeIds: [],
    removedEdgeIds: [],
    baseGraphHash: HASH,
    externalMutationActive: false,
    makeId: () => 'intent-1',
    ...over,
  })
}

// ---------------------------------------------------------------------------
// capture — the base hash, both directions
// ---------------------------------------------------------------------------

describe('captureStructuralDelete — the stale gate is non-optional (twin: present / absent)', () => {
  it('HONOURS a gesture when CEE has stamped a graph_hash, echoing it VERBATIM', () => {
    const result = capture({ removedNodeIds: ['option_b'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Verbatim, not recomputed: the contract calls this "an optimistic-
    // concurrency assertion, never a requested value".
    expect(result.intent.baseGraphHash).toBe(HASH)
    expect(result.intent.removedNodeIds).toEqual(['option_b'])
  })

  it('STANDS DOWN when no CEE graph_hash has been seen — never fabricates one', () => {
    const result = capture({ removedNodeIds: ['option_b'], baseGraphHash: null })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('no_server_graph_hash')
  })

  it('STANDS DOWN on an empty-string hash — absent, null and empty are all forbidden', () => {
    const result = capture({ removedNodeIds: ['option_b'], baseGraphHash: '' })
    expect(result.ok).toBe(false)
  })

  it('STANDS DOWN on a producer-driven mutation, so CEE never hears its own write back', () => {
    const result = capture({ removedNodeIds: ['option_b'], externalMutationActive: true })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('external_mutation')
  })

  it('STANDS DOWN when the gesture resolves to nothing — the contract refuses an empty delete', () => {
    const result = capture({ removedNodeIds: ['not-on-this-canvas'] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('nothing_removed')
  })
})

// ---------------------------------------------------------------------------
// capture — atomicity and the server-owned cascade
// ---------------------------------------------------------------------------

describe('captureStructuralDelete — ONE payload per gesture, cascade left to CEE', () => {
  it('puts a multi-select delete in ONE intent, not N', () => {
    const result = capture({ removedNodeIds: ['option_a', 'option_b'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.intent.removedNodeIds).toEqual(['option_a', 'option_b'])
  })

  it('ELIDES edges incident to a removed node — `applyRemoveNode` owns that cascade', () => {
    // option_a carries e-0 (option_a→goal) and e-2 (factor_cost→option_a).
    const result = capture({ removedNodeIds: ['option_a'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.intent.removedEdges).toEqual([])
    // …but the revert still holds them: a refusal must put the WHOLE gesture back.
    expect(result.intent.restore.edges.map((e) => e.id).sort()).toEqual(['e-0', 'e-2'])
  })

  it('ELIDES an incident edge the user ALSO selected — one op, not a duplicate', () => {
    const result = capture({ removedNodeIds: ['option_a'], removedEdgeIds: ['e-0'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.intent.removedEdges).toEqual([])
  })

  it('KEEPS an edge removed INDEPENDENTLY of any node, addressed by (from, to)', () => {
    const result = capture({ removedEdgeIds: ['e-1'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Endpoint pair, never the client-local id — `EdgeV3Schema` declares none.
    expect(result.intent.removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
    expect(JSON.stringify(result.intent.removedEdges)).not.toContain('e-1')
  })

  it('claims the canvas ids of BOTH the named and the cascaded edges', () => {
    const result = capture({ removedNodeIds: ['option_a'], removedEdgeIds: ['e-1'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect([...result.intent.claimedEdgeIds].sort()).toEqual(['e-0', 'e-1', 'e-2'])
    expect(result.intent.claimedNodeIds).toEqual(['option_a'])
  })
})

// ---------------------------------------------------------------------------
// the contract's endpoint-id rules, both directions
// ---------------------------------------------------------------------------

describe('isCanonicalEndpointId — the producer schema, both directions', () => {
  it('ACCEPTS an exact non-blank id', () => {
    expect(isCanonicalEndpointId('factor_cost')).toBe(true)
  })
  it.each([
    ['empty', ''],
    ['leading space', ' factor_cost'],
    ['trailing space', 'factor_cost '],
    ['arrow composite', 'factor_cost→goal'],
    ['ascii composite', 'factor_cost->goal'],
    ['not a string', 42 as unknown as string],
  ])('REFUSES %s', (_label, value) => {
    expect(isCanonicalEndpointId(value)).toBe(false)
  })

  it('drops a delimiter-bearing edge rather than retargeting silently', () => {
    const g = graph()
    g.edges.push(edge('e-bad', 'a→b', 'goal'))
    const result = captureStructuralDelete({
      nodesBefore: g.nodes,
      edgesBefore: g.edges,
      removedNodeIds: [],
      removedEdgeIds: ['e-bad', 'e-1'],
      baseGraphHash: HASH,
      externalMutationActive: false,
      makeId: () => 'intent-1',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.intent.removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
  })
})

// ---------------------------------------------------------------------------
// the wire payload
// ---------------------------------------------------------------------------

describe('buildStructuralDeleteWirePayload', () => {
  it('emits the contract field names, with the hash', () => {
    const result = capture({ removedNodeIds: ['option_b'], removedEdgeIds: ['e-1'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(buildStructuralDeleteWirePayload(result.intent)).toEqual({
      removed_node_ids: ['option_b'],
      removed_edges: [{ from: 'factor_cost', to: 'goal' }],
      base_graph_hash: HASH,
    })
  })
})

// ---------------------------------------------------------------------------
// the receipt — three states, never two
// ---------------------------------------------------------------------------

const intent: StructuralDeleteIntent = {
  id: 'i1',
  removedNodeIds: ['option_b'],
  removedEdges: [{ from: 'factor_cost', to: 'goal' }],
  baseGraphHash: HASH,
  claimedNodeIds: ['option_b'],
  claimedEdgeIds: ['e-1'],
  restore: { nodes: [node('option_b')], edges: [edge('e-1', 'factor_cost', 'goal')] },
}

describe('readStructuralDeleteReceipt — absence in the COMMITTED graph is the proof', () => {
  it('PROVEN when draft_graph contains neither the node nor the edge pair', () => {
    expect(
      readStructuralDeleteReceipt(intent, {
        draft_graph: {
          nodes: [{ id: 'goal' }, { id: 'option_a' }],
          edges: [{ from: 'option_a', to: 'goal' }],
        },
      }),
    ).toBe('proven')
  })

  it('REFUTED when the node is still in the committed bytes (twin of the above)', () => {
    expect(
      readStructuralDeleteReceipt(intent, {
        draft_graph: {
          nodes: [{ id: 'goal' }, { id: 'option_b' }],
          edges: [],
        },
      }),
    ).toBe('refuted')
  })

  it('REFUTED when the EDGE PAIR survives even though the node went', () => {
    expect(
      readStructuralDeleteReceipt(intent, {
        draft_graph: { nodes: [{ id: 'goal' }], edges: [{ from: 'factor_cost', to: 'goal' }] },
      }),
    ).toBe('refuted')
  })

  it('does NOT accept a DIFFERENT element having gone as evidence about ours', () => {
    // option_a is absent; option_b — the one we asked to remove — is not.
    expect(
      readStructuralDeleteReceipt(intent, {
        draft_graph: { nodes: [{ id: 'goal' }, { id: 'option_b' }], edges: [] },
      }),
    ).toBe('refuted')
  })

  it('reads a source/target-shaped edge as the same identity (adapter tolerance)', () => {
    expect(
      readStructuralDeleteReceipt(intent, {
        draft_graph: { nodes: [], edges: [{ source: 'factor_cost', target: 'goal' }] },
      }),
    ).toBe('refuted')
  })

  it.each([
    ['no draft_graph at all (a refusal, or a withheld success)', {}],
    ['draft_graph present but not an object', { draft_graph: 'nope' }],
    ['draft_graph without arrays', { draft_graph: { nodes: null, edges: null } }],
    ['no response at all', undefined],
  ])('UNPROVEN on %s — an unknown is never promoted to either verdict', (_label, response) => {
    expect(readStructuralDeleteReceipt(intent, response)).toBe('unproven')
  })
})

// ---------------------------------------------------------------------------
// the revert — stand-down discipline
// ---------------------------------------------------------------------------

describe('revertStructuralDelete', () => {
  function store(nodes: Node[], edges: Edge<EdgeData>[], scenarioId: string | null = 's1') {
    const applied: { nodes: readonly Node[]; edges: readonly Edge<EdgeData>[] }[] = []
    return {
      applied,
      store: {
        nodes,
        edges,
        currentScenarioId: scenarioId,
        applyStructuralDeleteRevert: (r: {
          nodes: readonly Node[]
          edges: readonly Edge<EdgeData>[]
        }) => {
          applied.push(r)
        },
      },
    }
  }

  it('RESTORES the removed node and its edge, by identity', () => {
    const s = store([node('goal'), node('factor_cost')], [])
    expect(revertStructuralDelete(intent, s.store, 's1')).toBe('restored')
    expect(s.applied).toHaveLength(1)
    expect(s.applied[0].nodes.map((n) => n.id)).toEqual(['option_b'])
    expect(s.applied[0].edges.map((e) => e.id)).toEqual(['e-1'])
  })

  it('STANDS DOWN once the scenario has moved on — never writes into another decision', () => {
    const s = store([node('goal')], [], 's2')
    expect(revertStructuralDelete(intent, s.store, 's1')).toBe('stood_down')
    expect(s.applied).toHaveLength(0)
  })

  it('reports ALREADY_PRESENT and writes nothing when the element is back', () => {
    const s = store(
      [node('goal'), node('factor_cost'), node('option_b')],
      [edge('e-1', 'factor_cost', 'goal')],
    )
    expect(revertStructuralDelete(intent, s.store, 's1')).toBe('already_present')
    expect(s.applied).toHaveLength(0)
  })

  it('never restores an edge whose endpoints are absent — no locally-made dangling edge', () => {
    // factor_cost is gone from the canvas and is not being restored by this
    // intent, so restoring e-1 would leave an edge pointing at nothing.
    const s = store([node('goal')], [])
    expect(revertStructuralDelete(intent, s.store, 's1')).toBe('restored')
    expect(s.applied[0].edges).toEqual([])
    expect(s.applied[0].nodes.map((n) => n.id)).toEqual(['option_b'])
  })
})

// ---------------------------------------------------------------------------
// the copy — P8: never prescribe an action the system cannot honour
// ---------------------------------------------------------------------------

describe('STRUCTURAL_DELETE_NOTICE', () => {
  it('the diverged-base copy names RELOAD, never a bare retry of the same payload', () => {
    const copy = STRUCTURAL_DELETE_NOTICE.base_hash_diverged
    expect(copy).toContain('Reload')
    expect(copy.toLowerCase()).not.toMatch(/\btry again\b/)
  })

  it('the diverged-base copy states the removal did NOT happen', () => {
    expect(STRUCTURAL_DELETE_NOTICE.base_hash_diverged).toContain('nothing was removed')
  })

  it('the unconfirmed copies claim only that we could not confirm — never success, never failure', () => {
    for (const key of ['unconfirmed_server', 'unconfirmed_transport'] as const) {
      const copy = STRUCTURAL_DELETE_NOTICE[key]
      expect(copy.toLowerCase()).toMatch(/may|couldn't confirm|didn't reach/)
      expect(copy).not.toContain('Removed ')
    }
  })
})
