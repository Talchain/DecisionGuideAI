/**
 * Contract validation: CEE response envelopes → UI consumption
 *
 * Validates that representative CEE response payloads match the schema and
 * that the UI's validateEnvelopeShape() and validateResponse() can process
 * each one without throwing.
 */
import { describe, test, expect, vi } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// The canonical wire stage vocabulary — single source of truth. Exactly
// frame | analyse | decide | review (British `analyse`). Since the 2026-07-20
// re-sync (CEE #574 derives the export from this same Stage) the committed
// mirror AGREES with it — the "MIRROR CANONICAL" test at the end of the
// response-envelope block pins that agreement and fails loud on any new drift.
import { Stage } from '@talchain/schemas/boundary'

import responseSchema from '../../contracts/cee/orchestrator-response-v2.schema.json'
import streamEventSchema from '../../contracts/cee/stream-event.schema.json'

import { validateEnvelopeShape, validateResponse, validateStreamEventShape } from '../../src/canvas/conversation/validateResponse'

// Mock posthog — validateResponse and validateEnvelopeShape emit telemetry
vi.mock('../../src/lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Schema setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const validateResponseSchema = ajv.compile(responseSchema)
const validateStreamEvent = ajv.compile(streamEventSchema)

// ---------------------------------------------------------------------------
// Representative response fixtures
// ---------------------------------------------------------------------------

/**
 * Producer-required envelope scaffold. The re-synced CEE export (see
 * contracts/cee/README.md for source SHA/vintage) requires eleven top-level
 * fields on every envelope: turn_id, assistant_text, blocks, suggested_actions,
 * lineage, stage_indicator, science_ledger, progress_marker, observability,
 * turn_plan, guidance_items. Values below mirror CEE's own deterministic
 * fixture shapes; per-fixture fields override the scaffold.
 */
const producerRequiredScaffold = {
  turn_id: 'turn-contract-001',
  lineage: {
    context_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    dsk_version_hash: null,
  },
  science_ledger: {
    claims_used: [],
    techniques_used: [],
    scope_violations: [],
    phrasing_violations: [],
    rewrite_applied: false,
  },
  progress_marker: { kind: 'none' },
  observability: {
    triggers_fired: [],
    triggers_suppressed: [],
    intent_classification: 'conversation',
    specialist_contributions: [],
    specialist_disagreement: null,
  },
  turn_plan: { selected_tool: null, routing: 'llm', long_running: false },
  blocks: [],
  suggested_actions: [],
  guidance_items: [],
}

/** Success: full draft with graph patch, guidance, stage indicator */
const successEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: null,
  blocks: [
    {
      block_id: 'blk_graph_patch_7e2a2e78',
      block_type: 'graph_patch',
      data: {
        patch_type: 'full_draft',
        operations: [
          { op: 'add_node', path: '/nodes/goal_1', value: { id: 'goal_1', kind: 'goal', label: 'Maximise Revenue' } },
          { op: 'add_edge', path: '/edges/f1->goal_1', value: { from: 'f1', to: 'goal_1', effect_direction: 'positive' } },
        ],
        status: 'proposed',
        auto_apply: true,
      },
    },
    {
      // block_id is producer-required on every block (re-synced export)
      block_id: 'blk_commentary_9c1d4b21',
      block_type: 'commentary',
      data: { text: "I've created an initial model based on your brief." },
    },
  ],
  // Producer chip shape: { label, prompt, role } (re-synced export; role enum
  // facilitator|challenger, additionalProperties: false). The UI consumption
  // maps prompt → message (validateResponse), so these also exercise the
  // consumption path with the real wire shape.
  suggested_actions: [
    { label: 'Run Analysis', prompt: 'Run the analysis on this model', role: 'facilitator' },
    { label: 'Add factors', prompt: 'Help me add more factors', role: 'facilitator' },
  ],
  guidance_items: [
    {
      item_id: 'gi_1',
      signal_code: 'DEFAULT_NODE_CONFIDENCE',
      category: 'should_fix',
      source: 'structural',
      title: 'Subscription Price has default confidence',
      detail: 'Calibrate it for more accurate results.',
      // primary_action is a STRING in the producer schema (z.string()); the
      // target node lives in target_object.id. The previous object form
      // ({ type, node_id }) never matched the producer.
      primary_action: 'open_inspector',
      target_object: { type: 'node', id: 'fac_price', label: 'Subscription Price' },
      priority: 70,
    },
  ],
  progress_marker: { kind: 'changed_model' },
  turn_plan: { selected_tool: 'draft_graph', routing: 'llm', long_running: false },
  // Canonical wire stage (was 'ideate' — retired UI/DB vocab).
  stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
  client_turn_id: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
}

