/**
 * useLensFilter — the lenses' one computation (`artefacts/lenses.ts`).
 *
 * Computes each lens's marks and pushes them into the store; BaseNode and StyledEdge read them via primitive
 * selectors. Called once from ReactFlowGraph — not from individual node/edge components.
 *
 * ⛔ NOTHING DIMS, IN ANY LENS (vision spec §2e/§3, 23 Oct: "A lens re-weights marks that already exist … It never fades
 * cards"). Every lens below emphasises; links and cards it does not mark stay at rest, at full strength.
 *
 *   - option        the option's routes take the canvas's one "look here" glow (entered from an option card, the context
 *                   menu or a key).
 *   - tradeoffs     numbers the picked option's route links (`tradeOffsModel.ts`). No Run needed.
 *   - rests_on      numbers every figure the model rests on, from the ONE owner reader (`assumptionMapOf`).
 *   - premortem     the links Olumi's pre-mortem stories rest on take the same glow.
 *   - what_changes  the selected Run's sensitivity widths and fragile links, and a rank chip 1–3 on the links leaving the
 *                   three factors the result moves with most (the key's own list, in its order). Needs a complete Run.
 *   - what_if       the held change's own mark on its card (`WhatIfMarkLayer`); nothing else changes. No Run needed.
 */

import { useMemo, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { computeOptionPaths } from '../utils/computeOptionPaths'
import type { FragileEdgeCandidate } from '../utils/fragileEdgeMatch'
import { resolveActiveGoalNodeId } from './goalThresholdResolvers'
import { ASSUMPTION_MAP_COPY, assumptionMapOf, restsOnKey, restsOnNumbered, type AssumptionColumn, type RestsOnMark } from '../artefacts/assumptionMapModel'
import { useCurrentPremortemWorksheet } from '../artefacts/lenses'
import { tradeOffsForState, tradeOffLinkMarks } from '../artefacts/tradeOffsModel'
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
  /** Links a lens puts in front with the canvas's one emphasis glow (option routes, the stories' links). */
  emphasisEdgeIds?: Set<string>
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

/** The links Olumi's pre-mortem stories rest on (an id names a link or a card: `resolveModelTarget`, the worksheet's reader). */
function premortemLinks(worksheet: PremortemWorksheetV1, edges: ReadonlyArray<{ id: string }>): Set<string> {
  const edgeIds = new Set(edges.map((e) => e.id))
  const out = new Set<string>()
  for (const row of worksheet.rows) {
    if (row.grounding.kind === 'not_in_model') continue
    for (const id of row.grounding.ids) if (edgeIds.has(id)) out.add(id)
  }
  return out
}

/** The three factors the selected Run moves with most, in the key's order ("Factors the result moves with most"). */
export function topSensitiveFactorIds(sensitivity: ReadonlyMap<string, number>, nodes: ReadonlyArray<{ id: string; type?: string }>): string[] {
  return nodes
    .filter(n => n.type === 'factor' && (sensitivity.get(n.id) ?? 0) > 0)
    .sort((a, b) => (sensitivity.get(b.id) ?? 0) - (sensitivity.get(a.id) ?? 0))
    .slice(0, 3)
    .map(n => n.id)
}

/** The rank chip's words: its number, what it means, and the link's own figure state (never hidden). */
export const whatChangesChipLabel = (n: number, column: AssumptionColumn): string =>
  `${n}: what the result moves with most · ${ASSUMPTION_MAP_COPY.columns[column]}`

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
  const lastServerGraphHash = useCanvasStore(s => s.lastServerGraphHash)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const servedBaselineOptions = useCanvasStore(s => s.servedBaselineOptions)
  const goalConstraints = useCanvasStore(s => s.goalConstraints)
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

    // ── Trade-offs: the picked option's route links carry their numbered pills (no Run needed) ──
    if (lensActive === 'tradeoffs') {
      const { options } = tradeOffsForState({ nodes, edges, ceeAnalysisReady, lastServerGraphHash, outcomeNodeId, goalConstraints, servedBaselineOptions })
      const option = options.find(o => o.optionId === lensOptionId) ?? options[0]
      if (!option || option.routes.length === 0) return EMPTY_VISUALS
      // Each route link carries its "Rests on" state as the key's numbered pill (Paul 22 Oct: marks over sentences).
      const restsOn = new Map<string, RestsOnMark>()
      tradeOffLinkMarks(option).forEach((mark, edgeId) => restsOn.set(restsOnKey({ kind: 'edge', id: edgeId }), mark))
      return { ...EMPTY_VISUALS, restsOn }
    }

    // ── If it failed: the links the stories rest on take the emphasis glow (no Run needed). It used to grey every card
    // and link the stories did not name to 20%. ──
    if (lensActive === 'premortem') {
      if (!worksheet) return EMPTY_VISUALS
      return { ...EMPTY_VISUALS, emphasisEdgeIds: premortemLinks(worksheet, graphEdges) }
    }

    // ── What if: the held change's own mark says it (`WhatIfMarkLayer`); it used to grey every other card. ──
    if (lensActive === 'what_if') return EMPTY_VISUALS

    if (resultsStatus !== 'complete' || !report) return EMPTY_VISUALS
    const reportAny = report as unknown as Record<string, unknown>

    // ── Option isolation: the option's routes in front with the emphasis glow; it used to grey everything else ──
    if (lensActive === 'option' && lensOptionId) {
      const ceeOptions = ceeAnalysisReady?.options ?? []
      const paths = computeOptionPaths(nodes.map(n => ({ id: n.id, type: n.type })), graphEdges, lensOptionId, ceeOptions)
      return { ...EMPTY_VISUALS, emphasisEdgeIds: new Set(paths.activeEdgeKeys) }
    }

    // ── What would change: the selected Run's sensitivity and its fragile links ──
    // Width by sensitivity quartile; a fragile link (`robustness.fragile_edges`) is thickest. The links leaving the three
    // factors the result moves with most carry a rank chip 1–3 at their midpoint. Every other link stays at rest.
    if (lensActive === 'what_changes') {
      const robustness = reportAny.robustness as Record<string, unknown> | undefined
      const rawFragile = robustness?.fragile_edges
      const fragileEdgeIds = buildFragileEdgeSet(Array.isArray(rawFragile) ? rawFragile : [], graphEdges)
      const { weights, quartiles } = sensitivityOf(reportAny, graphEdges)
      const top = topSensitiveFactorIds(readFactorSensitivity(reportAny), nodes)
      const restsOn = new Map<string, RestsOnMark>()
      if (top.length > 0) {
        const goalId = resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes })
        const columnOf = new Map(assumptionMapOf(nodes, edges, goalId).items.map(item => [restsOnKey(item.target), item.column]))
        for (const edge of edges) {
          const n = top.indexOf(edge.source) + 1
          const column = columnOf.get(restsOnKey({ kind: 'edge', id: edge.id }))
          if (n > 0 && column) restsOn.set(restsOnKey({ kind: 'edge', id: edge.id }), { n, column, label: whatChangesChipLabel(n, column) })
        }
      }
      return { ...EMPTY_VISUALS, sensitivityWeights: weights, sensitivityQuartiles: quartiles, fragileEdgeIds, restsOn }
    }

    return EMPTY_VISUALS
  }, [lensActive, lensOptionId, resultsStatus, report, nodes, edges, ceeAnalysisReady, lastServerGraphHash, outcomeNodeId, goalConstraints, servedBaselineOptions, worksheet])

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
