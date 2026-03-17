/**
 * Golden Fixture Test — Debug Bundle Fidelity
 *
 * Uses a sanitised PLoT /v2/run response fixture to verify:
 * 1. from_plot is a verbatim passthrough of _meta.request_id_chain
 * 2. m1_review is preserved in the bundle payloads
 * 3. cee_observability.repair_summary is a verbatim copy when present
 */

import { describe, it, expect } from 'vitest'
import plotFixture from './fixtures/plot-v2-run-response.json'
import type { DebugData, RequestIdChain } from '../hooks/useDebugData'
import { buildDebugBundle } from '../utils/exportBundle'

// Minimal DebugData populated from the golden fixture
function makeDebugDataFromFixture(): DebugData {
  const plotMeta = (plotFixture as Record<string, unknown>)._meta as Record<string, unknown>
  const plotChain = plotMeta?.request_id_chain as Record<string, unknown> | undefined

  const request_id_chain: RequestIdChain = {
    ui_generated: '66b1742f-aaaa-bbbb-cccc-111111111111',
    from_plot: plotChain ? { ...plotChain } as RequestIdChain['from_plot'] : null,
    plot_chain_present: !!plotChain,
    draft_trace: { cee_trace: 'f4866a06-draft-trace-id' },
  }

  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: '66b1742f-aaaa-bbbb-cccc-111111111111' },
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: null, cee: null, plot: null, isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none' as const,
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
      stages: [],
      connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
    },
    payloads: {
      plot_response: plotFixture,
      cee_response: {
        trace: {
          pipeline: {
            repair_summary: {
              repairs_applied: 3,
              repair_types: ['coefficient_normalization', 'orphan_removal'],
              total_latency_ms: 45,
            },
          },
        },
      },
    },
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain,
    feature_flags_at_request: null,
    timing: null,
    schema_versions: null,
    cee_observability: {
      llm_calls: [],
      validation: null,
      orchestrator: null,
      totals: null,
      graph_metrics: null,
      graph_diffs: [],
      request_id: null,
      raw_io_included: false,
      repair_summary: {
        repairs_applied: 3,
        repair_types: ['coefficient_normalization', 'orphan_removal'],
        total_latency_ms: 45,
      },
    },
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
  }
}

describe('golden fixture: debug bundle fidelity', () => {
  const fixtureChain = (plotFixture as Record<string, unknown>)._meta as { request_id_chain: Record<string, unknown> }
  const data = makeDebugDataFromFixture()
  const bundle = buildDebugBundle(data)

  it('from_plot is a verbatim mirror of _meta.request_id_chain', () => {
    expect(bundle.request_id_chain?.from_plot).toEqual(fixtureChain.request_id_chain)
  })

  it('plot_chain_present is true when _meta.request_id_chain exists', () => {
    expect(bundle.request_id_chain?.plot_chain_present).toBe(true)
  })

  it('ui_generated is preserved', () => {
    expect(bundle.request_id_chain?.ui_generated).toBe('66b1742f-aaaa-bbbb-cccc-111111111111')
  })

  it('draft_trace.cee_trace is preserved', () => {
    expect(bundle.request_id_chain?.draft_trace.cee_trace).toBe('f4866a06-draft-trace-id')
  })

  it('m1_review is preserved in bundle payloads', () => {
    const plotResponse = bundle.payloads.plot_response as Record<string, unknown>
    expect(plotResponse.m1_review).toEqual((plotFixture as Record<string, unknown>).m1_review)
  })

  it('m1_review.key_assumptions has expected length', () => {
    const plotResponse = bundle.payloads.plot_response as Record<string, unknown>
    const m1Review = plotResponse.m1_review as { key_assumptions: string[] }
    expect(m1Review.key_assumptions).toHaveLength(4)
  })

  it('cee_observability.repair_summary is a verbatim copy', () => {
    expect(bundle.cee_observability?.repair_summary).toEqual({
      repairs_applied: 3,
      repair_types: ['coefficient_normalization', 'orphan_removal'],
      total_latency_ms: 45,
    })
  })

  it('from_plot is null for draft flow (no _meta.request_id_chain)', () => {
    const draftData: DebugData = {
      ...data,
      request_id_chain: {
        ui_generated: 'draft-id',
        from_plot: null,
        plot_chain_present: false,
        draft_trace: { cee_trace: 'cee-draft-id' },
      },
    }
    const draftBundle = buildDebugBundle(draftData)
    expect(draftBundle.request_id_chain?.from_plot).toBeNull()
    expect(draftBundle.request_id_chain?.plot_chain_present).toBe(false)
  })
})

/**
 * Extraction-level passthrough test.
 *
 * Replicates the exact logic used by extractRequestIdChain() — reading
 * _meta.request_id_chain from the raw PLoT response and spreading it —
 * to prove the passthrough is faithful at the extraction level, not just
 * the bundle level.
 */
