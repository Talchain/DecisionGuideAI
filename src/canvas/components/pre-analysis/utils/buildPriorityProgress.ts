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
 * **Edge-type entries are excluded from both numerator AND denominator.**
 * Edge cards in the top-3 are answered via the Weak / Moderate / Strong
 * quick-select; the handler at
 * `PreAnalysisPanel.tsx` (`onUpdateEdgeStrength`) writes `weight` and
 * clears `strength_mean` but does NOT set a `source` field that
 * `isReviewedByUser` could read. Counting them in the denominator would
 * mean a top-3 containing any "Needs judgement" edge card can never reach
 * 100% confirmation, no matter what the user clicks. Excluding them from
 * both sides keeps the visible bar honest until an edge-reviewed
 * predicate is added (deferred to a tier B brief). The edge cards still
 * render in the list and remain actionable; they just don't gate the
 * "First pass confidence" count.
 */

import type { Node } from '@xyflow/react'
import { isReviewedByUser } from './isReviewedByUser'

export interface PriorityProgress {
  /** Number of top-3 NODE-type entries whose underlying node has been confirmed by the user. */
  confirmed: number
  /**
   * Number of top-3 NODE-type entries (edge entries are excluded from
   * both numerator and denominator — see header comment).
   */
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
  let total = 0
  for (const entry of topThree) {
    const action = entry.card.action
    // Skip entries that cannot be confirmed via the predicate today: edge
    // entries (no equivalent edge predicate) and node entries without a
    // targetId (cannot resolve the underlying node).
    if (!action || action.targetType !== 'node' || !action.targetId) continue
    total++
    const node = nodesById.get(action.targetId)
    if (!node) continue
    if (isReviewedByUser(node)) confirmed++
  }

  return { confirmed, total }
}
