/**
 * computeInfluenceCoverage — influence-weighted review coverage.
 *
 * Extracted behaviour-identically from the inline transition-bridge block in
 * OutputsDock.handleRunAnalysis (pinned by the characterisation test). Shared
 * by the pre-analysis v3 Estimates bar, which injects the canonical
 * `isReviewedByUser` predicate instead of the bridge's historical source set.
 *
 * Coverage = Σ influence(reviewed factors) / Σ influence(all factors in the
 * payload). Zero denominator (or no payload) yields 0, never NaN.
 */

import type { Node } from '@xyflow/react'

/**
 * The transition bridge's historical reviewed-source set. Narrower than
 * `isReviewedByUser` (no bare 'user' alias) — pinned as-is so extraction does
 * not change OutputsDock behaviour. New consumers should prefer
 * `isReviewedByUser` from `../../pre-analysis/utils/isReviewedByUser`.
 */
const TRANSITION_BRIDGE_REVIEWED_SOURCES: ReadonlySet<string> = new Set([
  'user_confirmed',
  'user_assumption',
  'user_override',
  'user_edited',
])

/** Mirrors the inline bridge check: factor kind, observedState-first source read. */
export function isTransitionBridgeReviewed(node: Node): boolean {
  const nd = node.data as Record<string, unknown>
  if (nd?.kind !== 'factor' && node.type !== 'factor') return false
  const os = (nd?.observedState ?? (nd as Record<string, unknown>)?.observed_state) as
    | Record<string, unknown>
    | undefined
  const source = os?.source as string | undefined
  return source !== undefined && TRANSITION_BRIDGE_REVIEWED_SOURCES.has(source)
}

export interface InfluenceCoverageResult {
  /** Count of reviewed factor nodes (regardless of sensitivity payload). */
  verifiedCount: number
  /** 0..1 influence-weighted share of reviewed factors; 0 when no payload. */
  influenceCoverage: number
  /** Ids of reviewed factor nodes. */
  reviewedIds: ReadonlySet<string>
}

export function computeInfluenceCoverage(
  nodes: ReadonlyArray<Node>,
  factorInfluence: Record<string, number> | null | undefined,
  isReviewed: (node: Node) => boolean,
): InfluenceCoverageResult {
  const reviewedIds = new Set<string>()
  let verifiedCount = 0
  for (const node of nodes) {
    const nd = node.data as Record<string, unknown>
    if (nd?.kind !== 'factor' && node.type !== 'factor') continue
    if (isReviewed(node)) {
      reviewedIds.add(node.id)
      verifiedCount++
    }
  }

  let influenceCoverage = 0
  if (factorInfluence) {
    let reviewedSum = 0
    let totalSum = 0
    for (const [id, influence] of Object.entries(factorInfluence)) {
      totalSum += influence
      if (reviewedIds.has(id)) reviewedSum += influence
    }
    influenceCoverage = totalSum > 0 ? reviewedSum / totalSum : 0
  }

  return { verifiedCount, influenceCoverage, reviewedIds }
}
