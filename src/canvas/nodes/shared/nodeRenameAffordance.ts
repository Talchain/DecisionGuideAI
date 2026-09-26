/**
 * ⭐⭐⭐ THE ONE EDIT EVERY NODE KIND SUPPORTS, ADVERTISED NOWHERE.
 *
 * ## The measurement
 *
 * Served `1f77130d`, the canonical pricing board, every node's controls
 * inventoried at rest AND on hover (`gainedOnHoverOnly=0`, so not a
 * missed-hover artefact — five consecutive false FAILs on edges came from
 * exactly that error and the method was rebuilt because of them):
 *
 *     silentlyUneditable = 9/15 — the decision, the goal, three options,
 *     both outcomes and both risks. No affordance AND no reason.
 *
 * And a second, geometry-free probe of the destination (`locator.click()` on
 * each node, no computed coordinate anywhere), controls fired
 * (`factorContrast=true`):
 *
 *     KIND decision 0/1 · goal 0/1 · option 0/4 · outcome 0/2 · risk 0/2
 *     KIND factor   4/5   reach a live editor
 *
 * ## ⛔ WHY THE FIX IS THE LABEL AND NOT A VALUE EDITOR
 *
 * `MODEL_CHANGING_SYSTEM_EVENT_TYPES` (`conversation/types.ts`) has SEVEN
 * members: one factor-value verb, one option-effect verb, two edge verbs, and
 * the structural add / add-edge / delete / rename. **There is no member that
 * carries an arbitrary node field.** So a risk's likelihood, an outcome's
 * range and a decision's description have no route to the shared model at all —
 * `RiskPanel`'s `setProbability` is a bare `updateNode`, and `InspectorRouter`
 * fences it besides. An affordance on those fields would be a fabrication.
 *
 * The LABEL is the exception, and it is the whole opportunity:
 * `store.updateNodeLabel` → `recordStructuralRenameIntent` →
 * `captureStructuralRename` has **no node-kind branch**, and the wire payload
 * (`{node_id, label, expected_label, base_graph_hash}`) has no `node_kind`
 * field to filter on. Every one of the six kinds can already be renamed, from
 * a canvas double-click (`ReactFlowGraph.handleNodeDoubleClick`, no kind gate),
 * and nothing on any card says so.
 *
 * ## ⛔ AND IT CLAIMS THE INTERACTION ONLY — DELIBERATELY, TWICE OVER
 *
 * 1. `canvasNodeRenameWithServerHash` is `'server_graph'` but its own note in
 *    `mutationAuthority.ts` says the value is **conditional on a CEE-stamped
 *    `graph_hash` seen this session**; without one the capture stands down and
 *    the rename is local-only. A card cannot see that, so a card must not
 *    promise durability. (CEE staging is degraded on the graph path today,
 *    which is exactly when a durability promise would be false.)
 * 2. `DecisionNode.tsx` records the precedent: a first cut of a rename CTA was
 *    dropped because **#1025 reverted #1024** — a label edit had no carrier and
 *    a server rehydrate silently discarded the user's rename. The carrier now
 *    exists; the lesson about over-promising does not expire with it.
 *
 * So: *what the click does*, never what the model will hold. The same rule
 * `goalNoTargetChannels` states for its own chip.
 *
 * ## ⚠ AND IT COMPOSES WITH THE LABEL RATHER THAN REPLACING IT
 *
 * `node-title` is `line-clamp-2`, so a hover route to the full name is the
 * reader's way to recover a clipped name. Overwriting it with an affordance
 * would trade a real capability for a hint.
 *
 * ## ⭐ v3.1: ONE TOOLTIP SYSTEM (DESIGN-GAP-v31 row 36)
 *
 * The name used to ride a NATIVE `title` — "<name>\n\nDouble-click to rename
 * it", on 15/15 cards of the served pricing board — beside the product's styled
 * tooltips: two tooltip systems on one card. The contract has one
 * (`.tooltip`, `components/Tooltip.tsx`). So the channels are now:
 *   · `tooltip` — the SAME two facts, for the ONE styled tooltip on the title:
 *     the full name first (the clipped-name route is kept; the title is
 *     `line-clamp-2`), then the affordance, so the rename stays discoverable
 *     to a sighted mouse user — only the chrome changed;
 *   · `accessibleName` — the card's name plus the affordance, unchanged, so a
 *     screen reader still hears what a double-click does.
 * The rule below still holds: it names the interaction, never an outcome.
 */

/** The interaction, in the estate's existing double-click vocabulary. */
export const NODE_RENAME_AFFORDANCE = 'Double-click to rename it'

/**
 * Every channel a reader can reach a node's name through, composed once.
 *
 * ⛔ ONE FUNCTION, BECAUSE THE ALTERNATIVE IS ALREADY A KNOWN DEFECT IN THIS
 * DIRECTORY. `GoalNode`'s promise had been hand-written into three channels
 * (visible text, `aria-label`, `title`) and withdrawing it from one left it in
 * the other two, "where nobody greps". Composed here, an edit moves all of
 * them or none.
 */
export function nodeTitleChannels({
  label,
  accessibleName,
}: {
  /** The node's own name, exactly as rendered. */
  label: string
  /** What the card's accessible name already says, before the affordance. */
  accessibleName: string
}): {
  tooltip: { name: string | null; affordance: typeof NODE_RENAME_AFFORDANCE }
  accessibleName: string
} {
  const name = label.trim()
  return {
    // Name first, so a clipped name is recoverable at a glance. A blank name
    // has nothing to recover, and the tooltip still says the useful thing.
    tooltip: { name: name.length > 0 ? name : null, affordance: NODE_RENAME_AFFORDANCE },
    accessibleName: `${accessibleName} ${NODE_RENAME_AFFORDANCE}`.trim(),
  }
}
