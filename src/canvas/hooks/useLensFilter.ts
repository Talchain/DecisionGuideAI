/**
 * useLensFilter — Core hook for the Graph Lens feature.
 *
 * Computes lens visual state and pushes dimmed/highlighted sets into the store.
 * BaseNode and StyledEdge read these via primitive boolean selectors on the store.
 *
 * Called once from ReactFlowGraph — not from individual node/edge components.
 */

import { useMemo, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { computeOptionPaths } from '../utils/computeOptionPaths'
import { resolveCausalLensEdgeParams, type CausalLensEdgeParams } from '../domain/edgeValueProvenance'
import type { FragileEdgeCandidate } from '../utils/fragileEdgeMatch'

// ─── Sensitivity helpers ─────────────────────────────────────────────────────

interface FactorSensitivityEntry {
  factor_id?: string
  factorId?: string
  node_id?: string
  nodeId?: string
  elasticity?: number
  sensitivity_score?: number
  sensitivity?: number
  importance_score?: number
}

function getFactorId(f: FactorSensitivityEntry): string | undefined {
  return f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId
}

/** Field priority: elasticity > sensitivity_score > sensitivity > importance_score */
function getSensitivityValue(f: FactorSensitivityEntry): number {
  return f.elasticity ?? f.sensitivity_score ?? f.sensitivity ?? f.importance_score ?? 0
}

function computeQuartiles(values: number[]): { q25: number; q75: number } {
  if (values.length === 0) return { q25: 0, q75: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const q25Idx = Math.floor(sorted.length * 0.25)
  const q75Idx = Math.floor(sorted.length * 0.75)
  return {
    q25: sorted[Math.min(q25Idx, sorted.length - 1)],
    q75: sorted[Math.min(q75Idx, sorted.length - 1)],
  }
}

// ─── Fragile edge helpers ────────────────────────────────────────────────────

// FragileEdgeCandidate type imported from ../utils/fragileEdgeMatch (shared with StyledEdge, useMenuItems)

function buildFragileEdgeSet(
  fragileEdges: FragileEdgeCandidate[],
  graphEdges: Array<{ id: string; source: string; target: string }>,
): Set<string> {
  const fragileIds = new Set<string>()

  for (const fe of fragileEdges) {
    const switchProb = fe.switch_probability ?? fe.switchProbability ??
                       fe.marginal_switch_probability ?? fe.marginalSwitchProbability
    if (typeof switchProb !== 'number' || switchProb <= 0.3) continue

    const edgeId = fe.edge_id ?? fe.edgeId
    if (edgeId) {
      if (graphEdges.some(e => e.id === edgeId)) {
        fragileIds.add(edgeId)
        continue
      }
    }

    const fromId = fe.from_id ?? fe.fromId ?? fe.source
    const toId = fe.to_id ?? fe.toId ?? fe.target
    if (fromId && toId) {
      const match = graphEdges.find(e => e.source === fromId && e.target === toId)
      if (match) {
        fragileIds.add(match.id)
      }
    }
  }

  return fragileIds
}

// ─── Computed visuals interface ──────────────────────────────────────────────

interface LensVisuals {
  dimmedNodeIds: Set<string>
  dimmedEdgeIds: Set<string>
  sensitivityWeights: Map<string, number>
  sensitivityQuartiles: { q25: number; q75: number } | null
  fragileEdgeIds: Set<string>
  // Expanded lenses (Brief 5)
  hiddenNodeIds?: Set<string>
  hiddenEdgeIds?: Set<string>
  causalEdgeParams?: Map<string, CausalLensEdgeParams>
  evidenceNodeClass?: Map<string, 'grounded' | 'assumed' | 'none' | 'na'>
  evidenceEdgeClass?: Map<string, 'evidence' | 'assumed' | 'unknown'>
}

const EMPTY_SET = new Set<string>()
const EMPTY_MAP = new Map<string, number>()
const EMPTY_VISUALS: LensVisuals = {
  dimmedNodeIds: EMPTY_SET,
  dimmedEdgeIds: EMPTY_SET,
  sensitivityWeights: EMPTY_MAP,
  sensitivityQuartiles: null,
  fragileEdgeIds: EMPTY_SET,
}

/** Node kinds filtered before inference — Platform Contract v4 §3.3.1 */
const ORGANISATIONAL_KINDS = new Set(['decision', 'option', 'constraint'])

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useLensFilter(): void {
  const lensActive = useCanvasStore(s => s.lens.active)
  const lensOptionId = useCanvasStore(s => s.lens.selectedOptionId)
  const resultsStatus = useCanvasStore(s => s.results.status)
  const report = useCanvasStore(s => s.results.report)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const setLensVisuals = useCanvasStore(s => s.setLensVisuals)

  const visuals = useMemo((): LensVisuals => {
    // Causal + evidence lenses work without results; all others require them
    const needsResults = lensActive !== 'causal' && lensActive !== 'evidence'
    if (lensActive === 'full' || (needsResults && (resultsStatus !== 'complete' || !report))) {
      return EMPTY_VISUALS
    }

    const allNodeIds = new Set(nodes.map(n => n.id))
    const allEdgeIds = new Set(edges.map(e => e.id))

    // ── Option Isolation ──
    if (lensActive === 'option' && lensOptionId) {
      const ceeOptions = ceeAnalysisReady?.options ?? []
      const graphNodes = nodes.map(n => ({ id: n.id, type: n.type }))
      const graphEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target }))

      const paths = computeOptionPaths(graphNodes, graphEdges, lensOptionId, ceeOptions)

      // Dimmed = all nodes/edges NOT in the active set
      const dimmedNodeIds = new Set<string>()
      for (const id of allNodeIds) {
        if (!paths.activeNodeIds.has(id)) dimmedNodeIds.add(id)
      }
      const dimmedEdgeIds = new Set<string>()
      for (const id of allEdgeIds) {
        if (!paths.activeEdgeKeys.has(id)) dimmedEdgeIds.add(id)
      }

      return { dimmedNodeIds, dimmedEdgeIds, sensitivityWeights: EMPTY_MAP, sensitivityQuartiles: null, fragileEdgeIds: EMPTY_SET }
    }

    // ── Sensitivity ──
    if (lensActive === 'sensitivity') {
      const reportAny = report as Record<string, unknown>
      const enrichment = reportAny.enrichment as Record<string, unknown> | undefined
      const sensitivityAnalysis = enrichment?.sensitivity_analysis as Record<string, unknown> | undefined
      const rawFactors = sensitivityAnalysis?.factors
      const factorSensitivity: FactorSensitivityEntry[] =
        Array.isArray(rawFactors) ? rawFactors :
        Array.isArray(reportAny.factor_sensitivity) ? (reportAny.factor_sensitivity as FactorSensitivityEntry[]) :
        []

      const factorSensMap = new Map<string, number>()
      for (const f of factorSensitivity) {
        const fid = getFactorId(f)
        if (fid) factorSensMap.set(fid, Math.abs(getSensitivityValue(f)))
      }

      // Correction #3: Only style edges where edge.source matches a factor in factor_sensitivity.
      // Non-factor-originating edges retain normal styling.
      const sensitivityWeights = new Map<string, number>()
      const values: number[] = []
      for (const edge of edges) {
        const factorSens = factorSensMap.get(edge.source)
        if (factorSens !== undefined) {
          sensitivityWeights.set(edge.id, factorSens)
          values.push(factorSens)
        }
      }

      const quartiles = computeQuartiles(values)

      // No node/edge dimming in sensitivity mode — all visible
      return { dimmedNodeIds: EMPTY_SET, dimmedEdgeIds: EMPTY_SET, sensitivityWeights, sensitivityQuartiles: quartiles, fragileEdgeIds: EMPTY_SET }
    }

    // ── Fragile Edges ──
    if (lensActive === 'fragile') {
      const reportAny = report as Record<string, unknown>
      const robustness = reportAny.robustness as Record<string, unknown> | undefined
      const rawFragile = robustness?.fragile_edges
      const fragileEdgesData: FragileEdgeCandidate[] = Array.isArray(rawFragile) ? rawFragile : []
      const graphEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target }))

      const fragileIds = buildFragileEdgeSet(fragileEdgesData, graphEdges)

      // Dim non-fragile edges (not nodes)
      const dimmedEdgeIds = new Set<string>()
      for (const id of allEdgeIds) {
        if (!fragileIds.has(id)) dimmedEdgeIds.add(id)
      }

      return { dimmedNodeIds: EMPTY_SET, dimmedEdgeIds, sensitivityWeights: EMPTY_MAP, sensitivityQuartiles: null, fragileEdgeIds: fragileIds }
    }

    // ── Causal Graph ──
    if (lensActive === 'causal') {
      const hiddenNodeIds = new Set<string>()
      const hiddenEdgeIds = new Set<string>()
      const causalEdgeParams = new Map<string, CausalLensEdgeParams>()

      // Hide organisational nodes (decision, option, constraint) — they don't participate in inference
      for (const node of nodes) {
        const kind = (node.type ?? (node.data as Record<string, unknown>)?.kind) as string | undefined
        if (kind && ORGANISATIONAL_KINDS.has(kind)) {
          hiddenNodeIds.add(node.id)
        }
      }

      for (const edge of edges) {
        // Hide structural edges (those connected to hidden nodes)
        if (hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target)) {
          hiddenEdgeIds.add(edge.id)
          continue
        }

        // ROADMAP 2.954 — every channel PROVENANCE-GATED through the same
        // resolver family the main edge label uses. The previous line here
        // called `computeSignedMean`, whose fallback signs the UI-defaulted
        // `weight` off the raw `direction` field — so the lens printed `+0.50`
        // (a constant) for edges nobody characterised and a danger-red
        // negative claim for producers that explicitly declined one. (Its
        // P0-5-era comment said "no synthetic defaults"; that was true of
        // std/existsProb on THIS ingestion path and false of the mean on
        // every path — the fabrication lived in the fallback itself.)
        const edgeData = edge.data as Record<string, unknown> | undefined
        causalEdgeParams.set(edge.id, resolveCausalLensEdgeParams(edgeData))
      }

      return {
        dimmedNodeIds: EMPTY_SET, dimmedEdgeIds: EMPTY_SET,
        sensitivityWeights: EMPTY_MAP, sensitivityQuartiles: null, fragileEdgeIds: EMPTY_SET,
        hiddenNodeIds, hiddenEdgeIds, causalEdgeParams,
      }
    }

    // ── Evidence Quality ──
    if (lensActive === 'evidence') {
      const evidenceNodeClass = new Map<string, 'grounded' | 'assumed' | 'none' | 'na'>()
      const evidenceEdgeClass = new Map<string, 'evidence' | 'assumed' | 'unknown'>()

      for (const node of nodes) {
        const kind = (node.type ?? (node.data as Record<string, unknown>)?.kind) as string | undefined
        if (kind === 'factor') {
          const obs = (node.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
          const source = obs?.source as string | undefined
          if (source === 'brief_extraction' || source === 'user' || source === 'document' || source === 'metric') {
            evidenceNodeClass.set(node.id, 'grounded')
          } else if (source === 'cee_inference' || source === 'engine' || source === 'inferred') {
            evidenceNodeClass.set(node.id, 'assumed')
          } else if (obs && (obs.value !== undefined || obs.baseline !== undefined)) {
            evidenceNodeClass.set(node.id, 'assumed')
          } else {
            evidenceNodeClass.set(node.id, 'none')
          }
        } else {
          evidenceNodeClass.set(node.id, 'na')
        }
      }

      for (const edge of edges) {
        const edgeData = edge.data as Record<string, unknown> | undefined
        const provenance = (edgeData?.provenance ?? edgeData?.provenance_source) as string | undefined
        if (provenance === 'document' || provenance === 'metric' || provenance === 'evidence' || provenance === 'brief_extraction') {
          evidenceEdgeClass.set(edge.id, 'evidence')
        } else if (provenance === 'hypothesis' || provenance === 'engine' || provenance === 'template' || provenance === 'user' || provenance === 'inferred') {
          evidenceEdgeClass.set(edge.id, 'assumed')
        } else {
          evidenceEdgeClass.set(edge.id, 'unknown')
        }
      }

      return {
        dimmedNodeIds: EMPTY_SET, dimmedEdgeIds: EMPTY_SET,
        sensitivityWeights: EMPTY_MAP, sensitivityQuartiles: null, fragileEdgeIds: EMPTY_SET,
        evidenceNodeClass, evidenceEdgeClass,
      }
    }

    // ── Robustness (post-analysis only) ──
    if (lensActive === 'robustness') {
      const reportAny = report as Record<string, unknown>
      const robustness = reportAny?.robustness as Record<string, unknown> | undefined
      const rawFragile = robustness?.fragile_edges
      const fragileEdgesData: FragileEdgeCandidate[] = Array.isArray(rawFragile) ? rawFragile : []
      const graphEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target }))
      const fragileIds = buildFragileEdgeSet(fragileEdgesData, graphEdges)

      const dimmedEdgeIds = new Set<string>()
      for (const id of allEdgeIds) {
        if (!fragileIds.has(id)) dimmedEdgeIds.add(id)
      }

      return {
        dimmedNodeIds: EMPTY_SET, dimmedEdgeIds,
        sensitivityWeights: EMPTY_MAP, sensitivityQuartiles: null,
        fragileEdgeIds: fragileIds,
      }
    }

    return EMPTY_VISUALS
  }, [lensActive, lensOptionId, resultsStatus, report, nodes, edges, ceeAnalysisReady])

  // Push computed visuals to store so BaseNode/StyledEdge can read with primitive selectors
  const prevVisualsRef = useRef(visuals)
  useEffect(() => {
    if (visuals !== prevVisualsRef.current) {
      prevVisualsRef.current = visuals
      setLensVisuals(visuals)
    }
  }, [visuals, setLensVisuals])
}

// ─── Exported pure functions for testing ─────────────────────────────────────

export { computeQuartiles as _computeQuartiles, getSensitivityValue as _getSensitivityValue, buildFragileEdgeSet as _buildFragileEdgeSet }
