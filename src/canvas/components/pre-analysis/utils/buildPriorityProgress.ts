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
 * Confirmation source: `isReviewedByUser(node)` from
 * `./isReviewedByUser` — the same predicate that powers the existing
 * `reviewedFactorsCount` derivation, so the two counters cannot drift.
 *
 * **Denominator alignment (post-deploy review fix):** every visible top-3
 * entry counts toward `total` so the counter reads "N of M" against the
 * exact set of cards rendered above it. An edge entry today writes
 * `edge.data.weight` but no `source` marker, so it cannot reach
 * `confirmed`. We accept the trade-off: a top-3 with a "Needs judgement"
 * edge entry caps at `(visible nodes confirmed) of (visible count)`
 * until either (a) the edge card resolves and leaves the queue once the
 * user picks a strength, or (b) an edge-reviewed predicate is added in a
 * tier B brief. Hiding the edge from the count entirely (the prior
 * behaviour) produced a worse trust leak — viewers saw three cards but
 * a denominator of two with no visible explanation.
 */

import type { Node } from '@xyflow/react'
import { isReviewedByUser } from './isReviewedByUser'

export interface PriorityProgress {
  /** Number of top-3 entries whose underlying node has been confirmed by the user. Edge entries cannot reach `confirmed` today (no source marker on the write path). */
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
): PriorityProgress {
  const nodesById = new Map<string, Node>()
  for (const node of factorNodes) nodesById.set(node.id, node)

  let confirmed = 0
  for (const entry of topThree) {
    const action = entry.card.action
    // Confirmation is node-only today. Edge entries count toward total
    // (so the visible denominator matches the card list) but cannot
    // reach `confirmed` because the edge quick-select writes no
    // `source` marker.
    if (action?.targetType === 'node' && action.targetId) {
      const node = nodesById.get(action.targetId)
      if (node && isReviewedByUser(node)) confirmed++
    }
  }

  return { confirmed, total: topThree.length }
}
