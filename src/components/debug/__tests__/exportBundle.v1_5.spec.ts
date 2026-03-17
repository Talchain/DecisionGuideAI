import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({ short: 'test-version', branch: 'main' }),
}))

vi.mock('../../../utils/debugLogBuffer', () => ({
  getBufferedLogs: () => [],
}))

// Mock debug-state with controllable user actions
const mockUserActions: Array<{ actionType: string; timestamp: string; payloadSummary?: Record<string, unknown> }> = []
vi.mock('../../../lib/debug-state', () => ({
  getUserActions: () => [...mockUserActions],
}))

import { buildDebugBundle, type FullGraphData } from '../utils/exportBundle'

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: {
      cee: { name: 'CEE', status: 200, success: true, duration_ms: 245, endpoint: '/cee/draft-graph' },
      plot: { name: 'PLoT', status: 202, success: true, duration_ms: 510, endpoint: '/plot/v2/run' },
      isl: null,
    },
    error: null,
    builds: { ui: 'test-build', cee: 'cee-build', plot: 'plot-build', isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none',
      cee_trace_present: false,
      cee_degraded: false,
      llm_raw_available: false,
      llm_raw_path_found: null,
    },
    ceeTrace: null,
    corrections: [],
    correctionsSummary: null,
    pipeline: {
      status: 'success',
      total_duration_ms: 1200,
      stages: [],
      llm_metadata: null,
      llm_raw: null,
      node_extraction: null,
      connectivity: { decision_count: 1, option_count: 2, goal_count: 1, factor_count: 3, edge_count: 2 },
    },
    payloads: {
      cee_request: null,
      cee_response: { trace: { pipeline: { validated_causal_claims: [{ id: 'c1' }] } } },
      plot_request: { prompt: 'analyze' },
      plot_response: { result: 'ok' },
      isl_request: null,
      isl_response: null,
    },
    gates: [
      { name: 'graph_readiness' as const, status: 'fail' as const, message: 'pre-run' },
      { name: 'run' as const, status: 'pass' as const },
    ],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: {
      ui_generated: 'ui-req-123',
      from_plot: { ui: 'ui-req-123', plot: 'plot-req-456', isl: 'isl-req-789', isl_echoed: 'isl-req-789', all_match: false, chain_complete: true },
      plot_chain_present: true,
      draft_trace: { cee_trace: 'cee-trace-321' },
    } as RequestIdChain,
    feature_flags_at_request: { orchestrator_validation: true } as never,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    ...overrides,
  }
}

