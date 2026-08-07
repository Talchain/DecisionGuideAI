/**
 * `factor_value_edit` — wire-level contract coverage (ROADMAP 1.346).
 *
 * Companion to the panel-level spec
 * (`src/canvas/ui/inspector-v2/__tests__/FactorControllablePanel.valueEditEmitsTurn.spec.tsx`),
 * which proves the inspector commit EMITS. This file proves the emitted event
 * SURVIVES the two hops between the emitter and the network, and that each hop
 * refuses what it should:
 *
 *   1. `serializeSystemEvent` — the send-allowlist. An event type missing from
 *      it is dropped BEFORE the network with only a DEV console warning. That
 *      is a silent no-op, so it gets an explicit assertion rather than being
 *      assumed.
 *   2. `buildV5Payload` / `adaptFactorValueEdit` — the wire adapter.
 *
 * Every payload built here is parsed against the REAL contract schema
 * (`OrchestratorTurnPayloadSchema` from `@talchain/schemas`), not against a
 * hand-written expectation. The union is a `discriminatedUnion` of `.strict()`
 * members, so a shape that drifted by one field name would be rejected
 * wholesale at CEE's ingress — asserting against the schema is the only check
 * that actually models that.
 */

import { describe, it, expect } from 'vitest'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { buildV5Payload } from '../buildPayload'
import { serializeSystemEvent } from '../../canvas/conversation/systemEvents'
import { buildFactorValueEditEvent, resolveValueInputSeed } from '../../canvas/conversation/factorValueEdit'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

const baseInput = {
  turnId: TURN_ID,
  scenarioId: SCENARIO_ID,
  stage: 'frame' as const,
  turnClass: 'frame' as const,
  mode: 'system' as const,
}

function build(payload: Record<string, unknown>) {
  return buildV5Payload({ ...baseInput, systemEvent: { type: 'factor_value_edit', payload } })
}

/**
 * Narrow the builder's `WireSystemEvent | null` to its payload.
 *
 * `payload` is optional on `WireSystemEvent` (most system events carry none),
 * so every read below would otherwise be an optional chain — and an optional
 * chain makes a MISSING payload look like a passing assertion
 * (`undefined?.value` is `undefined`, and `expect(undefined).not.toBe(15000)`
 * is green). Asserting the event and its payload exist FIRST is what keeps
 * these assertions falsifiable.
 */
function payloadOf(event: ReturnType<typeof buildFactorValueEditEvent>): Record<string, unknown> {
  expect(event).not.toBeNull()
  expect(event?.payload).toBeDefined()
  return event!.payload as Record<string, unknown>
}

const VALID = { target_id: 'fac_monthly_eng_cost', value: 0.5, raw_value: 15000, unit: '£' }

describe('factor_value_edit — send allowlist', () => {
  it('is NOT dropped by serializeSystemEvent', () => {
    // The allowlist is derived from WIRE_SYSTEM_EVENT_TYPES, but "derived"
    // is a claim about the code, and this is the assertion that makes it a
    // fact: a null here means every inspector edit silently never sends.
    const wire = serializeSystemEvent({ type: 'factor_value_edit', payload: VALID })
    expect(wire).not.toBeNull()
    expect(wire?.event_type).toBe('factor_value_edit')
  })
})

describe('factor_value_edit — wire adapter', () => {
  it('builds a system_event turn that PARSES against the real contract schema', () => {
    const r = build(VALID)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // The authoritative check: the contract itself accepts this payload.
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()

    expect(r.payload.kind).toBe('system_event')
    if (r.payload.kind !== 'system_event') return
    expect(r.payload.event).toEqual({
      kind: 'factor_value_edit',
      target_id: 'fac_monthly_eng_cost',
      value: 0.5,
      raw_value: 15000,
      unit: '£',
    })
  })

  it('forwards the `field` literal when the emitter states it', () => {
    const r = build({ ...VALID, field: 'value' })
    expect(r.ok).toBe(true)
    if (!r.ok || r.payload.kind !== 'system_event') return
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
    expect((r.payload.event as { field?: string }).field).toBe('value')
  })

  it('REFUSES a non-literal `field` rather than laundering or dropping it', () => {
    // `field` is a literal in the contract precisely so a future producer
    // emitting e.g. 'baseline' is refused loudly instead of parsing everywhere
    // and meaning different things per consumer. Silently stripping it here
    // would re-open that seam one hop earlier: the turn would be accepted as a
    // plain value edit, which is NOT what the producer asked for.
    const r = build({ ...VALID, field: 'baseline' })
    expect(r.ok).toBe(false)
  })

  // ABSENCE IS DISTINCT FROM ZERO for raw_value and unit — the contract says a
  // missing raw_value means "the client did not state a magnitude" (the server
  // derives one from `value` and its own cap), NOT zero.
  it('OMITS raw_value / unit when the emitter did not state them (never defaults them)', () => {
    const r = build({ target_id: 'fac_x', value: 0.25 })
    expect(r.ok).toBe(true)
    if (!r.ok || r.payload.kind !== 'system_event') return
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
    expect(r.payload.event).toEqual({ kind: 'factor_value_edit', target_id: 'fac_x', value: 0.25 })
    expect('raw_value' in r.payload.event).toBe(false)
    expect('unit' in r.payload.event).toBe(false)
  })

  it('preserves a GENUINE zero raw_value (zero is a value, not an absence)', () => {
    const r = build({ target_id: 'fac_x', value: 0, raw_value: 0 })
    expect(r.ok).toBe(true)
    if (!r.ok || r.payload.kind !== 'system_event') return
    expect((r.payload.event as { raw_value?: number }).raw_value).toBe(0)
    expect((r.payload.event as { value: number }).value).toBe(0)
  })

  // Fail CLOSED. A dropped event is a visible "nothing happened"; a fabricated
  // one is a silent wrong mutation on someone's model.
  it.each([
    ['no target_id', { value: 0.5 }],
    ['empty target_id', { target_id: '', value: 0.5 }],
    ['no value', { target_id: 'fac_x' }],
    ['NaN value', { target_id: 'fac_x', value: Number.NaN }],
    ['Infinite value', { target_id: 'fac_x', value: Number.POSITIVE_INFINITY }],
    ['non-numeric value', { target_id: 'fac_x', value: '0.5' }],
  ])('refuses an unencodable event (%s) rather than fabricating one', (_label, payload) => {
    const r = build(payload as Record<string, unknown>)
    expect(r.ok).toBe(false)
  })
})

