/**
 * Debug-exporter false negatives on the V5-canonical path — RED→GREEN
 * coverage for the repointed checks (reference bundle 45c9b625, 2026-07-07).
 *
 * Observed failure shapes in the real bundle:
 *   - diagnostic_checks read LEGACY paths: payloads.plot_response (always
 *     null on the canonical path) → e_values/evpi/isl checks all false
 *     while blocks[0].enrichment.edge_e_values carried 6 real entries;
 *   - `_unavailable_reason: 'CEE diagnostic trace not present in response'`
 *     while the trace EXISTED at cee_response.__additive__._diagnostic_trace;
 *   - schema_versions all-null/'unknown' although the UI's own vendored
 *     @talchain/schemas version is a build-time fact;
 *   - gates showed run:"fail" beside pipeline.status:"success" (the legacy
 *     PLoT-direct run gate has no writer on the canonical path).
 *
 * Fixtures below are trimmed copies of the real bundle shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import {
  extractDiagnosticChecks,
  readCeeDiagnosticTrace,
} from '../hooks/useDebugData'
import { TALCHAIN_SCHEMAS_VENDORED_VERSION } from '../../../lib/talchainSchemasVersion'

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

const canvasState = {
  nodes: [] as Array<{ id: string; data: Record<string, unknown> }>,
  edges: [] as Array<{ id: string }>,
  rawV2Response: null as Record<string, unknown> | null,
  results: null as unknown,
  ceeAnalysisReady: null as unknown,
  currentScenarioId: null as string | null,
  v5AnalysisFact: null as unknown,
  goalConstraints: [] as unknown[],
  graphEditedSinceLastRun: false,
}

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => canvasState },
}))

vi.mock('../../../canvas/hooks/useAnalysisStateSource', () => ({
  readAnalysisStateSourceFromStore: () => ({
    source: 'none',
    showOrphanBanner: false,
    hasResultsReport: false,
    factPresentForScenario: false,
  }),
}))

vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: { getState: () => ({ payloads: [] }) },
}))

import { buildDebugBundle } from '../utils/exportBundle'

// ─── Trimmed real-bundle fixtures (shape of 45c9b625) ───────────────────────

/** blocks[0].enrichment — trimmed: 6 edge e-values at enrichment TOP level,
 *  robustness WITHOUT edge_e_values, factor_sensitivity with VOI fields. */
function makeCanonicalEnrichment(): Record<string, unknown> {
  return {
    edge_e_values: [
      { edge_id: 'fac_ad_spend::risk_budget_overrun', e_value: 1, flip_direction: 'decrease' },
      { edge_id: 'e2', e_value: 1.2 },
      { edge_id: 'e3', e_value: 1.4 },
      { edge_id: 'e4', e_value: 2.1 },
      { edge_id: 'e5', e_value: 3.3 },
      { edge_id: 'e6', e_value: 1.05 },
    ],
    factor_sensitivity: [
      {
        factor_id: 'fac_marketing_expertise',
        factor_label: 'Marketing Strategy Quality',
        influence_score: 1,
        sensitivity_score: 0,
        value_of_information: 0,
        confidence: 0.3,
        confidence_source: 'plot_unified_from_isl_bootstrap',
      },
      {
        factor_id: 'fac_market_receptivity',
        factor_label: 'Market Receptivity to Feature',
        influence_score: 0.62,
        sensitivity_score: 0.1925,
        value_of_information: 0,
        evpi_percentage_points: 0,
        confidence: 0.45,
        confidence_source: 'plot_unified_from_isl_bootstrap',
      },
    ],
    option_comparison: [
      { option_id: 'opt_hire', option_label: 'Hire', win_probability: 0.85 },
    ],
    option_comparison_status: 'computed',
    flip_thresholds: [{ factor_id: 'fac_market_receptivity' }],
    conditional_probabilities: [],
    robustness: {
      is_robust: true,
      level: 'robust',
      fragile_edges: [],
      robust_edges: ['e2'],
      recommendation_stability: 0.9,
    },
  }
}

/** Trimmed V5-canonical CEE turn response: analysis_result block + the
 *  parser's __additive__ sidecar carrying _diagnostic_trace. */
