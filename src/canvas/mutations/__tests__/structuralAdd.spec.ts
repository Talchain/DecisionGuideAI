/**
 * `structuralAdd` — the pure half of the durable node writer.
 *
 * ⭐ EVERY CHANGED PREDICATE SHIPS ITS OPPOSITE-DIRECTION TWIN. CLAUDE.md trap
 * 22b: a corpus that tests one direction is a guard watching one door, and this
 * estate has twice shipped a fix in one direction that re-opened the defect in
 * the other under a fully green suite. So each `ok`/`refused` assertion below is
 * paired with the case that must reach the OTHER answer, and the pairs are
 * written adjacently so a later edit cannot quietly drop one.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY, never by a value predicate another object could
 * satisfy (trap 19). Where a node is located it is located by `id`, and the
 * fixtures deliberately contain a SECOND node sharing the label or the kind so
 * that a predicate binding the wrong way fails rather than passes by luck.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'

import {
  CEE_UNPERSISTABLE_NODE_KIND,
  WIRE_ADDABLE_NODE_KINDS,
  buildStructuralAddWirePayload,
  captureStructuralAdd,
  isWireUsableNewNodeId,
  readStructuralAddReceipt,
  resolveStructuralAddBase,
  revertStructuralAdd,
  type StructuralAddIntent,
} from '../structuralAdd'

const HASH = 'f3d31f75957c5cb5'
const OTHER_HASH = 'aaaa1111bbbb2222'

function node(id: string, label: string, kind = 'factor'): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { label, kind } } as Node
}

/**
 * The fixture carries a DECOY throughout: a second node with the same kind AND
 * the same label as the subject. Anything binding by kind or label rather than
 * by id will find the decoy and answer confidently about the wrong node.
 */
const SUBJECT = node('fac_new', 'Supplier risk')
const DECOY = node('fac_decoy', 'Supplier risk')

function capture(over: Partial<Parameters<typeof captureStructuralAdd>[0]> = {}) {
  return captureStructuralAdd({
    nodesAfter: [DECOY, SUBJECT],
    nodeId: 'fac_new',
    baseGraphHash: HASH,
    externalMutationActive: false,
    persistableKinds: WIRE_ADDABLE_NODE_KINDS,
    resolveKind: (n) => ((n.data as { kind?: string })?.kind ?? n.type ?? null) as string | null,
    makeId: () => 'intent-1',
    ...over,
  })
}

function intent(over: Partial<StructuralAddIntent> = {}): StructuralAddIntent {
  return {
    id: 'intent-1',
    nodeId: 'fac_new',
    nodeKind: 'factor',
    label: 'Supplier risk',
    baseGraphHash: HASH,
    ...over,
  }
}

