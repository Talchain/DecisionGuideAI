import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildClarificationResponseTurnRequest,
  buildConversationTurnRequest,
  buildExplicitGenerateTurnRequest,
  buildExplainTurnRequest,
  buildPatchFollowupTurnRequest,
  buildRunAnalysisTurnRequest,
  buildSystemEventTurnRequest,
  stripDevTurnType,
  validateTurnRequestBoundary,
} from '../turn-request-builder'

const history = [{ role: 'user', content: 'hello' }] as const
const graphState = { nodes: [{ id: 'n1' }], edges: [{ from: 'n1', to: 'n2' }] }
const validAnalysisState = {
  analysis_status: 'complete',
  meta: { response_hash: 'hash-1' },
  results: { summary: 'ok' },
}

describe('turn request builders', () => {
  it('conversation request includes only allowed fields', () => {
    const req = buildConversationTurnRequest({
      scenario_id: 's1',
      conversation_history: [...history],
      message: 'question',
      graph_state: graphState,
      selected_elements: { node_ids: ['n1'] },
    })

    expect(req).toMatchObject({
      scenario_id: 's1',
      message: 'question',
      graph_state: graphState,
      selected_elements: { node_ids: ['n1'] },
    })
    expect(req).not.toHaveProperty('analysis_state')
    expect(req).not.toHaveProperty('analysis_inputs')
    expect(req).not.toHaveProperty('system_event')
  })

  it('conversation request omits selected_elements when missing', () => {
    const req = buildConversationTurnRequest({
      scenario_id: 's1',
      conversation_history: [...history],
      message: 'question',
      graph_state: graphState,
    })

    expect(req).not.toHaveProperty('selected_elements')
  })

  it('explicit_generate request includes graph_state and excludes analysis/system fields', () => {
    const req = buildExplicitGenerateTurnRequest({
      scenario_id: 's2',
      conversation_history: [...history],
      message: 'generate',
      graph_state: graphState,
    })

    expect(req).toHaveProperty('graph_state')
    expect(req).toHaveProperty('message', 'generate')
    expect(req).not.toHaveProperty('analysis_state')
    expect(req).not.toHaveProperty('analysis_inputs')
    expect(req).not.toHaveProperty('system_event')
  })

  it('run_analysis request includes analysis_inputs and excludes message', () => {
    const req = buildRunAnalysisTurnRequest({
      scenario_id: 's3',
      conversation_history: [...history],
      graph_state: graphState,
      analysis_inputs: { options: [], goal_node_id: 'g1' },
    })

    expect(req).toHaveProperty('analysis_inputs')
    expect(req).toHaveProperty('graph_state')
    expect(req).not.toHaveProperty('message')
    expect(req).not.toHaveProperty('analysis_state')
  })

  it('system_event request includes only system_event payload', () => {
    const req = buildSystemEventTurnRequest({
      scenario_id: 's4',
      conversation_history: [...history],
      message: '[system]',
      graph_state: graphState,
      system_event: { type: 'direct_graph_edit', payload: { changed_node_ids: ['n1'] } },
    })

    expect(req).toHaveProperty('system_event')
    expect(req).toHaveProperty('message', '[system]')
    expect(req).toHaveProperty('graph_state')
    expect(req).not.toHaveProperty('analysis_state')
  })

  it('patch_followup request includes graph_state without message/system_event', () => {
    const req = buildPatchFollowupTurnRequest({
      scenario_id: 's5',
      conversation_history: [...history],
      graph_state: graphState,
    })

    expect(req).toHaveProperty('graph_state')
    expect(req).not.toHaveProperty('message')
    expect(req).not.toHaveProperty('system_event')
    expect(req).not.toHaveProperty('analysis_state')
  })

  it('explain request includes analysis_state when valid', () => {
    const req = buildExplainTurnRequest({
      scenario_id: 's6',
      conversation_history: [...history],
      message: 'explain why',
      graph_state: graphState,
      analysis_state: validAnalysisState,
    })

    expect(req).toHaveProperty('analysis_state')
    expect(req).toHaveProperty('graph_state')
    expect(req).toHaveProperty('message', 'explain why')
  })

  it('explain request drops analysis_state when partial', () => {
    const req = buildExplainTurnRequest({
      scenario_id: 's6',
      conversation_history: [...history],
      message: 'explain why',
      graph_state: graphState,
      analysis_state: {
        analysis_status: 'complete',
        meta: {},
      } as unknown,
    })

    expect(req).not.toHaveProperty('analysis_state')
  })

  it('clarification_response request includes message and excludes graph/analysis/system fields', () => {
    const req = buildClarificationResponseTurnRequest({
      scenario_id: 's7',
      conversation_history: [...history],
      message: 'clarification answer',
    })

    expect(req).toHaveProperty('message', 'clarification answer')
    expect(req).not.toHaveProperty('graph_state')
    expect(req).not.toHaveProperty('analysis_state')
    expect(req).not.toHaveProperty('system_event')
  })

  it('client_turn_id is unique per call when not provided', () => {
    const a = buildConversationTurnRequest({
      scenario_id: 'sx',
      conversation_history: [...history],
      message: 'first',
      graph_state: graphState,
    })
    const b = buildConversationTurnRequest({
      scenario_id: 'sx',
      conversation_history: [...history],
      message: 'second',
      graph_state: graphState,
    })

    expect(a.client_turn_id).toBeTruthy()
    expect(b.client_turn_id).toBeTruthy()
    expect(a.client_turn_id).not.toBe(b.client_turn_id)
  })

  it('preserves caller-provided client_turn_id', () => {
    const req = buildConversationTurnRequest({
      scenario_id: 's8',
      conversation_history: [...history],
      message: 'm',
      graph_state: graphState,
      client_turn_id: 'fixed-id',
    })

    expect(req.client_turn_id).toBe('fixed-id')
  })

  it('analysis_state is structurally absent on conversation turns (builder never produces it)', () => {
    // Regression guard for the root bug: analysis_state must never appear on conversation turns
    const req = buildConversationTurnRequest({
      scenario_id: 's9',
      conversation_history: [...history],
      message: 'plain message',
      graph_state: graphState,
    })

    expect(req).not.toHaveProperty('analysis_state')
    // Verify after wire stripping too
    const wire = stripDevTurnType(req)
    expect(wire).not.toHaveProperty('analysis_state')
  })

  it('graph_state is present on plain conversation', () => {
    const req = buildConversationTurnRequest({
      scenario_id: 's10',
      conversation_history: [...history],
      message: 'hello',
      graph_state: graphState,
    })

    expect(req).toHaveProperty('graph_state')
  })

  it('system_event is absent on non-system turns', () => {
    const req = buildClarificationResponseTurnRequest({
      scenario_id: 's11',
      conversation_history: [...history],
      message: 'answer',
    })

    expect(req).not.toHaveProperty('system_event')
  })
})

