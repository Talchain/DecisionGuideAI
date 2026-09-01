/**
 * ONE GESTURE, ONE TURN — the subtraction that stops the durable add writer
 * INTRODUCING a defect while it closes one.
 *
 * ⚠⚠ WITHOUT THIS, WIRING `structural_add` MAKES THINGS WORSE IN ONE RESPECT.
 * `diffSnapshots` records a new id as `nodeOps: 'add'`, and the emitter turns
 * that into a `direct_graph_edit` with `change_type: 'add_node'`. So a single
 * add gesture would reach CEE TWICE: once as the durable write, and once as a
 * notification claiming the same node changed — and the notification half is the
 * `'ack_and_commit'` no-graph-write path the durable verb exists to REPLACE.
 * Two turns describing one gesture is the second-authority defect this estate
 * pays for most often, and the delete lane established the fix.
 *
 * ⭐ EVERY CASE SHIPS ITS OPPOSITE-DIRECTION TWIN. A subtraction that takes too
 * much silently stops reporting real producer changes; one that takes too little
 * doubles every gesture. Two different harms, one predicate.
 */

import { describe, it, expect } from 'vitest'
import { removeStructuralAddClaims } from '../useGraphEditEvents'

type Ops = 'add' | 'update' | 'remove'

function diff(nodeOps: Record<string, Ops>, edgeOps: Record<string, Ops> = {}) {
  return {
    changedNodeIds: new Set(Object.keys(nodeOps)),
    changedEdgeIds: new Set(Object.keys(edgeOps)),
    operations: new Set<Ops>([...Object.values(nodeOps), ...Object.values(edgeOps)]),
    nodeOps: new Map(Object.entries(nodeOps)),
    edgeOps: new Map(Object.entries(edgeOps)),
    fieldsChanged: new Map<string, Set<string>>(),
  } as never
}

describe('removeStructuralAddClaims', () => {
  it('⭐ drops the add the durable writer has already claimed', () => {
    const d = diff({ a: 'add' })
    removeStructuralAddClaims(d, [{ nodeId: 'a' }])
    expect([...(d as never as { changedNodeIds: Set<string> }).changedNodeIds]).toEqual([])
    // `operations` is a set of op KINDS, not ids, so it must be RE-DERIVED from
    // what survived. Leaving a stale 'add' would tell CEE an addition happened
    // that this notification no longer names.
    expect([...(d as never as { operations: Set<string> }).operations]).toEqual([])
  })

  it('⭐ TWIN — an UNCLAIMED add still reports; the subtraction is bound by ID', () => {
    // A gesture that added A while a producer added B must still report B.
    const d = diff({ a: 'add', b: 'add' })
    removeStructuralAddClaims(d, [{ nodeId: 'a' }])
    expect([...(d as never as { changedNodeIds: Set<string> }).changedNodeIds]).toEqual(['b'])
    expect([...(d as never as { operations: Set<string> }).operations]).toEqual(['add'])
  })

  it('⭐ TWIN — the OP CHECK is load-bearing: a claimed id that was REMOVED still reports', () => {
    // An id added by the gesture and removed by something else in the same
    // debounce window is a genuine REMOVAL and must survive. Subtracting on the
    // id alone would silently swallow it.
    const d = diff({ a: 'remove' })
    removeStructuralAddClaims(d, [{ nodeId: 'a' }])
    expect([...(d as never as { changedNodeIds: Set<string> }).changedNodeIds]).toEqual(['a'])
    expect([...(d as never as { operations: Set<string> }).operations]).toEqual(['remove'])
  })

  it('an UPDATE to a claimed id survives too — the add is claimed, the edit is not', () => {
    const d = diff({ a: 'update' })
    removeStructuralAddClaims(d, [{ nodeId: 'a' }])
    expect([...(d as never as { changedNodeIds: Set<string> }).changedNodeIds]).toEqual(['a'])
  })

  it('an empty claim list is a no-op — a producer diff with nothing queued is untouched', () => {
    const d = diff({ a: 'add' }, { e1: 'add' })
    removeStructuralAddClaims(d, [])
    expect([...(d as never as { changedNodeIds: Set<string> }).changedNodeIds]).toEqual(['a'])
    expect([...(d as never as { changedEdgeIds: Set<string> }).changedEdgeIds]).toEqual(['e1'])
  })

  it('EDGES are never touched — this writer claims nodes only', () => {
    // `structural_add` carries no edge. Subtracting one here would silently drop
    // a real edge change from the notification, and `structural_add_edge` has no
    // CEE writer to carry it instead.
    const d = diff({ a: 'add' }, { e1: 'add' })
    removeStructuralAddClaims(d, [{ nodeId: 'a' }])
    expect([...(d as never as { changedEdgeIds: Set<string> }).changedEdgeIds]).toEqual(['e1'])
    expect([...(d as never as { operations: Set<string> }).operations]).toEqual(['add'])
  })
})
