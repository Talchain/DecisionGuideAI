/**
 * `goal_target_edit` on the wire — the UI's outbound adapter (`adaptGoalTargetEdit`
 * in `buildPayload.ts`). The wire type is derived from the vendored contract
 * (schemas 0.59.0); see `goalTargetEdit.ts`'s header for the history.
 *
 * ⭐ EVERY PREDICATE HERE SHIPS ITS OPPOSITE-DIRECTION TWIN, same discipline
 * `buildPayload.structuralRename.spec.ts` uses: a guard too wide silently
 * DROPS a legitimate target, a guard too narrow lets a malformed one through
 * and 422s the WHOLE TURN once CEE ships a reader.
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
  return buildV5Payload({ ...base, systemEvent: { type: 'goal_target_edit', payload } })
}

const WELL_FORMED = {
  goal_node_id: 'goal_reduce_churn',
  constraint_type: 'at_least',
  raw_value: 12,
  unit: 'months',
  base_graph_hash: HASH,
}

describe('buildV5Payload — goal_target_edit (schemas 0.59.0)', () => {
  it('builds the typed event from a well-formed target', () => {
    const r = build(WELL_FORMED)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.kind).toBe('system_event')
    if (r.payload.kind !== 'system_event') return
    expect(r.payload.event).toEqual({
      kind: 'goal_target_edit',
      goal_node_id: 'goal_reduce_churn',
      constraint_type: 'at_least',
      raw_value: 12,
      unit: 'months',
      base_graph_hash: HASH,
    })
  })

  // Flipped on the 0.55.0 → 0.59.0 re-vendor: this used to assert the parse
  // FAILED (a tripwire, because 0.55.0 had no such member). It now matches
  // `buildPayload.structuralRename.spec.ts`'s sibling test.
  it('the built event PARSES against the real contract, not against my reading of it', () => {
    const r = build(WELL_FORMED)
    expect(r.ok).toBe(true)
    if (!r.ok || r.payload.kind !== 'system_event') return
    const parsed = SystemEventSchema.safeParse(r.payload.event)
    expect(parsed.success, JSON.stringify(parsed)).toBe(true)
  })

  // ── base_graph_hash: the stale gate is non-optional ──────────────────────
  it('REFUSES an absent base_graph_hash', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: undefined }).ok).toBe(false)
  })
  it('REFUSES an empty base_graph_hash', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: '' }).ok).toBe(false)
  })
  it('TWIN: a present, non-empty base_graph_hash is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, base_graph_hash: 'a1b2c3d4e5f60718' }).ok).toBe(true)
  })

  // ── goal_node_id: the canonical endpoint rule ─────────────────────────────
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace-padded', ' goal_reduce_churn '],
    ['an arrow composite', 'goal→target'],
  ])('REFUSES a goal_node_id that is %s', (_name, goal_node_id) => {
    expect(build({ ...WELL_FORMED, goal_node_id }).ok).toBe(false)
  })
  it('TWIN: a plain canonical id is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, goal_node_id: 'goal_x' }).ok).toBe(true)
  })

  // ── constraint_type: exactly the two contract members ─────────────────────
  it('REFUSES an unrecognised constraint_type', () => {
    expect(build({ ...WELL_FORMED, constraint_type: 'exactly' }).ok).toBe(false)
  })
  it('TWIN: at_most is ACCEPTED (with a value that satisfies its own rule)', () => {
    expect(build({ ...WELL_FORMED, constraint_type: 'at_most', raw_value: 5 }).ok).toBe(true)
  })

  // ── raw_value: finite, >= 0, and > 0 specifically for at_least ────────────
  it.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['non-finite (Infinity)', Number.POSITIVE_INFINITY],
  ])('REFUSES a raw_value that is %s', (_name, raw_value) => {
    expect(build({ ...WELL_FORMED, raw_value }).ok).toBe(false)
  })
  it('REFUSES raw_value 0 for at_least — asserts nothing', () => {
    expect(build({ ...WELL_FORMED, constraint_type: 'at_least', raw_value: 0 }).ok).toBe(false)
  })
  it('TWIN: raw_value 0 for at_most is ACCEPTED — a real ceiling (Codex amendment 5821693599)', () => {
    const r = build({ ...WELL_FORMED, constraint_type: 'at_most', raw_value: 0 })
    expect(r.ok).toBe(true)
    if (r.ok && r.payload.kind === 'system_event') {
      expect(r.payload.event).toMatchObject({ raw_value: 0 })
    }
  })

  // ── unit: required, non-empty ─────────────────────────────────────────────
  it('REFUSES a missing unit', () => {
    expect(build({ ...WELL_FORMED, unit: undefined }).ok).toBe(false)
  })
  it('REFUSES an empty unit', () => {
    expect(build({ ...WELL_FORMED, unit: '' }).ok).toBe(false)
  })
  it('TWIN: a stated unit is ACCEPTED', () => {
    expect(build({ ...WELL_FORMED, unit: '%' }).ok).toBe(true)
  })

  it('a completely empty payload is unsupported, not a crash', () => {
    const r = build({})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unsupported_system_event')
  })

  it('POSITIVE CONTROL: the refusals above are each about their own cause', () => {
    expect(build(WELL_FORMED).ok).toBe(true)
  })
})
