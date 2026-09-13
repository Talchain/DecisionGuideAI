/**
 * ⭐⭐ A LINK THE USER DREW REACHES THE SHARED MODEL ONCE THEY STATE ITS STRENGTH
 * — and reaches it EXACTLY ONCE.
 *
 * THE GAP THIS CLOSES. `planStructuralAddEdgeIntent` is a PURE function of
 * `(state, edgesAfter, edgeId)`, so the capture never depended on being inside
 * `addEdge`; what was missing was a SECOND CALLER. And a naive second caller is
 * unsafe, because `addEdge` consumed its capture outcome in a local variable and
 * DISCARDED it — nothing on the edge recorded that it had stood down, so a
 * re-run could not tell "never sent" from "already sent" and would double-send.
 *
 * ⛔ WHAT THIS SPEC REFUSES TO ALLOW, and it is the whole reason the marker
 * carries a REASON rather than a boolean: the retry must never SUPPLY a
 * magnitude. If nothing has stated one, the capture stands down again and the
 * receipt stays. Inventing a number to force a receipt would assert a strength
 * the user never gave — the defect this carrier exists to refuse, committed by
 * the thing built to complete it.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import type { EdgeData } from '../../domain/edges'
import {
  resolveStructuralAddEdgeBase,
  buildStructuralAddEdgeWirePayload,
} from '../../mutations/structuralAddEdge'

/** Canonical 8-hex endpoint ids — `isCanonicalEndpointId` rejects anything else. */
const A = '2891dabb'
const B = 'c12af5de'
const node = (id: string): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as Node

function seed() {
  useCanvasStore.setState({
    nodes: [node(A), node(B)],
    edges: [],
    pendingStructuralAddEdges: [],
    history: { past: [], future: [] },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    // A server graph in hand, so the capture is not merely deferred.
    lastServerGraphHash: 'srv-hash-1',
    currentScenarioId: 'scenario-1',
    _externalMutationActive: 0,
  } as never)
}

const drawnEdgeId = () => useCanvasStore.getState().edges[0]!.id
const dataOf = (id: string) =>
  useCanvasStore.getState().edges.find((e) => e.id === id)!.data as EdgeData
const queue = () => useCanvasStore.getState().pendingStructuralAddEdges

/** Exactly what the inspector writes when a person states a strength. */
const statedStrength = { weight: 0.4, weightSource: 'user', direction: 'positive', directionSource: 'user' }

describe('a drawn link records its stand-down', () => {
  beforeEach(seed)

  it('stamps the stand-down REASON on the edge when the capture declines for want of a strength', () => {
    // `USER_EDGE_DEFAULTS`-shaped: a weight with no provenance is NOT a stated strength.
    useCanvasStore.getState().addEdge({ source: A, target: B, data: { weight: 0.3 } } as never)
    expect(queue()).toHaveLength(0)
    // Bound by IDENTITY of the reason, never "a marker is present".
    expect(dataOf(drawnEdgeId()).structuralAddStandDown).toBe('strength_not_stated')
  })

  it('does NOT stamp it when the edge captured successfully', () => {
    useCanvasStore.getState().addEdge({ source: A, target: B, data: statedStrength } as never)
    expect(queue()).toHaveLength(1)
    expect(dataOf(drawnEdgeId()).structuralAddStandDown).toBeUndefined()
  })
})