/** Success: analysis response with option_comparison */
const analysisEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: 'Analysis complete. Here are your results.',
  blocks: [
    {
      block_id: 'blk_fact_31f0aa02',
      block_type: 'fact',
      data: { label: 'Best Option', value: 'Keep at £49 (65% win probability)', source: 'analysis' },
    },
  ],
  analysis_response: {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    option_comparison: [
      { option_id: 'opt_keep', option_label: 'Keep at £49', win_probability: 0.65 },
      { option_id: 'opt_raise', option_label: 'Raise to £59', win_probability: 0.35 },
    ],
    critiques: [],
    response_hash: 'hash-abc123',
  },
  lineage: { ...producerRequiredScaffold.lineage, response_hash: 'hash-abc123' },
  progress_marker: { kind: 'ran_analysis' },
  observability: { ...producerRequiredScaffold.observability, intent_classification: 'run_analysis' },
  turn_plan: { selected_tool: 'run_analysis', routing: 'llm', long_running: true },
  // INTENT RESTORED (#390 note): this stage was omitted deliberately while the
  // drifted committed mirror rejected canonical 'analyse'. The re-synced mirror
  // accepts it, so a completed analysis now carries its true canonical stage.
  stage_indicator: { stage: 'analyse', confidence: 'high', source: 'explicit_event' },
}

/** Error: analysis failed */
const errorEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: null,
  analysis_error: {
    code: 'ANALYSIS_FAILED',
    message: 'Could not run analysis: graph is incomplete — add at least one factor node',
  },
  stage_indicator: { stage: 'frame', confidence: 'medium', source: 'inferred' },
}

/** Minimal: graph-only response (assistant_text null, no chips) */
const graphOnlyEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: null,
  blocks: [
    {
      block_id: 'blk_graph_patch_5a77c3e0',
      block_type: 'graph_patch',
      data: {
        patch_type: 'incremental',
        operations: [
          { op: 'add_node', path: '/nodes/fac_new', value: { id: 'fac_new', kind: 'factor', label: 'New Factor' } },
        ],
        auto_apply: true,
      },
    },
  ],
  progress_marker: { kind: 'changed_model' },
  stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
}

/** System event ack: stage update only */
const ackEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: 'Noted. I\'ve updated the model.',
  // Canonical wire stage (was 'ideate'). Source was 'event' — not a member of the
  // producer's source enum [explicit_event, inferred]; an ack of a system event
  // is an explicit_event by definition.
  stage_indicator: { stage: 'frame', confidence: 'medium', source: 'explicit_event' },
  client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
}

/** Conversation with route metadata */
const routeMetadataEnvelope = {
  ...producerRequiredScaffold,
  assistant_text: 'Here is my analysis of the pricing decision.',
  _route_metadata: {
    resolved_model: 'claude-sonnet-4-20250514',
    resolved_provider: 'anthropic',
  },
  turn_plan: {
    selected_tool: 'none',
    routing: 'llm',
    long_running: false,
    tool_latency_ms: 0,
  },
  stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
}

// ---------------------------------------------------------------------------
// Response envelope contract tests
// ---------------------------------------------------------------------------