function makeCanonicalCeeResponse(): Record<string, unknown> {
  return {
    response_version: 'v1',
    assistant_text: 'Analysis complete.',
    blocks: [
      {
        type: 'analysis_result',
        summary: 'Hire performs best',
        leading_option_id: 'opt_hire',
        enrichment: makeCanonicalEnrichment(),
      },
    ],
    __additive__: {
      __original_top_level_keys__: ['_diagnostic_trace', 'blocks'],
      _diagnostic_trace: {
        llm_calls: [{ operation: 'run_analysis', model: 'test-model' }],
        provider_resolution: [{ pipeline_path: 'v5_canonical' }],
      },
      action_type_aliases_applied: [],
    },
  }
}

function liftFor(cee: Record<string, unknown>) {
  const block = (cee.blocks as Array<Record<string, unknown>>)[0]
  return {
    plotBody: block.enrichment as Record<string, unknown>,
    plotSource: 'cee_embedded' as const,
  }
}

describe('extractDiagnosticChecks — V5-canonical enrichment lift', () => {
  it('GREEN: e-values/bootstrap/VOI checks read the lifted enrichment; trace read from __additive__', () => {
    const cee = makeCanonicalCeeResponse()
    const dc = extractDiagnosticChecks(
      null, // payloads.plot_response — always null on the canonical path
      cee,
      null, // no ISL body
      'cee_enrichment_extraction',
      [],
      [],
      null, // no store-side diagnostic trace: probe must find __additive__
      liftFor(cee),
    )

    // (2) cee_trace_present reads __additive__._diagnostic_trace
    expect(dc.cee_trace_present).toBe(true)
    expect(dc.llm_raw_available).toBe(true)
    expect(dc.llm_raw_path_found).toBe('_diagnostic_trace.llm_calls')

    // (1) e-values checks read the lift — 6 real entries at enrichment top level
    expect(dc.plot_edge_e_values_exposed).toBe(true)
    expect(dc.ui_edge_e_values_available).toBe(true)
    expect(dc.e_values_present).toBe(true)
    // No ISL-layer evidence → the ISL-layer claim stays honestly false
    expect(dc.isl_edge_e_values_present).toBe(false)

    // EVPI: historical field keeps ISL factor_evpi semantics (no ISL body →
    // false); the factor-level VOI/EVPI surface is reported additively.
    expect(dc.evpi_present).toBe(false)
    expect(dc.plot_factor_voi_fields_present).toBe(true)

    // Factor-level confidence + bootstrap provenance now visible
    expect(dc.confidence_source_bootstrap).toBe(true)
    expect(dc.factor_confidence_differentiated).toBe(true)
    expect(dc.factor_confidence_unique_values).toEqual([0.3, 0.45])

    // Provenance labels
    expect(dc.plot_evidence_source).toBe('cee_embedded')
    expect(dc.isl_data_source).toBe('cee_enrichment_extraction')
  })

  it('RED-shape honesty: without the lift the legacy reads stay false (pre-fix behaviour preserved for legacy calls)', () => {
    const cee = makeCanonicalCeeResponse()
    const dc = extractDiagnosticChecks(null, cee, null, 'none', [], [], null)
    expect(dc.plot_edge_e_values_exposed).toBe(false)
    expect(dc.ui_edge_e_values_available).toBe(false)
    expect(dc.e_values_present).toBe(false)
    expect(dc.plot_evidence_source).toBe('unavailable')
    // The __additive__ trace probe is independent of the lift and works
    // even on legacy call sites.
    expect(dc.cee_trace_present).toBe(true)
  })

  it('top-level plot_response wins over the lift (no cross-source substitution)', () => {
    const cee = makeCanonicalCeeResponse()
    const rawPlot = {
      robustness: { edge_e_values: [{ edge_id: 'raw', e_value: 9 }] },
      factor_sensitivity: [],
    }
    const dc = extractDiagnosticChecks(
      rawPlot,
      cee,
      null,
      'downstream_calls',
      [],
      [],
      null,
      { plotBody: rawPlot, plotSource: 'top_level' },
    )
    expect(dc.plot_evidence_source).toBe('top_level')
    // Raw path keeps the extractPlotEnrichment mirror: robustness-only probe
    expect(dc.ui_edge_e_values_available).toBe(true)
  })
})