describe('stating a strength sends the link, once', () => {
  beforeEach(() => {
    seed()
    useCanvasStore.getState().addEdge({ source: A, target: B, data: { weight: 0.3 } } as never)
  })

  it('captures the link and CLEARS the receipt in the same write', () => {
    const id = drawnEdgeId()
    expect(queue()).toHaveLength(0)

    useCanvasStore.getState().updateEdgeData(id, statedStrength as never)

    expect(queue()).toHaveLength(1)
    expect(queue()[0]!.from).toBe(A)
    expect(queue()[0]!.to).toBe(B)
    // The magnitude is the one the USER stated — never a default, never clamped
    // from something nobody supplied.
    expect(queue()[0]!.magnitude).toBeCloseTo(0.4)
    expect(dataOf(id).structuralAddStandDown).toBeUndefined()
  })

  it('⭐ A SECOND STRENGTH WRITE DOES NOT QUEUE THE LINK AGAIN — repeat confirmation cannot duplicate it', () => {
    const id = drawnEdgeId()
    useCanvasStore.getState().updateEdgeData(id, statedStrength as never)
    expect(queue()).toHaveLength(1)

    useCanvasStore.getState().updateEdgeData(id, { ...statedStrength, weight: 0.9 } as never)

    // The receipt is gone, so there is nothing to retry. Exactly one intent.
    expect(queue()).toHaveLength(1)
    expect(queue()[0]!.magnitude).toBeCloseTo(0.4)
  })

  it('⛔ NEVER INVENTS A MAGNITUDE — an unrelated edit leaves the link unsaved and the receipt in place', () => {
    const id = drawnEdgeId()
    useCanvasStore.getState().updateEdgeData(id, { label: 'renamed' } as never)
    expect(queue()).toHaveLength(0)
    expect(dataOf(id).structuralAddStandDown).toBe('strength_not_stated')
  })

  it('⛔ a weight with NO provenance is not a stated strength and does not send it', () => {
    const id = drawnEdgeId()
    useCanvasStore.getState().updateEdgeData(id, { weight: 0.7 } as never)
    expect(queue()).toHaveLength(0)
    expect(dataOf(id).structuralAddStandDown).toBe('strength_not_stated')
  })
})

describe('an edge with no recorded stand-down is never retried', () => {
  beforeEach(seed)

  it('a strength written on an edge that never stood down queues nothing', () => {
    // Seeded directly, so it carries no receipt — the pre-existing-edge case.
    useCanvasStore.setState({
      edges: [{ id: 'e-seeded', source: A, target: B, data: {} } as Edge<EdgeData>],
    } as never)
    useCanvasStore.getState().updateEdgeData('e-seeded', statedStrength as never)
    expect(queue()).toHaveLength(0)
  })
})

/**
 * ⭐⭐ CAPTURE → WIRE PAYLOAD, END TO END THROUGH THE REAL BUILDERS.
 *
 * The store half is only worth anything if what it queues is something the
 * sender can actually put on the wire. This drives the whole chain a human
 * gesture drives — draw, state a strength, drain, resolve the base, build the
 * payload — and asserts the CONTRACT's field names and the USER'S number.
 *
 * ⚠ WHAT IT IS NOT: this is not a wire witness. It proves the payload is built
 * and well-formed, never that an HTTP request carried it. **No run has yet shown
 * `structural_add_edge` on the wire from any human gesture**, and that remains
 * this work's open acceptance condition — it needs the deployed build, not a
 * unit test. Naming the gap here so a green suite is not read as closing it.
 */
describe('what the gesture queues is what the sender would send', () => {
  beforeEach(seed)

  it('a drawn link, given a stated strength, produces a contract-shaped payload carrying the USER\'s magnitude', () => {
    useCanvasStore.getState().addEdge({ source: A, target: B, data: { weight: 0.3 } } as never)
    const id = drawnEdgeId()
    useCanvasStore.getState().updateEdgeData(id, statedStrength as never)

    // Drain exactly as `useStructuralAddEdgeEvents` does.
    const queued = useCanvasStore.getState().takePendingStructuralAddEdges()
    expect(queued).toHaveLength(1)

    const resolved = resolveStructuralAddEdgeBase(queued[0]!, 'srv-hash-1')
    expect(resolved).not.toBeNull()

    const payload = buildStructuralAddEdgeWirePayload(resolved!)
    expect(payload).toEqual({
      from: A,
      to: B,
      // ⭐ THE USER'S 0.4 — never `USER_EDGE_DEFAULTS.weight`, never a clamp of
      // something nobody supplied. If this ever reads 0.3 the fix has started
      // fabricating the number it exists to refuse.
      magnitude: 0.4,
      effect_direction: 'positive',
      base_graph_hash: 'srv-hash-1',
    })
  })

  it('a link nobody valued never reaches a payload at all', () => {
    useCanvasStore.getState().addEdge({ source: A, target: B, data: { weight: 0.3 } } as never)
    expect(useCanvasStore.getState().takePendingStructuralAddEdges()).toHaveLength(0)
  })
})
