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
  /**
   * Did anyone actually SET this edge's strength?
   * `resolveEdgeSignedStrengthDisplay(edge.data).show` — the same resolver the
   * stroke width and the label's band adjective already read. Never a raw
   * `weight`: `DEFAULT_EDGE_DATA.weight = 0.5` supplies one on every edge
   * whether it was set or not, which is the whole reason this field exists.
   *
   * ⛔ REQUIRED, DELIBERATELY. Three call sites in `StyledEdge` rank edges into
   * this selector and only one of them used to apply this gate; the other two
   * pinned labels on edges nobody had characterised. Making it required means a
   * fourth branch cannot be added without answering the question — forgetting
   * is a type error rather than a silent label on the map.
   */
  strengthIsSet: boolean
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
 *
 * ⭐ P2 (Paul, 6 Sep 2026) — AND THE SECOND SUBTRACTION: A PINNED LABEL MUST
 * SPEAK A STRENGTH. The ruling on "every label legible at the zoom the product
 * parks at" is FEWER PERSISTENT LABELS — not sideways movement, not a shorter
 * vocabulary. An edge whose strength nobody set has nothing to say on the
 * strength channel, and said it in 23 characters: "Boost, strength not set"
 * measured 173.5px against a real 123px row cap on deployed staging
 * (2026-09-07) — 141% of the space — while being identical in INFORMATION on
 * every such edge. It is refused here.
 *
 * ⚠ THE FACT IS NOT LOST, ONLY UNPINNED. "This strength is not set" still
 * reaches the user through the hover popover ("Not set yet — nobody has set the
 * strength of this connection…", witnessed on staging 2026-09-07), the
 * `title` tooltip ("Weight: not set"), the `aria-label`, the interaction-driven
 * label on hover/selection in Detailed view, and the `EdgePills` /
 * `PreAnalysisInboundRows` "Link strength not set" marker. Removing a label is
 * not removing a fact.
 */
export function selectPersistentStrengthIds(
  rankedEdges: readonly RankedCausalEdge[],
  limit: number = PERSISTENT_LABEL_LIMIT,
): Set<string> {
  const claimedTargets = new Set<string>()
  const out = new Set<string>()
  for (const edge of rankedEdges) {
    if (out.size >= limit) break
    // ⭐ P2 (Paul, 6 Sep 2026) — FEWER PERSISTENT LABELS, AND THIS IS THE
    // SUBTRACTION. A pinned label is the STRENGTH channel; an edge whose
    // strength nobody set has nothing to say on it, and said so at length:
    // "Boost, strength not set" measures 173.5px against a REAL 123px row cap
    // on deployed staging (2026-09-07) — 141% of the space — so it was
    // truncated furniture occupying one of only three slots.
    //
    // ⛔ REFUSE BEFORE CLAIMING THE TARGET. Order is load-bearing: if a refused
    // edge claimed its target first, it would lock a sourced sibling out of the
    // one label that target is allowed, and the map would lose a legible label
    // to an illegible one. Pinned by its own case in the spec.
    if (!edge.strengthIsSet) continue
    if (claimedTargets.has(edge.target)) continue
    claimedTargets.add(edge.target)
    out.add(edge.id)
  }
  return out
}