function makeGraphData(): FullGraphData {
  return {
    nodes: [
      {
        id: 'f1',
        data: {
          label: 'Revenue',
          kind: 'factor',
          type: 'factor',
          description: 'Total revenue',
          observedState: { value: 100, baseline: 80, unit: 'USD' },
          category: 'controllable',
        },
      },
      {
        id: 'o1',
        data: {
          label: 'Plan A',
          kind: 'option',
          type: 'option',
          interventions: [{ factor_id: 'f1', value: 120 }],
          interventionKeys: ['f1'],
        },
      },
      {
        id: 'g1',
        data: {
          label: 'Maximize Profit',
          kind: 'goal',
          type: 'goal',
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'f1',
        target: 'g1',
        data: {
          weight: 0.7,
          direction: 'positive',
          beliefExists: 0.9,
          beliefStrength: 0.8,
          strength_mean: 0.65,
          strength_std: 0.1,
        },
      },
    ],
  }
}

describe('Debug Bundle V1.5', () => {
  beforeEach(() => {
    mockUserActions.length = 0
  })

  it('always produces v1.5 with correct meta', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.meta.version).toBe('1.5')
    expect(bundle.export_summary_schema.runtime_capture_included).toBe(true)
    expect(bundle.export_summary_schema.note).toContain('V1.5')
  })

  it('display_state is null when no displayState provided', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.display_state).toBeNull()
  })

  it('display_state is populated when provided in options', () => {
    const displayState = {
      active_panel: 'analysis',
      active_tab: 'results',
      active_section: 'outcomes',
      canvas_node_count: 5,
      canvas_edge_count: 3,
      canvas_node_types: { factor: 3, option: 1, goal: 1 },
      rendered_options: [{ id: 'o1', label_displayed: 'Plan A', win_probability_displayed: '96.2%', rank_displayed: 1 }],
      rendered_factors: null,
      analysis_status_displayed: 'complete',
      hero_headline_displayed: 'Plan A is recommended',
    }
    const bundle = buildDebugBundle(makeDebugData(), { displayState })
    expect(bundle.display_state).toEqual(displayState)
    expect(bundle.display_state!.canvas_node_count).toBe(5)
  })

  // Enriched full_graph
  it('full_graph uses enriched format with observed_state, category, interventions', () => {
    const bundle = buildDebugBundle(makeDebugData(), {
      includeFullGraph: true,
      graphData: makeGraphData(),
    })
    expect(bundle.full_graph!._meta).toEqual({ node_type_field: 'type', enriched: true })

    const factor = bundle.full_graph!.factors[0] as Record<string, unknown>
    expect(factor.observed_state).toEqual({ value: 100, baseline: 80, unit: 'USD' })
    expect(factor.category).toBe('controllable')
    expect(factor.kind).toBe('factor')

    const option = bundle.full_graph!.options[0] as Record<string, unknown>
    expect(option.interventions).toEqual([{ factor_id: 'f1', value: 120 }])
    expect(option.interventionKeys).toEqual(['f1'])
  })

  it('enriched edges include weight, direction, beliefStrength', () => {
    const bundle = buildDebugBundle(makeDebugData(), {
      includeFullGraph: true,
      graphData: makeGraphData(),
    })
    const edge = bundle.full_graph!.edges[0] as Record<string, unknown>
    expect(edge.weight).toBe(0.7)
    expect(edge.direction).toBe('positive')
    expect(edge.beliefStrength).toBe(0.8)
    expect(edge.strength_mean).toBe(0.65)
    expect(edge.strength_std).toBe(0.1)
    expect(edge.belief_exists).toBe(0.9)
  })

  // User actions
  it('user_actions populated from debug-state ring buffer', () => {
    mockUserActions.push(
      { actionType: 'analyse_triggered', timestamp: '2024-01-01T00:00:00.000Z' },
      { actionType: 'tab_navigated', timestamp: '2024-01-01T00:00:01.000Z', payloadSummary: { tab: 'results' } },
    )
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.user_actions).toHaveLength(2)
    expect(bundle.user_actions[0]).toEqual({
      action: 'analyse_triggered',
      timestamp: '2024-01-01T00:00:00.000Z',
      detail: undefined,
    })
    expect(bundle.user_actions[1]).toEqual({
      action: 'tab_navigated',
      timestamp: '2024-01-01T00:00:01.000Z',
      detail: { tab: 'results' },
    })
  })

  it('user_actions capped at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      mockUserActions.push({ actionType: `action_${i}`, timestamp: `2024-01-01T00:00:${String(i).padStart(2, '0')}.000Z` })
    }
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.user_actions.length).toBeLessThanOrEqual(50)
  })

  // Gate timing fix
  it('corrects graph_readiness gate when pipeline succeeded', () => {
    const bundle = buildDebugBundle(makeDebugData({
      overall: { status: 'success', total_duration_ms: 1000, request_id: 'req-1' },
      gates: [
        { name: 'graph_readiness' as const, status: 'fail' as const, message: 'pre-run' },
        { name: 'run' as const, status: 'pass' as const },
      ],
    }))
    const grGate = bundle.gates.find(g => g.name === 'graph_readiness')
    expect(grGate?.status).toBe('pass')
    expect(grGate?.message).toContain('corrected')
  })

  it('does NOT correct graph_readiness gate when pipeline failed', () => {
    const bundle = buildDebugBundle(makeDebugData({
      overall: { status: 'error', total_duration_ms: 1000, request_id: 'req-1' },
      gates: [
        { name: 'graph_readiness' as const, status: 'fail' as const, message: 'validation error' },
      ],
    }))
    const grGate = bundle.gates.find(g => g.name === 'graph_readiness')
    expect(grGate?.status).toBe('fail')
  })

  // Schema versions
  it('populates schema_versions from payloads when data.schema_versions is null', () => {
    const bundle = buildDebugBundle(makeDebugData({
      schema_versions: null,
      payloads: {
        cee_request: { schema_version: 'v3' },
        cee_response: { trace: { schema_version: 'v3' } },
        plot_request: { schema_version: 'v3' },
        plot_response: { meta: { schema_version: 'v3' } },
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.schema_versions).toBeDefined()
    expect(bundle.schema_versions!.cee_request).toBe('v3')
    expect(bundle.schema_versions!.consistent).toBe(true)
  })

  // v12_4_checks passthrough
  it('passes through v12_4_checks when present', () => {
    const checks = {
      category_field_present: true,
      nodes_with_category: ['f1', 'f2'],
      nodes_missing_category: [],
      category_values: { f1: 'controllable', f2: 'observable' },
    }
    const bundle = buildDebugBundle(makeDebugData({ v12_4_checks: checks }))
    expect(bundle.v12_4_checks).toEqual(checks)
  })

  it('v12_4_checks is null when not present', () => {
    const bundle = buildDebugBundle(makeDebugData({ v12_4_checks: null }))
    expect(bundle.v12_4_checks).toBeNull()
  })

  // Readme
  it('readme documents V1.5 sections', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.readme).toContain('Version: 1.5')
    expect(bundle.readme).toContain('display_state')
    expect(bundle.readme).toContain('user_actions')
  })

  // CEE payloads passthrough
  it('CEE payloads are passed through from DebugData', () => {
    const ceeReq = { brief: 'test brief', schema: 'v3' }
    const ceeRes = { trace: { pipeline: { status: 'success' } }, _error: false }
    const bundle = buildDebugBundle(makeDebugData({
      payloads: {
        cee_request: ceeReq,
        cee_response: ceeRes,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.payloads.cee_request).toEqual(ceeReq)
    expect(bundle.payloads.cee_response).toEqual(ceeRes)
  })

  it('CEE error response is captured in payloads', () => {
    const ceeError = { error: 'CEE failed', status: 500, _error: true }
    const bundle = buildDebugBundle(makeDebugData({
      payloads: {
        cee_request: { brief: 'test' },
        cee_response: ceeError,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.payloads.cee_response).toEqual(ceeError)
  })

  // CEE downstream fallback (Task 1)
  it('falls back to cee_downstream_* when direct CEE payloads are null', () => {
    const downstreamReq = { brief: 'downstream test', schema_version: 'v3' }
    const downstreamRes = { trace: { schema_version: 'v3' }, result: 'ok' }
    const bundle = buildDebugBundle(makeDebugData({
      payloads: {
        cee_request: null,
        cee_response: null,
        cee_downstream_request: downstreamReq,
        cee_downstream_response: downstreamRes,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.payloads.cee_request).toEqual(downstreamReq)
    expect(bundle.payloads.cee_response).toEqual(downstreamRes)
  })

  it('prefers direct CEE payloads over downstream when both exist', () => {
    const directReq = { brief: 'direct' }
    const directRes = { result: 'direct' }
    const bundle = buildDebugBundle(makeDebugData({
      payloads: {
        cee_request: directReq,
        cee_response: directRes,
        cee_downstream_request: { brief: 'downstream' },
        cee_downstream_response: { result: 'downstream' },
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.payloads.cee_request).toEqual(directReq)
    expect(bundle.payloads.cee_response).toEqual(directRes)
  })

  // User action redaction (Task 3)
  it('redacts raw_message and display_text from user actions', () => {
    mockUserActions.push({
      actionType: 'sent chat message',
      timestamp: '2024-01-01T00:00:00.000Z',
      payloadSummary: { raw_message: 'my secret decision', display_text: 'my secret' },
    })
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.user_actions).toHaveLength(1)
    const detail = bundle.user_actions[0].detail as Record<string, unknown>
    expect(detail.raw_message).toBeUndefined()
    expect(detail.display_text).toBeUndefined()
    expect(detail.message_length).toBe(18) // 'my secret decision'.length
  })

  it('preserves non-sensitive user action fields', () => {
    mockUserActions.push({
      actionType: 'clicked chip',
      timestamp: '2024-01-01T00:00:00.000Z',
      payloadSummary: { chip_label: 'Run Analysis', intent: 'run' },
    })
    const bundle = buildDebugBundle(makeDebugData())
    const detail = bundle.user_actions[0].detail as Record<string, unknown>
    expect(detail.chip_label).toBe('Run Analysis')
    expect(detail.intent).toBe('run')
  })

  it('redacts raw_message from retry action but keeps client_turn_id', () => {
    mockUserActions.push({
      actionType: 'clicked retry',
      timestamp: '2024-01-01T00:00:00.000Z',
      payloadSummary: { raw_message: 'sensitive text', client_turn_id: 'turn-123' },
    })
    const bundle = buildDebugBundle(makeDebugData())
    const detail = bundle.user_actions[0].detail as Record<string, unknown>
    expect(detail.raw_message).toBeUndefined()
    expect(detail.message_length).toBe(14)
    expect(detail.client_turn_id).toBe('turn-123')
  })

  // Schema versions from downstream CEE (Task 2)
  it('extracts CEE schema versions from downstream responses', () => {
    const bundle = buildDebugBundle(makeDebugData({
      schema_versions: null,
      payloads: {
        cee_request: null,
        cee_response: null,
        cee_downstream_request: { schema_version: 'v4' },
        cee_downstream_response: { trace: { schema_version: 'v4' } },
        plot_request: { schema_version: 'v4' },
        plot_response: { meta: { schema_version: 'v4' } },
        isl_request: null,
        isl_response: null,
      },
    }))
    expect(bundle.schema_versions!.cee_request).toBe('v4')
    expect(bundle.schema_versions!.cee_response).toBe('v4')
    expect(bundle.schema_versions!.consistent).toBe(true)
  })

  // Empty state: graceful nulls
  it('handles empty state without crashes', () => {
    const bundle = buildDebugBundle(makeDebugData({
      services: { cee: null, plot: null, isl: null },
      payloads: { cee_request: null, cee_response: null, plot_request: null, plot_response: null, isl_request: null, isl_response: null },
      request_id_chain: null,
      cee_observability: null,
      schema_versions: null,
      v12_4_checks: null,
      feature_flags_at_request: null,
      orchestrator: null,
    }))
    expect(bundle.meta.version).toBe('1.5')
    expect(bundle.display_state).toBeNull()
    expect(bundle.user_actions).toEqual([])
    expect(bundle.orchestrator).toBeNull()
    expect(bundle.v12_4_checks).toBeNull()
    expect(bundle.schema_versions).toBeDefined()
  })

  // Task 2: Comprehensive section verification
  it('populates all v1.5 sections when data is available', () => {
    mockUserActions.push(
      { actionType: 'analyse_triggered', timestamp: '2024-01-01T00:00:00.000Z' },
    )
    const displayState = {
      active_panel: 'results',
      active_tab: 'outcomes',
      active_section: null,
      canvas_node_count: 3,
      canvas_edge_count: 1,
      canvas_node_types: { factor: 1, option: 1, goal: 1 },
      rendered_options: [{ id: 'o1', label_displayed: 'Plan A', win_probability_displayed: '96%', rank_displayed: 1 }],
      rendered_factors: null,
      analysis_status_displayed: 'complete',
      hero_headline_displayed: 'Plan A is recommended',
    }
    const orchestratorData = {
      turn_count: 3,
      blocks: [{ type: 'analysis', id: 'b1' }],
      coaching_signals: ['ready_to_analyse'],
    }
    const bundle = buildDebugBundle(makeDebugData({
      payloads: {
        cee_request: { brief: 'test', schema_version: 'v3' },
        cee_response: { trace: { schema_version: 'v3', pipeline: { status: 'success' } } },
        plot_request: { prompt: 'analyze', schema_version: 'v3' },
        plot_response: { result: 'ok', meta: { schema_version: 'v3' } },
        isl_request: { data: 'isl', schema_version: 'v3' },
        isl_response: { stability: 0.9, meta: { schema_version: 'v3' } },
      },
      ceeTrace: { model: 'gpt-4', provider: 'openai' } as never,
      cee_observability: {
        llm_calls: [{ model: 'gpt-4', duration_ms: 100, raw_prompt: 'secret', raw_response: 'secret' }],
        validation: null,
        orchestrator: null,
        totals: { total_llm_calls: 1 },
        graph_metrics: null,
        graph_diffs: null,
        request_id: 'req-1',
        repair_summary: null,
      } as never,
      orchestrator: orchestratorData as never,
      v12_4_checks: { category_field_present: true, nodes_with_category: ['f1'], nodes_missing_category: [], category_values: { f1: 'controllable' } },
    }), {
      includeFullGraph: true,
      graphData: makeGraphData(),
      displayState,
    })

    // meta
    expect(bundle.meta.version).toBe('1.5')

    // payloads
    expect(bundle.payloads.cee_request).toBeDefined()
    expect(bundle.payloads.cee_response).toBeDefined()

    // cee_trace
    expect(bundle.cee_trace).toBeDefined()

    // cee_observability (raw I/O stripped)
    expect(bundle.cee_observability).toBeDefined()
    const llmCall = bundle.cee_observability!.llm_calls[0] as Record<string, unknown>
    expect(llmCall.raw_prompt).toBeUndefined()
    expect(llmCall.raw_response).toBeUndefined()

    // full_graph (enriched)
    expect(bundle.full_graph).toBeDefined()
    expect(bundle.full_graph!._meta).toEqual({ node_type_field: 'type', enriched: true })
    const factor = bundle.full_graph!.factors[0] as Record<string, unknown>
    expect(factor.observed_state).toBeDefined()
    expect(factor.category).toBeDefined()
    expect(factor.kind).toBeDefined()
    const option = bundle.full_graph!.options[0] as Record<string, unknown>
    expect(option.interventions).toBeDefined()
    const edge = bundle.full_graph!.edges[0] as Record<string, unknown>
    expect(edge.strength_mean).toBeDefined()

    // display_state
    expect(bundle.display_state).toEqual(displayState)

    // orchestrator
    expect(bundle.orchestrator).toEqual(orchestratorData)

    // user_actions
    expect(bundle.user_actions).toHaveLength(1)
    expect(bundle.user_actions[0].action).toBe('analyse_triggered')

    // panel_state (sync path — not populated, available: false)
    expect(bundle.panel_state).toBeDefined()

    // schema_versions (extracted from payloads)
    expect(bundle.schema_versions).toBeDefined()
    expect(bundle.schema_versions!.cee_request).toBe('v3')
    expect(bundle.schema_versions!.isl_request).toBe('v3')
    expect(bundle.schema_versions!.isl_response).toBe('v3')
    expect(bundle.schema_versions!.consistent).toBe(true)

    // feature_flags_at_request
    expect(bundle.feature_flags_at_request).toBeDefined()

    // gates (corrected — pipeline succeeded so graph_readiness should be pass)
    const grGate = bundle.gates.find(g => g.name === 'graph_readiness')
    expect(grGate?.status).toBe('pass')
    expect(grGate?.message).toContain('corrected')

    // v12_4_checks
    expect(bundle.v12_4_checks).toBeDefined()
    expect(bundle.v12_4_checks!.category_field_present).toBe(true)

    // export_summary_schema
    expect(bundle.export_summary_schema.runtime_capture_included).toBe(true)
  })
})
