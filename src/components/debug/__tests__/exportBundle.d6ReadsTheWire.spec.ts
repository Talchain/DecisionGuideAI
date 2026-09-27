/**
 * D-6 (P2 train, 27 Sep 2026) — the debug export must read the wire it
 * describes. Driven by Paul's own exports E1 = 17d1cd3a and E2 = 90b8f080
 * (`fixtures/paul-exports-20260927/d6-wire.json`). Each `it` names its
 * TRAIN-MAPPING row and asserts that row's exit check.
 *
 * The mock preamble is copied from exportBundle.liveCeeCapture.spec.ts.
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

// Canvas store mock — minimal shape the bundle reads.
const canvasState: {
  currentScenarioId: string | null
  v5AnalysisFact: {
    scenarioId: string | null
    analysisHash: string | null
    hasRunAnalysisFact: boolean | null
    freshness: 'fresh' | 'stale' | 'unknown' | 'none' | null
  } | null
  results: {
    report: unknown
    hash: string | null
    rawV2Response: unknown
  } | null
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
  useCanvasStore: {
    getState: () => canvasState,
  },
}))

vi.mock('../../../canvas/hooks/useAnalysisStateSource', () => ({
  readAnalysisStateSourceFromStore: () => ({
    source: 'none',
    showOrphanBanner: false,
    hasResultsReport: false,
    factPresentForScenario: false,
  }),
}))

// Trace-store mock — controllable per test. Also controls the
// payload_inspection_status surface.
const traceState: {
  payloads: Array<{
    service: string
    endpoint?: string
    request?: { body?: unknown }
    response?: { body?: unknown }
  }>
} = { payloads: [] }

const inspectionState: {
  enabled: boolean
  resolvedAppEnv: string
  reason: string
} = {
  enabled: true,
  resolvedAppEnv: 'staging',
  reason: 'app_env_staging_enabled',
}

vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: {
    getState: () => traceState,
  },
  getPayloadInspectionStatus: () => inspectionState,
}))

import { buildDebugBundle, buildDebugBundleAsync } from '../utils/exportBundle'

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: {
      status: 'success',
      total_duration_ms: 1200,
      request_id: 'req-main',
    },
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
      connectivity: {
        decision_count: 0,
        option_count: 0,
        goal_count: 0,
        factor_count: 0,
        edge_count: 0,
      },
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
    ...overrides,
  }
}

import wire from './fixtures/paul-exports-20260927/d6-wire.json'
import { countNodesByKind, extractDiagnosticChecks } from '../hooks/useDebugData'
import { runScientificValidation } from '../../../lib/scientificValidation'

type Wire = typeof wire.e1
const EXPORTS: Array<[string, Wire]> = [
  ['E1 17d1cd3a', wire.e1],
  ['E2 90b8f080', wire.e2],
]

const enrichmentOf = (w: Wire) =>
  (w.cee_response.blocks[0] as { enrichment: Record<string, unknown> }).enrichment
const blockHashOf = (w: Wire) =>
  (w.cee_response.blocks[0] as { computed_against_hash: string }).computed_against_hash
const ENRICHMENT_PATH = 'payloads.cee_response.blocks[0].enrichment'

/** The served V5 turn as the trace store holds it, and the DebugData the hook would emit. */
function arrangeServedTurn(w: Wire, overrides: Partial<DebugData> = {}): DebugData {
  canvasState.currentScenarioId = w.cee_request.scenario_id
  canvasState.v5AnalysisFact = {
    scenarioId: w.cee_request.scenario_id,
    analysisHash: 'v5:content-hash-not-a-turn-id',
    hasRunAnalysisFact: true,
    freshness: 'fresh',
  }
  traceState.payloads = [
    {
      id: `trace-${w.export_id}`,
      service: 'CEE',
      endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
      completed: true,
      status: 200,
      request: { body: w.cee_request },
      response: { body: w.cee_response },
    } as (typeof traceState.payloads)[number],
  ]
  return makeDebugData({
    payloads: {
      cee_request: w.cee_request,
      cee_response: w.cee_response,
      plot_request: null,
      plot_response: null,
      isl_request: null,
      isl_response: null,
    },
    services: { cee: { status: 200, duration_ms: 20891, success: true }, plot: null, isl: null },
    cee_capture_provenance: 'analysis_producing_v5_turn',
    cee_capture_selected_trace_id: `trace-${w.export_id}`,
    analysis_evidence_trace_source: 'selected_cee_turn',
    ...overrides,
  })
}

