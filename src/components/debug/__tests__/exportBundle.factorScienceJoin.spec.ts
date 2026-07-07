/**
 * Factor-science join — RED→GREEN coverage for the V5-canonical
 * display_state.rendered_factors join (debug bundle 45c9b625, 2026-07-07).
 *
 * Observed failure shape: the store's `rawV2Response` is explicitly nulled
 * by `applyV5State` on the V5-canonical path, so `captureDisplayState`'s
 * only factor_sensitivity read source was empty and ALL five factors
 * reported `influence_source: 'unmatched'` / `sensitivity_source:
 * 'unmatched'` — while the CEE turn response carried the full
 * factor_sensitivity (incl. influence_score 1 / 0.62 / 0.48 / 0.45 /
 * 0.145) at `payloads.cee_response.blocks[0].enrichment`.
 *
 * Fix under test: `buildDebugBundleAsync` resolves the CEE-embedded
 * enrichment via `resolveScientificEvidence` and threads its
 * factor_sensitivity into `captureDisplayState` as a fallback join source
 * with distinct `cee_embedded.*` provenance labels.
 *
 * Fixture ids/values are the exact ones from the reference bundle brief.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  rawV2Response: Record<string, unknown> | null
  results: { status: string | null; report?: unknown } | null
  ceeAnalysisReady: { status?: string } | null
  currentScenarioId: string | null
  v5AnalysisFact: unknown
  goalConstraints: unknown[]
  graphEditedSinceLastRun: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => mockState },
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

import {
  buildDebugBundleAsync,
  captureDisplayState,
} from '../utils/exportBundle'

// ─── Fixture: the reference bundle's exact factor ids + science values ──────

/** Canvas factor nodes exactly as ids appear in bundle 45c9b625. */
const FACTOR_NODE_IDS = [
  'fac_market_receptivity',
  'fac_marketing_expertise',
  'fac_ad_spend',
  'fac_founder_time',
  'fac_personnel_cost',
] as const

const FACTOR_LABELS: Record<string, string> = {
  fac_market_receptivity: 'Market Receptivity to Feature',
  fac_marketing_expertise: 'Marketing Strategy Quality',
  fac_ad_spend: 'Paid Advertising Budget',
  fac_founder_time: 'Founder Time on Marketing',
  fac_personnel_cost: 'Marketing Personnel Cost',
}

function makeFactorNodes() {
  return FACTOR_NODE_IDS.map((id) => ({
    id,
    data: { kind: 'factor', label: FACTOR_LABELS[id] },
  }))
}

/** Trimmed copy of blocks[0].enrichment.factor_sensitivity from the bundle. */
const EMBEDDED_FACTOR_SENSITIVITY = [
  {
    factor_id: 'fac_marketing_expertise',
    factor_label: 'Marketing Strategy Quality',
    influence_score: 1,
    sensitivity_score: 0,
  },
  {
    factor_id: 'fac_market_receptivity',
    factor_label: 'Market Receptivity to Feature',
    influence_score: 0.62,
    sensitivity_score: 0.1925,
  },
  {
    factor_id: 'fac_founder_time',
    factor_label: 'Founder Time on Marketing',
    influence_score: 0.48,
    sensitivity_score: -0.15,
  },
  {
    factor_id: 'fac_personnel_cost',
    factor_label: 'Marketing Personnel Cost',
    influence_score: 0.45,
    sensitivity_score: 0,
  },
  {
    factor_id: 'fac_ad_spend',
    factor_label: 'Paid Advertising Budget',
    influence_score: 0.145,
    sensitivity_score: 0,
  },
]

const EXPECTED_INFLUENCE: Record<string, number> = {
  fac_marketing_expertise: 1,
  fac_market_receptivity: 0.62,
  fac_founder_time: 0.48,
  fac_personnel_cost: 0.45,
  fac_ad_spend: 0.145,
}

/** V5-canonical CEE turn response shape (trimmed from the real bundle). */
function makeV5CeeResponse(): Record<string, unknown> {
  return {
    response_version: 'v1',
    assistant_text: 'Analysis complete.',
    blocks: [
      {
        type: 'analysis_result',
        summary: 'Hire performs best',
        leading_option_id: 'opt_hire',
        enrichment: {
          factor_sensitivity: EMBEDDED_FACTOR_SENSITIVITY,
          option_comparison: [
            { option_id: 'opt_hire', option_label: 'Hire', win_probability: 0.85 },
          ],
        },
      },
    ],
  }
}

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

