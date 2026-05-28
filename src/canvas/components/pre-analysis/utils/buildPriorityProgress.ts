/**
 * buildPriorityProgress — pure derivation for the top-3 priority-list
 * confirmation counter rendered above the priority cards.
 *
 * Brief: pre-analysis-power-v1 Task 5. The OLD `T1ContributionRow` rendered
 * a three-segment bar over `buildContributionBreakdown(allFactorNodes)`
 * (verified / brief / estimated) with a "0 of M inputs confirmed"
 * caption. That denominator counted the whole graph while the panel
 * surface showed only the top-3, producing the trust leak the brief calls
 * out. The NEW bar reflects priority-item confirmation only.
 *
 * Confirmation predicates:
 * - Node entries  — `isReviewedByUser(node)` from `./isReviewedByUser`
 *   (same predicate that powers the existing `reviewedFactorsCount`
 *   derivation, so the two counters cannot drift).
 * - Edge entries  — `isReviewedEdge(edge)` from `./isReviewedByUser`
 *   (pre-analysis-power-v2: checks `edge.data.userReviewedStrength`,
 *   set by the Weak / Moderate / Strong quick-select handler).
 *
 * Every visible top-3 entry counts toward `total` so the counter reads
 * "N of M" against the exact set of cards rendered above it. With the
 * edge predicate landed, edges can now reach `confirmed` too — a
 * priority list with a "Needs judgement" edge moves to 100% once the
 * user picks a strength.
 */

import type { Edge, Node } from '@xyflow/react'
import { isReviewedByUser, isReviewedEdge } from './isReviewedByUser'

export interface PriorityProgress {
  /** Number of top-3 entries the user has confirmed (node: source ∈ user_*, edge: userReviewedStrength). */
  confirmed: number
  /** Total visible top-3 entries — matches the rendered card count exactly. */
  total: number
}

interface PriorityEntryLike {
  card: {
    action?: {
      targetId?: string
      targetType?: 'node' | 'edge'
    }
  }
}

export function buildPriorityProgress(
  topThree: readonly PriorityEntryLike[],
  factorNodes: readonly Node[],
  edges: readonly Edge[] = [],
): PriorityProgress {
  const nodesById = new Map<string, Node>()
  for (const node of factorNodes) nodesById.set(node.id, node)
  const edgesById = new Map<string, Edge>()
  for (const edge of edges) edgesById.set(edge.id, edge)

  let confirmed = 0
  for (const entry of topThree) {
    const action = entry.card.action
    if (!action?.targetId) continue
    if (action.targetType === 'node') {
      const node = nodesById.get(action.targetId)
      if (node && isReviewedByUser(node)) confirmed++
    } else if (action.targetType === 'edge') {
      const edge = edgesById.get(action.targetId)
      if (edge && isReviewedEdge(edge)) confirmed++
    }
  }

  return { confirmed, total: topThree.length }
}