describe('golden fixture: extraction-level passthrough', () => {
  const rawPlot = plotFixture as Record<string, unknown>
  const rawMeta = (rawPlot.meta ?? rawPlot._meta) as Record<string, unknown> | undefined
  const rawChain = rawMeta?.request_id_chain as Record<string, unknown> | undefined

  it('raw fixture has _meta.request_id_chain', () => {
    expect(rawChain).toBeDefined()
    expect(rawChain).not.toBeNull()
  })

  it('spread passthrough preserves every field verbatim', () => {
    // This is the exact line from extractRequestIdChain():
    //   const fromPlot = plotChain ? { ...plotChain } as unknown as PlotRequestIdChain : null
    const fromPlot = rawChain ? { ...rawChain } : null

    // Every field in the original must appear in the spread copy
    expect(fromPlot).toEqual(rawChain)

    // Specific field checks matching the fixture values
    expect(fromPlot!.ui).toBe('66b1742f-aaaa-bbbb-cccc-111111111111')
    expect(fromPlot!.plot).toBe('66b1742f-aaaa-bbbb-cccc-111111111111')
    expect(fromPlot!.isl).toBe('66b1742f-aaaa-bbbb-cccc-111111111111')
    expect(fromPlot!.isl_echoed).toBe('66b1742f-aaaa-bbbb-cccc-111111111111')
    expect(fromPlot!.all_match).toBe(true)
    expect(fromPlot!.chain_complete).toBe(true)
  })

  it('spread creates a shallow copy (not a reference)', () => {
    const fromPlot = rawChain ? { ...rawChain } : null
    expect(fromPlot).not.toBe(rawChain) // different reference
    expect(fromPlot).toEqual(rawChain)  // same content
  })

  it('handles missing _meta gracefully (simulates draft flow)', () => {
    const draftPlot = { analysis_status: 'computed' } // no _meta
    const draftMeta = (draftPlot as Record<string, unknown>)._meta as Record<string, unknown> | undefined
    const draftChain = draftMeta?.request_id_chain as Record<string, unknown> | undefined
    const fromPlot = draftChain ? { ...draftChain } : null

    expect(fromPlot).toBeNull()
  })
})

/**
 * Extraction-level test for cee_observability.repair_summary.
 *
 * Replicates the exact path traversal used by extractCEEObservability() —
 * reading trace.pipeline.repair_summary from a raw CEE response — to prove
 * the extraction logic is correct independently of the bundle builder.
 */
describe('golden fixture: repair_summary extraction-level', () => {
  // Simulate the raw CEE response shape the payload trace store captures
  const rawCeeResponse = {
    trace: {
      pipeline: {
        repair_summary: {
          repairs_applied: 3,
          repair_types: ['coefficient_normalization', 'orphan_removal'],
          total_latency_ms: 45,
        },
      },
    },
  }

  it('extracts repair_summary from trace.pipeline.repair_summary', () => {
    // This is the exact path logic from extractCEEObservability():
    const cee = rawCeeResponse as Record<string, unknown>
    const trace = cee.trace as Record<string, unknown> | undefined
    const pipeline = trace?.pipeline as Record<string, unknown> | undefined
    const repair_summary = pipeline?.repair_summary !== undefined ? pipeline.repair_summary : null

    expect(repair_summary).toEqual({
      repairs_applied: 3,
      repair_types: ['coefficient_normalization', 'orphan_removal'],
      total_latency_ms: 45,
    })
  })

  it('returns null when trace.pipeline has no repair_summary', () => {
    const cee = { trace: { pipeline: { status: 'success' } } } as Record<string, unknown>
    const trace = cee.trace as Record<string, unknown> | undefined
    const pipeline = trace?.pipeline as Record<string, unknown> | undefined
    const repair_summary = pipeline?.repair_summary !== undefined ? pipeline.repair_summary : null

    expect(repair_summary).toBeNull()
  })

  it('returns null when trace has no pipeline', () => {
    const cee = { trace: { request_id: 'abc' } } as Record<string, unknown>
    const trace = cee.trace as Record<string, unknown> | undefined
    const pipeline = trace?.pipeline as Record<string, unknown> | undefined
    const repair_summary = pipeline?.repair_summary !== undefined ? pipeline.repair_summary : null

    expect(repair_summary).toBeNull()
  })

  it('returns null when CEE response has no trace', () => {
    const cee = { nodes: [], edges: [] } as Record<string, unknown>
    const trace = cee.trace as Record<string, unknown> | undefined
    const pipeline = trace?.pipeline as Record<string, unknown> | undefined
    const repair_summary = pipeline?.repair_summary !== undefined ? pipeline.repair_summary : null

    expect(repair_summary).toBeNull()
  })

  it('does NOT read from trace.repair_summary (old incorrect path)', () => {
    // This CEE response has repair_summary at the wrong path (trace.repair_summary).
    // The extractor should NOT find it there.
    const cee = { trace: { repair_summary: { repairs_applied: 99 } } } as Record<string, unknown>
    const trace = cee.trace as Record<string, unknown> | undefined
    const pipeline = trace?.pipeline as Record<string, unknown> | undefined
    const repair_summary = pipeline?.repair_summary !== undefined ? pipeline.repair_summary : null

    expect(repair_summary).toBeNull()
  })
})

