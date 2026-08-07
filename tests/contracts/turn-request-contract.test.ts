/**
 * Contract validation: UI turn request builders → CEE schema
 *
 * Validates that every turn type the UI can send matches the structural
 * contract CEE expects. Uses the actual builder functions with representative
 * data — not hand-crafted minimal payloads.
 *
 * PROVENANCE (2026-07-20 re-sync — see contracts/cee/README.md for source SHA):
 * CEE exports turn-request/system-event/analysis-state/graph-state from
 * src/orchestrator/route-schemas.ts, which validates POST /orchestrate/v1/turn —
 * a surface that returns 410 on live deploys (V4 disabled; live turns go to
 * /orchestrate/v2/turn, validated by @talchain/schemas/boundary). These tests
 * therefore pin the LEGACY builder surface (src/services/turn-request-builder)
 * against CEE's CURRENT export of that same legacy surface; the live V5 payload
 * path (src/v5/buildPayload.ts) is a different shape and is not covered here.
 * Where the current export has diverged from what the legacy builders emit,
 * the divergence is pinned explicitly as KNOWN DIVERGENCE below rather than
 * papered over — see the PR body / cross-repo ask.
 */
import { describe, test, expect } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

import turnRequestSchema from '../../contracts/cee/turn-request.schema.json'
import analysisStateSchema from '../../contracts/cee/analysis-state.schema.json'
import graphStateSchema from '../../contracts/cee/graph-state.schema.json'
import systemEventSchema from '../../contracts/cee/system-event.schema.json'

import {
  buildConversationTurnRequest,
  buildExplicitGenerateTurnRequest,
  buildRunAnalysisTurnRequest,
  buildSystemEventTurnRequest,
  buildPatchFollowupTurnRequest,
  buildExplainTurnRequest,
  buildClarificationResponseTurnRequest,
  stripTurnType,
} from '../../src/services/turn-request-builder'

// ---------------------------------------------------------------------------
// Schema setup
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)

const validateTurnRequest = ajv.compile(turnRequestSchema)
const validateAnalysisState = ajv.compile(analysisStateSchema)
const validateGraphState = ajv.compile(graphStateSchema)
const validateSystemEvent = ajv.compile(systemEventSchema)

// ---------------------------------------------------------------------------
// Realistic test data (mirrors actual UI state shapes)
// ---------------------------------------------------------------------------

const VALID_UUID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const conversationHistory = [
  { role: 'user', content: 'Should I raise subscription prices from £49 to £59?' },
  { role: 'assistant', content: 'Let me help you model that decision.' },
] as const

const graphState = {
  nodes: [
    {
      id: 'goal_revenue',
      kind: 'goal',
      label: 'Maximise Long-term Revenue',
      goal_threshold: 0.8,
      goal_threshold_raw: 800,
      goal_threshold_unit: 'customers',
      goal_threshold_cap: 1000,
    },
    {
      id: 'fac_price',
      kind: 'factor',
      label: 'Subscription Price',
      category: 'controllable',
      observed_state: {
        value: 0.49,
        baseline: 0.49,
        unit: '£',
        source: 'brief_extraction',
        raw_value: 49,
        cap: 100,
        extractionType: 'explicit',
        factor_type: 'price',
        uncertainty_drivers: ['Market reaction unknown'],
      },
    },
    {
      id: 'fac_churn',
      kind: 'factor',
      label: 'Churn Risk',
      category: 'external',
    },
    {
      id: 'dec_pricing',
      kind: 'decision',
      label: 'Pricing Strategy',
    },
    {
      id: 'opt_keep',
      kind: 'option',
      label: 'Keep at £49',
    },
    {
      id: 'opt_raise',
      kind: 'option',
      label: 'Raise to £59',
    },
    {
      id: 'risk_churn',
      kind: 'risk',
      label: 'Increased Churn',
    },
    {
      id: 'out_revenue',
      kind: 'outcome',
      label: 'Net Revenue Impact',
    },
  ],
  edges: [
    {
      from: 'fac_price',
      to: 'goal_revenue',
      strength: { mean: 0.6, std: 0.15 },
      exists_probability: 0.9,
      effect_direction: 'positive',
      origin: 'ai',
    },
    {
      from: 'fac_price',
      to: 'risk_churn',
      strength: { mean: 0.5, std: 0.2 },
      exists_probability: 0.85,
      effect_direction: 'positive',
    },
    {
      from: 'risk_churn',
      to: 'goal_revenue',
      strength: { mean: -0.3, std: 0.15 },
      exists_probability: 0.85,
      effect_direction: 'negative',
    },
  ],
}