describe('readCeeDiagnosticTrace — __additive__ sidecar fallback', () => {
  it('finds the trace under __additive__._diagnostic_trace', () => {
    const cee = makeCanonicalCeeResponse()
    const trace = readCeeDiagnosticTrace(null, cee)
    expect(trace).not.toBeNull()
    expect(Array.isArray(trace?.llm_calls)).toBe(true)
  })

  it('prefers the store trace, then top-level _diagnostic_trace', () => {
    const storeTrace = { source: 'store' }
    expect(readCeeDiagnosticTrace(storeTrace, makeCanonicalCeeResponse())).toBe(storeTrace)

    const topLevel = {
      _diagnostic_trace: { source: 'top_level' },
      __additive__: { _diagnostic_trace: { source: 'sidecar' } },
    }
    expect(readCeeDiagnosticTrace(null, topLevel)).toEqual({ source: 'top_level' })
  })

  it('returns null honestly when no trace exists anywhere', () => {
    expect(readCeeDiagnosticTrace(null, { blocks: [] })).toBeNull()
    expect(readCeeDiagnosticTrace(null, null)).toBeNull()
  })
})

// ─── Bundle-level checks: gates.run relabel + schema_versions facts ─────────

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: 'test-build', cee: 'cee-abc1234', plot: null, isl: null },
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
      isl_edge_e_values_present: false,
      plot_edge_e_values_exposed: false,
      ui_edge_e_values_available: false,
      factor_confidence_differentiated: false,
      factor_confidence_unique_values: [],
    },
    ceeTrace: null,
    corrections: [],
    correctionsSummary: null,
    pipeline: {
      status: 'success',
      total_duration_ms: 1200,
      stages: [],
      llm_metadata: undefined,
      llm_raw: undefined,
      node_extraction: undefined,
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

describe('buildDebugBundle — gates.run reconciliation', () => {
  beforeEach(() => {
    canvasState.currentScenarioId = null
  })

  it('relabels the writer-less default run:fail as legacy_check_unreliable when the pipeline succeeded', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        gates: [
          { name: 'graph_readiness', status: 'pass' },
          { name: 'run', status: 'fail' }, // untouched default — no message
        ],
      }),
    )
    const runGate = bundle.gates.find((g) => g.name === 'run')
    expect(runGate?.status).toBe('legacy_check_unreliable')
    expect(runGate?.message).toContain('V5-canonical')
  })

  it('keeps an attributed run failure and any non-success pipeline untouched', () => {
    // A run:fail WITH a message means a writer actually fired — keep it.
    const attributed = buildDebugBundle(
      makeDebugData({
        gates: [{ name: 'run', status: 'fail', message: 'PLoT run 500' }],
      }),
    )
    expect(attributed.gates.find((g) => g.name === 'run')?.status).toBe('fail')

    // Pipeline not successful → no relabel (contradiction does not exist).
    const failedPipeline = buildDebugBundle(
      makeDebugData({
        overall: { status: 'error', total_duration_ms: 100, request_id: 'r' },
        gates: [{ name: 'run', status: 'fail' }],
      }),
    )
    expect(failedPipeline.gates.find((g) => g.name === 'run')?.status).toBe('fail')
  })

  it('leaves a passing run gate alone', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        gates: [{ name: 'run', status: 'pass', message: 'Simulation completed' }],
      }),
    )
    expect(bundle.gates.find((g) => g.name === 'run')?.status).toBe('pass')
  })
})

describe('buildDebugBundle — schema_versions UI-side facts', () => {
  it('populates ui_vendored_talchain_schemas + build_ids even when all wire versions are null', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.schema_versions?.ui_vendored_talchain_schemas).toBe(
      TALCHAIN_SCHEMAS_VENDORED_VERSION,
    )
    expect(bundle.schema_versions?.build_ids).toEqual({
      ui: 'test-build',
      cee: 'cee-abc1234',
      plot: null,
      isl: null,
    })
    // Wire-only consistency semantics preserved: still unknown when the six
    // wire fields are missing — the UI fact does not fake wire consistency.
    expect(bundle.schema_versions?.consistency_status).toBe('unknown')
    expect(bundle.schema_versions?.unknown_reason).toBe('missing_schema_versions')
  })

  it('decorates a pre-extracted schema_versions object without dropping fields', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        schema_versions: {
          cee_request: '1.2.0',
          cee_response: '1.2.0',
          plot_request: '1.2.0',
          plot_response: '1.2.0',
          isl_request: '1.2.0',
          isl_response: '1.2.0',
          consistent: true,
          consistency_status: 'matched',
        },
      }),
    )
    expect(bundle.schema_versions?.consistency_status).toBe('matched')
    expect(bundle.schema_versions?.cee_request).toBe('1.2.0')
    expect(bundle.schema_versions?.ui_vendored_talchain_schemas).toBe(
      TALCHAIN_SCHEMAS_VENDORED_VERSION,
    )
  })
})
