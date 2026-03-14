import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'

// Mock feature flag — default OFF, tests toggle via localStorage
vi.mock('../../../flags', () => ({
  isDebugBundleV1_5Enabled: () => {
    try {
      return localStorage.getItem('feature.debugBundleV1_5') === '1'
    } catch {
      return false
    }
  },
}))

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

import { buildDebugBundle, type ExportOptions, type FullGraphData } from '../utils/exportBundle'

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

describe('Debug Bundle V1.5 — flag OFF produces v1.4', () => {
  beforeEach(() => {
    localStorage.removeItem('feature.debugBundleV1_5')
    mockUserActions.length = 0
  })

  it('produces v1.4 when flag is OFF', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.meta.version).toBe('1.4')
    expect(bundle.export_summary_schema.runtime_capture_included).toBe(false)
    expect(bundle.user_actions).toEqual([])
    expect(bundle.display_state).toBeUndefined()
  })

  it('full_graph uses stripped format in v1.4', () => {
    const bundle = buildDebugBundle(makeDebugData(), {
      includeFullGraph: true,
      graphData: makeGraphData(),
    })
    expect(bundle.meta.version).toBe('1.4')
    expect(bundle.full_graph).toBeDefined()
    expect(bundle.full_graph!._meta).toBeUndefined()
    // v1.4 nodes should NOT have observed_state
    const factor = bundle.full_graph!.factors[0] as Record<string, unknown>
    expect(factor.observed_state).toBeUndefined()
    expect(factor.category).toBeUndefined()
  })

  it('gates are passed through without correction in v1.4', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.meta.version).toBe('1.4')
    const grGate = bundle.gates.find(g => g.name === 'graph_readiness')
    expect(grGate?.status).toBe('fail') // Not corrected in v1.4
  })
})

describe('Debug Bundle V1.5 — flag ON', () => {
  beforeEach(() => {
    localStorage.setItem('feature.debugBundleV1_5', '1')
    mockUserActions.length = 0
  })

  afterEach(() => {
    localStorage.removeItem('feature.debugBundleV1_5')
  })

  it('produces v1.5 with correct meta', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.meta.version).toBe('1.5')
    expect(bundle.export_summary_schema.runtime_capture_included).toBe(true)
    expect(bundle.export_summary_schema.note).toContain('V1.5')
  })

  it('display_state is null by default when no displayState provided', () => {
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

  // Task 2: Enriched full_graph
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

  // Task 5a: User actions
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

  // Task 6: Gate timing fix
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

  // Task 7: schema_versions populated
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

  // Task 7: v12_4_checks passthrough
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

  // Task 8: Version and readme
  it('readme mentions V1.5 sections', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.readme).toContain('Version: 1.5')
    expect(bundle.readme).toContain('display_state')
    expect(bundle.readme).toContain('user_actions')
    expect(bundle.readme).toContain('VITE_DEBUG_BUNDLE_V1_5')
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

  // CEE payloads passthrough (Task 1)
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
})
