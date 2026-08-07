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
