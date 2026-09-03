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
import { CEE_ACCEPTED_INTENTS, KNOWN_INTENTS, buildV5Payload, type BuildV5PayloadInput } from '../buildPayload'
import { ACTIONS_MENU, SPARK_PROMPTS } from '../../canvas/components/pre-analysis-v3/constants'
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

  it('WITHHOLDS a not-yet-accepted intent (mitigation_help) — no intent key on the wire', async () => {
    // `mitigation_help` is PUBLISHED in the vendored enum and CEE has no arm
    // for it — so the gate must still fail closed and the chip behave like an
    // identity-only chip. (This case has now moved TWICE: it was
    // `challenge_frame`, then `pre_mortem`, and each move happened because the
    // intent it named became routed. That is the decay this fixture is prone
    // to, so the precondition below is asserted IN-TEST rather than trusted.)
    //
    // ⭐ PRECONDITION PIN (trap 13b). Without these two lines this test passes
    // for the WRONG REASON the moment `mitigation_help` is routed: the withhold
    // arm would silently stop discriminating and assert nothing, exactly as it
    // would have done here had the move been missed. It REDs instead.
    expect(
      KNOWN_INTENTS.has('mitigation_help' as never),
      'mitigation_help must be PUBLISHED, or this fixture proves nothing about the gate — ' +
        'an unpublished token is withheld by the other conjunct',
    ).toBe(true)
    expect(
      CEE_ACCEPTED_INTENTS.has('mitigation_help' as never),
      'mitigation_help is now ACCEPTED, so this withhold fixture no longer discriminates — ' +
        'move it to an intent CEE still does not route, do not delete the case',
    ).toBe(false)

    const body = await wireBody(
      { intent: 'mitigation_help', parameters: { spark_id: 'mitigation_probe' } },
      'chip',
    )
    expect(body.chip && 'intent' in body.chip).toBe(false)
    expect(body.chip?.id).toBe('mitigation_probe')
    expect(body.chip?.parameters).toEqual({ spark_id: 'mitigation_probe' })
  })

  it('SENDS a routed intent on the same turn shape — the withhold above is the gate, not the shape', async () => {
    // ⭐ THE OTHER HALF OF THE DISCRIMINATING PAIR. The withhold assertion
    // above is satisfied by a build that drops EVERY intent (or by a broken
    // `wireBody` that never emits a chip.intent at all). This runs the SAME
    // helper, the same source and the same parameter shape with a routed
    // intent, so the only difference between the two outcomes is the gate.
    expect(CEE_ACCEPTED_INTENTS.has('pre_mortem' as never)).toBe(true)
    const body = await wireBody(
      { intent: 'pre_mortem', parameters: { spark_id: 'mitigation_probe' } },
      'chip',
    )
    expect(body.chip?.intent).toBe('pre_mortem')
    expect(body.chip?.id).toBe('mitigation_probe')
  })
})

/**
 * ⭐⭐ THE PRODUCER→WIRE CHAIN FOR A TYPED COACHING INTENT — the capability this
 * lane exists to deliver, asserted on the ACTUAL HTTP BODY.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `CEE_ACCEPTED_INTENTS` had exactly ONE member. The MOUNTED coaching sparks
 * carry `action_type: null` (no honest handler exists for a conversation and
 * the count belongs to `constants.ts`, not to this line) and, until
 * now, carried nothing else either — so the click reached CEE as anonymous
 * prose and CEE re-inferred the intent from the message text. On the widening
 * card the fall-through was worse than silent: the turn took the free-text edit
 * lane, came back a REFUSAL, and the recovery chips replaced the row that held
 * `Run analysis` (ROADMAP 2.1288, DOM-witnessed 2/2 on 17 Aug). The user
 * accepted the product's own suggestion and paid for it with their ability to
 * run.
 *
 * ── DERIVED FROM THE REGISTRY, NEVER FROM A HAND-TYPED LIST ──────────────────
 * The cases below are built by READING the mounted spark registry
 * (`ACTIONS_MENU` / `SPARK_PROMPTS`) and filtering to the sparks that declare an
 * intent. A test that hand-typed `'challenge_frame'` would pass while the spark
 * a user actually clicks declared something else, or nothing at all — the exact
 * gap that let four mounted affordances sit untyped for weeks. Here, unmount a
 * spark or drop its intent and this suite stops covering it AND the count
 * assertion REDs.
 */