function makeState(overrides: Partial<MockCanvasState> = {}): MockCanvasState {
  return {
    nodes: makeFactorNodes(),
    edges: [],
    rawV2Response: null, // V5-canonical: applyV5State nulls this explicitly
    results: { status: 'complete', report: { option_probabilities: {} } },
    ceeAnalysisReady: { status: 'ready' },
    currentScenarioId: null,
    v5AnalysisFact: null,
    goalConstraints: [],
    graphEditedSinceLastRun: false,
    ...overrides,
  }
}

describe('captureDisplayState — V5-canonical embedded factor join', () => {
  beforeEach(() => {
    mockState = makeState()
  })

  it('honest-missing baseline: rawV2Response null and no embedded source → all unmatched', async () => {
    const result = await captureDisplayState()
    expect(result.rendered_factors).toHaveLength(5)
    for (const f of result.rendered_factors ?? []) {
      expect(f.influence_displayed).toBeNull()
      expect(f.influence_source).toBe('unmatched')
      expect(f.sensitivity_displayed).toBeNull()
      expect(f.sensitivity_source).toBe('unmatched')
    }
  })

  it('GREEN: embedded entries join by factor_id with cee_embedded provenance', async () => {
    const result = await captureDisplayState(EMBEDDED_FACTOR_SENSITIVITY)
    expect(result.rendered_factors).toHaveLength(5)
    for (const f of result.rendered_factors ?? []) {
      expect(f.influence_displayed).toBe(EXPECTED_INFLUENCE[f.id])
      expect(f.influence_source).toBe(
        'cee_embedded.analysis_result.enrichment.factor_sensitivity.influence_score',
      )
      expect(f.sensitivity_source).toBe(
        'cee_embedded.analysis_result.enrichment.factor_sensitivity.sensitivity_score',
      )
    }
    // Signed sensitivity passes through untransformed (UI renders, never invents).
    const founderTime = result.rendered_factors?.find((f) => f.id === 'fac_founder_time')
    expect(founderTime?.sensitivity_displayed).toBe(-0.15)
  })

  it('precedence: a populated store rawV2Response beats the embedded fallback', async () => {
    mockState = makeState({
      rawV2Response: {
        factor_sensitivity: [
          {
            factor_id: 'fac_ad_spend',
            factor_label: 'Paid Advertising Budget',
            influence_score: 0.99,
            sensitivity_score: 0.5,
          },
        ],
      },
    })
    const result = await captureDisplayState(EMBEDDED_FACTOR_SENSITIVITY)
    const adSpend = result.rendered_factors?.find((f) => f.id === 'fac_ad_spend')
    expect(adSpend?.influence_displayed).toBe(0.99)
    expect(adSpend?.influence_source).toBe(
      'payloads.plot_response.factor_sensitivity.influence_score',
    )
    // Entries NOT in the raw wire stay honestly unmatched — no cross-source merge.
    const expertise = result.rendered_factors?.find((f) => f.id === 'fac_marketing_expertise')
    expect(expertise?.influence_source).toBe('unmatched')
  })
})

describe('buildDebugBundleAsync — end-to-end factor join from CEE-embedded enrichment', () => {
  beforeEach(() => {
    mockState = makeState()
  })

  it('RED→GREEN: V5-canonical bundle (plot_response null, enrichment in cee_response.blocks[0]) joins all five factors', async () => {
    const data = makeDebugData({
      payloads: {
        cee_request: { message: 'run analysis' },
        cee_response: makeV5CeeResponse(),
        plot_request: null,
        plot_response: null, // always null on the V5-canonical path
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const factors = bundle.display_state?.rendered_factors ?? []
    expect(factors).toHaveLength(5)
    for (const f of factors) {
      expect(f.influence_displayed).toBe(EXPECTED_INFLUENCE[f.id])
      expect(f.influence_source).toBe(
        'cee_embedded.analysis_result.enrichment.factor_sensitivity.influence_score',
      )
      expect(f.sensitivity_source).toBe(
        'cee_embedded.analysis_result.enrichment.factor_sensitivity.sensitivity_score',
      )
    }
  })

  it('stays honest when the CEE response carries no analysis_result block', async () => {
    const data = makeDebugData({
      payloads: {
        cee_request: { message: 'hello' },
        cee_response: { response_version: 'v1', assistant_text: 'hi', blocks: [] },
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const factors = bundle.display_state?.rendered_factors ?? []
    expect(factors).toHaveLength(5)
    for (const f of factors) {
      expect(f.influence_displayed).toBeNull()
      expect(f.influence_source).toBe('unmatched')
    }
  })
})
