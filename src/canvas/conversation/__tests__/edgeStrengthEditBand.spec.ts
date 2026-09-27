/**
 * `edge_strength_edit.band` (schemas 0.60.0) — a band PICK says which band.
 *
 * ⭐ THE DEFECT, AS THE USER MEETS IT. Picking "Strong" on the band pills sent
 * `magnitude: 0.55` and nothing else, so CEE could not tell a band the user
 * chose from an exact figure they typed. The contract's own words: *"Without it
 * a pill choice lands as an exact figure and the user's stated spread is
 * lost."* 0.60.0 gives the event an OPTIONAL `band`, in the contract's ONE band
 * vocabulary (`StrengthBand`); absent means "an exact figure, no band".
 *
 * ⚠ BOUND BY IDENTITY. Every row names the picked band and asserts the wire
 * band BY VALUE against the package's own enum — never "some band is present",
 * which a builder stamping a fixed band would also satisfy.
 *
 * ⚠ THE PAYLOAD IS PARSED BY THE CONTRACT'S OWN VALIDATOR, imported from the
 * vendored package (`OrchestratorTurnPayloadSchema`, root superRefine included),
 * after the app's own adapter (`buildV5Payload`). A spec that restated the
 * schema here would share any blind spot with the code it guards.
 */
import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import { OrchestratorTurnPayloadSchema, StrengthBand } from '@talchain/schemas/boundary'

import {
  buildEdgeStrengthConfirmEvent,
  buildEdgeStrengthEditEvent,
  EDGE_STRENGTH_BAND_ENABLED,
  WIRE_STRENGTH_BAND_OF,
} from '../edgeStrengthEdit'
import type { WireSystemEvent } from '../types'
import { buildV5Payload } from '../../../v5/buildPayload'
import { CANVAS_STRENGTH_BANDS, type CanvasStrengthBandId } from '../../domain/vocabulary'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../../domain/edges'

const POSITIVE_STATED = { serverStrength: { mean: 0.35, effect_direction: 'positive' as const } }
const NEGATIVE_STATED = { serverStrength: { mean: -0.35, effect_direction: 'negative' as const } }

const edge = (data: Record<string, unknown>): Edge<EdgeData> =>
  ({ id: 'e-1', source: 'fac_price', target: 'out_retention', data } as unknown as Edge<EdgeData>)

/** The canvas band row, BY ID — never by label or index. */
const bandRow = (id: CanvasStrengthBandId) => {
  const row = CANVAS_STRENGTH_BANDS.find(b => b.id === id)
  expect(row, `no canvas band with id ${id}`).toBeDefined()
  return row!
}

/** The exact mapping the contract requires, written out so a drifted table REDs. */
const EXPECTED_WIRE: Record<CanvasStrengthBandId, string> = {
  slight: 'slight',
  moderate: 'moderate',
  strong: 'strong',
  veryStrong: 'very_strong',
}

/** Drive through the app's adapter, then the CONTRACT's validator. Returns the parsed event. */
function throughAdapterAndContract(evt: WireSystemEvent | null) {
  expect(evt, 'the builder refused an event this row expects to send').not.toBeNull()
  const built = buildV5Payload({
    turnId: '11111111-1111-4111-8111-111111111111',
    scenarioId: '22222222-2222-4222-8222-222222222222',
    stage: 'analyse',
    turnClass: 'system_event',
    mode: 'system',
    systemEvent: evt!,
  } as unknown as Parameters<typeof buildV5Payload>[0])
  // `{ ok, payload }` — assert `ok` FIRST so a refusal reads as a refusal, not an absent field.
  expect(built.ok, `app adapter refused: ${JSON.stringify(built)}`).toBe(true)
  const payload = (built as { ok: true; payload: Record<string, unknown> }).payload
  const parsed = OrchestratorTurnPayloadSchema.safeParse(payload)
  expect(parsed.success, `0.60.0 contract refused: ${JSON.stringify(parsed)}`).toBe(true)
  // Strict schema, nothing stripped: what the adapter built IS what the contract accepts.
  expect(parsed.success && parsed.data).toStrictEqual(payload)
  return (payload as { event: Record<string, unknown> }).event
}

describe('a band PICK carries the band that was picked', () => {
  it('RED: picking Strong sends `band: "strong"` beside the magnitude', () => {
    const evt = buildEdgeStrengthEditEvent({
      edge: edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED }),
      requestedMean: bandRow('strong').midpoint,
      preserveDirection: true,
      band: 'strong',
    })
    expect(evt?.payload?.band).toBe('strong')
    expect(evt?.payload?.magnitude).toBe(0.55)
    expect(evt?.payload?.intent).toBe('set')
  })

  it.each(CANVAS_STRENGTH_BANDS.map(b => [b.id] as const))(
    'every canvas band maps to its contract name, and parses under 0.60.0 — %s',
    (id) => {
      for (const stated of [POSITIVE_STATED, NEGATIVE_STATED]) {
        const row = bandRow(id)
        // The pill hands a SIGNED midpoint on a negative edge; the builder takes |mean|.
        const signed = stated.serverStrength.mean < 0 ? -row.midpoint : row.midpoint
        const evt = buildEdgeStrengthEditEvent({
          edge: edge({ ...DEFAULT_EDGE_DATA, ...stated }),
          requestedMean: signed,
          preserveDirection: true,
          band: id,
        })
        const wire = throughAdapterAndContract(evt)
        expect(wire.band).toBe(EXPECTED_WIRE[id])
        expect(wire.magnitude).toBe(row.midpoint)
        expect(wire.direction_intent).toBe('preserve')
      }
    },
  )

  it('the mapping covers the contract vocabulary exactly — no canvas band unmapped, no contract band unreachable', () => {
    expect(WIRE_STRENGTH_BAND_OF).toEqual(EXPECTED_WIRE)
    expect(new Set(Object.values(WIRE_STRENGTH_BAND_OF))).toEqual(new Set(StrengthBand.options))
    expect(Object.keys(WIRE_STRENGTH_BAND_OF).sort()).toEqual(CANVAS_STRENGTH_BANDS.map(b => b.id).sort())
  })
})

