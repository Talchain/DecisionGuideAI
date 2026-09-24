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
 *
 * ⛔ E2 WITHDRAWN — contract v3.1 (U10; pts 4 and 12). The default view pins NO
 * strength label at rest: stroke width carries magnitude (the 23 Sep ruling),
 * the `+`/`−`/`±` glyph carries direction, one discreet cue carries fragility,
 * and "strength, uncertainty and explanation remain in the existing
 * relationship inspector" (and the hover). Detailed view is unchanged.
 */

/**
 * Whether this view mode paints strength labels on the canvas AT ALL — pinned
 * or interaction-driven. One predicate for the render gate AND the placement
 * set, so the resolver never clears a box for a label that cannot paint.
 * contract v3.1 (U10): false for the default (standard) view.
 */
export function viewShowsStrengthLabels(viewMode: string): boolean {
  return viewMode !== 'standard'
}
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
  // contract v3.1 (U10): no strength label in the default view — pinned
  // (E2 withdrawn) or interaction-driven (Detailed-only since C1).
  if (!viewShowsStrengthLabels(input.viewMode)) return false
  return (
    input.isTopStrengthEdge ||
    input.selected || input.isHovered || input.hasSuggestion || (input.isFirstEdge && input.showEdgeHint)
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
