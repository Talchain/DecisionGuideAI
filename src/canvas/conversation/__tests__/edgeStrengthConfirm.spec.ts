/**
 * Ratifying a strength the server already holds — the act the product has been
 * prescribing and unable to perform.
 *
 * ⭐ THE LOAD-BEARING TEST IS THE CONTRACT ONE. The cross-field rules for
 * `confirm_current` (`direction_intent: 'preserve'`, `magnitude ===
 * abs(expected.mean)` exactly) live in `adaptEdgeStrengthEdit`, and a spec that
 * RESTATED them here would be an invariant with the same blind spot as the code
 * it guards — two copies that agree with each other and possibly not with CEE.
 * So the payload is driven through `buildV5Payload`, the app's OWN validator, and
 * the assertion is that the intent SURVIVES it. If the builder ever emitted a
 * magnitude that differs by a rounding step, that path returns `null` and the
 * event vanishes — which is exactly what these tests catch.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import {
  buildEdgeStrengthConfirmEvent,
  buildEdgeStrengthEditEvent,
} from '../edgeStrengthEdit'
import { buildV5Payload } from '../../../v5/buildPayload'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../../domain/edges'

const SERVER_STATED = { serverStrength: { mean: 0.45434782608695656, effect_direction: 'positive' as const } }
const NEGATIVE_STATED = { serverStrength: { mean: -0.5, effect_direction: 'negative' as const } }

const edge = (data: Record<string, unknown>): Edge<EdgeData> =>
  ({ id: 'e-1', source: '0438393f', target: '06a99939', data } as unknown as Edge<EdgeData>)

/** Drive the event through the REAL validator and hand back the wire event. */
function throughValidator(evt: ReturnType<typeof buildEdgeStrengthConfirmEvent>) {
  expect(evt).not.toBeNull()
  const payload = buildV5Payload({
    turnId: '0f89825e-b4df-483a-b328-e5549887c71a',
    scenarioId: 'ea037b5d-b411-4613-970e-b1c631123795',
    stage: 'analyse',
    turnClass: 'system_event',
    mode: 'system',
    systemEvent: evt!,
  } as unknown as Parameters<typeof buildV5Payload>[0])
  // ⚠ `{ ok: true, payload }` — a discriminated union, not the payload. My first
  // version read `payload.event` off the wrapper and got `undefined`, which an
  // assertion of "not null" would have passed vacuously. Assert `ok` FIRST so a
  // refusal surfaces as a refusal rather than as an absent field.
  expect(payload.ok, `validator refused: ${JSON.stringify(payload)}`).toBe(true)
  return (payload as { ok: true; payload: Record<string, unknown> }).payload
}

describe('confirming a strength is a DIFFERENT ACT from changing it', () => {
  it('⭐ the discriminating pair: same edge, two builders, two intents', () => {
    // Neither alone shows anything: a confirm builder that emitted `set` would
    // pass an intent check written only against itself. The PAIR is what proves
    // these are two acts rather than one flagged.
    const e = edge({ ...DEFAULT_EDGE_DATA, ...SERVER_STATED })
    const confirm = buildEdgeStrengthConfirmEvent({ edge: e })
    const change = buildEdgeStrengthEditEvent({ edge: e, requestedMean: 0.9, preserveDirection: true })
    expect((confirm as any)?.payload?.intent).toBe('confirm_current')
    expect((change as any)?.payload?.intent).toBe('set')
  })

  it('sends exactly the persisted number, with the direction preserved', () => {
    const evt = buildEdgeStrengthConfirmEvent({ edge: edge({ ...DEFAULT_EDGE_DATA, ...SERVER_STATED }) })
    const p = (evt as any).payload
    expect(p.magnitude).toBe(Math.abs(SERVER_STATED.serverStrength.mean))
    expect(p.direction_intent).toBe('preserve')
    expect(p.expected).toEqual({ mean: 0.45434782608695656, effect_direction: 'positive' })
  })

  it('⭐ SURVIVES THE APP’S OWN VALIDATOR with the intent intact — positive and negative', () => {
    for (const stated of [SERVER_STATED, NEGATIVE_STATED]) {
      const evt = buildEdgeStrengthConfirmEvent({ edge: edge({ ...DEFAULT_EDGE_DATA, ...stated }) })
      const payload = throughValidator(evt)
      // Not merely "non-null": the EVENT must be present and still a confirmation.
      expect((payload as any)?.event?.intent).toBe('confirm_current')
      expect((payload as any)?.event?.magnitude).toBe(Math.abs(stated.serverStrength.mean))
    }
  })

  it('refuses an edge whose strength nothing proves the server stated', () => {
    // POSITIVE CONTROL FIRST — without it, a builder that always returned null
    // would pass this test and every other refusal test in the file.
    expect(buildEdgeStrengthConfirmEvent({ edge: edge({ ...DEFAULT_EDGE_DATA, ...SERVER_STATED }) })).not.toBeNull()
    expect(buildEdgeStrengthConfirmEvent({ edge: edge({ ...DEFAULT_EDGE_DATA }) })).toBeNull()
    expect(buildEdgeStrengthConfirmEvent({ edge: null })).toBeNull()
  })

  it('⛔ takes no number, so it cannot become a silent `set`', () => {
    // The signature is the guard. A confirmation that accepted a magnitude could
    // be handed one that differs from the persisted value and would then be a
    // change wearing a confirmation's name — the mirror of the defect this closes.
    expect(buildEdgeStrengthConfirmEvent.length).toBe(1)
    const arg = { edge: edge({ ...DEFAULT_EDGE_DATA, ...SERVER_STATED }), requestedMean: 0.99 } as never
    expect(((buildEdgeStrengthConfirmEvent(arg) as any)).payload.magnitude)
      .toBe(Math.abs(SERVER_STATED.serverStrength.mean))
  })
})