describe('Response envelope contract', () => {
  test('success envelope with graph patch matches CEE schema', () => {
    const valid = validateResponseSchema(successEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('success envelope passes validateEnvelopeShape()', () => {
    const result = validateEnvelopeShape(successEnvelope)
    expect(result).toHaveProperty('blocks')
    expect(result).toHaveProperty('suggested_actions')
  })

  test('success envelope passes validateResponse()', () => {
    const { cleaned, repairs } = validateResponse(successEnvelope as any)
    expect(cleaned).toHaveProperty('blocks')
    expect(cleaned).toHaveProperty('suggested_actions')
    expect(repairs).toHaveLength(0)
  })

  test('analysis envelope with option_comparison matches CEE schema', () => {
    const valid = validateResponseSchema(analysisEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('analysis envelope passes validateEnvelopeShape()', () => {
    const result = validateEnvelopeShape(analysisEnvelope)
    expect(result).toHaveProperty('analysis_response')
  })

  test('error envelope matches CEE schema', () => {
    const valid = validateResponseSchema(errorEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('error envelope passes validateEnvelopeShape()', () => {
    const result = validateEnvelopeShape(errorEnvelope)
    expect(result).toHaveProperty('analysis_error')
  })

  test('graph-only envelope matches CEE schema', () => {
    const valid = validateResponseSchema(graphOnlyEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('graph-only envelope passes validateEnvelopeShape()', () => {
    const result = validateEnvelopeShape(graphOnlyEnvelope)
    expect(result).toHaveProperty('blocks')
  })

  test('ack envelope matches CEE schema', () => {
    const valid = validateResponseSchema(ackEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('ack envelope passes validateEnvelopeShape()', () => {
    const result = validateEnvelopeShape(ackEnvelope)
    expect(result).toHaveProperty('assistant_text')
  })

  test('envelope with route metadata matches CEE schema', () => {
    const valid = validateResponseSchema(routeMetadataEnvelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('bare-string stage_indicator is retired — the wire shape is object-only', () => {
    // The pre-resync mirror allowed stage_indicator as a bare string. The
    // producer schema (re-synced export, faithful to CEE's zod) types it as an
    // object { stage, confidence, source } only. Pin the retirement: a
    // string-form envelope no longer validates, while the value itself remains
    // canonical per Stage (so this failure is about SHAPE, not vocabulary).
    const envelope = { ...producerRequiredScaffold, assistant_text: 'Hello', stage_indicator: 'frame' }
    expect(Stage.safeParse(envelope.stage_indicator).success).toBe(true)
    expect(validateResponseSchema(envelope)).toBe(false)
  })

  test('canonical object stage_indicator validates', () => {
    const envelope = {
      ...producerRequiredScaffold,
      assistant_text: 'Hello',
      stage_indicator: { stage: 'frame', confidence: 'high', source: 'inferred' },
    }
    expect(Stage.safeParse(envelope.stage_indicator.stage).success).toBe(true)
    const valid = validateResponseSchema(envelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  // ── MIRROR CANONICAL — flipped tripwire ──────────────────────────────────
  // Until the 2026-07-20 re-sync this was the #390 KNOWN DEFECT tripwire: it
  // PINNED the drifted mirror (accepts retired 'ideate', rejects canonical
  // 'analyse') and was designed to go RED the moment the mirror was corrected.
  // It went RED on re-syncing from CEE's derived export (CEE #574, source SHA
  // in contracts/cee/README.md) — the design working — and is now flipped to
  // pin the CORRECTED state. If it ever fails again, the mirror has drifted
  // from the canonical Stage vocabulary: re-sync before touching this test.

  test('MIRROR CANONICAL: response mirror accepts every canonical stage and rejects every retired one', () => {
    const envelopeWithStage = (stage: string) => ({
      ...producerRequiredScaffold,
      assistant_text: 'x',
      stage_indicator: { stage, confidence: 'high', source: 'inferred' },
    })

    // Every canonical member — iterated from Stage.options (derive, don't
    // hand-list; a re-hardcoded copy that later drifts would fail here).
    for (const stage of Stage.options) {
      const valid = validateResponseSchema(envelopeWithStage(stage))
      if (!valid) console.error(`canonical '${stage}' rejected:`, validateResponseSchema.errors)
      expect(valid).toBe(true)
      expect(Stage.safeParse(stage).success).toBe(true)
    }

    // Every retired member (the historical 5-stage vocabulary minus the
    // canonical survivors) is rejected by mirror AND source of truth.
    for (const retired of ['ideate', 'evaluate', 'optimise']) {
      expect(validateResponseSchema(envelopeWithStage(retired))).toBe(false)
      expect(Stage.safeParse(retired).success).toBe(false)
    }

    // Positive control: nonsense rejected — the field is enum-typed.
    expect(validateResponseSchema(envelopeWithStage('not_a_stage_xyz'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Stream event contract tests
// ---------------------------------------------------------------------------

describe('Stream event contract', () => {
  test('turn_start event validates', () => {
    // Canonical wire stage (was 'ideate'). NB the stream mirror types `stage` as a
    // bare string (no enum) — see the KNOWN GAP tripwire below — so any value would
    // validate; 'frame' is used to keep the fixture canonical regardless.
    const event = { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'frame' }
    const valid = validateStreamEvent(event)
    if (!valid) console.error('Validation errors:', validateStreamEvent.errors)
    expect(valid).toBe(true)
  })

  test('KNOWN GAP: stream turn_start.stage is an untyped bare string — nonsense validates', () => {
    // The stream-event mirror types `stage` as { type: 'string' } with no enum, so
    // it cannot catch a wrong stage value at all. Positive control proves it: an
    // absurd value validates. Tripwire — fails loud if `stage` is ever tightened to
    // the canonical Stage enum. RE-VERIFIED at the 2026-07-20 re-sync (source SHA
    // in contracts/cee/README.md): CEE #574 corrected the response envelope but
    // did NOT touch the stream schema — turn_start.stage is still z.string()
    // (minLength 1 only), so this gap tripwire STAYS. See PR body / cross-repo ask.
    const nonsense = { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'not_a_stage_xyz' }
    expect(validateStreamEvent(nonsense)).toBe(true) // permissive — zero protection
    expect(Stage.safeParse('not_a_stage_xyz').success).toBe(false)
  })

  test('text_delta event validates', () => {
    const event = { type: 'text_delta', seq: 2, delta: 'Hello ' }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('tool_start event validates', () => {
    const event = { type: 'tool_start', seq: 3, tool_name: 'run_analysis', long_running: true }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('block event validates', () => {
    // Re-synced stream schema requires block.block_type (block.type was never
    // the producer's field name); payload lives under data.
    const event = { type: 'block', seq: 4, block: { block_type: 'commentary', data: { text: 'Insight here' } } }
    const valid = validateStreamEvent(event)
    if (!valid) console.error('Validation errors:', validateStreamEvent.errors)
    expect(valid).toBe(true)
  })

  test('tool_result event validates', () => {
    const event = { type: 'tool_result', seq: 5, tool_name: 'run_analysis', success: true, duration_ms: 1200 }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('turn_complete event validates', () => {
    // Re-synced stream schema requires the nested envelope to carry turn_id,
    // assistant_text, blocks and lineage.context_hash (a subset of the full
    // envelope contract — the stream variant is looser than the response one).
    const event = {
      type: 'turn_complete',
      seq: 6,
      envelope: {
        turn_id: 'turn-stream-001',
        assistant_text: 'Done',
        blocks: [],
        lineage: { context_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
      },
    }
    const valid = validateStreamEvent(event)
    if (!valid) console.error('Validation errors:', validateStreamEvent.errors)
    expect(valid).toBe(true)
  })

  test('error event validates', () => {
    const event = { type: 'error', seq: 7, error: { code: 'INTERNAL', message: 'Something broke' }, recoverable: true }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('turn_complete with nested envelope passes validateStreamEventShape()', () => {
    const parsed = { type: 'turn_complete', seq: 6, envelope: { assistant_text: 'Done' } }
    const result = validateStreamEventShape(parsed, 'turn_complete')
    expect(result).not.toBeNull()
    expect(result?.type).toBe('turn_complete')
  })
})