describe('validateTurnRequestBoundary (dev-mode)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('logs forbidden field violations', () => {
    const req = {
      ...buildConversationTurnRequest({
        scenario_id: 's12',
        conversation_history: [...history],
        message: 'hello',
        graph_state: graphState,
      }),
      forbidden_field: 'should not be here',
    } as any

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BOUNDARY]',
      expect.objectContaining({ field: 'forbidden_field', violation: 'forbidden_field' }),
    )
  })

  it('logs analysis_state_forbidden_on_conversation_turn when analysis_state is present on conversation', () => {
    const req = {
      ...buildConversationTurnRequest({
        scenario_id: 's12b',
        conversation_history: [...history],
        message: 'hello',
        graph_state: graphState,
      }),
      analysis_state: validAnalysisState,
    } as any

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BOUNDARY]',
      expect.objectContaining({ field: 'analysis_state', violation: 'analysis_state_forbidden_on_conversation_turn' }),
    )
  })

  it('logs missing required field violations', () => {
    const req = buildConversationTurnRequest({
      scenario_id: 's13',
      conversation_history: [...history],
      message: '',
      graph_state: graphState,
    })

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BOUNDARY]',
      expect.objectContaining({ field: 'message', violation: 'missing_required_field' }),
    )
  })

  it('logs partial analysis_state violations', () => {
    const req = {
      ...buildExplainTurnRequest({
        scenario_id: 's14',
        conversation_history: [...history],
        message: 'explain',
        graph_state: graphState,
      }),
      analysis_state: {
        analysis_status: 'complete',
        meta: {},
      },
    } as any

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BOUNDARY]',
      expect.objectContaining({ field: 'analysis_state', violation: 'analysis_state_requires_analysis_status_meta_response_hash_results' }),
    )
  })

  it('logs graph_state structural violations when present but malformed', () => {
    const req = {
      ...buildPatchFollowupTurnRequest({
        scenario_id: 's15',
        conversation_history: [...history],
        graph_state: graphState,
      }),
      graph_state: { nodes: 'not-array' },
    } as any

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[BOUNDARY]',
      expect.objectContaining({ field: 'graph_state', violation: 'graph_state_requires_nodes_and_edges_arrays' }),
    )
  })

  it('accepts first-turn explicit_generate with empty conversation_history (no violations)', () => {
    const req = buildExplicitGenerateTurnRequest({
      scenario_id: 's16',
      conversation_history: [],
      message: 'Build a decision model for choosing a car',
      graph_state: { nodes: [], edges: [] },
    })

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('accepts multi-turn explicit_generate with populated conversation_history (no violations)', () => {
    const req = buildExplicitGenerateTurnRequest({
      scenario_id: 's17',
      conversation_history: [...history],
      message: 'Now generate the model',
      graph_state: graphState,
    })

    validateTurnRequestBoundary(req)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