describe('captureStructuralAdd — every stand-down has its accepting twin', () => {
  it('captures a user add, bound to the subject by ID and not to the same-labelled decoy', () => {
    const r = capture()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // BOUND BY IDENTITY: the decoy shares label AND kind, so a predicate that
    // matched either would have produced `fac_decoy` here.
    expect(r.intent.nodeId).toBe('fac_new')
    expect(r.intent.label).toBe('Supplier risk')
    expect(r.intent.nodeKind).toBe('factor')
    expect(r.intent.baseGraphHash).toBe(HASH)
    expect(r.deferred).toBe(false)
  })

  it('TWIN — a producer write stands down; the identical gesture from a user does not', () => {
    expect(capture({ externalMutationActive: true })).toEqual({
      ok: false,
      reason: 'external_mutation',
    })
    // The twin: same input, external flag off.
    expect(capture({ externalMutationActive: false }).ok).toBe(true)
  })

  it('TWIN — an absent node stands down; a present one is captured', () => {
    expect(capture({ nodeId: 'fac_missing' })).toEqual({ ok: false, reason: 'node_not_found' })
    expect(capture({ nodeId: 'fac_new' }).ok).toBe(true)
  })

  it('TWIN — an unpersistable kind stands down BEFORE the wire; a persistable one goes', () => {
    // `constraint` clears CEE's INGRESS (it is one of NodeKind's 8 members) and
    // is refused server-side with a COMMITTED 200: a turn spent, a commit
    // performed, no node written. (The refusal happens BEFORE the persistence
    // writer — the payload never reaches it.) Standing down here costs nothing.
    const constrained = node('c_1', 'Budget cap', CEE_UNPERSISTABLE_NODE_KIND)
    expect(
      capture({ nodesAfter: [constrained], nodeId: 'c_1' }),
    ).toEqual({ ok: false, reason: 'unpersistable_node_kind' })

    // The twin, and it is the one that matters: every OTHER kind must pass, so
    // the guard cannot quietly become "refuse everything".
    for (const kind of WIRE_ADDABLE_NODE_KINDS) {
      const n = node(`n_${kind}`, `A ${kind}`, kind)
      const r = capture({ nodesAfter: [n], nodeId: `n_${kind}` })
      expect(r.ok, `kind "${kind}" must be addable`).toBe(true)
    }
  })

  it('TWIN — a label outside the contract bound stands down; one inside it is captured', () => {
    const empty = node('fac_e', '')
    expect(capture({ nodesAfter: [empty], nodeId: 'fac_e' })).toEqual({
      ok: false,
      reason: 'unusable_for_wire',
    })
    const tooLong = node('fac_l', 'x'.repeat(201))
    expect(capture({ nodesAfter: [tooLong], nodeId: 'fac_l' })).toEqual({
      ok: false,
      reason: 'unusable_for_wire',
    })
    // The twin: exactly at the bound is INSIDE it. An off-by-one here would
    // silently refuse a legal label.
    const atBound = node('fac_b', 'x'.repeat(200))
    expect(capture({ nodesAfter: [atBound], nodeId: 'fac_b' }).ok).toBe(true)
  })

  it('TWIN — a missing base hash DEFERS, it does not stand down', () => {
    // ⭐ THIS IS THE PAIR THAT SEPARATES THIS LANE FROM THE DESIGN IT REPLACED.
    // The first cut of the rename lane REFUSED here, which meant the first
    // gesture after opening a saved decision was silently never written. The
    // gesture must be CAPTURED, flagged deferred, and held.
    const r = capture({ baseGraphHash: null })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deferred).toBe(true)
    expect(r.intent.baseGraphHash).toBeNull()

    // The twin: with a hash present it is captured and NOT deferred.
    const withHash = capture({ baseGraphHash: HASH })
    expect(withHash.ok && withHash.deferred).toBe(false)
  })

  it('a deferred gesture still gets EVERY OTHER refusal — deferral is not an amnesty', () => {
    // A vanished node or an unpersistable kind is just as wrong held in a queue
    // as it is on the wire.
    expect(capture({ baseGraphHash: null, nodeId: 'nope' })).toEqual({
      ok: false,
      reason: 'node_not_found',
    })
    expect(capture({ baseGraphHash: null, externalMutationActive: true })).toEqual({
      ok: false,
      reason: 'external_mutation',
    })
  })
})

describe('isWireUsableNewNodeId — the NARROW mint-time pattern, not the rename twin', () => {
  it('accepts what the UI actually mints', () => {
    // `createNodeId()` returns `String(nextNodeId)`.
    expect(isWireUsableNewNodeId('7')).toBe(true)
    expect(isWireUsableNewNodeId('fac_supplier_risk')).toBe(true)
    expect(isWireUsableNewNodeId('opt:a-1')).toBe(true)
  })

  it('TWIN — refuses exactly what `NodeV3Schema.shape.id` refuses, and the twin proves it is not refusing everything', () => {
    // These 422 the WHOLE turn at CEE ingress if they reach the wire.
    expect(isWireUsableNewNodeId('Fac_Upper')).toBe(false) // uppercase
    expect(isWireUsableNewNodeId('fac.dotted')).toBe(false) // dot
    expect(isWireUsableNewNodeId('fac spaced')).toBe(false) // space
    expect(isWireUsableNewNodeId('')).toBe(false)
    expect(isWireUsableNewNodeId('x'.repeat(101))).toBe(false) // max(100)
    expect(isWireUsableNewNodeId(null)).toBe(false)
    // The twin at the exact bound — 100 is INSIDE.
    expect(isWireUsableNewNodeId('x'.repeat(100))).toBe(true)
  })
})

