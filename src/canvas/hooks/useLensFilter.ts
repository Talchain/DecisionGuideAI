/**
 * useLensFilter — the lenses' one computation (`artefacts/lenses.ts`).
 *
 * Computes each lens's marks and pushes them into the store; BaseNode and StyledEdge read them via primitive
 * selectors. Called once from ReactFlowGraph — not from individual node/edge components.
 *
 *   - option        dims everything off the option's paths (entered from an option card, the context menu or a key).
 *   - rests_on      numbers every figure the model rests on, from the ONE owner reader (`assumptionMapOf`).
 *   - premortem     dims everything Olumi's pre-mortem stories do not rest on.
 *   - what_changes  the selected Run's sensitivity widths and fragile links, dimming the rest. Needs a complete Run.
 */

import { useMemo, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { computeOptionPaths } from '../utils/computeOptionPaths'
import type { FragileEdgeCandidate } from '../utils/fragileEdgeMatch'
import { resolveActiveGoalNodeId } from './goalThresholdResolvers'
import { assumptionMapOf, restsOnKey, restsOnNumbered, type RestsOnMark } from '../artefacts/assumptionMapModel'
import { useCurrentPremortemWorksheet } from '../artefacts/lenses'
import type { PremortemWorksheetV1 } from '../../v5/readPremortemWorksheet'

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
  restsOn?: Map<string, RestsOnMark>
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

/** Every id NOT in `keep`. */
function allBut(ids: Iterable<string>, keep: ReadonlySet<string>): Set<string> {
  const out = new Set<string>()
  for (const id of ids) if (!keep.has(id)) out.add(id)
  return out
}

/** The elements Olumi's pre-mortem stories rest on: their options, the factors and risks they name, and the links. */
function premortemInFocus(
  worksheet: PremortemWorksheetV1,
  edges: ReadonlyArray<{ id: string; source: string; target: string }>,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const byId = new Map(edges.map((e) => [e.id, e]))
  for (const row of worksheet.rows) {
    nodeIds.add(row.option_id)
    if (row.on_map) nodeIds.add(row.on_map.node_id)
    if (row.grounding.kind === 'not_in_model') continue
    for (const id of row.grounding.ids) {
      const edge = byId.get(id) // an id names a link or a card (`resolveModelTarget`, the worksheet's own reader)
      if (edge) {
        edgeIds.add(edge.id)
        nodeIds.add(edge.source)
        nodeIds.add(edge.target)
      } else {
        nodeIds.add(id)
      }
    }
  }
  return { nodeIds, edgeIds }
}

/** The selected Run's per-factor sensitivity (absolute), keyed by factor id. One reader for the lens and its key card. */
export function readFactorSensitivity(report: Record<string, unknown>): Map<string, number> {
  const enrichment = report.enrichment as Record<string, unknown> | undefined
  const sensitivityAnalysis = enrichment?.sensitivity_analysis as Record<string, unknown> | undefined
  const rawFactors = sensitivityAnalysis?.factors
  const factorSensitivity: FactorSensitivityEntry[] =
    Array.isArray(rawFactors) ? rawFactors :
    Array.isArray(report.factor_sensitivity) ? (report.factor_sensitivity as FactorSensitivityEntry[]) :
    []
  const factorSensMap = new Map<string, number>()
  for (const f of factorSensitivity) {
    const fid = getFactorId(f)
    if (fid) factorSensMap.set(fid, Math.abs(getSensitivityValue(f)))
  }
  return factorSensMap
}

/** The selected Run's per-factor sensitivity, keyed by the edges leaving each factor (the only edges it styles). */
function sensitivityOf(report: Record<string, unknown>, edges: ReadonlyArray<{ id: string; source: string }>) {
  const factorSensMap = readFactorSensitivity(report)
  // Correction #3: only edges whose source is a factor in the sensitivity list are styled.
  const weights = new Map<string, number>()
  const values: number[] = []
  for (const edge of edges) {
    const factorSens = factorSensMap.get(edge.source)
    if (factorSens !== undefined) {
      weights.set(edge.id, factorSens)
      values.push(factorSens)
    }
  }
  return { weights, quartiles: values.length > 0 ? computeQuartiles(values) : null }
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useLensFilter(): void {
  const lensActive = useCanvasStore(s => s.lens.active)
  const lensOptionId = useCanvasStore(s => s.lens.selectedOptionId)
  const resultsStatus = useCanvasStore(s => s.results.status)
  const report = useCanvasStore(s => s.results.report)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const setLensVisuals = useCanvasStore(s => s.setLensVisuals)
  const worksheet = useCurrentPremortemWorksheet()

  const visuals = useMemo((): LensVisuals => {
    const graphEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target }))

    // ── Rests on: the owner reader's figures, numbered (no Run needed) ──
    if (lensActive === 'rests_on') {
      const goalId = resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes })
      const restsOn = new Map<string, RestsOnMark>()
      const byId = new Map(nodes.map(n => [n.id, n]))
      const positionOf = (id: string) => byId.get(id)?.position ?? null
      for (const item of restsOnNumbered(assumptionMapOf(nodes, edges, goalId).items, edges, positionOf)) {
        restsOn.set(restsOnKey(item.target), { n: item.n, column: item.column })
      }
      return { ...EMPTY_VISUALS, restsOn }
    }

    // ── If it failed: the stories' elements in front (no Run needed; nothing dims before a worksheet exists) ──
    if (lensActive === 'premortem') {
      if (!worksheet) return EMPTY_VISUALS
      const focus = premortemInFocus(worksheet, graphEdges)
      return {
        ...EMPTY_VISUALS,
        dimmedNodeIds: allBut(nodes.map(n => n.id), focus.nodeIds),
        dimmedEdgeIds: allBut(edges.map(e => e.id), focus.edgeIds),
      }
    }

    if (resultsStatus !== 'complete' || !report) return EMPTY_VISUALS
    const reportAny = report as Record<string, unknown>

    // ── Option isolation ──
    if (lensActive === 'option' && lensOptionId) {
      const ceeOptions = ceeAnalysisReady?.options ?? []
      const paths = computeOptionPaths(nodes.map(n => ({ id: n.id, type: n.type })), graphEdges, lensOptionId, ceeOptions)
      return {
        ...EMPTY_VISUALS,
        dimmedNodeIds: allBut(nodes.map(n => n.id), paths.activeNodeIds),
        dimmedEdgeIds: allBut(edges.map(e => e.id), paths.activeEdgeKeys),
      }
    }

    // ── What would change: the selected Run's sensitivity and its fragile links ──
    // Width by sensitivity quartile; a fragile link (`robustness.fragile_edges`) is thickest. Every other link dims, so
    // what the comparison rests on stands out. With nothing measured, nothing dims.
    if (lensActive === 'what_changes') {
      const robustness = reportAny.robustness as Record<string, unknown> | undefined
      const rawFragile = robustness?.fragile_edges
      const fragileEdgeIds = buildFragileEdgeSet(Array.isArray(rawFragile) ? rawFragile : [], graphEdges)
      const { weights, quartiles } = sensitivityOf(reportAny, graphEdges)
      const inFocus = new Set(fragileEdgeIds)
      if (quartiles) weights.forEach((w, id) => { if (w > 0 && w >= quartiles.q75) inFocus.add(id) })
      return {
        ...EMPTY_VISUALS,
        dimmedEdgeIds: inFocus.size > 0 ? allBut(edges.map(e => e.id), inFocus) : EMPTY_SET,
        sensitivityWeights: weights,
        sensitivityQuartiles: quartiles,
        fragileEdgeIds,
      }
    }

    return EMPTY_VISUALS
  }, [lensActive, lensOptionId, resultsStatus, report, nodes, edges, ceeAnalysisReady, outcomeNodeId, worksheet])

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
