/**
 * CEE Request Contracts — Golden-Path Regression Suite
 *
 * Asserts the exact outbound payload shape for each turn type that the UI sends
 * to /bff/orchestrate/v1/turn. These tests use the real builder functions so that
 * any future refactor that changes the wire shape will fail here first.
 *
 * Turn coverage:
 *   T1 — Brief submission  (explicit_generate)
 *   T2 — Parameter update  (conversation, graph populated)
 *   T3 — Alternatives Q    (conversation, no analysis yet)
 *   T4 — Add option        (conversation, structural — same shape as T2/T3)
 *   T5a — Run analysis     (run_analysis)
 *   T5b — Explain turn     (explain, analysis_state present)
 *
 * Regression cases:
 *   R1 — Object-shaped results guard (V2 fields nested inside results)
 *   R2 — Null rawV2Response → analysis_state omitted
 *   R3 — Null goalConstraints → constraints absent from analysis_inputs
 */

import { describe, it, expect } from 'vitest'
import {
  buildExplicitGenerateTurnRequest,
  buildConversationTurnRequest,
  buildRunAnalysisTurnRequest,
  buildExplainTurnRequest,
  isUUID,
  stripTurnType,
} from '../../../services/turn-request-builder'
import type {
  AnalysisInputsPayload,
  ExplainAnalysisStatePayload,
} from '../../../services/turn-request-builder'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const EMPTY_GRAPH = { nodes: [], edges: [] }

const POPULATED_GRAPH = {
  nodes: [
    { id: 'goal_1', kind: 'goal', label: 'Maximise Revenue' },
    { id: 'opt_a', kind: 'option', label: 'Option A' },
    { id: 'factor_1', kind: 'factor', label: 'Market Share', category: 'external' },
  ],
  edges: [
    { from: 'opt_a', to: 'goal_1', strength: { mean: 0.7 }, effect_direction: 'positive' },
    { from: 'factor_1', to: 'goal_1', strength: { mean: -0.4 }, effect_direction: 'negative' },
  ],
}

const CONVERSATION_HISTORY = [
  { role: 'user' as const, content: 'Should I expand into the EU market?' },
  { role: 'assistant' as const, content: 'I\'ve created a decision model for you.' },
]

/** Minimal valid rawV2Response (mirrors makeV2Response helper in other specs) */
const RAW_V2_RESPONSE = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  response_hash: 'hash-golden-path-abc123',
  option_comparison: [
    { option_id: 'opt_a', option_label: 'Option A', expected_value: 0.72, rank: 1 },
  ],
  robustness: { level: 'robust', score: 0.81 },
  drivers: [
    { factor_id: 'factor_1', label: 'Market Share', voi: 0.15, rank: 1 },
  ],
  edge_sensitivity: [
    { edge_id: 'e1', from: 'opt_a', to: 'goal_1', switch_probability: 0.12 },
  ],
  constraints_status: null,
  critiques: [
    { code: 'INBOUND_STRENGTH_SUM_EXCEEDED', severity: 'warning', message: 'Factors driving goal may be over-weighted' },
  ],
  meta: { seed_used: 42, detail_level: 'full' },
}

/** Build a valid analysis_state from a rawV2Response, mirroring useConversation buildRequest */
function buildAnalysisState(
  rawV2: typeof RAW_V2_RESPONSE,
  analysisHash = 'hash-golden-path-abc123',
  analysisSummary: unknown = null,
): ExplainAnalysisStatePayload {
  return {
    option_comparison: Array.isArray(rawV2.option_comparison) ? rawV2.option_comparison : [],
    robustness: rawV2.robustness ?? null,
    drivers: Array.isArray(rawV2.drivers) ? rawV2.drivers : [],
    edge_sensitivity: Array.isArray(rawV2.edge_sensitivity) ? rawV2.edge_sensitivity : [],
    constraints_status: rawV2.constraints_status ?? null,
    critiques: Array.isArray(rawV2.critiques) ? rawV2.critiques : [],
    meta: { ...rawV2.meta, response_hash: analysisHash },
    analysis_status: 'completed',
    option_comparison_status: rawV2.option_comparison_status,
    robustness_status: rawV2.robustness_status,
    drivers_status: rawV2.drivers_status,
    results: analysisSummary ?? true,
  }
}

