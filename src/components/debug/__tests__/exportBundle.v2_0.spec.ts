/**
 * Debug Bundle v2.0 Tests
 *
 * Tests for _diagnostic_trace capture, v2.0 bundle sections,
 * feature flag gating, and backward compatibility.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'test-build',
  getVersionInfo: () => ({ short: 'test-version', branch: 'main' }),
}))

vi.mock('../../../utils/debugLogBuffer', () => ({
  getBufferedLogs: () => [],
}))

vi.mock('../../../lib/debug-state', () => ({
  getUserActions: () => [],
}))

// Store original env for restoration
const originalEnv = { ...import.meta.env }

import { buildDebugBundle, isDebugBundleV2Enabled } from '../utils/exportBundle'

// =============================================================================
// Test helpers
// =============================================================================

function makeDiagnosticTrace(): Record<string, unknown> {
  return {
    llm_calls: [
      {
        role: 'orchestrator',
        step: 'draft_graph',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        tokens: {
          input: 12500,
          output: 3200,
          total: 15700,
          cache_read: 8000,
          cache_create: 1500,
        },
        latency_ms: 4200,
        success: true,
        started_at: '2026-03-23T12:00:00Z',
        stop_reason: 'end_turn',
        thinking_enabled: true,
      },
      {
        role: 'repair_graph',
        step: 'repair_graph',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        tokens: { input: 5000, output: 1500, total: 6500 },
        latency_ms: 1800,
        success: false,
        error: { status: 400, type: 'invalid_request_error', message: 'Structured outputs validation failed' },
        started_at: '2026-03-23T12:00:05Z',
        stop_reason: 'error',
        thinking_enabled: false,
      },
    ],
    prompt_identity: [
      {
        task: 'orchestrator',
        version: '2.1.4',
        hash: 'abc12345def67890',
        source: 'prompt_store',
        staging: true,
      },
    ],
    zone2_assembly: {
      assembled_at: '2026-03-23T12:00:00Z',
      section_count: 5,
    },
    tool_policy: {
      tools_available: ['run_analysis', 'draft_graph'],
      max_retries: 3,
    },
    provider_resolution: [
      {
        task: 'orchestrator',
        resolved_model: 'claude-sonnet-4-20250514',
        resolved_provider: 'anthropic',
        switch_reason: null,
      },
      {
        task: 'repair',
        resolved_model: 'claude-haiku-3-20240307',
        resolved_provider: 'anthropic',
        switch_reason: 'cost_optimization',
      },
    ],
    structured_output_config: {
      enabled: true,
      api_shape: 'json_schema',
      beta_header: 'prompt-caching-2024-07-31',
    },
    streaming_metrics: {
      time_to_first_token_ms: 320,
      total_stream_duration_ms: 4200,
    },
    fallback_trace: [
      {
        stage: 'structured_outputs',
        reason: 'HTTP 400 from provider — invalid_request_error',
        action: 'retry_without_structured_outputs',
        succeeded: false,
      },
    ],
  }
}

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
      e_values_present: false,
      evpi_present: false,
      confidence_differentiated: false,
      confidence_unique_values: [],
      confidence_source_bootstrap: false,
      intercept_populated: false,
      epsilon_std_present: false,
      response_hash_present: false,
      mca_computed: false,
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
      cee_response: null,
      plot_request: null,
      plot_response: null,
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
      from_plot: null,
      plot_chain_present: false,
      draft_trace: { cee_trace: 'cee-trace-321' },
    } as RequestIdChain,
    feature_flags_at_request: null,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    diagnostic_trace: null,
    ...overrides,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('Debug Bundle v2.0', () => {
  beforeEach(() => {
    // Default: v2 enabled (dev/staging behavior)
    import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'true'
    import.meta.env.VITE_APP_ENV = 'development'
  })

  afterEach(() => {
    // Restore env
    Object.assign(import.meta.env, originalEnv)
  })

  describe('feature flag', () => {
    it('v2 enabled by default in development', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_DEBUG_BUNDLE_V2
      import.meta.env.VITE_APP_ENV = 'development'
      expect(isDebugBundleV2Enabled()).toBe(true)
    })

    it('v2 enabled by default in staging', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_DEBUG_BUNDLE_V2
      import.meta.env.VITE_APP_ENV = 'staging'
      expect(isDebugBundleV2Enabled()).toBe(true)
    })

    it('v2 disabled by default in production', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_DEBUG_BUNDLE_V2
      import.meta.env.VITE_APP_ENV = 'production'
      expect(isDebugBundleV2Enabled()).toBe(false)
    })

    it('explicit true overrides production default', () => {
      import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'true'
      import.meta.env.VITE_APP_ENV = 'production'
      expect(isDebugBundleV2Enabled()).toBe(true)
    })

    it('explicit false overrides development default', () => {
      import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'
      import.meta.env.VITE_APP_ENV = 'development'
      expect(isDebugBundleV2Enabled()).toBe(false)
    })
  })

  describe('v2.0 bundle with _diagnostic_trace present', () => {
    it('produces version 2.0 when flag is ON', () => {
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: makeDiagnosticTrace(),
      }))
      expect(bundle.meta.version).toBe('2.0')
    })

    it('includes all v2.0 sections', () => {
      const trace = makeDiagnosticTrace()
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: trace,
      }))

      expect(bundle.llm_calls).toEqual(trace.llm_calls)
      expect(bundle.prompt_identity).toEqual(trace.prompt_identity)
      expect(bundle.zone2_assembly).toEqual(trace.zone2_assembly)
      expect(bundle.tool_policy).toEqual(trace.tool_policy)
      expect(bundle.provider_resolution).toEqual(trace.provider_resolution)
      expect(bundle.structured_output_config).toEqual(trace.structured_output_config)
      expect(bundle.streaming_metrics).toEqual(trace.streaming_metrics)
      expect(bundle.fallback_trace).toEqual(trace.fallback_trace)
    })

    it('preserves all v1.5 sections', () => {
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      // V1.5 sections still present
      expect(bundle.payloads).toBeDefined()
      expect(bundle.services).toBeDefined()
      expect(bundle.pipeline).toBeDefined()
      expect(bundle.gates).toBeDefined()
      expect(bundle.validation).toBeDefined()
      expect(bundle.diagnostic).toBeDefined()
      expect(bundle.builds).toBeDefined()
      expect(bundle.console_logs).toBeDefined()
    })
  })

  describe('v2.0 bundle with _diagnostic_trace absent (CEE not deployed)', () => {
    it('defaults all v2.0 sections to null', () => {
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: null,
      }))

      expect(bundle.meta.version).toBe('2.0')
      expect(bundle.llm_calls).toBeNull()
      expect(bundle.prompt_identity).toBeNull()
      expect(bundle.zone2_assembly).toBeNull()
      expect(bundle.tool_policy).toBeNull()
      expect(bundle.provider_resolution).toBeNull()
      expect(bundle.structured_output_config).toBeNull()
      expect(bundle.streaming_metrics).toBeNull()
      expect(bundle.fallback_trace).toBeNull()
    })
  })

  describe('feature flag OFF produces exact v1.5 bundle', () => {
    it('no v2.0 sections when flag is OFF', () => {
      import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'

      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      expect(bundle.meta.version).toBe('1.5')
      expect(bundle.llm_calls).toBeUndefined()
      expect(bundle.prompt_identity).toBeUndefined()
      expect(bundle.zone2_assembly).toBeUndefined()
      expect(bundle.tool_policy).toBeUndefined()
      expect(bundle.provider_resolution).toBeUndefined()
      expect(bundle.structured_output_config).toBeUndefined()
      expect(bundle.streaming_metrics).toBeUndefined()
      expect(bundle.fallback_trace).toBeUndefined()
    })
  })

  describe('Task 3: wire existing null sections from _diagnostic_trace', () => {
    it('populates cee_trace.resolved_model from provider_resolution', () => {
      const bundle = buildDebugBundle(makeDebugData({
        ceeTrace: null,
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      expect(bundle.cee_trace).not.toBeNull()
      expect(bundle.cee_trace!.resolved_model).toBe('claude-sonnet-4-20250514')
      expect(bundle.cee_trace!.resolved_provider).toBe('anthropic')
    })

    it('does not override existing cee_trace values', () => {
      const bundle = buildDebugBundle(makeDebugData({
        ceeTrace: {
          degraded: false,
          resolved_model: 'existing-model',
          resolved_provider: 'existing-provider',
        },
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      expect(bundle.cee_trace!.resolved_model).toBe('existing-model')
      expect(bundle.cee_trace!.resolved_provider).toBe('existing-provider')
    })

    it('populates pipeline.llm_metadata from trace llm_calls[0]', () => {
      const trace = makeDiagnosticTrace()
      const bundle = buildDebugBundle(makeDebugData({
        pipeline: {
          status: 'success',
          total_duration_ms: 1200,
          stages: [],
          llm_metadata: undefined,
          llm_raw: null,
          node_extraction: null,
          connectivity: { decision_count: 1, option_count: 2, goal_count: 1, factor_count: 3, edge_count: 2 },
        },
        diagnostic_trace: trace,
      }))

      expect(bundle.pipeline.llm_metadata).not.toBeNull()
      expect(bundle.pipeline.llm_metadata).toEqual(trace.llm_calls![0])
    })

    it('does not override existing pipeline.llm_metadata', () => {
      const existingMeta = { model: 'keep-this', temperature: 0.7 }
      const bundle = buildDebugBundle(makeDebugData({
        pipeline: {
          status: 'success',
          total_duration_ms: 1200,
          stages: [],
          llm_metadata: existingMeta,
          llm_raw: null,
          node_extraction: null,
          connectivity: { decision_count: 1, option_count: 2, goal_count: 1, factor_count: 3, edge_count: 2 },
        },
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      expect(bundle.pipeline.llm_metadata).toEqual(existingMeta)
    })
  })

  describe('v2.0 bundle schema snapshot', () => {
    it('bundle shape matches v2.0 schema', () => {
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      // Top-level keys that must exist in v2.0
      const v2Keys = [
        'llm_calls',
        'prompt_identity',
        'zone2_assembly',
        'tool_policy',
        'provider_resolution',
        'structured_output_config',
        'streaming_metrics',
        'fallback_trace',
      ]

      for (const key of v2Keys) {
        expect(bundle).toHaveProperty(key)
      }

      // V1.5 keys must still exist
      const v15Keys = [
        'meta',
        'diagnostic',
        'builds',
        'payloads',
        'services',
        'pipeline',
        'gates',
        'validation',
        'console_logs',
        'diagnostic_checks',
        'readme',
      ]

      for (const key of v15Keys) {
        expect(bundle).toHaveProperty(key)
      }
    })

    it('bundle v2.0 keys are deeply stable (snapshot)', () => {
      const bundle = buildDebugBundle(makeDebugData({
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      // Snapshot: exact shape of v2.0 sections
      expect(bundle.llm_calls).toHaveLength(2)
      expect(bundle.prompt_identity).toHaveLength(1)
      expect(bundle.provider_resolution).toHaveLength(2)
      expect(bundle.fallback_trace).toHaveLength(1)
      expect(bundle.zone2_assembly).toEqual({ assembled_at: '2026-03-23T12:00:00Z', section_count: 5 })
      expect(bundle.tool_policy).toEqual({ tools_available: ['run_analysis', 'draft_graph'], max_retries: 3 })
      expect(bundle.structured_output_config).toEqual({ enabled: true, api_shape: 'json_schema', beta_header: 'prompt-caching-2024-07-31' })
    })
  })

  describe('_unavailable_reason when trace absent', () => {
    it('includes reason when diagnostic_trace is null', () => {
      const bundle = buildDebugBundle(makeDebugData({ diagnostic_trace: null }))

      expect(bundle._unavailable_reason).toBe('CEE diagnostic trace not present in response')
      expect(bundle.llm_calls).toBeNull()
    })

    it('does not include reason when diagnostic_trace is present', () => {
      const bundle = buildDebugBundle(makeDebugData({ diagnostic_trace: makeDiagnosticTrace() }))

      expect(bundle._unavailable_reason).toBeUndefined()
      expect(bundle.llm_calls).not.toBeNull()
    })
  })

  describe('flag OFF produces no v2 keys at all (strict)', () => {
    it('v1.5 bundle has zero v2-only keys', () => {
      import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'

      const bundle = buildDebugBundle(makeDebugData({ diagnostic_trace: makeDiagnosticTrace() }))
      const bundleKeys = Object.keys(bundle)

      const v2OnlyKeys = ['llm_calls', 'prompt_identity', 'zone2_assembly', 'tool_policy',
        'provider_resolution', 'structured_output_config', 'streaming_metrics',
        'fallback_trace', '_unavailable_reason']

      for (const key of v2OnlyKeys) {
        expect(bundleKeys).not.toContain(key)
      }
    })
  })

  // ===========================================================================
  // Envelope-level field extraction (streaming path debug bundle capture)
  // ===========================================================================

  describe('envelope-level fields from cee_response', () => {
    it('extracts _pipeline_outcome from envelope', () => {
      const pipelineOutcome = { path: 'unified', mutations: 3, status: 'complete' }
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { _pipeline_outcome: pipelineOutcome, assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.pipeline_outcome).toEqual(pipelineOutcome)
    })

    it('pipeline_outcome is null when cee_response has no _pipeline_outcome', () => {
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.pipeline_outcome).toBeNull()
    })

    it('pipeline_outcome is null when cee_response is null', () => {
      const bundle = buildDebugBundle(makeDebugData())

      expect(bundle.pipeline_outcome).toBeNull()
    })

    it('extracts goal_constraints from envelope root', () => {
      const constraints = [
        { constraint_id: 'c1', type: 'min', field: 'cost', value: 100 },
        { constraint_id: 'c2', type: 'max', field: 'time', value: 30 },
      ]
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { goal_constraints: constraints, assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.goal_constraints).toEqual({ count: 2, items: constraints })
    })

    it('extracts goal_constraints from graph_patch block when not at envelope root', () => {
      const constraints = [{ constraint_id: 'c1', type: 'min', field: 'cost', value: 100 }]
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: {
            assistant_text: 'ok',
            blocks: [
              { type: 'graph_patch', data: { goal_constraints: constraints, nodes: [] } },
            ],
          },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.goal_constraints).toEqual({ count: 1, items: constraints })
    })

    it('goal_constraints is null when absent everywhere', () => {
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.goal_constraints).toBeNull()
    })

    it('extracts analysis_ready from envelope root', () => {
      const analysisReady = { status: 'ready', factor_count: 5, edge_count: 3 }
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { analysis_ready: analysisReady, assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.analysis_ready).toEqual(analysisReady)
    })

    it('extracts analysis_ready from graph_patch block data', () => {
      const analysisReady = { status: 'ready', factor_count: 5, edge_count: 3 }
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: {
            assistant_text: 'ok',
            blocks: [
              { type: 'graph_patch', data: { analysis_ready: analysisReady, nodes: [] } },
            ],
          },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.analysis_ready).toEqual(analysisReady)
    })

    it('analysis_ready is null when cee_response is null', () => {
      const bundle = buildDebugBundle(makeDebugData())

      expect(bundle.analysis_ready).toBeNull()
    })

    it('llm_calls populated from _diagnostic_trace when cee_response has trace', () => {
      const trace = makeDiagnosticTrace()
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { _diagnostic_trace: trace, assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
        // Also set diagnostic_trace (primary path from canvas store)
        diagnostic_trace: trace,
      }))

      expect(bundle.llm_calls).toEqual(trace.llm_calls)
      expect(bundle.prompt_identity).toEqual(trace.prompt_identity)
    })

    it('cee_response is non-null when streaming envelope is captured', () => {
      const envelope = {
        assistant_text: 'Draft complete',
        blocks: [{ type: 'graph_patch', data: { nodes: [] } }],
        _pipeline_outcome: { path: 'unified' },
        goal_constraints: [{ constraint_id: 'c1' }],
        _diagnostic_trace: makeDiagnosticTrace(),
      }
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: { scenario_id: 's1' },
          cee_response: envelope,
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
        diagnostic_trace: makeDiagnosticTrace(),
      }))

      // cee_response is the full envelope
      expect(bundle.payloads.cee_response).not.toBeNull()
      // Envelope-level fields are extracted
      expect(bundle.pipeline_outcome).toEqual({ path: 'unified' })
      expect(bundle.goal_constraints).toEqual({ count: 1, items: [{ constraint_id: 'c1' }] })
      // V2.0 sections populated from _diagnostic_trace
      expect(bundle.llm_calls).not.toBeNull()
      expect((bundle.llm_calls as unknown[]).length).toBeGreaterThan(0)
    })

    it('regression: non-streaming path still works (envelope from payload trace)', () => {
      // When non-streaming, cee_response comes from payload trace store
      // This test ensures the extraction works with the same shape
      const envelope = {
        assistant_text: 'ok',
        _pipeline_outcome: { path: 'legacy' },
        analysis_ready: { status: 'needs_edges' },
        goal_constraints: [],
      }
      const bundle = buildDebugBundle(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: envelope,
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.pipeline_outcome).toEqual({ path: 'legacy' })
      expect(bundle.analysis_ready).toEqual({ status: 'needs_edges' })
      // Empty array → { count: 0, items: [] } (present but empty)
      expect(bundle.goal_constraints).toEqual({ count: 0, items: [] })
    })
  })

  describe('buildDebugBundleAsync — canvas store fallback for goal_constraints', () => {
    it('reads goal_constraints from canvas store when cee_response has none (direct draft/SSE flow)', async () => {
      const storeConstraints = [
        { id: 'c1', label: 'churn under 4%', operator: '≤', value: 0.04 },
        { id: 'c2', label: 'within 12 months', operator: '≤', value: 12 },
      ]

      // Mock canvas store to return goalConstraints
      vi.doMock('../../../canvas/store', () => ({
        useCanvasStore: {
          getState: () => ({
            goalConstraints: storeConstraints,
            showResultsPanel: false,
            showInspectorPanel: false,
            showDraftChat: false,
            showTemplatesPanel: false,
            showIssuesPanel: false,
            runMeta: null,
          }),
        },
      }))

      // Import after mock so it picks up the mocked store
      const { buildDebugBundleAsync } = await import('../utils/exportBundle')

      const bundle = await buildDebugBundleAsync(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: null, // No captured CEE response (SSE/streaming path)
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      expect(bundle.goal_constraints).toEqual({ count: 2, items: storeConstraints })

      vi.doUnmock('../../../canvas/store')
    })

    it('does not overwrite goal_constraints from cee_response with store fallback', async () => {
      const envelopeConstraints = [{ constraint_id: 'c1', type: 'max', field: 'cost', value: 100 }]

      vi.doMock('../../../canvas/store', () => ({
        useCanvasStore: {
          getState: () => ({
            goalConstraints: [{ id: 'stale', label: 'stale' }],
            showResultsPanel: false,
            showInspectorPanel: false,
            showDraftChat: false,
            showTemplatesPanel: false,
            showIssuesPanel: false,
            runMeta: null,
          }),
        },
      }))

      const { buildDebugBundleAsync } = await import('../utils/exportBundle')

      const bundle = await buildDebugBundleAsync(makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: { goal_constraints: envelopeConstraints, assistant_text: 'ok' },
          plot_request: null,
          plot_response: null,
          isl_request: null,
          isl_response: null,
        },
      }))

      // Should use envelope data, not canvas store
      expect(bundle.goal_constraints).toEqual({ count: 1, items: envelopeConstraints })

      vi.doUnmock('../../../canvas/store')
    })
  })
})