const displayStateWith = (options: number, factors: number) =>
  ({
    rendered_options: Array.from({ length: options }, (_, i) => ({ id: `o${i}` })),
    rendered_factors: Array.from({ length: factors }, (_, i) => ({ id: `f${i}` })),
  }) as never

describe('D-6 — the export counts, names and hashes the analysis CEE sent', () => {
  beforeEach(() => {
    canvasState.currentScenarioId = null
    canvasState.v5AnalysisFact = null
    canvasState.results = null
    traceState.payloads = []
  })

  it.each(EXPORTS)(
    'i22/i87/i126/i187/i219 %s: result counts are the enrichment\'s lengths, not 0 from the null plot_response',
    async (_name, w) => {
      const e = enrichmentOf(w)
      const bundle = await buildDebugBundleAsync(arrangeServedTurn(w), {
        displayState: displayStateWith(w.rendered_option_count, w.rendered_factor_count),
      })
      const results = bundle.v5_canonical_turn_diagnostics!.results
      expect(bundle.payloads.plot_response).toBeNull()
      expect(results.option_count).toBe((e.option_comparison as unknown[]).length)
      expect(results.factor_sensitivity_count).toBe((e.factor_sensitivity as unknown[]).length)
      expect(results.option_count).toBeGreaterThan(0)
    },
  )

  it('i219 E2: 6 options rendered beside 5 analysed is an issue on the coherence record, not "complete"', async () => {
    const w = wire.e2
    const bundle = await buildDebugBundleAsync(arrangeServedTurn(w), {
      displayState: displayStateWith(w.rendered_option_count, w.rendered_factor_count),
    })
    const coherence = bundle.v5_canonical_turn_diagnostics!.coherence
    expect(w.rendered_option_count).toBe(6)
    expect(coherence.issues).toContain('rendered_option_count_differs_from_analysed')
    expect(coherence.state).not.toBe('complete')
  })

  it('i219 control E1: 3 rendered beside 3 analysed raises no count issue', async () => {
    const w = wire.e1
    const bundle = await buildDebugBundleAsync(arrangeServedTurn(w), {
      displayState: displayStateWith(w.rendered_option_count, w.rendered_factor_count),
    })
    const coherence = bundle.v5_canonical_turn_diagnostics!.coherence
    expect(coherence.issues).not.toContain('rendered_option_count_differs_from_analysed')
    expect(coherence.issues).not.toContain('rendered_factor_count_differs_from_analysed')
  })

  it.each(EXPORTS)(
    'i85/i218 %s: graph_hash_at_generation is the analysis block\'s computed_against_hash',
    async (_name, w) => {
      const bundle = await buildDebugBundleAsync(arrangeServedTurn(w))
      const fact = bundle.v5_canonical_turn_diagnostics!.analysis_fact
      expect(fact.graph_hash_at_generation).toBe(blockHashOf(w))
      expect(fact.graph_hash_source).toBe('analysis_result_block')
    },
  )

  it.each(EXPORTS)(
    'i86/i215 %s: v5_cee_capture.turn_id is the CEE turn id; the content hash has its own field',
    async (_name, w) => {
      const bundle = await buildDebugBundleAsync(arrangeServedTurn(w))
      const capture = bundle.v5_canonical_analysis!.v5_cee_capture!
      expect(capture.turn_id).toBe(w.cee_request.turn_id)
      expect(capture.turn_id).toHaveLength(36)
      expect(capture.results_hash).toBe('v5:content-hash-not-a-turn-id')
      expect(bundle.v5_canonical_turn_diagnostics!.latest_v5_turn.turn_id).toBe(w.cee_request.turn_id)
    },
  )

  it('i14: with no render capture the export never states ui_render_success', async () => {
    const bundle = await buildDebugBundleAsync(arrangeServedTurn(wire.e1))
    expect(bundle.render_summary.available).toBe(false)
    expect(bundle.pipeline.v5_pipeline_status).not.toBe('ui_render_success')
    expect(bundle.pipeline.v5_pipeline_status).toBe('response_delivered_render_not_captured')
    expect(bundle.pipeline.v5_pipeline_status_source.render_witnessed).toBe(false)
  })

  it('i14: an unwritten validation gate is not "warn" beside a 0/0/0 validation summary', async () => {
    const bundle = await buildDebugBundleAsync(
      arrangeServedTurn(wire.e1, { gates: [{ name: 'validation', status: 'warn' }] as never }),
    )
    expect(bundle.validation.summary).toMatchObject({ errors: 0, warnings: 0, info: 0 })
    const gate = bundle.gates.find((g) => g.name === 'validation')!
    expect(gate.status).not.toBe('warn')
  })

  it('i14 control: a written validation gate, or a summary with warnings, keeps its warn', async () => {
    const written = await buildDebugBundleAsync(
      arrangeServedTurn(wire.e1, {
        gates: [{ name: 'validation', status: 'warn', message: 'ISL critique' }] as never,
      }),
    )
    expect(written.gates.find((g) => g.name === 'validation')!.status).toBe('warn')
    const warned = await buildDebugBundleAsync(
      arrangeServedTurn(wire.e1, {
        gates: [{ name: 'validation', status: 'warn' }] as never,
        validation: { summary: { errors: 0, warnings: 2, info: 0 }, issues: [] },
      }),
    )
    expect(warned.gates.find((g) => g.name === 'validation')!.status).toBe('warn')
  })

  it.each(EXPORTS)(
    'i109 %s: every scientific_validation source path names blocks[0].enrichment, none the null plot_response',
    async (_name, w) => {
      const bundle = await buildDebugBundleAsync(arrangeServedTurn(w))
      expect(bundle.evidence_resolution!.plot_response.path).toBe(ENRICHMENT_PATH)
      const paths = Object.values(bundle.scientific_validation!.validators).flatMap((v) => v.source_paths)
      expect(paths.length).toBeGreaterThan(0)
      expect(paths.filter((p) => p.startsWith('payloads.plot_response'))).toEqual([])
      expect(paths.some((p) => p.startsWith(`${ENRICHMENT_PATH}.`))).toBe(true)
    },
  )
})

