import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import { buildDebugBundle } from '../utils/exportBundle'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({ short: 'test-version', branch: 'main' }),
}))

vi.mock('../../../utils/debugLogBuffer', () => ({
  getBufferedLogs: () => [],
}))

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: {
      cee: {
        name: 'CEE',
        status: 200,
        success: true,
        duration_ms: 245,
        endpoint: '/cee/draft-graph',
      },
      plot: {
        name: 'PLoT',
        status: 202,
        success: true,
        duration_ms: 510,
        endpoint: '/plot/v2/run',
      },
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
      cee_response: {
        trace: {
          pipeline: {
            validated_causal_claims: [{ id: 'c1' }],
            dropped_causal_claims: [{ id: 'c2' }],
          },
        },
      },
      plot_request: { prompt: 'analyze' },
      plot_response: { result: 'ok' },
      isl_request: null,
      isl_response: null,
    },
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: {
      ui_generated: 'ui-req-123',
      from_plot: {
        ui: 'ui-req-123',
        plot: 'plot-req-456',
        isl: 'isl-req-789',
        isl_echoed: 'isl-req-789',
        all_match: false,
        chain_complete: true,
      },
      plot_chain_present: true,
      draft_trace: { cee_trace: 'cee-trace-321' },
    } as RequestIdChain,
    feature_flags_at_request: { orchestrator_v2: true, decision_graph: true } as never,
    timing: null,
    schema_versions: null,
    cee_observability: {
      llm_calls: [],
      validation: {
        attempts: 2,
        repairs_triggered: true,
        repair_types: ['coefficient_normalization', 'orphan_removal'],
        retry_triggered: true,
      },
      orchestrator: null,
      totals: null,
      graph_metrics: null,
      graph_diffs: [],
      request_id: 'cee-observability-1',
      raw_io_included: false,
      repair_summary: {
        repairs_applied: 2,
        repair_types: ['coefficient_normalization', 'orphan_removal'],
      },
    },
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    diagnostic_trace: null,
    ...overrides,
  }
}