describe('factor_value_edit — the scale contract', () => {
  const CAP = 30000

  it('capped factor seeded from raw_value: typed number is USER UNITS, value = raw/cap', () => {
    const nodeData = {
      observedState: { value: 1, raw_value: CAP, cap: CAP, unit: '£' },
    }
    expect(resolveValueInputSeed(nodeData)).toEqual({ seed: CAP, inUserUnits: true })

    expect(payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 15000, nodeData }))).toEqual({
      target_id: 'fac_x',
      value: 15000 / CAP,
      field: 'value',
      raw_value: 15000,
      unit: '£',
    })
  })

  it('factor with NO raw_value: the input showed the MODEL value, so it is NOT re-normalised', () => {
    // The bug this pins is a double-divide: the field displayed 0.4 (already
    // model scale) and a naive emitter would ship 0.4/cap.
    const nodeData = { observedState: { value: 0.4, cap: CAP, unit: '£' } }
    expect(resolveValueInputSeed(nodeData)).toEqual({ seed: 0.4, inUserUnits: false })

    const payload = payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 0.7, nodeData }))
    expect(payload.value).toBe(0.7)
    // No user-unit magnitude was typed, so none is asserted — the server
    // derives one from its own stored cap.
    expect(payload).not.toHaveProperty('raw_value')
  })

  it('UNCAPPED factor: the typed number IS the model value (no fabricated scale)', () => {
    const nodeData = { observedState: { raw_value: 5, unit: 'widgets' } }
    const payload = payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 9, nodeData }))
    expect(payload.value).toBe(9)
    expect(payload.raw_value).toBe(9)
  })

  it.each([
    ['cap of zero', 0],
    ['negative cap', -100],
    ['non-finite cap', Number.NaN],
  ])('%s means "no honest scale exists" — the typed number passes through unchanged', (_l, cap) => {
    const nodeData = { observedState: { raw_value: 5, cap } }
    expect(payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 9, nodeData })).value).toBe(9)
  })

  it('EMPTY factor: an operator typing into a blank field is entering user units', () => {
    const nodeData = { observedState: { cap: 8000, unit: '£' } }
    expect(resolveValueInputSeed(nodeData)).toEqual({ seed: undefined, inUserUnits: true })

    const payload = payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 7500, nodeData }))
    expect(payload.value).toBe(7500 / 8000)
    expect(payload.raw_value).toBe(7500)
  })

  it('unwraps COMPOUND { value: n } observed-state fields (CEE/legacy shape)', () => {
    // CEE and legacy paths can store these as `{ value, unit }` objects rather
    // than plain numbers. A bare `typeof x === 'number'` read reports them as
    // ABSENT, which here is not a display glitch but a wrong wire payload: the
    // magnitude would be omitted and the cap would look missing, so an
    // "uncapped" fallback would ship the display magnitude as a model value.
    const nodeData = {
      observedState: {
        value: { value: 0.5 },
        raw_value: { value: 15000 },
        cap: { value: CAP },
        unit: '£',
      },
    }
    expect(resolveValueInputSeed(nodeData)).toEqual({ seed: 15000, inUserUnits: true })

    const payload = payloadOf(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 6000, nodeData }))
    expect(payload.raw_value).toBe(6000)
    expect(payload.value).toBe(6000 / CAP)
  })

  it('the emitted event is ID-addressed and refuses a blank id', () => {
    const nodeData = { observedState: { raw_value: 1, cap: 10 } }
    expect(buildFactorValueEditEvent({ nodeId: '', typedValue: 5, nodeData })).toBeNull()
  })

  it('refuses a non-finite typed value', () => {
    const nodeData = { observedState: { raw_value: 1, cap: 10 } }
    expect(buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: Number.NaN, nodeData })).toBeNull()
  })

  it('END TO END: the built event survives the adapter and parses against the contract', () => {
    // The two halves above are only useful if they compose — this is the hop
    // the emitter actually takes.
    const nodeData = { observedState: { value: 1, raw_value: CAP, cap: CAP, unit: '£' } }
    const event = buildFactorValueEditEvent({ nodeId: 'fac_x', typedValue: 15000, nodeData })
    const payload = payloadOf(event)

    const wire = serializeSystemEvent(event!)
    expect(wire).not.toBeNull()

    const r = build(payload)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
    if (r.payload.kind !== 'system_event') return
    expect(r.payload.event).toEqual({
      kind: 'factor_value_edit',
      target_id: 'fac_x',
      value: 0.5,
      raw_value: 15000,
      unit: '£',
      field: 'value',
    })
  })
})
