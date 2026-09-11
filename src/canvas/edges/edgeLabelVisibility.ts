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
  /**
   * Does this edge state NOTHING — no strength, no direction, no likelihood?
   *
   * `nothingIsStated(...)` from `domain/edgeLabels`, which is the SAME function
   * `describeEdge` uses for its empty-state arm. It is imported rather than
   * re-expressed here on purpose: a second spelling of "is this edge blank"
   * would drift from the label it is supposed to describe, and the drift would
   * read green (CLAUDE.md trap 12).
   *
   * ⛔ WHY THE GATE NEEDS A SECOND AXIS AT ALL. `strengthIsSet` alone cannot
   * separate two edges that both lack a strength but say different things:
   *   "Boost, strength not set"        direction stated → a CLAIM with a hole
   *   "Strength and likelihood not set" nothing stated  → a DISCLOSURE of absence
   * The first is the truncated furniture the P2 ruling removed. The second is
   * the empty state #1318 ruled must be visible ON THE LINE, and it makes no
   * strength claim at all — so admitting it does not reopen what P2 closed.
   */
  nothingIsStated: boolean
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
 * ⚠ UNPINNED, AND ON TWO CHANNELS ONLY — COUNTED, NOT ASSERTED.
 *
 * ⛔ THIS COMMENT PREVIOUSLY NAMED FIVE CHANNELS AND FOUR OF THEM WERE FALSE.
 * It is corrected here rather than softened, because a justification that
 * overstates what survives is how a removal gets approved.
 *
 *   (1) THE INTERACTION CHIP — hover/select in Expert view (`:36-39`, which
 *       this change does not touch) still renders "Boost, strength not set",
 *       and carries `aria-label` + `title` ("Weight: not set"). ⚠ But those
 *       two are ATTRIBUTES OF THAT CHIP (`StyledEdge.tsx` `{showChip && (`,
 *       with the label and title inside it) — NOT channels of their own. When
 *       the chip goes in standard view, they go with it. The old comment
 *       counted them as two independent survivors; they are one.
 *   (2) THE HOVER POPOVER, in either view — but its unset line is gated
 *       `signedVal === null && confidencePct === null`, so it speaks only when
 *       the LIKELIHOOD is also unset.
 *
 * ⛔ NOT SURVIVORS AT ALL. `EdgePills` / `PreAnalysisInboundRows` mount under
 *    `!isPostAnalysis`, and a label requires `isResultsMode`. Both are
 *    `resultsStatus === 'complete'` — THE SAME PREDICATE, NEGATED. They are
 *    never on screen at the same time as the surface being changed, so they
 *    cannot cover for it.
 *
 * ⛔ AND THE QUOTED POPOVER SENTENCE DOES NOT EXIST. "…nobody has set the
 *    strength of this connection…" returns ZERO hits in `src/` outside this
 *    comment (contrast control, same sweep: "Strength and likelihood not set"
 *    → 11). It was quoted as witnessed copy and is not in the product.
 *
 * ⭐ THE RESIDUAL, STATED RATHER THAN DENIED: strength unset + likelihood SET,
 *    standard view, no hover — NO worded strength surface at all. The stroke
 *    still greys; the words do not appear. That is accepted here as the price
 *    of the overflow this gate exists to stop, and it is a real cost, not a
 *    rounding error. Removing a label IS removing a fact on that path.
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
    // ⭐ NARROWED, NOT WEAKENED (9 Sep 2026). The rule is still "a pinned label
    // must SPEAK A STRENGTH" — and an edge that states nothing makes no
    // strength claim to be wrong about. It discloses that the product knows
    // nothing, which is the one sentence it is entitled to say and which
    // #1318 ruled belongs on the line. Refusing it did not remove a claim, it
    // removed a disclosure, and left that class with no worded surface at all
    // outside hover.
    //
    // ⛔ EVERYTHING P2 REFUSED IS STILL REFUSED: an edge with a stated
    // direction and no strength ("Boost, strength not set" — 173.5px against a
    // 123px cap) still fails this gate, because it is not blank.
    if (!edge.strengthIsSet && !edge.nothingIsStated) continue
    if (claimedTargets.has(edge.target)) continue
    claimedTargets.add(edge.target)
    out.add(edge.id)
  }
  return out
}