const analysisState = {
  analysis_status: 'complete',
  meta: { response_hash: 'resp-hash-abc123', run_id: 'run-1' },
  option_comparison: [
    { id: 'opt_keep', label: 'Keep at £49', win_probability: 0.65 },
    { id: 'opt_raise', label: 'Raise to £59', win_probability: 0.35 },
  ],
  drivers: [
    { factor_id: 'fac_price', factor_label: 'Subscription Price', elasticity: 0.4 },
  ],
  robustness: { level: 'moderate', recommendation_stability: 0.55 },
}

const analysisInputs = {
  goal_node_id: 'goal_revenue',
  options: [
    {
      id: 'opt_keep',
      option_id: 'opt_keep',
      label: 'Keep at £49',
      interventions: {
        fac_price: { value: 49, source: 'brief_extraction', target_match: { node_id: 'fac_price', match_type: 'exact_id', confidence: 'high' } },
      },
    },
    {
      id: 'opt_raise',
      option_id: 'opt_raise',
      label: 'Raise to £59',
      interventions: {
        fac_price: { value: 59, source: 'brief_extraction', target_match: { node_id: 'fac_price', match_type: 'exact_id', confidence: 'high' } },
      },
    },
  ],
}

const systemEvent = {
  type: 'patch_accepted' as const,
  payload: { patch_id: 'blk_graph_patch_7e2a2e78', changed_node_ids: ['fac_price'] },
}

// ---------------------------------------------------------------------------
// Helper: strip _turn_type before validation (it's a dev-only field)
// ---------------------------------------------------------------------------

function wirePayload(request: ReturnType<typeof buildConversationTurnRequest>) {
  return stripTurnType(request)
}

// ---------------------------------------------------------------------------
// Turn request contract tests
// ---------------------------------------------------------------------------

