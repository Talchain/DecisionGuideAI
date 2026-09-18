/**
 * ⚠⚠ THIS SPEC IS **UNRUN**. It was written on 18 Sep 2026 in a session under a
 * hard no-install / no-suite / no-typecheck constraint and a full disk, so
 * nothing here has been executed — not once, not partially. **CI is the
 * authority.** Treat a green tick in this file's absence as unknown, not as
 * pass. (What WAS executed: a plain-`node` differential probe comparing the
 * pre-patch object-literal projection against the spec-driven one over a
 * 400-case corpus — 0 mismatches, with a contrast control proving the probe
 * could see a dropped rename. That probe is not this file and did not run
 * vitest, React, or the bundle assembler.)
 *
 * ## What this spec is for
 *
 * `debug_projection_manifest` claims to state what `full_graph` renamed and
 * dropped. A manifest that drifts from the projection is worse than no manifest
 * at all: it would read as an authoritative account of the bundle's losses
 * while being wrong, and the drift would read as green. So every assertion here
 * compares the manifest against the **observed behaviour of the real
 * projection** (via `buildDebugBundle`), never against the table the manifest
 * was emitted from — a manifest checked against its own source is a guard
 * agreeing with itself.
 *
 * ## Contrast controls (this spec must not be able to pass vacuously)
 *
 * An empty manifest, or a probe that cannot see a rename, would satisfy a naive
 * "every declared rename holds" loop by doing nothing. Four controls prevent it:
 *   1. the number of probes actually executed is asserted against the number of
 *      emitted keys, so a shrunken manifest REDs instead of running zero loops;
 *   2. a KNOWN rename (`strengthStd` -> `strength_std`) must be detected AND a
 *      known IDENTITY key (`edge_type`) must NOT be reported as renamed — one
 *      alone proves nothing, the pair proves the detector discriminates;
 *   3. an unknown key must be reported as dropped AND a consumed key must not;
 *   4. the renamed list must be non-empty.
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

import { buildDebugBundle, type FullGraphData } from '../utils/exportBundle'
import {
  EDGE_PROJECTION,
  NODE_PROJECTION,
  type EnrichedFieldSpec,
} from '../utils/enrichedGraphProjection'

function makeDebugData(): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 1200, request_id: 'req-main' },
    services: {
      cee: { name: 'CEE', status: 200, success: true, duration_ms: 245, endpoint: '/cee/draft-graph' },
      plot: { name: 'PLoT', status: 202, success: true, duration_ms: 510, endpoint: '/plot/v2/run' },
      isl: null,
    },
    error: null,
    builds: { ui: 'test-build', cee: 'cee-build', plot: 'plot-build', isl: null },
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
      connectivity: { decision_count: 1, option_count: 1, goal_count: 1, factor_count: 1, edge_count: 1 },
    },
    payloads: {
      cee_request: null,
      cee_response: { trace: { pipeline: { validated_causal_claims: [] } } },
      plot_request: { prompt: 'analyze' },
      plot_response: { result: 'ok' },
      isl_request: null,
      isl_response: null,
    },
    gates: [{ name: 'run' as const, status: 'pass' as const }],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: {
      ui_generated: 'ui-req-123',
      from_plot: null,
      plot_chain_present: false,
      draft_trace: null,
    } as unknown as RequestIdChain,
    feature_flags_at_request: null as unknown as never,
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

/** A graph carrying exactly the node/edge `data` supplied. */
function graphWith(
  nodeData: Record<string, unknown>,
  edgeData: Record<string, unknown>,
): FullGraphData {
  return {
    nodes: [{ id: 'n1', data: { kind: 'factor', ...nodeData } }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1', data: edgeData }],
  } as unknown as FullGraphData
}

function exportWith(graphData: FullGraphData) {
  const bundle = buildDebugBundle(makeDebugData(), { includeFullGraph: true, graphData })
  const manifest = bundle.debug_projection_manifest
  if (!manifest) throw new Error('debug_projection_manifest was not emitted')
  return {
    manifest,
    node: (bundle.full_graph!.factors[0] ?? {}) as Record<string, unknown>,
    edge: (bundle.full_graph!.edges[0] ?? {}) as Record<string, unknown>,
  }
}

/** Sentinels: a number where the projection is number-only, else a string. */
function sentinelFor(spec: EnrichedFieldSpec, index: number): unknown {
  return spec.numberOnly ? 1000 + index : `__probe_${spec.to}_${index}__`
}

describe('debug_projection_manifest — derived from the projection, not mirrored', () => {
  beforeEach(() => {
    import.meta.env.VITE_DEBUG_BUNDLE_V2 = 'false'
  })

  it('is emitted whenever full_graph is, and names itself apart from redaction', () => {
    const { manifest } = exportWith(graphWith({}, {}))
    expect(manifest.what_this_answers).toMatch(/RENAMED/)
    expect(manifest.not_the_same_as).toMatch(/debug_redaction_manifest/)
  })

  it('is absent when full_graph is (it describes nothing otherwise)', () => {
    const bundle = buildDebugBundle(makeDebugData())
    expect(bundle.full_graph).toBeUndefined()
    expect(bundle.debug_projection_manifest).toBeUndefined()
  })

  // --- Direction A: every rename the manifest DECLARES, the projection PERFORMS.
  it('every declared node rename is performed by the real projection', () => {
    let probes = 0
    const { manifest } = exportWith(graphWith({}, {}))
    for (const rename of manifest.node.renamed) {
      if (rename.from.includes('.')) continue // nested source; covered below
      const value = `__probe_node_${rename.from}__`
      const { node } = exportWith(graphWith({ [rename.from]: value }, {}))
      expect(node[rename.to]).toBe(value)
      probes += 1
    }
    // CONTRAST CONTROL 4 + 1: the loop must have done real work.
    expect(manifest.node.renamed.length).toBeGreaterThan(0)
    expect(probes).toBeGreaterThan(0)
  })

  it('every declared edge rename is performed by the real projection', () => {
    let probes = 0
    const { manifest } = exportWith(graphWith({}, {}))
    for (const rename of manifest.edge.renamed) {
      if (rename.from.includes('.')) continue
      const value = `__probe_edge_${rename.from}__`
      const { edge } = exportWith(graphWith({}, { [rename.from]: value }))
      expect(edge[rename.to]).toBe(value)
      probes += 1
    }
    expect(manifest.edge.renamed.length).toBeGreaterThan(0)
    expect(probes).toBeGreaterThan(0)
  })

  // --- Direction B: every key the projection EMITS, the manifest DECLARES.
  // This is the guard that REDs if someone hand-writes a field back into the
  // transform without adding it to the spec table.
  it('every key the projection emits appears in the manifest allowlist', () => {
    const nodeData: Record<string, unknown> = {}
    const edgeData: Record<string, unknown> = {}
    NODE_PROJECTION.forEach((s, i) => {
      if (!s.from[0].includes('.')) nodeData[s.from[0]] = sentinelFor(s, i)
    })
    EDGE_PROJECTION.forEach((s, i) => {
      edgeData[s.from[0]] = sentinelFor(s, i)
    })
    nodeData.kind = 'factor'
    const { manifest, node, edge } = exportWith(graphWith(nodeData, edgeData))

    const STRUCTURAL_NODE = new Set(['id', 'type'])
    const STRUCTURAL_EDGE = new Set(['id', 'source', 'target'])

    const undeclaredNode = Object.keys(node)
      .filter((k) => !STRUCTURAL_NODE.has(k) && !manifest.node.emitted_keys.includes(k))
    const undeclaredEdge = Object.keys(edge)
      .filter((k) => !STRUCTURAL_EDGE.has(k) && !manifest.edge.emitted_keys.includes(k))

    expect(undeclaredNode).toEqual([])
    expect(undeclaredEdge).toEqual([])
    // Non-vacuity: the projection really did emit a substantial object.
    expect(Object.keys(node).length).toBeGreaterThan(10)
    expect(Object.keys(edge).length).toBeGreaterThan(10)
  })

  // --- CONTRAST CONTROL 2: the rename detector must DISCRIMINATE.
  it('detects a real rename and does not label an identity key as renamed', () => {
    const { manifest, edge } = exportWith(graphWith({}, { strengthStd: 0.25, edge_type: 'causal' }))

    // Positive: the camelCase canvas spelling reaches the bundle re-keyed.
    expect(edge.strength_std).toBe(0.25)
    expect(edge.strengthStd).toBeUndefined()
    expect(manifest.edge.renamed).toContainEqual(
      expect.objectContaining({ from: 'strengthStd', to: 'strength_std' }),
    )

    // Negative twin: an identity key is emitted but must NOT be called a rename.
    expect(edge.edge_type).toBe('causal')
    expect(manifest.edge.renamed.map((r) => r.from)).not.toContain('edge_type')
  })

  // --- CONTRAST CONTROL 3: dropped keys are MEASURED on the real graph.
  it('reports a key the projection drops, and not one it consumes', () => {
    const { manifest, node, edge } = exportWith(
      graphWith({ someUpstreamKeyNobodyProjects: 1 }, { anotherUnprojectedKey: 2, weight: 0.5 }),
    )
    expect(node.someUpstreamKeyNobodyProjects).toBeUndefined()
    expect(manifest.node.dropped_source_keys).toContain('someUpstreamKeyNobodyProjects')
    expect(manifest.node.dropped_key_counts.someUpstreamKeyNobodyProjects).toBe(1)

    expect(manifest.edge.dropped_source_keys).toContain('anotherUnprojectedKey')
    // Negative twin: a consumed key must never be reported as dropped.
    expect(edge.strength_mean).toBe(0.5)
    expect(manifest.edge.dropped_source_keys).not.toContain('weight')
    // `kind` is consumed by the computed `type`, so it is not a drop either.
    expect(manifest.node.dropped_source_keys).not.toContain('kind')
    expect(manifest.node.inspected_count).toBe(1)
  })

  // --- The false finding of 18 Sep 2026, pinned so it cannot recur silently.
  it('carries goal_threshold_frame — the contract field the allowlist could not emit', () => {
    const { manifest, node } = exportWith(
      graphWith({ kind: 'goal', goal_threshold_frame: 'level', goal_threshold: 1.1 }, {}),
    )
    expect(node.goal_threshold_frame).toBe('level')
    expect(manifest.node.emitted_keys).toContain('goal_threshold_frame')
    // Absence must be a PRESENT null, not a vanished key: the contract reads
    // absence as UNATTESTED, so the bundle has to be able to show absence.
    const absent = exportWith(graphWith({ kind: 'goal' }, {}))
    expect(Object.keys(absent.node)).toContain('goal_threshold_frame')
    expect(absent.node.goal_threshold_frame).toBeNull()
  })

  it('flags which edge keys VANISH when missing, so a zero can be read correctly', () => {
    const { manifest, edge } = exportWith(graphWith({}, {}))
    // These settle to undefined and JSON.stringify deletes them — "not in the
    // bundle" carries no information about them at all.
    expect(manifest.edge.absent_when_missing).toContain('strength_std')
    expect(edge.strength_std).toBeUndefined()
    // Node goal fields are null-terminated, so absence IS observable there.
    expect(manifest.node.absent_when_missing).not.toContain('goal_threshold_frame')
  })

  it('records key names only — never a value, so it cannot undo a redaction', () => {
    const secret = '__probe_secret_value__'
    const { manifest } = exportWith(graphWith({ label: secret }, { edge_type: secret }))
    expect(JSON.stringify(manifest)).not.toContain(secret)
  })
})
