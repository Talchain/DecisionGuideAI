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

/** Success: full draft with graph patch, guidance, stage indicator */
const successEnvelope = {
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
      block_type: 'commentary',
      data: { text: "I've created an initial model based on your brief." },
    },
  ],
  suggested_actions: [
    { id: 'chip-1', label: 'Run Analysis', intent: 'primary', message: 'Run the analysis on this model' },
    { id: 'chip-2', label: 'Add factors', intent: 'secondary', message: 'Help me add more factors' },
  ],
  guidance_items: [
    {
      item_id: 'gi_1',
      signal_code: 'DEFAULT_NODE_CONFIDENCE',
      category: 'should_fix',
      source: 'structural',
      title: 'Subscription Price has default confidence',
      detail: 'Calibrate it for more accurate results.',
      primary_action: { type: 'open_inspector', node_id: 'fac_price' },
      target_object: { type: 'node', id: 'fac_price', label: 'Subscription Price' },
      priority: 70,
    },
  ],
  stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
  client_turn_id: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
}

/** Success: analysis response with option_comparison */
const analysisEnvelope = {
  assistant_text: 'Analysis complete. Here are your results.',
  blocks: [
    {
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
  stage_indicator: 'evaluate',
}

/** Error: analysis failed */
const errorEnvelope = {
  assistant_text: null,
  analysis_error: {
    code: 'ANALYSIS_FAILED',
    message: 'Could not run analysis: graph is incomplete — add at least one factor node',
  },
}

/** Minimal: graph-only response (assistant_text null, no chips) */
const graphOnlyEnvelope = {
  assistant_text: null,
  blocks: [
    {
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
}

/** System event ack: stage update only */
const ackEnvelope = {
  assistant_text: 'Noted. I\'ve updated the model.',
  stage_indicator: { stage: 'ideate', confidence: 'medium', source: 'event' },
  client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
}

/** Conversation with route metadata */
const routeMetadataEnvelope = {
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

  test('string stage_indicator validates', () => {
    const envelope = { assistant_text: 'Hello', stage_indicator: 'evaluate' }
    const valid = validateResponseSchema(envelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })

  test('object stage_indicator validates', () => {
    const envelope = {
      assistant_text: 'Hello',
      stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
    }
    const valid = validateResponseSchema(envelope)
    if (!valid) console.error('Validation errors:', validateResponseSchema.errors)
    expect(valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Stream event contract tests
// ---------------------------------------------------------------------------

describe('Stream event contract', () => {
  test('turn_start event validates', () => {
    const event = { type: 'turn_start', seq: 1, turn_id: 't-1', routing: 'llm', stage: 'ideate' }
    const valid = validateStreamEvent(event)
    if (!valid) console.error('Validation errors:', validateStreamEvent.errors)
    expect(valid).toBe(true)
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
    const event = { type: 'block', seq: 4, block: { type: 'commentary', text: 'Insight here' } }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('tool_result event validates', () => {
    const event = { type: 'tool_result', seq: 5, tool_name: 'run_analysis', success: true, duration_ms: 1200 }
    expect(validateStreamEvent(event)).toBe(true)
  })

  test('turn_complete event validates', () => {
    const event = { type: 'turn_complete', seq: 6, envelope: { assistant_text: 'Done', blocks: [] } }
    expect(validateStreamEvent(event)).toBe(true)
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
