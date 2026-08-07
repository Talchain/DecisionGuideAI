/**
 * buildEdgeAdjudicationEvent — the contested-edge verdict, as a wire event.
 *
 * P4 transport (lane evidence:
 * PHASE0-EVIDENCE-2026-07-28/lane-p4-transport-2026-08-05.md). Verified at the
 * bytes on staging dae8908f: `ModelTabBody.handleResolveContested` settled a
 * CEE multi-pass disagreement with a LOCAL `updateEdge` only — the human's
 * verdict never left the browser. This module decides WHICH fields go into the
 * contract's `edge_adjudication` member; the wire TYPE itself comes from
 * `@talchain/schemas` via buildV5Payload (judgementTransport.wire.test.ts).
 *
 * Identity rule: the event binds to its edge by from+to NODE ids (the
 * canonical edge key CEE uses) — `edge.source`/`edge.target` — never by the
 * client edge id, which rides along informatively.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'

import { buildEdgeAdjudicationEvent } from '../edgeAdjudication'

function makeEdge(id = 'reactflow__edge-n1-n2', source = 'n1', target = 'n2'): Edge {
  return { id, source, target, data: { weight: 0.6 } }
}

describe('buildEdgeAdjudicationEvent', () => {
  it('binds the event to the edge by from+to node ids, with the client id alongside', () => {
    const ev = buildEdgeAdjudicationEvent(makeEdge(), 'accepted_pass1')
    expect(ev).toEqual({
      type: 'edge_adjudication',
      payload: {
        from: 'n1',
        to: 'n2',
        edge_id: 'reactflow__edge-n1-n2',
        verdict: 'accepted_pass1',
      },
    })
  })

  it('an override carries the SIGNED value the user asserted', () => {
    const ev = buildEdgeAdjudicationEvent(makeEdge(), 'overridden', -0.45)
    expect(ev?.payload).toMatchObject({
      verdict: 'overridden',
      resolved_strength_mean: -0.45,
    })
  })

  it('an override WITHOUT a value builds nothing — fail closed, never a wire 422', () => {
    expect(buildEdgeAdjudicationEvent(makeEdge(), 'overridden')).toBeNull()
    expect(buildEdgeAdjudicationEvent(makeEdge(), 'overridden', Number.NaN)).toBeNull()
  })

  it('an accepted verdict may carry the accepted pass mean, informatively', () => {
    const ev = buildEdgeAdjudicationEvent(makeEdge(), 'accepted_pass2', 0.35)
    expect(ev?.payload).toMatchObject({
      verdict: 'accepted_pass2',
      resolved_strength_mean: 0.35,
    })
  })

  it('a dismissal NEVER carries a value — it asserts none', () => {
    const ev = buildEdgeAdjudicationEvent(makeEdge(), 'dismissed', 0.35)
    expect(ev?.payload).toMatchObject({ verdict: 'dismissed' })
    expect(ev?.payload).not.toHaveProperty('resolved_strength_mean')
  })

  it('`pending` builds nothing — the unresolved state is not an adjudication', () => {
    expect(buildEdgeAdjudicationEvent(makeEdge(), 'pending')).toBeNull()
  })

  it('an edge missing its node ids builds nothing — identity or silence', () => {
    expect(buildEdgeAdjudicationEvent(makeEdge('e1', '', 'n2'), 'accepted_pass1')).toBeNull()
    expect(buildEdgeAdjudicationEvent(makeEdge('e1', 'n1', ''), 'accepted_pass1')).toBeNull()
  })
})