describe('buildDebugBundle structured debug sections', () => {
  beforeEach(() => {
    // Force v1.5 mode for structure tests
    import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'
  })

  it('adds structured sections derived only from DebugData while preserving existing fields', () => {
    const bundle = buildDebugBundle(makeDebugData())

    expect(bundle.meta.version).toBe('1.5')
    expect(bundle.export_summary_schema).toEqual({
      derivation: 'export_time_from_debugdata_only',
      runtime_capture_included: true,
      note: 'V1.5: Includes runtime capture (user_actions, display_state). Enriched full_graph captures all store fields.',
    })
    expect(bundle.request_id_chain?.from_plot?.plot).toBe('plot-req-456')
    expect(bundle.cee_observability?.repair_summary).toEqual({
      repairs_applied: 2,
      repair_types: ['coefficient_normalization', 'orphan_removal'],
    })

    expect(bundle.session.request_id).toBe('req-main')
    expect(bundle.session.scenario_id).toBeNull()
    expect(bundle.session.build_info.client_build).toBe('test-build')
    expect(bundle.session.feature_flags).toBeDefined()
    expect(typeof bundle.session.feature_flags).toBe('object')
    expect(bundle.user_actions).toEqual([])

    expect(bundle.request_summary).toEqual([
      {
        request_id: 'req-main',
        ui_generated_request_id: 'ui-req-123',
        plot_request_id: 'plot-req-456',
        isl_request_id: 'isl-req-789',
        cee_trace_id: 'cee-trace-321',
        request_chain_present: true,
      },
    ])

    expect(bundle.response_summary).toEqual([
      {
        service: 'cee',
        status: 200,
        duration_ms: 245,
        success: true,
        error: null,
        payload_present: true,
      },
      {
        service: 'plot',
        status: 202,
        duration_ms: 510,
        success: true,
        error: null,
        payload_present: true,
      },
      {
        service: 'isl',
        status: null,
        duration_ms: null,
        success: null,
        error: null,
        payload_present: false,
      },
    ])

    expect(bundle.repair_and_filter_summary).toEqual([
      {
        source: 'cee_observability.repair_summary',
        available: true,
        repairs_applied: 2,
        repair_types: ['coefficient_normalization', 'orphan_removal'],
        retries: 1,
      },
    ])
    expect(bundle.render_summary).toEqual({
      available: false,
      source: null,
    })
    expect(bundle.panel_state).toEqual({
      available: false,
      source: null,
    })
    expect(bundle.cross_surface_events).toEqual([])
  })

  it('surfaces unavailable fields safely when DebugData lacks source data', () => {
    const bundle = buildDebugBundle(makeDebugData({
      services: { cee: null, plot: null, isl: null },
      payloads: {
        cee_request: null,
        cee_response: null,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
      request_id_chain: null,
      cee_observability: null,
    }))

    expect(bundle.request_summary).toEqual([
      {
        request_id: 'req-main',
        ui_generated_request_id: null,
        plot_request_id: null,
        isl_request_id: null,
        cee_trace_id: null,
        request_chain_present: false,
      },
    ])
    expect(bundle.response_summary).toEqual([
      {
        service: 'cee',
        status: null,
        duration_ms: null,
        success: null,
        error: null,
        payload_present: false,
      },
      {
        service: 'plot',
        status: null,
        duration_ms: null,
        success: null,
        error: null,
        payload_present: false,
      },
      {
        service: 'isl',
        status: null,
        duration_ms: null,
        success: null,
        error: null,
        payload_present: false,
      },
    ])
    expect(bundle.repair_and_filter_summary).toEqual([
      {
        source: 'cee_observability.repair_summary',
        available: false,
        repairs_applied: null,
        repair_types: null,
        retries: null,
      },
    ])
    expect(bundle.render_summary).toEqual({ available: false, source: null })
    expect(bundle.panel_state).toEqual({ available: false, source: null })
    expect(bundle.user_actions).toEqual([])
    expect(bundle.cross_surface_events).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Debug bundle — resolved_model and resolved_provider (Task 3)
// ---------------------------------------------------------------------------

describe('buildDebugBundle — cee_trace model fields', () => {
  beforeEach(() => {
    import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'
  })
  it('includes resolved_model and resolved_provider from _route_metadata (primary source)', () => {
    const bundle = buildDebugBundle(makeDebugData({
      ceeTrace: {
        degraded: false,
        resolved_model: 'claude-sonnet-4-6',
        resolved_provider: 'anthropic',
      },
    }))
    expect(bundle.cee_trace?.resolved_model).toBe('claude-sonnet-4-6')
    expect(bundle.cee_trace?.resolved_provider).toBe('anthropic')
  })

  it('falls back to trace.model when _route_metadata is absent (extractCeeTrace precedence)', () => {
    // When extractCeeTrace fills resolved_model from trace.model, the bundle passes it through
    const bundle = buildDebugBundle(makeDebugData({
      ceeTrace: {
        degraded: false,
        resolved_model: 'claude-haiku-4-5',  // populated by extractCeeTrace fallback
        resolved_provider: null,
      },
    }))
    expect(bundle.cee_trace?.resolved_model).toBe('claude-haiku-4-5')
    expect(bundle.cee_trace?.resolved_provider).toBeNull()
  })

  it('includes null for model fields when ceeTrace has no routing fields', () => {
    const bundle = buildDebugBundle(makeDebugData({
      ceeTrace: {
        degraded: false,
        resolved_model: null,
        resolved_provider: null,
      },
    }))
    expect(bundle.cee_trace?.resolved_model).toBeNull()
    expect(bundle.cee_trace?.resolved_provider).toBeNull()
  })

  it('sets cee_trace to null when ceeTrace is null', () => {
    const bundle = buildDebugBundle(makeDebugData({ ceeTrace: null }))
    expect(bundle.cee_trace).toBeNull()
  })
})
