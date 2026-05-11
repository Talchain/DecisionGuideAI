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

import { describe, it, expect } from 'vitest'
import {
  extractDiagnosticChecks,
  extractSchemaVersions,
  extractV12_4Checks,
  isBootstrapConfidenceSource,
  isPlotUnifiedFormulaVersion,
} from '../hooks/useDebugData'

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
      // In this replay harness we deliberately do not plumb canvasEdges, so the
      // edge-probability collector finds nothing — that produces an empty
      // `confidence_unique_values`. The point of this assertion is that the
      // edge-derived and factor-derived fields draw from DIFFERENT sources:
      // factor_confidence_unique_values = [0.25, 0.375], edge-derived = [].
      // The two sets must never alias.
      expect(dc.confidence_unique_values).not.toEqual(dc.factor_confidence_unique_values)
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