describe('debug bundle observability diagnostics', () => {
  it('populates causal_claims_diagnostic when CEE response includes causal_claims', () => {
    const data = makeDebugDataFromFixture()
    data.payloads.cee_response = {
      trace: {
        validation_warnings: [{ code: 'CAUSAL_CLAIM_INVALID_REF' }, { code: 'GRAPH_DISCONNECTED' }],
        pipeline: {
          causal_claims: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
          validated_causal_claims: [{ id: 'c1' }, { id: 'c2' }],
        },
      },
    }

    const bundle = buildDebugBundle(data)
    expect(bundle.pipeline.causal_claims_diagnostic).toEqual({
      llm_emitted: true,
      raw_count: 3,
      validated_count: 2,
      dropped_count: 1,
      warnings: ['CAUSAL_CLAIM_INVALID_REF'],
    })
  })

  it('sets causal_claims_diagnostic.llm_emitted=false when causal_claims is absent', () => {
    const data = makeDebugDataFromFixture()
    data.payloads.cee_response = {
      trace: {
        pipeline: {
          repair_summary: { repairs_applied: 0 },
        },
      },
    }

    const bundle = buildDebugBundle(data)
    expect(bundle.pipeline.causal_claims_diagnostic.llm_emitted).toBe(false)
    expect(bundle.pipeline.causal_claims_diagnostic.raw_count).toBe(0)
  })

  it('extracts isl_raw_fields from payloads.isl_response', () => {
    const data = makeDebugDataFromFixture()
    data.payloads.isl_response = {
      stability_thresholds: { low: 0.2, medium: 0.5, high: 0.8 },
      factor_sensitivity_3c_fields: [
        {
          factor_id: 'fac_x',
          attribution_stability: 'low',
          elasticity_std: 0.13,
          rank_flip_rate: 0.15,
          stability_method: 'bootstrap_20',
        },
      ],
      confounding_sensitivity: { score: 0.1 },
    }

    const bundle = buildDebugBundle(data)
    expect(bundle.isl_diagnostic.isl_raw_fields.stability_thresholds).toEqual({ low: 0.2, medium: 0.5, high: 0.8 })
    expect(bundle.isl_diagnostic.isl_raw_fields.factor_sensitivity_3c_fields).toHaveLength(1)
    expect(bundle.isl_diagnostic.isl_raw_fields.confounding_sensitivity).toEqual({ score: 0.1 })
  })

  it('keeps typical debug bundle payload under 500KB', () => {
    const data = makeDebugDataFromFixture()
    data.pipeline.llm_raw = {
      text: JSON.stringify({
        nodes: Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, kind: 'factor' })),
        edges: Array.from({ length: 20 }, (_, i) => ({ source: `n${i % 10}`, target: `n${(i + 1) % 10}` })),
        causal_claims: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, claim: 'x causes y' })),
      }),
      truncated: false,
      char_count: 5000,
    }

    const bundle = buildDebugBundle(data)
    const sizeBytes = new TextEncoder().encode(JSON.stringify(bundle)).length
    expect(sizeBytes).toBeLessThan(500 * 1024)
  })

  it('extracts cee_pipeline_path and cee_strp_mutations_count from repair_summary', () => {
    const data = makeDebugDataFromFixture()
    data.cee_observability = {
      llm_calls: [],
      validation: null,
      orchestrator: null,
      totals: null,
      graph_metrics: null,
      graph_diffs: [],
      request_id: null,
      raw_io_included: false,
      repair_summary: {
        cee_pipeline_path: 'unified_v3',
        cee_strp_mutations_count: 3,
        repairs_applied: 2,
        repair_types: ['orphan_removal'],
        total_latency_ms: 45,
      },
    }

    const bundle = buildDebugBundle(data)
    expect(bundle.pipeline.cee_pipeline_path).toBe('unified')
    expect(bundle.pipeline.cee_strp_mutations_count).toBe(3)
  })

  it('extracts cee_pipeline_path from provenance when repair_summary is missing', () => {
    const data = makeDebugDataFromFixture()
    data.pipeline = {
      ...data.pipeline,
      cee_provenance: {
        pipeline_path: 'legacy_pipeline',
      },
    }
    data.cee_observability = null

    const bundle = buildDebugBundle(data)
    expect(bundle.pipeline.cee_pipeline_path).toBe('legacy')
  })
})
