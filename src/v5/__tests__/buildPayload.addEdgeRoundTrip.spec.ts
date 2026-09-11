/**
 * THE ADD-EDGE BUILDER AND THE ADAPTER AGREE — asserted by ROUND TRIP.
 *
 * ── THE GAP, named by an independent review of #1478 ────────────────────────
 * `buildStructuralAddEdgeWirePayload`'s header says *"the mapping lives in
 * exactly one place."* It does not. The contract names are spelled THREE times:
 *
 *   1. the builder WRITES `effect_direction` / `base_graph_hash`
 *   2. `adaptStructuralAddEdge` READS those literals back
 *   3. `systemEventParity`'s fixture spells them a third time, hand-written
 *
 * And the builder had NO test caller — its occurrences were import, one
 * production call site, definition. **So a rename on the producer side left the
 * parity test green while the adapter read `undefined`.** It surfaces as
 * `unsupported_system_event` rather than silence, which is why this is a guard
 * rather than a P0 — but a user's drawn connection would stop reaching the
 * server with nothing on screen to say so.
 *
 * ── WHY A ROUND TRIP AND NOT A THIRD FIXTURE ────────────────────────────────
 * A fourth hand-written spelling would be a fourth thing to keep in step. This
 * asserts that the REAL builder's output is accepted by the REAL adapter, on the
 * production path (`buildV5Payload`), so the two cannot drift apart without one
 * of them failing. No literal is retyped here.
 */
import { describe, it, expect } from 'vitest'
import { buildV5Payload } from '../buildPayload'
import { buildStructuralAddEdgeWirePayload } from '../../canvas/mutations/structuralAddEdge'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

/** A resolved intent, built from the module's own type — not a copied shape. */
const INTENT = {
  from: '2a9eb771',
  to: 'ac02582c',
  magnitude: 0.55,
  direction: 'positive',
  baseGraphHash: 'a'.repeat(64),
} as Parameters<typeof buildStructuralAddEdgeWirePayload>[0]

function send(payload: Record<string, unknown>) {
  return buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'analyse',
    turnClass: 'edit_graph',
    mode: 'system',
    systemEvent: { type: 'structural_add_edge', payload },
    // `as never` matches `buildPayload.structuralAdd.spec.ts`'s own call — the
    // input type is a discriminated union the literal cannot narrow to, and a
    // structural cast reads as "these overlap" when they do not (TS2352).
  } as never)
}

describe('structural_add_edge — the builder output survives the adapter', () => {
  it('PRECONDITION — the builder actually produces a payload with keys', () => {
    // Without this, an empty object would sail through every assertion below
    // for the wrong reason.
    const wire = buildStructuralAddEdgeWirePayload(INTENT)
    expect(Object.keys(wire).length).toBeGreaterThan(0)
  })

  it('ROUND TRIP — what the builder writes, the adapter accepts', () => {
    const wire = buildStructuralAddEdgeWirePayload(INTENT)
    const r = send(wire)

    // ⛔ This is the assertion that reds on a producer-side rename. The parity
    // fixture would stay green; this cannot.
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.kind).toBe('system_event')
  })

  it('CONTROL — the adapter DOES refuse a payload whose names are wrong', () => {
    // Anti-vacuity: proves the round trip passed because the names MATCH, not
    // because the adapter accepts anything. Rename one contract key and it must
    // stop being sendable.
    const wire = buildStructuralAddEdgeWirePayload(INTENT)
    const renamed = { ...wire }
    delete (renamed as Record<string, unknown>).effect_direction
    ;(renamed as Record<string, unknown>).effectDirection = 'positive'

    const r = send(renamed)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('unsupported_system_event')
  })
})
