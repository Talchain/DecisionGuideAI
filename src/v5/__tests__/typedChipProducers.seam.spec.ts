/**
 * Lane U seam pin — typed chip PRODUCER → the ACTUAL HTTP body.
 *
 * Composes the REAL production seam the chip-dispatch call site uses —
 * buildChipMeta (canvas/conversation/chipMeta, the pure leaf dispatchAction
 * calls) → buildV5Payload → callV5Turn(fetchImpl) — and asserts on
 * JSON.parse(init.body). The wire is the truth. This is the exact pattern
 * goalThreshold.chipToWire.spec.ts pins for goal_threshold, extended to the four
 * S2 producers: first-class `chip.id`, typed `chip.intent`, and genuinely-typed
 * FINITE `chip.parameters` for set_factor_value / adjust_edge_strength /
 * add_constraint / add_option.
 *
 * Every asserted body is ALSO validated against OrchestratorTurnPayloadSchema
 * (0.22, `.strict()` on the chip) so a shape drift between producer and wire
 * schema fails the test.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import { buildChipMeta, type ChipMetaInput } from '../../canvas/conversation/chipMeta'
import { buildV5Payload, type BuildV5PayloadInput } from '../buildPayload'
import { callV5Turn } from '../v5Adapter'
import {
  buildSetFactorValueParameters,
  buildAdjustEdgeStrengthParameters,
  buildAddConstraintParameters,
  buildAddOptionParameters,
  ADD_OPTION_INTENT,
} from '../chipParameters'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeFetchImpl() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ response_version: 1, assistant_text: 'ok', blocks: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

interface WireChip {
  id?: string
  action_type?: string
  intent?: string
  parameters?: Record<string, unknown>
}

/**
 * Drive the real seam: a chip's raw dispatch opts → buildChipMeta → buildV5Payload
 * → callV5Turn(fetchImpl). Returns the parsed HTTP body. Also parses the body
 * back through the 0.22 schema so any strict-mode drift fails here.
 */
async function wireBody(
  chipInput: ChipMetaInput,
  source: string,
): Promise<{ source?: string; chip?: WireChip }> {
  const chipMeta = buildChipMeta(chipInput)
  const input: BuildV5PayloadInput = {
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'analyse',
    turnClass: 'frame',
    mode: 'user',
    message: 'typed chip click',
    source,
    chipMeta,
  }
  const build = buildV5Payload(input)
  if (!build.ok) throw new Error('payload build failed: ' + JSON.stringify(build))
  // The producer's output must satisfy the 0.22 wire schema before it ships.
  expect(() => OrchestratorTurnPayloadSchema.parse(build.payload)).not.toThrow()
  const fetchImpl = makeFetchImpl()
  await callV5Turn(build.payload, { fetchImpl })
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  const init = fetchImpl.mock.calls[0][1] as { body: string }
  return JSON.parse(init.body) as { source?: string; chip?: WireChip }
}

