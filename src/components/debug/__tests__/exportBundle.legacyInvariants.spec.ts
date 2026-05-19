/**
 * Regression coverage — legacy bundle fields and PR #147 invariants
 * must survive the additive diagnostic plumbing in this PR.
 *
 * The new sections (scenario_id_reconciliation, capture_pipeline_status,
 * v5_canonical_turn_diagnostics, scientific_validation,
 * debug_redaction_manifest) are emitted ALONGSIDE existing fields, not
 * in place of them.
 *
 * PR #147 parser-level invariants (whitelist, sidecar enumeration,
 * raw_response_present) are covered in v5-cee-capture.phase3-tolerance.spec.ts.
 * This spec asserts the BUNDLE-LEVEL surfaces those tests rely on are
 * unchanged.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
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

const canvasState: {
  currentScenarioId: string | null
  v5AnalysisFact: unknown
  results: unknown
  goalConstraints: unknown[]
  ceeAnalysisReady: unknown
} = {
  currentScenarioId: null,
  v5AnalysisFact: null,
  results: null,
  goalConstraints: [],
  ceeAnalysisReady: null,
}

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => canvasState },
}))

// Mutable analysis-state-source result so individual tests can simulate
// the post-run state (fact present, results present, source =
// cee_v5_run_analysis) without rewiring the mock factory.
const analysisStateSourceResult: {
  source: string
  showOrphanBanner: boolean
  hasResultsReport: boolean
  factPresentForScenario: boolean
} = {
  source: 'none',
  showOrphanBanner: false,
  hasResultsReport: false,
  factPresentForScenario: false,
}

vi.mock('../../../canvas/hooks/useAnalysisStateSource', () => ({
  readAnalysisStateSourceFromStore: () => ({ ...analysisStateSourceResult }),
}))

vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: { getState: () => ({ payloads: [] }) },
}))

import { buildDebugBundle, buildDebugBundleAsync } from '../utils/exportBundle'

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: 'test-build', cee: null, plot: null, isl: null },
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
      connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
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
      ui_generated: 'ui-req',
      from_plot: { ui: 'ui-req', plot: null, isl: null, isl_echoed: null, all_match: false, chain_complete: false },
      plot_chain_present: false,
      draft_trace: { cee_trace: null },
    } as RequestIdChain,
    feature_flags_at_request: {} as never,
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

describe('legacy bundle field invariants — buildDebugBundle (sync)', () => {
  beforeEach(() => {
    canvasState.currentScenarioId = null
    canvasState.v5AnalysisFact = null
    canvasState.results = null
    canvasState.ceeAnalysisReady = null
  })

  it('emits the legacy pipeline.v5_pipeline_status field', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.pipeline).toBeDefined()
    expect(bundle.pipeline.v5_pipeline_status).toBeDefined()
    expect(bundle.pipeline.v5_pipeline_status_source).toBeDefined()
  })

  it('emits the legacy effective_cee_response_source field', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.effective_cee_response_source).toBeDefined()
  })

  it('session shape contains scenario_id_source (new) plus all legacy keys', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.session.scenario_id).toBeNull()
    expect(bundle.session.scenario_id_source).toBe('none')
    expect(bundle.session.timestamp).toBeDefined()
    expect(bundle.session.feature_flags).not.toBeUndefined()
    expect(bundle.session.build_info).toBeDefined()
  })
})

describe('additive diagnostics — buildDebugBundleAsync', () => {
  beforeEach(() => {
    canvasState.currentScenarioId = 'sid-test'
    canvasState.v5AnalysisFact = null
    canvasState.results = null
    canvasState.ceeAnalysisReady = null
  })

  it('legacy v5_canonical_analysis block is preserved (composition, not replacement)', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    // Either present (canonical flag on) or absent (flag off + bailed).
    // When present, must carry the legacy enum fields.
    if (bundle.v5_canonical_analysis) {
      expect(bundle.v5_canonical_analysis.canonical_flag_on).toBeDefined()
      expect(bundle.v5_canonical_analysis.analysis_state_source).toBeDefined()
      expect(bundle.v5_canonical_analysis.debug_capture_status).toBeDefined()
    }
  })

  it('new diagnostic fields are emitted alongside legacy fields (not in place of)', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    // Legacy still there
    expect(bundle.pipeline.v5_pipeline_status).toBeDefined()
    // New additive fields are emitted (or undefined honestly if assembly bailed)
    expect('scenario_id_reconciliation' in bundle).toBe(true)
    // Manifest is always emitted, even on partial assembly
    expect(bundle.debug_redaction_manifest).toBeDefined()
    expect(bundle.debug_redaction_manifest?.preserved_analytical_paths).toBeInstanceOf(Array)
  })

  it('capture_pipeline_status is ALWAYS emitted on async export, even when legacy classifier produced nothing useful', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    expect(bundle.capture_pipeline_status).toBeDefined()
    expect(typeof bundle.capture_pipeline_status).toBe('string')
  })

  it('v5_canonical_turn_diagnostics is ALWAYS emitted on async export, with the verbatim VITE_V5_CANONICAL_ANALYSIS env-key', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    expect(bundle.v5_canonical_turn_diagnostics).toBeDefined()
    expect(bundle.v5_canonical_turn_diagnostics?.canonical_flag_env_key).toBe(
      'VITE_V5_CANONICAL_ANALYSIS',
    )
    expect(bundle.v5_canonical_turn_diagnostics?.coherence).toBeDefined()
    expect(bundle.v5_canonical_turn_diagnostics?.scenario_id_reconciliation).toBeDefined()
  })

  // ------------------------------------------------------------------
  // Legacy-classifier-failure regression: when the synthesised fallback
  // engages, fact presence must be DERIVED from the analysis-state
  // source classifier (not defaulted to 'unknown_not_checked'). Without
  // this, the headline contradiction issue can never fire.
  // ------------------------------------------------------------------

  it('synthesised fallback derives analysis_fact.present from sourceResult.factPresentForScenario, NOT unknown_not_checked', async () => {
    // Simulate the post-run state: source classifier reports fact + results
    // present even though the legacy `v5_canonical_analysis` block itself
    // may emit weak signals. The fallback must lift fact-presence into
    // the synthesised diagnostic so the contradiction issue surfaces.
    canvasState.currentScenarioId = 'sid-x'
    canvasState.v5AnalysisFact = {
      scenarioId: 'sid-x',
      analysisHash: 'v5:abc',
      hasRunAnalysisFact: true,
      freshness: 'fresh',
    }
    canvasState.results = { report: { summary: 'x' }, hash: 'v5:abc', rawV2Response: null }
    analysisStateSourceResult.source = 'cee_v5_run_analysis'
    analysisStateSourceResult.hasResultsReport = true
    analysisStateSourceResult.factPresentForScenario = true

    try {
      const bundle = await buildDebugBundleAsync(makeDebugData())
      const td = bundle.v5_canonical_turn_diagnostics
      expect(td).toBeDefined()
      // The fallback path must NOT lose fact-presence to 'unknown_not_checked'.
      expect(td!.analysis_fact.present).toBe(true)
      // The headline contradiction issues must fire (additive, independent
      // of which final status the classifier picked).
      expect(td!.coherence.issues).toContain(
        'analysis_fact_present_but_cee_capture_missing',
      )
      expect(td!.coherence.issues).toContain(
        'results_rendered_from_store_without_capture',
      )
    } finally {
      // Reset the shared mock state so subsequent tests start clean.
      analysisStateSourceResult.source = 'none'
      analysisStateSourceResult.hasResultsReport = false
      analysisStateSourceResult.factPresentForScenario = false
    }
  })

  it('scenario_id reconciliation lifts session.scenario_id from store', async () => {
    canvasState.currentScenarioId = 'sid-from-store'
    const bundle = await buildDebugBundleAsync(makeDebugData())
    expect(bundle.session.scenario_id).toBe('sid-from-store')
    expect(bundle.session.scenario_id_source).toBe('store')
  })

  it('scientific_validation always emits — even with no PLoT payload, reports source = unavailable', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    expect(bundle.scientific_validation).toBeDefined()
    expect(bundle.scientific_validation?.source).toBe('unavailable')
    expect(bundle.scientific_validation?.overall_status).toBe('unavailable')
  })

  it('debug_redaction_manifest enumerates preserved analytical paths', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    const manifest = bundle.debug_redaction_manifest
    expect(manifest).toBeDefined()
    expect(manifest!.preserved_analytical_paths.length).toBeGreaterThan(0)
    expect(manifest!.preserved_analytical_paths).toContain(
      'payloads.plot_request.graph.nodes[*].data.observed_state.*',
    )
  })

  it('omitted sections are recorded in the manifest when assembly bailed', async () => {
    // With our mocks, sourceResult.source === 'none' so v5_canonical_analysis
    // is still emitted (the legacy classifier handles 'no_analysis_signal' case);
    // capture_pipeline_status depends on the legacy block. Both should be present.
    const bundle = await buildDebugBundleAsync(makeDebugData())
    const omitted = bundle.debug_redaction_manifest?.omitted ?? []
    // Every omitted entry has a reason
    for (const entry of omitted) {
      expect(typeof entry.path).toBe('string')
      expect(typeof entry.reason).toBe('string')
    }
  })

  it('top-level JSON snapshot — every brief-required field name is present in the serialised bundle (grep target)', async () => {
    const bundle = await buildDebugBundleAsync(makeDebugData())
    const json = JSON.stringify(bundle)
    // Reviewers grep these literal strings to locate the diagnostic
    // surfaces. Asserting on the serialised JSON guards against future
    // changes that rename or hide them.
    const requiredLiterals = [
      '"scenario_id_reconciliation"',
      '"capture_pipeline_status"',
      '"v5_canonical_turn_diagnostics"',
      '"scientific_validation"',
      '"debug_redaction_manifest"',
      // Within v5_canonical_turn_diagnostics
      '"canonical_flag_env_key"',
      '"feature_flag_diagnostic"',
      '"VITE_V5_CANONICAL_ANALYSIS"',
      '"effective_cee_response_source"',
      '"latest_v5_turn"',
      '"coherence"',
      // Within scientific_validation
      '"overall_status"',
      '"user_std_propagation"',
      '"confidence_validation"',
      '"evidence_gap_validation"',
      '"evpi_validation"',
      '"flip_threshold_validation"',
      '"auto_noise_validation"',
      '"response_shape_validation"',
      // Within debug_redaction_manifest
      '"preserved_analytical_paths"',
    ]
    for (const literal of requiredLiterals) {
      expect(json).toContain(literal)
    }
  })
})
