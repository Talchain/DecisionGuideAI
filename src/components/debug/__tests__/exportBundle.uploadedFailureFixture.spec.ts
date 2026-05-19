/**
 * Fixture-style integration test — proves the uploaded-bundle failure
 * the brief describes is explainable from a single export in under 60
 * seconds of reading. Simulates the exact set of contradictions the
 * uploaded bundle showed:
 *
 *   - analysis_state_source = 'cee_v5_run_analysis'
 *   - effective_cee_response_source = 'none'
 *   - v5_cee_capture = null
 *   - analysis_fact_status = 'present'
 *   - pipeline.v5_pipeline_status = 'proxy_or_network_failure'
 *     (legacy classifier mislabelling missing capture)
 *   - session.scenario_id null in the uploaded bundle
 *
 * Assertions: the exported bundle's machine-readable fields must answer
 * every diagnostic question the brief lists, without a human having to
 * cross-reference multiple sections.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'

vi.mock('../../../lib/version-cache', () => ({
  getClientBuild: () => 'fixture-build',
  getVersionInfo: () => ({ short: 'fixture-version', branch: 'main' }),
}))

vi.mock('../../../utils/debugLogBuffer', () => ({
  getBufferedLogs: () => [],
}))

vi.mock('../../../lib/debug-state', () => ({
  getUserActions: () => [],
}))

// Canvas store: scenario in progress, v5AnalysisFact present, results
// rendered from store-only (no rawV2Response).
const canvasState: {
  currentScenarioId: string | null
  v5AnalysisFact: {
    scenarioId: string | null
    analysisHash: string | null
    hasRunAnalysisFact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  } | null
  results: { report: unknown; hash: string | null; rawV2Response: unknown } | null
  goalConstraints: unknown[]
  ceeAnalysisReady: unknown
} = {
  currentScenarioId: 'sid-uploaded-bundle',
  v5AnalysisFact: {
    scenarioId: 'sid-uploaded-bundle',
    analysisHash: 'v5:abc123',
    hasRunAnalysisFact: true,
    freshness: 'fresh',
  },
  results: {
    report: { summary: 'Plan A is recommended' },
    hash: 'v5:abc123',
    // Hydrated case: no rawV2Response — Results came from saved/cached
    // state, not a fresh PLoT v2/run.
    rawV2Response: null,
  },
  goalConstraints: [],
  ceeAnalysisReady: null,
}

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => canvasState },
}))

// Analysis-state classifier: claims cee_v5_run_analysis source (the
// orphan path the legacy classifier produces when fact + results match).
vi.mock('../../../canvas/hooks/useAnalysisStateSource', () => ({
  readAnalysisStateSourceFromStore: () => ({
    source: 'cee_v5_run_analysis',
    showOrphanBanner: false,
    hasResultsReport: true,
    factPresentForScenario: true,
  }),
}))

// Payload trace store: empty — no V5 CEE call captured in this turn.
vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: { getState: () => ({ payloads: [] }) },
}))

import { buildDebugBundleAsync } from '../utils/exportBundle'

function makeFixtureDebugData(): DebugData {
  return {
    overall: {
      status: 'success',
      total_duration_ms: 1200,
      request_id: 'req-uploaded',
    },
    // Legacy classifier mislabelled this as proxy_or_network_failure
    // even though no failed HTTP record exists. The pipeline status
    // is fed in via debug data so we can confirm the new fields
    // contradict it honestly.
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: 'fixture-build', cee: null, plot: null, isl: null },
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
      connectivity: {
        decision_count: 0,
        option_count: 0,
        goal_count: 0,
        factor_count: 0,
        edge_count: 0,
      },
    },
    payloads: {
      // No CEE capture at all — analysis fact present but no proof of
      // the turn that minted it.
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
    robustness: {
      status: 'unavailable',
      stability: null,
      context_label: 'N/A',
      description: '',
    },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: {
      ui_generated: 'ui-req',
      from_plot: {
        ui: 'ui-req',
        plot: null,
        isl: null,
        isl_echoed: null,
        all_match: false,
        chain_complete: false,
      },
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
  }
}

describe('uploaded-bundle fixture — every contradiction the brief lists is machine-readable', () => {
  beforeEach(() => {
    canvasState.currentScenarioId = 'sid-uploaded-bundle'
    canvasState.v5AnalysisFact = {
      scenarioId: 'sid-uploaded-bundle',
      analysisHash: 'v5:abc123',
      hasRunAnalysisFact: true,
      freshness: 'fresh',
    }
    canvasState.results = {
      report: { summary: 'Plan A is recommended' },
      hash: 'v5:abc123',
      rawV2Response: null,
    }
  })

  it('Q1: was canonical V5 analysis enabled? → canonical_flag_on is a boolean (not unknown)', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    const td = bundle.v5_canonical_turn_diagnostics
    expect(td).toBeDefined()
    expect(typeof td!.canonical_flag_on).toBe('boolean')
    expect(td!.canonical_flag_env_key).toBe('VITE_V5_CANONICAL_ANALYSIS')
  })

  it('Q2 + Q3: did CEE return a parseable response? → parse.parse_ok null when no capture', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    const td = bundle.v5_canonical_turn_diagnostics!
    expect(td.latest_v5_turn.request_present).toBe(false)
    expect(td.latest_v5_turn.response_present).toBe(false)
    expect(td.parse.parse_ok).toBeNull()
  })

  it('Q4: did Results render from live CEE/PLoT, hydrated state, or fallback? → capture_pipeline_status answers in one field', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    // No rawV2Response + no V5 capture + results.report present
    // → hydrated_only is the honest label.
    expect(bundle.capture_pipeline_status).toBe('hydrated_only')
  })

  it('Q5: is there a contradiction between fact, capture, and analysis state? → coherence.issues lists exact codes', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    const issues = bundle.v5_canonical_turn_diagnostics!.coherence.issues
    expect(issues).toContain('analysis_state_cee_v5_but_effective_cee_response_none')
    expect(issues).toContain('analysis_fact_present_but_cee_capture_missing')
    expect(bundle.v5_canonical_turn_diagnostics!.coherence.state).toBe('contradictory')
  })

  it('Q6: which scientific validators have evidence? → hydrated_report labelled honestly, overall_status = insufficient_raw_evidence', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    expect(bundle.scientific_validation).toBeDefined()
    // Capture is hydrated_only with results.report present → source
    // hydrated_report. This is the honest classification (NOT
    // unavailable) because there IS a report to inspect, but every
    // validator must report inferred/unavailable rather than pretend
    // live raw payloads exist.
    expect(bundle.scientific_validation!.source).toBe('hydrated_report')
    // With zero validators reaching derived/observed evidence → exactly
    // the insufficient_raw_evidence state the brief calls out.
    expect(bundle.scientific_validation!.overall_status).toBe('insufficient_raw_evidence')
    // Every validator must declare claim_strength honestly.
    for (const v of Object.values(bundle.scientific_validation!.validators)) {
      expect(['observed', 'derived', 'inferred', 'unavailable']).toContain(v.claim_strength)
      // Honesty rule: inferred never pairs with pass.
      if (v.claim_strength === 'inferred') {
        expect(v.status).not.toBe('pass')
      }
    }
  })

  it('Q7: which upstream support is required? → user_std_propagation lists plot.debug.isl_request', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    const stdValidator =
      bundle.scientific_validation!.validators.user_std_propagation
    expect(stdValidator.required_upstream_support).toContain('plot.debug.isl_request')
  })

  it('Q8: scenario_id is populated honestly with source — never hardcoded null', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    expect(bundle.session.scenario_id).toBe('sid-uploaded-bundle')
    expect(bundle.session.scenario_id_source).toBe('store')
    expect(bundle.scenario_id_reconciliation?.candidates.store).toBe('sid-uploaded-bundle')
    expect(bundle.scenario_id_reconciliation?.candidates.v5_fact).toBe('sid-uploaded-bundle')
    // Same value across both → no conflict
    expect(bundle.scenario_id_reconciliation?.conflicts).toEqual([])
  })

  it('legacy fields preserved alongside the new honest ones', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    // Legacy enum still emitted — consumers depending on it do not break.
    expect(bundle.v5_canonical_analysis).toBeDefined()
    expect(bundle.pipeline.v5_pipeline_status).toBeDefined()
  })

  it('reproduces the misleading legacy proxy_or_network_failure label: legacy classifies as proxy/network because services.cee returned 5xx, but no V5 CEE payload-trace failure exists — new classifier disagrees and emits legacy_pipeline_status_misleading_proxy_or_network_failure', async () => {
    // Inject a 5xx services.cee record so derivePipelineStatus emits
    // proxy_or_network_failure (the misleading legacy label the brief
    // calls out). Crucially, the payload-trace store still has NO V5
    // turn record (mocked empty above), so our new classifier sees
    // failedHttpRecord: { present: false } and lands on hydrated_only.
    // The disagreement must surface as an explicit coherence issue.
    const dataWith5xx: DebugData = {
      ...makeFixtureDebugData(),
      services: {
        cee: {
          name: 'CEE',
          status: 502,
          success: false,
          duration_ms: 80,
          endpoint: '/bff/orchestrate/v2/turn',
        },
        plot: null,
        isl: null,
      },
    }
    const bundle = await buildDebugBundleAsync(dataWith5xx)

    // Legacy reports the misleading classification.
    expect(bundle.pipeline.v5_pipeline_status).toBe('proxy_or_network_failure')

    // New classifier sees no V5 payload-trace failure → does NOT echo
    // proxy_or_network_failure. The disagreement is captured as an
    // explicit coherence issue.
    expect(bundle.capture_pipeline_status).not.toBe('proxy_or_network_failure')
    expect(bundle.v5_canonical_turn_diagnostics!.coherence.issues).toContain(
      'legacy_pipeline_status_misleading_proxy_or_network_failure',
    )
  })

  it('redaction manifest documents the analytical preservation policy verbatim', async () => {
    const bundle = await buildDebugBundleAsync(makeFixtureDebugData())
    const manifest = bundle.debug_redaction_manifest!
    expect(manifest.preserved_analytical_paths).toContain(
      'payloads.plot_request.graph.nodes[*].data.observed_state.*',
    )
    expect(manifest.preserved_analytical_paths).toContain(
      'payloads.plot_response.factor_sensitivity[*]',
    )
  })
})
