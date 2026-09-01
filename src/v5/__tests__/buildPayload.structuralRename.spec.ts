/**
 * `structural_rename` (0.50.0) on the wire — the UI's outbound adapter.
 *
 * ⭐ EVERY PREDICATE HERE SHIPS ITS OPPOSITE-DIRECTION TWIN. This estate's
 * chronic defect on gate-shaped code is a corpus that tests one direction: a
 * guard too wide silently DROPS a legitimate rename, a guard too narrow lets a
 * malformed one through and 422s the WHOLE TURN. Those are two different harms
 * and they cannot share a single set of cases, so each refusal below is paired
 * with the nearest input that must be ACCEPTED.
 *
 * The expectations are derived from the producer's own schema
 * (`@talchain/schemas/boundary`), never from what our ids happen to look like —
 * and the final case parses the built payload through the REAL contract, so a
 * drift in either direction is caught by the contract rather than by my reading
 * of it.
 */
import { describe, it, expect } from 'vitest'
import { SystemEventSchema } from '@talchain/schemas/boundary'

import { buildV5Payload } from '../buildPayload'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'
const HASH = 'f3d31f75957c5cb5'

const base = {
  turnId: TURN_ID,
  scenarioId: SCENARIO_ID,
  stage: 'frame' as const,
  turnClass: 'frame' as const,
  mode: 'system' as const,
}

function build(payload: Record<string, unknown>) {
  return buildV5Payload({ ...base, systemEvent: { type: 'structural_rename', payload } })
}

const WELL_FORMED = {
  node_id: 'fac_monthly_eng_cost',
  label: 'Monthly engineering spend',
  expected_label: 'Monthly eng cost',
  base_graph_hash: HASH,
}

describe('buildV5Payload — structural_rename (0.50.0)', () => {
  it('builds the typed event from a well-formed rename', () => {
    const r = build(WELL_FORMED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.kind).toBe('system_event')
    if (r.payload.kind !== 'system_event') return
    expect(r.payload.event).toEqual({
      kind: 'structural_rename',
      node_id: 'fac_monthly_eng_cost',
      label: 'Monthly engineering spend',
      expected_label: 'Monthly eng cost',
      base_graph_hash: HASH,
    })
  })

  it('the built event PARSES against the real contract, not against my reading of it', () => {
    const r = build(WELL_FORMED)
    expect(r.ok).toBe(true)
    if (!r.ok || r.payload.kind !== 'system_event') return
    const parsed = SystemEventSchema.safeParse(r.payload.event)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })

  // ── base_graph_hash: the stale gate is non-optional ──────────────────────
  it('REFUSES an absent base_graph_hash — the contract forbids absent/null/empty', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: undefined }).ok).toBe(false)
  })
  it('REFUSES an empty base_graph_hash', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: '' }).ok).toBe(false)
  })
  it('TWIN: a present, non-empty base_graph_hash is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: 'a1b2c3d4e5f60718' }).ok).toBe(true)
  })

  // ── expected_label: the gate the hash is structurally blind to ───────────
  it('REFUSES a missing expected_label — without it a concurrent rename is clobbered', () => {
    expect(build({ ...WELL_FORMED, expected_label: undefined }).ok).toBe(false)
  })
  it('REFUSES an empty expected_label (contract min is 1)', () => {
    expect(build({ ...WELL_FORMED, expected_label: '' }).ok).toBe(false)
  })
  it('TWIN: a one-character expected_label is ACCEPTED — the bound is 1, not 2', () => {
    expect(build({ ...WELL_FORMED, expected_label: 'x' }).ok).toBe(true)
  })

  // ── the no-op refinement ────────────────────────────────────────────────
  it('REFUSES label === expected_label — the contract calls this a no-op', () => {
    expect(build({ ...WELL_FORMED, label: 'Same', expected_label: 'Same' }).ok).toBe(false)
  })
  it('TWIN: a one-character difference is a real rename and is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, label: 'Samf', expected_label: 'Same' }).ok).toBe(true)
  })

  // ── label bounds, derived from NodeV3Schema.shape.label (min 1, max 200) ──
  it('REFUSES an empty label', () => {
    expect(build({ ...WELL_FORMED, label: '' }).ok).toBe(false)
  })
  it('REFUSES a label of 201 characters — one past the contract bound', () => {
    expect(build({ ...WELL_FORMED, label: 'x'.repeat(201) }).ok).toBe(false)
  })
  it('TWIN: a label of exactly 200 characters is ACCEPTED — the bound is inclusive', () => {
    expect(build({ ...WELL_FORMED, label: 'x'.repeat(200) }).ok).toBe(true)
  })

  // ── node_id: CanonicalEdgeEndpointIdSchema, NOT the lowercase node-id regex ─
  it('REFUSES a blank node_id', () => {
    expect(build({ ...WELL_FORMED, node_id: '   ' }).ok).toBe(false)
  })
  it('REFUSES a node_id with surrounding whitespace', () => {
    expect(build({ ...WELL_FORMED, node_id: ' fac_a ' }).ok).toBe(false)
  })
  it('REFUSES a composite "→" node_id — that delimiter would silently retarget', () => {
    expect(build({ ...WELL_FORMED, node_id: 'fac_a→out_b' }).ok).toBe(false)
  })
  it('TWIN: an UPPERCASE / mixed-case live node id is ACCEPTED — the contract says do NOT narrow this to the lowercase NodeV3 regex, and narrowing it would refuse live nodes', () => {
    expect(build({ ...WELL_FORMED, node_id: 'Opt_Wait_And_See' }).ok).toBe(true)
  })
  it('TWIN: a UUID-shaped node id is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, node_id: '9f0c1c8e-2f4b-4a9d-9d7e-1c2b3a4d5e6f' }).ok).toBe(true)
  })

  it('an unsendable rename becomes NO TURN AT ALL, never an empty one', () => {
    const r = build({ ...WELL_FORMED, base_graph_hash: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('unsupported_system_event')
  })
})
