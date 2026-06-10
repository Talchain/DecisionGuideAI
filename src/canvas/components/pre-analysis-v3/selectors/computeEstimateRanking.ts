/**
 * computeEstimateRanking — orders factors by likely influence on the goal.
 *
 * Primary source: PLoT pre-analysis sensitivity (store.preAnalysisSensitivity,
 * fetched live or ingested from a draft). Stale-sensitivity guard (approved
 * correction): the payload is used only when its factor ids exactly match the
 * current factor set — any mismatch (factors removed or added since the
 * payload was computed) falls back to degree weighting, so influence ranking
 * is never displayed from a payload that no longer matches the model.
 *
 * Fallback: structural degree weighting (connections in + out, plus a base
 * weight of one so unconnected estimates still count — see UI-SEM-052 in
 * constants.ts). Copy stays hedged in both modes ("may matter most").
 */

import type { Edge, Node } from '@xyflow/react'
import type { PreAnalysisSensitivity } from '../../../../adapters/cee/types'
import { DEGREE_FALLBACK_BASE_WEIGHT } from '../constants'
import type { RankingResult } from '../types'

function labelOf(node: Node): string {
  const label = (node.data as Record<string, unknown> | undefined)?.label
  return typeof label === 'string' ? label : node.id
}

/** Exact id-set match between the sensitivity payload and current factors. */
export function sensitivityMatchesGraph(
  factorInfluence: Record<string, number>,
  factorNodes: ReadonlyArray<Node>,
): boolean {
  const keys = Object.keys(factorInfluence)
  if (keys.length !== factorNodes.length) return false
  const current = new Set(factorNodes.map(n => n.id))
  return keys.every(id => current.has(id))
}

export function computeEstimateRanking(
  factorNodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
  sensitivity: PreAnalysisSensitivity | null,
): RankingResult {
  const byId = new Map(factorNodes.map(n => [n.id, n]))

  const useSensitivity =
    sensitivity?.factor_influence != null &&
    sensitivityMatchesGraph(sensitivity.factor_influence, factorNodes)

  const weights: Record<string, number> = {}
  if (useSensitivity) {
    for (const [id, influence] of Object.entries(sensitivity!.factor_influence)) {
      weights[id] = influence
    }
  } else {
    const degree = new Map<string, number>()
    for (const edge of edges) {
      if (byId.has(edge.source)) degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
      if (byId.has(edge.target)) degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    }
    for (const node of factorNodes) {
      weights[node.id] = (degree.get(node.id) ?? 0) + DEGREE_FALLBACK_BASE_WEIGHT
    }
  }

  const ordered = factorNodes
    .map(n => n.id)
    .sort((a, b) => {
      const dw = (weights[b] ?? 0) - (weights[a] ?? 0)
      if (dw !== 0) return dw
      const la = labelOf(byId.get(a)!).toLowerCase()
      const lb = labelOf(byId.get(b)!).toLowerCase()
      if (la !== lb) return la < lb ? -1 : 1
      return a < b ? -1 : 1
    })

  return { source: useSensitivity ? 'sensitivity' : 'degree', weights, ordered }
}
