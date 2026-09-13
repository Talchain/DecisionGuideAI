/**
 * Which relationships the Model tab can actually serve a strength editor for.
 *
 * ⭐⭐ THIS EXISTS BECAUSE "CAN THE WIRE CARRY IT" IS NOT "CAN THE READER REACH
 * IT", AND ONLY THE SECOND ONE LICENSES AN ACT. A surface that offers to take
 * someone somewhere is making a claim about the destination, so the claim has to
 * be the destination's own — assembled from its authorities, never restated.
 *
 * The destination row renders its editor on
 * `editorAvailable = row.editable && editConnected && typeof onBeginEdit === 'function'`
 * (`canvas/model-tab-v2/ModelRowView.tsx`). For a relationship row `row.editable`
 * is unconditionally `true` (`canvas/model-tab-v2/adapters.ts`) and `onBeginEdit`
 * is always supplied by the live panel, so the two conjuncts that depend on the
 * data are the two below — and they are facts about DIFFERENT things, which is
 * the whole reason both are needed:
 *
 *   1. THE ROW EXISTS — the outline builds relationship rows only from
 *      `getCausalEdges`, so an edge touching a decision or option node has no row
 *      to arrive at. A fact about the edge's ENDPOINTS.
 *   2. THE STRENGTH IS ASSERTABLE — `edgeStrengthEditIsAssertable` asks the wire
 *      builder whether it would build, rather than re-deriving its rule. A fact
 *      about the edge's DATA.
 *
 * ⛔ AN EDGE CAN SATISFY EITHER AND FAIL THE OTHER, so a gate on one alone is not
 * a weaker version of this — it is wrong in a direction that ships. Assertable
 * but not causal routes a reader to a section that never renders their row; causal
 * but not assertable renders the row with no control under it. Both are the same
 * defect this module exists to make unreachable: an act that lands on nothing.
 *
 * ⚠ NOTHING HERE DECIDES ANYTHING. Both conjuncts are imported calls. If either
 * owner changes its rule this follows, which is the point — the alternative is a
 * third copy of someone else's predicate, drifting silently the first time it
 * moves (CLAUDE.md trap 12: the dominant defect is the hand-maintained mirror).
 */
import type { Edge } from '@xyflow/react'
import { getCausalEdges } from '../../../canvas/domain/edgeUtils'
import { edgeStrengthEditIsAssertable } from '../../../canvas/conversation/edgeStrengthEdit'
import type { EdgeData } from '../../../canvas/domain/edges'

export function reviewableStrengthEdgeIds(
  nodes: readonly { id: string; type?: string; data?: unknown }[],
  edges: readonly Edge<EdgeData>[],
): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const edge of getCausalEdges(
    nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
    edges as Edge<EdgeData>[],
  )) {
    if (edgeStrengthEditIsAssertable(edge)) ids.add(edge.id)
  }
  return ids
}
