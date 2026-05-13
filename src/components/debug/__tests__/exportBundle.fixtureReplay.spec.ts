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
//
// Shape mirrors production: raw V2 wire response lives at the canvas-store
// root as `rawV2Response`; the mapper-synthesised report lives at
// `results.report`. The previous mock shape carried a synthetic
// `results.apiResponse` field that does NOT exist on real `ResultsState`
// (canvas/store.ts:170-191) — the export's broken read happened to find data
// only because the mock pre-flattened it there. Real production never
// populates `apiResponse`, so the test infrastructure had been masking the
// D4/D5/D8 bug. The new mock shape proves the export reads from the real
// sources the production canvas-store actually provides.
interface DisplayStateMockState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  rawV2Response: Record<string, unknown> | null
  results: { status: string | null; report?: unknown } | null
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
// canvas-store mock built to match production shape:
//   - state.rawV2Response (canvas-store root) carries the raw V2 PLoT wire
//     response: option_comparison, options (legacy), factor_sensitivity.
//   - state.results.report carries the V4/V5 mapper-synthesised
//     option_probabilities keyed by canvas node ID (the same shape
//     useResultsSectionData.ts:1042 reads for recommendation.allOptions).
// The previous mock helper synthesised a `results.apiResponse` field that does
// not exist on real `ResultsState` (canvas/store.ts:170-191); the export's
// broken read happened to find data only because the mock pre-flattened it.
// Real production never populated that field, so the test infrastructure had
// been masking the D4/D5/D8 production bug — the mock shape below proves the
// export reads from the canonical sources the canvas store actually provides.
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

interface MockOverrides {
  /** Replace rawV2Response wholesale (or set null to simulate "no raw wire"). */
  rawV2ResponseOverride?: Record<string, unknown> | null
  /** Replace results.report wholesale (or set null for "no mapped report"). */
  reportOverride?: Record<string, unknown> | null
}

/**
 * Build a canvas-store mock from a staging bundle. Mirrors the shape the
 * real canvas store populates after a PLoT run:
 *   - `rawV2Response` at root: { option_comparison, options?, factor_sensitivity? }
 *     copied from `bundle.payloads.plot_response` (the bundle captures the
 *     same wire shape under that key).
 *   - `results.report` carrying nothing extra by default; the report-mapped
 *     `option_probabilities` keyed map is populated only via `reportOverride`
 *     so tests targeting the fallback can opt in.
 */
function mockStateFromBundle(
  bundle: StagingBundle,
  overrides: MockOverrides = {},
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
  // Default rawV2Response: pass through the bundle's plot_response wire shape
  // verbatim. The shape matches V2RunResponse fields the export reads
  // (option_comparison, options, factor_sensitivity).
  const rawV2Response = overrides.rawV2ResponseOverride === undefined
    ? {
        option_comparison: plotResponse.option_comparison ?? [],
        options: plotResponse.options ?? [],
        factor_sensitivity: plotResponse.factor_sensitivity ?? [],
      }
    : overrides.rawV2ResponseOverride
  // Default report: empty object (no mapped option_probabilities). Tests
  // exercising the report-only fallback override this explicitly.
  const report = overrides.reportOverride === undefined ? {} : overrides.reportOverride
  return {
    nodes: [...factorNodes, ...optionNodes],
    edges: (bundle.full_graph.edges ?? []).map((_e, i) => ({ id: `e_${i}` })),
    rawV2Response,
    results: { status: 'complete', report },
    ceeAnalysisReady: { status: 'ready' },
    graphEditedSinceLastRun: false,
    showResultsPanel: true,
  }
}