describe('typed mutation chips → HTTP body (finite numbers, CEE field names)', () => {
  it('set_factor_value: typed value reaches the body as a real number, source promoted to chip_click', async () => {
    const params = buildSetFactorValueParameters({ targetId: 'factor_price', value: 140, unit: '£' })
    if (!params.ok) throw new Error('builder refused: ' + params.reason)
    const body = await wireBody(
      { id: 'chip_price', action_type: 'set_factor_value', parameters: params.parameters },
      'chip',
    )
    // A bound action_type promotes a plain chip to chip_click — required for the
    // typed-chip reader door (route-v2 isNonReadinessTypedChipClickForExecutor).
    expect(body.source).toBe('chip_click')
    expect(body.chip).toEqual({
      id: 'chip_price',
      action_type: 'set_factor_value',
      parameters: { target_id: 'factor_price', value: 140, unit: '£' },
    })
    expect(typeof body.chip?.parameters?.value).toBe('number')
    // The value is NEVER stringified onto the wire.
    expect(JSON.stringify(body)).toContain('"value":140')
    expect(JSON.stringify(body)).not.toContain('"value":"140"')
  })

  it('adjust_edge_strength: composed edge id + finite strength/std reach the body', async () => {
    const params = buildAdjustEdgeStrengthParameters({ targetId: 'a→b', value: 0.4, std: 0.1 })
    if (!params.ok) throw new Error('builder refused: ' + params.reason)
    const body = await wireBody(
      { action_type: 'adjust_edge_strength', parameters: params.parameters },
      'chip',
    )
    expect(body.source).toBe('chip_click')
    expect(body.chip).toEqual({
      action_type: 'adjust_edge_strength',
      parameters: { target_id: 'a→b', value: 0.4, std: 0.1 },
    })
    expect(typeof body.chip?.parameters?.value).toBe('number')
    expect(typeof body.chip?.parameters?.std).toBe('number')
  })

  it('add_constraint: target + direction + finite value reach the body', async () => {
    const params = buildAddConstraintParameters({
      targetId: 'goal_1',
      constraintType: 'at_least',
      value: 0.15,
    })
    if (!params.ok) throw new Error('builder refused: ' + params.reason)
    const body = await wireBody(
      { action_type: 'add_constraint', parameters: params.parameters },
      'chip',
    )
    expect(body.chip).toEqual({
      action_type: 'add_constraint',
      parameters: { target_id: 'goal_1', constraint_type: 'at_least', value: 0.15 },
    })
    expect(typeof body.chip?.parameters?.value).toBe('number')
  })
})

describe('add_option intent chip → HTTP body (Intent, not action_type)', () => {
  it('ships chip.intent=add_option with typed interventions and NO action_type', async () => {
    const params = buildAddOptionParameters({
      parentDecisionId: 'decision_1',
      label: 'Hybrid plan',
      interventions: [
        { factorId: 'factor_price', value: 49 },
        { factorId: 'factor_support', value: 2 },
      ],
    })
    if (!params.ok) throw new Error('builder refused: ' + params.reason)
    const body = await wireBody(
      { intent: ADD_OPTION_INTENT, parameters: params.parameters },
      // getInsightAction-class source — CEE accepts source ∈ {chip, chip_click}
      // for chip.intent==='add_option' (route-v2.ts:2198).
      'insight',
    )
    expect(body.source).toBe('chip')
    expect(body.chip?.intent).toBe('add_option')
    expect(body.chip && 'action_type' in body.chip).toBe(false)
    expect(body.chip?.parameters).toEqual({
      parent_decision_id: 'decision_1',
      label: 'Hybrid plan',
      interventions: [
        { factor_id: 'factor_price', value: 49 },
        { factor_id: 'factor_support', value: 2 },
      ],
    })
  })
})

describe('first-class chip.id lift + intent send gate', () => {
  it('lifts parameters.chip_id to a first-class chip.id (identity promoted, parameters preserved)', async () => {
    const body = await wireBody({ parameters: { chip_id: 'decision_run_analysis' } }, 'chip')
    expect(body.chip?.id).toBe('decision_run_analysis')
    // Back-compat: the id STILL rides parameters until CEE reads chip.id.
    expect(body.chip?.parameters).toEqual({ chip_id: 'decision_run_analysis' })
  })

  it('lifts parameters.spark_id when no chip_id and no explicit id is present', async () => {
    const body = await wireBody({ parameters: { spark_id: 'prepare_first_analysis' } }, 'chip')
    expect(body.chip?.id).toBe('prepare_first_analysis')
  })

  it('an explicit id wins over the parameters lift', async () => {
    const body = await wireBody({ id: 'explicit', parameters: { chip_id: 'derived' } }, 'chip')
    expect(body.chip?.id).toBe('explicit')
  })

  it('WITHHOLDS a not-yet-accepted intent (challenge_frame) — no intent key on the wire', async () => {
    const body = await wireBody(
      { intent: 'challenge_frame', parameters: { spark_id: 'frame_1' } },
      'chip',
    )
    // The gate fails closed: the chip behaves like an identity-only chip.
    expect(body.chip && 'intent' in body.chip).toBe(false)
    expect(body.chip?.id).toBe('frame_1')
    expect(body.chip?.parameters).toEqual({ spark_id: 'frame_1' })
  })
})
