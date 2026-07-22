/**
 * buildV5Payload — covers every row in
 * docs/v5/ui-outbound-payload-coverage.md.
 *
 * Each test asserts both (a) the payload wire shape matches the coverage
 * table AND (b) the v0.7.0 schema accepts the output (parse round-trip).
 * A shape drift between builder and schema fails the test.
 */
import { describe, it, expect } from 'vitest'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { buildV5Payload } from '../buildPayload'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'
const PRIOR_TURN_ID = '33333333-3333-4333-8333-333333333333'

function assertOk(
  result: ReturnType<typeof buildV5Payload>,
): Extract<ReturnType<typeof buildV5Payload>, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok; got ${result.reason} ${result.detail ?? ''}`)
  return result
}

describe('buildV5Payload — message payloads', () => {
  it('composer: submit brief (text)', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Help me decide between A and B.',
      }),
    )
    expect(r.payload).toMatchObject({
      kind: 'message',
      source: 'composer',
      message: 'Help me decide between A and B.',
      turn_class: 'frame',
      stage: 'frame',
    })
    // @ts-expect-error — narrow union manually for the chip check
    expect(r.payload.chip).toBeUndefined()
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('composer: free-text follow-up', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'analyse',
        turnClass: 'clarify',
        mode: 'user',
        message: 'Why does option A win?',
      }),
    )
    expect(r.payload.kind).toBe('message')
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('composer')
    // @ts-expect-error narrow union
    expect(r.payload.turn_class).toBe('clarify')
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('chip: plain message chip (no action_type)', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Tell me more',
        source: 'chip',
        chipMeta: { parameters: { context: 'option_a' } },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ parameters: { context: 'option_a' } })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('chip_click: bound action chip (run_analysis)', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'analyse',
        turnClass: 'frame',
        mode: 'user',
        message: 'Run analysis',
        source: 'chip_click',
        chipMeta: { action_type: 'run_analysis', parameters: { seed: 42 } },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip_click')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ action_type: 'run_analysis', parameters: { seed: 42 } })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('chip_click: unknown action_type is dropped (not surfaced to wire)', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Do the thing',
        source: 'chip_click',
        chipMeta: { action_type: 'future_unknown_action', parameters: { x: 1 } },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ parameters: { x: 1 } })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('retry: reuses message, carries source=retry', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Original question',
        source: 'retry',
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('retry')
    // @ts-expect-error narrow union
    expect(r.payload.retry_of).toBeUndefined()
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('retry: includes retry_of when explicitly provided', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Original',
        source: 'retry',
        retryOf: PRIOR_TURN_ID,
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.retry_of).toBe(PRIOR_TURN_ID)
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('rejects empty message on user mode', () => {
    const r = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'user',
      message: '   ',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('missing_message')
  })

  it('source derivation: caller source=chip + bound action_type is promoted to chip_click', () => {
    // UI dispatchAction currently forwards source='chip' for every chip click,
    // regardless of whether chipMeta carries an action_type. The builder
    // promotes bound actions to chip_click so the CEE dispatcher routes
    // correctly. Without this derivation, analysis chips would arrive as
    // plain chip messages and skip the deterministic handler path.
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'analyse',
        turnClass: 'frame',
        mode: 'user',
        message: 'Run analysis',
        source: 'chip',
        chipMeta: { action_type: 'run_analysis' },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip_click')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ action_type: 'run_analysis' })
  })

  it('source derivation: caller source=chip + chipMeta without action_type stays chip', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'tell me more',
        source: 'chip',
        chipMeta: { parameters: { ctx: 'opt_a' } },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ parameters: { ctx: 'opt_a' } })
  })

  it('source derivation: retry always wins over chipMeta (retry reply to a chip failure)', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'Run analysis',
        source: 'retry',
        chipMeta: { action_type: 'run_analysis' },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('retry')
    // retry drops chip (only chip / chip_click sources surface chip).
    // @ts-expect-error narrow union
    expect(r.payload.chip).toBeUndefined()
  })

  it('derivation: composer + chipMeta + bound action → promoted to chip_click', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'hi',
        source: 'composer',
        chipMeta: { action_type: 'run_analysis' },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip_click')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ action_type: 'run_analysis' })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })
})

describe('buildV5Payload — system_event payloads', () => {
  it('patch_accepted', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: { type: 'patch_accepted', payload: { patch_id: 'patch-abc' } },
      }),
    )
    expect(r.payload.kind).toBe('system_event')
    // @ts-expect-error narrow union
    expect(r.payload.event).toEqual({ kind: 'patch_accepted', patch_id: 'patch-abc' })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('patch_dismissed', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: { type: 'patch_dismissed', payload: { patch_id: 'patch-xyz' } },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.event).toEqual({ kind: 'patch_dismissed', patch_id: 'patch-xyz' })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('direct_graph_edit', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: {
          type: 'direct_graph_edit',
          payload: { target_id: 'node-1', operation: 'set_factor_value' },
        },
      }),
    )
    // @ts-expect-error narrow union
    expect(r.payload.event).toEqual({
      kind: 'direct_graph_edit',
      target_id: 'node-1',
      operation: 'set_factor_value',
    })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('direct_analysis_run maps to a message payload with chip.action_type=run_analysis', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'analyse',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: { type: 'direct_analysis_run' },
      }),
    )
    expect(r.payload.kind).toBe('message')
    // @ts-expect-error narrow union
    expect(r.payload.source).toBe('chip_click')
    // @ts-expect-error narrow union
    expect(r.payload.chip).toEqual({ action_type: 'run_analysis' })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('patch_accepted without patch_id → unsupported_system_event', () => {
    const r = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'system',
      systemEvent: { type: 'patch_accepted', payload: {} },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unsupported_system_event')
  })

  // F7 (feedback thumbs = wire). Seam test driven from the REAL emitter shape:
  // ConversationPanel.handleFeedback dispatches
  //   { type: 'feedback_submitted', payload: { turn_id, rating } }
  // for a whole-turn thumbs rating. These pin that exact object through the
  // builder to the vendored 0.22 boundary schema (was pinned as a silent drop).
  it('feedback_submitted (thumbs up) → typed feedback wire event', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: { type: 'feedback_submitted', payload: { turn_id: TURN_ID, rating: 'up' } },
      }),
    )
    expect(r.payload).toMatchObject({
      kind: 'system_event',
      event: { kind: 'feedback', rating: 'up', target: { id: TURN_ID, kind: 'turn' } },
    })
    // Real boundary: the vendored 0.22 Zod schema must accept the output.
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('feedback_submitted (thumbs down) → rating carried through unchanged', () => {
    const r = assertOk(
      buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'system',
        systemEvent: { type: 'feedback_submitted', payload: { turn_id: TURN_ID, rating: 'down' } },
      }),
    )
    expect(r.payload).toMatchObject({
      kind: 'system_event',
      event: { kind: 'feedback', rating: 'down', target: { id: TURN_ID, kind: 'turn' } },
    })
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })

  it('feedback_submitted with an invalid rating → unsupported (fail closed)', () => {
    const r = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'system',
      systemEvent: { type: 'feedback_submitted', payload: { rating: 5 } },
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unsupported_system_event')
  })

  it('no systemEvent on system mode → unsupported', () => {
    const r = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame',
      turnClass: 'frame',
      mode: 'system',
    })
    expect(r.ok).toBe(false)
  })
})

describe('buildV5Payload — scenario_id lifecycle', () => {
  it('same scenario_id is sent on first and second turns (reuse across session)', () => {
    // Simulates the useConversation pattern: a fixed scenario_id allocated on
    // the first turn is forwarded verbatim on the second. This directly covers
    // the scenario lifecycle bug where a new UUID was allocated per-turn.
    const firstTurn = assertOk(
      buildV5Payload({
        turnId: '11111111-1111-4111-8111-111111111111',
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'I need to decide between hiring and contracting.',
      }),
    )
    const secondTurn = assertOk(
      buildV5Payload({
        turnId: '44444444-4444-4444-8444-444444444444',
        scenarioId: SCENARIO_ID,
        stage: 'frame',
        turnClass: 'frame',
        mode: 'user',
        message: 'What factors matter most?',
      }),
    )
    // turn_ids differ (two distinct turns)
    expect(firstTurn.payload.turn_id).not.toBe(secondTurn.payload.turn_id)
    // scenario_id must be identical — same session, same scenario
    expect(firstTurn.payload.scenario_id).toBe(SCENARIO_ID)
    expect(secondTurn.payload.scenario_id).toBe(SCENARIO_ID)
    // Both schema-valid
    expect(() => OrchestratorTurnPayloadSchema.parse(firstTurn.payload)).not.toThrow()
    expect(() => OrchestratorTurnPayloadSchema.parse(secondTurn.payload)).not.toThrow()
  })
})