describe('D8: rank_displayed real-fixture replay (brief revision item 7)', () => {
  // Bundle 50b336a6 actual win-probability ordering (verified in test below):
  //   opt_hire_manager  0.91425  →  rank 1
  //   opt_ai_tool       0.06725  →  rank 2
  //   opt_hybrid        0.01425  →  rank 3
  //   opt_status_quo    0.00425  →  rank 4 (last)
  // Production OptionCards.tsx sorts by win_probability descending, so capture
  // must do the same. Brief revision item 7 originally stated opt_ai_tool was
  // "last"; that was a data inaccuracy — see the per-assertion comment below
  // for the full reconciliation.
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

describe('D5: report.option_probabilities tertiary-fallback replay', () => {
  // The tertiary fallback covers the historical-load shape: `rawV2Response`
  // is null (e.g. a Supabase-hydrated run — see canvas/store.ts:2715, 2757)
  // but the mapper-synthesised `report.option_probabilities` keyed map
  // survives. The capture must still resolve win_probability via the third
  // path with the truthful provenance label
  // `results.report.option_probabilities.win_probability` (a different bundle
  // path than the wire arrays — V2RunResponse has no option_probabilities at
  // root, so this label correctly distinguishes "mapped report" from "wire").
  it('uses report.option_probabilities[node_id].win_probability when rawV2Response is null', async () => {
    const b = bundle50b336a6 as unknown as StagingBundle
    const oc = (b.payloads.plot_response?.option_comparison as Array<Record<string, unknown>>) ?? []
    // Build option_probabilities map from the same data the bundle provides
    // under option_comparison — the V4/V5 mapper writes the same map shape.
    const optionProbabilities: Record<string, Record<string, number>> = {}
    for (const o of oc) {
      if (typeof o.option_id === 'string' && typeof o.win_probability === 'number') {
        optionProbabilities[o.option_id] = { win_probability: o.win_probability }
      }
    }
    displayStateMockState = mockStateFromBundle(b, {
      // Simulate "historical load": rawV2Response not available, but a
      // populated report carries the mapper-synthesised keyed map.
      rawV2ResponseOverride: null,
      reportOverride: { option_probabilities: optionProbabilities },
    })
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBe(4)
    // Every option resolves via the third path
    for (const r of rendered) {
      expect(r.win_probability_source).toBe(
        'results.report.option_probabilities.win_probability',
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
      // Wire arrays absent and report carries no option_probabilities map.
      rawV2ResponseOverride: { option_comparison: [], options: [], factor_sensitivity: [] },
      reportOverride: {},
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

// =============================================================================
// D4/D5/D8 fix: real-shape regression replay against the minimal redacted
// e33acb92 fixture. This is the bundle that surfaced the production bug
// (every surface unmatched, rank_source canvas_order despite full PLoT data
// being available end-to-end). The fixture preserves the exact failing IDs
// and metric values; user text, prompts, request traces, and unrelated
// payloads were stripped — see the fixture's _meta.removed array.
// =============================================================================

import e33acb92Minimal from './fixtures/staging-bundles/olumi-debug-e33acb92-20260512.minimal.json'

interface MinimalE33Fixture {
  canvas: { nodes: Array<{ id: string; kind: string; label: string; observedState?: unknown }> }
  rawV2Response: {
    option_comparison: Array<{ option_id: string; option_label?: string; win_probability: number }>
    factor_sensitivity: Array<{
      factor_id: string
      factor_label?: string
      influence_score: number
      sensitivity_score: number
      direction?: 'positive' | 'negative'
    }>
    [k: string]: unknown
  }
  report: { option_probabilities: Record<string, { win_probability: number; goal_probability?: number }> }
}

function mockStateFromMinimalE33(
  overrides: MockOverrides = {},
): DisplayStateMockState {
  const fx = e33acb92Minimal as MinimalE33Fixture
  const nodes = fx.canvas.nodes.map((n) => ({
    id: n.id,
    data: {
      label: n.label,
      kind: n.kind,
      type: n.kind,
      observedState: n.observedState ?? null,
    },
  }))
  const rawV2Response = overrides.rawV2ResponseOverride === undefined
    ? (fx.rawV2Response as unknown as Record<string, unknown>)
    : overrides.rawV2ResponseOverride
  const report = overrides.reportOverride === undefined
    ? (fx.report as unknown as Record<string, unknown>)
    : overrides.reportOverride
  return {
    nodes,
    edges: [],
    rawV2Response,
    results: { status: 'complete', report },
    ceeAnalysisReady: { status: 'ready' },
    graphEditedSinceLastRun: false,
    showResultsPanel: true,
  }
}

describe('D4/D5/D8: e33acb92 real-shape regression (production canvas-store shape)', () => {
  // Win-probability ordering in this fixture (from the real bundle):
  //   opt_tech_lead     0.8865   →  rank 1
  //   opt_two_devs      0.1105   →  rank 2
  //   opt_status_quo    0.0025   →  rank 3
  //   opt_one_dev       0.0005   →  rank 4 (smallest)
  // The original bundle shipped every option with win_probability_source =
  // 'unmatched' and rank_source = 'canvas_order' — opt_one_dev got rank 1
  // because it was the lexicographic-first canvas node. Asserting the
  // correct analytical ordering pins the fix.

  it('D5 / D8: rendered_options carry numeric win_probability and analytical rank', async () => {
    displayStateMockState = mockStateFromMinimalE33()
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_options ?? []
    expect(rendered.length).toBe(4)
    const byId = new Map(rendered.map((r) => [r.id, r]))
    // Win probability — numeric, matching the wire values byte-for-byte
    expect(byId.get('opt_tech_lead')?.win_probability_displayed).toBe(0.8865)
    expect(byId.get('opt_two_devs')?.win_probability_displayed).toBe(0.1105)
    expect(byId.get('opt_status_quo')?.win_probability_displayed).toBe(0.0025)
    expect(byId.get('opt_one_dev')?.win_probability_displayed).toBe(0.0005)
    // Analytical rank — descending win_probability
    expect(byId.get('opt_tech_lead')?.rank_displayed).toBe(1)
    expect(byId.get('opt_two_devs')?.rank_displayed).toBe(2)
    expect(byId.get('opt_status_quo')?.rank_displayed).toBe(3)
    expect(byId.get('opt_one_dev')?.rank_displayed).toBe(4)
    // Provenance — every option resolved via the wire-level primary tier
    for (const r of rendered) {
      expect(r.win_probability_source).toBe('payloads.plot_response.option_comparison.win_probability')
      expect(r.rank_source).toBe('win_probability_desc')
    }
  })

  it('D4: rendered_factors carry numeric influence_score and sensitivity_score (incl. negative)', async () => {
    displayStateMockState = mockStateFromMinimalE33()
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const rendered = ds.rendered_factors ?? []
    expect(rendered.length).toBe(4)
    const byId = new Map(rendered.map((r) => [r.id, r]))
    // Influence — full precision wire values
    expect(byId.get('fac_tech_lead')?.influence_displayed).toBe(1.0)
    expect(byId.get('fac_dev_capacity')?.influence_displayed).toBe(0.5748502994011976)
    expect(byId.get('fac_team_experience')?.influence_displayed).toBe(0.4167664670658682)
    expect(byId.get('fac_hiring_cost')?.influence_displayed).toBe(0.311377245508982)
    // Sensitivity — including the negative −0.13 (fac_hiring_cost). The
    // export's typeof-number check preserves the sign; clamping to 0 would
    // silently lie about the direction of the effect.
    expect(byId.get('fac_tech_lead')?.sensitivity_displayed).toBe(0.41750000000000004)
    expect(byId.get('fac_dev_capacity')?.sensitivity_displayed).toBe(0.24000000000000002)
    expect(byId.get('fac_team_experience')?.sensitivity_displayed).toBe(0.174)
    expect(byId.get('fac_hiring_cost')?.sensitivity_displayed).toBe(-0.13)
    // Provenance — every factor resolved via the wire-level source
    for (const r of rendered) {
      expect(r.influence_source).toBe('payloads.plot_response.factor_sensitivity.influence_score')
      expect(r.sensitivity_source).toBe('payloads.plot_response.factor_sensitivity.sensitivity_score')
    }
  })

  // Negative case 1: production has neither raw wire nor a populated report.
  // The export must mark every surface unmatched honestly — not fabricate
  // zeros, not promote a stale source. rank_source must collapse to
  // canvas_order, the explicit "no analytical data" provenance.
  it('honest unmatched when both rawV2Response and report.option_probabilities are absent', async () => {
    displayStateMockState = mockStateFromMinimalE33({
      rawV2ResponseOverride: null,
      reportOverride: {},
    })
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const options = ds.rendered_options ?? []
    const factors = ds.rendered_factors ?? []
    expect(options.length).toBe(4)
    expect(factors.length).toBe(4)
    for (const r of options) {
      expect(r.win_probability_source).toBe('unmatched')
      expect(r.win_probability_displayed).toBeNull()
      expect(r.rank_source).toBe('canvas_order')
    }
    for (const r of factors) {
      expect(r.influence_source).toBe('unmatched')
      expect(r.influence_displayed).toBeNull()
      expect(r.sensitivity_source).toBe('unmatched')
      expect(r.sensitivity_displayed).toBeNull()
    }
  })

  // Negative case 2: report-only fallback path. rawV2Response is null, but
  // results.report.option_probabilities is populated (V5 mapper-only shape,
  // e.g. supabase-hydrated historical run). Win_probability resolves via the
  // report tier; factor influence/sensitivity correctly stay unmatched
  // because the V5 mapper narrows report.factor_sensitivity and drops
  // influence_score/sensitivity_score — surfacing this honestly is the
  // contract (UI-SEM-style honesty: missing data must look missing, not zero).
  it('report-only fallback resolves win_probability via report tier; factor metrics stay unmatched', async () => {
    displayStateMockState = mockStateFromMinimalE33({
      rawV2ResponseOverride: null,
      // Use the same option_probabilities from the fixture — exercises the
      // mapper-synthesised path with no wire data behind it.
    })
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    const options = ds.rendered_options ?? []
    const factors = ds.rendered_factors ?? []
    expect(options.length).toBe(4)
    for (const r of options) {
      expect(r.win_probability_source).toBe('results.report.option_probabilities.win_probability')
      expect(typeof r.win_probability_displayed).toBe('number')
      expect(r.rank_source).toBe('win_probability_desc')
    }
    // Top-ranked option still derived from the same numbers
    const byId = new Map(options.map((r) => [r.id, r]))
    expect(byId.get('opt_tech_lead')?.rank_displayed).toBe(1)
    // Factor metrics: no raw wire, no influence/sensitivity → unmatched
    for (const r of factors) {
      expect(r.influence_source).toBe('unmatched')
      expect(r.influence_displayed).toBeNull()
      expect(r.sensitivity_source).toBe('unmatched')
      expect(r.sensitivity_displayed).toBeNull()
    }
  })

  // Codex review on PR #141 surfaced a pre-existing gap: deriveHeroHeadline
  // only treated 'success'/'computed' as winner-headline states, while
  // production canvas-store writes `ResultsStatus === 'complete'`
  // (src/canvas/store.ts:168, 2488). The winner branch was unreachable in
  // production — even after this PR's data-source fix, `optionComparison`
  // would never be consulted on a real complete run. The fix adds 'complete'
  // to the accepted statuses. `hero_headline_displayed` is a legacy field
  // (canonical `analysis_display_*` fields supersede it; see
  // exportBundle.displayState.spec.ts:4), but as long as it ships in
  // bundles, its derivation must reach the analytical-winner branch on a
  // real complete run.
  it('hero_headline_displayed derives analytical winner on production results.status === "complete"', async () => {
    displayStateMockState = mockStateFromMinimalE33()
    const { captureDisplayState } = await import('../utils/exportBundle')
    const ds = await captureDisplayState()
    // opt_tech_lead is the analytical winner (win_probability 0.8865) — the
    // fixture's results.status is 'complete', matching the real production
    // path. Previously the function returned 'Analysis complete' (literal
    // fallback for non-success/computed status), masking the analytical
    // winner.
    expect(ds.hero_headline_displayed).toBe('Hire a Tech Lead performs best')
  })

  it('hero_headline_displayed honours legacy "success" / "computed" statuses', async () => {
    // Tolerance for older fixtures and externally constructed payloads.
    for (const legacyStatus of ['success', 'computed']) {
      displayStateMockState = mockStateFromMinimalE33()
      // Override the results.status set by the mock helper.
      displayStateMockState.results = {
        ...displayStateMockState.results!,
        status: legacyStatus,
      }
      const { captureDisplayState } = await import('../utils/exportBundle')
      const ds = await captureDisplayState()
      expect(ds.hero_headline_displayed).toBe('Hire a Tech Lead performs best')
    }
  })
})
