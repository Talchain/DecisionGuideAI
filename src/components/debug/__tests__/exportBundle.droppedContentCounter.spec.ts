/**
 * Debug-export surface for the dropped-content counter — Track C Step 1
 * (approved D-5). The bundle carries the session snapshot additively at
 * `dropped_content_counter`; nothing existing is dropped or changed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import {
  recordDroppedContent,
  _resetDroppedContentCounter,
} from '../../../lib/droppedContentCounter'

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

function spyOnConsoleInfo() {
  return vi.spyOn(console, 'info').mockImplementation(() => {})
}

describe('buildDebugBundle — dropped_content_counter (Track C Step 1)', () => {
  let infoSpy: ReturnType<typeof spyOnConsoleInfo>

  beforeEach(() => {
    _resetDroppedContentCounter()
    infoSpy = spyOnConsoleInfo()
  })

  afterEach(() => {
    infoSpy.mockRestore()
    _resetDroppedContentCounter()
  })

  it('always emits the field — empty snapshot when nothing was dropped', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.dropped_content_counter).toEqual({
      total_dropped: 0,
      entries: [],
      per_turn_truth: 'payloads.cee_response.__additive__.unknown_blocks',
    })
  })

  it('carries the session counts by type+source with tracked rationale', () => {
    recordDroppedContent({
      blockType: 'hologram_widget',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: 2,
    })
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.dropped_content_counter.total_dropped).toBe(2)
    expect(bundle.dropped_content_counter.entries[0]).toMatchObject({
      block_type: 'hologram_widget',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: 2,
    })
  })
})