describe('resolveStructuralAddBase', () => {
  it('stamps the current hash onto a DEFERRED intent', () => {
    const resolved = resolveStructuralAddBase(intent({ baseGraphHash: null }), HASH)
    expect(resolved?.baseGraphHash).toBe(HASH)
  })

  it('TWIN — an intent captured WITH a hash keeps its own, never the fresher one', () => {
    // It asserts the graph the gesture was made against, which is strictly
    // better evidence than "now".
    const resolved = resolveStructuralAddBase(intent({ baseGraphHash: OTHER_HASH }), HASH)
    expect(resolved?.baseGraphHash).toBe(OTHER_HASH)
  })

  it('refuses rather than returning a partial intent when no hash exists at all', () => {
    expect(resolveStructuralAddBase(intent({ baseGraphHash: null }), null)).toBeNull()
    expect(resolveStructuralAddBase(intent({ baseGraphHash: null }), '')).toBeNull()
  })
})

describe('buildStructuralAddWirePayload — FOUR keys, and there is no fifth', () => {
  it('emits exactly the contract member, with no value of any kind', () => {
    const payload = buildStructuralAddWirePayload({ ...intent(), baseGraphHash: HASH })
    // ⭐⭐ THE EXACT KEY SET, asserted as a SET rather than by spot-checking
    // fields. A spot check passes while an extra key rides along; the member is
    // `.strict()`, so an extra key does not get dropped — it 422s the turn. And
    // an extra VALUE key would be the fabrication this whole lane exists to
    // prevent.
    expect(Object.keys(payload).sort()).toEqual([
      'base_graph_hash',
      'label',
      'node_id',
      'node_kind',
    ])
    expect(payload).toEqual({
      node_id: 'fac_new',
      node_kind: 'factor',
      label: 'Supplier risk',
      base_graph_hash: HASH,
    })
  })
})

describe('readStructuralAddReceipt — the hash discriminator, and absence as refutation', () => {
  it('proven — the committed graph carries THIS id', () => {
    expect(
      readStructuralAddReceipt(intent(), {
        draft_graph: { nodes: [{ id: 'fac_other' }, { id: 'fac_new' }] },
      }),
    ).toBe('proven')
  })

  it('TWIN — a readable graph WITHOUT this id refutes, where the rename twin would say unproven', () => {
    // The claim we made is PRESENCE, so a readable graph lacking this id
    // contradicts exactly what we asserted. `readStructuralRenameReceipt`
    // answers `unproven` for the same shape, because a rename's claim is about
    // a LABEL and a missing node is a different event entirely.
    expect(
      readStructuralAddReceipt(intent(), { draft_graph: { nodes: [{ id: 'fac_other' }] } }),
    ).toBe('refuted')
  })

  it('does NOT accept a same-labelled stranger as evidence for our node', () => {
    // Bound by identity: another node having appeared is not evidence about
    // ours, however similar it looks.
    expect(
      readStructuralAddReceipt(intent(), {
        draft_graph: { nodes: [{ id: 'fac_decoy', label: 'Supplier risk', kind: 'factor' }] },
      }),
    ).toBe('refuted')
  })

  it('⭐ refutes on an UNMOVED hash — the arm that makes real refusals legible', () => {
    // ⚠ THIS IS THE ARM THE OBVIOUS DESIGN GETS WRONG. `draft_graph` is stamped
    // on SUCCESS ARMS ONLY, so every genuine refusal arrives WITHOUT a graph.
    // A receipt keyed on graph-absence alone would answer `unproven` forever on
    // the one outcome the user most needs told. An add that lands necessarily
    // moves CEE's analysis hash, so an unmoved hash proves nothing was written.
    expect(readStructuralAddReceipt(intent(), { graph_hash: HASH, assistant_text: 'nope' })).toBe(
      'refuted',
    )
  })

  it('TWIN — a MOVED hash is NOT evidence of success; it is unproven', () => {
    // The inference runs in exactly one direction, and this is the safe half: a
    // hash that moved proves only that SOMETHING changed, never that it was
    // ours. Answering `proven` here would leave a user believing a node saved
    // when a concurrent turn had moved the hash.
    expect(readStructuralAddReceipt(intent(), { graph_hash: OTHER_HASH })).toBe('unproven')
  })

  it('unproven when there is no evidence at all — never a verdict invented from silence', () => {
    expect(readStructuralAddReceipt(intent(), {})).toBe('unproven')
    expect(readStructuralAddReceipt(intent(), null)).toBe('unproven')
    expect(readStructuralAddReceipt(intent(), { draft_graph: { nodes: 'not-an-array' } })).toBe(
      'unproven',
    )
    // A deferred intent that somehow reached here has no base to compare.
    expect(
      readStructuralAddReceipt(intent({ baseGraphHash: null }), { graph_hash: HASH }),
    ).toBe('unproven')
  })

  it('a readable graph OUTRANKS the hash — success is read from the bytes, not inferred', () => {
    // Both signals present and disagreeing: the graph carries our node while the
    // hash reads unmoved. The bytes win.
    expect(
      readStructuralAddReceipt(intent(), {
        draft_graph: { nodes: [{ id: 'fac_new' }] },
        graph_hash: HASH,
      }),
    ).toBe('proven')
  })
})