describe('a slider drag or a typed number sends NO band', () => {
  it('the same 0.55 without a band pick has no `band` key at all — and still parses', () => {
    // ⭐ THE DISCRIMINATING PAIR with the first row: same edge, same magnitude,
    // only the gesture differs. A builder that derived a band from the number
    // would pass the first row and fail this one.
    const evt = buildEdgeStrengthEditEvent({
      edge: edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED }),
      requestedMean: 0.55,
      preserveDirection: true,
    })
    expect(evt).not.toBeNull()
    expect('band' in (evt!.payload ?? {})).toBe(false)
    const wire = throughAdapterAndContract(evt)
    expect('band' in wire).toBe(false)
    expect(wire.magnitude).toBe(0.55)
  })

  it('a signed slider value (direction stated) also sends no band', () => {
    const evt = buildEdgeStrengthEditEvent({
      edge: edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED }),
      requestedMean: -0.62,
    })
    const wire = throughAdapterAndContract(evt)
    expect('band' in wire).toBe(false)
    expect(wire.direction_intent).toBe('negative')
  })
})

describe('Confirm ratifies the exact figure — it names no band', () => {
  it('confirm_current carries no `band` key, and parses under 0.60.0', () => {
    // The contract ALLOWS a band on confirm_current, and says a band confirm
    // SETS std from the band (the hash moves). The inspector's Confirm is "I agree
    // with this estimate" — an exact figure, which the contract spells as band ABSENT.
    const evt = buildEdgeStrengthConfirmEvent({ edge: edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED }) })
    expect('band' in ((evt as WireSystemEvent).payload ?? {})).toBe(false)
    const wire = throughAdapterAndContract(evt)
    expect(wire.intent).toBe('confirm_current')
    expect('band' in wire).toBe(false)
  })
})

describe('fail closed on the band', () => {
  it('a magnitude outside the picked band is refused, not sent (CEE’s writer refuses it)', () => {
    const e = edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED })
    // POSITIVE CONTROL: the band's own midpoint builds.
    expect(buildEdgeStrengthEditEvent({ edge: e, requestedMean: 0.55, preserveDirection: true, band: 'strong' })).not.toBeNull()
    // 0.30 is Moderate, not Strong.
    expect(buildEdgeStrengthEditEvent({ edge: e, requestedMean: 0.3, preserveDirection: true, band: 'strong' })).toBeNull()
    // The cut is [min, max): 0.70 is Very strong, not Strong.
    expect(buildEdgeStrengthEditEvent({ edge: e, requestedMean: 0.7, preserveDirection: true, band: 'strong' })).toBeNull()
    expect(buildEdgeStrengthEditEvent({ edge: e, requestedMean: 0.7, preserveDirection: true, band: 'veryStrong' })).not.toBeNull()
  })

  it('the app adapter refuses a band word outside the contract vocabulary (a strict reader would 422 the turn)', () => {
    const base = buildEdgeStrengthEditEvent({
      edge: edge({ ...DEFAULT_EDGE_DATA, ...POSITIVE_STATED }),
      requestedMean: 0.1,
      preserveDirection: true,
    })!
    const withBand = (band: unknown) =>
      buildV5Payload({
        turnId: '11111111-1111-4111-8111-111111111111',
        scenarioId: '22222222-2222-4222-8222-222222222222',
        stage: 'analyse',
        turnClass: 'system_event',
        mode: 'system',
        systemEvent: { ...base, payload: { ...base.payload, band } },
      } as unknown as Parameters<typeof buildV5Payload>[0])
    // POSITIVE CONTROL: the contract word passes.
    expect(withBand('slight').ok).toBe(true)
    // CEE's internal word, the canvas id, and the spaced label are NOT the contract's.
    expect(withBand('weak').ok).toBe(false)
    expect(withBand('veryStrong').ok).toBe(false)
    expect(withBand('very strong').ok).toBe(false)
  })
})

describe('the reader-first gate', () => {
  it('is OFF at its production value until CEE deploys a 0.60.0 reader', () => {
    // CEE staging pins schemas 0.59.0, whose strict `edge_strength_edit` member
    // has no `band`: an event carrying one would 422 the WHOLE turn. Flip this
    // only with CEE's deployed pin ≥ 0.60.0 in hand, and change this row with it.
    expect(EDGE_STRENGTH_BAND_ENABLED).toBe(false)
  })
})
