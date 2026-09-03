/**
 * edgeLabelVisibility — the single policy for when a causal edge renders its
 * strength label. Extracted from StyledEdge so the rule is explicit and
 * unit-testable (the component's own render path needs the full ReactFlow +
 * store harness).
 *
 * Baseline (C1): labels require a completed run and a non-structural edge; in
 * Detailed/Model view the interaction-driven triggers (selection, hover,
 * pending suggestion, first-edge hint) also show a label.
 *
 * E2 (graph-visuals 2026-07-11): the top-strength labels ALSO surface in the
 * default (standard) view once results exist, so the few key relationships are
 * legible without switching views. The interaction-driven triggers stay
 * Detailed-only to keep the default map uncluttered.
 */
export interface EdgeLabelVisibilityInput {
  /** The active graph view mode ('standard' = the default map). */
  viewMode: string
  /** True once an analysis run has completed (results.status === 'complete'). */
  isResultsMode: boolean
  /** Structural edges (decision→option, option→factor) never show causal labels. */
  isStructuralEdge: boolean
  /** True when this edge is among the top-strength causal edges (or ≤3 exist). */
  isTopStrengthEdge: boolean
  selected: boolean
  isHovered: boolean
  hasSuggestion: boolean
  isFirstEdge: boolean
  showEdgeHint: boolean
}

export function shouldShowEdgeLabel(input: EdgeLabelVisibilityInput): boolean {
  if (!input.isResultsMode || input.isStructuralEdge) return false
  // E2: top-strength labels surface in EITHER view once results exist.
  if (input.isTopStrengthEdge) return true
  // Interaction-driven triggers remain Detailed/Model-only.
  return (
    input.viewMode !== 'standard' &&
    (input.selected || input.isHovered || input.hasSuggestion || (input.isFirstEdge && input.showEdgeHint))
  )
}

/**
 * A causal edge as the persistent-label ranker hands it over: already in
 * DESCENDING rank order, ties already broken by id.
 */
export interface RankedCausalEdge {
  id: string
  /** The edge's target node id — the axis the cap is applied along. */
  target: string
}

/** How many persistent labels the canvas may pin at once. */
export const PERSISTENT_LABEL_LIMIT = 3

/**
 * The persistent-label SET: keep the best-ranked edge PER TARGET, then take
 * the top `limit`.
 *
 * ⛔ THIS IS THE SECOND OF THE TWO EXITS `edgeLabelCollision.ts` NAMES, and it
 * is subtraction rather than a new heuristic. That file records a measurement,
 * not a preference: with one vertical degree of freedom and a fixed 160-wide
 * box, "three labels converging on a goal card have no clean assignment, and
 * no weighting invents one" — a tried LEADER_PENALTY cut the worst
 * displacement 252 -> 144 and took label-on-label overlaps 2 -> 3. The
 * resolver cannot place three labels into a space that fits two, so the
 * product stops asking it to.
 *
 * Ordering is the caller's: post-analysis ranks by composite importance and
 * pre-analysis by |strength.mean|, two comparators over one policy. Keeping
 * the sort at the call site leaves this a pure, order-preserving filter with
 * one job, and keeps the ranking vocabulary with its existing owner.
 */
export function selectPersistentStrengthIds(
  rankedEdges: readonly RankedCausalEdge[],
  limit: number = PERSISTENT_LABEL_LIMIT,
): Set<string> {
  const claimedTargets = new Set<string>()
  const out = new Set<string>()
  for (const edge of rankedEdges) {
    if (out.size >= limit) break
    if (claimedTargets.has(edge.target)) continue
    claimedTargets.add(edge.target)
    out.add(edge.id)
  }
  return out
}