describe('Turn request contract', () => {
  test('conversation turn validates against CEE schema', () => {
    const request = wirePayload(buildConversationTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'What happens if we raise the price?',
      graph_state: graphState,
    }))

    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('KNOWN DIVERGENCE: builder emits selected_elements — the current CEE export no longer models it', () => {
    // The pre-resync mirror accepted selected_elements on conversation turns.
    // CEE's current export has no such property and rejects unknown keys
    // (additionalProperties: false), so a selection-bearing legacy turn no
    // longer validates. The builder still emits it (pinned below). Fails loud
    // if CEE re-adds the field (first expect flips) or if the builder stops
    // sending it (property assertion fails). See PR body / cross-repo ask.
    const request = wirePayload(buildConversationTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Tell me about this factor',
      graph_state: graphState,
      selected_elements: { node_ids: ['fac_price'], edge_ids: [] },
    }))

    expect(request).toHaveProperty('selected_elements') // producer still emits it
    expect(validateTurnRequest(request)).toBe(false) // current export rejects it

    // Positive control: the rejection is exactly this field — stripping it validates.
    const withoutSelection: Record<string, unknown> = { ...(request as Record<string, unknown>) }
    delete withoutSelection.selected_elements
    const valid = validateTurnRequest(withoutSelection)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('R11 (updated): post-analysis conversation turn includes analysis_state', () => {
    const request = wirePayload(buildConversationTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Why is Option A better?',
      graph_state: graphState,
      analysis_state: analysisState,
    }))

    // R11 (updated): conversation turns now include analysis_state
    expect(request).toHaveProperty('analysis_state')

    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('R11 (updated): conversation turn without analysis omits analysis_state', () => {
    const request = wirePayload(buildConversationTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'What alternatives exist?',
      graph_state: graphState,
    }))

    expect(request).not.toHaveProperty('analysis_state')

    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('explicit_generate turn validates against CEE schema', () => {
    const request = wirePayload(buildExplicitGenerateTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Build a decision model for choosing a pricing strategy',
      graph_state: { nodes: [], edges: [] },
    }))

    expect(request).toHaveProperty('generate_model', true)
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('R11: explicit_generate omits analysis_state', () => {
    const request = wirePayload(buildExplicitGenerateTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Regenerate the model with updated factors',
      graph_state: graphState,
    }))

    expect(request).toHaveProperty('generate_model', true)
    expect(request).not.toHaveProperty('analysis_state')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('run_analysis turn validates against CEE schema', () => {
    const request = wirePayload(buildRunAnalysisTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      graph_state: graphState,
      analysis_inputs: analysisInputs,
    }))

    expect(request).toHaveProperty('analysis_inputs')
    expect(request).not.toHaveProperty('message')
    expect(request).not.toHaveProperty('analysis_state')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  // KNOWN DIVERGENCE (system_event shape): the legacy builder wraps events as
  // { type, payload }; CEE's current export models system_event as an anyOf of
  // envelope-bearing variants { event_type, event_id, timestamp, details }
  // (additionalProperties: false). A legacy-shaped system_event turn therefore
  // no longer validates. Each test pins BOTH sides: the builder still emits the
  // legacy shape (rejected), and the same turn with a schema-shaped event
  // validates (positive control proving the rejection is exactly this field).
  // Fails loud if either side moves. See PR body / cross-repo ask.

  test('KNOWN DIVERGENCE: system_event turn (patch_accepted) — legacy {type,payload} rejected, schema shape accepted', () => {
    const request = wirePayload(buildSystemEventTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: '[system] Patch accepted',
      graph_state: graphState,
      system_event: systemEvent,
    }))

    expect(request).toHaveProperty('system_event')
    expect(validateTurnRequest(request)).toBe(false) // legacy {type,payload} shape

    const schemaShaped = {
      ...(request as Record<string, unknown>),
      system_event: {
        event_type: 'patch_accepted',
        event_id: 'evt_patch_1',
        timestamp: '2026-07-20T12:00:00Z',
        details: { patch_id: 'blk_graph_patch_7e2a2e78', operations: [] },
      },
    }
    const valid = validateTurnRequest(schemaShaped)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('KNOWN DIVERGENCE: system_event turn (direct_graph_edit) — legacy {type,payload} rejected, schema shape accepted', () => {
    const request = wirePayload(buildSystemEventTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: '[system] Direct graph edit',
      graph_state: graphState,
      system_event: { type: 'direct_graph_edit', payload: { changed_node_ids: ['fac_price'] } },
    }))

    expect(validateTurnRequest(request)).toBe(false) // legacy {type,payload} shape

    const schemaShaped = {
      ...(request as Record<string, unknown>),
      system_event: {
        event_type: 'direct_graph_edit',
        event_id: 'evt_edit_1',
        timestamp: '2026-07-20T12:00:00Z',
        details: { changed_node_ids: ['fac_price'], changed_edge_ids: [], operations: [] },
      },
    }
    const valid = validateTurnRequest(schemaShaped)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('R11: system_event turn omits analysis_state (legacy event shape divergence pinned)', () => {
    const request = wirePayload(buildSystemEventTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: '[system] Feedback',
      graph_state: graphState,
      system_event: { type: 'feedback_submitted', payload: { rating: 'positive' } },
    }))

    // The R11 pin — builder behaviour, independent of the schema divergence.
    expect(request).toHaveProperty('system_event')
    expect(request).not.toHaveProperty('analysis_state')

    expect(validateTurnRequest(request)).toBe(false) // legacy {type,payload} shape

    const schemaShaped = {
      ...(request as Record<string, unknown>),
      system_event: {
        event_type: 'feedback_submitted',
        event_id: 'evt_feedback_1',
        timestamp: '2026-07-20T12:00:00Z',
        details: { turn_id: 'turn-1', rating: 'up' }, // rating enum: up | down
      },
    }
    const valid = validateTurnRequest(schemaShaped)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('patch_followup turn validates against CEE schema', () => {
    const request = wirePayload(buildPatchFollowupTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      graph_state: graphState,
    }))

    expect(request).not.toHaveProperty('message')
    expect(request).not.toHaveProperty('system_event')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('patch_followup with analysis_state validates', () => {
    const request = wirePayload(buildPatchFollowupTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      graph_state: graphState,
      analysis_state: analysisState,
    }))

    expect(request).toHaveProperty('analysis_state')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('explain turn validates against CEE schema', () => {
    const request = wirePayload(buildExplainTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Why is churn risk the top driver?',
      graph_state: graphState,
      analysis_state: analysisState,
    }))

    expect(request).toHaveProperty('analysis_state')
    expect(request).toHaveProperty('message')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('KNOWN DIVERGENCE: explain turn with selected_elements — current CEE export rejects the field', () => {
    // Same divergence as the conversation-turn pin above, on the explain path.
    const request = wirePayload(buildExplainTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Explain this edge',
      graph_state: graphState,
      selected_elements: { node_ids: [], edge_ids: ['fac_price->goal_revenue'] },
      analysis_state: analysisState,
    }))

    expect(request).toHaveProperty('selected_elements') // producer still emits it
    expect(validateTurnRequest(request)).toBe(false) // current export rejects it

    // Positive control: stripping exactly this field validates.
    const withoutSelection: Record<string, unknown> = { ...(request as Record<string, unknown>) }
    delete withoutSelection.selected_elements
    const valid = validateTurnRequest(withoutSelection)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('clarification_response turn validates against CEE schema', () => {
    const request = wirePayload(buildClarificationResponseTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'Yes, we have about 500 active subscribers',
    }))

    expect(request).toHaveProperty('message')
    expect(request).not.toHaveProperty('graph_state')
    expect(request).not.toHaveProperty('analysis_state')
    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })

  test('first-turn explicit_generate with empty history validates', () => {
    const request = wirePayload(buildExplicitGenerateTurnRequest({
      scenario_id: VALID_UUID,
      conversation_history: [],
      message: 'Build a decision model for choosing a car',
      graph_state: { nodes: [], edges: [] },
    }))

    const valid = validateTurnRequest(request)
    if (!valid) console.error('Validation errors:', validateTurnRequest.errors)
    expect(valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Sub-schema contract tests
// ---------------------------------------------------------------------------

describe('Analysis state contract', () => {
  test('valid analysis_state with option_comparison matches schema', () => {
    const valid = validateAnalysisState(analysisState)
    if (!valid) console.error('Validation errors:', validateAnalysisState.errors)
    expect(valid).toBe(true)
  })

  test('analysis_state without results still passes validation (results removed from contract)', () => {
    const valid = { analysis_status: 'complete', meta: { response_hash: 'h1' } }
    expect(validateAnalysisState(valid)).toBe(true)
  })

  test('analysis_state without response_hash fails validation', () => {
    const invalid = { analysis_status: 'complete', meta: {} }
    expect(validateAnalysisState(invalid)).toBe(false)
  })
})

describe('Graph state contract', () => {
  test('realistic graph state matches schema', () => {
    const valid = validateGraphState(graphState)
    if (!valid) console.error('Validation errors:', validateGraphState.errors)
    expect(valid).toBe(true)
  })

  test('empty graph state validates', () => {
    expect(validateGraphState({ nodes: [], edges: [] })).toBe(true)
  })

  test('graph state without edges fails', () => {
    expect(validateGraphState({ nodes: [] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Per-turn oneOf discrimination: forbidden field rejection
// ---------------------------------------------------------------------------

describe('Turn request schema discrimination (current export)', () => {
  // SCHEMA MODEL CHANGE (2026-07-20 re-sync): the pre-resync mirror was a oneOf
  // of per-turn-type variants with mutual-exclusion rules (run_analysis forbids
  // message, etc.). CEE's CURRENT export retired the variant model: a single
  // flat object, required = [scenario_id, client_turn_id], every other field
  // optional, unknown keys rejected (additionalProperties: false). The
  // exclusivity pins below are therefore FLIPPED and retitled to state what the
  // schema now enforces — intent-level turn discrimination lives solely in the
  // builder + _turn_type boundary validator now. Each flip is deliberate, not
  // an appeasement: the old expectation pinned mirror-only strictness that the
  // producer no longer exports.

  test('VARIANT EXCLUSIVITY RETIRED: run_analysis-shaped payload with message is accepted by the current export', () => {
    // Pre-resync: message was forbidden on run_analysis (matched no variant).
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      graph_state: graphState,
      analysis_inputs: analysisInputs,
      message: 'should not be here',
    }
    expect(validateTurnRequest(payload)).toBe(true)
  })

  test('VARIANT EXCLUSIVITY RETIRED: run_analysis-shaped payload with analysis_state is accepted by the current export', () => {
    // Pre-resync: analysis_state was forbidden alongside analysis_inputs.
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      graph_state: graphState,
      analysis_inputs: analysisInputs,
      analysis_state: analysisState,
    }
    expect(validateTurnRequest(payload)).toBe(true)
  })

  test('message + graph_state payload validates', () => {
    // Pre-resync this pinned oneOf routing (ConversationOrExplainTurn); under
    // the flat model it is simply a valid payload.
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'answer',
      graph_state: graphState,
    }
    expect(validateTurnRequest(payload)).toBe(true)
  })

  test('malformed system_event ({type} only) is rejected', () => {
    // Pre-resync this passed via variant exclusivity ("matches no variant").
    // It still fails today, but for a different reason: the system_event value
    // does not match any event variant (legacy {type} shape — see the KNOWN
    // DIVERGENCE pins above). Kept as a negative pin on the event sub-schema.
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
      analysis_inputs: analysisInputs,
      system_event: { type: 'direct_graph_edit' },
    }
    expect(validateTurnRequest(payload)).toBe(false)
  })

  test('generate_model with malformed system_event is rejected (event sub-schema, not exclusivity)', () => {
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
      generate_model: true,
      system_event: { type: 'direct_graph_edit' },
    }
    expect(validateTurnRequest(payload)).toBe(false)
  })

  test('unknown top-level field is rejected (additionalProperties: false)', () => {
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
      unknown_field: 'should be rejected',
    }
    expect(validateTurnRequest(payload)).toBe(false)
  })

  test('missing scenario_id is rejected', () => {
    const payload = {
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
    }
    expect(validateTurnRequest(payload)).toBe(false)
  })

  test('missing client_turn_id is rejected (newly required by the current export)', () => {
    const payload = {
      scenario_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
    }
    expect(validateTurnRequest(payload)).toBe(false)
  })

  test('UUID FORMAT NOT ENFORCED: non-UUID scenario_id is accepted by the current export (length bounds only)', () => {
    // Pre-resync the mirror enforced format: uuid and this was a rejection pin.
    // The current export types scenario_id as a plain string (minLength 1,
    // maxLength 200) — malformed-id rejection, if any, now happens beyond this
    // schema. Both bounds pinned so a re-tightening fails loud here.
    const payload = {
      scenario_id: 'not-a-uuid',
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
      message: 'hello',
      graph_state: graphState,
    }
    expect(validateTurnRequest(payload)).toBe(true)
    expect(validateTurnRequest({ ...payload, scenario_id: '' })).toBe(false) // minLength 1 still bites
  })

  test('EXCLUSIVITY RETIRED: payload with neither message nor graph_state is accepted (only scenario_id + client_turn_id required)', () => {
    // Pre-resync: matched no variant. The flat model has no such floor.
    const payload = {
      scenario_id: VALID_UUID,
      client_turn_id: VALID_UUID,
      conversation_history: [...conversationHistory],
    }
    expect(validateTurnRequest(payload)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RF → CEE node/edge transform contract
// ---------------------------------------------------------------------------

describe('RF → CEE node/edge transform contract', () => {
  // Replicate the production RF→CEE transform logic from useConversation.ts
  // to verify that transformed nodes/edges pass the graph_state schema.

  const RF_NODE_BLOCKLIST = new Set([
    'selected', 'dragging', 'measured', 'resizing', 'position', 'positionAbsolute',
    'draggable', 'selectable', 'deletable', 'connectable', 'focusable',
    'parentId', 'extent', 'xAlign', 'yAlign', 'expandParent', 'renderOrder',
  ])
  const CEE_VALID_KINDS = new Set(['goal', 'factor', 'outcome', 'decision', 'risk', 'action', 'option'])
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

  function transformRFNodeToCEE(n: Record<string, unknown>) {
    const d = (n.data ?? {}) as Record<string, unknown>
    const rawKind = (d.kind as string) ?? (n.type as string) ?? 'factor'
    const out: Record<string, unknown> = {
      id: n.id,
      kind: CEE_VALID_KINDS.has(rawKind) ? rawKind : 'factor',
      label: (d.label as string) ?? n.id,
    }
    for (const [key, value] of Object.entries(d)) {
      if (RF_NODE_BLOCKLIST.has(key) || value === undefined) continue
      if (key === 'observedState') { out.observed_state = value; continue }
      out[key] = value
    }
    return out
  }

  function transformRFEdgeToCEE(e: Record<string, unknown>) {
    const d = ((e.data ?? {}) as Record<string, unknown>)
    const weightValue = d.weight as number | undefined
    const directionValue = d.direction as string | undefined
    const strengthStdValue = d.strengthStd as number | undefined
    const weight = typeof weightValue === 'number' ? Math.max(0, Math.min(weightValue, 1.0)) : 0.5
    const direction = directionValue === 'negative' ? -1 : 1
    const mean = Math.max(-1, Math.min(1, direction * weight))
    const std = typeof strengthStdValue === 'number' ? Math.max(0, strengthStdValue) : undefined
    const rawExistsProb = (d.beliefExists ?? d.confidence ?? d.belief) as number | undefined
    const existsProb = typeof rawExistsProb === 'number' ? clamp01(rawExistsProb) : undefined
    const effectDir = directionValue === 'positive' || directionValue === 'negative' ? directionValue : undefined
    return {
      from: e.source,
      to: e.target,
      strength: { mean, ...(std !== undefined ? { std } : {}) },
      ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
      ...(effectDir ? { effect_direction: effectDir } : {}),
    }
  }

  test('RF node with observedState transforms to valid CEE node', () => {
    const rfNode = {
      id: 'fac_price',
      type: 'factor',
      position: { x: 100, y: 200 },
      selected: true,
      dragging: false,
      data: {
        kind: 'factor',
        label: 'Subscription Price',
        category: 'controllable',
        observedState: {
          value: 0.49,
          baseline: 0.49,
          unit: '£',
          source: 'brief_extraction',
          raw_value: 49,
          cap: 100,
        },
        // RF internals that should be stripped
        selected: true,
        dragging: false,
      },
    }

    const ceeNode = transformRFNodeToCEE(rfNode)
    expect(ceeNode).not.toHaveProperty('position')
    expect(ceeNode).not.toHaveProperty('selected')
    expect(ceeNode).not.toHaveProperty('dragging')
    expect(ceeNode).not.toHaveProperty('observedState')
    expect(ceeNode).toHaveProperty('observed_state')

    const gs = { nodes: [ceeNode], edges: [] }
    const valid = validateGraphState(gs)
    if (!valid) console.error('Validation errors:', validateGraphState.errors)
    expect(valid).toBe(true)
  })

  test('RF edge with weight/direction transforms to valid CEE edge', () => {
    const rfEdge = {
      id: 'e1',
      source: 'fac_price',
      target: 'goal_revenue',
      data: {
        weight: 1.2,
        direction: 'positive',
        strengthStd: 0.15,
        beliefExists: 0.9,
      },
    }

    const ceeEdge = transformRFEdgeToCEE(rfEdge)
    expect(ceeEdge.from).toBe('fac_price')
    expect(ceeEdge.to).toBe('goal_revenue')
    // Weight 1.2 clamped to 1.0 ([-1,+1] range standardisation)
    expect(ceeEdge.strength.mean).toBeCloseTo(1.0)
    expect(ceeEdge.strength.std).toBe(0.15)
    expect(ceeEdge.exists_probability).toBe(0.9)
    expect(ceeEdge.effect_direction).toBe('positive')

    const gs = { nodes: [], edges: [ceeEdge] }
    const valid = validateGraphState(gs)
    if (!valid) console.error('Validation errors:', validateGraphState.errors)
    expect(valid).toBe(true)
  })

  test('RF edge with negative direction produces negative mean', () => {
    const rfEdge = {
      source: 'risk_churn',
      target: 'goal_revenue',
      data: {
        weight: 0.6,
        direction: 'negative',
        beliefExists: 0.85,
      },
    }

    const ceeEdge = transformRFEdgeToCEE(rfEdge)
    expect(ceeEdge.strength.mean).toBeCloseTo(-0.6)
    expect(ceeEdge.effect_direction).toBe('negative')

    const gs = { nodes: [], edges: [ceeEdge] }
    expect(validateGraphState(gs)).toBe(true)
  })

  test('RF edge with missing weight defaults to 0.5', () => {
    const rfEdge = { source: 'a', target: 'b', data: {} }
    const ceeEdge = transformRFEdgeToCEE(rfEdge)
    expect(ceeEdge.strength.mean).toBeCloseTo(0.5)
    expect(ceeEdge.strength).not.toHaveProperty('std')
    expect(ceeEdge).not.toHaveProperty('exists_probability')
    expect(ceeEdge).not.toHaveProperty('effect_direction')
  })

  test('full RF graph transforms to valid CEE graph_state', () => {
    const rfNodes = [
      { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
      { id: 'fac_1', type: 'factor', position: { x: 100, y: 0 }, selected: true, data: { kind: 'factor', label: 'Price', category: 'controllable', observedState: { value: 49, unit: '£' } } },
    ]
    const rfEdges = [
      { source: 'fac_1', target: 'goal_1', data: { weight: 0.8, direction: 'positive', strengthStd: 0.1, beliefExists: 0.9 } },
    ]

    const ceeNodes = rfNodes.map(n => transformRFNodeToCEE(n))
    const ceeEdges = rfEdges.map(e => transformRFEdgeToCEE(e))
    const gs = { nodes: ceeNodes, edges: ceeEdges }

    const valid = validateGraphState(gs)
    if (!valid) console.error('Validation errors:', validateGraphState.errors)
    expect(valid).toBe(true)

    // Verify no RF internals leaked
    for (const node of ceeNodes) {
      expect(node).not.toHaveProperty('position')
      expect(node).not.toHaveProperty('selected')
      expect(node).not.toHaveProperty('type')
    }
  })
})

describe('System event contract', () => {
  // SCHEMA MODEL CHANGE (2026-07-20 re-sync): the standalone SystemEventSchema
  // export is now an anyOf of five { event_type, event_id, timestamp, details }
  // variants (additionalProperties: false) — not the legacy { type, payload }
  // wrapper the UI's legacy builder emits. Minimal valid details per variant
  // are taken from the export's own required lists.

  test('all wire event types validate (schema-shaped)', () => {
    const events = [
      { event_type: 'patch_accepted', details: { operations: [] } },
      { event_type: 'patch_dismissed', details: {} },
      { event_type: 'direct_graph_edit', details: { changed_node_ids: [], changed_edge_ids: [], operations: [] } },
      { event_type: 'direct_analysis_run', details: {} },
      { event_type: 'feedback_submitted', details: { turn_id: 'turn-1', rating: 'up' } }, // rating enum: up | down
    ]
    for (const partial of events) {
      const event = { event_id: `evt_${partial.event_type}`, timestamp: '2026-07-20T12:00:00Z', ...partial }
      const valid = validateSystemEvent(event)
      if (!valid) console.error(`${partial.event_type} failed:`, validateSystemEvent.errors)
      expect(valid).toBe(true)
    }
  })

  test('KNOWN DIVERGENCE: legacy {type,payload} event shape no longer validates', () => {
    // The legacy builder wraps events as { type, payload } — pinned rejected
    // against the current export. Goes red if CEE restores the legacy shape.
    expect(validateSystemEvent({ type: 'patch_accepted', payload: {} })).toBe(false)
  })

  test('unknown event type fails', () => {
    const event = {
      event_type: 'unknown_event',
      event_id: 'evt_unknown',
      timestamp: '2026-07-20T12:00:00Z',
      details: {},
    }
    expect(validateSystemEvent(event)).toBe(false)
  })
})