describe('D-6 — science checks and buckets read the enrichment CEE relayed', () => {
  it.each(EXPORTS)(
    'i13/i109 %s: evpi_present and isl_edge_e_values_present are true from the lifted enrichment',
    (_name, w) => {
      const checks = extractDiagnosticChecks(
        null,
        w.cee_response,
        // CEE's 3-key copy of the ISL response, as the export held it.
        Object.fromEntries(w.isl_response_keys.map((k) => [k, []])),
        'cee_enrichment_extraction',
        undefined,
        undefined,
        null,
        { plotBody: enrichmentOf(w), plotSource: 'cee_embedded' },
      )
      expect(checks.evpi_present).toBe(true)
      expect(checks.isl_edge_e_values_present).toBe(true)
    },
  )

  it('i13 control: a top-level PLoT capture with no ISL fields does not borrow the lifted answer', () => {
    const w = wire.e2
    const e = enrichmentOf(w)
    const checks = extractDiagnosticChecks(
      { option_comparison: e.option_comparison, edge_e_values: e.edge_e_values },
      w.cee_response,
      null,
      'none',
      undefined,
      undefined,
      null,
      { plotBody: e, plotSource: 'top_level' },
    )
    expect(checks.plot_edge_e_values_exposed).toBe(true)
    expect(checks.isl_edge_e_values_present).toBe(false)
    expect(checks.evpi_present).toBe(false)
  })

  it.each([
    ['E1 17d1cd3a', wire.e1, { found: 0, no_effect: 2, unresolved: 0, unavailable: 0 }],
    ['E2 90b8f080', wire.e2, { found: 1, no_effect: 1, unresolved: 0, unavailable: 0 }],
  ] as const)(
    'i14 %s: flip buckets count structurally_invariant / no_effect_within_bounds as no_effect',
    (_name, w, expected) => {
      const sv = runScientificValidation({
        plotRequest: null,
        plotResponse: enrichmentOf(w),
        ceeRequest: w.cee_request,
        ceeResponse: w.cee_response,
        islRequest: null,
        islResponse: null,
        resultsReport: null,
        ceeAnalysisReady: null,
        capturePipelineStatus: null,
        selectedPlotTraceIsUsableLiveEvidence: true,
        plotResponseSource: 'cee_embedded',
        plotResponsePath: ENRICHMENT_PATH,
        ceeCaptureIsSelectedV5Turn: true,
      })
      const details = sv.validators.flip_threshold_validation.details as {
        inferred_buckets?: Record<string, number>
        buckets?: Record<string, number>
      }
      expect(details.inferred_buckets ?? details.buckets).toEqual(expected)
    },
  )

  it('i14: a within-bounds no-flip buckets as no_effect; a legacy no_bracket is a probe failure', () => {
    const sv = runScientificValidation({
      plotRequest: null,
      plotResponse: {
        flip_thresholds: [
          { factor_id: 'a', flip_value: null, flip_reason: 'no_effect_within_bounds' },
          { factor_id: 'b', flip_value: null, flip_reason: 'no_bracket' },
        ],
      },
      ceeRequest: null,
      ceeResponse: null,
      islRequest: null,
      islResponse: null,
      resultsReport: null,
      ceeAnalysisReady: null,
      capturePipelineStatus: null,
    })
    const details = sv.validators.flip_threshold_validation.details as {
      inferred_buckets: Record<string, number>
    }
    expect(details.inferred_buckets).toEqual({ found: 0, no_effect: 1, unresolved: 1, unavailable: 0 })
  })

  it('i109 control: a top-level PLoT capture keeps its payloads.plot_response paths', () => {
    const sv = runScientificValidation({
      plotRequest: null,
      plotResponse: enrichmentOf(wire.e2),
      ceeRequest: null,
      ceeResponse: null,
      islRequest: null,
      islResponse: null,
      resultsReport: null,
      ceeAnalysisReady: null,
      capturePipelineStatus: null,
      plotResponseSource: 'top_level',
      plotResponsePath: 'payloads.plot_response',
    })
    const paths = Object.values(sv.validators).flatMap((v) => v.source_paths)
    expect(paths.some((p) => p.startsWith('payloads.plot_response'))).toBe(true)
  })
})

describe('D-6 — node kinds', () => {
  it('i21: risk and outcome nodes are counted, and the total counts every node', () => {
    const kinds = ['decision', 'goal', 'risk', 'outcome',
      ...Array(5).fill('option'), ...Array(5).fill('factor')]
    const counts = countNodesByKind(kinds.map((kind) => ({ data: { kind } })))
    expect(counts).toMatchObject({ decision: 1, goal: 1, option: 5, factor: 5, risk: 1, outcome: 1, total: 14 })
  })

  it('i21: E2\'s own served graph — 15 nodes, one of them a risk', () => {
    const counts = countNodesByKind(wire.e2.cee_response.draft_graph.nodes.map((n) => ({ data: { kind: n.kind } })))
    expect(counts.total).toBe(wire.e2.cee_response.draft_graph.nodes.length)
    expect(counts.risk).toBe(1)
    expect(counts.decision + counts.goal + counts.option + counts.factor + counts.risk + counts.outcome).toBe(counts.total)
  })
})
