/**
 * D1–D8 fixture replay — locks the corrected diagnostic_checks, schema_versions
 * and v12_4_checks signals against the two reference bundles supplied with
 * audit follow-up brief `claude-ui/diagnostic-check-and-rendering-fixes`
 * (50b336a6, a4b32ee2 — captured 2026-05-10).
 *
 * Snapshot intent: exact corrected values, not "non-null" smoke. Values were
 * verified by direct inspection of the pre-fix bundles (see brief working log).
 * If staging data shifts, update the assertions deliberately rather than
 * weakening to non-null.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  extractDiagnosticChecks,
  extractSchemaVersions,
  extractV12_4Checks,
  isBootstrapConfidenceSource,
  isPlotUnifiedFormulaVersion,
} from '../hooks/useDebugData'

// Mock canvas store at module top for the D8 + fallback replays below.
// The pure-extractor tests in this file do not touch the store, so this mock
// is a no-op for them. captureDisplayState (used in the D8 replay describe)
// reads from getState() — the test populates `displayStateMockState` before
// each captureDisplayState invocation.
interface DisplayStateMockState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: { status: string | null; report?: unknown; apiResponse?: Record<string, unknown> } | null
  ceeAnalysisReady: { status?: string } | null
  graphEditedSinceLastRun: boolean
  showResultsPanel?: boolean
  showInspectorPanel?: boolean
  showDraftChat?: boolean
}
let displayStateMockState: DisplayStateMockState | undefined
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => displayStateMockState },
}))

// JSON fixtures — copies of ~/Downloads/olumi-debug-{50b336a6,a4b32ee2}-20260510.json,
// saved into the repo with `.pre-fix` suffix as regression baselines.
import bundle50b336a6 from './fixtures/staging-bundles/olumi-debug-50b336a6-20260510.pre-fix.json'
import bundleA4b32ee2 from './fixtures/staging-bundles/olumi-debug-a4b32ee2-20260510.pre-fix.json'

type Bundle = {
  payloads: {
    cee_request: unknown
    cee_response: unknown
    plot_request: unknown
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  }
}

function diagnosticsFor(bundle: Bundle) {
  const { payloads } = bundle
  // islDataSource is metadata; for replay against captured bundles the brief
  // does not require us to re-derive it from raw inputs.
  return extractDiagnosticChecks(
    payloads.plot_response,
    payloads.cee_response,
    payloads.isl_response,
    'downstream_calls',
  )
}

function schemaVersionsFor(bundle: Bundle) {
  const { payloads } = bundle
  return extractSchemaVersions(
    payloads.cee_request,
    payloads.cee_response,
    payloads.plot_request,
    payloads.plot_response,
    payloads.isl_request,
    payloads.isl_response,
  )
}

describe('Fixture replay: pre-fix staging bundles (D1-D8)', () => {
  describe('Bundle 50b336a6 — marketing graph (4 factors, 3 options)', () => {
    const b = bundle50b336a6 as Bundle

    it('D1: confidence_source_bootstrap is true (post-A1 plot_unified_from_isl_bootstrap)', () => {
      const dc = diagnosticsFor(b)
      expect(dc.confidence_source_bootstrap).toBe(true)
    })

    it('D2: factor_confidence_unique_values is [0.25, 0.375] and differentiated', () => {
      const dc = diagnosticsFor(b)
      expect(dc.factor_confidence_unique_values).toEqual([0.25, 0.375])
      expect(dc.factor_confidence_differentiated).toBe(true)
    })

    it('D2 (legacy): existing edge-derived confidence_* fields are sourced separately', () => {
      const dc = diagnosticsFor(b)
      // Harness limitation declared upfront, then exact value asserted: this
      // replay deliberately does not plumb canvasEdges into extractDiagnosticChecks
      // (the bundle's edges are captured separately in `full_graph.edges`, not in
      // a shape the extractor accepts). With no edge source, the edge-probability
      // collector produces an EMPTY set — exactly `[]`. That exact-value check
      // is stronger than the prior `not.toEqual(factor_*)` because it would catch
      // any future change that silently aliases the legacy collector onto the
      // factor source. The contract under test: edge-derived and factor-derived
      // fields draw from DIFFERENT sources; harness with empty edges → [].
      expect(dc.confidence_unique_values).toEqual([])
      expect(dc.confidence_differentiated).toBe(false)
      // Cross-check non-aliasing: factor source must remain populated even when
      // legacy collector is empty — i.e. the two never share an underlying read.
      expect(dc.factor_confidence_unique_values).toEqual([0.25, 0.375])
    })

    it('D3: ISL has edge_e_values via robustness; PLoT public exposes none', () => {
      const dc = diagnosticsFor(b)
      expect(dc.isl_edge_e_values_present).toBe(true)
      expect(dc.plot_edge_e_values_exposed).toBe(false)
      expect(dc.ui_edge_e_values_available).toBe(false)
      // Legacy alias = ui_edge_e_values_available (the surface UI depends on).
      expect(dc.e_values_present).toBe(false)
    })

    it('D6: schema_versions tri-state is unknown when all six versions are null', () => {
      const sv = schemaVersionsFor(b)
      // Bundle has no schema_version fields populated → status unknown, consistent null
      expect(sv).not.toBeNull()
      expect(sv!.consistency_status).toBe('unknown')
      expect(sv!.consistent).toBeNull()
      expect(sv!.unknown_reason).toBe('missing_schema_versions')
    })

    it('D7: v12_4_checks emits named not_collected state (not bare null)', () => {
      const v = extractV12_4Checks(b.payloads.cee_response)
      // Reason depends on CEE shape — these bundles lack factor nodes with
      // category data, so the producer never reaches the collected branch.
      expect(v.status).toBe('not_collected')
      if (v.status === 'not_collected') {
        expect(['cee_response_missing', 'cee_nodes_missing', 'no_factor_nodes']).toContain(v.reason)
      }
    })
  })

  describe('Bundle a4b32ee2 — engineering hire graph (4 factors, options)', () => {
    const b = bundleA4b32ee2 as Bundle

    it('D1: confidence_source_bootstrap is true', () => {
      const dc = diagnosticsFor(b)
      expect(dc.confidence_source_bootstrap).toBe(true)
    })

    it('D2: factor_confidence_unique_values includes 0.25 AND 0.375', () => {
      const dc = diagnosticsFor(b)
      expect(dc.factor_confidence_unique_values).toContain(0.25)
      expect(dc.factor_confidence_unique_values).toContain(0.375)
      expect(dc.factor_confidence_differentiated).toBe(true)
    })

    it('D3: ISL emits edge_e_values via robustness; PLoT public does not propagate', () => {
      const dc = diagnosticsFor(b)
      expect(dc.isl_edge_e_values_present).toBe(true)
      expect(dc.plot_edge_e_values_exposed).toBe(false)
      expect(dc.ui_edge_e_values_available).toBe(false)
    })

    it('D6: schema_versions consistency_status is unknown (all six null)', () => {
      const sv = schemaVersionsFor(b)
      expect(sv).not.toBeNull()
      expect(sv!.consistency_status).toBe('unknown')
      expect(sv!.consistent).toBeNull()
    })

    it('D7: v12_4_checks emits named not_collected state', () => {
      const v = extractV12_4Checks(b.payloads.cee_response)
      expect(v.status).toBe('not_collected')
    })
  })
})

describe('D1: forward-compat family recognisers', () => {
  it('isBootstrapConfidenceSource accepts the legacy literal and the post-A1 family', () => {
    expect(isBootstrapConfidenceSource('bootstrap_sampling')).toBe(true)
    expect(isBootstrapConfidenceSource('plot_unified_from_isl_bootstrap')).toBe(true)
    expect(isBootstrapConfidenceSource('plot_unified_from_graph')).toBe(true)
    expect(isBootstrapConfidenceSource('plot_unified_from_future_path_xyz_123')).toBe(true)
  })

  it('isBootstrapConfidenceSource rejects unrelated strings and non-strings', () => {
    expect(isBootstrapConfidenceSource('isl')).toBe(false)
    expect(isBootstrapConfidenceSource('fallback_degenerate')).toBe(false)
    expect(isBootstrapConfidenceSource('plot_unified_v2')).toBe(false) // formula_version namespace, not confidence_source
    expect(isBootstrapConfidenceSource(null)).toBe(false)
    expect(isBootstrapConfidenceSource(undefined)).toBe(false)
    expect(isBootstrapConfidenceSource(123)).toBe(false)
    expect(isBootstrapConfidenceSource('')).toBe(false)
  })

  it('isPlotUnifiedFormulaVersion accepts the v\\d+ family only', () => {
    expect(isPlotUnifiedFormulaVersion('plot_unified_v2')).toBe(true)
    expect(isPlotUnifiedFormulaVersion('plot_unified_v3')).toBe(true)
    expect(isPlotUnifiedFormulaVersion('plot_unified_v99')).toBe(true)
    expect(isPlotUnifiedFormulaVersion('plot_unified_from_isl_bootstrap')).toBe(false)
    expect(isPlotUnifiedFormulaVersion('plot_unified_vX')).toBe(false)
    expect(isPlotUnifiedFormulaVersion(null)).toBe(false)
  })
})

describe('D6: schema_versions edge cases', () => {
  it('returns null when ALL six version fields are unrecoverable (empty input bundle)', () => {
    // Historical behaviour: bundle field stays null when there were no payloads at all.
    expect(extractSchemaVersions(null, null, null, null, null, null)).toBeNull()
  })

  it('reports matched when all six are populated and equal', () => {
    const v = { schema_version: 'v3' }
    const sv = extractSchemaVersions(v, v, v, v, v, v)
    expect(sv!.consistency_status).toBe('matched')
    expect(sv!.consistent).toBe(true)
  })

  it('reports mismatched when all six are populated but differ', () => {
    const sv = extractSchemaVersions(
      { schema_version: 'v3' },
      { schema_version: 'v3' },
      { schema_version: 'v3' },
      { schema_version: 'v4' }, // odd one out
      { schema_version: 'v3' },
      { schema_version: 'v3' },
    )
    expect(sv!.consistency_status).toBe('mismatched')
    expect(sv!.consistent).toBe(false)
  })

  it('reports unknown when partial — even when present values would have been equal', () => {
    const sv = extractSchemaVersions(
      { schema_version: 'v3' },
      { schema_version: 'v3' },
      { schema_version: 'v3' },
      { schema_version: 'v3' },
      null, // missing — formerly a silent false positive
      null,
    )
    expect(sv!.consistency_status).toBe('unknown')
    expect(sv!.consistent).toBeNull()
    expect(sv!.unknown_reason).toBe('missing_schema_versions')
  })
})

describe('D7: v12_4_checks named states', () => {
  it('returns cee_response_missing when input is null', () => {
    const v = extractV12_4Checks(null)
    expect(v.status).toBe('not_collected')
    if (v.status === 'not_collected') {
      expect(v.reason).toBe('cee_response_missing')
    }
  })

  it('returns cee_nodes_missing when nodes path is absent', () => {
    const v = extractV12_4Checks({ unrelated: true })
    expect(v.status).toBe('not_collected')
    if (v.status === 'not_collected') {
      expect(v.reason).toBe('cee_nodes_missing')
    }
  })

  it('returns no_factor_nodes when nodes exist but none are factors', () => {
    const v = extractV12_4Checks({ nodes: [{ id: 'o1', kind: 'option' }] })
    expect(v.status).toBe('not_collected')
    if (v.status === 'not_collected') {
      expect(v.reason).toBe('no_factor_nodes')
    }
  })

  it('returns the collected shape when factors carry category', () => {
    const v = extractV12_4Checks({
      nodes: [
        { id: 'f1', kind: 'factor', category: 'controllable' },
        { id: 'f2', kind: 'factor' },
      ],
    })
    expect(v.status).toBe('collected')
    if (v.status === 'collected') {
      expect(v.category_field_present).toBe(true)
      expect(v.nodes_with_category).toEqual(['f1'])
      expect(v.nodes_missing_category).toEqual(['f2'])
      expect(v.category_values).toEqual({ f1: 'controllable' })
    }
  })
})

describe('D8: rank_displayed deterministic tie-handling (synthetic)', () => {
  // captureDisplayState is async and pulls from the canvas store; covered
  // separately in displayState.spec.ts. This block locks the contract for
  // tie-handling shape using a synthetic resolver mirroring the production
  // sort (OptionCards.tsx:506-513 — see commit 953c60b2 for the capture-time
  // mirror in exportBundle.ts).
  it('equal win_probability sorts by option_id ascending — deterministic export', () => {
    const resolved = [
      { id: 'opt_b', optionId: 'opt_b', winProbability: 0.5 },
      { id: 'opt_a', optionId: 'opt_a', winProbability: 0.5 },
      { id: 'opt_c', optionId: 'opt_c', winProbability: 0.5 },
    ]
    const sorted = [...resolved].sort((a, b) => {
      const delta = (b.winProbability ?? -Infinity) - (a.winProbability ?? -Infinity)
      if (delta !== 0) return delta
      const idA = a.optionId ?? a.id ?? ''
      const idB = b.optionId ?? b.id ?? ''
      return idA < idB ? -1 : idA > idB ? 1 : 0
    })
    // Tie-break: opt_a < opt_b < opt_c alphabetically
    expect(sorted.map((r) => r.optionId)).toEqual(['opt_a', 'opt_b', 'opt_c'])
  })
})

// =============================================================================
// captureDisplayState replays — exercise the real export code path with a
// canvas-store mock built from the staging fixture. These tests replace the
// previous synthetic-only D8 coverage with a real-fixture rank assertion
// (brief revision item 7), and add coverage for the option_probabilities
// tertiary fallback (improvement #1 from review).
// =============================================================================

interface StagingFactor {
  id: string
  label: string
  kind: string
  observed_state?: unknown
}
interface StagingOption {
  id: string
  label: string
  kind: string
  observed_state?: unknown
}
interface StagingBundle {
  full_graph: { factors: StagingFactor[]; options: StagingOption[]; edges: unknown[] }
  payloads: { plot_response: Record<string, unknown> | null }
}

function mockStateFromBundle(
  bundle: StagingBundle,
  overrides: Partial<{ apiResponseOverride: Record<string, unknown> }> = {},
): DisplayStateMockState {
  const factorNodes = bundle.full_graph.factors
    .filter((f) => f.kind === 'factor')
    .map((f) => ({
      id: f.id,
      data: { label: f.label, kind: 'factor', type: 'factor', observedState: f.observed_state ?? null },
    }))
  const optionNodes = bundle.full_graph.options.map((o) => ({
    id: o.id,
    data: { label: o.label, kind: 'option', type: 'option', observedState: o.observed_state ?? null },
  }))
  const plotResponse = bundle.payloads.plot_response ?? {}
  const apiResponse = overrides.apiResponseOverride ?? {
    option_comparison: plotResponse.option_comparison ?? [],
    options: plotResponse.options ?? [],
    factor_sensitivity: plotResponse.factor_sensitivity ?? [],
  }
  return {
    nodes: [...factorNodes, ...optionNodes],
    edges: (bundle.full_graph.edges ?? []).map((_e, i) => ({ id: `e_${i}` })),
    results: { status: 'complete', report: { option_comparison: apiResponse.option_comparison }, apiResponse },
    ceeAnalysisReady: { status: 'ready' },
    graphEditedSinceLastRun: false,
    showResultsPanel: true,
  }
}

describe('D8: rank_displayed real-fixture replay (brief revision item 7)', () => {
  // Exact requirement: bundle 50b336a6 has opt_hire_manager (win_prob ~0.914)
  // ranked 1 and opt_ai_tool (~0.067) last. Production OptionCards.tsx sorts
  // by win_probability descending, so capture must do the same.
  it('50b336a6: full rank ordering by win_probability desc — opt_hire_manager=1, opt_status_quo=last', async () => {
    displayStateMockState = mockStateFromBundle(bundle50b336a6 as unknown as StagingBundle)
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBe(4)
    const byId = new Map(rendered.map((r) => [r.id, r]))
    // Win probabilities in this bundle: opt_hire_manager 0.91425, opt_ai_tool 0.06725,
    // opt_hybrid 0.01425, opt_status_quo 0.00425. Brief revision item 7 asserted
    // opt_ai_tool was "last" — that was a data inaccuracy in the brief; opt_ai_tool
    // is rank 2, opt_status_quo is rank 4 (last). Test pins the actual ordering.
    expect(byId.get('opt_hire_manager')?.rank_displayed).toBe(1)
    expect(byId.get('opt_ai_tool')?.rank_displayed).toBe(2)
    expect(byId.get('opt_hybrid')?.rank_displayed).toBe(3)
    expect(byId.get('opt_status_quo')?.rank_displayed).toBe(4)
    // Provenance: every rank source must be analytical (all four options have win_probability)
    for (const r of rendered) {
      expect(r.rank_source).toBe('win_probability_desc')
    }
    // Monotonic descending win_probability across sorted ranks
    const sortedByRank = [...rendered].sort((a, b) => (a.rank_displayed ?? 0) - (b.rank_displayed ?? 0))
    for (let i = 1; i < sortedByRank.length; i++) {
      const prev = sortedByRank[i - 1].win_probability_displayed ?? -Infinity
      const cur = sortedByRank[i].win_probability_displayed ?? -Infinity
      expect(prev).toBeGreaterThanOrEqual(cur)
    }
  })

  it('a4b32ee2: top-ranked option (highest win_probability) has rank_displayed === 1', async () => {
    displayStateMockState = mockStateFromBundle(bundleA4b32ee2 as unknown as StagingBundle)
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBeGreaterThan(0)
    // The top-ranked option must be the one with the highest win_probability.
    const top = rendered.find((r) => r.rank_displayed === 1)!
    const maxWp = rendered.reduce(
      (m, r) => Math.max(m, r.win_probability_displayed ?? -Infinity),
      -Infinity,
    )
    expect(top.win_probability_displayed).toBe(maxWp)
  })
})

describe('D5: option_probabilities tertiary-fallback replay (improvement #1)', () => {
  // Reshape bundle 50b336a6's apiResponse so neither option_comparison nor
  // options is present — only option_probabilities[node_id] is populated.
  // The capture must still resolve win_probability via the third path, with
  // win_probability_source = 'payloads.plot_response.option_probabilities.win_probability'.
  // Without this fallback the capture would mark every option 'unmatched' and
  // rank_source would collapse to 'canvas_order' — a real regression risk
  // when PLoT shapes data into the node-id map shape instead of the array
  // shapes the UI hook reads via recommendation.allOptions.
  it('uses option_probabilities[node_id].win_probability when arrays are absent', async () => {
    const b = bundle50b336a6 as unknown as StagingBundle
    const oc = (b.payloads.plot_response?.option_comparison as Array<Record<string, unknown>>) ?? []
    // Build option_probabilities map from the same data the bundle provides
    // under option_comparison, then strip the array fields entirely.
    const optionProbabilities: Record<string, Record<string, number>> = {}
    for (const o of oc) {
      if (typeof o.option_id === 'string' && typeof o.win_probability === 'number') {
        optionProbabilities[o.option_id] = { win_probability: o.win_probability }
      }
    }
    displayStateMockState = mockStateFromBundle(b, {
      apiResponseOverride: {
        option_comparison: [],
        options: [],
        option_probabilities: optionProbabilities,
        factor_sensitivity: b.payloads.plot_response?.factor_sensitivity ?? [],
      },
    })
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBe(4)
    // Every option resolves via the third path
    for (const r of rendered) {
      expect(r.win_probability_source).toBe(
        'payloads.plot_response.option_probabilities.win_probability',
      )
      expect(typeof r.win_probability_displayed).toBe('number')
    }
    // Rank is still analytical (all options have win_probability via fallback)
    expect(rendered.every((r) => r.rank_source === 'win_probability_desc')).toBe(true)
    // Same winner as the primary-path replay above
    const top = rendered.find((r) => r.rank_displayed === 1)!
    expect(top.id).toBe('opt_hire_manager')
  })

  it('falls through to unmatched only when ALL three paths are absent', async () => {
    const b = bundle50b336a6 as unknown as StagingBundle
    displayStateMockState = mockStateFromBundle(b, {
      apiResponseOverride: {
        option_comparison: [],
        options: [],
        // No option_probabilities key at all
        factor_sensitivity: b.payloads.plot_response?.factor_sensitivity ?? [],
      },
    })
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBe(4)
    for (const r of rendered) {
      expect(r.win_probability_source).toBe('unmatched')
      expect(r.win_probability_displayed).toBeNull()
    }
    // No analytical rank possible — falls back to canvas order
    expect(rendered.every((r) => r.rank_source === 'canvas_order')).toBe(true)
  })
})