describe('typed coaching intents — mounted spark → chip.intent on the wire', () => {
  /**
   * Every mounted spark that declares a typed wire intent, read from the
   * registry and DEDUPED BY ID.
   *
   * The dedupe is not tidiness — `SPARK_PROMPTS` ALIASES five `ACTIONS_MENU`
   * entries via `fromActionsMenu` (`widen_options`, `pre_mortem`,
   * `calibrate_estimates`, `pressure_test_frame`, `risks_upside`), so five
   * affordances each have two mount points; only `define_success` and
   * `reflect_bias` are declared inline with no menu counterpart. Without the
   * dedupe the contrast assertion below reported the same spark twice and read
   * as a registry defect. One affordance, one row.
   */
  const declaringSparks = [...new Map(
    [...ACTIONS_MENU, ...Object.values(SPARK_PROMPTS)]
      .filter((s): s is typeof s & { intent: string } => typeof s.intent === 'string' && s.intent.length > 0)
      .map(s => [s.id, s] as const),
  ).values()]

  it('the registry declares intents at all — the sweep is not empty', () => {
    // Trap 13: `it.each` over an empty array reports ZERO tests and a GREEN
    // suite. The count is asserted by name so an emptied registry REDs here
    // rather than silently deleting the coverage below.
    //
    // EXACT, not a floor: six ACTIONS_MENU entries declare an intent
    // (`compare_view` and `prepare_first_analysis` declare `null`) and two
    // panel-only sparks add `define_success` and `reflect_bias` — eight after
    // the dedupe. A `>=` floor cannot see a spark that LOSES its intent while
    // another gains one, which is the drift this assertion exists to catch.
    expect(declaringSparks.length).toBe(8)
  })

  it.each(declaringSparks.map(s => [s.id, s.intent] as const))(
    'spark %s declares intent %s — and the gate decides, not the declaration',
    async (sparkId, intent) => {
      const body = await wireBody({ intent, parameters: { spark_id: sparkId } }, 'chip')
      const accepted = CEE_ACCEPTED_INTENTS.has(intent as never)
      if (accepted) {
        expect(
          body.chip?.intent,
          `${sparkId} declares an ACCEPTED intent but it did not reach the wire — ` +
            'the chip has degraded to anonymous prose, which is the defect this closes',
        ).toBe(intent)
      } else {
        expect(
          body.chip && 'intent' in body.chip,
          `${sparkId} declares ${intent}, which CEE does not route — sending it would ` +
            'claim a capability the deployed service does not have',
        ).toBe(false)
      }
      // Identity travels either way, so an unrouted spark is no worse off than
      // before this lane.
      expect(body.chip?.id).toBe(sparkId)
    },
  )

  it('CONTRAST — at least one spark is SENT and at least one is WITHHELD', () => {
    // ⭐ Without this the it.each above is satisfied by a build where the gate
    // accepts EVERYTHING (every branch takes the `accepted` arm) or accepts
    // NOTHING (every branch takes the withhold arm). Neither would be caught by
    // a per-case assertion, because each case would still agree with itself.
    const sent = declaringSparks.filter(s => CEE_ACCEPTED_INTENTS.has(s.intent as never))
    const withheld = declaringSparks.filter(s => !CEE_ACCEPTED_INTENTS.has(s.intent as never))
    expect(sent.map(s => s.id).sort()).toEqual(
      [
        'define_success',
        // The three sparks this lane lit up (CEE #1321 + the accepted-list
        // widening). They are SPARK ids; `risks_upside` carries `elicit_risks`.
        'outside_view',
        'pre_mortem',
        'pressure_test_frame',
        'reflect_bias',
        'risks_upside',
        'widen_options',
      ],
    )
    // ⭐ The withheld arm is pinned BY IDENTITY, not by a count. A bare
    // `length > 0` cannot see the one withhold that actually matters —
    // `calibrate_estimates`/`estimate_help`, which must NOT become sendable
    // because its spark also carries `action_type: 'analysis_readiness'`.
    // A count would stay green if that spark were sent and some other one
    // dropped instead.
    expect(withheld.map(s => s.id).sort()).toEqual(['calibrate_estimates'])
  })

  it('a composer turn carrying the same intent value still sends it — the gate is not source-scoped', async () => {
    // The gate is about the VALUE, not the surface. Pinned so a future
    // source-scoped narrowing is a deliberate, visible change rather than a
    // silent one.
    const body = await wireBody({ intent: 'challenge_frame', parameters: { spark_id: 'x' } }, 'chip_click')
    expect(body.chip?.intent).toBe('challenge_frame')
  })
})
