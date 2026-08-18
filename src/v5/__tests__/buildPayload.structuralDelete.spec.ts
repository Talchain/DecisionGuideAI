/**
 * `structural_delete` on the wire (schemas 0.48.0).
 *
 * ⚠ THE ORACLE IS THE PRODUCER'S OWN SCHEMA, not this file's idea of the shape.
 * Every positive case is validated with the VENDORED
 * `OrchestratorTurnPayloadSchema` — the same object CEE validates ingress with —
 * so a field-name drift or a lost refinement reds here rather than at a 422 on
 * staging. A hand-written expectation would only ever agree with itself.
 *
 * Every member of the union is `.strict()` and the union is discriminated on
 * `kind`, so a malformed field does not lose the field: it loses the WHOLE TURN.
 * That is why the adapter fail-closes and why both directions are pinned.
 */

import { describe, it, expect } from 'vitest'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import { buildV5Payload } from '../buildPayload'
import { WIRE_SYSTEM_EVENT_TYPES, type SystemEvent } from '../../canvas/conversation/types'

const HASH = 'f3d31f75957c5cb5'

function build(payload: Record<string, unknown>) {
  return buildV5Payload({
    turnId: '11111111-1111-4111-8111-111111111111',
    scenarioId: '22222222-2222-4222-8222-222222222222',
    stage: 'analyse',
    turnClass: 'decide',
    mode: 'system',
    // The malformed cases below are exactly what a drifted caller would hand
    // over, so the payload slot stays deliberately untyped — narrowing it here
    // would make the compiler, not the adapter, the thing under test.
    systemEvent: { type: 'structural_delete', payload } as SystemEvent,
  })
}

const wellFormed = {
  removed_node_ids: ['option_b'],
  removed_edges: [{ from: 'factor_cost', to: 'goal' }],
  base_graph_hash: HASH,
}

describe('structural_delete — registration', () => {
  it('is in the ONE derived wire vocabulary, so `serializeSystemEvent` cannot drop it', () => {
    // The runtime send-allowlist is derived from this array; a type present in
    // the union but absent here is dropped BEFORE the network with only a DEV
    // warning — the drift that reads as green.
    expect(WIRE_SYSTEM_EVENT_TYPES).toContain('structural_delete')
  })
})

describe('structural_delete — the turn it builds (twin: positive)', () => {
  it('builds a payload the PRODUCER schema accepts, carrying all three fields', () => {
    const result = build(wellFormed)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload).toMatchObject({
      kind: 'system_event',
      event: {
        kind: 'structural_delete',
        removed_node_ids: ['option_b'],
        removed_edges: [{ from: 'factor_cost', to: 'goal' }],
        base_graph_hash: HASH,
      },
    })
    const parsed = OrchestratorTurnPayloadSchema.safeParse(result.payload)
    expect(parsed.success).toBe(true)
  })

  it('accepts a NODES-ONLY delete — an empty removed_edges is legitimate', () => {
    const result = build({ ...wellFormed, removed_edges: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(OrchestratorTurnPayloadSchema.safeParse(result.payload).success).toBe(true)
  })

  it('accepts an EDGES-ONLY delete — an empty removed_node_ids is legitimate', () => {
    const result = build({ ...wellFormed, removed_node_ids: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(OrchestratorTurnPayloadSchema.safeParse(result.payload).success).toBe(true)
  })

  it('carries a large batch unchanged — select-all-then-delete is a legitimate action', () => {
    const many = Array.from({ length: 40 }, (_, i) => `node_${i}`)
    const result = build({ ...wellFormed, removed_node_ids: many })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      (result.payload as { event: { removed_node_ids: string[] } }).event.removed_node_ids,
    ).toHaveLength(40)
    expect(OrchestratorTurnPayloadSchema.safeParse(result.payload).success).toBe(true)
  })
})

describe('structural_delete — what it refuses to put on the wire (twin: negative)', () => {
  it.each([
    ['a missing base_graph_hash — the stale gate is non-optional', { ...wellFormed, base_graph_hash: undefined }],
    ['an EMPTY base_graph_hash', { ...wellFormed, base_graph_hash: '' }],
    ['both arrays empty — a delete that removes nothing', { removed_node_ids: [], removed_edges: [], base_graph_hash: HASH }],
    ['a blank node id', { ...wellFormed, removed_node_ids: [''] }],
    ['a whitespace-padded node id', { ...wellFormed, removed_node_ids: [' option_b'] }],
    ['a composite node id', { ...wellFormed, removed_node_ids: ['a→b'] }],
    ['an edge with a composite endpoint', { ...wellFormed, removed_edges: [{ from: 'a->b', to: 'goal' }] }],
    ['an edge missing an endpoint', { ...wellFormed, removed_edges: [{ from: 'factor_cost' }] }],
    ['removed_node_ids not an array', { ...wellFormed, removed_node_ids: 'option_b' }],
    ['removed_edges not an array', { ...wellFormed, removed_edges: {} }],
  ])('refuses %s — no turn at all rather than a 422 that loses the whole turn', (_label, payload) => {
    const result = build(payload as Record<string, unknown>)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsupported_system_event')
  })

  it('the refusals it makes are the ones the SCHEMA would make — checked against the schema itself', () => {
    // The adapter must not be MORE permissive than the producer. Feeding the
    // rejected shapes straight into the contract proves the fail-closed rules
    // here are the contract's, not this file's.
    const base = {
      kind: 'system_event' as const,
      turn_id: '11111111-1111-4111-8111-111111111111',
      scenario_id: '22222222-2222-4222-8222-222222222222',
      stage: 'analyse',
    }
    const rejected = [
      { kind: 'structural_delete', removed_node_ids: [], removed_edges: [], base_graph_hash: HASH },
      { kind: 'structural_delete', removed_node_ids: ['a→b'], removed_edges: [], base_graph_hash: HASH },
      { kind: 'structural_delete', removed_node_ids: ['x'], removed_edges: [], base_graph_hash: '' },
    ]
    for (const event of rejected) {
      expect(OrchestratorTurnPayloadSchema.safeParse({ ...base, event }).success).toBe(false)
    }
    // …and the positive control: the well-formed one the adapter DOES emit.
    expect(
      OrchestratorTurnPayloadSchema.safeParse({
        ...base,
        event: { kind: 'structural_delete', ...wellFormed },
      }).success,
    ).toBe(true)
  })
})
