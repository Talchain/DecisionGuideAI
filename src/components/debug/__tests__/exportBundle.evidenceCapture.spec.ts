/**
 * Lane UI-W4 B: consume PLoT `_meta.evidence` (PLoT #200, roadmap 2.13) in
 * the debug exporter.
 *
 * Closes the investor-diligence gap the chronicle flagged (items 20/21):
 * the bundle reported "plot: null / isl: null" because the full payload
 * mirror is gated behind UI_CANONICAL_META (off in staging), so nothing
 * evidenced the ISL exchange. PLoT now ships an ALWAYS-present additive
 * `_meta.evidence` object on /v2/run — sha256 digests of the exact ISL
 * wire bytes plus deployed builds. The bundle:
 *   - mirrors it verbatim at the new additive `evidence_capture` area;
 *   - falls back to its builds for `schema_versions.build_ids.plot/isl`
 *     when the legacy build extraction found nothing.
 *
 * Fail-closed: absent/malformed evidence -> null fields, never invented.
 */

import { describe, it, expect, vi } from 'vitest'
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

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: {
    getState: () => ({
      currentScenarioId: null,
      v5AnalysisFact: null,
      results: null,
      goalConstraints: [],
      ceeAnalysisReady: null,
      nodes: [],
      edges: [],
    }),
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

vi.mock('../../../lib/payload-trace-store', () => ({
  usePayloadTraceStore: { getState: () => ({ payloads: [] }) },
}))

import { buildDebugBundle } from '../utils/exportBundle'

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

/**
 * Bundle-shaped `_meta.evidence` exactly as PLoT #200 emits it
 * (EvidenceCaptureV1 / PayloadDigestV3, src/types/engine-v3.ts).
 */
const WIRE_EVIDENCE = {
  plot_build: '85e06d7',
  isl_build: '9a22a1ae',
  isl_request_digest: {
    sha256: 'a'.repeat(64),
    bytes: 18432,
    key_manifest: ['edges', 'goal_threshold', 'nodes', 'options', 'request_id', 'seed'],
  },
  isl_response_digest: {
    sha256: 'b'.repeat(64),
    bytes: 96210,
    key_manifest: ['build', 'factor_sensitivity', 'options', 'robustness'],
  },
}

function plotResponseWith(evidence: unknown): Record<string, unknown> {
  return {
    analysis_status: 'computed',
    response_hash: 'hash-1',
    option_comparison: [],
    critiques: [],
    _meta: { evidence },
  }
}

describe('buildDebugBundle — evidence_capture (Lane UI-W4 B, PLoT _meta.evidence)', () => {
  it('mirrors _meta.evidence verbatim at bundle.evidence_capture', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: null,
          plot_request: null,
          plot_response: plotResponseWith(WIRE_EVIDENCE),
          isl_request: null,
          isl_response: null,
        },
      }),
    )
    expect(bundle.evidence_capture).toEqual({
      source: 'plot_response._meta.evidence',
      plot_build: '85e06d7',
      isl_build: '9a22a1ae',
      isl_request_digest: WIRE_EVIDENCE.isl_request_digest,
      isl_response_digest: WIRE_EVIDENCE.isl_response_digest,
    })
  })

  it('carries PLoT honest nulls verbatim (ISL not exercised)', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: null,
          plot_request: null,
          plot_response: plotResponseWith({
            plot_build: '85e06d7',
            isl_build: null,
            isl_request_digest: null,
            isl_response_digest: null,
          }),
          isl_request: null,
          isl_response: null,
        },
      }),
    )
    expect(bundle.evidence_capture).toEqual({
      source: 'plot_response._meta.evidence',
      plot_build: '85e06d7',
      isl_build: null,
      isl_request_digest: null,
      isl_response_digest: null,
    })
  })

  it('is null when the PLoT response carries no _meta.evidence (older build) — never invented', () => {
    const noMeta = makeDebugData({
      payloads: {
        cee_request: null,
        cee_response: null,
        plot_request: null,
        plot_response: { analysis_status: 'computed', response_hash: 'h', option_comparison: [], critiques: [] },
        isl_request: null,
        isl_response: null,
      },
    })
    expect(buildDebugBundle(noMeta).evidence_capture).toBeNull()
    expect(buildDebugBundle(makeDebugData()).evidence_capture).toBeNull()
  })

  it('fails closed per-field on malformed digests (non-object digest, non-string build)', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: null,
          plot_request: null,
          plot_response: plotResponseWith({
            plot_build: 42,
            isl_build: 'ok-build',
            isl_request_digest: 'not-an-object',
            isl_response_digest: { sha256: 'c'.repeat(64), bytes: 'NaN', key_manifest: ['a'] },
          }),
          isl_request: null,
          isl_response: null,
        },
      }),
    )
    expect(bundle.evidence_capture).toEqual({
      source: 'plot_response._meta.evidence',
      plot_build: null,
      isl_build: 'ok-build',
      isl_request_digest: null,
      isl_response_digest: null,
    })
  })

  it('build_ids fall back to evidence builds when legacy extraction found nothing (closes plot: null / isl: null)', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        payloads: {
          cee_request: null,
          cee_response: null,
          plot_request: null,
          plot_response: plotResponseWith(WIRE_EVIDENCE),
          isl_request: null,
          isl_response: null,
        },
      }),
    )
    expect(bundle.schema_versions?.build_ids).toMatchObject({
      plot: '85e06d7',
      isl: '9a22a1ae',
    })
  })

  it('build_ids prefer the legacy capture-time extraction when it exists (evidence is fallback only)', () => {
    const bundle = buildDebugBundle(
      makeDebugData({
        builds: { ui: 'test-build', cee: null, plot: 'legacy-plot-build', isl: 'legacy-isl-build' },
        payloads: {
          cee_request: null,
          cee_response: null,
          plot_request: null,
          plot_response: plotResponseWith(WIRE_EVIDENCE),
          isl_request: null,
          isl_response: null,
        },
      }),
    )
    expect(bundle.schema_versions?.build_ids).toMatchObject({
      plot: 'legacy-plot-build',
      isl: 'legacy-isl-build',
    })
  })

  it('build_ids stay null when evidence is absent (no invention)', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.schema_versions?.build_ids).toMatchObject({ plot: null, isl: null })
  })
})
