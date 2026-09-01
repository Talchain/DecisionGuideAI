/**
 * `resolveBridgeStrengthToGoal` — the strength of a risk's or an outcome's own
 * edge to the goal: the figure those two cards render as "strength 45% · est.".
 *
 * ⭐ IT WAS WRITTEN TWICE, BYTE-IDENTICALLY, IN `RiskNode` AND `OutcomeNode`,
 * and a third reader is exactly what made that a problem. Below the legibility
 * floor a node renders ONE reduced line (`lodMetricLine.ts`), and that resolver
 * receives a node's `data` and its display metadata — neither of which contains
 * this figure, because it lives on an EDGE. So on a real model every risk and
 * every outcome went blank the moment a user zoomed out, while their cards read
 * "strength 45% · est." one step up the ladder. Measured on deployed
 * `f3b1ca87`: 3 risks and 2 outcomes blank at 0.49 zoom on the Headcount
 * starter, and 2 risks and 1 outcome blank on a drafted post-analysis model.
 *
 * Copying the derivation a third time into the reduced line would have been the
 * estate's dominant defect (CLAUDE.md trap 12) in its worst possible location:
 * the two renderings are one zoom step apart, and the body the low-zoom line
 * would disagree with is HIDDEN, so no screen could ever show the divergence.
 * One owner, three readers.
 *
 * Behaviour is byte-for-byte what both components shipped; only the location
 * changed.
 */
import { resolveEdgeSignedStrengthDisplay } from '../../domain/edgeValueProvenance'
import type { Edge, Node } from '@xyflow/react'

export interface BridgeStrengthToGoal {
  /** Signed mean strength, or null when provenance withholds it. */
  signedMean: number | null
  /** Magnitude as whole percent, or null when there is nothing to show. */
  bridgeStrengthPct: number | null
  /** True when the strength was defaulted/estimated rather than user-stated. */
  bridgeIsEstimated: boolean
}

/**
 * ⛔ Provenance gate. The original test — `strength_mean` present OR
 * `weight != null` — could NOT fire: `DEFAULT_EDGE_DATA`/`USER_EDGE_DEFAULTS`
 * always define `weight`, so `hasStrength` was true for every edge that exists
 * in the product and this rendered `USER_EDGE_DEFAULTS.weight` (0.3) as a bold
 * coloured "contribution" figure. Same shape as the F1 defect in
 * `RelationshipsSection`: a gate whose condition is a tautology.
 *
 * @param sourceId   the risk/outcome node asking
 * @param goalNodeId the model's goal node, or null when it has none
 * @param edges      the graph's edges
 */
export function resolveBridgeStrengthToGoal(
  sourceId: string,
  goalNodeId: string | null,
  edges: Edge[],
): BridgeStrengthToGoal | null {
  if (!goalNodeId) return null
  const edge = edges.find(e => e.source === sourceId && e.target === goalNodeId)
  if (!edge) return null
  const display = resolveEdgeSignedStrengthDisplay(edge.data as Record<string, unknown> | undefined)
  const signedMean = display.show ? display.value : null
  // R6: is this strength an ESTIMATE or something the user stated? Derived
  // from the edge's own provenance stamp — the same field the display gate
  // above consults — never from a hardcoded word. `weightSource` absent means
  // defaulted (edgeValueProvenance's stated invariant), which is an estimate;
  // `'user'` means the user set it, and carries no marker at all.
  const weightSource = (edge.data as Record<string, unknown> | undefined)?.weightSource
  return {
    signedMean,
    bridgeStrengthPct: signedMean != null ? Math.round(Math.abs(signedMean) * 100) : null,
    bridgeIsEstimated: signedMean != null && weightSource !== 'user',
  }
}

/**
 * The model's goal node id, by the SAME test both components already used
 * (`n.data?.type === 'goal' || n.type === 'goal'`). Exported so a caller that
 * only needs the id — the reduced line's `BaseNode` host, which must select a
 * PRIMITIVE out of the store rather than subscribe to the whole node array —
 * asks this rather than restating the predicate.
 */
export function findGoalNodeId(nodes: Node[]): string | null {
  const goal = nodes.find(n => n.data?.type === 'goal' || n.type === 'goal')
  return goal ? goal.id : null
}
