/**
 * ⭐⭐ THE LINK FROM THE WITHHELD-EXPLANATION SLOT TO THE EDITOR THAT ALREADY EXISTS.
 *
 * The Reasoning tab's withheld-reason slot renders CEE's own sentence about what
 * this run may not conclude (`buildAnalysisNewViewModel.ts`'s
 * `designationWithheldReason`, selected BY FIELD from
 * `analysis_admission.reasons`). On the live capture that sentence ends
 * "…until you have set at least one of them" — it tells the reader exactly what
 * to do, and until now its only adjacent control opened a CHAT DRAFT. The editor
 * that actually sets a value is one tab away and shipped.
 *
 * This module answers the one question that decides whether such a control may
 * render at all: **is there a factor the Model tab would actually give a value
 * editor to?** It is a REACHABILITY guard, and deliberately nothing more.
 *
 * ## ⛔ WHAT THIS IS NOT: A SECOND MATERIALITY AUTHORITY
 *
 * It does NOT decide which factor matters. That question belongs to the
 * producer: CEE's `comparisonSubstrate` computes the material set, and what
 * reaches the wire is counts (`material_parameters_total`,
 * `confidence_parameters_user_stated`, …) — never the set. `analysis_admission`
 * is absent from `@talchain/schemas` entirely, and
 * `adapters/cee/types.ts` rules that `semantic_signals` is "DELIBERATELY NOT
 * TYPED … Typing them would invite a consumer the contract does not yet
 * support."
 *
 * So the factor is taken from the ENGINE'S OWN intervention hint — the very
 * `Recommendation` that already populates
 * `analysis-new-glance-primary-intervention` — via its `targetId`. If the UI
 * picked the factor itself and CEE disagreed, one question would have two
 * authorities, which is this estate's most expensive defect class.
 *
 * ⛔ AND IT IS NOT `enrichment.factor_sensitivity`. That field carries
 * `factor_id` + `factor_label` and would look right, but it answers
 * SENSITIVITY, not materiality — a different axis. Using it as a proxy mints an
 * authority that merely resembles the producer's.
 *
 * ## ⚠⚠ WHY A KIND GUARD IS REQUIRED, AND WHY IT IS DERIVED
 *
 * `Recommendation.targetId` is documented as a "Canvas focus target (node/edge
 * id)", and the engine populates it from FOUR different sources
 * (`buildRecommendations.ts`):
 *
 *   `:464`  `item.targetIds[0] ?? null`   phase-3 producer item — kind UNKNOWN
 *   `:543`  `top.edgeId`                  an EDGE id
 *   `:578`  `lehi.factorId`               a factor id
 *   `:621`  `top.canFocus ? top.factorId` a factor id
 *
 * So `targetId` is NOT reliably a factor. `focusModelTarget` resolves an edge
 * happily and returns `true`, so routing an edge id through it would switch the
 * tab, report success, and land the reader in the factors section with no editor
 * open — a control that advertises a destination it does not reach. That is
 * verbatim the false promise `utils/focusOnCanvasCopy.ts` was written to ban.
 *
 * The guard is therefore `nodeKind(node) === 'factor'`, imported from
 * `model-tab-v2/adapters.ts` — **the Model tab's OWN kind resolver**, not a
 * re-expression of it. That matters: `KIND_GROUP.factor === 'factors'` and only
 * `kind === 'factor'` rows are built with `editable: true` in the factors group
 * (`adapters.ts`'s `toModelRows`). A hand-written "is this a factor?" predicate
 * here would be the hand-maintained mirror CLAUDE.md trap 12 is about — it would
 * drift the first time the projection changed, and the drift would read as a
 * working button.
 *
 * ## ⚠ THE LABEL IS PART OF THE GUARD, NOT DECORATION
 *
 * `resolveCanvasLabel` returns `null` rather than the id when no honest label
 * exists, precisely so callers must decide. The decision here is FAIL-CLOSED: a
 * control reading "Review the value for Unnamed element" names nothing and helps
 * nobody, so no label means no control. Every conjunct below fails closed, which
 * is why the caller can render on a non-null result without re-checking
 * anything.
 */
import { nodeKind } from '../../../canvas/model-tab-v2/adapters'
import { buildCanvasLabelMap, resolveCanvasLabel } from '../../../canvas/domain/canvasLabels'

/** A factor the Model tab will give a value editor to, with a name to print. */
export interface WithheldValueTarget {
  /** The canvas node id — handed to `focusModelTarget` verbatim. */
  nodeId: string
  /** The canvas label, via the one id → label policy. Never an id. */
  label: string
}

/**
 * The engine's intervention hint, narrowed to the only field this guard reads.
 * Narrow on purpose: widening it would invite this module to start choosing.
 */
export interface WithheldValueTargetHint {
  targetId: string | null
}

/**
 * Resolve the producer's intervention target to a focusable, value-editable
 * factor — or `null`, which means "render no control".
 *
 * @param hint  The engine's top intervention (`glancePrimary`), or null.
 * @param nodes The live canvas nodes — the same collection `focusModelTarget`
 *              resolves against, so the guard cannot pass on a node the focus
 *              call would then miss.
 */
export function resolveWithheldValueTarget(
  hint: WithheldValueTargetHint | null | undefined,
  nodes: readonly { id: string; type?: string; data?: unknown }[] | null | undefined,
): WithheldValueTarget | null {
  const targetId = hint?.targetId
  if (!targetId) return null
  if (!nodes || nodes.length === 0) return null

  const node = nodes.find((n) => n.id === targetId)
  // Not on the graph: `focusModelTarget` would fail closed here too. Agreeing
  // with it explicitly is cheaper than discovering the disagreement on a click.
  if (!node) return null

  // ⛔ THE EDGE REJECTION. See the header — `targetId` is a node OR edge id, and
  // only a factor node has a value editor to arrive at.
  if (nodeKind(node) !== 'factor') return null

  const label = resolveCanvasLabel(targetId, buildCanvasLabelMap(nodes))
  if (label === null) return null

  return { nodeId: targetId, label }
}
