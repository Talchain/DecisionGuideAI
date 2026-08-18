/**
 * structuralDelete — the durable removal's pure core.
 *
 * Every case here binds by IDENTITY (exact id, exact endpoint pair), never by a
 * value predicate another element could satisfy, and every behaviour carries its
 * OPPOSITE-DIRECTION TWIN: a delete that must be honoured beside one that must
 * be refused, a hash that is present beside one that is absent, a receipt that
 * proves beside one that refutes.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import {
  STRUCTURAL_DELETE_NOTICE,
  buildStructuralDeleteWirePayload,
  captureStructuralDelete,
  isCanonicalEndpointId,
  mergeStructuralDeleteIntents,
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
    // ⚠ THE COMPOSITE-ID NODE IS PRESENT ON PURPOSE. A later guard elides any
    // edge whose endpoints are not in the pre-delete graph, and without this
    // node that guard would drop `e-bad` first — the test would still pass while
    // testing nothing about the composite rule, and the composite mutant would
    // read as equivalent. Putting the node on the canvas leaves the composite
    // check as the only thing that can reject this edge.
    g.nodes.push(node('a→b'))
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

  it('drops an edge whose ENDPOINT the graph no longer holds — never an unresolvable name', () => {
    // The split-callback shape: React Flow removed the node through
    // `onNodesChange`, so by the time the edge half arrives its endpoint is
    // already gone. CEE would refuse the WHOLE removal on such a name.
    const g = graph()
    g.edges.push(edge('e-orphan', 'already_gone', 'goal'))
    const result = captureStructuralDelete({
      nodesBefore: g.nodes,
      edgesBefore: g.edges,
      removedNodeIds: [],
      removedEdgeIds: ['e-orphan', 'e-1'],
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
// same-tick coalescing — ONE gesture, ONE payload, across TWO callbacks
// ---------------------------------------------------------------------------

describe('mergeStructuralDeleteIntents — React Flow splits one keypress in two', () => {
  const base = (over: Partial<StructuralDeleteIntent>): StructuralDeleteIntent => ({
    id: 'i1',
    removedNodeIds: [],
    removedEdges: [],
    baseGraphHash: HASH,
    claimedNodeIds: [],
    claimedEdgeIds: [],
    restore: { nodes: [], edges: [] },
    ...over,
  })

  it('folds the node half and the edge half into ONE payload', () => {
    const merged = mergeStructuralDeleteIntents(
      base({ id: 'first', removedNodeIds: ['option_a'], claimedNodeIds: ['option_a'] }),
      base({
        id: 'second',
        removedEdges: [{ from: 'factor_cost', to: 'goal' }],
        claimedEdgeIds: ['e-1'],
      }),
    )
    expect(merged.id).toBe('first')
    expect(merged.removedNodeIds).toEqual(['option_a'])
    expect(merged.removedEdges).toEqual([{ from: 'factor_cost', to: 'goal' }])
    expect(merged.claimedEdgeIds).toEqual(['e-1'])
  })

  it('RE-ELIDES an edge the folded-in node removal now cascades away', () => {
    // Independent when the edge half was captured; cascade-redundant once the
    // node half joins it. Naming it would be the duplicate op CEE elides.
    const merged = mergeStructuralDeleteIntents(
      base({ removedEdges: [{ from: 'factor_cost', to: 'option_a' }] }),
      base({ removedNodeIds: ['option_a'] }),
    )
    expect(merged.removedNodeIds).toEqual(['option_a'])
    expect(merged.removedEdges).toEqual([])
  })

  it('REFUSES to fold across different base hashes — never one half\'s ids on the other\'s assertion', () => {
    const second = base({ id: 'second', baseGraphHash: 'deadbeefdeadbeef', removedNodeIds: ['x'] })
    const merged = mergeStructuralDeleteIntents(base({ removedNodeIds: ['option_a'] }), second)
    expect(merged).toBe(second)
  })

  it('dedupes the restore set by id so a revert cannot double-insert', () => {
    const n = { id: 'option_a', type: 'factor', position: { x: 0, y: 0 }, data: {} } as Node
    const merged = mergeStructuralDeleteIntents(
      base({ restore: { nodes: [n], edges: [] } }),
      base({ restore: { nodes: [n], edges: [] } }),
    )
    expect(merged.restore.nodes).toHaveLength(1)
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
  // P8 — the acceptance path named in the copy must be one the code implements.
  // Bound to the MECHANISM, not to a phrase: the only thing that refreshes
  // `lastServerGraphHash` is a turn response passing through `applyV5State`, so
  // the copy must ask for a turn. Both of the obvious alternatives are refusals
  // in disguise and are pinned OUT: a bare retry re-sends the same stale hash,
  // and a reload leaves the hash null so the next delete stands down silently.
  it('the diverged-base copy asks for the one thing that refreshes the base — a TURN', () => {
    const copy = STRUCTURAL_DELETE_NOTICE.base_hash_diverged
    expect(copy).toMatch(/ask me|send me|message/i)
    expect(copy.toLowerCase()).not.toMatch(/\btry again\b/)
    expect(copy).not.toMatch(/reload this decision.*delete it again/i)
  })

  it('the mechanism that copy names is the one in the code (the pin, not the phrase)', () => {
    // If `applyV5State` ever stops capturing the hash, the copy becomes a lie —
    // so the claim is pinned against the producer's source rather than trusted.
    const applicator = readFileSync(resolve(process.cwd(), 'src/v5/applyV5State.ts'), 'utf8')
    expect(applicator).toContain('setLastServerGraphHash')
    expect(applicator).toContain('graph_hash:captured')
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
