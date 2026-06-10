/**
 * graphFacts — presence/count/structure extraction for the v3 panel.
 *
 * Pure functions over canvas nodes; the UI computes presence, counts and
 * structure only (boundary rule F.6) — no semantic judgements.
 */

import type { Node } from '@xyflow/react'
import { getObservedState } from '../../../utils/observedStateHelpers'
import { isReviewedByUser } from '../../pre-analysis/utils/isReviewedByUser'
import { isAiSource } from '../../pre-analysis/utils/isAiSource'

export function kindOf(node: Node): string {
  const dataKind = (node.data as Record<string, unknown> | undefined)?.kind
  return (typeof dataKind === 'string' && dataKind) || node.type || 'factor'
}

export interface GraphFacts {
  decisionNode: Node | null
  goalNode: Node | null
  factorNodes: Node[]
  optionCount: number
  riskCount: number
  /** True when every risk node carries AI provenance (count copy attribution). */
  risksAllOlumi: boolean
}

export function computeGraphFacts(nodes: ReadonlyArray<Node>): GraphFacts {
  let decisionNode: Node | null = null
  let goalNode: Node | null = null
  let outcomeFallback: Node | null = null
  const factorNodes: Node[] = []
  let optionCount = 0
  let riskCount = 0
  let risksAllOlumi = true

  for (const node of nodes) {
    switch (kindOf(node)) {
      case 'decision':
        if (!decisionNode) decisionNode = node
        break
      case 'goal':
        if (!goalNode) goalNode = node
        break
      case 'outcome':
        if (!outcomeFallback) outcomeFallback = node
        break
      case 'option':
        optionCount++
        break
      case 'risk': {
        riskCount++
        const provenance = (node.data as Record<string, unknown> | undefined)?.provenance
        if (provenance !== 'ai_inferred') risksAllOlumi = false
        break
      }
      case 'factor':
        factorNodes.push(node)
        break
      default:
        break
    }
  }

  return {
    decisionNode,
    // Audit detection: goal presence accepts a goal node, falling back to an
    // outcome node when no goal exists (kind ∈ {goal, outcome}).
    goalNode: goalNode ?? outcomeFallback,
    factorNodes,
    optionCount,
    riskCount,
    risksAllOlumi: riskCount > 0 ? risksAllOlumi : false,
  }
}

export interface ProvenanceCounts {
  /** Factors whose observed source is AI-supplied (Olumi estimates). */
  aiEstimatedCount: number
  /** Factors whose observed source is user-reviewed. */
  reviewedCount: number
  /**
   * Honest Estimates-bar denominator: factors carrying any observed source.
   * Stable under confirmation (a confirmed factor stays in the denominator
   * and moves into the numerator). Factors with no value at all are excluded
   * (they read "needs a value" instead of counting as unchecked estimates).
   */
  estimableCount: number
}

export function computeProvenanceCounts(factorNodes: ReadonlyArray<Node>): ProvenanceCounts {
  let aiEstimatedCount = 0
  let reviewedCount = 0
  let estimableCount = 0
  for (const node of factorNodes) {
    const source = getObservedState(node.data).source
    if (typeof source !== 'string' || source === '') continue
    estimableCount++
    if (isReviewedByUser(node)) reviewedCount++
    else if (isAiSource(source)) aiEstimatedCount++
  }
  return { aiEstimatedCount, reviewedCount, estimableCount }
}