describe('revertStructuralAdd — the only revert in the family that DESTROYS', () => {
  function store(nodes: Node[], edges: { source?: string; target?: string }[] = []) {
    const removed: string[] = []
    return {
      removed,
      s: {
        nodes,
        edges,
        currentScenarioId: 'scn-1',
        applyStructuralAddRevert: ({ nodeId }: { nodeId: string }) => removed.push(nodeId),
      },
    }
  }
  const kindOf = (n: Node) => ((n.data as { kind?: string })?.kind ?? n.type ?? null) as string | null

  it('removes the node this gesture created', () => {
    const { removed, s } = store([DECOY, SUBJECT])
    expect(revertStructuralAdd(intent(), s, 'scn-1', kindOf)).toBe('removed')
    // BOUND BY IDENTITY — the same-labelled decoy must survive.
    expect(removed).toEqual(['fac_new'])
  })

  it('TWIN — stands down when the scenario has moved on, and removes nothing', () => {
    const { removed, s } = store([SUBJECT])
    expect(revertStructuralAdd(intent(), s, 'scn-OTHER', kindOf)).toBe('stood_down')
    expect(removed).toEqual([])
  })

  it('TWIN — stands down when the user has RENAMED it since; the matching case removes', () => {
    const renamed = node('fac_new', 'Supplier concentration')
    const a = store([renamed])
    expect(revertStructuralAdd(intent(), a.s, 'scn-1', kindOf)).toBe('stood_down')
    expect(a.removed).toEqual([])

    const b = store([SUBJECT])
    expect(revertStructuralAdd(intent(), b.s, 'scn-1', kindOf)).toBe('removed')
  })

  it('TWIN — stands down when the KIND has changed; the matching kind removes', () => {
    // A node retyped from factor to option is a different assertion than the
    // one the server refused.
    const retyped = node('fac_new', 'Supplier risk', 'option')
    const a = store([retyped])
    expect(revertStructuralAdd(intent(), a.s, 'scn-1', kindOf)).toBe('stood_down')
    expect(a.removed).toEqual([])
  })

  it('⭐ stands down when the node has been CONNECTED — never destroys an edge it did not create', () => {
    // The add was refused, but removing the node now would take an edge the user
    // drew with it. That is the data-loss direction of the same harm, so the
    // node stays and `useConversation` says exactly that instead.
    const a = store([SUBJECT], [{ source: 'fac_new', target: 'out_1' }])
    expect(revertStructuralAdd(intent(), a.s, 'scn-1', kindOf)).toBe('stood_down_connected')
    expect(a.removed).toEqual([])

    // Inbound edges count too — direction is not the question.
    const b = store([SUBJECT], [{ source: 'dec_1', target: 'fac_new' }])
    expect(revertStructuralAdd(intent(), b.s, 'scn-1', kindOf)).toBe('stood_down_connected')

    // TWIN: an edge between two OTHER nodes is not our business and must not
    // block the removal.
    const c = store([SUBJECT], [{ source: 'a', target: 'b' }])
    expect(revertStructuralAdd(intent(), c.s, 'scn-1', kindOf)).toBe('removed')
  })

  it('already_absent is not an error — the node is gone, which is what we wanted', () => {
    const { removed, s } = store([DECOY])
    expect(revertStructuralAdd(intent(), s, 'scn-1', kindOf)).toBe('already_absent')
    expect(removed).toEqual([])
  })
})