/** Build analysis_inputs from a ceeAnalysisReady-like object */
function buildAnalysisInputs(opts: {
  goal_node_id: string
  options: Array<{ id: string; label: string; interventions: Record<string, unknown> }>
  goalConstraints?: CEEGoalConstraint[] | null
}): AnalysisInputsPayload {
  return {
    options: opts.options.map((opt) => ({
      id: opt.id,
      option_id: opt.id,
      label: opt.label,
      interventions: opt.interventions as AnalysisInputsPayload['options'][number]['interventions'],
    })),
    goal_node_id: opts.goal_node_id,
    ...(opts.goalConstraints && opts.goalConstraints.length > 0
      ? { constraints: opts.goalConstraints }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// T1 — Brief submission (explicit_generate)
// ---------------------------------------------------------------------------

describe('T1 — Brief submission (explicit_generate)', () => {
  const req = buildExplicitGenerateTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: [],
    message: 'Should I expand into the EU market?',
    graph_state: EMPTY_GRAPH,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('generate_model is true', () => {
    expect(req.generate_model).toBe(true)
  })

  it('graph_state is { nodes: [], edges: [] } — not null, not absent', () => {
    expect(req.graph_state).toBeDefined()
    expect(req.graph_state).not.toBeNull()
    expect(Array.isArray(req.graph_state.nodes)).toBe(true)
    expect(Array.isArray(req.graph_state.edges)).toBe(true)
    expect(req.graph_state.nodes).toHaveLength(0)
    expect(req.graph_state.edges).toHaveLength(0)
  })

  it('analysis_state is absent on first turn', () => {
    expect(req.analysis_state).toBeUndefined()
  })

  it('message is the brief text', () => {
    expect(req.message).toBe('Should I expand into the EU market?')
  })

  it('client_turn_id is a UUID string', () => {
    expect(isUUID(req.client_turn_id)).toBe(true)
  })

  it('conversation_history is an array of { role, content } pairs', () => {
    expect(Array.isArray(req.conversation_history)).toBe(true)
    expect(req.conversation_history).toHaveLength(0)
  })

  it('scenario_id is the provided UUID', () => {
    expect(req.scenario_id).toBe(SCENARIO_ID)
  })

  it('wire snapshot — only expected keys present after stripTurnType', () => {
    const wire = stripTurnType(req)
    const keys = Object.keys(wire).sort()
    expect(keys).toEqual([
      'client_turn_id',
      'conversation_history',
      'generate_model',
      'graph_state',
      'message',
      'scenario_id',
    ])
  })

  it('serialises cleanly to JSON without undefined values or _turn_type', () => {
    const wire = stripTurnType(req)
    const parsed = JSON.parse(JSON.stringify(wire))
    expect('_turn_type' in parsed).toBe(false)
    expect('analysis_state' in parsed).toBe(false)
    expect('analysis_inputs' in parsed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T2 — Parameter update (conversation, graph populated)
// ---------------------------------------------------------------------------

describe('T2 — Parameter update (conversation, graph populated)', () => {
  const req = buildConversationTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    message: 'The market share factor should have a higher weight',
    graph_state: POPULATED_GRAPH,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('graph_state.nodes is a non-empty array', () => {
    expect(Array.isArray(req.graph_state.nodes)).toBe(true)
    expect(req.graph_state.nodes.length).toBeGreaterThan(0)
  })

  it('graph_state.edges is a non-empty array', () => {
    expect(Array.isArray(req.graph_state.edges)).toBe(true)
    expect(req.graph_state.edges.length).toBeGreaterThan(0)
  })

  it('message contains the update text', () => {
    expect(req.message).toBe('The market share factor should have a higher weight')
  })

  it('analysis_state is absent (no analysis yet)', () => {
    expect(req.analysis_state).toBeUndefined()
  })

  it('system_event is absent — parameter updates go as messages, not events', () => {
    expect((req as Record<string, unknown>).system_event).toBeUndefined()
  })

  it('client_turn_id is a UUID string', () => {
    expect(isUUID(req.client_turn_id)).toBe(true)
  })

  it('conversation_history is the populated history array', () => {
    expect(req.conversation_history).toHaveLength(2)
    expect(req.conversation_history[0].role).toBe('user')
    expect(req.conversation_history[1].role).toBe('assistant')
  })

  it('wire snapshot — only expected keys present after stripTurnType', () => {
    const wire = stripTurnType(req)
    const keys = Object.keys(wire).sort()
    expect(keys).toEqual([
      'client_turn_id',
      'conversation_history',
      'graph_state',
      'message',
      'scenario_id',
    ])
  })
})

// ---------------------------------------------------------------------------
// T3 — Alternatives question (conversation, no analysis)
// ---------------------------------------------------------------------------

describe('T3 — Alternatives question (pure conversation, no analysis)', () => {
  const req = buildConversationTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    message: 'What if we also considered a joint venture instead?',
    graph_state: POPULATED_GRAPH,
    // analysis_state intentionally omitted — no analysis run yet
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('analysis_state is absent when no analysis_state provided', () => {
    expect(req.analysis_state).toBeUndefined()
  })

  it('graph_state is present', () => {
    expect(req.graph_state).toBeDefined()
    expect(Array.isArray(req.graph_state.nodes)).toBe(true)
    expect(Array.isArray(req.graph_state.edges)).toBe(true)
  })

  it('message is the alternatives question', () => {
    expect(req.message).toBe('What if we also considered a joint venture instead?')
  })

  it('conversation_history is present', () => {
    expect(Array.isArray(req.conversation_history)).toBe(true)
    expect(req.conversation_history.length).toBeGreaterThan(0)
  })

  it('R11: analysis_state is structurally absent from conversation builder', () => {
    // R11: conversation builder no longer accepts analysis_state parameter
    const req = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: [],
      message: 'What alternatives exist?',
      graph_state: EMPTY_GRAPH,
    })
    expect(req.analysis_state).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// T4 — Add option (structural addition — same shape as T2/T3)
// ---------------------------------------------------------------------------

describe('T4 — Add option (structural addition)', () => {
  const reqT4 = buildConversationTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    message: 'Add a new option: acquire a local distributor',
    graph_state: POPULATED_GRAPH,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  const reqT2 = buildConversationTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    message: 'The market share factor should have a higher weight',
    graph_state: POPULATED_GRAPH,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('T4 has the same top-level key shape as T2 — UI does not differentiate structural vs parameter requests', () => {
    const keysT4 = Object.keys(stripTurnType(reqT4)).sort()
    const keysT2 = Object.keys(stripTurnType(reqT2)).sort()
    expect(keysT4).toEqual(keysT2)
  })

  it('no extra fields compared to T2', () => {
    const keysT4 = new Set(Object.keys(stripTurnType(reqT4)))
    const keysT2 = new Set(Object.keys(stripTurnType(reqT2)))
    for (const k of keysT4) {
      expect(keysT2.has(k)).toBe(true)
    }
  })

  it('analysis_inputs absent (structural intent is conveyed via message text, not a special field)', () => {
    expect((reqT4 as Record<string, unknown>).analysis_inputs).toBeUndefined()
  })

  it('system_event absent', () => {
    expect((reqT4 as Record<string, unknown>).system_event).toBeUndefined()
  })

  it('message is the structural request text', () => {
    expect(reqT4.message).toBe('Add a new option: acquire a local distributor')
  })
})

// ---------------------------------------------------------------------------
// T5a — Run analysis (run_analysis)
// ---------------------------------------------------------------------------

describe('T5a — Run analysis', () => {
  const goalConstraints: CEEGoalConstraint[] = [
    { id: 'c1', label: 'Revenue above 10%', operator: '>=', value: 0.1, probability: 0.8 },
  ]

  const analysisInputs = buildAnalysisInputs({
    goal_node_id: 'goal_1',
    options: [
      {
        id: 'opt_a',
        label: 'Option A',
        interventions: {
          'factor_1': { value: 0.8, source: 'cee_hypothesis' },
        },
      },
      {
        id: 'opt_b',
        label: 'Option B',
        interventions: {
          'factor_1': { value: 0.3, source: 'user_specified' },
        },
      },
    ],
    goalConstraints,
  })

  const req = buildRunAnalysisTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    graph_state: POPULATED_GRAPH,
    analysis_inputs: analysisInputs,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('analysis_inputs.options is a non-empty array', () => {
    expect(Array.isArray(req.analysis_inputs.options)).toBe(true)
    expect(req.analysis_inputs.options.length).toBeGreaterThan(0)
  })

  it('each option has { id, option_id, label, interventions }', () => {
    for (const opt of req.analysis_inputs.options) {
      expect(typeof opt.id).toBe('string')
      expect(typeof opt.option_id).toBe('string')
      expect(typeof opt.label).toBe('string')
      expect(opt.interventions).toBeDefined()
      expect(typeof opt.interventions).toBe('object')
    }
  })

  it('option_id mirrors id (PLoT compatibility)', () => {
    expect(req.analysis_inputs.options[0].id).toBe('opt_a')
    expect(req.analysis_inputs.options[0].option_id).toBe('opt_a')
  })

  it('analysis_inputs.goal_node_id is a non-empty string', () => {
    expect(typeof req.analysis_inputs.goal_node_id).toBe('string')
    expect(req.analysis_inputs.goal_node_id.length).toBeGreaterThan(0)
    expect(req.analysis_inputs.goal_node_id).toBe('goal_1')
  })

  it('analysis_inputs.constraints is present when goalConstraints is non-empty', () => {
    expect(req.analysis_inputs.constraints).toBeDefined()
    expect(Array.isArray(req.analysis_inputs.constraints)).toBe(true)
    expect(req.analysis_inputs.constraints!.length).toBeGreaterThan(0)
  })

  it('message is absent', () => {
    expect((req as Record<string, unknown>).message).toBeUndefined()
  })

  it('analysis_state is absent', () => {
    expect((req as Record<string, unknown>).analysis_state).toBeUndefined()
  })

  it('system_event is absent', () => {
    expect((req as Record<string, unknown>).system_event).toBeUndefined()
  })

  it('graph_state is present with nodes and edges arrays', () => {
    expect(Array.isArray(req.graph_state.nodes)).toBe(true)
    expect(Array.isArray(req.graph_state.edges)).toBe(true)
  })

  it('client_turn_id is a UUID', () => {
    expect(isUUID(req.client_turn_id)).toBe(true)
  })

  it('wire snapshot — only expected keys after stripTurnType', () => {
    const wire = stripTurnType(req)
    const keys = Object.keys(wire).sort()
    expect(keys).toEqual([
      'analysis_inputs',
      'client_turn_id',
      'conversation_history',
      'graph_state',
      'scenario_id',
    ])
  })
})

// ---------------------------------------------------------------------------
// T5b — Explain turn (explain, analysis_state present)
// Bridge contract: current transitional analysis_state shape.
// Target canonical shape will remove the results sentinel.
// See golden-path-validation-plan for target contract.
// ---------------------------------------------------------------------------

describe('T5b — Explain turn (after analysis)', () => {
  const analysisState = buildAnalysisState(RAW_V2_RESPONSE)

  const req = buildExplainTurnRequest({
    scenario_id: SCENARIO_ID,
    conversation_history: CONVERSATION_HISTORY,
    message: 'Why is Option A the recommended choice?',
    graph_state: POPULATED_GRAPH,
    analysis_state: analysisState,
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
  })

  it('analysis_state is present', () => {
    expect(req.analysis_state).toBeDefined()
  })

  it('analysis_state.analysis_status === "completed"', () => {
    expect(req.analysis_state!.analysis_status).toBe('completed')
  })

  it('analysis_state.meta.response_hash is a non-empty string', () => {
    expect(typeof req.analysis_state!.meta.response_hash).toBe('string')
    expect(req.analysis_state!.meta.response_hash.length).toBeGreaterThan(0)
  })

  it('analysis_state.option_comparison is an array at the TOP LEVEL (not nested in results)', () => {
    const state = req.analysis_state as Record<string, unknown>
    expect(Array.isArray(state.option_comparison)).toBe(true)
  })

  it('analysis_state.robustness is present at top level', () => {
    const state = req.analysis_state as Record<string, unknown>
    expect(state.robustness).toBeDefined()
    expect(state.robustness).not.toBeNull()
  })

  it('analysis_state.drivers is an array at top level', () => {
    const state = req.analysis_state as Record<string, unknown>
    expect(Array.isArray(state.drivers)).toBe(true)
  })

  it('analysis_state.results is NOT an array (it is the sentinel/summary, not V2 data)', () => {
    expect(Array.isArray(req.analysis_state!.results)).toBe(false)
  })

  it('analysis_state.results does NOT contain nested V2 fields (regression guard for the flatten bug)', () => {
    // The pre-refactor bug: V2 fields were wrapped inside results: { option_comparison: [...] }
    // CEE could not read them. Guard that we never regress to this shape.
    const results = req.analysis_state!.results
    if (results && typeof results === 'object' && !Array.isArray(results)) {
      const r = results as Record<string, unknown>
      expect(r).not.toHaveProperty('option_comparison')
      expect(r).not.toHaveProperty('robustness')
      expect(r).not.toHaveProperty('drivers')
      expect(r).not.toHaveProperty('edge_sensitivity')
    }
  })

  it('analysis_state.critiques is passed through from V2 response (regression guard)', () => {
    const state = req.analysis_state as Record<string, unknown>
    expect(Array.isArray(state.critiques)).toBe(true)
    const critiques = state.critiques as Array<{ code: string }>
    expect(critiques.length).toBeGreaterThan(0)
    expect(critiques[0].code).toBe('INBOUND_STRENGTH_SUM_EXCEEDED')
  })

  it('analysis_state.critiques defaults to empty array when absent from V2 response', () => {
    const rawWithoutCritiques = { ...RAW_V2_RESPONSE, critiques: undefined }
    const stateNoCritiques = buildAnalysisState(rawWithoutCritiques as any)
    expect(Array.isArray(stateNoCritiques.critiques)).toBe(true)
    expect((stateNoCritiques.critiques as unknown[]).length).toBe(0)
  })

  it('analysis_inputs is absent on explain turns', () => {
    expect((req as Record<string, unknown>).analysis_inputs).toBeUndefined()
  })

  it('message is the explain question', () => {
    expect(req.message).toBe('Why is Option A the recommended choice?')
  })

  it('wire snapshot — expected keys after stripTurnType (with analysis_state)', () => {
    const wire = stripTurnType(req)
    const keys = Object.keys(wire).sort()
    expect(keys).toEqual([
      'analysis_state',
      'client_turn_id',
      'conversation_history',
      'graph_state',
      'message',
      'scenario_id',
    ])
  })

  it('analysis_state V2 fields survive JSON round-trip at top level', () => {
    const parsed = JSON.parse(JSON.stringify(stripTurnType(req)))
    expect(Array.isArray(parsed.analysis_state.option_comparison)).toBe(true)
    expect(parsed.analysis_state.robustness).toBeDefined()
    expect(Array.isArray(parsed.analysis_state.drivers)).toBe(true)
    expect(Array.isArray(parsed.analysis_state.edge_sensitivity)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// R1 — Regression: object-shaped results guard
// Accidentally wrapping V2 fields inside results breaks CEE's field reading.
// ---------------------------------------------------------------------------

describe('R1 — Regression: V2 fields must NOT be nested inside results', () => {
  it('detects the wrong shape — V2 fields wrapped inside results (the historic bug)', () => {
    // Construct the WRONG shape to document what must never happen
    const wrongShape: ExplainAnalysisStatePayload = {
      analysis_status: 'completed',
      meta: { response_hash: 'hash-bad' },
      results: {
        // BUG: V2 fields nested here — CEE cannot read them
        option_comparison: [{ option_id: 'opt_a', rank: 1 }],
        robustness: { level: 'robust' },
        drivers: [{ factor_id: 'f1' }],
      },
    }

    const correctShape = buildAnalysisState(RAW_V2_RESPONSE)

    // Wrong: V2 fields are INSIDE results
    const wrongResults = wrongShape.results as Record<string, unknown>
    expect(wrongResults).toHaveProperty('option_comparison')
    expect(wrongResults).toHaveProperty('robustness')

    // Correct: V2 fields are at TOP LEVEL of analysis_state, NOT inside results
    expect(correctShape).toHaveProperty('option_comparison')
    expect(correctShape).toHaveProperty('robustness')
    expect(correctShape).toHaveProperty('drivers')
    const correctResults = correctShape.results
    if (correctResults && typeof correctResults === 'object') {
      expect(correctResults).not.toHaveProperty('option_comparison')
      expect(correctResults).not.toHaveProperty('robustness')
    }
  })

  it('snapshot: correct analysis_state top-level keys include V2 fields directly', () => {
    const state = buildAnalysisState(RAW_V2_RESPONSE)
    const keys = Object.keys(state).sort()
    expect(keys).toContain('option_comparison')
    expect(keys).toContain('robustness')
    expect(keys).toContain('drivers')
    expect(keys).toContain('edge_sensitivity')
    expect(keys).toContain('analysis_status')
    expect(keys).toContain('meta')
    expect(keys).toContain('results')
  })
})

// ---------------------------------------------------------------------------
// R2 — Regression: null rawV2Response → analysis_state omitted entirely
// ---------------------------------------------------------------------------

describe('R2 — Regression: null rawV2Response → analysis_state omitted', () => {
  it('analysis_state is absent when no rawV2Response (do not send empty analysis_state)', () => {
    // When rawV2 is null, no analysis_state should be constructed at all.
    // Passing undefined means the builder silently drops it.
    const req = buildExplainTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'Explain the results',
      graph_state: POPULATED_GRAPH,
      analysis_state: undefined,
    })
    expect(req.analysis_state).toBeUndefined()
  })

  it('analysis_state is absent when a malformed state is passed (builder rejects it)', () => {
    // isValidExplainAnalysisState rejects anything missing analysis_status/meta.response_hash/results
    const req = buildExplainTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'Explain',
      graph_state: EMPTY_GRAPH,
      analysis_state: {
        // Missing analysis_status, meta.response_hash, results
        option_comparison: [],
        robustness: null,
      },
    })
    expect(req.analysis_state).toBeUndefined()
  })

  it('analysis_state is absent when results is null (isValidExplainAnalysisState requires results != null)', () => {
    const req = buildExplainTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'Explain',
      graph_state: EMPTY_GRAPH,
      analysis_state: {
        analysis_status: 'completed',
        meta: { response_hash: 'hash-abc' },
        results: null,
      },
    })
    expect(req.analysis_state).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// R3 — Regression: null goalConstraints → constraints absent from analysis_inputs
// ---------------------------------------------------------------------------

describe('R3 — Regression: null goalConstraints → constraints absent from analysis_inputs', () => {
  it('constraints is absent when goalConstraints is null', () => {
    const inputs = buildAnalysisInputs({
      goal_node_id: 'goal_1',
      options: [{ id: 'opt_a', label: 'Option A', interventions: {} }],
      goalConstraints: null,
    })
    const req = buildRunAnalysisTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: [],
      graph_state: POPULATED_GRAPH,
      analysis_inputs: inputs,
    })
    expect(req.analysis_inputs.constraints).toBeUndefined()
  })

  it('constraints is absent when goalConstraints is an empty array', () => {
    const inputs = buildAnalysisInputs({
      goal_node_id: 'goal_1',
      options: [{ id: 'opt_a', label: 'Option A', interventions: {} }],
      goalConstraints: [],
    })
    const req = buildRunAnalysisTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: [],
      graph_state: POPULATED_GRAPH,
      analysis_inputs: inputs,
    })
    expect(req.analysis_inputs.constraints).toBeUndefined()
  })

  it('constraints IS present when goalConstraints has entries', () => {
    const constraints: CEEGoalConstraint[] = [
      { id: 'c1', label: 'Revenue target', operator: '>=', value: 0.1, probability: null },
    ]
    const inputs = buildAnalysisInputs({
      goal_node_id: 'goal_1',
      options: [{ id: 'opt_a', label: 'Option A', interventions: {} }],
      goalConstraints: constraints,
    })
    const req = buildRunAnalysisTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: [],
      graph_state: POPULATED_GRAPH,
      analysis_inputs: inputs,
    })
    expect(req.analysis_inputs.constraints).toBeDefined()
    expect(req.analysis_inputs.constraints).toHaveLength(1)
    expect(req.analysis_inputs.constraints![0].id).toBe('c1')
  })
})

// ---------------------------------------------------------------------------
// Cross-turn invariants
// ---------------------------------------------------------------------------

describe('Cross-turn invariants', () => {
  it('scenario_id is always the same UUID across turns', () => {
    const turns = [
      buildExplicitGenerateTurnRequest({
        scenario_id: SCENARIO_ID,
        conversation_history: [],
        message: 'Brief',
        graph_state: EMPTY_GRAPH,
      }),
      buildConversationTurnRequest({
        scenario_id: SCENARIO_ID,
        conversation_history: CONVERSATION_HISTORY,
        message: 'Update',
        graph_state: POPULATED_GRAPH,
      }),
      buildRunAnalysisTurnRequest({
        scenario_id: SCENARIO_ID,
        conversation_history: CONVERSATION_HISTORY,
        graph_state: POPULATED_GRAPH,
        analysis_inputs: buildAnalysisInputs({
          goal_node_id: 'goal_1',
          options: [{ id: 'opt_a', label: 'Option A', interventions: {} }],
        }),
      }),
    ]
    for (const t of turns) {
      expect(t.scenario_id).toBe(SCENARIO_ID)
      expect(isUUID(t.scenario_id)).toBe(true)
    }
  })

  it('client_turn_id is always a valid UUID across all turn types', () => {
    const turns = [
      buildExplicitGenerateTurnRequest({
        scenario_id: SCENARIO_ID, conversation_history: [], message: 'Brief', graph_state: EMPTY_GRAPH,
      }),
      buildConversationTurnRequest({
        scenario_id: SCENARIO_ID, conversation_history: [], message: 'Update', graph_state: EMPTY_GRAPH,
      }),
      buildRunAnalysisTurnRequest({
        scenario_id: SCENARIO_ID, conversation_history: [], graph_state: EMPTY_GRAPH,
        analysis_inputs: buildAnalysisInputs({ goal_node_id: 'g1', options: [{ id: 'o1', label: 'O1', interventions: {} }] }),
      }),
      buildExplainTurnRequest({
        scenario_id: SCENARIO_ID, conversation_history: [], message: 'Explain', graph_state: EMPTY_GRAPH,
        analysis_state: buildAnalysisState(RAW_V2_RESPONSE),
      }),
    ]
    for (const t of turns) {
      expect(isUUID(t.client_turn_id)).toBe(true)
    }
  })

  it('conversation_history entries always have role and content fields', () => {
    const req = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'Test',
      graph_state: EMPTY_GRAPH,
    })
    for (const entry of req.conversation_history) {
      expect(['user', 'assistant']).toContain(entry.role)
      expect(typeof entry.content).toBe('string')
    }
  })

  it('generate_model is absent on all non-explicit_generate turns', () => {
    const conversation = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID, conversation_history: [], message: 'T', graph_state: EMPTY_GRAPH,
    })
    const runAnalysis = buildRunAnalysisTurnRequest({
      scenario_id: SCENARIO_ID, conversation_history: [], graph_state: EMPTY_GRAPH,
      analysis_inputs: buildAnalysisInputs({ goal_node_id: 'g1', options: [{ id: 'o1', label: 'O1', interventions: {} }] }),
    })
    const explain = buildExplainTurnRequest({
      scenario_id: SCENARIO_ID, conversation_history: [], message: 'E', graph_state: EMPTY_GRAPH,
      analysis_state: buildAnalysisState(RAW_V2_RESPONSE),
    })

    expect((conversation as Record<string, unknown>).generate_model).toBeUndefined()
    expect((runAnalysis as Record<string, unknown>).generate_model).toBeUndefined()
    expect((explain as Record<string, unknown>).generate_model).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// T7 — Chip metadata transport (conversation turn with chip_metadata)
// ---------------------------------------------------------------------------

describe('T7 — Chip metadata transport', () => {
  it('includes chip_metadata on conversation turn when provided', () => {
    const req = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'Set churn to 4%',
      graph_state: POPULATED_GRAPH,
      chip_metadata: { action_type: 'set_factor_value', parameters: { target_id: 'fac_churn', value: 0.04 } },
    })
    const wire = stripTurnType(req) as Record<string, unknown>
    expect(wire.chip_metadata).toEqual({
      action_type: 'set_factor_value',
      parameters: { target_id: 'fac_churn', value: 0.04 },
    })
  })

  it('omits chip_metadata when not provided (free-text message)', () => {
    const req = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: CONVERSATION_HISTORY,
      message: 'What about the churn rate?',
      graph_state: POPULATED_GRAPH,
    })
    const wire = stripTurnType(req)
    expect('chip_metadata' in wire).toBe(false)
    const parsed = JSON.parse(JSON.stringify(wire))
    expect(parsed.chip_metadata).toBeUndefined()
  })

  it('chip_metadata is in the conversation turn allowlist', () => {
    const req = buildConversationTurnRequest({
      scenario_id: SCENARIO_ID,
      conversation_history: [],
      message: 'Run analysis',
      graph_state: EMPTY_GRAPH,
      chip_metadata: { action_type: 'run_analysis' },
    })
    // Should not throw — validateTurnRequestBoundary would strip unknown fields
    expect(req.chip_metadata).toEqual({ action_type: 'run_analysis' })
  })
})
